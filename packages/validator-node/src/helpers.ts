import { Helpers } from "@figulus/validator-core";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { getAllPRs, getHead, getPRFiles, getRegistrySettings } from "./fetch.js";

export const helpers: Helpers = {
    console: {
        log: (...data: any[]) => console.log(...data),
        error: (...data: any[]) => console.error(...data),
    },
    crypto: {
        createSha256HexHash: (data: string) => createHash("sha256").update(data).digest("hex"),
    },
    fs: {
        resolvePath: (...paths: string[]) => path.resolve(...paths),
        // TODO: Need to properly support Windows-style paths in future. validator-core will potentially need changes too
        splitPath: (path: string) => path.split("/"),
        fileOrDirExists: (path: string) => existsSync(path),
        readFileAsUtf8: (path: string) => readFileSync(path).toString('utf-8'),
    },
    registry: {
        showHead: getHead,
        getAllPRs: getAllPRs,
        getPRFiles: getPRFiles,
        getSettings: getRegistrySettings,
    },
};
