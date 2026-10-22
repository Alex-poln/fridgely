import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function walk(dir) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const file = dir + "/" + name.name;
    if (name.isDirectory()) await walk(file);
    else if (/\.(js|mjs)$/.test(file)) {
      const r = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
      });
      if (r.status !== 0) {
        console.error(r.stderr);
        process.exitCode = 1;
      }
    }
  }
}
await walk("src");
await walk("scripts");
await walk("supabase/functions");
const cfg = await import("../config.js");
if (cfg.config.supabaseAnonKey.startsWith("sb_secret_")) {
  console.error("Ein geheimer Supabase-Key darf nicht im Frontend stehen.");
  process.exitCode = 1;
}
if (!process.exitCode) console.log("JavaScript-Syntax erfolgreich geprüft.");
