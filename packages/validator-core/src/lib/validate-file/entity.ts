import {
  ChangedFile,
  FileTypeEntity,
  getSchemaFromFileTypeEntity,
} from "../../changed-file.js";
import { getNamespaceEditorEntry } from "../namespace.js";
import { parseSchema } from "../parse.js";
import { checkPushLimit } from "../check-push-limit.js";
import { getNamespaceMetadataFromHead } from "../git-head.js";
import { validateBlobReferences } from "../validate-blob-references.js";
import {
  ValidationResult,
  ERROR_CODES,
  createError,
  success,
} from "../../validation-result.js";

export function validateEntity(
  file: ChangedFile,
  type: FileTypeEntity,
): ValidationResult {
  const { registry, prInfo } = file.pr;
  const { settings, helpers } = registry;
  const { fs } = helpers;

  const namespace = file.getNamespace(type);

  const isAllowedToChangeEntityFile = () => {
    if (registry.isNamespaceRestricted(namespace)) {
      if (!registry.isMaintainer(prInfo.author)) {
        return {
          success: false,
          errors: [
            createError(
              `The ${namespace}/ namespace is reserved. Changes require maintainer approval.`,
              ERROR_CODES.NAMESPACE_RESERVED,
            ),
          ],
        };
      }
    } else {
      const namespaceMetadata = getNamespaceMetadataFromHead(
        namespace,
        registry.helpers,
      );
      if (namespaceMetadata === null) {
        return {
          success: false,
          errors: [
            createError(
              `Namespace "${namespace}" does not exist. Run \`figulus registry claim ${namespace}\` to claim it before publishing.`,
              ERROR_CODES.NAMESPACE_NOT_FOUND,
            ),
          ],
        };
      }

      if (!getNamespaceEditorEntry(prInfo.author, namespaceMetadata)) {
        return {
          success: false,
          errors: [
            createError(
              `PR author "${prInfo.author}" is not listed as an editor for namespace "${namespace}"`,
              ERROR_CODES.NAMESPACE_NOT_EDITOR,
            ),
          ],
        };
      }

      const pushLimitError = checkPushLimit(
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

  const permissionResult = isAllowedToChangeEntityFile();
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
          `Failed to parse ${type}: ${error instanceof Error ? error.message : String(error)}`,
          ERROR_CODES.ENTITY_PARSE_ERROR,
        ),
      ],
    };
  }
}
