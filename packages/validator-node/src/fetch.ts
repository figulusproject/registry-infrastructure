import { up } from "up-fetch";
import z, { ZodType } from "zod";
import { settings } from "./settings.js";

const upfetch = up(fetch);

async function fetchFromRegistry<T>(params: {
    baseUrl?: string;
    route: string;
    additionalHeaders?: { [key: string]: string };
    schema?: ZodType<T>;
}) {
    const baseUrl = params.baseUrl || settings.registryRepo.apiUrl;
    const url = (baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`) + params.route;

    let headers = {
        ...params.additionalHeaders,
    };

    if(settings.registryRepo.accessToken) {
        headers = {
            ...headers,
            "Authorization": `Bearer ${settings.registryRepo.accessToken}`
        }
    }

    const res = await upfetch(url, {
        headers,
        schema: params.schema,
    });
    
    if(params.route.includes(".json") && !params.schema)
        return JSON.stringify(res) as T;
    return res as T;
}

export async function getAllPRs() {
    return await fetchFromRegistry({
        route: "pulls?state=all&per_page=100",
        schema: z.object({
            url: z.url(),
            created_at: z.iso.datetime(),
            user: z.object({
                id: z.coerce.string(),
            }),
        }).array(),
    });
}

export async function getPRFiles(prUrl: string) {
    return await fetchFromRegistry({
        baseUrl: prUrl,
        route: "files",
        schema: z.object({
            filename: z.string(),
        }).array(),
    });
}

export async function getHead(filePath: string, branch?: string) {
    return await fetchFromRegistry<string>({
        route: `contents/${filePath}?ref=${branch || "main"}`,
        additionalHeaders: {
            "Accept": "application/vnd.github.v3.raw",
        },
    });
}
