#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, isHex } from "viem";
import type { Address, Hex } from "viem";
import { base, baseSepolia } from "viem/chains";
import open from "open";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = "0.2.1";
const CDP_PROJECT_ID = "ca67d8b0-2675-4286-b036-e090af3cc689";
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const DEFAULT_GATEWAY = "https://api.swarm-api.com";
const DEFAULT_MAX_SPEND = "100000"; // $0.10 atomic USDC
const POLL_INTERVAL_MS = 5_000;
const POLL_HEARTBEAT_MS = 60_000; // print a "still waiting" line every minute
const ONRAMP_PRESET_USD = 5;

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  help: boolean;
  version: boolean;
  dryRun: boolean;
  json: boolean;
  noPoll: boolean;
  noOpen: boolean;
  testnet: boolean;
  reuse: boolean;
  key?: Hex;
  mnemonic?: string;
  keyStdin: boolean;
  mnemonicStdin: boolean;
  keyFile?: string;
  mnemonicFile?: string;
  /** True when --key or --mnemonic was passed inline; we'll warn loudly. */
  inlineSecretFlag: boolean;
  gateway: string;
  maxSpend: string;
  outDir: string;
}

function parseArgs(argv: ReadonlyArray<string>): Args {
  const args: Args = {
    help: false,
    version: false,
    dryRun: false,
    json: false,
    noPoll: false,
    noOpen: false,
    testnet: false,
    reuse: false,
    keyStdin: false,
    mnemonicStdin: false,
    inlineSecretFlag: false,
    gateway: process.env.SWARMAPI_GATEWAY_URL ?? DEFAULT_GATEWAY,
    maxSpend: process.env.SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC ?? DEFAULT_MAX_SPEND,
    outDir: path.join(homedir(), ".swarmapi"),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (true) {
      case a === "-h" || a === "--help":
        args.help = true;
        break;
      case a === "-v" || a === "--version":
        args.version = true;
        break;
      case a === "--dry-run":
        args.dryRun = true;
        break;
      case a === "--json":
        args.json = true;
        break;
      case a === "--no-poll":
        args.noPoll = true;
        break;
      case a === "--no-open":
        args.noOpen = true;
        break;
      case a === "--testnet":
        args.testnet = true;
        break;
      case a === "--reuse":
        args.reuse = true;
        break;
      case a.startsWith("--key="):
        args.key = parseKeyArg(a.slice(6));
        args.inlineSecretFlag = true;
        break;
      case a === "--key": {
        const next = argv[++i];
        args.key = parseKeyArg(next);
        args.inlineSecretFlag = true;
        break;
      }
      case a === "--key-stdin":
        args.keyStdin = true;
        break;
      case a.startsWith("--key-file="):
        args.keyFile = a.slice(11);
        break;
      case a === "--key-file":
        args.keyFile = argv[++i];
        break;
      case a.startsWith("--mnemonic="):
        args.mnemonic = a.slice(11).trim();
        args.inlineSecretFlag = true;
        break;
      case a === "--mnemonic": {
        args.mnemonic = (argv[++i] ?? "").trim();
        args.inlineSecretFlag = true;
        break;
      }
      case a === "--mnemonic-stdin":
        args.mnemonicStdin = true;
        break;
      case a.startsWith("--mnemonic-file="):
        args.mnemonicFile = a.slice(16);
        break;
      case a === "--mnemonic-file":
        args.mnemonicFile = argv[++i];
        break;
      case a.startsWith("--gateway="):
        args.gateway = a.slice(10);
        break;
      case a === "--gateway":
        args.gateway = argv[++i] ?? args.gateway;
        break;
      case a.startsWith("--max-spend="):
        args.maxSpend = a.slice(12);
        break;
      case a === "--max-spend":
        args.maxSpend = argv[++i] ?? args.maxSpend;
        break;
      case a.startsWith("--out-dir="):
        args.outDir = a.slice(10);
        break;
      case a === "--out-dir":
        args.outDir = argv[++i] ?? args.outDir;
        break;
      default:
        die(`unknown flag: ${a}\n\nRun \`@swarmapi/setup --help\` for usage.`);
    }
  }

  return args;
}

