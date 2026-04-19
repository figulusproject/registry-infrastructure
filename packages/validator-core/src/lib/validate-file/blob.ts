import {
  ChangedFile,
  getFileTypeEntityFromExtension,
} from "../../changed-file.js";
import {
  ValidationResult,
  createError,
  success
} from "../../validation-result.js";

export function validateBlob(file: ChangedFile): ValidationResult {
  const { helpers, validatorSettings } = file.pr.registry;

  const fileName = helpers.fs.splitPath(file.path).pop();
  if (!fileName) {
    return {
      success: false,
      errors: [
        createError({ code: "BLOB_INVALID_FILENAME" }),
      ],
    };
  }

  const parts = fileName.split(".");
  if (parts.length < 2) {
    return {
      success: false,
      errors: [
        createError(
          { code: "BLOB_MISSING_EXTENSION" },
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
          { code: "BLOB_INVALID_EXTENSION", extension }
        ),
      ],
    };
  }

  try {
    const path = helpers.fs.resolvePath(validatorSettings.repoRoot, file.path);
    const content = helpers.fs.readFileAsUtf8(path);
    const actualHash = helpers.crypto.createSha256HexHash(content);

    if (actualHash !== expectedHash) {
      return {
        success: false,
        errors: [
          createError(
            { code: "BLOB_HASH_MISMATCH", expectedHash, actualHash }
          ),
        ],
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        createError(
          { code: "BLOB_VERIFICATION_FAILED", error: error instanceof Error ? error.message : String(error) }
        ),
      ],
    };
  }

  return success();
}
