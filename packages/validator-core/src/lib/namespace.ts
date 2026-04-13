import { ChangedFile, FileTypeEntity } from "../changed-file.js";
import {
  NamespaceMetadata,
  NamespaceMetadataEditorEntry,
} from "@figulus/schema/registry";

export function getNamespaceFromFilePath(
  file: ChangedFile,
  type: FileTypeEntity | "namespace",
): string {
  const base = file.pr.registry.helpers.fs.splitPath(file.path)[1];
  if (type === "namespace") return base.replace(".json", "");
  return base;
}

export function getNamespaceEditorEntry(
  user: string,
  namespaceMetadata: NamespaceMetadata,
): NamespaceMetadataEditorEntry | undefined {
  return namespaceMetadata.editors.find((e) => e.username === user);
}
