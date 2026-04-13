import { existsSync } from "fs";
import z from "zod";

export const stringifiedStringArraySchema = z
    .string()
    .transform((arg, ctx) => {
        try { return JSON.parse(arg); }
        catch (err) {
            ctx.addIssue(`Invalid JSON: ${err}`);
            return z.NEVER;
        }
    })
    .pipe(z.array(z.string()));

export const validFilePathSchema = z.string().superRefine((arg, ctx) => {
    if(!existsSync(arg)) {
        ctx.addIssue(`No file/directory found at '${arg}'`);
        return z.NEVER;
    }
});