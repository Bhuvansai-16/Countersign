"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError, getToken, setToken } from "@/lib/api";
import { Brand } from "@/components/brand";

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
      if (getToken() !== token) {
        setError("Allow browser storage to sign in to the seller console.");
        return;
      }
      router.replace("/cases");
    } catch (error) {
      setError(error instanceof ApiError && error.status === 401
        ? "That seller password is incorrect."
        : "Could not sign in. Check that Countersign is running and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-art">
        <Brand />
        <div><h2>Orders and<br /><em>disputes.</em></h2><p className="mt-6 max-w-sm text-sm leading-7">Review payment receipts and approve dispute responses.</p></div>
        <p className="text-xs">Sandbox workspace</p>
      </section>
      <div className="login-form-area"><form onSubmit={submit} className="login-form">
        <p className="eyebrow mb-4">Merchant workspace</p>
        <h1>Seller sign-in</h1>
        <p className="mt-4 text-sm leading-6 text-muted">Enter your Countersign seller password.</p>
        <label className="mt-5 block text-sm font-medium" htmlFor="password">Seller password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="form-field"
          required
        />
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="primary-button mt-5 w-full"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form></div>
    </main>
  );
}
