import "reflect-metadata";

import { ApolloServer } from "apollo-server-express";
import * as dotenv from "dotenv";
import * as express from "express";
import * as http from "http";
import { createConnection, getConnection } from "typeorm";
import { buildSchema } from "type-graphql";
import { ApolloServerLoaderPlugin } from "type-graphql-dataloader";

import * as Resolvers from "./resolvers";
import { GraphQLContext } from "./GraphQLContext";

(async () => {
  const PORT = 3000;

  // configure dotenv
  dotenv.config();

  // connect to database
  await createConnection();

  // express instance
  const app = express();

  // create apollo instance
  const schema = await buildSchema({
    resolvers: Object.values(Resolvers) as any,
  });
  const server = new ApolloServer({
    schema,
    context: ({ req, res }): GraphQLContext => ({ req, res }),
    plugins: [
      ApolloServerLoaderPlugin({ typeormGetConnection: getConnection }),
    ],
  });
  await server.start();
  server.applyMiddleware({ app });

  // start listening
  const httpServer = http.createServer(app);
  // server.installSubscriptionHandlers(httpServer);
  httpServer.listen(PORT, () => {
    console.log(
      `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`
    );
    // console.log(
    //   `🚀 Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`
    // );
  });
})();
