import z from "zod";
import { parseJSON } from "./lib/parse.js";
import { validateBlob } from "./lib/validate-file/blob.js";
import { validateEntity } from "./lib/validate-file/entity.js";
import { validateNamespaceMetadata } from "./lib/validate-file/namespace-metadata.js";
import { validateNamespaceOverrides } from "./lib/validate-file/namespace-overrides.js";
import { PR } from "./pr.js";
import {
  figParserMetadataSchema,
  figSpecMetadataSchema,
  figStackMetadataSchema,
  namespaceVerificationsSchema,
  pushLimitOverridesSchema,
} from "@figulus/schema/registry";
import { FileValidationResult, SchemaObject } from "./types.js";
import {
  ERROR_CODES,
  ValidationResult,
  createError,
} from "./validation-result.js";

//
// Entity metadata files
//

const fileTypeEntitySchema = z.enum(["spec", "stack", "parser"]);
export type FileTypeEntity = z.infer<typeof fileTypeEntitySchema>;

const entityFileMap: {
  [Id in FileTypeEntity]: {
    id: Id;
    metadataSchema: SchemaObject;
    extension: string;
  };
} = {
  spec: {
    id: "spec",
    metadataSchema: figSpecMetadataSchema,
    extension: "figspec",
  },
  stack: {
    id: "stack",
    metadataSchema: figStackMetadataSchema,
    extension: "figstack",
  },
  parser: {
    id: "parser",
    metadataSchema: figParserMetadataSchema,
    extension: "js",
  },
};

export function getExtensionFromFileTypeEntity(
  entityType: FileTypeEntity,
): string {
  return entityFileMap[entityType].extension;
}

export function getSchemaFromFileTypeEntity(
  entityType: FileTypeEntity,
): SchemaObject {
  return entityFileMap[entityType].metadataSchema;
}

export function getFileTypeEntityFromExtension(
  extension: string,
): FileTypeEntity | null {
  return (
    Object.values(entityFileMap).find((e) => e.extension === extension)?.id ||
    null
  );
}

//
// Namespace overrides files
//

const fileTypeNamespaceOverridesSchema = z.enum(["verified", "limits"]);
export type FileTypeNamespaceOverrides = z.infer<
  typeof fileTypeNamespaceOverridesSchema
>;

const namespaceOverridesFileMap: {
  [Id in FileTypeNamespaceOverrides]: {
    schema: SchemaObject;
  };
} = {
  verified: {
    schema: namespaceVerificationsSchema,
  },
  limits: {
    schema: pushLimitOverridesSchema,
  },
};

export function getSchemaFromFileTypeNamespaceOverrides(
  overridesFileType: FileTypeNamespaceOverrides,
): SchemaObject {
  return namespaceOverridesFileMap[overridesFileType].schema;
}

//
// All file types
//

type FileType =
  | FileTypeEntity
  | "blob"
  | "namespace"
  | FileTypeNamespaceOverrides;

//
// Main ChangedFile class
//

export class ChangedFile {
  constructor(
    public path: string,
    public pr: PR,
  ) {}

  public getFileType(): FileType | null {
    if (this.path.startsWith("specs/")) return "spec";
    if (this.path.startsWith("stacks/")) return "stack";
    if (this.path.startsWith("parsers/")) return "parser";
    if (this.path.startsWith("blobs/")) return "blob";
    if (this.path.startsWith("namespaces/") && this.path.endsWith(".json")) {
      if (this.path === "namespaces/verified.json") return "verified";
      if (this.path === "namespaces/push-limit-overrides.json") return "limits";
      return "namespace";
    }
    return null;
  }

  public getNamespace(type: FileTypeEntity | "namespace"): string {
    const base = this.pr.registry.helpers.fs.splitPath(this.path)[1];
    if (type === "namespace") return base.replace(".json", "");
    return base;
  }

  public parseJson(): any {
    const { settings, helpers } = this.pr.registry;
    const { fs } = helpers;

    const fullPath = fs.resolvePath(settings.repoRoot, this.path);
    const content = fs.readFileAsUtf8(fullPath);

    return parseJSON(content);
  }

  public validate(): FileValidationResult {
    const fileType = this.getFileType();

    if (!fileType) {
      return {
        file: this.path,
        type: "unknown",
        result: {
          success: false,
          errors: [
            createError(
              "File path does not match any known registry structure",
              ERROR_CODES.FILE_TYPE_UNKNOWN,
            ),
          ],
        },
      };
    }

    let result: ValidationResult;
    switch (fileType) {
      case "spec":
      case "stack":
      case "parser":
        result = validateEntity(this, fileType);
        break;
      case "blob":
        result = validateBlob(this);
        break;
      case "namespace":
        result = validateNamespaceMetadata(this);
        break;
      case "verified":
      case "limits":
        result = validateNamespaceOverrides(this, fileType);
        break;
    }

    return { file: this.path, type: fileType, result };
  }
}
