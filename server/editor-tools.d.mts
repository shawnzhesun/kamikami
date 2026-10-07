import type { z } from "zod";
export const definitions: [
  string,
  string,
  Record<string, z.ZodType>,
  boolean,
][];
