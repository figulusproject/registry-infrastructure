import stripComments from "strip-json-comments";
import z from "zod";
import { ChangedFile } from "../changed-file.js";
import {
  ValidationResult,
  ERROR_CODES,
  createError,
  success,
} from "../validation-result.js";

export function parseJSON(data: string): any {
  return JSON.parse(stripComments(data));
}

export function parseSchema(
  data: any,
  schema: z.ZodType<any>,
): ValidationResult {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((err) => {
      const path = err.path.length > 0 ? err.path.join(".") : "root";
      return createError(
        `${path}: ${err.message}`,
        ERROR_CODES.ENTITY_SCHEMA_INVALID,
      );
    });
    return { success: false, errors };
  }
  return success();
}

export function parseFileJson(file: ChangedFile): any {
  try {
    const { settings, helpers } = file.pr.registry;
    const { fs } = helpers;

    const fullPath = fs.resolvePath(settings.repoRoot, file.path);
    const content = fs.readFileAsUtf8(fullPath);

    return parseJSON(content);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
