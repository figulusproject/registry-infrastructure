import { SchemaObject } from "../types.js";
import { Helpers } from "../registry-validator.js";
import {
  NamespaceMetadata,
  namespaceMetadataSchema,
  PushLimitOverrides,
  pushLimitOverridesSchema,
} from "@figulus/schema/registry";
import { parseJSON } from "./parse.js";

async function getFileFromHeadAndParse(
  filePath: string,
  schema: SchemaObject,
  helpers: Helpers,
) {
  try {
    const headContent = await helpers.git.showHead(filePath);
    const data = parseJSON(headContent);
    const result = schema.safeParse(data);
    return result.success ? data : null;
  } catch (error) {
    return null;
  }
}

export async function getPushLimitOverridesFromHead(
  helpers: Helpers,
): Promise<PushLimitOverrides | null> {
  return getFileFromHeadAndParse(
    "namespaces/push-limit-overrides.json",
    pushLimitOverridesSchema,
    helpers,
  );
}

export function getNamespaceMetadataFromHead(
  namespace: string,
  helpers: Helpers,
): Promise<NamespaceMetadata | null> {
  return getFileFromHeadAndParse(
    `namespaces/${namespace}.json`,
    namespaceMetadataSchema,
    helpers,
  );
}