function parseKeyArg(raw: string | undefined): Hex {
  if (!raw) die("--key requires a value (0x-prefixed 32-byte hex)");
  const v = raw.trim().toLowerCase();
  const prefixed = v.startsWith("0x") ? v : `0x${v}`;
  if (!isHex(prefixed) || prefixed.length !== 66) {
    die("--key must be a 0x-prefixed 32-byte hex string (66 chars)");
  }
  return prefixed as Hex;
}

function die(message: string): never {
  process.stderr.write(`\n[setup] ${message}\n\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n[setup] error: ${msg}\n`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }
  if (args.version) {
    process.stdout.write(`@swarmapi/setup v${VERSION}\n`);
    return;
  }

  if (!args.json) banner();

  // SECURITY: passing secrets as inline argv values is a known footgun.
  // They're visible to other users via `ps aux` (Unix), Task Manager (Win),
  // and get logged to shell history. Loudly recommend --key-stdin /
  // --mnemonic-stdin / --*-file. We still accept the flags because that's
  // already the documented API.
  if (args.inlineSecretFlag && !args.json) {
    process.stderr.write(
      "\n⚠ --key/--mnemonic on the command line is visible to other users on\n" +
        "  this machine via `ps aux` and is persisted in shell history.\n" +
        "  Prefer one of:\n" +
        "    echo -n \"$KEY\"  | npx -y @swarmapi/setup --key-stdin\n" +
        "    npx -y @swarmapi/setup --key-file ./key.txt\n" +
        "    npx -y @swarmapi/setup --mnemonic-file ./seed.txt\n\n",
    );
  }

  // 1. Resolve wallet source: --key/--mnemonic (inline | stdin | file), --reuse, prompt, or generate
  const wallet = await resolveWallet(args);

  // 2. CRITICAL — persist key to disk BEFORE any network polling so a Ctrl-C
  //    during balance polling can never lose the wallet.
  const paths = persistWallet(wallet.privateKey, wallet.address, args);

  if (!args.json) {
    process.stdout.write(`\n✓ Wallet saved to ${paths.walletPath} (chmod 600)\n`);
    process.stdout.write(`  address: ${wallet.address}\n\n`);
  }

  // 3. Fund the wallet (skipped if it's already an existing wallet OR --no-poll)
  if (wallet.imported && !args.json) {
    process.stdout.write(
      "Imported existing wallet — skipping funding prompt. Use --no-poll to skip balance check, or wait for poll to confirm USDC balance.\n",
    );
  }

  let balance = 0n;
  let pollSkipped = false;

  if (!args.noPoll && !args.dryRun) {
    const fundingChoice = wallet.imported ? "skip" : await promptFunding(args);
    if (fundingChoice === "onramp") {
      const url = buildOnrampUrl(wallet.address, args.testnet);
      if (!args.json) {
        process.stdout.write("\nOpening Coinbase Onramp in your browser...\n");
        process.stdout.write(`  ${url}\n`);
      }
      if (!args.noOpen) {
        try {
          await open(url);
        } catch {
          if (!args.json) process.stdout.write("  (could not auto-open browser — copy the URL above)\n");
        }
      }
    } else if (fundingChoice === "manual") {
      if (!args.json) {
        process.stdout.write("\nSend any amount of USDC on Base mainnet to:\n");
        process.stdout.write(`  ${wallet.address}\n`);
      }
    }

    if (!args.json) {
      process.stdout.write(
        `\nPolling ${args.testnet ? "Base Sepolia" : "Base mainnet"} for USDC balance (Ctrl-C to abort — wallet is already saved):\n`,
      );
    }
    try {
      balance = await pollUntilFunded(wallet.address, args.testnet, args.json);
      if (!args.json) {
        process.stdout.write(`\n✓ Detected ${formatUsdc(balance)} USDC at ${wallet.address}\n`);
      }
    } catch (err) {
      // Ctrl-C / SIGINT path: re-throw so the top-level handler runs, but the
      // wallet is already on disk so there's no data loss.
      throw err;
    }
  } else {
    pollSkipped = true;
    if (!args.json && args.dryRun) process.stdout.write("\n[dry-run] skipping balance polling.\n");
    if (!args.json && args.noPoll) process.stdout.write("\n--no-poll set — skipping balance check.\n");
  }

  // 4. Print MCP config + next steps
  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          version: VERSION,
          address: wallet.address,
          privateKey: wallet.privateKey,
          imported: wallet.imported,
          source: wallet.source,
          gateway: args.gateway,
          network: args.testnet ? "base-sepolia" : "base-mainnet",
          maxSpendAtomic: args.maxSpend,
          balanceAtomic: balance.toString(),
          pollSkipped,
          paths,
          mcpConfig: buildMcpConfig(wallet.privateKey, args),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  printNextSteps(wallet.privateKey, wallet.address, paths, args);
}

