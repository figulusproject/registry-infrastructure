import z from "zod";
import { stringifiedStringArraySchema, validFilePathSchema } from "./types.js";

const parseCliArgs = (args: string[]) => {
  const normalized: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const keyMatch = arg.match(/^--([^=]+)$/);
    if (keyMatch && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      normalized.push(`${arg}=${args[i + 1]}`);
      i++;
    } else {
      normalized.push(arg);
    }
  }

  return Object.fromEntries(
    normalized
      .map((arg) => arg.match(/^--([^=]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(([, key, value]) => [key.toLowerCase(), value])
  );
};

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
      .transform(parseCliArgs)
      .pipe(parsedArgsSchema)
  );

export const args = argsSchema.parse(process.argv);
