#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { executeLua } from "./aseprite.js";
import { LUA_DOCS } from "./docs.js";

const server = new McpServer({ name: "aseprite-mcp", version: "0.1.1" });

server.tool(
  "execute_aseprite_script",
  "Run a complete Aseprite Lua script headlessly (aseprite --batch --script). " +
    "Write the whole drawing/animation/export as one script instead of many small calls. " +
    "Call get_aseprite_lua_docs first if unsure about the API.",
  {
    lua_code: z.string().min(1).describe("Full Lua script to execute"),
    output_filename: z
      .string()
      .optional()
      .describe(
        "Expected output file (e.g. sprite.png). Absolute paths are used as-is; relative paths resolve against DEFAULT_OUTPUT_DIR (or the server's working directory). Missing directories are created. " +
          "The script itself must save it (e.g. spr:saveCopyAs(...)); this is used to verify the result.",
      ),
  },
  async ({ lua_code, output_filename }) => {
    try {
      const baseDir = resolve(process.env["DEFAULT_OUTPUT_DIR"]?.trim() || process.cwd());
      const outPath = output_filename
        ? isAbsolute(output_filename)
          ? output_filename
          : resolve(baseDir, output_filename)
        : undefined;
      if (outPath) mkdirSync(dirname(outPath), { recursive: true });

      // Expose the resolved path to the script as a global for convenience.
      const prelude = outPath
        ? `OUTPUT_PATH = ${JSON.stringify(outPath)}\n`
        : "";
      const result = await executeLua(prelude + lua_code);

      if (!result.ok || result.stderr.trim()) {
        return {
          isError: !result.ok,
          content: [
            {
              type: "text",
              text: `Script ${result.ok ? "finished with warnings" : "failed"}.\nstderr:\n${result.stderr.trim()}\nstdout:\n${result.stdout.trim()}`,
            },
          ],
        };
      }

      const lines = ["Script executed successfully."];
      if (result.stdout.trim()) lines.push(`stdout:\n${result.stdout.trim()}`);
      if (outPath) {
        lines.push(
          existsSync(outPath)
            ? `Output file: ${outPath}`
            : `Warning: expected output not found at ${outPath}. The script must save to OUTPUT_PATH (a global set for you) or that path.`,
        );
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      };
    }
  },
);

server.tool(
  "get_aseprite_lua_docs",
  "Return a compact cheat sheet of the Aseprite Lua API (Sprite, Layer, Cel, Image, Color, Palette, saveCopyAs).",
  {},
  async () => ({ content: [{ type: "text", text: LUA_DOCS }] }),
);

await server.connect(new StdioServerTransport());
