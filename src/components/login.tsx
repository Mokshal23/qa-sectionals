"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export function AppLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <main className="login-screen">
    <div className="login-brand"><span className="brand-mark"><Activity size={19} /></span><div><b>quantroom</b><small>PRIVATE CAT PRACTICE</small></div></div>
    <div className="login-grid">
      <section className="login-story"><span className="eyebrow"><ShieldCheck size={14} /> A QUIETER KIND OF PRACTICE</span><h1>Every question tells you something.</h1><p>Practice with your group. Keep your attempts private. Get a detailed debrief that helps you decide what to do next.</p><div className="login-points"><span><LockKeyhole size={16} /> Your results stay yours</span><span><Mail size={16} /> Invite-only access</span></div><div className="login-orbit"><span className="orbit-ring ring-one"/><span className="orbit-ring ring-two"/><span className="orbit-node node-one">A</span><span className="orbit-node node-two">B</span><span className="orbit-node node-three">C</span><span className="orbit-core"><Activity size={25}/></span></div></section>
      <section className="login-card"><span className="panel-kicker">YOUR WORKSPACE</span><h2>Welcome back</h2><p>Sign in with the email and password you set when you joined.</p>
        {!configured && <div className="config-warning">Database access is not configured on this deployment yet.</div>}
        <form onSubmit={signIn}><label htmlFor="email">Email address</label><div className="input-wrap"><Mail size={16}/><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div><label htmlFor="password">Password</label><div className="input-wrap"><KeyRound size={16}/><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>{error && <div className="form-error">{error}</div>}<button className="button button-dark full-width" disabled={busy || !configured}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={15}/></button></form>
        <div className="login-card-foot"><LockKeyhole size={14}/> Only invited members can sign in. No email is sent.</div>
        <p className="login-join-link">Have an invite code? <Link href="/join">Create your account</Link></p>
      </section>
    </div>
    <footer className="login-footer">QUANTROOM <span>·</span> BUILT FOR YOUR GROUP</footer>
  </main>;
}
