"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError("Wrong password.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <img src="/template/sws-logo.png" alt="SWS" style={{ height: 56, marginBottom: 14 }} />
        <h2>Report Builder</h2>
        <label className="field">
          <span>Team password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
