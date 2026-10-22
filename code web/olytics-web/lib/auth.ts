// Minimal signed-cookie session. Uses Web Crypto so it works in both the
// Edge middleware and Node route handlers.
export const SESSION_COOKIE = "olytics_session";
const MAX_AGE_SEC = 60 * 60 * 8;

function secret(): string {
  return process.env.SESSION_SECRET || "dev-only-insecure-secret";
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(user: string): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${encodeURIComponent(user)}.${exp}`;
  return { value: `${payload}.${await hmac(payload)}`, maxAge: MAX_AGE_SEC };
}

export async function verifySession(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [user, exp, sig] = parts;
  if (Number(exp) < Date.now() / 1000) return null;
  if ((await hmac(`${user}.${exp}`)) !== sig) return null;
  return decodeURIComponent(user);
}

export function checkCredentials(user: string, pass: string): boolean {
  const u = process.env.DASHBOARD_USER || "admin";
  const p = process.env.DASHBOARD_PASSWORD;
  return Boolean(p) && user === u && pass === p;
}
