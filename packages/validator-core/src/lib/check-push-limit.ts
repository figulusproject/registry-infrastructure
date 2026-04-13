import { Helpers } from "../registry-validator.js";
import { getNamespaceEditorEntry } from "./namespace.js";
import {
  getNamespaceMetadataFromHead,
  getPushLimitOverridesFromHead,
} from "./git-head.js";
import {
  ValidationError,
  ERROR_CODES,
  createError,
} from "../validation-result.js";
import { Settings } from "../settings.js";

export function checkPushLimit(
  prAuthor: string,
  namespace: string,
  helpers: Helpers,
  settings: Settings,
): ValidationError | null {
  const namespaceMetadata = getNamespaceMetadataFromHead(namespace, helpers);
  if (!namespaceMetadata) return null;

  const editorEntry = getNamespaceEditorEntry(prAuthor, namespaceMetadata);
  if (!editorEntry) return null;

  let editorLimit = editorEntry.pushLimit || {
    unit: settings.pushLimits.default.unit,
    value: settings.pushLimits.default.pushes,
  };

  const overrides = getPushLimitOverridesFromHead(helpers);
  const override = overrides
    ? overrides.find((o) => o.namespace === namespace)
    : undefined;

  let effectiveLimit = editorLimit;
  let limitSource = "editor settings";

  if (override) {
    const overrideValue = override.pushLimit.value;
    const editorValue = editorLimit.value;

    if (overrideValue < editorValue) {
      effectiveLimit = override.pushLimit;
      limitSource = "namespace override";
    }
  } else if (!editorEntry.pushLimit) {
    limitSource = "default (10/day)";
  }

  try {
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    const msInUnit = effectiveLimit.unit === "daily" ? msInDay : msInDay * 7;
    const startDate = new Date(now.getTime() - msInUnit);

    const filePrefixes = [
      `specs/${namespace}/`,
      `stacks/${namespace}/`,
      `parsers/${namespace}/`,
      `blobs/${namespace}/`,
    ];

    const prs = helpers.git
      .getAllPRs()
      .filter(
        (pr) => pr.user.id === prAuthor && new Date(pr.createdAt) >= startDate,
      );

    let count = 0;
    for (const pr of prs) {
      const files = helpers.git.getPRFiles(pr.url);

      const touchesNamespace = files.some((f: any) =>
        filePrefixes.some((prefix) => f.filename.startsWith(prefix)),
      );

      if (touchesNamespace) count++;
    }

    if (count >= effectiveLimit.value)
      return createError(
        `Push limit exceeded for namespace "${namespace}": ${count}/${effectiveLimit.value} ${effectiveLimit.unit} pushes used. Limit set by ${limitSource}.`,
        ERROR_CODES.PUSH_LIMIT_EXCEEDED,
      );

    return null;
  } catch (error) {
    return null;
  }
}
