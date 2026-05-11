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

```bash
npx smithery@latest auth login
npx smithery@latest mcp publish ./swarmapi.mcpb -n YOUR_NAMESPACE/swarm-api
```

Use the namespace you already use on Smithery. Server ID slug rules: 3–39 chars, letters, numbers, hyphens, underscores.
