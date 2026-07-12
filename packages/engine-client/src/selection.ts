import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PARAGRAPH_STYLE,
  DEFAULT_TEXT_STYLE,
  blockText,
  characterLength,
  cloneDocumentBlock,
  createEmptyParagraph,
  isBreakBlock,
  isImageBlock,
  isTextBlock,
  normalizeBlock,
  normalizeRuns,
  sliceRuns,
  styleAtOffset,
  tableCellText,
  type DocumentBlock,
  type DocumentFragment,
  type DocumentPoint,
  type DocumentResources,
  type ImageResource,
  type TextBlock,
  type TextDocument,
  type TextStyle,
} from "./model";

export const WEB_OFFICE_CLIPBOARD_MIME = "application/x-web-office-fragment+json";

export interface DocumentSelectionRange {
  start: DocumentPoint;
  end: DocumentPoint;
  startBlockIndex: number;
  endBlockIndex: number;
  collapsed: boolean;
}

export function orderDocumentPoints(
  documentModel: TextDocument,
  anchor: DocumentPoint,
  focus: DocumentPoint,
): DocumentSelectionRange | null {
  const anchorIndex = documentModel.blocks.findIndex((block) => block.id === anchor.blockId);
  const focusIndex = documentModel.blocks.findIndex((block) => block.id === focus.blockId);
  if (anchorIndex < 0 || focusIndex < 0) return null;
  const anchorBlock = documentModel.blocks[anchorIndex];
  const focusBlock = documentModel.blocks[focusIndex];
  if (!anchorBlock || !focusBlock || !isTextBlock(anchorBlock) || !isTextBlock(focusBlock)) return null;

  const anchorOffset = clampOffset(anchor.offset, characterLength(blockText(anchorBlock)));
  const focusOffset = clampOffset(focus.offset, characterLength(blockText(focusBlock)));
  const anchorBefore = anchorIndex < focusIndex || (anchorIndex === focusIndex && anchorOffset <= focusOffset);
  const start = anchorBefore
    ? { blockId: anchor.blockId, offset: anchorOffset }
    : { blockId: focus.blockId, offset: focusOffset };
  const end = anchorBefore
    ? { blockId: focus.blockId, offset: focusOffset }
    : { blockId: anchor.blockId, offset: anchorOffset };
  const startBlockIndex = anchorBefore ? anchorIndex : focusIndex;
  const endBlockIndex = anchorBefore ? focusIndex : anchorIndex;
  return {
    start,
    end,
    startBlockIndex,
    endBlockIndex,
    collapsed: start.blockId === end.blockId && start.offset === end.offset,
  };
}

export function textBlockIdsInRange(
  documentModel: TextDocument,
  range: DocumentSelectionRange,
): string[] {
  return documentModel.blocks
    .slice(range.startBlockIndex, range.endBlockIndex + 1)
    .filter(isTextBlock)
    .map((block) => block.id);
}

export function fragmentFromSelection(
  documentModel: TextDocument,
  range: DocumentSelectionRange,
): DocumentFragment {
  const selected = documentModel.blocks
    .slice(range.startBlockIndex, range.endBlockIndex + 1)
    .map(cloneDocumentBlock);
  if (selected.length === 0) return emptyFragment();

  const first = selected[0];
  const last = selected.at(-1);
  if (first && isTextBlock(first)) {
    const source = documentModel.blocks[range.startBlockIndex];
    if (source && isTextBlock(source)) {
      const end = range.startBlockIndex === range.endBlockIndex
        ? range.end.offset
        : characterLength(blockText(source));
      first.runs = sliceRuns(source, range.start.offset, end);
    }
  }
  if (last && isTextBlock(last) && range.startBlockIndex !== range.endBlockIndex) {
    const source = documentModel.blocks[range.endBlockIndex];
    if (source && isTextBlock(source)) {
      last.runs = sliceRuns(source, 0, range.end.offset);
    }
  }

  const resources: DocumentResources = { images: {} };
  for (const block of selected) {
    if (!isImageBlock(block)) continue;
    const resource = documentModel.resources.images[block.resourceId];
    if (resource) resources.images[resource.id] = structuredClone(resource);
  }

  return {
    version: 1,
    sourceSchemaVersion: documentModel.metadata.schemaVersion,
    blocks: selected,
    resources,
  };
}

export function fragmentFromPlainText(
  value: string,
  idPrefix: string,
  style: TextStyle = DEFAULT_TEXT_STYLE,
): DocumentFragment {
  const normalized = value.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  const blocks: TextBlock[] = lines.map((line, index) => ({
    blockType: "text",
    id: `${idPrefix}-block-${index + 1}`,
    sectionId: "section-1",
    kind: { type: "paragraph" },
    paragraphStyle: { ...DEFAULT_PARAGRAPH_STYLE },
    list: null,
    runs: [{
      id: `${idPrefix}-run-${index + 1}`,
      text: line,
      style: { ...style },
    }],
  }));
  return {
    version: 1,
    sourceSchemaVersion: CURRENT_SCHEMA_VERSION,
    blocks,
    resources: { images: {} },
  };
}

