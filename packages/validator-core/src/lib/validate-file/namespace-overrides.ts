import {
  ChangedFile,
  FileTypeNamespaceOverrides,
  getSchemaFromFileTypeNamespaceOverrides,
} from "../../changed-file.js";
import { parseSchema } from "../parse.js";
import {
  ValidationResult,
  ERROR_CODES,
  createError,
} from "../../validation-result.js";
import {
  validatePushLimitConstraints,
  getPushLimitConstraintsForMaintainer,
} from "../validate-push-limit-constraints.js";

export function validateNamespaceOverrides(
  file: ChangedFile,
  fileType: FileTypeNamespaceOverrides,
): ValidationResult {
  const { registry, prInfo } = file.pr;
  if (!registry.isMaintainer(prInfo.author)) {
    return {
      success: false,
      errors: [
        createError(
          `Only registry maintainers can modify ${file.path}`,
          ERROR_CODES.PERMISSION_DENIED_MAINTAINER_ONLY,
        ),
      ],
    };
  }

  try {
    const data = file.parseJson();
    const schemaResult = parseSchema(
      data,
      getSchemaFromFileTypeNamespaceOverrides(fileType),
    );

    if (!schemaResult.success) return schemaResult;

    // For limits overrides, validate push limit constraints
    if (fileType === "limits") {
      const errors = [];
      const overrides = data || [];

      for (const override of overrides) {
        if (override.pushLimit) {
          const constraints = getPushLimitConstraintsForMaintainer(
            registry.settings,
            override.pushLimit.unit,
          );
          const error = validatePushLimitConstraints(
            override.pushLimit,
            constraints,
            `Namespace ${override.namespace}`,
          );
          if (error) errors.push(error);
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }
    }

    return schemaResult;
  } catch (error) {
    return {
      success: false,
      errors: [
        createError(
          `Failed to parse ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
          ERROR_CODES.NAMESPACE_PARSE_ERROR,
        ),
      ],
    };
  }
}
