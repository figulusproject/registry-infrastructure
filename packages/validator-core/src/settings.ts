import z from "zod";

const pushLimitOverridesSetBySchema = z.object({
  daily: z.object({
    max: z.int(),
    min: z.int(),
  }),
  weekly: z.object({
    max: z.int(),
    min: z.int(),
  }),
});

const settingsSchemaRequiredFields = {
  repoRoot: z.string(),
};

const settingsSchemaOptionalFields = {
  registryMaintainers: z.string().array(),
  restrictedNamespaces: z.string().array(),
  registryRepo: z.object({
    url: z.url(),
    accessToken: z.string().optional().nullable(),
  }),
  pushLimits: z.object({
    default: z.object({
      unit: z.enum(["daily", "weekly"]),
      pushes: z.int(),
    }),
    overridesSetBy: z.object({
      namespaceOwners: pushLimitOverridesSetBySchema,
      registryMaintainers: pushLimitOverridesSetBySchema,
    }),
  }),
};

export const settingsSchemaOutput = z.object({
  ...settingsSchemaOptionalFields,
  ...settingsSchemaRequiredFields,
});
export type SettingsOutput = z.infer<typeof settingsSchemaOutput>;

export const settingsSchemaInput = z.object({
  ...z.object(settingsSchemaOptionalFields).partial().shape,
  ...settingsSchemaRequiredFields,
});
export type SettingsInput = z.infer<typeof settingsSchemaInput>;

const settingsDefaults: Omit<SettingsOutput, "repoRoot"> = {
  registryMaintainers: ["figulusproject"],
  restrictedNamespaces: [
    "examples",
    "figulus",
    "official",
    "push-limit-overrides",
    "verified",
  ],
  registryRepo: {
    url: "https://registry.figulus.net",
  },
  pushLimits: {
    default: { unit: "daily", pushes: 10 },
    overridesSetBy: {
      namespaceOwners: {
        daily: { min: 1, max: 10 },
        weekly: { min: 1, max: 10 * 7 },
      },
      registryMaintainers: {
        daily: { min: 0, max: 30 },
        weekly: { min: 0, max: 30 * 7 },
      },
    },
  },
};

export function loadSettings(input: SettingsInput): SettingsOutput {
  return {
    ...settingsDefaults,
    ...input,
  };
}
