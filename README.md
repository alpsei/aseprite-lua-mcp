# aseprite-lua-mcp [![Reviewed by HOL Guard](https://img.shields.io/badge/HOL_Guard%20|%20Aseprite_Lua_MCP-2E5AAC?logo=shield&logoColor=white)](https://hol.org/guard/extensions/mcp.aseprite)

<p align="center">
  <img src=".git/assets/aseprite_logo.jpg" alt="Aseprite Lua MCP Logo" width="200" />
</p>

A lightweight [Model Context Protocol](https://modelcontextprotocol.io) server that lets LLM agents create pixel art and animations in [Aseprite](https://www.aseprite.org) by writing **one complete Lua script** and running it headlessly with `aseprite --batch --script`.

## What's New in v0.2.0

- **Native Image Responses:** Scripts returning output images now automatically send inline base64 `image/png` content blocks for direct preview in supported clients.
- **Existing Sprite Editing:** Added `input_filename` parameter to load existing sprites before executing scripts.
- **Documentation Filtering:** `get_aseprite_lua_docs` now supports filtering by `class_name` (e.g., `Cel`, `Sprite`) or search terms to reduce token usage.
- **Configurable Output Directory:** Environment variable `ASEPRITE_OUTPUT_DIR` (with `DEFAULT_OUTPUT_DIR` fallback).
- **Startup Health Checks:** Auto-detects and logs Aseprite binary paths on startup.

## Why scripts instead of per-pixel tools?

Most Aseprite integrations expose one IPC/tool call per operation (put pixel, draw line, add frame...). Every call costs tokens and a round-trip. This server exposes a single "run this script" tool instead:

| Approach | Tool calls for a 32x32 sprite | Token usage |
|---|---|---|
| One MCP call per pixel/shape | hundreds | very high, rate-limit prone |
| **One Lua script (this server)** | **1** | **90%+ lower** |

A Lua loop replaces thousands of tokens of repeated calls, and when something fails the agent fixes a single script and re-runs it.

## Quick start

Requires Node.js 18+ and [Aseprite](https://www.aseprite.org) installed locally. No clone or build needed; `npx` downloads the package on demand.

### Claude Code

```bash
claude mcp add aseprite -- npx -y aseprite-lua-mcp
```

With environment variables:

```bash
claude mcp add aseprite \
  -e ASEPRITE_PATH="C:/Program Files/Aseprite/Aseprite.exe" \
  -e DEFAULT_OUTPUT_DIR="C:/Users/me/sprites" \
  -- npx -y aseprite-lua-mcp
```

> The `--` before `npx` is required so that `-y` is passed to `npx` and not parsed by `claude mcp add`.

### Claude Desktop / `.claude.json`

Add this to `claude_desktop_config.json` (or the `mcpServers` section of `.claude.json`):

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "npx",
      "args": ["-y", "aseprite-lua-mcp"],
      "env": {
        "ASEPRITE_PATH": "C:/Program Files/Aseprite/Aseprite.exe",
        "DEFAULT_OUTPUT_DIR": "C:/Users/me/sprites"
      }
    }
  }
}
```

`env` is optional. Restart the client after editing the config.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `ASEPRITE_PATH` | Path to the Aseprite executable. The server errors if it is set but the file doesn't exist. | Auto-detected in common Windows, macOS and Linux locations (including Steam), then `PATH` |
| `DEFAULT_OUTPUT_DIR` | Base directory for a relative `output_filename`. | `process.cwd()` |

Absolute `output_filename` values are used as-is. The output file's parent directory is created automatically.

## Tools

### `execute_aseprite_script`

| Parameter | Type | Description |
|---|---|---|
| `lua_code` | string (required) | Complete Lua script to run. |
| `output_filename` | string (optional) | Expected output file, e.g. `sprite.png`. Absolute, or relative to `DEFAULT_OUTPUT_DIR` / `process.cwd()`. |

The code is written to a temporary `.lua` file, run with `aseprite --batch --script` (60 second timeout), and the temp file is always deleted. The result contains stdout and stderr (syntax and runtime errors with line numbers). When `output_filename` is given, the global `OUTPUT_PATH` (the resolved absolute path) is available inside the script, and the server reports whether the file was actually created. The script is responsible for saving it.

```lua
local spr = Sprite(16, 16)
local img = spr.cels[1].image
local c = Color{ r=220, g=40, b=40 }
for y=0,15 do for x=0,15 do
  if (x-8)^2 + (y-8)^2 <= 36 then img:putPixel(x, y, c) end
end end
spr:saveCopyAs(OUTPUT_PATH)
```

### `get_aseprite_lua_docs`

Returns a compact cheat sheet of the Aseprite Lua API (Sprite, Layer, Cel, Image, Color, Palette, `saveCopyAs`) so the agent doesn't need to guess.

## Recommended `.clauderules`

To get immediate execution with no explanatory prose, and the biggest token savings, put this in a `.clauderules` file (or your `CLAUDE.md`) in your project:

```markdown
# aseprite-lua-mcp rules

- ALWAYS generate pixel art by writing a complete Lua script and executing it with `execute_aseprite_script`. Never draw pixel by pixel or issue per-operation calls.
- DO NOT explain your drawing strategy or write introductory/concluding prose text. Execute the tool IMMEDIATELY with the generated script.
- If you are unsure about the Aseprite Lua API, call `get_aseprite_lua_docs` once before writing the script.
- Put everything in a single script: create the sprite, draw (use loops and helper functions for lines, circles, rects, fills), set palette/layers/frames/tags, and export with `spr:saveCopyAs(...)`.
- Pass `output_filename` and save to the `OUTPUT_PATH` global inside the script.
- On error, read the stderr line number, fix the script, and re-run the whole script; NEVER fall back to per-pixel commands.
- Use small canvases (16x16 to 64x64) and scale up only for previews.
```

## Development

```bash
git clone <this repo> aseprite-lua-mcp
cd aseprite-lua-mcp
npm install
npm run build
node dist/index.js
```

## Security note

This server executes arbitrary Lua inside Aseprite, which can read and write files and run OS commands (`os.execute`). Only connect it to agents you trust.

## License

MIT
