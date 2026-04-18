// 
// Script is still a work-in-progress.
// Needs better edge case handling and a more example data
// 
import { randomBytes } from "node:crypto";
import { renderValidationMessage } from "../src/lib/output-renderer.js";
import { createError, errorCodeSchema, failure } from "../src/validation-result.js";

const validExtensions = ["figspec", "figstack", "js"] as const;
const invalidExtensions = ["json", "yaml", "ts", "exe"] as const;
const namespaces = ["figulus", "figulusproject", "official", "examples"] as const;
const authors = ["notfigulusproject", "therealfigulusproject", "figulus", "figulusproject69", "figulusproject67"] as const; 
const entityNames = ["entityone", "testentity", "anentityname", "placeholderentity"] as const;

// const code = "NAMESPACE_OWNERSHIP_TRANSFER_DENIED"
for(const code of errorCodeSchema.options) {
    const getErrorType = () => {
        if(code.startsWith("BLOB")) return "blob";
        if(code.startsWith("ENTITY")) return "entity";
        if(
            code.startsWith("NAMESPACE") ||
            code.startsWith("PERMISSION") ||
            code.startsWith("PUSH_LIMIT")
          )
            return "namespace";
        return "unknown";
    }
    const errorType = getErrorType();

    // Psuedo-random number between 0 and 99
    const generateSeed = () => {
        return Number(Math.random().toPrecision(4).slice(3, 5));
    }

    const seed = generateSeed();

    const extensions = code.includes("INVALID") ? invalidExtensions : validExtensions;
    const extension = extensions[seed % extensions.length];

    const namespace = namespaces[seed % namespaces.length];

    const generateAuthor = (mustNotMatch?: string) => {
        const candidate = authors[generateSeed() % authors.length];
        if(mustNotMatch && candidate === mustNotMatch) return generateAuthor();
        return candidate;
    }
    const author = generateAuthor();

    const expectedHash = randomBytes(32).toString("hex");
    const actualHash = randomBytes(32).toString("hex");

    const pushUnit = (["daily", "weekly"] as const)[seed % 2];
    const pushesUsed = pushUnit === "daily" ? 10 : 70;
    const pushLimit = pushUnit === "daily" ? 10 : 70;
    const limitSource = (["editor settings", "namespace override"] as const)[seed % 2];

    const generateDir = () => {
        if((errorType === "blob" && code !== "BLOB_REFERENCE_NOT_FOUND") || errorType === "namespace")
            return (errorType + "s" as "blobs" | "namespaces");
        if(errorType === "entity" || code === "BLOB_REFERENCE_NOT_FOUND")
            return (["specs", "stacks", "parsers"] as const)[seed % 3];
        return (["unknowndir", "invaliddir"] as const)[seed % 2];
    }
    const dir = generateDir();

    const generateFilename = () => {
        if(dir === "parsers" || dir === "specs" || dir === "stacks" || code === "BLOB_INVALID_FILENAME")
            return entityNames[seed % entityNames.length];
        if(code === "BLOB_HASH_MISMATCH") return expectedHash;
        if(dir === "blobs") return actualHash;
        if(dir === "namespaces")
            return namespaces[seed % namespaces.length];
    }
    const filename = generateFilename();

    const generateExtension = () => {
        if(code === "BLOB_MISSING_EXTENSION") return "";
        if(code === "BLOB_INVALID_EXTENSION") return extension;
        if(dir !== "blobs") return "json";
        return validExtensions[seed % validExtensions.length];
    }

    const generatePath = () => {
        const joinedDir = dir + "/";
        const ext = generateExtension();
        const joinedExt = ext.length > 0 ? `.${ext}` : "";
        return joinedDir + filename + joinedExt;
    }

    const path = generatePath();
    const error = "ERROR PLACEHOLDER";
    
    const headOwner = generateAuthor(author);
    
    const generateContext = () => {
        if(errorType === "namespace")
            return ([`Namespace ${namespace}`, `Editor ${headOwner}`] as const)[seed % 2];
        return (["TODO: Add a real error code", "Edge case 7: file a bug report if you see this in production"] as const)[seed % 2];
    }
    const context = generateContext();

    const err = createError(({
        code,
        extension,
        namespace,
        author,
        expectedHash,
        actualHash,
        contentHash: actualHash,
        pushUnit,
        type: dir.slice(0, dir.length-1),
        path,
        error,
        limitSource,
        context,
        pushesUsed,
        pushLimit,
        provided: pushLimit * 2,
        constraintMin: 1,
        constraintMax: pushLimit,
        headOwner: headOwner,
    } as any));

    const borderLength = 70;
    const borderSplit = borderLength - (code.length ?? 2) - 2;
    const halfBorder = borderSplit / 2;
    console.log("\n".repeat(4), "=".repeat(halfBorder), code, "=".repeat(halfBorder),  "\n".repeat(2))
    
    console.log(renderValidationMessage({
        success: false,
        totalFiles: 2,
        filesWithErrors: 1,
        filesWithWarnings: 0,
        results: [{
            file: path,
            type: "",
            result: failure([err]),
        }],
    }));
    
    console.log("\n".repeat(2), "=".repeat(borderLength))
}
