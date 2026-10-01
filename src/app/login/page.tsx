"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Icon from "@/components/Icon";

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
    window.location.replace(next && next.startsWith("/") ? next : "/");
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/template/sws-logo.png" alt="SWS" style={{ height: 60, marginBottom: 18 }} />
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Welcome back</h2>
        <p className="muted" style={{ margin: "0 0 20px" }}>
          Sign in to the SWS Report Builder.
        </p>
        <label className="field">
          <span>Team password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary lg" type="submit" style={{ width: "100%" }}>
          <Icon name="lock" size={16} />
          Sign in
        </button>
      </form>
    </main>
  );
}
