import { Settings } from "../settings.js";
import {
  ValidationError,
  ERROR_CODES,
  createError,
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
      `${context} push limit ${pushLimit.value}/${pushLimit.unit} is outside allowed range: ${constraints.min}-${constraints.max}`,
      ERROR_CODES.PUSH_LIMIT_EXCEEDED,
    );
  }
  return null;
}

export function getPushLimitConstraintsForEditor(
  settings: Settings,
  unit: "daily" | "weekly",
): { min: number; max: number } {
  return settings.pushLimits.overridesSetBy.namespaceOwners[unit];
}

export function getPushLimitConstraintsForMaintainer(
  settings: Settings,
  unit: "daily" | "weekly",
): { min: number; max: number } {
  return settings.pushLimits.overridesSetBy.registryMaintainers[unit];
}
