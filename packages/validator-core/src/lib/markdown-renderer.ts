import { ValidationSummary } from "../types.js";
import { FailureResult, SuccessResult, ValidationError } from "../validation-result.js";

type Summary = Omit<ValidationSummary, "markdown">;

function renderError(error: ValidationError): string {
  return `• ${error.message}`;
}

function renderErrors(errors: ValidationError[]): string {
  return errors.map(renderError).join("\n");
}

function renderFailureResultsMessage(summary: Summary): string {
  const failures = summary.results.filter((r) => !r.result.success);

  if (failures.length === 0)
    return "";

  let message = "### ❌ Validation failed. Please fix the following issues:\n\n";

  failures.forEach((fileResult) => {
    const result = fileResult.result as FailureResult;
    message += `- \`${fileResult.file}\`\n`;
    message += renderErrors(result.errors);
    message += "\n\n";
  });

  return message.trim();
}

function renderWarningsMessage(summary: Summary): string {
  const warnings = summary.results.filter((r) => r.result.success && r.result.warnings?.length);

  if (warnings.length === 0)
    return "";

  let message = "### ⚠️ Validation warnings:\n\n";

  warnings.forEach((fileResult) => {
    const result = fileResult.result as SuccessResult;
    message += `- \`${fileResult.file}\`\n`;
    message += renderErrors(result.warnings || []);
    message += "\n\n";
  });

  return message.trim();
}

export function renderValidationMessage(summary: Summary): string {
  if (summary.success)
    return "### ✅ All validation checks passed!";

  let message = renderFailureResultsMessage(summary);

  const warningsMsg = renderWarningsMessage(summary);
  if (warningsMsg) message += "\n\n" + warningsMsg;

  return message;
}
