import { randomUUID } from "node:crypto";

export const uuidv4 = () => {
  return randomUUID();
};
