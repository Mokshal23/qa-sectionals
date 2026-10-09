import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChartNoAxesCombined, LockKeyhole, TimerReset } from "lucide-react";

export default function AnalysisPreviewPage() {
  return <AppShell active="Analysis" role="Preview"><div className="page-content"><div className="welcome-row"><div><div className="eyebrow">ANALYSIS · YOUR OWN ATTEMPTS</div><h1>A debrief built from what you did<span className="heading-period">.</span></h1><p className="page-subtitle">Every insight comes from your recorded choices, time, and revisits.</p></div></div><section className="report-preview-grid"><article className="report-preview-card"><ChartNoAxesCombined/><h2>Score & selection</h2><p>Score, attempts, blanks, question order, and review decisions.</p></article><article className="report-preview-card"><TimerReset/><h2>Time & journey</h2><p>Per-question active time, first pass, revisits, and short glances.</p></article><article className="report-preview-card"><LockKeyhole/><h2>Private mistake review</h2><p>Retry missed questions before solutions, then label the kind of error.</p></article></section><div className="preview-empty"><strong>No report to show yet</strong><span>Submit your first sectional and this page will open its evidence-backed report.</span><Link href="/sectionals" className="button button-dark">Find a sectional</Link></div></div></AppShell>;
}
