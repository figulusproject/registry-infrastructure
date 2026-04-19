import { RegistryValidator } from "../registry-validator.js";

export async function isRegistryMaintainer(
  user: string,
  registry: RegistryValidator,
): Promise<boolean> {
  const settings = await registry.getRegistrySettings();
  return settings.registryMaintainers.includes(user);
}

export async function isReservedNamespace(
  namespace: string,
  registry: RegistryValidator,
): Promise<boolean> {
  const settings = await registry.getRegistrySettings();
  return settings.restrictedNamespaces.includes(namespace);
}
