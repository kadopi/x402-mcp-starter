import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("x402 MCP Starter service card", () => {
  it("publishes payment-preflight discovery details without claiming A2A", async () => {
    const response = await worker.fetch(new Request("https://example.test/.well-known/agent-card.json"), {} as Env, {} as ExecutionContext);
    const card = await response.json() as { mcpEndpoint: string; skills: Array<{ tags: string[]; examples: string[]; firstTool: string }>; a2a: { supported: boolean } };
    expect(response.status).toBe(200);
    expect(card.mcpEndpoint).toBe("https://x402-mcp-starter.kadopi.workers.dev/mcp");
    expect(card.skills[0].tags).toEqual(expect.arrayContaining(["x402", "usdc", "payment-preflight"]));
    expect(card.skills[0].examples[0]).toContain("Cloudflare Workers MCP");
    expect(card.skills[0].firstTool).toBe("validate_x402_config");
    expect(card.a2a.supported).toBe(false);
  });
});
