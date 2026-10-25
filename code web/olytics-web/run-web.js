"use strict";

const path = require("path");
const { spawn } = require("child_process");

let secret;
try {
  secret = JSON.parse(process.env.OLYTICS_REDSHIFT_SECRET ?? "");
} catch {
  throw new Error("Redshift credentials could not be resolved");
}
if (!secret.username || !secret.password) throw new Error("Redshift credentials are incomplete");

const env = { ...process.env, REDSHIFT_USER: secret.username, REDSHIFT_PASSWORD: secret.password };
delete env.OLYTICS_REDSHIFT_SECRET;
secret = undefined;

const app = __dirname;
const child = spawn("/usr/bin/node-22", [path.join(app, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", "3002"], {
  cwd: app,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
