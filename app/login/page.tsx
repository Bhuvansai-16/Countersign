"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await api<{ token: string }>("/api/login", { method: "POST", json: { password } });
      setToken(token);
      router.replace("/cases");
    } catch {
      setError("That password is not right.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Countersign seller console</h1>
        <p className="mt-1 text-sm text-muted">Sign in to review disputes and approve responses.</p>
        <label className="mt-5 block text-sm font-medium" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          required
        />
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 font-medium text-white disabled:opacity-60 dark:text-black"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
