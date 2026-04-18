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
    // Placeholder error code for if a new, more specific code needs to be added but hasn't been yet. Should not be used in production.
  z.object({ code: z.literal("ERROR_TYPE_UNKNOWN"), context: z.string(), }),
]);
type ErrorInput = z.infer<typeof errorInputSchema>;

export const errorCodeSchema = z.enum(errorInputSchema.options.map((f) => f.def.shape.code.value));
export type ErrorCode = z.infer<typeof errorCodeSchema>;

type ErrorInputFromCode<Code extends ErrorCode> = Extract<ErrorInput, { code: Code }>;

const messageMap: { [Code in ErrorCode]: (input: ErrorInputFromCode<Code>) => string } = {
  FILE_TYPE_UNKNOWN: (input) => `File path does not match any known registry structure`,
  BLOB_INVALID_FILENAME: (input) => `Invalid blob filename`,
  BLOB_MISSING_EXTENSION: (input) => `Blob filename must have extension`,
  BLOB_INVALID_EXTENSION: (input) => `Invalid blob extension: ${input.extension} (must be js, figspec, or figstack)`,
  BLOB_HASH_MISMATCH: (input) => `Hash mismatch: filename hash ${input.expectedHash} does not match content hash ${input.actualHash}`,
  BLOB_VERIFICATION_FAILED: (input) => `Failed to verify blob: ${input.error}`,
  BLOB_REFERENCE_NOT_FOUND: (input) => `Variant references blob ${input.contentHash} but blobs/${input.namespace}/${input.contentHash}.${input.extension} does not exist in the repository`,
  ENTITY_PARSE_ERROR: (input) => `Failed to parse ${input.type}: ${input.error}`,
  ENTITY_SCHEMA_INVALID: (input) => `${input.path}: ${input.error}`,
  NAMESPACE_RESERVED: (input) => `Cannot update namespace "${input.namespace}": this name is reserved. You must be a registry maintainer to write to this namespace.`,
  NAMESPACE_NOT_FOUND: (input) => `Namespace "${input.namespace}" does not exist. Run \`figulus registry claim ${input.namespace}\` to claim it before publishing.`,
  NAMESPACE_NOT_EDITOR: (input) => `PR author "${input.author}" is not listed as an editor for namespace "${input.namespace}"`,
  NAMESPACE_PARSE_ERROR: (input) => `Failed to parse namespace metadata: ${input.error}`,
  NAMESPACE_PARSE_HEAD_ERROR: (input) => `Failed to parse HEAD version of namespace metadata: ${input.error}`,
  NAMESPACE_OWNERSHIP_TRANSFER_DENIED: (input) => `Only the namespace owner ("${input.headOwner}") can transfer ownership`,
  PERMISSION_DENIED_MAINTAINER_ONLY: (input) => `Only registry maintainers can modify ${input.path}`,
  PUSH_LIMIT_EXCEEDED: (input) => `Push limit exceeded for namespace "${input.namespace}": ${input.pushesUsed}/${input.pushLimit} ${input.pushUnit} pushes used. Limit set by ${input.limitSource}.`,
  PUSH_LIMIT_OUT_OF_RANGE: (input) => `${input.context} push limit ${input.provided}/${input.pushUnit} is outside allowed range: ${input.constraintMin}-${input.constraintMax}`,
    // Placeholder error code for if a new, more specific code needs to be added but hasn't been yet. Should not be used in production.
  ERROR_TYPE_UNKNOWN: (input) => `Unknown error: ${input.context}`,
};

function getMessage<Code extends ErrorCode>(input: ErrorInputFromCode<Code>) {
  return messageMap[input.code](input);
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

export function createError<Code extends ErrorCode>(input: ErrorInputFromCode<Code>): ValidationError {
  return { message: getMessage<Code>(input), code: input.code };
}

export function createWarning<Code extends ErrorCode>(
  input: ErrorInputFromCode<Code>
): ValidationError {
  return createError<Code>(input);
}

export function success(warnings: ValidationError[] = []): SuccessResult {
  return warnings.length > 0 ? { success: true, warnings } : { success: true };
}

export function failure(errors: ValidationError[]): FailureResult {
  return { success: false, errors };
}
