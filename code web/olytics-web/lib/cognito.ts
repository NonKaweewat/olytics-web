import "server-only";
import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { JwtBaseError } from "aws-jwt-verify/error";
import { isRole, ROLES, type Role } from "./roles";

// Amazon Cognito sign-in (AUTH_PROVIDER=cognito).
// The user pool holds the accounts; a user's role is the Cognito *group* they
// belong to, and groups are named exactly like the roles in lib/roles.ts.
// Uses USER_PASSWORD_AUTH from the server, so the existing login page works
// over plain HTTP on EC2 (the Hosted UI would need an HTTPS callback URL).
// InitiateAuth needs no IAM credentials, so Learner Lab's LabRole limits don't apply.

export type CognitoResult =
  | { kind: "ok"; user: string; role: Role }
  | { kind: "new-password"; session: string }
  | { kind: "error"; status: number; message: string };

function config() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  // the region is the prefix of the pool id, e.g. us-east-1_AbCdEf
  const region = process.env.COGNITO_REGION || userPoolId?.split("_")[0];
  if (!userPoolId || !clientId || !region) {
    throw new Error("Cognito is not configured: set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID");
  }
  return { userPoolId, clientId, region, clientSecret: process.env.COGNITO_CLIENT_SECRET || undefined };
}

let client: CognitoIdentityProviderClient | null = null;
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function cognito() {
  const c = config();
  client ??= new CognitoIdentityProviderClient({ region: c.region });
  verifier ??= CognitoJwtVerifier.create({ userPoolId: c.userPoolId, clientId: c.clientId, tokenUse: "id" });
  return { ...c, client, verifier };
}

/** Required only when the app client has a secret: Base64(HMAC-SHA256(secret, username + clientId)). */
function secretHash(username: string, clientId: string, secret?: string): string | undefined {
  return secret ? createHmac("sha256", secret).update(username + clientId).digest("base64") : undefined;
}

// When a user is in several groups, the most privileged role wins.
const PRECEDENCE: Role[] = ["admin", "analyst", "executive", "finance", "category", "seller", "logistics", "cx", "marketing"];

async function sessionFromTokens(result: AuthenticationResultType | undefined): Promise<CognitoResult> {
  if (!result?.IdToken) return { kind: "error", status: 502, message: "Cognito did not return a token" };
  const payload = await cognito().verifier.verify(result.IdToken);
  const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
  const role = PRECEDENCE.find((r) => groups.includes(r));
  const user = String(payload.email ?? payload["cognito:username"] ?? "user");
  if (!role) {
    const known = Object.keys(ROLES).join(", ");
    return { kind: "error", status: 403, message: `บัญชีนี้ยังไม่ได้กำหนด role — ให้ผู้ดูแลเพิ่มเข้า group ใน Cognito (${known})` };
  }
  if (!isRole(role)) return { kind: "error", status: 403, message: "Unknown role" };
  return { kind: "ok", user, role };
}

function fromError(e: unknown): CognitoResult {
  const name = (e as { name?: string }).name ?? "";
  // aws-jwt-verify errors: bad signature, wrong pool / app client, expired …
  if (e instanceof JwtBaseError) {
    console.error("[olytics] rejected Cognito token:", e.message);
    return { kind: "error", status: 401, message: "Token verification failed" };
  }
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return { kind: "error", status: 401, message: "Invalid email or password" };
    case "UserNotConfirmedException":
      return { kind: "error", status: 403, message: "บัญชียังไม่ได้ยืนยันอีเมล" };
    case "PasswordResetRequiredException":
      return { kind: "error", status: 403, message: "ต้องรีเซ็ตรหัสผ่านก่อน — ติดต่อผู้ดูแลระบบ" };
    case "InvalidPasswordException":
      return { kind: "error", status: 400, message: "รหัสใหม่ไม่ตรงตามนโยบายรหัสผ่านของ Cognito" };
    case "InvalidParameterException":
      return { kind: "error", status: 500, message: "Cognito app client ต้องเปิด ALLOW_USER_PASSWORD_AUTH" };
    case "TooManyRequestsException":
      return { kind: "error", status: 429, message: "ลองใหม่อีกครั้งในอีกสักครู่" };
    default:
      console.error("[olytics] cognito error:", e);
      return { kind: "error", status: 502, message: (e as Error).message || "Cognito error" };
  }
}

export async function cognitoSignIn(username: string, password: string): Promise<CognitoResult> {
  try {
    const { client, clientId, clientSecret } = cognito();
    const hash = secretHash(username, clientId, clientSecret);
    const res = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: { USERNAME: username, PASSWORD: password, ...(hash ? { SECRET_HASH: hash } : {}) },
      }),
    );
    if (res.ChallengeName === "NEW_PASSWORD_REQUIRED" && res.Session) return { kind: "new-password", session: res.Session };
    if (res.ChallengeName) return { kind: "error", status: 501, message: `Cognito challenge not supported: ${res.ChallengeName}` };
    return await sessionFromTokens(res.AuthenticationResult);
  } catch (e) {
    return fromError(e);
  }
}

/** First login with a temporary password: set the permanent one. */
export async function cognitoNewPassword(username: string, newPassword: string, session: string): Promise<CognitoResult> {
  try {
    const { client, clientId, clientSecret } = cognito();
    const hash = secretHash(username, clientId, clientSecret);
    const res = await client.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: session,
        ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword, ...(hash ? { SECRET_HASH: hash } : {}) },
      }),
    );
    return await sessionFromTokens(res.AuthenticationResult);
  } catch (e) {
    return fromError(e);
  }
}
