import sanitizeHtml from "sanitize-html";
import type { Choice } from "./domain";

const choiceImageHost = "quizky-images.s3.ap-south-1.amazonaws.com";
const dataImagePattern = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;

export function safeQuestionChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.slice(0, 4) : "";
    if (!id) return [];
    const text = typeof candidate.text === "string" ? candidate.text.slice(0, 4000) : "";
    const html = typeof candidate.html === "string" ? safeChoiceHtml(candidate.html.slice(0, 8000)) : "";
    const imageData = typeof candidate.imageData === "string" && candidate.imageData.length <= 1_000_000 && dataImagePattern.test(candidate.imageData) ? candidate.imageData : undefined;
    let imageUrl: string | undefined;
    if (typeof candidate.imageUrl === "string") {
      try {
        const url = new URL(candidate.imageUrl);
        if (url.protocol === "https:" && url.hostname === choiceImageHost && !url.username && !url.password && !url.port) imageUrl = url.toString();
      } catch {
        // Invalid image URLs are omitted from public question data.
      }
    }
    return text || html || imageData || imageUrl ? [{ id, text, ...(html ? { html } : {}), ...(imageData ? { imageData } : {}), ...(imageUrl ? { imageUrl } : {}) }] : [];
  });
}

export function safeChoiceHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ["br", "strong", "b", "em", "i", "u", "del", "sub", "sup"],
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: "discard",
  });
}

const allowedTags = [
  "p", "br", "strong", "b", "em", "i", "u", "del", "sub", "sup", "blockquote",
  "ul", "ol", "li", "div", "span", "table", "thead", "tbody", "tr", "th", "td", "img", "a",
];

export function safeQuestionHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: ["https", "data"] },
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      img: (tagName, attribs) => {
        const source = attribs.src ?? "";
        const safeDataImage = source.length <= 1_000_000 && dataImagePattern.test(source);
        let safeRemoteImage = false;
        try {
          const url = new URL(source);
          safeRemoteImage = url.protocol === "https:" && url.hostname === choiceImageHost && !url.username && !url.password && !url.port;
        } catch {
          // Inline image data is handled above; invalid URLs lose their src.
        }
        return { tagName, attribs: safeDataImage || safeRemoteImage ? attribs : { alt: attribs.alt ?? "Question image" } };
      },
    },
  });
}
