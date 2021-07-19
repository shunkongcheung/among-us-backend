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

import { VOTE_SUBSCRIPTION } from "../constants";
import { Room, Game, VoteEntry, VoteEvent } from "../entities";
import { GraphQLContext } from "../GraphQLContext";

interface FilterArgs {
  context: GraphQLContext;
  payload: Room;
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
    @PubSub(VOTE_SUBSCRIPTION) publish: Publisher<VoteEvent>,
    @Arg("voteEventId") voteEventId: number,
    @Arg("voteById") voteById: number,
    @Arg("voteForId") voteForId?: number
  ) {
    const voteEvent = await VoteEvent.findOne({
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

    const { survivers, imposters } = voteEvent.room;
    const { votes } = voteEvent;

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
    console.log({ voteFor, voteBy, voteTotal });
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

      console.log({ voteGraph, voteOutPlayerId });

      // find the vote out player
      const voteOutPlayer = survivers.find((itm) => itm.id === voteOutPlayerId);

      // store vote out player
      voteEvent.voteOutPlayer = voteOutPlayer;
      voteEvent.isCompleted = true;
      await voteEvent.save();

      // filter out vote out player in room
      voteEvent.room.imposters = imposters.filter(
        (itm) => itm.id !== voteOutPlayerId
      );
      voteEvent.room.survivers = survivers.filter(
        (itm) => itm.id !== voteOutPlayerId
      );

      // imposter lost
      const isImposterLost = !voteEvent.room.imposters.length;

      // crewmate lost
      const isCrewmateLost =
        voteEvent.room.survivers.length <= voteEvent.room.imposters.length * 2;

      // game is finished
      if (isImposterLost || isCrewmateLost) {
        voteEvent.room.endAt = new Date();
      }

      await voteEvent.room.save();
    }

    await publish(voteEvent);
    return voteEvent;
  }

  @Subscription({
    topics: VOTE_SUBSCRIPTION,
    filter: async (args: FilterArgs) => {
      const { payload, context } = args;
      const { req } = context;
      const playerId = req.headers["Authorization"];

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
  onVoteEvent(@Root() voteEvent: VoteEvent): VoteEvent {
    return voteEvent;
  }
}

export default VoteResolver;
