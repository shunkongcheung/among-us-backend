import { Field, ObjectType } from "type-graphql";
import { TypeormLoader } from "type-graphql-dataloader";
import { BaseEntity, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import Player from "./Player";
import VoteEvent from "./VoteEvent";

@ObjectType()
@Entity()
class VoteEntry extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => VoteEvent)
  @ManyToOne(() => VoteEvent, (voteEvent) => voteEvent.votes)
  @TypeormLoader()
  voteEvent: VoteEvent;

  @Field(() => Player, { nullable: true })
  @ManyToOne(() => Player)
  @TypeormLoader()
  voteFor?: Player;

  @Field(() => Player)
  @ManyToOne(() => Player)
  @TypeormLoader()
  voteBy: Player;
}

export default VoteEntry;
