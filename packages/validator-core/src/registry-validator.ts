import { loadRegistrySettings, RegistrySettings, registrySettingsPartialSchema } from "@figulus/schema";
import { PR } from "./pr.js";
import { PullRequestInfo } from "./types.js";
import { loadValidatorSettings, ValidatorSettingsInput, ValidatorSettingsOutput } from "./validator-settings.js";

export interface Helpers {
  console: {
    log: (...data: any[]) => void;
    error: (...data: any[]) => void;
  };
  crypto: {
    createSha256HexHash: (data: string) => string;
  };
  fs: {
    resolvePath: (...paths: string[]) => string;
    splitPath: (path: string) => string[];
    fileOrDirExists: (path: string) => boolean;
    readFileAsUtf8: (path: string) => string;
  };
  registry: {
    getSettings: () => Promise<string>;
    showHead: (filePath: string, branch?: string) => Promise<string>;
    getAllPRs: () => Promise<
      {
        url: string;
        created_at: string;
        user: { id: string };
      }[]
    >;
    getPRFiles: (prUrl: string) => Promise<
      {
        filename: string;
      }[]
    >;
  };
}

export class RegistryValidator {
  public validatorSettings: ValidatorSettingsOutput;
  private registrySettings: RegistrySettings|undefined;

  constructor(
    public helpers: Helpers,
    settingsInput: ValidatorSettingsInput,
  ) {
    this.validatorSettings = loadValidatorSettings(settingsInput);
  }

  public async getRegistrySettings(): Promise<RegistrySettings> {
    if(!this.registrySettings) {
      const res = await this.helpers.registry.getSettings();
      console.log("DEBUG 2:", res)
      const parsed = registrySettingsPartialSchema.parse(JSON.parse(res));
      console.log("DEBUG 3:", parsed)
      this.registrySettings = loadRegistrySettings(parsed);
      console.log("DEBUG 4:", this.registrySettings)
    }
    return this.registrySettings;
  }

  public async validatePr(prInfo: PullRequestInfo) {
    return await new PR(prInfo, this).validate();
  }

  public async isMaintainer(user: string): Promise<boolean> {
    const registrySettings = await this.getRegistrySettings();
    return registrySettings.registryMaintainers.includes(user);
  }

  public async isNamespaceRestricted(namespace: string): Promise<boolean> {
    const registrySettings = await this.getRegistrySettings();
    return registrySettings.restrictedNamespaces.includes(namespace);
  }
}
