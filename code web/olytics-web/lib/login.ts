import "server-only";
import { cognitoNewPassword, cognitoSignIn, type CognitoResult } from "./cognito";
import { isRole, type Role } from "./roles";

// Who may log in, and with which role.
//   AUTH_PROVIDER=local   (default) accounts from DASHBOARD_USERS — for local testing / mock data
//   AUTH_PROVIDER=cognito Amazon Cognito user pool; role = the user's Cognito group (lib/cognito.ts)

export type LoginResult = CognitoResult;

export function authProvider(): "local" | "cognito" {
  return process.env.AUTH_PROVIDER === "cognito" ? "cognito" : "local";
}

type Account = { user: string; password: string; role: Role };

/**
 * Accounts from DASHBOARD_USERS="user:password:role,user2:password2:role2".
 * DASHBOARD_USER / DASHBOARD_PASSWORD still work and give an admin account.
 */
function localAccounts(): Account[] {
  const list: Account[] = [];
  for (const entry of (process.env.DASHBOARD_USERS ?? "").split(",")) {
    const [user, password, role] = entry.trim().split(":");
    if (user && password && isRole(role)) list.push({ user, password, role });
    else if (entry.trim()) console.warn(`[olytics] ignoring bad DASHBOARD_USERS entry for "${user ?? ""}"`);
  }
  if (process.env.DASHBOARD_PASSWORD) {
    list.push({ user: process.env.DASHBOARD_USER || "admin", password: process.env.DASHBOARD_PASSWORD, role: "admin" });
  }
  return list;
}

export async function signIn(username: string, password: string): Promise<LoginResult> {
  if (authProvider() === "cognito") return cognitoSignIn(username, password);
  const a = localAccounts().find((x) => x.user === username && x.password === password);
  return a ? { kind: "ok", user: a.user, role: a.role } : { kind: "error", status: 401, message: "Invalid username or password" };
}

export async function setNewPassword(username: string, newPassword: string, session: string): Promise<LoginResult> {
  if (authProvider() !== "cognito") return { kind: "error", status: 400, message: "Not supported for local accounts" };
  return cognitoNewPassword(username, newPassword, session);
}
