// Runs before `next build` on Vercel. Prints where the build is running and checks that every declared dependency
// resolves from here. If one does not, it reinstalls from the lockfile once and checks again, so a bad install or a
// stale cache fails with a clear message (or heals) instead of "Module not found" deep in the bundler.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const require = createRequire(join(process.cwd(), "package.json"));

const missing = () =>
  names.filter((n) => {
    try { require.resolve(`${n}/package.json`); return false; }
    catch (e) {
      // Some packages hide package.json behind "exports"; fall back to the folder existing.
      return !(e && e.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") && !existsSync(join(process.cwd(), "node_modules", n));
    }
  });

const npmVersion = (() => { try { return execSync("npm -v").toString().trim(); } catch { return "unknown"; } })();
console.log(`[ensure-deps] cwd=${process.cwd()} node=${process.version} npm=${npmVersion} VERCEL=${process.env.VERCEL ?? "no"}`);
console.log(`[ensure-deps] node_modules at ${existsSync("node_modules") ? "./node_modules" : "(none here)"}; qrcode at ${(() => { try { return dirname(require.resolve("qrcode/package.json")); } catch { return "NOT RESOLVABLE"; } })()}`);

let gone = missing();
if (gone.length) {
  console.error(`[ensure-deps] ${gone.length} declared dependencies do not resolve: ${gone.join(", ")}. Running npm ci once.`);
  execSync("npm ci", { stdio: "inherit" });
  gone = missing();
  if (gone.length) {
    console.error(`[ensure-deps] Still missing after npm ci: ${gone.join(", ")}. Failing the build here on purpose.`);
    process.exit(1);
  }
  console.log("[ensure-deps] Dependencies restored.");
} else {
  console.log(`[ensure-deps] All ${names.length} declared dependencies resolve.`);
}
