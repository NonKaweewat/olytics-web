"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = __dirname;
const dashboardRoot = "/home/ec2-user/olist-dashboard";

function readEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const equal = line.indexOf("=");
    if (equal <= 0) continue;
    values[line.slice(0, equal).trim()] = line.slice(equal + 1).trim();
  }
  return values;
}

const shared = readEnv(path.join(dashboardRoot, ".env"));
const localPath = path.join(app, ".env.local");
const local = fs.existsSync(localPath) ? readEnv(localPath) : {};
const secretId = shared.REDSHIFT_SECRET_ID;

if (!secretId) throw new Error("Redshift secret identifier is not configured");

const env = {
  ...process.env,
  ...shared,
  ...local,
  DATA_SOURCE: "redshift",
  AWS_REGION: shared.REDSHIFT_REGION ?? process.env.AWS_REGION ?? "us-east-1",
  OLYTICS_REDSHIFT_SECRET: `{{resolve:secretsmanager:${secretId}:SecretString}}`,
};

const child = spawn("/usr/bin/python3", [path.join(app, "bin", "asm-exec"), "--", "/usr/bin/node-22", path.join(app, "run-web.js")], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