// ---------------------------------------------------------------------------
// Wallet source resolution
// ---------------------------------------------------------------------------

interface ResolvedWallet {
  privateKey: Hex;
  address: Address;
  imported: boolean;
  source:
    | "generated"
    | "flag-key"
    | "flag-mnemonic"
    | "flag-key-stdin"
    | "flag-mnemonic-stdin"
    | "flag-key-file"
    | "flag-mnemonic-file"
    | "prompt-key"
    | "prompt-mnemonic"
    | "reused";
}

async function resolveWallet(args: Args): Promise<ResolvedWallet> {
  // Precedence: explicit flags (any source) > --reuse > existing-wallet prompt > generate
  if (args.key) {
    const account = privateKeyToAccount(args.key);
    return { privateKey: args.key, address: account.address, imported: true, source: "flag-key" };
  }
  if (args.keyStdin) {
    const raw = await readAllStdin();
    return { ...walletFromKey(raw, "flag-key-stdin"), imported: true };
  }
  if (args.keyFile) {
    const raw = readSecretFile(args.keyFile);
    return { ...walletFromKey(raw, "flag-key-file"), imported: true };
  }
  if (args.mnemonic) {
    return walletFromMnemonic(args.mnemonic, "flag-mnemonic");
  }
  if (args.mnemonicStdin) {
    const raw = await readAllStdin();
    return walletFromMnemonic(raw, "flag-mnemonic-stdin");
  }
  if (args.mnemonicFile) {
    const raw = readSecretFile(args.mnemonicFile);
    return walletFromMnemonic(raw, "flag-mnemonic-file");
  }
  if (args.reuse) {
    const existing = readExistingWallet(args.outDir);
    if (!existing) die(`--reuse: no wallet found at ${path.join(args.outDir, "wallet.json")}`);
    return { ...existing, imported: true, source: "reused" };
  }

  // Detect existing wallet, offer to reuse it
  const existing = readExistingWallet(args.outDir);
  if (existing && !args.json) {
    const reuse = await prompt(
      `Found an existing wallet at ${path.join(args.outDir, "wallet.json")}:\n` +
        `  address: ${existing.address}\n` +
        `Reuse it? [Y/n] `,
      "y",
    );
    if (reuse.toLowerCase() !== "n" && reuse.toLowerCase() !== "no") {
      return { ...existing, imported: true, source: "reused" };
    }
  }

  if (args.json) {
    // No interactive prompts in --json mode — just generate fresh.
    return generate();
  }

  const sourceChoice = await prompt(
    "Wallet source:\n" +
      "  [1] Generate a fresh Base wallet  (recommended for new users)\n" +
      "  [2] Use an existing private key   (0x-prefixed hex)\n" +
      "  [3] Use an existing BIP-39 mnemonic (12 or 24 words)\n" +
      "\n> ",
    "1",
  );

  if (sourceChoice === "2") {
    const raw = await prompt("Paste private key (0x-prefixed, 64 hex chars): ", "");
    return { ...walletFromKey(raw, "prompt-key"), imported: true };
  }
  if (sourceChoice === "3") {
    const raw = await prompt("Paste BIP-39 mnemonic (12 or 24 words): ", "");
    return walletFromMnemonic(raw, "prompt-mnemonic");
  }
  return generate();
}

function generate(): ResolvedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address, imported: false, source: "generated" };
}

function walletFromKey(raw: string, source: ResolvedWallet["source"]): ResolvedWallet {
  const trimmed = raw.trim().toLowerCase();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!isHex(prefixed) || prefixed.length !== 66) {
    die("private key must be a 0x-prefixed 32-byte hex string (66 chars total)");
  }
  const key = prefixed as Hex;
  const account = privateKeyToAccount(key);
  return { privateKey: key, address: account.address, imported: true, source };
}

