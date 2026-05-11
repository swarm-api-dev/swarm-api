#!/usr/bin/env node
/**
 * Placeholder entry for MCPB tooling. Hosts launch SwarmApi via manifest `mcp_config`
 * (`npx -y @swarm-api/mcp`) with env from user_config — not this file.
 */
process.stderr.write(
  "SwarmApi MCP is started via npx @swarm-api/mcp (see manifest mcp_config).\n",
);
process.exit(1);
