"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Icons";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace("/overview");
      router.refresh();
    } else {
      setError((await res.json().catch(() => null))?.error ?? "Login failed");
    }
  }

  return (
    <main className={styles.bg}>
      <form className={styles.card} onSubmit={submit}>
        <Logo size={88} />
        <h1 className={styles.title}>Olytics</h1>
        <label className={styles.field}>
          <span>username :</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className={styles.field}>
          <span>password :</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.btn} disabled={busy}>
          {busy ? "..." : "login"}
        </button>
      </form>
    </main>
  );
}
