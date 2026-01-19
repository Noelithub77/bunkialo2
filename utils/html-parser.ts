import { parseDocument } from "htmlparser2";
import { selectAll, selectOne } from "css-select";
import { textContent, getAttributeValue } from "domutils";
import type { Element, Document } from "domhandler";

// Parse HTML string into a document
export const parseHtml = (html: string): Document => {
  return parseDocument(html);
};

// Select all elements matching a CSS selector
export const querySelectorAll = (
  doc: Document | Element,
  selector: string,
): Element[] => {
  return selectAll(selector, doc) as Element[];
};

// Select first element matching a CSS selector
export const querySelector = (
  doc: Document | Element,
  selector: string,
): Element | null => {
  return selectOne(selector, doc) as Element | null;
};

// Get text content of an element
export const getText = (element: Element | null): string => {
  if (!element) return "";
  return textContent(element).trim();
};

// Get attribute value from an element
export const getAttr = (
  element: Element | null,
  attr: string,
): string | null => {
  if (!element) return null;
  return getAttributeValue(element, attr) ?? null;
};

// Check if any elements match the selector
export const hasMatch = (
  doc: Document | Element,
  selector: string,
): boolean => {
  return selectOne(selector, doc) !== null;
};
