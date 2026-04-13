export const ERROR_CODES = {
  // File type errors
  FILE_TYPE_UNKNOWN: "FILE_TYPE_UNKNOWN",

  // Blob errors
  BLOB_INVALID_FILENAME: "BLOB_INVALID_FILENAME",
  BLOB_MISSING_EXTENSION: "BLOB_MISSING_EXTENSION",
  BLOB_INVALID_EXTENSION: "BLOB_INVALID_EXTENSION",
  BLOB_HASH_MISMATCH: "BLOB_HASH_MISMATCH",
  BLOB_VERIFICATION_FAILED: "BLOB_VERIFICATION_FAILED",
  BLOB_REFERENCE_NOT_FOUND: "BLOB_REFERENCE_NOT_FOUND",

  // Entity errors
  ENTITY_PARSE_ERROR: "ENTITY_PARSE_ERROR",
  ENTITY_SCHEMA_INVALID: "ENTITY_SCHEMA_INVALID",

  // Namespace errors
  NAMESPACE_RESERVED: "NAMESPACE_RESERVED",
  NAMESPACE_NOT_FOUND: "NAMESPACE_NOT_FOUND",
  NAMESPACE_NOT_EDITOR: "NAMESPACE_NOT_EDITOR",
  NAMESPACE_PARSE_ERROR: "NAMESPACE_PARSE_ERROR",
  NAMESPACE_SCHEMA_INVALID: "NAMESPACE_SCHEMA_INVALID",
  NAMESPACE_OWNERSHIP_TRANSFER_DENIED: "NAMESPACE_OWNERSHIP_TRANSFER_DENIED",

  // Permissions
  PERMISSION_DENIED_MAINTAINER_ONLY: "PERMISSION_DENIED_MAINTAINER_ONLY",

  // Push limit
  PUSH_LIMIT_EXCEEDED: "PUSH_LIMIT_EXCEEDED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

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

export function createError(message: string, code: ErrorCode): ValidationError {
  return { message, code };
}

export function createWarning(
  message: string,
  code: ErrorCode,
): ValidationError {
  return { message, code };
}

export function success(warnings: ValidationError[] = []): SuccessResult {
  return warnings.length > 0 ? { success: true, warnings } : { success: true };
}

export function failure(errors: ValidationError[]): FailureResult {
  return { success: false, errors };
}

export function failureFromStrings(
  messages: string[],
  code: ErrorCode,
): FailureResult {
  return {
    success: false,
    errors: messages.map((msg) => createError(msg, code)),
  };
}
