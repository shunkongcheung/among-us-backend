import {
  Arg,
  FieldResolver,
  Mutation,
  PubSub,
  Publisher,
  Resolver,
  Subscription,
  Root,
} from "type-graphql";

import { ROOM_SUBSCRIPTION, VOTE_SUBSCRIPTION } from "../constants";
import { Room, Game, VoteEntry, VoteEvent } from "../entities";

interface FilterArgs {
  payload: Room;
  args: { playerId: number };
}

@Resolver(() => VoteEvent)
class VoteResolver {
  @FieldResolver(() => Game)
  async game(@Root() root: VoteEvent) {
    const voteEvent = await VoteEvent.findOne({
      where: { id: root.id },
      relations: ["game"],
    });
    return voteEvent.game;
  }

  @FieldResolver(() => Game)
  async voteOutPlayer(@Root() root: VoteEvent) {
    const voteEvent = await VoteEvent.findOne({
      where: { id: root.id },
      relations: ["voteOutPlayer"],
    });
    return voteEvent.voteOutPlayer;
  }

  @FieldResolver(() => Room)
  async room(@Root() root: VoteEvent) {
    const voteEvent = await VoteEvent.findOne({
      where: { id: root.id },
      relations: ["room"],
    });
    return voteEvent.room;
  }

  @FieldResolver(() => [VoteEntry])
  async votes(@Root() root: VoteEvent) {
    const voteEvent = await VoteEvent.findOne({
      where: { id: root.id },
      relations: ["votes"],
    });
    return voteEvent.votes;
  }

  @Mutation(() => VoteEvent)
  async startVoteEvent(
    @Arg("roomId") roomId: number,
    @PubSub(VOTE_SUBSCRIPTION) publish: Publisher<VoteEvent>
  ) {
    const room = await Room.findOneOrFail({
      where: { id: roomId },
      relations: ["game"],
    });

    const incompleteVoteEvent = await VoteEvent.find({
      where: { isCompleted: false, room },
    });

    if (!!incompleteVoteEvent.length) throw new Error("A Vote has started");

    const voteEvent = new VoteEvent();
    voteEvent.room = room;
    voteEvent.game = room.game;
    await voteEvent.save();

    await publish(voteEvent);

    return voteEvent;
  }

  @Mutation(() => VoteEvent)
  async vote(
    @PubSub(VOTE_SUBSCRIPTION) publishVote: Publisher<VoteEvent>,
    @PubSub(ROOM_SUBSCRIPTION) publishRoom: Publisher<Room>,
    @Arg("voteEventId") voteEventId: number,
    @Arg("voteById") voteById: number,
    @Arg("voteForId", { nullable: true }) voteForId?: number
  ) {
    let voteEvent = await VoteEvent.findOne({
      where: { id: voteEventId },
      relations: [
        "room",
        "room.survivers",
        "room.imposters",
        "votes",
        "votes.voteFor",
        "votes.voteBy",
      ],
    });

    const { room, votes } = voteEvent;
    const { survivers, imposters } = room;

    const prevVote = votes.find((itm) => itm.voteBy.id === voteById);
    if (!!prevVote) throw new Error("Already voted");

    // vote entry creation
    const voteFor = survivers.find((itm) => itm.id === voteForId);
    const voteBy = survivers.find((itm) => itm.id === voteById);

    if (!voteBy) throw new Error("Invalid Vote By ID");

    const voteEntry = new VoteEntry();
    voteEntry.voteEvent = voteEvent;
    voteEntry.voteBy = voteBy;
    voteEntry.voteFor = voteFor;
    await voteEntry.save();

    // check if vote finished
    const voteTotal = votes.length + 1;
    if (voteTotal === survivers.length) {
      // form a vote graph and find the counts
      const voteGraph: { [x: number]: number } = {};
      if (voteFor) voteGraph[voteFor.id] = 1;
      votes.map(({ voteFor }) => {
        if (!voteFor) return;
        const { id } = voteFor;
        voteGraph[id] = (voteGraph[id] || 0) + 1;
      });

      // find the vote out player id
      const { id: voteOutPlayerId } = Object.entries(voteGraph).reduce(
        (prev, [id, count]) => {
          if (prev.count > count) return prev;
          return { id: Number(id), count };
        },
        { id: null, count: -1 }
      );

      // find the vote out player
      const voteOutPlayer = survivers.find((itm) => itm.id === voteOutPlayerId);

      // store vote out player
      voteEvent = await VoteEvent.findOne(voteEventId);
      voteEvent.voteOutPlayer = voteOutPlayer;
      voteEvent.isCompleted = true;
      await voteEvent.save();

      // filter out vote out player in room
      room.imposters = imposters.filter((itm) => itm.id !== voteOutPlayerId);
      room.survivers = survivers.filter((itm) => itm.id !== voteOutPlayerId);

      // imposter lost
      const isImposterLost = !room.imposters.length;

      // crewmate lost
      const isCrewmateLost = room.survivers.length <= room.imposters.length * 2;

      // game is finished
      const isFinished = isImposterLost || isCrewmateLost;
      if (isFinished) room.endAt = new Date();

      await room.save();
      if (isFinished) await publishRoom(room);
    }

    await publishVote(voteEvent);
    return voteEvent;
  }

  @Subscription({
    topics: VOTE_SUBSCRIPTION,
    filter: async ({ payload, args }: FilterArgs) => {
      const { playerId } = args;

      const voteEvent = await VoteEvent.findOne({
        where: { id: payload.id },
        relations: ["room"],
      });

      const room = await Room.createQueryBuilder("room")
        .innerJoin("room.participants", "participants")
        .where("participants.id = :playerId", { playerId })
        .andWhere("room.id = :roomId", { roomId: voteEvent.room.id })
        .getOne();

      return !!room;
    },
  })
  onVoteEvent(
    @Arg("playerId") playerId: number,
    @Root() voteEvent: VoteEvent
  ): VoteEvent {
    return voteEvent;
  }
}

export default VoteResolver;
