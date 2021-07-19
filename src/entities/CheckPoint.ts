import { Field, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import Game from "./Game";
import { Task } from "../types";

@ObjectType()
@Entity()
class CheckPoint extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Game)
  @ManyToOne(() => Game, (game: Game) => game.checkPoints)
  game: Game;

  @Field(() => Task)
  @Column({ type: "enum", enum: Task })
  task: Task;

  @Field()
  @Index()
  @Column({ type: "float" })
  latitude: number;

  @Field()
  @Index()
  @Column({ type: "float" })
  longitude: number;
}

export default CheckPoint;
