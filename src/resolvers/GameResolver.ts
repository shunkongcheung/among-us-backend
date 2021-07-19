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

// const getRandomStr = (length = 8) => {
//   // Declare all characters
//   let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

//   // Pick characers randomly
//   let str = "";
//   for (let i = 0; i < length; i++) {
//     str += chars.charAt(Math.floor(Math.random() * chars.length));
//   }

//   return str;
// };

// const getUniqueRandStr = async () => {
//   let done = false;
//   while (!done) {
//     const rand = getRandomStr();
//     const game = await Game.findOne({ code: rand });
//     if (!game) return rand;
//   }
// };

@Resolver()
class GameResolver {
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
    // game.code = await getUniqueRandStr();

    game.maxParticipantCount = gameInput.maxParticipantCount;
    game.imposterCount = gameInput.imposterCount;

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
