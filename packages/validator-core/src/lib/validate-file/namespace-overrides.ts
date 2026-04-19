import {
  ChangedFile,
  FileTypeNamespaceOverrides,
  getSchemaFromFileTypeNamespaceOverrides,
} from "../../changed-file.js";
import {
  ValidationResult,
  createError
} from "../../validation-result.js";
import { parseSchema } from "../parse.js";
import {
  getPushLimitConstraintsForMaintainer,
  validatePushLimitConstraints,
} from "../validate-push-limit-constraints.js";

export async function validateNamespaceOverrides(
  file: ChangedFile,
  fileType: FileTypeNamespaceOverrides,
): Promise<ValidationResult> {
  const { registry, prInfo } = file.pr;
  if (!registry.isMaintainer(prInfo.author)) {
    return {
      success: false,
      errors: [
        createError(
          { code: "PERMISSION_DENIED_MAINTAINER_ONLY", path: file.path }
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
          const constraints = await getPushLimitConstraintsForMaintainer(
            registry,
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
          { code: "NAMESPACE_PARSE_ERROR", error: error instanceof Error ? error.message : String(error) }
        ),
      ],
    };
  }
}
