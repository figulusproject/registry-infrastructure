import { RegistryValidator, loadSettings, type Helpers, type ValidationSummary } from '@figulus/validator-core';

declare global {
  var __goHelpers: Helpers;
  var __goSettings: string;
}

globalThis.validateRegistryChanges = async (
  changedFiles: string[],
  author: string
): Promise<ValidationSummary> => {
  const helpers = globalThis.__goHelpers;
  const settings = loadSettings(JSON.parse(globalThis.__goSettings));

  const validator = new RegistryValidator(helpers, settings);
  return validator.validatePr({ changedFiles, author });
};
