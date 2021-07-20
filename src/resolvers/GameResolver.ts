import { Min } from "class-validator";
import {
  Int,
  InputType,
  Field,
  Query,
  Resolver,
  Mutation,
  Arg,
  Args,
  ArgsType,
  FieldResolver,
  Root,
} from "type-graphql";
import { ILike } from "typeorm";

import { CheckPoint, Game } from "../entities";
import { Task } from "../types";

@InputType()
class CheckPointInputType {
  @Field(() => Task)
  task: Task;

  @Field()
  latitude: number;

  @Field()
  longitude: number;
}

@InputType()
class GameInputType {
  @Field()
  name: string;

  @Field()
  @Min(2)
  maxParticipantCount: number;

  @Field()
  @Min(1)
  imposterCount: number;

  @Field()
  @Min(1)
  totalTask: number;

  @Field()
  @Min(1)
  durationMinute: number;

  @Field(() => [CheckPointInputType])
  checkPoints: Array<CheckPointInputType>;

  @Field()
  latitude: number;

  @Field()
  longitude: number;

  @Field()
  latitudeDelta: number;

  @Field()
  longitudeDelta: number;
}

@ArgsType()
class GameFilter {
  @Field({ nullable: true })
  id?: number;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  @Min(1)
  count: number;

  get skip(): number {
    return (this.page - 1) * this.count;
  }
}

@Resolver(() => Game)
class GameResolver {
  @FieldResolver(() => CheckPoint)
  async checkPoints(@Root() root: Game) {
    const game = await Game.findOne({
      where: { id: root.id },
      relations: ["checkPoints"],
    });
    return game.checkPoints;
  }

  @Query(() => [Game])
  games(@Args() args: GameFilter) {
    const { id, name, count: take, skip } = args;

    if (!id && !name) return Game.find({ take, skip });

    const where: any = {};
    if (!!id) where.id = id;
    if (!!name) where.name = ILike(`%${name}%`);
    return Game.find({ where, take, skip });
  }

  @Mutation(() => Game)
  async createGame(@Arg("game") gameInput: GameInputType) {
    const game = new Game();
    game.name = gameInput.name;

    game.maxParticipantCount = gameInput.maxParticipantCount;
    game.imposterCount = gameInput.imposterCount;
    game.totalTask = gameInput.totalTask;
    game.durationMinute = gameInput.durationMinute;

    game.latitude = gameInput.latitude;
    game.longitude = gameInput.longitude;
    game.latitudeDelta = gameInput.latitudeDelta;
    game.longitudeDelta = gameInput.longitudeDelta;

    await game.save();

    const { checkPoints: checkPointInputs } = gameInput;
    await Promise.all(
      checkPointInputs.map(async (checkPointInput) => {
        const checkPoint = new CheckPoint();
        checkPoint.game = game;
        checkPoint.task = checkPointInput.task;
        checkPoint.latitude = checkPointInput.latitude;
        checkPoint.longitude = checkPointInput.longitude;

        await checkPoint.save();
      })
    );

    return game;
  }
}

export default GameResolver;
