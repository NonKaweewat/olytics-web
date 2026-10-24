"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Icons";
import styles from "./login.module.css";

type Step = { kind: "sign-in" } | { kind: "new-password"; session: string };

export default function LoginForm({ provider }: { provider: "local" | "cognito" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<Step>({ kind: "sign-in" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cognito = provider === "cognito";

  async function post(url: string, body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? "Login failed");
    if (data?.challenge === "NEW_PASSWORD_REQUIRED") return setStep({ kind: "new-password", session: data.session });
    // each role lands on its own dashboard
    router.replace(data?.home ?? "/");
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind === "sign-in") return post("/api/login", { username, password });
    if (newPassword !== confirm) return setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    return post("/api/login/new-password", { username, newPassword, session: step.session });
  }

  return (
    <main className={styles.bg}>
      <form className={styles.card} onSubmit={submit}>
        <Logo size={88} />
        <h1 className={styles.title}>Olytics</h1>
        {step.kind === "sign-in" ? (
          <>
            <label className={styles.field}>
              <span>{cognito ? "email :" : "username :"}</span>
              <input
                type={cognito ? "email" : "text"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className={styles.field}>
              <span>password :</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
          </>
        ) : (
          <>
            <p className={styles.hint}>เข้าสู่ระบบครั้งแรก — ตั้งรหัสผ่านใหม่แทนรหัสชั่วคราว</p>
            <label className={styles.field}>
              <span>new password :</span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
            </label>
            <label className={styles.field}>
              <span>confirm :</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>
          </>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.btn} disabled={busy}>
          {busy ? "..." : step.kind === "sign-in" ? "login" : "set password"}
        </button>
      </form>
    </main>
  );
}
