import { RegistryValidator } from "../registry-validator.js";
import {
  ValidationError,
  createError
} from "../validation-result.js";

export interface PushLimitValue {
  unit: "daily" | "weekly";
  value: number;
}

export function validatePushLimitConstraints(
  pushLimit: PushLimitValue,
  constraints: { min: number; max: number },
  context: string,
): ValidationError | null {
  if (pushLimit.value < constraints.min || pushLimit.value > constraints.max) {
    return createError(
      { code: "PUSH_LIMIT_OUT_OF_RANGE", context, provided: pushLimit.value, pushUnit: pushLimit.unit, constraintMin: constraints.min, constraintMax: constraints.max }
    );
  }
  return null;
}

export async function getPushLimitConstraintsForEditor(
  registry: RegistryValidator,
  unit: "daily" | "weekly",
): Promise<{ min: number; max: number }> {
  const settings = await registry.getRegistrySettings();
  return settings.pushLimits.overridesSetBy.namespaceOwners[unit];
}

export async function getPushLimitConstraintsForMaintainer(
  registry: RegistryValidator,
  unit: "daily" | "weekly",
): Promise<{ min: number; max: number }> {
  const settings = await registry.getRegistrySettings();
  return settings.pushLimits.overridesSetBy.registryMaintainers[unit];
}
