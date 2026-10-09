"use client";

import { useRef, useState } from "react";
import { ArrowDownToLine, Check, CircleAlert, FileJson2, FileSpreadsheet, LoaderCircle, LockKeyhole, Upload } from "lucide-react";
import { parseQuestionImport, validateQuestionImport } from "@/lib/import";

type Stats = { total: number; ready: number; missingSolution: number; difficultyCounts: Record<string, number>; readyCounts: Record<string, number>; topicCounts: Record<string, number>; formatCounts: Record<string, number>; withPValue: number };

export function BankWorkspace({ stats, preview }: { stats: Stats; preview: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [progress, setProgress] = useState(0); const [busy, setBusy] = useState(false);
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setStatus("Reading and validating your question bank…"); setProgress(0);
    try {
      const questions = parseQuestionImport(await file.text(), file.name);
      const issues = validateQuestionImport(questions);
      const errors = issues.filter((issue) => issue.severity === "error");
      if (errors.length) throw new Error(`${errors.length} validation error(s). First issue: row ${errors[0].row}, ${errors[0].id}: ${errors[0].message}`);
      if (preview) throw new Error("Connect Supabase before uploading this bank to the hosted workspace.");
      const batchSize = 20;
      let frozenTotal = 0;
      for (let index = 0; index < questions.length; index += batchSize) {
        const batch = questions.slice(index, index + batchSize);
        const response = await fetch("/api/admin/bank", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questions: batch }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Could not save rows ${index + 1}–${index + batch.length}.`);
        frozenTotal += Number(result.frozen ?? 0);
        setProgress(Math.min(100, Math.round(((index + batch.length) / questions.length) * 100)));
        setStatus(`Saved ${Math.min(index + batch.length, questions.length)} of ${questions.length} questions…`);
      }
      setStatus(`Processed ${questions.length} questions; ${frozenTotal} already used in published forms were left unchanged. ${issues.filter((issue) => issue.severity === "warning").length} source warnings were found.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); setStatus(""); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  return <div className="page-content">
    <div className="welcome-row"><div><div className="eyebrow"><FileJson2 size={13}/> QUESTION BANK · OWNER ONLY</div><h1>Every question, accounted for<span className="heading-period">.</span></h1><p className="page-subtitle">Import JSON or CSV, validate the key fields, and keep the source P-values exactly as supplied.</p></div><a className="button button-secondary" href="/question-bank-template.csv" download><ArrowDownToLine size={15}/>CSV template</a></div>
    {preview && <div className="preview-banner"><span className="preview-symbol"><LockKeyhole size={17}/></span><div><strong>Local source loaded</strong><span>The canonical question bank is read from the supplied file during preview. Uploading to shared storage requires database setup.</span></div></div>}
    <section className="bank-summary-grid"><article className="bank-summary"><span>IMPORTED</span><strong>{stats.total.toLocaleString()}</strong><small>Question records</small></article><article className="bank-summary"><span>COMPLETE</span><strong>{stats.ready.toLocaleString()}</strong><small>Answer and solution present</small></article><article className="bank-summary"><span>P-VALUES</span><strong>{stats.withPValue.toLocaleString()}</strong><small>Preserved as combined values</small></article><article className="bank-summary warning-stat"><span>INCOMPLETE</span><strong>{stats.missingSolution.toLocaleString()}</strong><small>Missing a usable solution</small></article></section>
    <div className="bank-layout"><section className="panel upload-panel"><span className="panel-kicker">ADD OR REPLACE QUESTIONS</span><h2>Import your question file</h2><p>JSON is the canonical format. CSV is also supported with the documented template columns.</p><input ref={inputRef} type="file" accept=".json,.csv,application/json,text/csv" className="visually-hidden" onChange={(event)=>void importFile(event.target.files?.[0])}/><button className="upload-drop" onClick={()=>inputRef.current?.click()} disabled={busy}><span className="upload-orbit">{busy?<LoaderCircle className="spin" size={21}/>:<Upload size={21}/>}</span><strong>{busy?"Processing file…":"Choose a question file"}</strong><span>JSON or CSV · stems, choices, keys, solutions, topics, labels, P-values</span><em>Choose file</em></button>{busy&&<div className="upload-progress"><div><span>Uploading securely</span><b>{progress}%</b></div><div className="progress-track"><span style={{width:`${progress}%`}}/></div></div>}{status&&<div className="success-message"><Check size={15}/>{status}</div>}{error&&<div className="error-message"><CircleAlert size={15}/>{error}</div>}<div className="safe-note"><LockKeyhole size={14}/><span>Only the organizer can import or edit question content. Answer keys are never sent to a test taker’s browser during an active sitting.</span></div></section>
      <section className="panel bank-mix-panel"><span className="panel-kicker">SOURCE MIX</span><h2>What’s in the bank</h2><div className="difficulty-bars bank-bars">{([ ["A","Easy","mint"], ["B","Medium","blue"], ["C","Difficult","coral"] ] as const).map(([key,label,color])=><div className="difficulty-row" key={key}><span className={`difficulty-badge ${color}`}>{key}</span><span className="difficulty-label">{label}</span><div className="bar-track"><div className={`bar-fill ${color}`} style={{width:`${Math.round(((stats.difficultyCounts[key]??0)/Math.max(1,stats.total))*100)}%`}}/></div><strong>{stats.difficultyCounts[key]??0}</strong></div>)}</div><div className="bank-mini-stats"><div><span>Multiple choice</span><strong>{stats.formatCounts.MCQ??0}</strong></div><div><span>Numeric entry</span><strong>{stats.formatCounts.TITA??0}</strong></div><div><span>With solution</span><strong>{stats.total-stats.missingSolution}</strong></div></div><div className="mix-note">Difficulty codes are kept as supplied: A easy, B medium, C difficult.</div></section></div>
    <section className="panel import-rules"><div className="panel-heading"><div><span className="panel-kicker">IMPORT CHECKS</span><h2>Fields we validate</h2></div></div><div className="field-check-grid">{[[FileJson2,"Question text and stable ID","IDs must be unique; rich text is sanitized before display."],[FileSpreadsheet,"Answer format and key","MCQ choices and TITA numeric answers are checked separately."],[CircleAlert,"Topic and difficulty","Rows without a valid topic or A/B/C label are held out of form generation."],[LockKeyhole,"Solution and P-value","P-values stay as source values; a missing solution prevents publication."]].map(([Icon,title,detail])=>{const IconComponent=Icon as typeof FileJson2;return <div className="field-check" key={String(title)}><IconComponent size={17}/><div><strong>{String(title)}</strong><span>{String(detail)}</span></div></div>})}</div></section>
  </div>;
}
