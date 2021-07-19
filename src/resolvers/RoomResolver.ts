import {
  Arg,
  FieldResolver,
  Mutation,
  Publisher,
  PubSub,
  Resolver,
  Root,
  Subscription,
} from "type-graphql";
import { Permutation } from "../../node_modules/js-combinatorics/umd/combinatorics.js";

import { ROOM_SUBSCRIPTION } from "../constants";
import { Game, Player, Room } from "../entities";
import { GraphQLContext } from "../GraphQLContext";

interface FilterArgs {
  context: GraphQLContext;
  payload: Room;
}

@Resolver(() => Room)
class RoomResolver {
  @FieldResolver(() => [Player])
  async survivers(@Root() root: Room) {
    const room = await Room.findOne({
      where: { id: root.id },
      relations: ["survivers"],
    });
    return room.survivers;
  }

  @FieldResolver()
  async imposters(@Root() root: Room) {
    const room = await Room.findOne({
      where: { id: root.id },
      relations: ["imposters"],
    });
    return room.imposters;
  }

  @FieldResolver(() => [Player])
  async participants(@Root() root: Room) {
    const room = await Room.findOne({
      where: { id: root.id },
      relations: ["participants"],
    });
    return room.participants;
  }

  @Mutation(() => Room)
  async createRoom(@Arg("gameId") gameId: number) {
    const game = await Game.findOne(gameId);
    if (!game) throw new Error("Invalid room ID");

    const room = new Room();
    room.game = game;
    room.code = await getUniqueRandStr();
    room.completeCount = 0;
    await room.save();

    return room;
  }

  @Mutation(() => Room)
  async startRoom(@Arg("roomId") roomId: number) {
    const room = await Room.findOneOrFail({
      where: { id: roomId },
      relations: ["game", "participants"],
    });
    if (!!room.startAt) throw new Error("Room already started");

    const { imposterCount } = room.game;
    const participantsCount = room.participants.length;
    if (participantsCount <= imposterCount * 2) {
      throw new Error("Not enough Participant");
    }

    const indexes = Array.from({ length: participantsCount }).map(
      (_, idx) => idx
    );

    const combo = new Permutation(indexes, imposterCount);
    const total = combo.length;
    const imposterIdxs = combo.nth(Math.floor(total * Math.random()));

    const imposters = imposterIdxs.map((idx: number) => room.participants[idx]);
    room.imposters = imposters;
    room.startAt = new Date();
    await room.save();

    return room;
  }

  @Mutation(() => Room)
  async endRoom(
    @Arg("roomId") roomId: number,
    @PubSub(ROOM_SUBSCRIPTION) publish: Publisher<Room>
  ) {
    const room = await Room.findOneOrFail({
      where: { id: roomId },
      relations: ["game"],
    });

    const { startAt, endAt } = room;
    const { durationMinute } = room.game;

    if (!!endAt) return room;

    const curr = new Date();
    const difference = curr.getTime() - startAt.getTime();
    const diffMin = Math.ceil(difference / (1000 * 60));

    if (diffMin > durationMinute) {
      room.endAt = new Date();
      await room.save();
      await publish(room);
    }

    return room;
  }

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

const getRandomStr = (length = 8) => {
  // Declare all characters
  let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  // Pick characers randomly
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return str;
};

const getUniqueRandStr = async () => {
  let done = false;
  while (!done) {
    const rand = getRandomStr();
    const room = await Room.findOne({ code: rand });
    if (!room) return rand;
  }
};

export default RoomResolver;
