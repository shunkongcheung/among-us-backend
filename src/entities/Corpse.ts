import { Field, ObjectType } from "type-graphql";
import { TypeormLoader } from "type-graphql-dataloader";
import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import Player from "./Player";
import Room from "./Room";

@ObjectType()
@Entity()
class Corpse extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Room, (room: Room) => room.corpses)
  room: Room;

  @Field(() => Player)
  @ManyToOne(() => Player)
  @TypeormLoader()
  player: Player;

  @Field()
  @Column({ type: "float" })
  latitude: number;

  @Field()
  @Column({ type: "float" })
  longitude: number;
}

export default Corpse;
