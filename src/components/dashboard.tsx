import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Clock3, FileQuestion, LockKeyhole, Plus, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { GenerationResult } from "@/lib/generator";
import { PageEyebrow } from "./app-shell";

type Props = {
  totalQuestions: number;
  readyQuestions: number;
  missingSolutions: number;
  generated: GenerationResult;
  preview: boolean;
  owner?: boolean;
  sectionals?: Array<{ id: string; title: string; duration_seconds: number }>;
  attempts?: Array<{ id: string; sectional_id: string; status: string; started_at: string; submitted_at: string | null; score: { score?: number } | null }>;
};
const topics = [["Arithmetic", "42.1%", "teal"], ["Algebra", "31.8%", "blue"], ["Geometry & mensuration", "14.5%", "purple"], ["Number system", "9.4%", "amber"], ["Modern math", "2.1%", "coral"]] as const;

export function Dashboard({ totalQuestions, readyQuestions, missingSolutions, generated, preview, owner = false, sectionals = [], attempts = [] }: Props) {
  const first = sectionals[0];
  return <div className="page-content dashboard-page">
    <div className="welcome-row"><div><PageEyebrow>{preview ? "PRIVATE CAT WORKSPACE · PREVIEW" : "YOUR PRIVATE CAT WORKSPACE"}</PageEyebrow><h1>A sharper view of your practice<span className="heading-period">.</span></h1><p className="page-subtitle">A considered place to work through the questions and understand the decisions behind your score.</p></div><Link href="/sectionals" className="button button-primary"><Plus size={16}/>{owner ? "Build sectionals" : "View sectionals"}</Link></div>
    {preview && <div className="preview-banner"><span className="preview-symbol"><ShieldCheck size={18}/></span><div><strong>Private preview</strong><span>The platform is ready for database connection and member invites. Your imported bank stays in this workspace.</span></div><Link href="/setup">Finish setup <ArrowRight size={14}/></Link></div>}
    <section className="stat-grid" aria-label="Workspace overview">
      <article className="stat-card"><div className="stat-heading"><span>QUESTION BANK</span><BookOpen size={16}/></div><strong>{totalQuestions.toLocaleString()}</strong><div className="stat-foot"><span className="stat-dot green"/>{preview ? "Questions imported locally" : owner ? "Managed question bank" : "Curated for your group"}</div></article>
      <article className="stat-card"><div className="stat-heading"><span>READY TO ASSEMBLE</span><FileQuestion size={16}/></div><strong>{readyQuestions.toLocaleString()}</strong><div className="stat-foot"><span className="stat-dot blue"/>Answer and solution verified</div></article>
      <article className="stat-card"><div className="stat-heading"><span>FULL SECTIONALS</span><BarChart3 size={16}/></div><strong>{owner ? sectionals.length + generated.maxForms : preview ? generated.maxForms : sectionals.length}</strong><div className="stat-foot"><span className="stat-dot violet"/>22 questions · 6 A / 10 B / 6 C</div></article>
      <article className="stat-card"><div className="stat-heading"><span>NEEDS A SOLUTION</span><Clock3 size={16}/></div><strong>{missingSolutions.toLocaleString()}</strong><div className="stat-foot"><span className="stat-dot amber"/>Held out of published forms</div></article>
    </section>
    <div className="dashboard-columns">
      <section className="panel sectionals-panel"><div className="panel-heading"><div><span className="panel-kicker">YOUR PRACTICE PLAN</span><h2>{owner ? "Create a clean start" : "Ready when you are"}</h2></div><Link href="/sectionals" className="text-link">{owner ? "Manage" : "See all"}<ArrowRight size={14}/></Link></div>
        <div className="next-test-card"><div className="next-test-top"><span className="test-tag">QUANTITATIVE ABILITY</span><span className="test-index">22<span> QUESTIONS</span></span></div><h3>{first?.title ?? "Sectional 01"}</h3><p>{owner ? "Preview the bank balance, then publish a fixed question order for everyone." : first ? "Your own 40-minute sitting begins whenever you choose." : "A new sectional will appear here when your organizer publishes one."}</p><div className="test-meta"><span><FileQuestion size={14}/>22 questions</span><span><Timer size={14}/>40 minutes</span><span><LockKeyhole size={14}/>Private</span></div><Link href="/sectionals" className="button button-dark">{owner ? "Review sectionals" : "Open sectionals"}<ArrowRight size={15}/></Link></div>
        <div className="recent-row"><div className="recent-icon"><Sparkles size={16}/></div><div><strong>{owner ? "Your group gets the complete debrief" : "Every attempt gets a full debrief"}</strong><span>Journey, pacing, selection, mistakes, and question-by-question review.</span></div><Link aria-label="Open analysis" href={attempts[0] ? `/analysis/${attempts[0].id}` : "/analysis/preview"}><ArrowRight size={16}/></Link></div>
      </section>
      <section className="panel mix-panel"><div className="panel-heading"><div><span className="panel-kicker">BANK HEALTH</span><h2>{preview || owner ? "Built from your data" : "Your progress"}</h2></div><Link href={owner ? "/bank" : "/sectionals"} className="round-arrow" aria-label={owner ? "Open question bank" : "Open sectionals"}><ArrowRight size={16}/></Link></div>
        {owner || preview ? <><div className="mix-summary"><div><strong>{totalQuestions.toLocaleString()}</strong><span>questions in your bank</span></div><span className="mix-ready">{readyQuestions} ready</span></div><div className="difficulty-bars">{([ ["A","Easy","mint"], ["B","Medium","blue"], ["C","Difficult","coral"] ] as const).map(([key,label,color])=><div className="difficulty-row" key={key}><span className={`difficulty-badge ${color}`}>{key}</span><span className="difficulty-label">{label}</span><div className="bar-track"><div className={`bar-fill ${color}`} style={{width:`${Math.round((generated.eligibleByDifficulty[key]/Math.max(1,readyQuestions))*100)}%`}}/></div><strong>{generated.eligibleByDifficulty[key]}</strong></div>)}</div></> : <div className="member-progress"><div className="progress-orbit"><BarChart3 size={22}/></div><strong>{attempts.filter((attempt)=>attempt.status==="submitted").length} completed</strong><span>Your history is private to you. Complete a few sectionals to build a reliable personal pace baseline.</span></div>}
        <div className="mix-divider"/><div className="topic-heading"><span>CAT FIVE-YEAR TOPIC TARGET</span><span>LIBRARY SHARE</span></div><div className="topic-rows">{topics.map(([label,count,color])=><div className="topic-row" key={label}><span className={`topic-dot ${color}`}/><span>{label}</span><div/><strong>{count}</strong></div>)}</div><div className="mix-note">Topic shares are targets drawn from a five-year, 15-slot reconstruction.</div>
      </section>
    </div>
    <section className="bottom-insight"><div className="bottom-insight-icon"><ShieldCheck size={17}/></div><div><strong>Private by design</strong><span>Members see only their own answers and analysis. The organizer manages the bank and forms without access to member attempts.</span></div><Link href="/setup">Privacy details <ArrowRight size={14}/></Link></section>
  </div>;
}
