import { setNewPassword } from "@/lib/login";
import { loginResponse } from "../session-cookie";

// Cognito NEW_PASSWORD_REQUIRED: first login of a user created with a temporary password.
export async function POST(req: Request) {
  const { username = "", newPassword = "", session = "" } = await req.json().catch(() => ({}));
  if (!session) return Response.json({ error: "Missing session" }, { status: 400 });
  return loginResponse(await setNewPassword(String(username).trim(), String(newPassword), String(session)));
}
