import { ChangedFile } from "../../changed-file.js";
import { namespaceMetadataSchema } from "@figulus/schema";
import { parseJSON, parseSchema } from "../parse.js";
import { validateOwnershipTransfer } from "../validate-ownership-transfer.js";
import {
  ValidationResult,
  ValidationError,
  ERROR_CODES,
  createError,
  success,
} from "../../validation-result.js";
import {
  validatePushLimitConstraints,
  getPushLimitConstraintsForEditor,
} from "../validate-push-limit-constraints.js";

export function validateNamespaceMetadata(file: ChangedFile): ValidationResult {
  const { registry, prInfo } = file.pr;
  const { git } = registry.helpers;

  const namespace = file.getNamespace("namespace");

  if (registry.isNamespaceRestricted(namespace)) {
    if (!registry.isMaintainer(prInfo.author))
      return {
        success: false,
        errors: [
          createError(
            `Cannot create namespace "${namespace}": this name is reserved. You must be a registry maintainer to claim this namespace.`,
            ERROR_CODES.NAMESPACE_RESERVED,
          ),
        ],
      };
  }

  const prAuthor = file.pr.prInfo.author;

  const validatePushLimitsInMetadata = (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    const editors = data.editors || [];

    for (const editor of editors) {
      if (editor.pushLimit) {
        const constraints = getPushLimitConstraintsForEditor(
          registry.settings,
          editor.pushLimit.unit,
        );
        const error = validatePushLimitConstraints(
          editor.pushLimit,
          constraints,
          `Editor ${editor.username}`,
        );
        if (error) errors.push(error);
      }
    }

    return errors;
  };

  if (namespace) {
    try {
      try {
        const headContent = git.showHead(file.path);
        const headData = parseJSON(headContent);

        const headEditors = headData.editors || [];
        const isEditorInHead = headEditors.some(
          (e: any) => e.username === prAuthor,
        );
        if (!isEditorInHead)
          return {
            success: false,
            errors: [
              createError(
                `PR author "${prAuthor}" is not listed as an editor in the existing namespace metadata`,
                ERROR_CODES.NAMESPACE_NOT_EDITOR,
              ),
            ],
          };

        try {
          const submittedData = file.parseJson();
          const headOwner = headData.owner?.username;
          const submittedOwner = submittedData.owner?.username;

          const ownershipResult = validateOwnershipTransfer(
            headOwner,
            submittedOwner,
            prAuthor,
          );
          if (!ownershipResult.success) {
            return ownershipResult;
          }
        } catch {
          // Continue - this error will be caught again during full validation
        }

        // Namespace exists in HEAD and author is a valid editor with no ownership violations
        // Validate the submitted file against the schema
        try {
          const data = file.parseJson();
          const schemaResult = parseSchema(data, namespaceMetadataSchema);
          if (!schemaResult.success) return schemaResult;

          const pushLimitErrors = validatePushLimitsInMetadata(data);
          if (pushLimitErrors.length > 0) {
            return { success: false, errors: pushLimitErrors };
          }

          return success();
        } catch (error) {
          return {
            success: false,
            errors: [
              createError(
                `Failed to parse namespace metadata: ${error instanceof Error ? error.message : String(error)}`,
                ERROR_CODES.NAMESPACE_PARSE_ERROR,
              ),
            ],
          };
        }
      } catch (parseError) {
        return {
          success: false,
          errors: [
            createError(
              `Failed to parse HEAD version of namespace metadata: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              ERROR_CODES.NAMESPACE_PARSE_ERROR,
            ),
          ],
        };
      }
    } catch {
      // File doesn't exist in HEAD - this is a new namespace claim
      // Fall through to validate the new submission
    }
  }

  // If we reach here, the namespace doesn't exist in HEAD (new namespace claim)
  try {
    const data = file.parseJson();
    const schemaResult = parseSchema(data, namespaceMetadataSchema);

    if (!schemaResult.success) return schemaResult;

    // Check push limit constraints
    const pushLimitErrors = validatePushLimitsInMetadata(data);
    if (pushLimitErrors.length > 0) {
      return { success: false, errors: pushLimitErrors };
    }

    // For new namespaces, check that PR author is in editors
    const editors = data.editors || [];
    const isEditor = editors.some((e: any) => e.username === prAuthor);
    if (!isEditor) {
      return {
        success: false,
        errors: [
          createError(
            `PR author "${prAuthor}" is not listed as an editor in the namespace`,
            ERROR_CODES.NAMESPACE_NOT_EDITOR,
          ),
        ],
      };
    }

    return success();
  } catch (error) {
    return {
      success: false,
      errors: [
        createError(
          `Failed to parse namespace metadata: ${error instanceof Error ? error.message : String(error)}`,
          ERROR_CODES.NAMESPACE_PARSE_ERROR,
        ),
      ],
    };
  }
}
