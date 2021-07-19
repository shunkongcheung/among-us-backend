import { Field, ObjectType } from "type-graphql";
import { TypeormLoader } from "type-graphql-dataloader";
import {
  BaseEntity,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import Game from "./Game";
import Player from "./Player";
import Room from "./Room";
import VoteEntry from "./VoteEntry";

@ObjectType()
@Entity()
class VoteEvent extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @ManyToOne(() => Room)
  @TypeormLoader()
  room: Room;

  @Field()
  @ManyToOne(() => Game)
  @TypeormLoader()
  game: Game;

  @Field({ nullable: true })
  @ManyToOne(() => Player)
  @TypeormLoader()
  voteOutPlayer?: Player;

  @Field(() => [VoteEntry])
  @OneToMany(() => VoteEntry, (voteEntry: VoteEntry) => voteEntry.voteEvent)
  @TypeormLoader()
  votes: Array<VoteEntry>;
}

export default VoteEvent;
