import { RegistryValidator } from "../registry-validator.js";
import {
  ValidationError,
  createError
} from "../validation-result.js";
import {
  getNamespaceMetadataFromHead,
  getPushLimitOverridesFromHead,
} from "./git-head.js";
import { getNamespaceEditorEntry } from "./namespace.js";

export async function checkPushLimit(
  prAuthor: string,
  namespace: string,
  registryValidator: RegistryValidator,
): Promise<ValidationError | null> {
  const { getRegistrySettings, helpers } = registryValidator;
  const registrySettings = await getRegistrySettings();

  const namespaceMetadata = await getNamespaceMetadataFromHead(
    namespace,
    helpers,
  );
  if (!namespaceMetadata) return null;

  const editorEntry = getNamespaceEditorEntry(prAuthor, namespaceMetadata);
  if (!editorEntry) return null;

  let editorLimit = editorEntry.pushLimit || {
    unit: registrySettings.pushLimits.default.unit,
    value: registrySettings.pushLimits.default.pushes,
  };

  const overrides = await getPushLimitOverridesFromHead(helpers);
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

    const prs = (await helpers.git.getAllPRs()).filter(
      (pr) => pr.user.id === prAuthor && new Date(pr.created_at) >= startDate,
    );

    let count = 0;
    for (const pr of prs) {
      const files = await helpers.git.getPRFiles(pr.url);

      const touchesNamespace = files.some((f: any) =>
        filePrefixes.some((prefix) => f.filename.startsWith(prefix)),
      );

      if (touchesNamespace) count++;
    }

    if (count >= effectiveLimit.value)
      return createError(
        { code: "PUSH_LIMIT_EXCEEDED", namespace, pushesUsed: count, pushLimit: effectiveLimit.value, pushUnit: effectiveLimit.unit, limitSource }
      );

    return null;
  } catch (error) {
    return null;
  }
}
