import { RegistryValidator, Helpers } from "./registry-validator";
import {
  PullRequestInfo,
  ValidationSummary,
  FileValidationResult,
} from "./types.js";
import { ChangedFile } from "./changed-file.js";
import { SettingsOutput } from "./settings.js";

export class PR {
  constructor(
    public prInfo: PullRequestInfo,
    public registry: RegistryValidator,
  ) {}

  public getAuthor(): string {
    return this.prInfo.author;
  }

  public getSettings(): SettingsOutput {
    return this.registry.settings;
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
      helpers.console.log("No changed files to validate");
      return {
        success: true,
        totalFiles: 0,
        filesWithErrors: 0,
        filesWithWarnings: 0,
        results: [],
      };
    }

    for (const file of prInfo.changedFiles) {
      const result = await new ChangedFile(file, this).validate();
      results.push(result);

      if (!result.result.success) {
        filesWithErrors++;
      } else if (result.result.warnings?.length) {
        filesWithWarnings++;
      }
    }

    // Output results
    const hasErrors = filesWithErrors > 0;
    if (hasErrors) {
      helpers.console.error("\n❌ Validation failed:\n");
      for (const result of results) {
        if (!result.result.success) {
          helpers.console.error(`📄 ${result.file}:`);
          result.result.errors.forEach((err) => {
            helpers.console.error(`   • [${err.code}] ${err.message}`);
          });
        }
      }
    } else {
      helpers.console.log("✅ All validations passed!");
    }

    if (filesWithWarnings > 0) {
      helpers.console.log(
        `\n⚠️  ${filesWithWarnings} file(s) with warnings:\n`,
      );
      for (const result of results) {
        if (result.result.success && result.result.warnings?.length) {
          helpers.console.log(`📄 ${result.file}:`);
          result.result.warnings.forEach((warn) => {
            helpers.console.log(`   • [${warn.code}] ${warn.message}`);
          });
        }
      }
    }

    return {
      success: !hasErrors,
      totalFiles: prInfo.changedFiles.length,
      filesWithErrors,
      filesWithWarnings,
      results,
    };
  }
}
