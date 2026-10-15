"use client";
import DOMPurify from "dompurify";

// Cleans rich text from the study editor before it is stored or shown.
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "div", "br", "b", "strong", "i", "em", "u", "s", "strike", "span", "mark", "a", "ul", "ol", "li", "img", "h3", "h4", "blockquote", "font"],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "color"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
  });
}
