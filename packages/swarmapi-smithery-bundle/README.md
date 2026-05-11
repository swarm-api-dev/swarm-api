# Smithery (stdio) bundle for SwarmApi

The page **https://smithery.ai/new** only accepts **HTTPS** MCP URLs. SwarmApi ships as **stdio** (`npx @swarm-api/mcp`), so list it by publishing an **MCPB** file instead.

## Build `.mcpb`

From repo root:

```bash
cd packages/swarmapi-smithery-bundle
npx @anthropic-ai/mcpb validate manifest.json
npx @anthropic-ai/mcpb pack . swarmapi.mcpb
```

## Publish on Smithery

Qualified name is **`namespace/server-id`**. Your namespace is **`swarm-api`** — pick a short server slug (example below uses **`swarmapi`**).

```bash
npx smithery@latest auth login
npx smithery@latest mcp publish ./swarmapi.mcpb -n swarm-api/swarmapi
```

Server ID rules: 3–39 characters, start with a letter, only letters, numbers, hyphens, underscores. Use another slug after the slash if `swarmapi` is already taken.
