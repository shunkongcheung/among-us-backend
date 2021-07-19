import { FieldResolver, Resolver, Root } from "type-graphql";

import { Player, VoteEntry } from "../entities";

@Resolver(() => VoteEntry)
class VoteEntryResolver {
  @FieldResolver(() => Player)
  async voteFor(@Root() root: VoteEntry) {
    const voteEntry = await VoteEntry.findOne({
      where: { id: root.id },
      relations: ["voteFor"],
    });
    return voteEntry.voteFor;
  }

  @FieldResolver(() => Player)
  async voteBy(@Root() root: VoteEntry) {
    const voteEntry = await VoteEntry.findOne({
      where: { id: root.id },
      relations: ["voteBy"],
    });
    return voteEntry.voteBy;
  }
}

export default VoteEntryResolver;
