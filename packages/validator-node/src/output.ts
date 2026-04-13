import { ValidationSummary } from "@figulus/validator-core";
import { args } from "./cli.js";
import path from "node:path";
import { writeFileSync } from "node:fs";

export function writeOutputFile(res: ValidationSummary) {
    if(!args["output-file"]) return;
    const fullPath = path.resolve(args["output-file"]);
    writeFileSync(fullPath, JSON.stringify(res, null, 2));
}
