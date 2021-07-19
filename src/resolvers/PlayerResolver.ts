import {
  Arg,
  Mutation,
  Subscription,
  PubSub,
  Publisher,
  Root,
  Resolver,
} from "type-graphql";

import { Room, Player } from "../entities";
import { GraphQLContext } from "../GraphQLContext";

const ROOM_SUBSCRIPTION = "ROOM_SUBSCRIPTION";

interface FilterArgs {
  context: GraphQLContext;
  payload: Room;
}

@Resolver()
class PlayerResolver {
  @Mutation(() => Player)
  async register(@Arg("name") name: string) {
    const player = new Player();
    player.name = name;
    await player.save();

    return player;
  }

  @Mutation(() => Room)
  async join(@Arg("playerId") playerId: number, @Arg("code") code: string) {
    const [player, room] = await Promise.all([
      Player.findOne(playerId),
      Room.findOne({
        where: { code },
        relations: ["game", "participants", "survivers"],
      }),
    ]);

    if (!player) throw new Error("Invalid player id");
    if (!room) throw new Error("Invalid code");
    if (room.game.maxParticipantCount <= room.participants.length)
      throw new Error("Room is full");

    room.survivers.push(player);
    room.participants.push(player);
    await room.save();

    return room;
  }

  @Mutation(() => Room)
  async completeTask(
    @Arg("roomId") roomId: number,
    @PubSub(ROOM_SUBSCRIPTION) publish: Publisher<Room>
  ) {
    const room = await Room.findOneOrFail(roomId);
    room.completeCount++;

    // complete enough task to win this game
    if (room.completeCount >= room.totalTask) room.endAt = new Date();
    await room.save();

    // trigger subscription event
    await publish(room);

    return room;
  }

  @Mutation(() => Room)
  async kill(
    @Arg("roomId") roomId: number,
    @Arg("playerId") playerId: number,
    @PubSub(ROOM_SUBSCRIPTION) publish: Publisher<Room>
  ) {
    const room = await Room.findOneOrFail({
      where: { id: roomId },
      relations: ["survivers", "imposters"],
    });

    const isImposter = !!room.imposters.find((itm) => itm.id === playerId);
    if (isImposter) throw new Error("Cannot kill another imposter");

    room.survivers = room.survivers.filter((itm) => itm.id !== playerId);

    // crewmates# has to be more than imposters# in order to win
    if (room.survivers.length <= room.imposters.length * 2)
      room.endAt = new Date();

    await room.save();

    // trigger subscription event
    await publish(room);

    return room;
  }

  // @Mutation(() => Room)
  // async voteOut(
  //   @Arg("roomId") roomId: number,
  //   @Arg("playerId") playerId: number,
  //   @PubSub(ROOM_SUBSCRIPTION) publish: Publisher<Room>
  // ) {
  //   const room = await Room.findOneOrFail({
  //     where: { id: roomId },
  //     relations: ["survivers", "imposters"],
  //   });

  //   room.imposters = room.imposters.filter((itm) => itm.id !== playerId);
  //   room.survivers = room.survivers.filter((itm) => itm.id !== playerId);

  //   // crewmates# has to be more than imposters# in order to win
  //   if (room.survivers.length <= room.imposters.length * 2)
  //     room.endAt = new Date();

  //   // imposters are all dead
  //   if (!!room.imposters.length) room.endAt = new Date();

  //   // trigger subscription event
  //   await publish(room);

  //   await room.save();
  //   return room;
  // }

  // subscribe to room
  @Subscription({
    topics: ROOM_SUBSCRIPTION,
    filter: async (args: FilterArgs) => {
      const { payload, context } = args;
      const { req } = context;
      const playerId = req.headers["Authorization"];

      const room = await Room.createQueryBuilder("room")
        .innerJoin("room.participants", "participants")
        .where("participants.id = :playerId", { playerId })
        .andWhere("room.id = :roomId", { roomId: payload.id })
        .getOne();

      return !!room;
    },
  })
  onRoomChange(@Root() room: Room): Room {
    return room;
  }
}

export default PlayerResolver;