import { ZodArray, ZodObject } from "zod";
import { ValidationResult } from "./validation-result.js";

export type SchemaObject = ZodObject | ZodArray;

export interface PullRequestInfo {
  changedFiles: string[];
  author: string;
}

export interface FileValidationResult {
  file: string;
  type: string;
  result: ValidationResult;
}

export interface ValidationSummary {
  success: boolean;
  totalFiles: number;
  filesWithErrors: number;
  filesWithWarnings: number;
  results: FileValidationResult[];
}
