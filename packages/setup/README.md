# @swarm-api/setup

One-shot CLI for [SwarmApi](https://swarm-api.com). Generates **or imports** a Base wallet, walks you through funding with **USDC on Base** (send from any wallet, withdraw from an exchange, or testnet faucet), polls for the deposit, and writes a ready-to-paste MCP config block for Claude Desktop, Cursor, Cline, Zed, or any other MCP client.

Also listed on **[Smithery](https://smithery.ai/servers/swarm-api/swarmapi)** alongside `@swarm-api/mcp`.

The whole flow runs without SwarmApi signups or API keys. Just `npx` it.

```bash
npx -y @swarm-api/setup
```

That's it. The CLI walks you through the rest.

**Note:** Coinbase [Hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/generating-onramp-url) needs a **server-generated `sessionToken`**. This CLI never embeds CDP keys in the package. For **card checkout**, set **`SWARMAPI_ONRAMP_PROXY_SECRET`** and deploy **`POST /v1/onramp/session`** on your gateway (see SwarmApi gateway); the funding menu then offers **[2] Card checkout**. Otherwise use **send USDC on Base** or Coinbase **Withdraw → Base**.

---

## What it produces

Two files, both in `~/.swarmapi/` with `chmod 600`:

| File | Contents |
| --- | --- |
| `wallet.json` | Address, private key, network, creation timestamp. The single source of truth for your agent's hot wallet. |
| `claude-desktop.json` | A drop-in MCP `mcpServers.swarmapi` block referencing the key above, the gateway URL, and a per-call spend ceiling. Paste it into your client's config. |

The key is persisted **immediately after generation, before any network calls** — Ctrl-C during balance polling is always safe.

---

## Flows

### 1. Generate fresh + fund (default)

```bash
npx -y @swarm-api/setup
```

Generates a new Base wallet, prompts for how to fund (send USDC on Base, optional link to coinbase.com, or skip), polls until USDC lands, prints the MCP config block, and reminds you to back up the private key.

### 2. Bring your own private key

```bash
# Recommended — secret never hits argv or shell history:
echo -n "$YOUR_PRIVATE_KEY" | npx -y @swarm-api/setup --key-stdin

# Or from a file (chmod 600 it first):
npx -y @swarm-api/setup --key-file ~/.secrets/swarmapi-key.txt
```

Imports an existing Base EOA. You can still use the funding prompts or `--no-poll`. Still polls for the USDC balance unless you pass `--no-poll`.

> `--key <hex>` and `--mnemonic "..."` still work for backwards compatibility but are **discouraged** — argv is visible to every process on the box via `ps aux` and is logged to shell history. The CLI prints a warning when you use them.

### 3. Bring your own BIP-39 mnemonic

```bash
echo -n "word1 word2 ... word12" | npx -y @swarm-api/setup --mnemonic-stdin
# or
npx -y @swarm-api/setup --mnemonic-file ~/.secrets/swarmapi-seed.txt
```

Derives the address at the standard Ethereum path `m/44'/60'/0'/0/0`. Accepts 12 or 24-word mnemonics.

### 4. Reuse a previously-generated wallet

```bash
npx -y @swarm-api/setup --reuse
```

Loads `~/.swarmapi/wallet.json` and re-emits the MCP config block. Useful after changing gateway URL or spend ceiling.

### 5. Testnet (Base Sepolia)

```bash
npx -y @swarm-api/setup --testnet
```

Targets Base Sepolia + the [Circle USDC faucet](https://faucet.circle.com/). Good for development.

### 6. Scripted / non-interactive

```bash
npx -y @swarm-api/setup --json --no-poll
```

Skips every interactive prompt, generates a wallet, prints a single JSON object to stdout, and exits. Perfect for CI or one-shot agent provisioning.

---

## All flags

```
-h, --help                 Show usage.
-v, --version              Print version.
    --reuse                Reuse the wallet at ~/.swarmapi/wallet.json.
    --testnet              Use Base Sepolia instead of Base mainnet.
    --no-poll              Skip on-chain balance polling.
    --no-open              Don't auto-open the browser (faucet / coinbase.com).
    --dry-run              Generate wallet + config, skip funding helpers and polling.
    --json                 Emit a single JSON object (no prompts).
    --gateway <url>        SwarmApi gateway URL (default: https://api.swarm-api.com).
    --max-spend <atomic>   Per-call USDC ceiling, atomic 6-dec USDC (default: 100000 = $0.10).
    --out-dir <path>       Where to write wallet.json and claude-desktop.json.

Secret import — prefer stdin / file:
    --key-stdin            Read 0x-prefixed 32-byte private key from stdin.
    --mnemonic-stdin       Read 12 or 24-word BIP-39 mnemonic from stdin.
    --key-file <path>      Read private key from a file (chmod 600 recommended).
    --mnemonic-file <path> Read mnemonic from a file (chmod 600 recommended).
    --key <hex>            DEPRECATED — exposed in 'ps aux' and shell history.
    --mnemonic "..."       DEPRECATED — exposed in 'ps aux' and shell history.
```

Environment fallbacks (used when the matching flag isn't passed):

| Env var | Maps to |
| --- | --- |
| `SWARMAPI_GATEWAY_URL` | `--gateway` |
| `SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC` | `--max-spend` |

Optional — card checkout when your gateway exposes `POST /v1/onramp/session`:

| Env var | Purpose |
| --- | --- |
| `SWARMAPI_ONRAMP_PROXY_SECRET` | Bearer token sent to the gateway (required for menu **[2]**). Never commit. |
| `SWARMAPI_ONRAMP_SESSION_URL` | Override session URL (default: `<SWARMAPI_GATEWAY_URL>/v1/onramp/session`). |
| `SWARMAPI_ONRAMP_PAYMENT_AMOUNT` | Fiat preset (default `5.00`). |
| `SWARMAPI_ONRAMP_PAYMENT_CURRENCY` | Default `USD`. |
| `SWARMAPI_ONRAMP_PURCHASE_CURRENCY` | Default `USDC`. |
| `SWARMAPI_ONRAMP_DESTINATION_NETWORK` | Default `base`. |

---

## Client config paths

| Client | Location |
| --- | --- |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Cline | VS Code → Cline extension settings → MCP servers |
| Zed | `~/.config/zed/settings.json` (`context_servers`) |

Paste the `swarmapi` object from `~/.swarmapi/claude-desktop.json` into the host's `mcpServers` (or `context_servers` for Zed) and restart.

---

## Security model

- The wallet is a Base EOA. The CLI uses [viem](https://viem.sh/) to generate / derive / sign — no custom crypto.
- The private key sits in `~/.swarmapi/wallet.json` with `chmod 600` (POSIX). On Windows, the file inherits the parent directory ACL. Treat the directory as you would `~/.ssh/`.
- Use a **fresh hot wallet** — don't import your main mainnet treasury. The MCP server has the key in process memory whenever it runs.
- Cap your spend two ways:
  - `--max-spend` (refuses any 402 challenge above this per-call ceiling, even if signed accidentally).
  - The wallet's USDC balance itself (an empty wallet can't sign for anything).
- **Importing secrets safely**: argv is visible to every process running as the same user (`ps auxww`) and most shells persist it to history. Use `--key-stdin` / `--mnemonic-stdin` (pipe), `--key-file` / `--mnemonic-file` (chmod 600 file), or just let the CLI prompt you interactively. The deprecated `--key <hex>` / `--mnemonic "..."` forms still work but emit a warning.

---

## License

MIT.
