#!/usr/bin/env node
/**
 * stdio entrypoint for the Ariadne MCP server.
 *
 * Nothing may be written to stdout here but JSON-RPC: a single stray line
 * corrupts the stream and the client drops the connection. Diagnostics go to
 * stderr, which MCP clients surface as server logs.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AriadneClient } from './client';
import { resolveConfig } from './config';
import { createServer } from './server';

/**
 * Walks up from the compiled file to find the app's package.json, so the
 * version reported in the MCP handshake tracks the release rather than a
 * constant someone has to remember to bump.
 */
function appVersion(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 4; depth += 1) {
    try {
      const raw = readFileSync(join(dir, 'package.json'), 'utf8');
      const parsed = JSON.parse(raw) as { name?: string; version?: string };
      if (parsed.name === 'ariadne' && parsed.version) return parsed.version;
    } catch {
      // Not here, keep walking.
    }
    dir = join(dir, '..');
  }
  return '0.0.0';
}

async function main(): Promise<void> {
  const config = resolveConfig(process.env);
  const server = createServer(new AriadneClient(config), appVersion());
  await server.connect(new StdioServerTransport());
  process.stderr.write(`ariadne-mcp ready, talking to ${config.baseUrl}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`ariadne-mcp failed to start: ${String(error)}\n`);
  process.exit(1);
});
