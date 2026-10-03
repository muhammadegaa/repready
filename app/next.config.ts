import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { NextConfig } from "next";

// Temporary build diagnostics. `qrcode` is reported "not found" on Vercel although it is declared and locked, and package.json
// scripts and vercel.json are not being honoured there. next.config.ts is the one file every build loads, so it reports what
// the build environment actually contains. It changes nothing. Prints once per build.
function buildCheck() {
  if (process.env.BUILD_CHECK_DONE) return;
  process.env.BUILD_CHECK_DONE = "1";
  const cwd = process.cwd();
  const say = (m: string) => console.log(`[build-check] ${m}`);
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> };
    const req = createRequire(join(cwd, "package.json"));
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const missing = declared.filter((n) => { try { req.resolve(`${n}/package.json`); return false; } catch (e) { return (e as { code?: string }).code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" && !existsSync(join(cwd, "node_modules", n)); } });
    const hidden = join(cwd, "node_modules", ".package-lock.json");
    const hiddenHasQr = existsSync(hidden) && readFileSync(hidden, "utf8").includes('"node_modules/qrcode"');
    say(`cwd=${cwd} node=${process.version} NODE_ENV=${process.env.NODE_ENV} VERCEL=${process.env.VERCEL ?? "unset"} agent="${process.env.npm_config_user_agent ?? "?"}"`);
    say(`package.json here: qrcode=${pkg.dependencies?.qrcode ?? "ABSENT"} scripts.build="${pkg.scripts?.build}" scripts.vercel-build="${pkg.scripts?.["vercel-build"] ?? "(none)"}"`);
    say(`files here: ${readdirSync(cwd).join(", ")}`);
    say(`node_modules: exists=${existsSync(join(cwd, "node_modules"))} modified=${existsSync(join(cwd, "node_modules")) ? statSync(join(cwd, "node_modules")).mtime.toISOString() : "-"} qrcode_dir=${existsSync(join(cwd, "node_modules", "qrcode"))} hidden_lockfile_lists_qrcode=${hiddenHasQr}`);
    say(`one level up: ${readdirSync(join(cwd, "..")).slice(0, 25).join(", ")}; node_modules there=${existsSync(join(cwd, "..", "node_modules"))}`);
    say(missing.length ? `NOT resolvable from here: ${missing.join(", ")}` : `all ${declared.length} declared dependencies resolve`);
  } catch (e) {
    say(`probe failed: ${(e as Error).message}`);
  }
}

const config = (phase: string): NextConfig => {
  if (phase === PHASE_PRODUCTION_BUILD) buildCheck();
  return {
    // A coach can upload a spreadsheet to be read; the default limit is 1 MB. Vercel itself allows 4.5 MB.
    experimental: { serverActions: { bodySizeLimit: "3mb" } },
  };
};

export default config;