function walletFromMnemonic(raw: string, source: ResolvedWallet["source"]): ResolvedWallet {
  const normalised = raw.trim().split(/\s+/).join(" ");
  const wordCount = normalised.split(" ").length;
  if (wordCount !== 12 && wordCount !== 24) {
    die(`mnemonic must be 12 or 24 words (got ${wordCount})`);
  }
  let account;
  try {
    account = mnemonicToAccount(normalised);
  } catch (err) {
    die(`invalid BIP-39 mnemonic: ${err instanceof Error ? err.message : String(err)}`);
  }
  // viem's mnemonicToAccount uses the standard ETH path m/44'/60'/0'/0/0
  // but doesn't expose the underlying private key directly on the public type.
  // Use the source object to read it.
  const hdAccount = account as { getHdKey?: () => { privateKey?: Uint8Array | null } };
  const hd = hdAccount.getHdKey?.();
  const pkBytes = hd?.privateKey;
  if (!pkBytes) die("could not derive private key from mnemonic");
  const privateKey = `0x${Buffer.from(pkBytes).toString("hex")}` as Hex;
  return { privateKey, address: account.address, imported: true, source };
}

// ---------------------------------------------------------------------------
// Funding prompt
// ---------------------------------------------------------------------------

async function promptFunding(args: Args): Promise<"onramp" | "manual" | "skip"> {
  if (args.json) return "manual"; // no interactivity in JSON mode

  const choice = await prompt(
    "How would you like to fund the wallet?\n" +
      "  [1] Buy USDC with card via Coinbase Onramp  (recommended)\n" +
      "  [2] Send USDC from another wallet           (CLI will print the address)\n" +
      "  [3] Skip — I'll fund it later               (use --reuse next time)\n" +
      "\n> ",
    "1",
  );
  if (choice === "2") return "manual";
  if (choice === "3") {
    if (!args.json) process.stdout.write("\nSkipping funding. Run again with --reuse once the wallet is funded.\n");
    process.exit(0);
  }
  return "onramp";
}

// ---------------------------------------------------------------------------
// Onramp URL
// ---------------------------------------------------------------------------

