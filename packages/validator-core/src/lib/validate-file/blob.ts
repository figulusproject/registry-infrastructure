import {
  ChangedFile,
  getFileTypeEntityFromExtension,
} from "../../changed-file.js";
import {
  ValidationResult,
  ERROR_CODES,
  createError,
  success,
} from "../../validation-result.js";

export function validateBlob(file: ChangedFile): ValidationResult {
  const { helpers, settings } = file.pr.registry;

  const fileName = helpers.fs.splitPath(file.path).pop();
  if (!fileName) {
    return {
      success: false,
      errors: [
        createError("Invalid blob filename", ERROR_CODES.BLOB_INVALID_FILENAME),
      ],
    };
  }

  const parts = fileName.split(".");
  if (parts.length < 2) {
    return {
      success: false,
      errors: [
        createError(
          "Blob filename must have extension",
          ERROR_CODES.BLOB_MISSING_EXTENSION,
        ),
      ],
    };
  }

  const expectedHash = parts[0];
  const extension = parts.slice(1).join(".");

  const entityType = getFileTypeEntityFromExtension(extension);

  if (!entityType) {
    return {
      success: false,
      errors: [
        createError(
          `Invalid blob extension: ${extension} (must be js, figspec, or figstack)`,
          ERROR_CODES.BLOB_INVALID_EXTENSION,
        ),
      ],
    };
  }

  try {
    const path = helpers.fs.resolvePath(settings.repoRoot, file.path);
    const content = helpers.fs.readFileAsUtf8(path);
    const actualHash = helpers.crypto.createSha256HexHash(content);

    if (actualHash !== expectedHash) {
      return {
        success: false,
        errors: [
          createError(
            `Hash mismatch: filename hash ${expectedHash} does not match content hash ${actualHash}`,
            ERROR_CODES.BLOB_HASH_MISMATCH,
          ),
        ],
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        createError(
          `Failed to verify blob: ${error instanceof Error ? error.message : String(error)}`,
          ERROR_CODES.BLOB_VERIFICATION_FAILED,
        ),
      ],
    };
  }

  return success();
}
