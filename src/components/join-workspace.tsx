"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck, TicketCheck } from "lucide-react";

export function JoinWorkspace({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); setBusy(false); return; }
    try {
      const response = await fetch("/api/auth/claim-invite", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, inviteCode: inviteCode.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create your account.");
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your account."); }
    finally { setBusy(false); }
  }

  return <main className="login-screen">
    <div className="login-brand"><span className="brand-mark"><Activity size={19} /></span><div><b>quantroom</b><small>PRIVATE CAT PRACTICE</small></div></div>
    <div className="login-grid">
      <section className="login-story"><span className="eyebrow"><ShieldCheck size={14} /> INVITE CODE ACCESS</span><h1>Your practice stays yours.</h1><p>Use the private code shared by your organizer to join the group. Your answers and analysis remain visible only to you.</p><div className="login-points"><span><TicketCheck size={16} /> Single-use invite code</span><span><LockKeyhole size={16} /> No confirmation email</span></div><div className="login-orbit"><span className="orbit-ring ring-one"/><span className="orbit-ring ring-two"/><span className="orbit-node node-one">A</span><span className="orbit-node node-two">B</span><span className="orbit-node node-three">C</span><span className="orbit-core"><Activity size={25}/></span></div></section>
      <section className="login-card"><span className="panel-kicker">JOIN YOUR GROUP</span><h2>Create your account</h2><p>Enter the email the organizer invited, the one-time code, and a password. No email is sent.</p>
        {!configured && <div className="config-warning">Database access is not configured on this deployment yet.</div>}
        <form onSubmit={join}>
          <label htmlFor="join-email">Invited email</label><div className="input-wrap"><Mail size={16}/><input id="join-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div>
          <label htmlFor="invite-code">One-time invite code</label><div className="input-wrap"><TicketCheck size={16}/><input id="invite-code" type="text" autoComplete="off" spellCheck={false} value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Paste the code from your organizer" required /></div>
          <label htmlFor="new-password">Create password</label><div className="input-wrap"><KeyRound size={16}/><input id="new-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" required /></div>
          <label htmlFor="confirm-password">Confirm password</label><div className="input-wrap"><KeyRound size={16}/><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-dark full-width" disabled={busy || !configured}>{busy ? "Creating account…" : "Join workspace"}<ArrowRight size={15}/></button>
        </form>
        <div className="login-card-foot"><LockKeyhole size={14}/> Invite codes expire after seven days and work once.</div>
        <p className="login-join-link"><Link href="/login">Back to sign in</Link></p>
      </section>
    </div>
    <footer className="login-footer">QUANTROOM <span>·</span> BUILT FOR YOUR GROUP</footer>
  </main>;
}
