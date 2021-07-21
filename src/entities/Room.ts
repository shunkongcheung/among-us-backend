import { Field, Int, ObjectType } from "type-graphql";
import { TypeormLoader } from "type-graphql-dataloader";
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import Corpse from "./Corpse";
import Game from "./Game";
import Player from "./Player";

@ObjectType()
@Entity()
class Room extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Game)
  @ManyToOne(() => Game)
  @TypeormLoader()
  game: Game;

  @Field()
  @Column()
  @Index({ unique: true })
  code: string;

  @Field(() => [Player])
  @JoinTable()
  @ManyToMany(() => Player)
  @TypeormLoader()
  participants: Array<Player>;

  @Field(() => [Player])
  @JoinTable()
  @ManyToMany(() => Player)
  @TypeormLoader()
  imposters: Array<Player>;

  @Field(() => [Player])
  @JoinTable()
  @ManyToMany(() => Player)
  @TypeormLoader()
  survivers: Array<Player>;

  @Field(() => [Corpse])
  @JoinTable()
  @OneToMany(() => Corpse, (corpse) => corpse.room)
  @TypeormLoader()
  corpses: Array<Corpse>;

  @Field(() => Int)
  @Column({ type: "integer" })
  completeCount: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  startAt?: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  endAt?: Date;
}

export default Room;
