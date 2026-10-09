import { describe, expect, it } from "vitest";
import { normalizeImportRows, validateQuestionImport } from "./import";
import { safeQuestionHtml } from "./sanitize";

describe("question option import", () => {
  it("keeps embedded and approved-host option images", () => {
    const [question] = normalizeImportRows([{ 
      question_id: "image-options",
      classification: "B",
      format: "MCQ",
      question_text: "Choose an image option.",
      correct_answer: "A",
      solution: "The first choice is correct.",
      pillar: "Arithmetic",
      topic: "Percentages",
      options: [
        { identifier: "A", text: "", raw_html: '<p><img src="data:image/png;base64,AAAA"/></p>' },
        { identifier: "B", text: "", raw_html: '<p><img src="https://quizky-images.s3.ap-south-1.amazonaws.com/example.png"/></p>' },
      ],
    }]);

    expect(question.options).toEqual([
      { id: "A", text: "", imageData: "data:image/png;base64,AAAA" },
      { id: "B", text: "", imageUrl: "https://quizky-images.s3.ap-south-1.amazonaws.com/example.png" },
    ]);
    expect(validateQuestionImport([question]).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("decodes source choices that were base64 encoded in their raw HTML", () => {
    const [question] = normalizeImportRows([{ 
      question_id: "encoded-options",
      classification: "A",
      format: "MCQ",
      question_text: "Choose a percentage.",
      correct_answer: "A",
      solution: "Forty percent is correct.",
      pillar: "Arithmetic",
      topic: "Percentages",
      options: ["NDAl", "MzcuNSU=", "NjAl", "NjIuNSU="].map((text, index) => ({
        identifier: String.fromCharCode(65 + index), text, raw_html: text,
      })),
    }]);

    expect(question.options.map((option) => option.text)).toEqual(["40%", "37.5%", "60%", "62.5%"]);
  });

  it("rejects unsupported image-only choices instead of publishing blanks", () => {
    const [question] = normalizeImportRows([{ 
      question_id: "unsupported-image",
      classification: "C",
      format: "MCQ",
      question_text: "Choose one.",
      correct_answer: "A",
      solution: "A is correct.",
      pillar: "Algebra",
      topic: "Equations",
      options: [
        { identifier: "A", text: "", raw_html: '<img src="https://untrusted.example/a.png"/>' },
        { identifier: "B", text: "2" },
      ],
    }]);

    expect(validateQuestionImport([question]).some((issue) => issue.severity === "error" && issue.message.includes("Every MCQ choice"))).toBe(true);
  });

  it("preserves vetted inline bank images in stems and solutions while stripping untrusted image URLs", () => {
    const sanitized = safeQuestionHtml('<p>Diagram <img src="data:image/png;base64,AAAA"/></p><img src="https://untrusted.example/track.png"/>');

    expect(sanitized).toContain('src="data:image/png;base64,AAAA"');
    expect(sanitized).not.toContain("untrusted.example");
  });
});
