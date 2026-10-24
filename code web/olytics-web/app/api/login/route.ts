import { signIn } from "@/lib/login";
import { loginResponse } from "./session-cookie";

export async function POST(req: Request) {
  const { username = "", password = "" } = await req.json().catch(() => ({}));
  return loginResponse(await signIn(String(username).trim(), String(password)));
}