export function fragmentToPlainText(fragment: DocumentFragment): string {
  return fragment.blocks.map((block) => {
    if (isTextBlock(block)) return blockText(block);
    if (block.blockType === "table") {
      return block.rows.map((row) => row.cells.map(tableCellText).join("\t")).join("\n");
    }
    if (isImageBlock(block)) return block.caption || block.alt || `[Imagen: ${block.id}]`;
    return block.breakKind === "section" ? "[Salto de sección]" : block.breakKind === "column" ? "[Salto de columna]" : "[Salto de página]";
  }).join("\n");
}

export function parseClipboardFragment(value: string): DocumentFragment | null {
  try {
    const parsed = JSON.parse(value) as DocumentFragment;
    if (parsed.version !== 1 || !Array.isArray(parsed.blocks)) return null;
    return {
      version: 1,
      sourceSchemaVersion: Number(parsed.sourceSchemaVersion) || 1,
      blocks: parsed.blocks.map((block, index) => normalizeBlock(block, index)),
      resources: normalizeResources(parsed.resources),
    };
  } catch {
    return null;
  }
}

export function rekeyFragment(fragment: DocumentFragment, prefix: string): DocumentFragment {
  const resourceMap = new Map<string, string>();
  const images: Record<string, ImageResource> = {};
  let resourceIndex = 0;
  for (const resource of Object.values(fragment.resources.images)) {
    resourceIndex += 1;
    const id = `${prefix}-resource-${resourceIndex}`;
    resourceMap.set(resource.id, id);
    images[id] = { ...structuredClone(resource), id };
  }

  const blocks = fragment.blocks.map((source, blockIndex) => {
    const block = cloneDocumentBlock(source);
    block.id = `${prefix}-block-${blockIndex + 1}`;
    if (isTextBlock(block)) {
      block.runs = rekeyRuns(block.runs, block.id);
      if (block.list) block.list = { ...block.list, id: `${prefix}-list-${blockIndex + 1}` };
    } else if (block.blockType === "table") {
      block.rows = block.rows.map((row, rowIndex) => ({
        ...row,
        id: `${prefix}-table-${blockIndex + 1}-row-${rowIndex + 1}`,
        cells: row.cells.map((cell, cellIndex) => {
          const id = `${prefix}-table-${blockIndex + 1}-cell-${rowIndex + 1}-${cellIndex + 1}`;
          return { ...cell, id, runs: rekeyRuns(cell.runs, id) };
        }),
      }));
    } else if (isImageBlock(block)) {
      block.resourceId = resourceMap.get(block.resourceId) ?? block.resourceId;
    } else if (isBreakBlock(block)) {
      block.nextSectionId = null;
      if (block.breakKind === "section") block.breakKind = "page";
    }
    return block;
  });

  return {
    version: 1,
    sourceSchemaVersion: CURRENT_SCHEMA_VERSION,
    blocks,
    resources: { images },
  };
}

export function caretAfterFragment(
  start: DocumentPoint,
  fragment: DocumentFragment,
): DocumentPoint {
  const textBlocks = fragment.blocks.filter(isTextBlock);
  if (textBlocks.length === 0) return { ...start };
  if (fragment.blocks.length === 1) {
    const only = textBlocks[0];
    return {
      blockId: start.blockId,
      offset: start.offset + characterLength(only ? blockText(only) : ""),
    };
  }
  const last = textBlocks.at(-1);
  return last
    ? { blockId: last.id, offset: characterLength(blockText(last)) }
    : { ...start };
}

export function emptyFragment(): DocumentFragment {
  return {
    version: 1,
    sourceSchemaVersion: CURRENT_SCHEMA_VERSION,
    blocks: [],
    resources: { images: {} },
  };
}

export function ensureTextFragment(fragment: DocumentFragment, idPrefix: string): DocumentFragment {
  if (fragment.blocks.some(isTextBlock)) return fragment;
  return {
    ...fragment,
    blocks: [...fragment.blocks, createEmptyParagraph(`${idPrefix}-tail`, `${idPrefix}-tail-run`, fragment.blocks[0]?.sectionId ?? "section-1") ],
  };
}

function rekeyRuns(runs: TextBlock["runs"], ownerId: string): TextBlock["runs"] {
  const fallback = runs[0]?.style ?? DEFAULT_TEXT_STYLE;
  return normalizeRuns(ownerId, runs, fallback);
}

function normalizeResources(resources: DocumentResources | undefined): DocumentResources {
  const images: Record<string, ImageResource> = {};
  for (const [id, resource] of Object.entries(resources?.images ?? {})) {
    images[id] = {
      id: resource.id || id,
      kind: "image",
      name: resource.name || "imagen",
      mimeType: resource.mimeType || "application/octet-stream",
      dataUrl: resource.dataUrl || "",
      byteLength: Math.max(0, Number(resource.byteLength) || 0),
      createdAt: Math.max(0, Number(resource.createdAt) || 0),
    };
  }
  return { images };
}

function clampOffset(value: number, length: number): number {
  return Math.min(length, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}
