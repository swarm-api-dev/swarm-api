#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import open from "open";

const CDP_PROJECT_ID = "ca67d8b0-2675-4286-b036-e090af3cc689";
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const DEFAULT_GATEWAY = process.env.SWARMAPI_GATEWAY_URL ?? "https://api.swarmapi.ai";
const POLL_INTERVAL_MS = 5_000;

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n[setup] error: ${msg}`);
  process.exit(1);
});

async function main() {
  banner();

  console.log("Generating fresh Base wallet...");
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`  address: ${account.address}\n`);

  const choice = await prompt(
    "How would you like to fund it?\n" +
      "  [1] Buy USDC with card via Coinbase Onramp  (recommended)\n" +
      "  [2] Show address — I'll fund manually from another wallet\n" +
      "  [3] Already funded this address — verify\n" +
      "\n> ",
    "1",
  );

  const dryRun = process.argv.includes("--dry-run");

  if (choice === "1") {
    const url = buildOnrampUrl(account.address);
    console.log("\nOpening Coinbase Onramp in your browser...");
    console.log(`  ${url}`);
    if (!dryRun) {
      try {
        await open(url);
      } catch {
        console.log("  (could not auto-open browser — copy the URL above)");
      }
    }
  } else if (choice === "2") {
    console.log(`\nSend any amount of USDC on Base mainnet to:`);
    console.log(`  ${account.address}\n`);
  } else {
    console.log(`\nVerifying balance for ${account.address}...\n`);
  }

  if (dryRun) {
    console.log("\n[dry-run] skipping balance polling.");
    writeOutputs(privateKey, account.address);
    return;
  }

  console.log("Polling Base mainnet for incoming USDC (Ctrl-C to abort)...");
  const balance = await pollUntilFunded(account.address);
  console.log(`\n✓ Detected ${formatUsdc(balance)} USDC at ${account.address}\n`);

  writeOutputs(privateKey, account.address);
}

function buildOnrampUrl(address: `0x${string}`): string {
  const destinationWallets = JSON.stringify([
    { address, blockchains: ["base"], assets: ["USDC"] },
  ]);
  const params = new URLSearchParams({
    appId: CDP_PROJECT_ID,
    destinationWallets,
    defaultAsset: "USDC",
    defaultPaymentMethod: "CARD",
  });
  return `https://pay.coinbase.com/buy/select-asset?${params.toString()}`;
}

async function pollUntilFunded(address: `0x${string}`): Promise<bigint> {
  const client = createPublicClient({ chain: base, transport: http() });
  let lastDisplay = "";
  let ticker = 0;
  while (true) {
    let balance = 0n;
    try {
      balance = (await client.readContract({
        address: USDC_BASE_MAINNET,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
    } catch {
      // RPC blip — keep polling
    }
    if (balance > 0n) return balance;
    const dots = ".".repeat((ticker++ % 3) + 1).padEnd(3, " ");
    const display = `  waiting${dots}  (current: 0.000000 USDC)`;
    if (display !== lastDisplay) {
      stdout.write(`\r${display}`);
      lastDisplay = display;
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function writeOutputs(privateKey: string, address: `0x${string}`): void {
  const config = {
    mcpServers: {
      swarmapi: {
        command: "npx",
        args: ["-y", "@swarmapi/mcp"],
        env: {
          SWARMAPI_PRIVATE_KEY: privateKey,
          SWARMAPI_GATEWAY_URL: DEFAULT_GATEWAY,
          SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC: "100000",
        },
      },
    },
  };
  const dir = path.join(homedir(), ".swarmapi");
  mkdirSync(dir, { recursive: true });
  const cfgPath = path.join(dir, "claude-desktop.json");
  writeFileSync(cfgPath, JSON.stringify(config, null, 2), { mode: 0o600 });

  console.log("─".repeat(60));
  console.log("MCP config — paste the 'swarmapi' entry into your");
  console.log("Claude Desktop config's 'mcpServers' object:\n");
  console.log(JSON.stringify(config, null, 2));
  console.log("─".repeat(60));
  console.log(`\nAlso saved to:  ${cfgPath}  (chmod 600)`);

  console.log("\nNext steps:");
  console.log("  1. Open Claude Desktop config:");
  console.log("       macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json");
  console.log("       Windows: %APPDATA%\\Claude\\claude_desktop_config.json");
  console.log("       Linux:   ~/.config/Claude/claude_desktop_config.json");
  console.log("  2. Merge the 'swarmapi' block into 'mcpServers'.");
  console.log("  3. Restart Claude Desktop.");
  console.log("  4. Ask: \"Pull recent SEC filings for AAPL.\"");

  console.log("\nWallet — back this up! Losing the key means losing the funds.");
  console.log(`  address:     ${address}`);
  console.log(`  private key: ${privateKey}`);
}

async function prompt(question: string, fallback: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer.length > 0 ? answer : fallback;
  } finally {
    rl.close();
  }
}

function formatUsdc(atomic: bigint): string {
  const whole = atomic / 1_000_000n;
  const frac = atomic % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function banner() {
  console.log("");
  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log("│  SwarmApi setup                                          │");
  console.log("│  Generate a Base wallet → fund → write Claude config     │");
  console.log("└──────────────────────────────────────────────────────────┘");
  console.log("");
}
