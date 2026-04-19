import z from "zod";

const settingsSchemaRequiredFields = {
  repoRoot: z.string(),
};

const settingsSchemaOptionalFields = {
  registry: z.object({
    url: z.url(),
    accessToken: z.string().optional().nullable(),
  }),
};

export const validatorSettingsSchemaOutput = z.object({
  ...settingsSchemaOptionalFields,
  ...settingsSchemaRequiredFields,
});
export type ValidatorSettingsOutput = z.infer<typeof validatorSettingsSchemaOutput>;

export const validatorSettingsSchemaInput = z.object({
  ...z.object(settingsSchemaOptionalFields).partial().shape,
  ...settingsSchemaRequiredFields,
});
export type ValidatorSettingsInput = z.infer<typeof validatorSettingsSchemaInput>;

export const validatorSettingsDefaults: Omit<ValidatorSettingsOutput, "repoRoot"> = {
  registry: {
    url: "https://registry.figulus.net",
  },
};

export function loadValidatorSettings(input: ValidatorSettingsInput): ValidatorSettingsOutput {
  return {
    ...validatorSettingsDefaults,
    ...input,
  };
}
