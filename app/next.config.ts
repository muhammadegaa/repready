import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { NextConfig } from "next";

// Temporary build diagnostics for Vercel, where `qrcode` was reported as not found although it is declared and locked.
// next.config.ts is the one file every build loads, even when package.json scripts and vercel.json are not honoured.
// On Vercel only: print what the build can see. It does not change anything: a repair here would run with NODE_ENV=production and skip dev dependencies.
function vercelCheck() {
  if (!process.env.VERCEL) return;
  const cwd = process.cwd();
  const req = createRequire(join(cwd, "package.json"));
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> };
  const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const resolves = (n: string) => { try { req.resolve(`${n}/package.json`); return true; } catch (e) { return (e as { code?: string }).code === "ERR_PACKAGE_PATH_NOT_EXPORTED" || existsSync(join(cwd, "node_modules", n)); } };
  console.log(`[build-check] cwd=${cwd} node=${process.version} npm_config_user_agent=${process.env.npm_config_user_agent ?? "?"}`);
  console.log(`[build-check] this package.json has qrcode=${pkg.dependencies?.qrcode ?? "NO"} build="${pkg.scripts?.build}" vercel-build="${pkg.scripts?.["vercel-build"] ?? "(none)"}"`);
  console.log(`[build-check] entries in cwd: ${readdirSync(cwd).join(", ")}`);
  console.log(`[build-check] node_modules/qrcode exists=${existsSync(join(cwd, "node_modules", "qrcode"))}; parent node_modules exists=${existsSync(join(cwd, "..", "node_modules"))}`);
  const missing = declared.filter((n) => !resolves(n));
  console.log(missing.length ? `[build-check] NOT resolvable from here: ${missing.join(", ")}` : `[build-check] all ${declared.length} declared dependencies resolve`);
}
vercelCheck();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
