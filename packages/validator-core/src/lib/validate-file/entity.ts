import {
  ChangedFile,
  FileTypeEntity,
  getSchemaFromFileTypeEntity,
} from "../../changed-file.js";
import {
  ValidationResult,
  createError,
  success
} from "../../validation-result.js";
import { checkPushLimit } from "../check-push-limit.js";
import { getNamespaceMetadataFromHead } from "../git-head.js";
import { getNamespaceEditorEntry } from "../namespace.js";
import { parseSchema } from "../parse.js";
import { validateBlobReferences } from "../validate-blob-references.js";

export async function validateEntity(
  file: ChangedFile,
  type: FileTypeEntity,
): Promise<ValidationResult> {
  const { registry, prInfo } = file.pr;
  const { settings, helpers } = registry;
  const { fs } = helpers;

  const namespace = file.getNamespace(type);

  const isAllowedToChangeEntityFile = async () => {
    if (registry.isNamespaceRestricted(namespace)) {
      if (!registry.isMaintainer(prInfo.author)) {
        return {
          success: false,
          errors: [
            createError(
              { code: "NAMESPACE_RESERVED", namespace }
            ),
          ],
        };
      }
    } else {
      const namespaceMetadata = await getNamespaceMetadataFromHead(
        namespace,
        registry.helpers,
      );
      if (namespaceMetadata === null) {
        return {
          success: false,
          errors: [
            createError(
              { code: "NAMESPACE_NOT_FOUND", namespace }
            ),
          ],
        };
      }

      if (!getNamespaceEditorEntry(prInfo.author, namespaceMetadata)) {
        return {
          success: false,
          errors: [
            createError(
              { code: "NAMESPACE_NOT_EDITOR", author: prInfo.author, namespace }
            ),
          ],
        };
      }

      const pushLimitError = await checkPushLimit(
        prInfo.author,
        namespace,
        helpers,
        settings,
      );
      if (pushLimitError) {
        return {
          success: false,
          errors: [pushLimitError],
        };
      }
    }

    return success();
  };

  const permissionResult = await isAllowedToChangeEntityFile();
  if (!permissionResult.success) return permissionResult;

  try {
    const data = file.parseJson();

    const schemaResult = parseSchema(data, getSchemaFromFileTypeEntity(type));
    if (!schemaResult.success) return schemaResult;

    const blobResult = validateBlobReferences(data, namespace, type, registry);
    if (!blobResult.success) return blobResult;

    return success();
  } catch (error) {
    return {
      success: false,
      errors: [
        createError(
          { code: "ENTITY_PARSE_ERROR", type, error: error instanceof Error ? error.message : String(error) }
        ),
      ],
    };
  }
}
