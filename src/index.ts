import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { paymentConfig } from "./config";
import { reviewX402Config } from "./config-review";
import { createPaidToolHandler } from "./paid-tool";

const AGENT_CARD = {
  name: "x402 MCP Starter",
  description: "Free, self-hosted Cloudflare Workers starter for adding USDC usage billing to a read-only MCP tool. The public endpoint is a Base Sepolia verification environment, not a hosted production payment service.",
  version: "0.2.0",
  serviceType: "mcp-service-card",
  mcpEndpoint: "https://x402-mcp-starter.kadopi.workers.dev/mcp",
  links: {
    productPage: "https://aegis-sales-bot.kadopi.workers.dev/products/x402-mcp-starter",
    githubReadme: "https://github.com/kadopi/x402-mcp-starter/blob/master/README.md",
    mcpRegistry: "https://registry.modelcontextprotocol.io/?q=io.github.kadopi%2Fx402-mcp-starter",
    clawHubSkillSource: "https://github.com/kadopi/x402-mcp-starter/blob/master/openclaw/SKILL.md"
  },
  transport: "streamable-http",
  skills: [{
    id: "x402-mcp-payment-preflight",
    name: "x402 MCP payment configuration preflight",
    tags: ["x402", "mcp", "usdc", "base-sepolia", "cloudflare-workers", "payment-preflight", "self-hosted"],
    examples: [
      "I am building a Cloudflare Workers MCP and want to validate a Base USDC x402 payment configuration before deploying a paid read-only tool.",
      "Show me the minimum MCP flow for an x402-aware client to receive a payment challenge, pay once, and receive a receipt."
    ],
    firstTool: "validate_x402_config"
  }],
  limitations: [
    "Self-hosted starter code; not a managed payment service or customer wallet.",
    "The public endpoint uses Base Sepolia and test USDC by default.",
    "The Worker never receives a buyer private key; production Mainnet rollout requires the operator's separate configuration and approval."
  ],
  a2a: { supported: false, note: "This card describes an MCP service. A2A conversation is provided by Aegis Sales Bot, not x402 MCP Starter." }
} as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/.well-known/agent-card.json" && request.method === "GET") return Response.json(AGENT_CARD);
    if (path === "/mcp") return createMcpHandler(() => createServer(env), { route: "/mcp" })(request, env, ctx);
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
