import { RegistryValidator } from "../registry-validator.js";

export function isRegistryMaintainer(
  user: string,
  registry: RegistryValidator,
): boolean {
  const { registryMaintainers } = registry.settings;
  return registryMaintainers.includes(user);
}

export function isReservedNamespace(
  namespace: string,
  registry: RegistryValidator,
): boolean {
  const { restrictedNamespaces } = registry.settings;
  return restrictedNamespaces.includes(namespace);
}
