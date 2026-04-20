import z from "zod";
import { stringifiedStringArraySchema, validFilePathSchema } from "./types.js";

const parseCliArgs = (args: string[]) =>
  Object.fromEntries(
    args
      .map((arg, i, arr) => {
        const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
        if (!match) return null;
        if (match[2] !== undefined) return match;
        const nextArg = arr[i + 1];
        if (nextArg && !nextArg.startsWith("--")) return [arg, match[1], nextArg];
        return null;
      })
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(([, key, value]) => [key.toLowerCase(), value])
  );

const parsedArgsSchema = z.object({
    "changed-files": stringifiedStringArraySchema.pipe(z.array(validFilePathSchema)),
    "author": z.string(),
    "repo-root": validFilePathSchema.optional(),
    "registry-url": z.url().optional(),
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
      .refine((c) => console.log("DEBUG:", c))
      .transform(parseCliArgs)
      .pipe(parsedArgsSchema)
  );

export const args = argsSchema.parse(process.argv);
