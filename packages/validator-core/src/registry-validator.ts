import { PR } from "./pr.js";
import { Settings } from "./settings.js";
import { PullRequestInfo } from "./types.js";

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
  git: {
    showHead: (filePath: string, branch?: string) => Promise<string>;
    getAllPRs: () => Promise<{
      url: string;
      createdAt: string;
      user: { id: string };
    }[]>;
    getPRFiles: (prUrl: string) => Promise<{
      filename: string;
    }[]>;
  };
}

export class RegistryValidator {
  constructor(
    public helpers: Helpers,
    public settings: Settings,
  ) {}

  public async validatePr(prInfo: PullRequestInfo) {
    return await new PR(prInfo, this).validate();
  }

  public isMaintainer(user: string): boolean {
    return this.settings.registryMaintainers.includes(user);
  }

  public isNamespaceRestricted(namespace: string): boolean {
    return this.settings.restrictedNamespaces.includes(namespace);
  }
}
