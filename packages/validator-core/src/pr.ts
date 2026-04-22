import { ChangedFile } from "./changed-file.js";
import { renderValidationMessage } from "./lib/output-renderer.js";
import { Helpers, RegistryValidator } from "./registry-validator";
import {
  FileValidationResult,
  PullRequestInfo,
  ValidationSummary,
} from "./types.js";
import { ValidatorSettingsOutput } from "./validator-settings.js";

export class PR {
  constructor(
    public prInfo: PullRequestInfo,
    public registry: RegistryValidator,
  ) {}

  public getAuthor(): string {
    return this.prInfo.author;
  }

  public getSettings(): ValidatorSettingsOutput {
    return this.registry.validatorSettings;
  }

  public getHelpers(): Helpers {
    return this.registry.helpers;
  }

  public async validate(): Promise<ValidationSummary> {
    const { prInfo, registry } = this;
    const { helpers } = registry;

    const results: FileValidationResult[] = [];
    let filesWithErrors = 0;
    let filesWithWarnings = 0;

    if (prInfo.changedFiles.length === 0) {
      const msg = "No changed files to validate";
      helpers.console.log(msg);
      return {
        success: true,
        totalFiles: 0,
        filesWithErrors: 0,
        filesWithWarnings: 0,
        results: [],
        markdown: msg,
      };
    }

    for (const file of prInfo.changedFiles) {
      const result = await new ChangedFile(file, this).validate();
      results.push(result);

      if (!result.result.success) filesWithErrors++;
      else if (result.result.warnings?.length) filesWithWarnings++;
    }

    const hasErrors = filesWithErrors > 0;
    const baseOutput = {
      success: !hasErrors,
      totalFiles: prInfo.changedFiles.length,
      filesWithErrors,
      filesWithWarnings,
      results,
    };
    const markdown = renderValidationMessage(baseOutput);

    if(hasErrors) helpers.console.error(markdown);
    else helpers.console.log(markdown);

    return {
      ...baseOutput,
      markdown,
    };
  }
}
