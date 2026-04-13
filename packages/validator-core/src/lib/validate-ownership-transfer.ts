import {
  ValidationResult,
  createError,
  success
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
          { code: "NAMESPACE_OWNERSHIP_TRANSFER_DENIED", headOwner: headOwner! }
        ),
      ],
    };
  }

  return success();
}
