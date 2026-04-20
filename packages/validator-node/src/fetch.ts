import {
  fetchRegistrySettingsRouteSchema,
  getAllPRsRouteSchema,
  getFileContentsRouteSchema,
  getPRFilesRouteSchema
} from "@figulus/schema/registry";
import { up } from "up-fetch";
import { ZodType } from "zod";
import { validatorSettings } from "./validator-settings.js";
import { validatorSettingsDefaults } from "@figulus/validator-core";

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
    let headers = {
        ...params.additionalHeaders,
    };

    if(validatorSettings.registry.accessToken) {
        headers = {
            ...headers,
            "Authorization": `Bearer ${validatorSettings.registry.accessToken}`
        }
    }
    
    const fetchWithFallback = async (baseUrlOverride?: string) => {
      const baseUrl = baseUrlOverride || params.baseUrl || validatorSettings.registry.url;
      const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const url = cleanBase + params.route;

      try {
        return await upfetch(url, {
          headers,
          schema: params.schema,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("404"))
          throw error;

        const fallbackUrl = validatorSettingsDefaults.registry.url;

        if(!baseUrlOverride) {
          console.warn(`Failed to connect to registry '${baseUrl}'. Re-attempting with registry '${fallbackUrl}'...`);
          return await fetchWithFallback(fallbackUrl);
        }

        throw new Error(`Failed to connect to registries '${baseUrl}' and '${fallbackUrl}'. Terminating...`);
      }
    }

    const res = await fetchWithFallback();

    if(params.route.includes(".json") && !params.schema)
        return JSON.stringify(res) as T;
    return res as T;
}

export async function getRegistrySettings() {
    return await fetchFromRegistry<string>({
        route: buildPath(fetchRegistrySettingsRouteSchema),
    });
}

export async function getAllPRs() {
    const schema = getResponseSchema(getAllPRsRouteSchema);
    const route = buildPath(getAllPRsRouteSchema, {
        state: "all",
        per_page: 100,
    });

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
