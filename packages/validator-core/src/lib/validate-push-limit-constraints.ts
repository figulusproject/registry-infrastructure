import { SettingsOutput } from "../settings.js";
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

export function getPushLimitConstraintsForEditor(
  settings: SettingsOutput,
  unit: "daily" | "weekly",
): { min: number; max: number } {
  return settings.pushLimits.overridesSetBy.namespaceOwners[unit];
}

export function getPushLimitConstraintsForMaintainer(
  settings: SettingsOutput,
  unit: "daily" | "weekly",
): { min: number; max: number } {
  return settings.pushLimits.overridesSetBy.registryMaintainers[unit];
}
