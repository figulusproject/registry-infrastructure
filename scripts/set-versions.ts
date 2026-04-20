import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

async function getVersion(): Promise<string> {
    const args = process.argv.slice(2);
    const versionIndex = args.findIndex(arg => arg === '--version' || arg === '-v');

    if (versionIndex !== -1 && versionIndex + 1 < args.length)
      return args[versionIndex + 1];

    const promptAnswer: string|undefined = await new Promise((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.setPrompt("Enter a new version: ");
        rl.prompt();
    
        let response: string | undefined;
        rl.on('line', (userInput) => {
            response = userInput;
            rl.close();
        });
        rl.on('close', () => {
            resolve(response);
        });
    });

    // if not undefined or empty
    if(promptAnswer) return promptAnswer;
    throw new Error("You must provide a version");
}

try {
    const repoRoot = path.resolve(import.meta.dirname, "..");
    const packageJsonPaths = readdirSync(repoRoot, { recursive: true })
                            .map((p) => String(p))
                            .filter((p) => p.includes("package.json") && !p.includes("node_modules"))
    const absolutePackageJsonPaths = packageJsonPaths.map((p) => path.resolve(repoRoot, p));

    const newVersion = await getVersion();
    for(const filePath of absolutePackageJsonPaths) {
        const content = readFileSync(filePath).toString();
        const updated = content.replace(
            /"version"\s*:\s*"[^"]*"/,
            `"version": "${newVersion}"`
        );
        writeFileSync(filePath, updated);
    }

    console.log(`Set version to ${newVersion} in ${packageJsonPaths.join(", ")}`);
    process.exit(0);
} catch (error) {
    console.error(error);
    process.exit(1);
}