function buildOnrampUrl(address: Address, testnet: boolean): string {
  if (testnet) {
    return `https://faucet.circle.com/?address=${address}&chain=base-sepolia`;
  }
  const destinationWallets = JSON.stringify([{ address, blockchains: ["base"], assets: ["USDC"] }]);
  const params = new URLSearchParams({
    appId: CDP_PROJECT_ID,
    destinationWallets,
    defaultAsset: "USDC",
    defaultPaymentMethod: "CARD",
    presetCryptoAmount: String(ONRAMP_PRESET_USD),
  });
  return `https://pay.coinbase.com/buy/select-asset?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// On-chain balance polling
// ---------------------------------------------------------------------------

async function pollUntilFunded(address: Address, testnet: boolean, jsonMode: boolean): Promise<bigint> {
  const chain = testnet ? baseSepolia : base;
  const usdc = testnet ? USDC_BASE_SEPOLIA : USDC_BASE_MAINNET;
  const client = createPublicClient({ chain, transport: http() });
  const startedAt = Date.now();
  let lastHeartbeat = startedAt;
  let lastDisplay = "";
  let ticker = 0;

  while (true) {
    let balance = 0n;
    try {
      balance = (await client.readContract({
        address: usdc,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
    } catch {
      // RPC blip — keep polling
    }
    if (balance > 0n) {
      if (!jsonMode && lastDisplay.length > 0) stdout.write("\n");
      return balance;
    }

    const now = Date.now();
    if (!jsonMode) {
      const dots = ".".repeat((ticker++ % 3) + 1).padEnd(3, " ");
      const elapsedSec = Math.round((now - startedAt) / 1000);
      const display = `  waiting${dots}  (current: 0.000000 USDC, ${elapsedSec}s elapsed)`;
      if (display !== lastDisplay) {
        stdout.write(`\r${display}`);
        lastDisplay = display;
      }
      // Heartbeat: every 60s, print a permanent reminder line and clear the spinner
      if (now - lastHeartbeat >= POLL_HEARTBEAT_MS) {
        stdout.write(
          `\n  [${new Date().toISOString().slice(11, 19)}] still waiting — wallet is safe on disk, Ctrl-C is fine\n`,
        );
        lastHeartbeat = now;
        lastDisplay = "";
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface Paths {
  outDir: string;
  walletPath: string;
  configPath: string;
}

function persistWallet(privateKey: Hex, address: Address, args: Args): Paths {
  mkdirSync(args.outDir, { recursive: true });
  const walletPath = path.join(args.outDir, "wallet.json");
  const configPath = path.join(args.outDir, "claude-desktop.json");

  const walletDoc = {
    version: 1,
    network: args.testnet ? "base-sepolia" : "base-mainnet",
    address,
    privateKey,
    createdAt: new Date().toISOString(),
    warning:
      "This file contains your private key. Anyone with this file can spend the USDC at the address above. Keep it private. Back it up. Do not commit it.",
  };
  writeFileSync(walletPath, JSON.stringify(walletDoc, null, 2), { mode: 0o600 });
  try {
    chmodSync(walletPath, 0o600);
  } catch {
    // Best-effort on Windows
  }

  const config = buildMcpConfig(privateKey, args);
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  try {
    chmodSync(configPath, 0o600);
  } catch {
    // Best-effort on Windows
  }

  return { outDir: args.outDir, walletPath, configPath };
}

function buildMcpConfig(privateKey: Hex, args: Args) {
  return {
    mcpServers: {
      swarmapi: {
        command: "npx",
        args: ["-y", "@swarmapi/mcp"],
        env: {
          SWARMAPI_PRIVATE_KEY: privateKey,
          SWARMAPI_GATEWAY_URL: args.gateway,
          SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC: args.maxSpend,
        },
      },
    },
  };
}

function readExistingWallet(outDir: string): { privateKey: Hex; address: Address } | null {
  const walletPath = path.join(outDir, "wallet.json");
  if (!existsSync(walletPath)) return null;
  try {
    const raw = readFileSync(walletPath, "utf8");
    const parsed = JSON.parse(raw) as { privateKey?: string; address?: string };
    if (!parsed.privateKey || !parsed.address) return null;
    if (!isHex(parsed.privateKey) || parsed.privateKey.length !== 66) return null;
    if (!isHex(parsed.address) || parsed.address.length !== 42) return null;
    return { privateKey: parsed.privateKey as Hex, address: parsed.address as Address };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printNextSteps(privateKey: Hex, address: Address, paths: Paths, args: Args): void {
  const config = buildMcpConfig(privateKey, args);
  process.stdout.write("\n" + "─".repeat(60) + "\n");
  process.stdout.write("MCP config — paste the 'swarmapi' entry into your\n");
  process.stdout.write("MCP host's mcpServers object:\n\n");
  process.stdout.write(JSON.stringify(config, null, 2) + "\n");
  process.stdout.write("─".repeat(60) + "\n");

  process.stdout.write(`\nSaved to:    ${paths.configPath}\n`);
  process.stdout.write(`Wallet at:   ${paths.walletPath}\n`);

  process.stdout.write("\nClient config locations:\n");
  process.stdout.write("  Claude Desktop:\n");
  process.stdout.write("    macOS    ~/Library/Application Support/Claude/claude_desktop_config.json\n");
  process.stdout.write("    Windows  %APPDATA%\\Claude\\claude_desktop_config.json\n");
  process.stdout.write("    Linux    ~/.config/Claude/claude_desktop_config.json\n");
  process.stdout.write("  Cursor:    ~/.cursor/mcp.json\n");
  process.stdout.write("  Cline:     VSCode → Cline extension settings → MCP servers\n");
  process.stdout.write("  Zed:       ~/.config/zed/settings.json  (under context_servers)\n");

  process.stdout.write("\nNext steps:\n");
  process.stdout.write("  1. Merge the swarmapi block into your client's MCP config.\n");
  process.stdout.write("  2. Restart the client.\n");
  process.stdout.write("  3. Ask: \"Pull recent SEC filings for AAPL.\"\n");

  process.stdout.write("\n┌─ WALLET BACKUP ─────────────────────────────────────────────┐\n");
  process.stdout.write("│ The wallet's private key is BELOW. Anyone with it can spend │\n");
  process.stdout.write("│ the funds. Store it in a password manager (1Password, etc.) │\n");
  process.stdout.write("│ and DELETE this terminal scrollback when you're done.       │\n");
  process.stdout.write("└─────────────────────────────────────────────────────────────┘\n");
  process.stdout.write(`  address:      ${address}\n`);
  process.stdout.write(`  private key:  ${privateKey}\n`);
  process.stdout.write(`  network:      ${args.testnet ? "Base Sepolia (testnet)" : "Base mainnet"}\n`);
  process.stdout.write(`\nRe-run any time with: npx -y @swarmapi/setup --reuse\n`);
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp(): void {
  process.stdout.write(
    `@swarmapi/setup v${VERSION}

Interactive CLI that generates or imports a Base wallet, funds it via Coinbase
Onramp, and writes an MCP config block for Claude Desktop / Cursor / Cline / Zed.

Usage:
  npx -y @swarmapi/setup [flags]

Flags:
  -h, --help                 Show this message and exit.
  -v, --version              Print version and exit.
      --reuse                Reuse the wallet at ~/.swarmapi/wallet.json (skip generation).
      --testnet              Use Base Sepolia instead of Base mainnet.
      --no-poll              Skip on-chain balance polling.
      --no-open              Don't auto-open the browser for Coinbase Onramp.
      --dry-run              Generate wallet + config, skip Onramp and polling.
      --json                 Emit a single JSON object on stdout (no prompts).
      --gateway <url>        SwarmApi gateway URL (default: https://api.swarm-api.com).
      --max-spend <atomic>   Per-call USDC ceiling in 6-decimal atomic units (default: 100000 = $0.10).
      --out-dir <path>       Where to write wallet.json and claude-desktop.json (default: ~/.swarmapi).

Secret import (PREFER stdin / file — inline argv is visible in 'ps aux' + shell history):
      --key-stdin            Read 0x-prefixed 32-byte private key from stdin.
      --mnemonic-stdin       Read 12 or 24-word BIP-39 mnemonic from stdin.
      --key-file <path>      Read private key from a file (chmod 600 recommended).
      --mnemonic-file <path> Read mnemonic from a file (chmod 600 recommended).
      --key <hex>            DEPRECATED — exposed in process listing. Use --key-stdin.
      --mnemonic "..."       DEPRECATED — exposed in process listing. Use --mnemonic-stdin.

Examples:
  npx -y @swarmapi/setup
  npx -y @swarmapi/setup --reuse
  echo -n "$KEY" | npx -y @swarmapi/setup --key-stdin
  npx -y @swarmapi/setup --mnemonic-file ./seed.txt
  npx -y @swarmapi/setup --testnet --no-open
  npx -y @swarmapi/setup --json --dry-run

Environment fallbacks (used when matching flag is not set):
  SWARMAPI_GATEWAY_URL                  same as --gateway
  SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC same as --max-spend

The wallet's private key is saved to ~/.swarmapi/wallet.json (chmod 600) IMMEDIATELY
after generation, before any network activity, so Ctrl-C during polling is safe.
`,
  );
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

async function prompt(question: string, fallback: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer.length > 0 ? answer : fallback;
  } finally {
    rl.close();
  }
}

async function readAllStdin(): Promise<string> {
  if (stdin.isTTY) {
    die("stdin is a TTY — pipe the secret instead (e.g. echo -n \"$KEY\" | ... --key-stdin)");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function readSecretFile(filePath: string): string {
  if (!existsSync(filePath)) die(`secret file not found: ${filePath}`);
  // Best-effort permission check on POSIX — warn if the file is world-readable.
  try {
    const st = statSync(filePath);
    const mode = st.mode & 0o777;
    if (process.platform !== "win32" && (mode & 0o077) !== 0) {
      process.stderr.write(
        `⚠ ${filePath} has permissive mode ${mode.toString(8).padStart(3, "0")}.\n` +
          `  Run: chmod 600 ${filePath}\n`,
      );
    }
  } catch {
    // stat can fail on weird filesystems; non-fatal.
  }
  return readFileSync(filePath, "utf8");
}

function formatUsdc(atomic: bigint): string {
  const whole = atomic / 1_000_000n;
  const frac = atomic % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function banner(): void {
  process.stdout.write("\n");
  process.stdout.write("┌──────────────────────────────────────────────────────────┐\n");
  process.stdout.write(`│  SwarmApi setup v${VERSION.padEnd(40)} │\n`);
  process.stdout.write("│  Wallet → fund → MCP config for Claude / Cursor / etc.   │\n");
  process.stdout.write("└──────────────────────────────────────────────────────────┘\n");
  process.stdout.write("\n");
}
