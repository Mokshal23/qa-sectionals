import Link from "next/link";
import { Activity, BookOpenCheck, ChartNoAxesCombined, CircleHelp, House, LibraryBig, LockKeyhole, Settings2, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Overview", icon: House },
  { href: "/sectionals", label: "Sectionals", icon: BookOpenCheck },
  { href: "/bank", label: "Question bank", icon: LibraryBig, ownerOnly: true },
  { href: "/people", label: "Members", icon: Users, ownerOnly: true },
];

export function AppShell({ children, active = "Overview", userName = "Member", role = "Participant" }: { children: ReactNode; active?: string; userName?: string; role?: string }) {
  return <div className="app-frame"><aside className="sidebar"><Link className="brand" href="/" aria-label="Quantroom home"><span className="brand-mark"><Activity size={19} strokeWidth={2.4}/></span><span><strong>quantroom</strong><small>PRIVATE CAT PRACTICE</small></span></Link><div className="sidebar-label">WORKSPACE</div><nav className="primary-nav" aria-label="Primary navigation">{nav.filter((item)=>!item.ownerOnly||role==="Organizer").map(({href,label,icon:Icon})=><Link key={href} className={`nav-link ${active===label?"active":""}`} href={href}><Icon size={17} strokeWidth={1.8}/><span>{label}</span></Link>)}<Link className={`nav-link ${active==="Analysis"?"active":""}`} href="/analysis/preview"><ChartNoAxesCombined size={17}/><span>My analysis</span></Link></nav><div className="sidebar-spacer"/><div className="privacy-card"><div className="privacy-icon"><LockKeyhole size={16}/></div><strong>Your attempts stay yours</strong><p>Each person sees only their own answers and analysis.</p><div className="privacy-status"><span/> PRIVATE WORKSPACE</div></div><div className="sidebar-bottom"><Link className={`nav-link subtle ${active==="Setup"?"active":""}`} href="/setup"><Settings2 size={17}/><span>Setup & access</span></Link><div className="profile-row"><span className="avatar">{userName.slice(0,1).toUpperCase()}</span><span className="profile-copy"><strong>{userName}</strong><small>{role}</small></span><ShieldCheck size={16} className="profile-shield"/></div></div></aside><main className="main-panel"><header className="topbar"><div className="crumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{active}</strong></div><div className="topbar-right"><span className="private-pill"><span/> PRIVATE</span><Link className="help-button" href="/setup" aria-label="Help"><CircleHelp size={17}/></Link></div></header>{children}</main></div>;
}

export function PageEyebrow({ children }: { children: ReactNode }) { return <div className="eyebrow"><Activity size={13}/>{children}</div>; }
