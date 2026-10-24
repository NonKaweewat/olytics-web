// Minimal signed-cookie session, signed with HMAC via Web Crypto.
import { isRole, type Role } from "./roles";

export const SESSION_COOKIE = "olytics_session";
const MAX_AGE_SEC = 60 * 60 * 8;

export type Session = { user: string; role: Role };

// SESSION_SECRET is optional. When unset, a random key is generated once per
// server process, so everyone has to log in again after a restart. It lives on
// globalThis so the middleware and route handlers (separate bundles, same Node
// process — see middleware.ts runtime) share the same key.
const g = globalThis as { __olyticsSessionSecret?: string };

function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!g.__olyticsSessionSecret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    g.__olyticsSessionSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return g.__olyticsSessionSecret;
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

/** Cookie value: user.role.expiry.signature — the role is signed, so it cannot be edited. */
export async function createSession(s: Session): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  // "." separates the fields, so it must not appear inside the encoded user name.
  const payload = `${encodeURIComponent(s.user).replace(/\./g, "%2E")}.${s.role}.${exp}`;
  return { value: `${payload}.${await hmac(payload)}`, maxAge: MAX_AGE_SEC };
}

export async function verifySession(value: string | undefined): Promise<Session | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [user, role, exp, sig] = parts;
  if (!isRole(role) || Number(exp) < Date.now() / 1000) return null;
  if ((await hmac(`${user}.${role}.${exp}`)) !== sig) return null;
  return { user: decodeURIComponent(user), role };
}
