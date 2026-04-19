#!/usr/bin/env node
import { RegistryValidator } from "@figulus/validator-core";
import { args } from "./cli.js";
import { helpers } from "./helpers.js";
import { validatorSettings } from "./validator-settings.js";
import { writeOutputFile } from "./output.js";

try {
    const validator = new RegistryValidator(helpers, validatorSettings);

    const res = await validator.validatePr({
        changedFiles: args["changed-files"],
        author: args.author,
    });

    writeOutputFile(res);

    process.exit(0);
} catch (error) {
    console.error(error);
    process.exit(1);
}

