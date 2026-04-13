import {
  ValidationResult,
  ERROR_CODES,
  createError,
  success,
} from "../validation-result.js";

export function validateOwnershipTransfer(
  headOwner: string | undefined,
  submittedOwner: string | undefined,
  prAuthor: string,
): ValidationResult {
  if (submittedOwner !== headOwner && prAuthor !== headOwner) {
    return {
      success: false,
      errors: [
        createError(
          `Only the namespace owner ("${headOwner}") can transfer ownership`,
          ERROR_CODES.NAMESPACE_OWNERSHIP_TRANSFER_DENIED,
        ),
      ],
    };
  }

  return success();
}
