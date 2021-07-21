import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@ObjectType()
@Entity()
class Player extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  color: string;

  @Field()
  @Column()
  hat: string;

  @Field()
  @Column({ type: "float", default: 0.0 })
  latitude: number;

  @Field()
  @Column({ type: "float", default: 0.0 })
  longitude: number;
}

export default Player;
