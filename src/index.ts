import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { paymentConfig } from "./config";
import { createPaidToolHandler } from "./paid-tool";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === "/mcp") return createMcpHandler(() => createServer(env), { route: "/mcp" })(request, env, ctx);
    return Response.json({ name: "x402-mcp-starter", mcp: "/mcp", network: "Base Sepolia by default" });
  },
};

export function createServer(env: Env): McpServer {
  const config = paymentConfig(env);
  const server = new McpServer({ name: "x402 MCP Starter", version: "0.1.0" });
  const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: config.facilitatorUrl }));
  registerExactEvmScheme(resourceServer);
  let initialized: Promise<void> | undefined;
  const initialize = () => initialized ??= resourceServer.initialize();

  server.registerTool("list_sample_options", {
    title: "List free sample options",
    description: "Free sample: returns a small static catalog without payment.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => result({ free: true, options: ["basic", "standard", "extended"] }));

  server.registerTool("get_paid_sample", {
    title: "Get a paid sample result",
    description: "Paid sample: returns static data after an x402 USDC payment.",
    inputSchema: z.object({ option: z.enum(["basic", "standard", "extended"]) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, createPaidToolHandler({
    toolName: "get_paid_sample",
    resource: { url: "x402://get_paid_sample", description: "Get a paid sample result" },
    env, config, resourceServer, initialize,
    execute: ({ option }) => ({ option, summary: `Paid sample result for ${option}. Replace this handler with your own read-only data source.` }),
  }));
  return server;
}
function result(value: unknown, meta?: Record<string, unknown>) { return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown>, ...(meta ? { _meta: meta } : {}) }; }
