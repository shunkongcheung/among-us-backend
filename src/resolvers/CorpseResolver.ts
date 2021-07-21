import {
  Arg,
  Mutation,
  PubSub,
  Publisher,
  Resolver,
  Root,
  Subscription,
  FieldResolver,
} from "type-graphql";

import { CORPSE_SUBSCRIPTION, ROOM_SUBSCRIPTION } from "../constants";
import { Corpse, Player, Room } from "../entities";

interface FilterArgs {
  payload: Room;
  args: { playerId: number };
}

@Resolver(() => Corpse)
class CorpseResolver {
  @FieldResolver(() => Player)
  async player(@Root() root: Corpse) {
    const corpse = await Corpse.findOne({
      where: { id: root.id },
      relations: ["player"],
    });
    return corpse.player;
  }

  @Mutation(() => Room)
  async kill(
    @Arg("roomId") roomId: number,
    @Arg("playerId") playerId: number,
    @Arg("latitude") latitude: number,
    @Arg("longitude") longitude: number,
    @PubSub(CORPSE_SUBSCRIPTION) cPublish: Publisher<Room>,
    @PubSub(ROOM_SUBSCRIPTION) rPublish: Publisher<Room>
  ) {
    const room = await Room.findOneOrFail({
      where: { id: roomId },
      relations: ["survivers", "imposters"],
    });

    const isImposter = !!room.imposters.find((itm) => itm.id === playerId);
    if (isImposter) throw new Error("Cannot kill another imposter");

    const killed = room.survivers.find((itm) => itm.id === playerId);
    room.survivers = room.survivers.filter((itm) => itm.id !== playerId);

    // create corpse
    const corpse = new Corpse();
    corpse.player = killed;
    corpse.room = room;
    corpse.latitude = latitude;
    corpse.longitude = longitude;
    await corpse.save();

    // crewmates# has to be more than imposters# in order to win
    const isImposterWin = room.survivers.length <= room.imposters.length * 2;
    if (isImposterWin) room.endAt = new Date();

    await room.save();

    // trigger subscription event
    const promises = [cPublish(room)];
    if (isImposterWin) promises.push(rPublish(room));
    await Promise.all(promises);

    return room;
  }

  @Subscription(() => [Corpse], {
    topics: CORPSE_SUBSCRIPTION,
    filter: async ({ payload, args }: FilterArgs) => {
      const { playerId } = args;

      const room = await Room.createQueryBuilder("room")
        .innerJoin("room.participants", "participants")
        .where("participants.id = :playerId", { playerId })
        .andWhere("room.id = :roomId", { roomId: payload.id })
        .getOne();

      return !!room;
    },
  })
  async onCorpses(
    @Arg("playerId") _: number,
    @Root() root: Room
  ): Promise<Array<Corpse>> {
    const room = await Room.findOne({
      where: { id: root.id },
      relations: ["corpses"],
    });
    return room.corpses;
  }
}

export default CorpseResolver;
