import { Arg, Mutation, PubSub, Publisher, Resolver } from "type-graphql";

import { ROOM_SUBSCRIPTION } from "../constants";
import { Room, Player } from "../entities";

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

    const isParticipated = room.participants.find((itm) => itm.id === playerId);
    if (!!isParticipated) throw new Error("Already part of the group");

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
}

export default PlayerResolver;
