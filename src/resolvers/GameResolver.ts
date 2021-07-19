import { Query, Resolver } from "type-graphql";

@Resolver()
class GameResolver {
  @Query(() => String)
  games() {
    return "hello world";
  }
}

export default GameResolver;
