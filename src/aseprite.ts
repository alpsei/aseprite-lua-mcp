import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const EXEC_TIMEOUT_MS = 60_000;

function candidatePaths(): string[] {
  switch (process.platform) {
    case "win32": {
      const pf = process.env["ProgramFiles"] ?? "C:\\Program Files";
      const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
      return [
        join(pf, "Aseprite", "Aseprite.exe"),
        join(pf86, "Aseprite", "Aseprite.exe"),
        join(pf86, "Steam", "steamapps", "common", "Aseprite", "Aseprite.exe"),
        join(pf, "Steam", "steamapps", "common", "Aseprite", "Aseprite.exe"),
      ];
    }
    case "darwin":
      return [
        "/Applications/Aseprite.app/Contents/MacOS/aseprite",
        join(homedir(), "Applications/Aseprite.app/Contents/MacOS/aseprite"),
        join(homedir(), "Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite"),
      ];
    default:
      return [
        "/usr/bin/aseprite",
        "/usr/local/bin/aseprite",
        "/snap/bin/aseprite",
        join(homedir(), ".local/bin/aseprite"),
        join(homedir(), ".steam/steam/steamapps/common/Aseprite/aseprite"),
      ];
  }
}

/** Resolve the Aseprite executable: ASEPRITE_PATH first, then well-known locations, then PATH. */
export function findAseprite(): string {
  const override = process.env["ASEPRITE_PATH"];
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`ASEPRITE_PATH is set but does not exist: ${override}`);
    }
    return override;
  }
  for (const p of candidatePaths()) {
    if (existsSync(p)) return p;
  }
  // Fall back to PATH lookup; execFile will report ENOENT if missing.
  return process.platform === "win32" ? "Aseprite.exe" : "aseprite";
}

export interface RunResult {
  stdout: string;
  stderr: string;
  ok: boolean;
}

function run(exe: string, args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      exe,
      args,
      { timeout: EXEC_TIMEOUT_MS, cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              `Aseprite executable not found (${exe}). Install Aseprite or set the ASEPRITE_PATH environment variable.`,
            ),
          );
          return;
        }
        const timedOut = error && (error as { killed?: boolean }).killed;
        resolve({
          stdout: stdout.toString(),
          stderr: timedOut
            ? `${stderr}\nScript timed out after ${EXEC_TIMEOUT_MS / 1000}s`
            : stderr.toString(),
          ok: !error,
        });
      },
    );
  });
}

/**
 * Write `luaCode` to a temp file and run it with `aseprite --batch --script`.
 * The temp directory is always removed afterwards.
 */
export async function executeLua(luaCode: string, cwd?: string): Promise<RunResult> {
  const exe = findAseprite();
  const dir = await mkdtemp(join(tmpdir(), "aseprite-mcp-"));
  const scriptPath = join(dir, "script.lua");
  try {
    await writeFile(scriptPath, luaCode, "utf8");
    return await run(exe, ["--batch", "--script", scriptPath], cwd);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
