import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

const env = { ...readEnvFile(await readFile(resolve(".env.local"), "utf8").catch(() => "")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
const inputPath = process.argv[2] ? resolve(process.argv[2]) : resolve("data/question-bank.json");
const bank = JSON.parse(await readFile(inputPath, "utf8"));
const questions = Array.isArray(bank) ? bank : bank.questions;
if (!Array.isArray(questions) || !questions.length) throw new Error("No normalized questions were found in the JSON file.");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const batchSize = 50;
for (let index = 0; index < questions.length; index += batchSize) {
  const batch = questions.slice(index, index + batchSize);
  const catalog = batch.map((question) => ({
    id: question.id, prompt: question.prompt ?? "", prompt_html: question.promptHtml ?? "",
    options: question.options ?? [], pillar: question.pillar ?? "", topic: question.topic ?? "",
    area: question.area ?? "", difficulty: question.difficulty, response_type: question.responseType,
    p_value: question.pValue, p_value_unit: question.pValueUnit ?? "source-supplied",
    has_solution: Boolean(question.hasSolution),
  }));
  const { error } = await admin.from("question_catalog").upsert(catalog);
  if (error) throw new Error(`Catalog batch ${Math.floor(index / batchSize) + 1}: ${error.message}`);
  const solutions = batch.filter((question) => question.answer?.trim()).map((question) => ({
    question_id: question.id, answer: question.answer, solution: question.solution ?? "", solution_html: question.solutionHtml ?? "",
  }));
  if (solutions.length) {
    const { error: solutionError } = await admin.from("question_solutions").upsert(solutions);
    if (solutionError) throw new Error(`Solution batch ${Math.floor(index / batchSize) + 1}: ${solutionError.message}`);
  }
  console.log(`Imported ${Math.min(index + batch.length, questions.length)} of ${questions.length} question records.`);
}
console.log("Question import complete. Attempt and personal performance fields are not included.");
