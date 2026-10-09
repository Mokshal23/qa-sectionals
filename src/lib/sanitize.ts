import sanitizeHtml from "sanitize-html";

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
    disallowedTagsMode: "discard",
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}
