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

export const settingsSchema = z.object({
  repoRoot: z.string(),
  registryMaintainers: z
    .string()
    .array()
    .optional()
    .default(["figulusproject"]),
  restrictedNamespaces: z
    .string()
    .array()
    .optional()
    .default([
      "examples",
      "figulus",
      "official",
      "push-limit-overrides",
      "verified",
    ]),
  pushLimits: z
    .object({
      default: z.object({
        unit: z.enum(["daily", "weekly"]),
        pushes: z.int(),
      }),
      overridesSetBy: z.object({
        namespaceOwners: pushLimitOverridesSetBySchema,
        registryMaintainers: pushLimitOverridesSetBySchema,
      }),
    })
    .optional()
    .default({
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
    }),
});

export type Settings = z.infer<typeof settingsSchema>;
