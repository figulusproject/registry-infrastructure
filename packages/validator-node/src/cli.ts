import z from "zod";
import { stringifiedStringArraySchema, validFilePathSchema } from "./types.js";

const parseCliArgs = (args: string[]) =>
  Object.fromEntries(
    args
      .map((arg) => arg.match(/^--([^=]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(([, key, value]) => [key.toLowerCase(), value])
  );

const parsedArgsSchema = z.object({
    "changed-files": stringifiedStringArraySchema.pipe(z.array(validFilePathSchema)),
    "author": z.string(),
    "repo-root": validFilePathSchema.optional(),
    "settings-file": validFilePathSchema.optional(),
    "output-file": z.string().optional(),
});

const requiredArgsLength = Object.values(
    parsedArgsSchema.shape
).filter((f) =>f.def.type !== "optional").length;

const argsSchema = z
  .string()
  .array()
  .min(3)
  .transform((args) => args.slice(2))
  .pipe(
    z
      .string()
      .array()
      .min(requiredArgsLength)
      .transform(parseCliArgs)
      .pipe(parsedArgsSchema)
  );

export const args = argsSchema.parse(process.argv);
