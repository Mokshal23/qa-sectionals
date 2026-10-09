"use client";

import { useState } from "react";
import { Activity, ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export function AppLogin({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function sendLink(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/magic-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send sign-in link.");
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send sign-in link."); }
    finally { setBusy(false); }
  }
  return <main className="login-screen">
    <div className="login-brand"><span className="brand-mark"><Activity size={19} /></span><div><b>quantroom</b><small>PRIVATE CAT PRACTICE</small></div></div>
    <div className="login-grid">
      <section className="login-story"><span className="eyebrow"><ShieldCheck size={14} /> A QUIETER KIND OF PRACTICE</span><h1>Every question tells you something.</h1><p>Practice with your group. Keep your attempts private. Get a detailed debrief that helps you decide what to do next.</p><div className="login-points"><span><LockKeyhole size={16} /> Your results stay yours</span><span><Mail size={16} /> Invite-only access</span></div><div className="login-orbit"><span className="orbit-ring ring-one"/><span className="orbit-ring ring-two"/><span className="orbit-node node-one">A</span><span className="orbit-node node-two">B</span><span className="orbit-node node-three">C</span><span className="orbit-core"><Activity size={25}/></span></div></section>
      <section className="login-card"><span className="panel-kicker">YOUR WORKSPACE</span><h2>{sent ? "Check your inbox" : "Welcome back"}</h2><p>{sent ? `A secure sign-in link is on its way to ${email}.` : "Sign in with the email address that received your invitation."}</p>
        {!configured && <div className="config-warning">Database access is not configured on this deployment yet.</div>}
        {sent ? <div className="sent-state"><div className="sent-icon"><Mail size={20}/></div><span>The link expires shortly and can only be used once.</span><button className="text-button" onClick={() => setSent(false)}>Use a different email</button></div> : <form onSubmit={sendLink}><label htmlFor="email">Email address</label><div className="input-wrap"><Mail size={16}/><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div>{error && <div className="form-error">{error}</div>}<button className="button button-dark full-width" disabled={busy || !configured}>{busy ? "Sending link…" : "Email me a sign-in link"}<ArrowRight size={15}/></button></form>}
        <div className="login-card-foot"><LockKeyhole size={14}/> Only invited members can sign in.</div>
      </section>
    </div>
    <footer className="login-footer">QUANTROOM <span>·</span> BUILT FOR YOUR GROUP</footer>
  </main>;
}
