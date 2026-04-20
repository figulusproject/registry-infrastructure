import dotenv from "dotenv";
import { loadValidatorSettings, ValidatorSettingsInput, validatorSettingsSchemaInput } from "@figulus/validator-core";
import { stringifiedStringArraySchema } from "./types.js";
import { args } from "./cli.js";
import { readFileSync } from "node:fs";
import path from "node:path";

dotenv.config();

function loadFile(): Partial<ValidatorSettingsInput> {
    try {
        if(!args["settings-file"]) return {};
        const fullPath = path.resolve(args["settings-file"]);
        return JSON.parse(readFileSync(fullPath).toString());
    } catch {
        return {};
    }
}

function loadEnv(): Partial<ValidatorSettingsInput> {
    try {
        const keys = Object.fromEntries(Object.keys(validatorSettingsSchemaInput.shape).map((str) => {
            const envKey = str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
            const env = process.env[envKey];
            if(!env) return undefined;

            const key = str;

            if(env.startsWith("[") && env.endsWith("]"))
                return { key, env: stringifiedStringArraySchema.parse(env) };

            if(env.startsWith("{") && env.endsWith("}"))
                return { key, env: JSON.parse(env) };

            return {
                key, env
            }
        }).filter((obj) => obj !== undefined).map((obj) => (
            [obj.key, obj.env]
        )));

        return keys;
    } catch {
        return {};
    }
}

const file = loadFile();
const env = loadEnv();

const settingsBase: ValidatorSettingsInput = {
    repoRoot: args["repo-root"] || process.cwd(),
    ...file,
    ...env,
};

const withCliOverrides: ValidatorSettingsInput = args["registry-url"] ? {
    ...settingsBase,
    registry: {
        url: args["registry-url"]
    }
} : settingsBase;

export const validatorSettings = loadValidatorSettings(withCliOverrides);
