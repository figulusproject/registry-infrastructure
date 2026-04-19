import { RegistryValidator, loadValidatorSettings, type Helpers, type ValidationSummary } from '@figulus/validator-core';

declare global {
  var __goHelpers: Helpers;
  var __goSettings: string;
}

globalThis.validateRegistryChanges = async (
  changedFiles: string[],
  author: string
): Promise<string> => {
  const helpers = globalThis.__goHelpers;
  const settings = loadValidatorSettings(JSON.parse(globalThis.__goSettings));

  const validator = new RegistryValidator(helpers, settings);
  const result = await validator.validatePr({ changedFiles, author });
  return JSON.stringify(result);
};
