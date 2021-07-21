import {
  Arg,
  Field,
  InputType,
  Mutation,
  PubSub,
  Publisher,
  Resolver,
  Root,
  Subscription,
} from "type-graphql";

import { PLAYER_LOCATION_SUBSCRIPTION, ROOM_SUBSCRIPTION } from "../constants";
import { Room, Player } from "../entities";

interface FilterArgs {
  payload: Player;
  args: { playerId: number };
}

@InputType()
class PlayerInputType {
  @Field()
  name: string;

  @Field()
  hat: string;

  @Field()
  color: string;
}

@Resolver()
class PlayerResolver {
  @Mutation(() => Player)
  async editUser(
    @Arg("player") playerInput: PlayerInputType,
    @Arg("playerId", { nullable: true }) playerId?: number
  ) {
    const player = !!playerId
      ? await Player.findOneOrFail(playerId)
      : new Player();
    player.name = playerInput.name;
    player.color = playerInput.color;
    player.hat = playerInput.hat;
    player.latitude = 0;
    player.longitude = 0;
    await player.save();

    return player;
  }

  @Mutation(() => Player)
  async editPlayerLocation(
    @Arg("playerId") playerId: number,
    @Arg("latitude") latitude: number,
    @Arg("longitude") longitude: number,
    @PubSub(PLAYER_LOCATION_SUBSCRIPTION) publish: Publisher<Player>
  ) {
    const player = await Player.findOneOrFail(playerId);
    player.latitude = latitude;
    player.longitude = longitude;
    await player.save();
    await publish(player);
    return player;
  }

  @Mutation(() => Room)
  async join(
    @Arg("playerId") playerId: number,
    @Arg("code") code: string,
    @PubSub(ROOM_SUBSCRIPTION) publish: Publisher<Room>
  ) {
    const [player, room] = await Promise.all([
      Player.findOne(playerId),
      Room.findOne({
        where: { code },
        relations: ["game", "participants", "survivers"],
      }),
    ]);

    if (!player) throw new Error("Invalid player id");
    if (!room) throw new Error("Invalid code");

    const isParticipated = room.participants.find((itm) => itm.id === playerId);
    if (!!isParticipated) throw new Error("Already part of the group");

    if (room.game.maxParticipantCount <= room.participants.length)
      throw new Error("Room is full");

    room.survivers.push(player);
    room.participants.push(player);
    await room.save();

    await publish(room);

    return room;
  }

  @Mutation(() => Room)
  async completeTask(
    @Arg("roomId") roomId: number,
    @PubSub(ROOM_SUBSCRIPTION) publish: Publisher<Room>
  ) {
    const room = await Room.findOneOrFail({
      where: { id: roomId },
      relations: ["game"],
    });
    room.completeCount++;

    // complete enough task to win this game
    if (room.completeCount >= room.game.totalTask) room.endAt = new Date();
    await room.save();

    // trigger subscription event
    await publish(room);

    return room;
  }

  @Subscription({
    topics: PLAYER_LOCATION_SUBSCRIPTION,
    filter: async ({ payload, args }: FilterArgs) => {
      const { playerId } = args;

      const [payloadPlayerRoomIds, requestPlayerRoomIds] = await Promise.all([
        getParticipatedRoomIds(payload.id),
        getParticipatedRoomIds(playerId),
      ]);

      if (!payloadPlayerRoomIds.length || !requestPlayerRoomIds.length)
        return false;

      const isInterseted = !!payloadPlayerRoomIds.find((itm) =>
        requestPlayerRoomIds.includes(itm)
      );
      return isInterseted;
    },
  })
  onPlayerLocation(@Arg("playerId") _: number, @Root() player: Player): Player {
    return player;
  }
}

const getParticipatedRoomIds = async (playerId: number) => {
  const rooms = await Room.createQueryBuilder("room")
    .select("room.id")
    .leftJoin("room.participants", "participants")
    .where("participants.id = :playerId", { playerId })
    .andWhere("NOT room.startAt IS NULL")
    .andWhere("room.endAt IS NULL")
    .getMany();

  return rooms.map((itm) => itm.id);
};

export default PlayerResolver;
