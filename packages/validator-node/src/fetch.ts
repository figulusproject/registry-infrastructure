import { up } from "up-fetch";
import { ZodType } from "zod";
import {
  getAllPRsRouteSchema,
  getPRFilesRouteSchema,
  getFileContentsRouteSchema,
} from "@figulus/schema/registry";
import { settings } from "./settings.js";

const upfetch = up(fetch);

function buildPath(
  routeConfig: any,
  params?: Record<string, string | number | boolean>
): string {
  let path = routeConfig.path;

  if (params && routeConfig.parameters) {
    const pathParams = routeConfig.parameters.filter(
      (p: any) => p.in === "path"
    );
    pathParams.forEach((param: any) => {
      if (params[param.name] !== undefined)
        path = path.replace(
          `{${param.name}}`,
          String(params[param.name])
        );
    });
  }

  const queryParams = new URLSearchParams();
  if (params && routeConfig.parameters) {
    const queryParamDefs = routeConfig.parameters.filter(
      (p: any) => p.in === "query"
    );
    queryParamDefs.forEach((param: any) => {
      if (params[param.name] !== undefined)
        queryParams.append(param.name, String(params[param.name]));
    });
  }

  const query = queryParams.toString();
  return query ? `${path}?${query}` : path;
}

function getResponseSchema<T = any>(
  routeConfig: any,
  statusCode: number | string = 200
): ZodType<T> | undefined {
  const response = (routeConfig.responses as any)?.[statusCode];
  if (!response) return undefined;

  const content = response.content;
  if (!content) return undefined;

  if (content["application/json"]?.schema)
    return content["application/json"].schema;

  const firstContentType = Object.keys(content)[0];
  if (firstContentType && content[firstContentType]?.schema)
    return content[firstContentType].schema;

  return undefined;
}

async function fetchFromRegistry<T>(params: {
    baseUrl?: string;
    route: string;
    additionalHeaders?: { [key: string]: string };
    schema?: ZodType<T>;
}) {
    const baseUrl = params.baseUrl || settings.registryRepo.url;
    const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const url = cleanBase + params.route;

    let headers = {
        ...params.additionalHeaders,
    };

    if(settings.registryRepo.accessToken) {
        headers = {
            ...headers,
            "Authorization": `Bearer ${settings.registryRepo.accessToken}`
        }
    }

    console.log("Fetching from:", url)

    const res = await upfetch(url, {
        headers,
        schema: params.schema,
    });

    if(params.route.includes(".json") && !params.schema)
        return JSON.stringify(res) as T;
    return res as T;
}

export async function getAllPRs() {
    const schema = getResponseSchema(getAllPRsRouteSchema);
    const route = buildPath(getAllPRsRouteSchema, {
        state: "all",
        per_page: 100,
    });

    console.log(route)
    return await fetchFromRegistry({
        route,
        schema,
    });
}

export async function getPRFiles(prUrl: string) {
    const prNumber = prUrl.split("/").pop();
    if (!prNumber)
        throw new Error(`Invalid PR URL: ${prUrl}`);

    const schema = getResponseSchema(getPRFilesRouteSchema);
    const route = buildPath(getPRFilesRouteSchema, {
        prNumber,
    });

    console.log(route)
    return await fetchFromRegistry({
        route,
        schema,
    });
}

export async function getHead(filePath: string, branch?: string) {
    const schema = getResponseSchema(getFileContentsRouteSchema, 200);
    const route = buildPath(getFileContentsRouteSchema, {
        filePath,
        ref: branch || "main",
    });

    console.log(route)

    const res = await fetchFromRegistry<any>({
        route,
        schema,
    });

    if (typeof res === "string") return res;
    if (res.content && res.encoding === "base64") {
        return Buffer.from(res.content, "base64").toString("utf-8");
    }
    throw new Error(`Unexpected response format from getHead: ${JSON.stringify(res)}`);
}
