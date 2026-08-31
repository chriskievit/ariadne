/**
 * Wires the tool registry onto an MCP server. Kept separate from index.ts so
 * tests can drive it over an in-memory transport instead of a real stdio pipe.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AriadneClient } from './client';
import { TOOLS, type ToolDefinition } from './tools';

export const SERVER_NAME = 'ariadne';

const INSTRUCTIONS = `Ariadne is a personal, local-only work dashboard. Use these tools to see what is
on the plate and to move items through it: start, complete, park, snooze, plan.

Two things to respect:

- completing an item needs the hours it took. Ask the user, do not estimate for
  them.
- Ariadne never writes back to GitHub or Azure DevOps. Closing an item here does
  not close the pull request or work item it came from.`;

export function createServer(client: AriadneClient, version = '0.0.0'): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version },
    { instructions: INSTRUCTIONS },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      // The SDK has already validated args against inputSchema by this point.
      async (args: unknown) => {
        try {
          const result = await tool.run(client, args as Record<string, unknown>);
          return { content: [{ type: 'text' as const, text: format(result, tool) }] };
        } catch (error) {
          // Returned rather than thrown: a 400 from Ariadne is a fact the model
          // should read and act on, not a transport failure that kills the call.
          return {
            isError: true,
            content: [{ type: 'text' as const, text: message(error) }],
          };
        }
      },
    );
  }

  return server;
}

function format(result: unknown, tool: ToolDefinition): string {
  // An empty read is an answer, not a confirmation: GET /api/timer/running
  // returns null when nothing is running, and saying "Done." there would tell
  // the model an action succeeded rather than that the answer is "nothing".
  if (result === null || result === undefined) {
    return tool.annotations.readOnlyHint ? 'null' : 'Done.';
  }
  return JSON.stringify(result, null, 2);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
