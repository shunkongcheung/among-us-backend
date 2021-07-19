import { registerEnumType } from "type-graphql";

export enum Task {
  WIRE = "WIRE",
  UPLOAD = "UPLOAD",
  DOWNLOAD = "DOWNLOAD",
  EXPERIMENT = "EXPERIMENT",
}

registerEnumType(Task, { name: "Task" });
