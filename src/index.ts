import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { paymentConfig } from "./config";
import { reviewX402Config } from "./config-review";
import { createPaidToolHandler } from "./paid-tool";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === "/mcp") return createMcpHandler(() => createServer(env), { route: "/mcp" })(request, env, ctx);
    return Response.json({ name: "x402-mcp-starter", mcp: "/mcp", network: "Base Sepolia by default" });
  },
};

export function createServer(env: Env): McpServer {
  const config = paymentConfig(env);
  const server = new McpServer({ name: "x402 MCP Starter", version: "0.2.0" });
  const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: config.facilitatorUrl }));
  registerExactEvmScheme(resourceServer);
  let initialized: Promise<void> | undefined;
  const initialize = () => initialized ??= resourceServer.initialize();

  server.registerTool("validate_x402_config", {
    title: "Validate x402 payment configuration",
    description: "Free: checks Base USDC, price, amount, recipient, and facilitator settings before you deploy an x402-paid MCP tool.",
    inputSchema: z.object({
      network: z.enum(["eip155:84532", "eip155:8453"]),
      asset: z.string(),
      amount: z.string(),
      priceUsd: z.number(),
      payTo: z.string(),
      facilitatorUrl: z.string(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => result(reviewX402Config(input)));

  server.registerTool("get_paid_sample", {
    title: "Get a paid sample result",
    description: "Fixed-price reference path: confirms that an x402-aware MCP client can pay and receive a receipt.",
    inputSchema: z.object({ option: z.enum(["basic", "standard", "extended"]) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, createPaidToolHandler({
    toolName: "get_paid_sample",
    resource: { url: "x402://get_paid_sample", description: "Verify a fixed-price x402 payment path" },
    env, config, resourceServer, initialize,
    execute: ({ option }) => ({ option, summary: `x402 payment flow confirmed for ${option}. Replace this reference handler with your own read-only data source.` }),
  }));
  return server;
}
function result(value: unknown, meta?: Record<string, unknown>) { return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown>, ...(meta ? { _meta: meta } : {}) }; }
