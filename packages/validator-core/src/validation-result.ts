import z from "zod";

const errorInputSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("FILE_TYPE_UNKNOWN") }),
  z.object({ code: z.literal("BLOB_INVALID_FILENAME") }),
  z.object({ code: z.literal("BLOB_MISSING_EXTENSION") }),
  z.object({ code: z.literal("BLOB_INVALID_EXTENSION"), extension: z.string() }),
  z.object({ code: z.literal("BLOB_HASH_MISMATCH"), expectedHash: z.string(), actualHash: z.string(), }),
  z.object({ code: z.literal("BLOB_VERIFICATION_FAILED"), error: z.string() }),
  z.object({ code: z.literal("BLOB_REFERENCE_NOT_FOUND"), contentHash: z.string(), namespace: z.string(), extension: z.string(), }),
  z.object({ code: z.literal("ENTITY_PARSE_ERROR"), type: z.string(), error: z.string(), }),
  z.object({ code: z.literal("ENTITY_SCHEMA_INVALID"), path: z.string(), error: z.string(), }),
  z.object({ code: z.literal("NAMESPACE_RESERVED"), namespace: z.string(), }),
  z.object({ code: z.literal("NAMESPACE_NOT_FOUND"), namespace: z.string(), }),
  z.object({ code: z.literal("NAMESPACE_NOT_EDITOR"), namespace: z.string(), author: z.string(), }),
  z.object({ code: z.literal("NAMESPACE_PARSE_ERROR"), error: z.string(), }),
  z.object({ code: z.literal("NAMESPACE_PARSE_HEAD_ERROR"), error: z.string(), }),
  z.object({ code: z.literal("NAMESPACE_OWNERSHIP_TRANSFER_DENIED"), headOwner: z.string(), }),
  z.object({ code: z.literal("PERMISSION_DENIED_MAINTAINER_ONLY"), path: z.string(), }),
  z.object({ code: z.literal("PUSH_LIMIT_EXCEEDED"), namespace: z.string(), pushesUsed: z.int(), pushLimit: z.int(), pushUnit: z.enum(["daily", "weekly"]), limitSource: z.string(), }),
  z.object({ code: z.literal("PUSH_LIMIT_OUT_OF_RANGE"), context: z.string(), provided: z.int(), pushUnit: z.enum(["daily", "weekly"]), constraintMin: z.int(), constraintMax: z.int(), }),
]);
type ErrorInput = z.infer<typeof errorInputSchema>;

const errorCodeSchema = z.enum(errorInputSchema.options.map((f) => f.def.shape.code.value));
export type ErrorCode = z.infer<typeof errorCodeSchema>;

const messageMap: { [k in ErrorCode]: string } = {
  FILE_TYPE_UNKNOWN: "File path does not match any known registry structure",
  BLOB_INVALID_FILENAME: "Invalid blob filename",
  BLOB_MISSING_EXTENSION: "Blob filename must have extension",
  BLOB_INVALID_EXTENSION: "Invalid blob extension: ${extension} (must be js, figspec, or figstack)",
  BLOB_HASH_MISMATCH: "Hash mismatch: filename hash ${expectedHash} does not match content hash ${actualHash}",
  BLOB_VERIFICATION_FAILED: "Failed to verify blob: ${error}",
  BLOB_REFERENCE_NOT_FOUND: "Variant references blob ${contentHash} but blobs/${namespace}/${contentHash}.${extension} does not exist in the repository",
  ENTITY_PARSE_ERROR: "Failed to parse ${type}: ${error}",
  ENTITY_SCHEMA_INVALID: "${path}: ${error}",
  NAMESPACE_RESERVED: "Cannot update namespace \"${namespace}\": this name is reserved. You must be a registry maintainer to write to this namespace.",
  NAMESPACE_NOT_FOUND: "Namespace \"${namespace}\" does not exist. Run \`figulus registry claim ${namespace}\` to claim it before publishing.",
  NAMESPACE_NOT_EDITOR: "PR author \"${author}\" is not listed as an editor for namespace \"${namespace}\"",
  NAMESPACE_PARSE_ERROR: "Failed to parse namespace metadata: ${error}",
  NAMESPACE_PARSE_HEAD_ERROR: "Failed to parse HEAD version of namespace metadata: ${error}",
  NAMESPACE_OWNERSHIP_TRANSFER_DENIED: "Only the namespace owner (\"${headOwner}\") can transfer ownership",
  PERMISSION_DENIED_MAINTAINER_ONLY: "Only registry maintainers can modify ${path}",
  PUSH_LIMIT_EXCEEDED: "Push limit exceeded for namespace \"${namespace}\": ${pushesUsed}/${pushLimit} ${pushUnit} pushes used. Limit set by ${limitSource}.",
  PUSH_LIMIT_OUT_OF_RANGE: "${context} push limit ${provided}/${pushUnit} is outside allowed range: ${constraintMin}-${constraintMax}",
};

function getMessage(input: ErrorInput) {
  const entries = Object.entries(input).filter((e) => e[0] !== "code");
  const msgBase = messageMap[input.code];
  let output = msgBase;
  for(const e of entries) {
    output = output.replaceAll("${" + e[0] + "}", String(e[1]));
  }
  return output;
}

export interface ValidationError {
  message: string;
  code: ErrorCode;
}

export interface SuccessResult {
  success: true;
  warnings?: ValidationError[];
}

export interface FailureResult {
  success: false;
  errors: ValidationError[];
}

export type ValidationResult = SuccessResult | FailureResult;

export function createError(input: ErrorInput): ValidationError {
  return { message: getMessage(input), code: input.code };
}

export function createWarning(
  input: ErrorInput
): ValidationError {
  return createError(input);
}

export function success(warnings: ValidationError[] = []): SuccessResult {
  return warnings.length > 0 ? { success: true, warnings } : { success: true };
}

export function failure(errors: ValidationError[]): FailureResult {
  return { success: false, errors };
}
