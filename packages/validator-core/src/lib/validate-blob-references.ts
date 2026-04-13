import {
  FileTypeEntity,
  getExtensionFromFileTypeEntity,
} from "../changed-file.js";
import { RegistryValidator } from "../registry-validator.js";
import {
  ValidationResult,
  ERROR_CODES,
  createError,
  success,
} from "../validation-result.js";

export function validateBlobReferences(
  data: any,
  namespace: string,
  type: FileTypeEntity,
  registry: RegistryValidator,
): ValidationResult {
  const errors = [];

  const variants = data.variants || [];
  if (!Array.isArray(variants)) return success();

  for (const variant of variants) {
    const blob = variant.blob || {};
    const contentHash = blob.contentHash;
    const extension = getExtensionFromFileTypeEntity(type);

    if (!contentHash || !extension) continue;

    const blobPath = registry.helpers.fs.resolvePath(
      registry.settings.repoRoot,
      `blobs/${namespace}/${contentHash}.${extension}`,
    );

    if (!registry.helpers.fs.fileOrDirExists(blobPath)) {
      errors.push(
        createError(
          `Variant references blob ${contentHash} but blobs/${namespace}/${contentHash}.${extension} does not exist in the repository`,
          ERROR_CODES.BLOB_REFERENCE_NOT_FOUND,
        ),
      );
    }
  }

  return errors.length > 0 ? { success: false, errors } : success();
}
