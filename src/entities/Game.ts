import { Field, ObjectType } from "type-graphql";
import { TypeormLoader } from "type-graphql-dataloader";
import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import CheckPoint from "./CheckPoint";

@ObjectType()
@Entity()
class Game extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column({ type: "int" })
  maxParticipantCount: number;

  @Field()
  @Column({ type: "int" })
  imposterCount: number;

  @Field(() => [CheckPoint])
  @OneToMany(() => CheckPoint, (checkPoint) => checkPoint.game)
  @TypeormLoader()
  checkPoints: Array<CheckPoint>;

  @Field()
  @Column({ type: "float" })
  latitude: number;

  @Field()
  @Column({ type: "float" })
  longitude: number;

  @Field()
  @Column({ type: "float" })
  latitudeDelta: number;

  @Field()
  @Column({ type: "float" })
  longitudeDelta: number;
}

export default Game;
