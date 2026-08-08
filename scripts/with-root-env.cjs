const { spawn } = require("node:child_process");
const path = require("node:path");
const { parseProjectEnv } = require("@expo/env");

const projectRoot = path.resolve(__dirname, "..");
const rootEnv = parseProjectEnv(projectRoot, { silent: true }).env;

for (const key of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!process.env[key] && rootEnv[key]) process.env[key] = rootEnv[key];
}

const expoBin = path.resolve(projectRoot, "node_modules/.bin/expo");
const child = spawn(expoBin, process.argv.slice(2), {
  cwd: path.resolve(projectRoot, "apps/universal"),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
