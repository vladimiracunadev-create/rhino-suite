import type { DocumentPoint } from "@web-office/engine-client";

export type ModelPoint = DocumentPoint;

export interface ModelSelection {
  anchor: ModelPoint;
  focus: ModelPoint;
}

const FRAGMENT_SELECTOR = "[data-editor-fragment='true']";

export function readModelSelection(root: HTMLElement): ModelSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;

  const anchorElement = closestFragment(selection.anchorNode, root);
  const focusElement = closestFragment(selection.focusNode, root);
  if (!anchorElement || !focusElement) return null;
  const anchorBlockId = anchorElement.dataset.blockId;
  const focusBlockId = focusElement.dataset.blockId;
  if (!anchorBlockId || !focusBlockId) return null;

  return {
    anchor: {
      blockId: anchorBlockId,
      offset: fragmentOffset(anchorElement, selection.anchorNode, selection.anchorOffset),
    },
    focus: {
      blockId: focusBlockId,
      offset: fragmentOffset(focusElement, selection.focusNode, selection.focusOffset),
    },
  };
}

export function restoreModelSelection(root: HTMLElement, modelSelection: ModelSelection): boolean {
  const anchorElement = findFragment(root, modelSelection.anchor.blockId, modelSelection.anchor.offset);
  const focusElement = findFragment(root, modelSelection.focus.blockId, modelSelection.focus.offset);
  if (!anchorElement || !focusElement) return false;
  const anchor = domPointForOffset(anchorElement, modelSelection.anchor.offset);
  const focus = domPointForOffset(focusElement, modelSelection.focus.offset);
  if (!anchor || !focus) return false;

  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(anchor.node, anchor.offset);
  range.collapse(true);
  selection.addRange(range);
  selection.extend(focus.node, focus.offset);
  return true;
}

export function isCollapsedModelSelection(selection: ModelSelection): boolean {
  return selection.anchor.blockId === selection.focus.blockId
    && selection.anchor.offset === selection.focus.offset;
}

function closestFragment(node: Node, root: HTMLElement): HTMLElement | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const fragment = element?.closest<HTMLElement>(FRAGMENT_SELECTOR) ?? null;
  return fragment && root.contains(fragment) ? fragment : null;
}

function fragmentOffset(fragment: HTMLElement, node: Node, nodeOffset: number): number {
  try {
    const range = document.createRange();
    range.selectNodeContents(fragment);
    range.setEnd(node, nodeOffset);
    return unicodeLength(cleanEditorText(range.toString())) + Number(fragment.dataset.start ?? 0);
  } catch {
    return Number(fragment.dataset.start ?? 0);
  }
}

function findFragment(root: HTMLElement, blockId: string, offset: number): HTMLElement | null {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(FRAGMENT_SELECTOR))
    .filter((element) => element.dataset.blockId === blockId);
  if (candidates.length === 0) return null;
  return candidates.find((element) => {
    const start = Number(element.dataset.start ?? 0);
    const end = Number(element.dataset.end ?? start);
    return offset >= start && offset <= end;
  }) ?? candidates.at(-1) ?? null;
}

function domPointForOffset(fragment: HTMLElement, modelOffset: number): { node: Node; offset: number } | null {
  const fragmentStart = Number(fragment.dataset.start ?? 0);
  let remaining = Math.max(0, modelOffset - fragmentStart);
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const text = cleanEditorText(current.textContent ?? "");
    const length = unicodeLength(text);
    if (remaining <= length) return { node: current, offset: utf16Offset(text, remaining) };
    remaining -= length;
    current = walker.nextNode();
  }
  return { node: fragment, offset: fragment.childNodes.length };
}

function cleanEditorText(value: string): string {
  return value.replaceAll("\u200b", "");
}

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

function utf16Offset(value: string, unicodeOffset: number): number {
  return Array.from(value).slice(0, unicodeOffset).join("").length;
}
