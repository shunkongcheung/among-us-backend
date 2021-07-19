import { Request, Response } from "express";

interface GraphQLContext {
  req: Request;
  res: Response;
}

export { GraphQLContext };
