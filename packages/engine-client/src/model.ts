export const CURRENT_SCHEMA_VERSION = 5 as const;

export type TextAlignment = "left" | "center" | "right" | "justify";
export type ListKind = "bullet" | "number";
export type ImageAlignment = "left" | "center" | "right";
export type BreakKind = "page" | "column" | "section";
export type SectionStartType = "next-page" | "continuous";
export type HeaderFooterArea = "header" | "footer";
export type HeaderFooterVariant = "default" | "first" | "even";
export type DynamicFieldKind = "page-number" | "page-count" | "date" | "time" | "title" | "section-name";

export interface DocumentMetadata {
  id: string;
  title: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface PageSettings {
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
}

export interface SectionColumns {
  count: number;
  gapMm: number;
  lineBetween: boolean;
  balance: boolean;
}

export interface PageNumbering {
  restart: boolean;
  start: number;
  format: "decimal" | "roman-lower" | "roman-upper";
}

export interface TextStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontFamily: string;
  fontSizePt: number;
  color: string;
  highlight: string | null;
}

export interface TextStylePatch {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontFamily?: string;
  fontSizePt?: number;
  color?: string;
  highlight?: string | null;
}

export interface HeaderFooterTextItem {
  id: string;
  type: "text";
  text: string;
  style: TextStyle;
}

export interface HeaderFooterFieldItem {
  id: string;
  type: "field";
  field: DynamicFieldKind;
  style: TextStyle;
}

export type HeaderFooterItem = HeaderFooterTextItem | HeaderFooterFieldItem;

export interface HeaderFooterContent {
  enabled: boolean;
  alignment: TextAlignment;
  distanceFromEdgeMm: number;
  items: HeaderFooterItem[];
}

export interface HeaderFooterVariants {
  default: HeaderFooterContent;
  first: HeaderFooterContent;
  even: HeaderFooterContent;
}

export interface DocumentSection {
  id: string;
  name: string;
  pageSettings: PageSettings;
  columns: SectionColumns;
  headers: HeaderFooterVariants;
  footers: HeaderFooterVariants;
  differentFirstPage: boolean;
  differentOddEven: boolean;
  pageNumbering: PageNumbering;
}

export interface DocumentSectionPatch {
  name?: string;
  pageSettings?: Partial<PageSettings>;
  columns?: Partial<SectionColumns>;
  differentFirstPage?: boolean;
  differentOddEven?: boolean;
  pageNumbering?: Partial<PageNumbering>;
}

export interface HeaderFooterContext {
  pageNumber: number;
  pageCount: number;
  sectionPageNumber: number;
  title: string;
  sectionName: string;
  now?: Date;
}

export interface ParagraphStyle {
  alignment: TextAlignment;
  lineHeight: number;
  spaceBeforePt: number;
  spaceAfterPt: number;
  firstLineIndentMm: number;
  keepWithNext: boolean;
  keepLinesTogether: boolean;
  pageBreakBefore: boolean;
  widowControl: boolean;
}

export interface ParagraphStylePatch {
  alignment?: TextAlignment;
  lineHeight?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  firstLineIndentMm?: number;
  keepWithNext?: boolean;
  keepLinesTogether?: boolean;
  pageBreakBefore?: boolean;
  widowControl?: boolean;
}

export interface Hyperlink {
  href: string;
  title: string | null;
}

export interface TextRun {
  id: string;
  text: string;
  style: TextStyle;
  hyperlink?: Hyperlink | null;
}

export type BlockKind =
  | { type: "paragraph" }
  | { type: "heading"; level: number };

export interface ListProperties {
  id: string;
  kind: ListKind;
  level: number;
  start: number;
}

export interface DocumentBlockBase {
  id: string;
  sectionId: string;
}

export interface TextBlock extends DocumentBlockBase {
  blockType: "text";
  kind: BlockKind;
  paragraphStyle: ParagraphStyle;
  list: ListProperties | null;
  runs: TextRun[];
}

export interface TableCell {
  id: string;
  paragraphStyle: ParagraphStyle;
  runs: TextRun[];
  backgroundColor: string | null;
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface TableStyle {
  borderColor: string;
  borderWidthPt: number;
  cellPaddingMm: number;
  headerRows: number;
  keepRowsTogether: boolean;
}

export interface TableBlock extends DocumentBlockBase {
  blockType: "table";
  rows: TableRow[];
  columnWidthsMm: number[];
  style: TableStyle;
}

export interface ImageBlock extends DocumentBlockBase {
  blockType: "image";
  resourceId: string;
  alt: string;
  widthMm: number;
  heightMm: number;
  alignment: ImageAlignment;
  caption: string;
  keepWithNext: boolean;
}

export interface BreakBlock extends DocumentBlockBase {
  blockType: "break";
  breakKind: BreakKind;
  startType: SectionStartType;
  nextSectionId: string | null;
}

export type DocumentBlock = TextBlock | TableBlock | ImageBlock | BreakBlock;

export interface ImageResource {
  id: string;
  kind: "image";
  name: string;
  mimeType: string;
  dataUrl: string;
  byteLength: number;
  createdAt: number;
}

export interface DocumentResources {
  images: Record<string, ImageResource>;
}


export type ReviewChangeStatus = "pending" | "accepted" | "rejected" | "conflict";
export type ReviewChangeKind = "insert" | "delete" | "replace" | "format" | "structure";

export interface DocumentRange {
  start: DocumentPoint;
  end: DocumentPoint;
}

export interface CommentMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommentThread {
  id: string;
  range: DocumentRange;
  quote: string;
  messages: CommentMessage[];
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  name: string;
  range: DocumentRange;
  createdAt: number;
}

export interface TrackedChange {
  id: string;
  kind: ReviewChangeKind;
  author: string;
  summary: string;
  commandType: DocumentCommand["type"];
  createdAt: number;
  status: ReviewChangeStatus;
  beforeSnapshot: string | null;
  afterRevision: number;
}

export interface ReviewState {
  author: string;
  trackChanges: boolean;
  comments: CommentThread[];
  bookmarks: Bookmark[];
  changes: TrackedChange[];
}

export interface TextDocument {
  metadata: DocumentMetadata;
  /** Compatibilidad con schema v1-v3. Refleja la primera sección. */
  pageSettings: PageSettings;
  sections: DocumentSection[];
  resources: DocumentResources;
  review: ReviewState;
  blocks: DocumentBlock[];
}

export interface DocumentPoint {
  blockId: string;
  offset: number;
}

export interface DocumentFragment {
  version: 1;
  sourceSchemaVersion: number;
  blocks: DocumentBlock[];
  resources: DocumentResources;
  sections?: DocumentSection[];
}

export type DocumentCommand =
  | { type: "setTitle"; title: string }
  | { type: "replaceBlockText"; blockId: string; text: string }
  | {
      type: "replaceTextRange";
      blockId: string;
      start: number;
      end: number;
      text: string;
      style?: TextStylePatch;
    }
  | {
      type: "replaceDocumentRange";
      start: DocumentPoint;
      end: DocumentPoint;
      text: string;
      style?: TextStylePatch;
      idPrefix: string;
    }
  | {
      type: "replaceRangeWithFragment";
      start: DocumentPoint;
      end: DocumentPoint;
      fragment: DocumentFragment;
      trailingBlockId?: string;
      trailingRunId?: string;
    }
  | {
      type: "insertText";
      blockId: string;
      offset: number;
      text: string;
      style?: TextStylePatch;
    }
  | { type: "deleteText"; blockId: string; start: number; end: number }
  | {
      type: "formatText";
      blockId: string;
      start: number;
      end: number;
      style: TextStylePatch;
    }
  | {
      type: "formatDocumentRange";
      start: DocumentPoint;
      end: DocumentPoint;
      style: TextStylePatch;
    }
  | { type: "setBlockKind"; blockId: string; kind: BlockKind }
  | { type: "setBlockKindMany"; blockIds: string[]; kind: BlockKind }
  | { type: "setParagraphStyle"; blockId: string; style: ParagraphStylePatch }
  | { type: "setParagraphStyleMany"; blockIds: string[]; style: ParagraphStylePatch }
  | { type: "setList"; blockIds: string[]; list: ListProperties | null }
  | {
      type: "splitBlock";
      blockId: string;
      offset: number;
      newBlockId: string;
      newRunId: string;
    }
  | { type: "mergeWithPrevious"; blockId: string }
  | {
      type: "addParagraph";
      afterBlockId?: string;
      blockId: string;
      runId: string;
      sectionId?: string;
    }
  | { type: "removeBlock"; blockId: string }
  | { type: "addResource"; resource: ImageResource }
  | {
      type: "updateTableCell";
      tableId: string;
      rowId: string;
      cellId: string;
      text: string;
    }
  | { type: "addTableRow"; tableId: string; afterRowId?: string; row: TableRow }
  | { type: "removeTableRow"; tableId: string; rowId: string }
  | {
      type: "addTableColumn";
      tableId: string;
      afterColumnIndex: number;
      widthMm: number;
      cells: TableCell[];
    }
  | { type: "removeTableColumn"; tableId: string; columnIndex: number }
  | {
      type: "updateImage";
      blockId: string;
      alt?: string;
      widthMm?: number;
      heightMm?: number;
      alignment?: ImageAlignment;
      caption?: string;
      keepWithNext?: boolean;
    }
  | { type: "setSectionProperties"; sectionId: string; patch: DocumentSectionPatch }
  | {
      type: "setSectionHeaderFooter";
      sectionId: string;
      area: HeaderFooterArea;
      variant: HeaderFooterVariant;
      content: HeaderFooterContent;
    }
  | {
      type: "insertBreak";
      afterBlockId: string;
      breakBlock: BreakBlock;
      newSection?: DocumentSection;
      paragraph?: TextBlock;
    }
  | { type: "removeBreak"; blockId: string }
  | { type: "setReviewAuthor"; author: string }
  | { type: "setTrackChanges"; enabled: boolean }
  | { type: "addComment"; thread: CommentThread }
  | { type: "replyComment"; threadId: string; message: CommentMessage }
  | { type: "resolveComment"; threadId: string; resolved: boolean }
  | { type: "removeComment"; threadId: string }
  | { type: "addBookmark"; bookmark: Bookmark }
  | { type: "removeBookmark"; bookmarkId: string }
  | { type: "setHyperlink"; start: DocumentPoint; end: DocumentPoint; hyperlink: Hyperlink | null }
  | { type: "acceptChange"; changeId: string }
  | { type: "rejectChange"; changeId: string }
  | { type: "acceptAllChanges" }
  | { type: "rejectAllChanges" };

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 25.4,
  marginRightMm: 25.4,
  marginBottomMm: 25.4,
  marginLeftMm: 25.4,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  fontFamily: "Arial",
  fontSizePt: 11,
  color: "#1f2937",
  highlight: null,
};

export const DEFAULT_PARAGRAPH_STYLE: ParagraphStyle = {
  alignment: "left",
  lineHeight: 1.35,
  spaceBeforePt: 0,
  spaceAfterPt: 8,
  firstLineIndentMm: 0,
  keepWithNext: false,
  keepLinesTogether: false,
  pageBreakBefore: false,
  widowControl: true,
};

export const DEFAULT_TABLE_STYLE: TableStyle = {
  borderColor: "#6b7280",
  borderWidthPt: 0.75,
  cellPaddingMm: 2,
  headerRows: 0,
  keepRowsTogether: false,
};

export const DEFAULT_COLUMNS: SectionColumns = {
  count: 1,
  gapMm: 8,
  lineBetween: false,
  balance: false,
};

export const DEFAULT_PAGE_NUMBERING: PageNumbering = {
  restart: false,
  start: 1,
  format: "decimal",
};

export function createReviewState(): ReviewState {
  return {
    author: "Autor local",
    trackChanges: false,
    comments: [],
    bookmarks: [],
    changes: [],
  };
}

export function createHeaderFooterContent(enabled = false): HeaderFooterContent {
  return {
    enabled,
    alignment: "center",
    distanceFromEdgeMm: 12.7,
    items: [],
  };
}

export function createHeaderFooterVariants(): HeaderFooterVariants {
  return {
    default: createHeaderFooterContent(false),
    first: createHeaderFooterContent(false),
    even: createHeaderFooterContent(false),
  };
}

export function createDocumentSection(
  id: string,
  name = "Sección 1",
  pageSettings: PageSettings = DEFAULT_PAGE_SETTINGS,
): DocumentSection {
  return {
    id,
    name,
    pageSettings: { ...pageSettings },
    columns: { ...DEFAULT_COLUMNS },
    headers: createHeaderFooterVariants(),
    footers: createHeaderFooterVariants(),
    differentFirstPage: false,
    differentOddEven: false,
    pageNumbering: { ...DEFAULT_PAGE_NUMBERING },
  };
}

export function createTextDocument(id: string, title: string, now: number): TextDocument {
  const section = createDocumentSection("section-1", "Sección 1");
  return {
    metadata: {
      id,
      title,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      revision: 0,
    },
    pageSettings: { ...section.pageSettings },
    sections: [section],
    resources: { images: {} },
    review: createReviewState(),
    blocks: [createEmptyParagraph("block-1", "run-1", section.id)],
  };
}

export function createEmptyParagraph(
  blockId: string,
  runId: string,
  sectionId = "section-1",
): TextBlock {
  return {
    blockType: "text",
    id: blockId,
    sectionId,
    kind: { type: "paragraph" },
    paragraphStyle: { ...DEFAULT_PARAGRAPH_STYLE },
    list: null,
    runs: [{ id: runId, text: "", style: { ...DEFAULT_TEXT_STYLE } }],
  };
}

export function createTableBlock(
  blockId: string,
  rows: number,
  columns: number,
  idPrefix: string,
  sectionId = "section-1",
): TableBlock {
  const safeRows = clampInteger(rows, 1, 50);
  const safeColumns = clampInteger(columns, 1, 20);
  return {
    blockType: "table",
    id: blockId,
    sectionId,
    rows: Array.from({ length: safeRows }, (_, rowIndex) => ({
      id: `${idPrefix}-row-${rowIndex + 1}`,
      cells: Array.from({ length: safeColumns }, (_, columnIndex) =>
        createTableCell(`${idPrefix}-cell-${rowIndex + 1}-${columnIndex + 1}`),
      ),
    })),
    columnWidthsMm: Array.from({ length: safeColumns }, () => 35),
    style: { ...DEFAULT_TABLE_STYLE },
  };
}

export function createTableCell(id: string): TableCell {
  return {
    id,
    paragraphStyle: { ...DEFAULT_PARAGRAPH_STYLE, spaceAfterPt: 0 },
    runs: [{ id: `${id}-run-1`, text: "", style: { ...DEFAULT_TEXT_STYLE } }],
    backgroundColor: null,
  };
}

export function createBreakBlock(
  id: string,
  sectionId: string,
  breakKind: BreakKind,
  nextSectionId: string | null = null,
  startType: SectionStartType = "next-page",
): BreakBlock {
  return { blockType: "break", id, sectionId, breakKind, nextSectionId, startType };
}

export function normalizeDocument(input: TextDocument): TextDocument {
  const metadata = input.metadata ?? {
    id: "document",
    title: "Documento",
    schemaVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: 0,
  };
  const sourceSections = Array.isArray(input.sections) && input.sections.length > 0
    ? input.sections
    : [createDocumentSection("section-1", "Sección 1", { ...DEFAULT_PAGE_SETTINGS, ...(input.pageSettings ?? {}) })];
  const sections = normalizeSections(sourceSections, input.pageSettings);
  const sectionIds = new Set(sections.map((section) => section.id));
  let activeSectionId = sections[0]?.id ?? "section-1";
  const normalizedBlocks = Array.isArray(input.blocks)
    ? input.blocks.map((block, index) => {
        const normalized = normalizeBlock(block, index, activeSectionId);
        if (!sectionIds.has(normalized.sectionId)) normalized.sectionId = activeSectionId;
        if (isBreakBlock(normalized) && normalized.breakKind === "section" && normalized.nextSectionId && sectionIds.has(normalized.nextSectionId)) {
          activeSectionId = normalized.nextSectionId;
        } else if (!isBreakBlock(normalized)) {
          activeSectionId = normalized.sectionId;
        }
        return normalized;
      })
    : [];
  const blocks = normalizedBlocks.length > 0
    ? normalizedBlocks
    : [createEmptyParagraph("block-1", "run-1", activeSectionId)];
  if (!blocks.some(isTextBlock)) {
    blocks.push(createEmptyParagraph(uniqueBlockId(blocks, "block-text"), "run-text-1", activeSectionId));
  }

  const rawImages = input.resources?.images ?? {};
  const images: Record<string, ImageResource> = {};
  for (const [key, value] of Object.entries(rawImages)) {
    const resource = normalizeImageResource(value, key);
    images[resource.id] = resource;
  }

  const firstPage = sections[0]?.pageSettings ?? DEFAULT_PAGE_SETTINGS;
  return {
    metadata: {
      id: metadata.id || "document",
      title: metadata.title || "Documento",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: Number(metadata.createdAt) || Date.now(),
      updatedAt: Number(metadata.updatedAt) || Date.now(),
      revision: Math.max(0, Number(metadata.revision) || 0),
    },
    pageSettings: { ...firstPage },
    sections,
    resources: { images },
    review: normalizeReviewState(input.review),
    blocks,
  };
}

export function normalizeBlock(
  block: DocumentBlock,
  blockIndex = 0,
  fallbackSectionId = "section-1",
): DocumentBlock {
  const candidate = block as DocumentBlock & { blockType?: string; sectionId?: string };
  if (candidate.blockType === "break" || "breakKind" in candidate) {
    return normalizeBreakBlock(candidate as BreakBlock, blockIndex, fallbackSectionId);
  }
  if (candidate.blockType === "table" || ("rows" in candidate && !("runs" in candidate))) {
    return normalizeTableBlock(candidate as TableBlock, blockIndex, fallbackSectionId);
  }
  if (candidate.blockType === "image" || ("resourceId" in candidate && !("runs" in candidate))) {
    return normalizeImageBlock(candidate as ImageBlock, blockIndex, fallbackSectionId);
  }
  return normalizeTextBlock(candidate as TextBlock, blockIndex, fallbackSectionId);
}

function normalizeTextBlock(block: TextBlock, blockIndex: number, fallbackSectionId: string): TextBlock {
  const id = block.id || `block-${blockIndex + 1}`;
  const runs = normalizeRuns(id, block.runs, DEFAULT_TEXT_STYLE);
  const rawList = block.list;
  const list = rawList
    ? {
        id: rawList.id || `${id}-list`,
        kind: rawList.kind === "number" ? "number" as const : "bullet" as const,
        level: clampInteger(rawList.level, 0, 8),
        start: clampInteger(rawList.start, 1, 9999),
      }
    : null;
  return {
    blockType: "text",
    id,
    sectionId: block.sectionId || fallbackSectionId,
    kind: normalizeKind(block.kind),
    paragraphStyle: normalizeParagraphStyle(block.paragraphStyle),
    list,
    runs,
  };
}

function normalizeTableBlock(block: TableBlock, blockIndex: number, fallbackSectionId: string): TableBlock {
  const id = block.id || `table-${blockIndex + 1}`;
  const sourceRows = Array.isArray(block.rows) && block.rows.length > 0
    ? block.rows
    : [{ id: `${id}-row-1`, cells: [createTableCell(`${id}-cell-1-1`)] }];
  const columnCount = Math.max(1, ...sourceRows.map((row) => row.cells?.length ?? 0));
  const rows = sourceRows.map((row, rowIndex) => ({
    id: row.id || `${id}-row-${rowIndex + 1}`,
    cells: Array.from({ length: columnCount }, (_, columnIndex) => {
      const source = row.cells?.[columnIndex];
      return normalizeTableCell(source, `${id}-cell-${rowIndex + 1}-${columnIndex + 1}`);
    }),
  }));
  return {
    blockType: "table",
    id,
    sectionId: block.sectionId || fallbackSectionId,
    rows,
    columnWidthsMm: Array.from({ length: columnCount }, (_, index) =>
      clamp(block.columnWidthsMm?.[index] ?? 35, 10, 120),
    ),
    style: {
      ...DEFAULT_TABLE_STYLE,
      ...(block.style ?? {}),
      headerRows: clampInteger(block.style?.headerRows ?? 0, 0, rows.length),
      keepRowsTogether: Boolean(block.style?.keepRowsTogether),
    },
  };
}

function normalizeTableCell(cell: TableCell | undefined, fallbackId: string): TableCell {
  const id = cell?.id || fallbackId;
  return {
    id,
    paragraphStyle: normalizeParagraphStyle({
      ...DEFAULT_PARAGRAPH_STYLE,
      spaceAfterPt: 0,
      ...(cell?.paragraphStyle ?? {}),
    }),
    runs: normalizeRuns(id, cell?.runs ?? [], DEFAULT_TEXT_STYLE),
    backgroundColor: cell?.backgroundColor ?? null,
  };
}

function normalizeImageBlock(block: ImageBlock, blockIndex: number, fallbackSectionId: string): ImageBlock {
  return {
    blockType: "image",
    id: block.id || `image-${blockIndex + 1}`,
    sectionId: block.sectionId || fallbackSectionId,
    resourceId: block.resourceId || "missing-image-resource",
    alt: block.alt ?? "",
    widthMm: clamp(block.widthMm ?? 90, 10, 180),
    heightMm: clamp(block.heightMm ?? 60, 10, 240),
    alignment: block.alignment === "left" || block.alignment === "right" ? block.alignment : "center",
    caption: block.caption ?? "",
    keepWithNext: Boolean(block.keepWithNext),
  };
}

function normalizeBreakBlock(block: BreakBlock, blockIndex: number, fallbackSectionId: string): BreakBlock {
  const breakKind: BreakKind = block.breakKind === "column" || block.breakKind === "section" ? block.breakKind : "page";
  return {
    blockType: "break",
    id: block.id || `break-${blockIndex + 1}`,
    sectionId: block.sectionId || fallbackSectionId,
    breakKind,
    startType: block.startType === "continuous" ? "continuous" : "next-page",
    nextSectionId: breakKind === "section" ? block.nextSectionId ?? null : null,
  };
}

function normalizeImageResource(resource: ImageResource, fallbackId: string): ImageResource {
  return {
    id: resource.id || fallbackId,
    kind: "image",
    name: resource.name || "imagen",
    mimeType: resource.mimeType || "application/octet-stream",
    dataUrl: resource.dataUrl || "",
    byteLength: Math.max(0, Number(resource.byteLength) || 0),
    createdAt: Math.max(0, Number(resource.createdAt) || 0),
  };
}

function normalizeSections(source: DocumentSection[], legacyPageSettings?: PageSettings): DocumentSection[] {
  const used = new Set<string>();
  const sections = source.map((section, index) => {
    let id = section?.id || `section-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    const pageSettings = normalizePageSettings(section?.pageSettings ?? (index === 0 ? legacyPageSettings : undefined));
    return {
      id,
      name: section?.name || `Sección ${index + 1}`,
      pageSettings,
      columns: normalizeColumns(section?.columns),
      headers: normalizeHeaderFooterVariants(section?.headers),
      footers: normalizeHeaderFooterVariants(section?.footers),
      differentFirstPage: Boolean(section?.differentFirstPage),
      differentOddEven: Boolean(section?.differentOddEven),
      pageNumbering: normalizePageNumbering(section?.pageNumbering),
    };
  });
  return sections.length > 0 ? sections : [createDocumentSection("section-1")];
}

function normalizePageSettings(settings?: Partial<PageSettings>): PageSettings {
  const merged = { ...DEFAULT_PAGE_SETTINGS, ...(settings ?? {}) };
  return {
    widthMm: clamp(merged.widthMm, 80, 500),
    heightMm: clamp(merged.heightMm, 80, 500),
    marginTopMm: clamp(merged.marginTopMm, 0, 100),
    marginRightMm: clamp(merged.marginRightMm, 0, 100),
    marginBottomMm: clamp(merged.marginBottomMm, 0, 100),
    marginLeftMm: clamp(merged.marginLeftMm, 0, 100),
  };
}

function normalizeColumns(columns?: Partial<SectionColumns>): SectionColumns {
  return {
    count: clampInteger(columns?.count ?? 1, 1, 4),
    gapMm: clamp(columns?.gapMm ?? 8, 0, 40),
    lineBetween: Boolean(columns?.lineBetween),
    balance: Boolean(columns?.balance),
  };
}

function normalizePageNumbering(value?: Partial<PageNumbering>): PageNumbering {
  const format = value?.format === "roman-lower" || value?.format === "roman-upper" ? value.format : "decimal";
  return {
    restart: Boolean(value?.restart),
    start: clampInteger(value?.start ?? 1, 1, 999999),
    format,
  };
}

function normalizeHeaderFooterVariants(value?: Partial<HeaderFooterVariants>): HeaderFooterVariants {
  return {
    default: normalizeHeaderFooterContent(value?.default),
    first: normalizeHeaderFooterContent(value?.first),
    even: normalizeHeaderFooterContent(value?.even),
  };
}

export function normalizeHeaderFooterContent(value?: Partial<HeaderFooterContent>): HeaderFooterContent {
  const items = Array.isArray(value?.items)
    ? value.items.map((item, index): HeaderFooterItem => {
        const style = { ...DEFAULT_TEXT_STYLE, ...(item.style ?? {}) };
        if (item.type === "field") {
          return {
            id: item.id || `hf-field-${index + 1}`,
            type: "field",
            field: normalizeFieldKind(item.field),
            style,
          };
        }
        return {
          id: item.id || `hf-text-${index + 1}`,
          type: "text",
          text: item.text ?? "",
          style,
        };
      })
    : [];
  return {
    enabled: Boolean(value?.enabled),
    alignment: normalizeAlignment(value?.alignment),
    distanceFromEdgeMm: clamp(value?.distanceFromEdgeMm ?? 12.7, 0, 50),
    items,
  };
}

function normalizeParagraphStyle(value?: Partial<ParagraphStyle>): ParagraphStyle {
  return {
    ...DEFAULT_PARAGRAPH_STYLE,
    ...(value ?? {}),
    alignment: normalizeAlignment(value?.alignment),
    lineHeight: clamp(value?.lineHeight ?? DEFAULT_PARAGRAPH_STYLE.lineHeight, 0.8, 4),
    spaceBeforePt: Math.max(0, Number(value?.spaceBeforePt) || 0),
    spaceAfterPt: Math.max(0, Number(value?.spaceAfterPt) || 0),
    firstLineIndentMm: clamp(value?.firstLineIndentMm ?? 0, -30, 100),
    keepWithNext: Boolean(value?.keepWithNext),
    keepLinesTogether: Boolean(value?.keepLinesTogether),
    pageBreakBefore: Boolean(value?.pageBreakBefore),
    widowControl: value?.widowControl !== false,
  };
}

export function normalizeRuns(
  ownerId: string,
  runs: TextRun[] | undefined,
  fallbackStyle: TextStyle,
  emptyRunId = `${ownerId}-run-1`,
): TextRun[] {
  const source = Array.isArray(runs) ? runs : [];
  const merged: TextRun[] = [];
  for (const rawRun of source) {
    const run: TextRun = {
      id: rawRun.id || `${ownerId}-run-${merged.length + 1}`,
      text: rawRun.text ?? "",
      style: { ...DEFAULT_TEXT_STYLE, ...(rawRun.style ?? {}) },
      hyperlink: normalizeHyperlink(rawRun.hyperlink),
    };
    if (!run.text) continue;
    const previous = merged.at(-1);
    if (previous && equalTextStyle(previous.style, run.style) && equalHyperlink(previous.hyperlink, run.hyperlink)) {
      previous.text += run.text;
    } else {
      merged.push(run);
    }
  }
  if (merged.length === 0) {
    return [{ id: emptyRunId, text: "", style: { ...fallbackStyle }, hyperlink: null }];
  }
  return merged.map((run, index) => ({ ...run, id: `${ownerId}-run-${index + 1}` }));
}

export function isTextBlock(block: DocumentBlock): block is TextBlock {
  return block.blockType === "text";
}

export function isTableBlock(block: DocumentBlock): block is TableBlock {
  return block.blockType === "table";
}

export function isImageBlock(block: DocumentBlock): block is ImageBlock {
  return block.blockType === "image";
}

export function isBreakBlock(block: DocumentBlock): block is BreakBlock {
  return block.blockType === "break";
}

export function blockText(block: TextBlock): string {
  return block.runs.map((run) => run.text).join("");
}

export function tableCellText(cell: TableCell): string {
  return cell.runs.map((run) => run.text).join("");
}

export function documentBlockText(block: DocumentBlock): string {
  if (isTextBlock(block)) return blockText(block);
  if (isTableBlock(block)) return block.rows.map((row) => row.cells.map(tableCellText).join("\t")).join("\n");
  if (isImageBlock(block)) return block.caption || block.alt;
  return block.breakKind === "section" ? "[Salto de sección]" : block.breakKind === "column" ? "[Salto de columna]" : "[Salto de página]";
}

export function characterLength(value: string): number {
  return Array.from(value).length;
}

export function styleAtOffset(block: TextBlock, offset: number): TextStyle {
  let cursor = 0;
  const total = characterLength(blockText(block));
  for (const run of block.runs) {
    const end = cursor + characterLength(run.text);
    if (offset < end || (offset === end && end === total)) return { ...run.style };
    cursor = end;
  }
  return { ...(block.runs.at(-1)?.style ?? DEFAULT_TEXT_STYLE) };
}

export function sliceRuns(block: TextBlock, start: number, end: number): TextRun[] {
  return sliceTextRuns(block.runs, start, end, block.id, styleAtOffset(block, start));
}

export function sliceTextRuns(
  runs: TextRun[],
  start: number,
  end: number,
  ownerId: string,
  fallbackStyle: TextStyle,
): TextRun[] {
  const result: TextRun[] = [];
  let cursor = 0;
  for (const run of runs) {
    const characters = Array.from(run.text);
    const runStart = cursor;
    const runEnd = cursor + characters.length;
    const from = Math.max(start, runStart);
    const to = Math.min(end, runEnd);
    if (from < to) {
      result.push({
        id: `${ownerId}-slice-${from}-${to}`,
        text: characters.slice(from - runStart, to - runStart).join(""),
        style: { ...run.style },
      });
    }
    cursor = runEnd;
  }
  return normalizeRuns(ownerId, result, fallbackStyle);
}

export function cloneDocumentBlock<T extends DocumentBlock>(block: T): T {
  return structuredClone(block);
}

export function cloneDocumentFragment(fragment: DocumentFragment): DocumentFragment {
  return structuredClone(fragment);
}

export function equalTextStyle(left: TextStyle, right: TextStyle): boolean {
  return left.bold === right.bold
    && left.italic === right.italic
    && left.underline === right.underline
    && left.strike === right.strike
    && left.fontFamily === right.fontFamily
    && left.fontSizePt === right.fontSizePt
    && left.color === right.color
    && left.highlight === right.highlight;
}

export function getSection(documentModel: TextDocument, sectionId: string): DocumentSection {
  return documentModel.sections.find((section) => section.id === sectionId)
    ?? documentModel.sections[0]
    ?? createDocumentSection("section-1");
}

export function getSectionForBlock(documentModel: TextDocument, blockId: string): DocumentSection {
  const block = documentModel.blocks.find((item) => item.id === blockId);
  return getSection(documentModel, block?.sectionId ?? documentModel.sections[0]?.id ?? "section-1");
}

export function chooseHeaderFooterVariant(
  section: DocumentSection,
  sectionPageNumber: number,
): HeaderFooterVariant {
  if (section.differentFirstPage && sectionPageNumber === 1) return "first";
  if (section.differentOddEven && sectionPageNumber % 2 === 0) return "even";
  return "default";
}

export function resolveHeaderFooterContent(
  content: HeaderFooterContent,
  context: HeaderFooterContext,
): string {
  if (!content.enabled) return "";
  const now = context.now ?? new Date();
  return content.items.map((item) => {
    if (item.type === "text") return item.text;
    switch (item.field) {
      case "page-number": return String(context.sectionPageNumber);
      case "page-count": return String(context.pageCount);
      case "date": return now.toLocaleDateString();
      case "time": return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      case "title": return context.title;
      case "section-name": return context.sectionName;
    }
  }).join("");
}

const FIELD_TOKENS: Record<DynamicFieldKind, string> = {
  "page-number": "{{PAGE}}",
  "page-count": "{{PAGES}}",
  date: "{{DATE}}",
  time: "{{TIME}}",
  title: "{{TITLE}}",
  "section-name": "{{SECTION}}",
};

export function headerFooterToTemplate(content: HeaderFooterContent): string {
  return content.items.map((item) => item.type === "text" ? item.text : FIELD_TOKENS[item.field]).join("");
}

export function headerFooterFromTemplate(
  template: string,
  options: Partial<Pick<HeaderFooterContent, "enabled" | "alignment" | "distanceFromEdgeMm">> = {},
  idPrefix = "hf",
): HeaderFooterContent {
  const tokenPattern = /\{\{(PAGE|PAGES|DATE|TIME|TITLE|SECTION)\}\}/gu;
  const items: HeaderFooterItem[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of template.matchAll(tokenPattern)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      index += 1;
      items.push({ id: `${idPrefix}-text-${index}`, type: "text", text: template.slice(cursor, start), style: { ...DEFAULT_TEXT_STYLE, fontSizePt: 9 } });
    }
    index += 1;
    items.push({
      id: `${idPrefix}-field-${index}`,
      type: "field",
      field: tokenToField(match[1] ?? "PAGE"),
      style: { ...DEFAULT_TEXT_STYLE, fontSizePt: 9 },
    });
    cursor = start + match[0].length;
  }
  if (cursor < template.length || items.length === 0) {
    index += 1;
    items.push({ id: `${idPrefix}-text-${index}`, type: "text", text: template.slice(cursor), style: { ...DEFAULT_TEXT_STYLE, fontSizePt: 9 } });
  }
  return normalizeHeaderFooterContent({
    enabled: options.enabled ?? template.length > 0,
    alignment: options.alignment ?? "center",
    distanceFromEdgeMm: options.distanceFromEdgeMm ?? 12.7,
    items,
  });
}

export function formatPageNumber(value: number, format: PageNumbering["format"]): string {
  if (format === "decimal") return String(value);
  const roman = toRoman(Math.max(1, Math.round(value)));
  return format === "roman-lower" ? roman.toLowerCase() : roman;
}

export function equalHyperlink(left?: Hyperlink | null, right?: Hyperlink | null): boolean {
  return (left?.href ?? "") === (right?.href ?? "")
    && (left?.title ?? "") === (right?.title ?? "");
}

function normalizeHyperlink(value?: Partial<Hyperlink> | null): Hyperlink | null {
  const href = String(value?.href ?? "").trim();
  if (!href) return null;
  return { href, title: value?.title ? String(value.title) : null };
}

function normalizeReviewState(value?: Partial<ReviewState>): ReviewState {
  const comments = Array.isArray(value?.comments) ? value.comments.map((thread, index): CommentThread => ({
    id: thread.id || `comment-${index + 1}`,
    range: normalizeDocumentRange(thread.range),
    quote: String(thread.quote ?? ""),
    messages: Array.isArray(thread.messages) ? thread.messages.map((message, messageIndex) => ({
      id: message.id || `comment-${index + 1}-message-${messageIndex + 1}`,
      author: String(message.author || value?.author || "Autor local"),
      text: String(message.text ?? ""),
      createdAt: Math.max(0, Number(message.createdAt) || 0),
      updatedAt: Math.max(0, Number(message.updatedAt) || Number(message.createdAt) || 0),
    })) : [],
    resolved: Boolean(thread.resolved),
    createdAt: Math.max(0, Number(thread.createdAt) || 0),
    updatedAt: Math.max(0, Number(thread.updatedAt) || Number(thread.createdAt) || 0),
  })) : [];
  const bookmarks = Array.isArray(value?.bookmarks) ? value.bookmarks.map((bookmark, index): Bookmark => ({
    id: bookmark.id || `bookmark-${index + 1}`,
    name: String(bookmark.name || `Marcador ${index + 1}`),
    range: normalizeDocumentRange(bookmark.range),
    createdAt: Math.max(0, Number(bookmark.createdAt) || 0),
  })) : [];
  const changes = Array.isArray(value?.changes) ? value.changes.map((change, index): TrackedChange => ({
    id: change.id || `change-${index + 1}`,
    kind: change.kind === "insert" || change.kind === "delete" || change.kind === "format" || change.kind === "structure" ? change.kind : "replace",
    author: String(change.author || value?.author || "Autor local"),
    summary: String(change.summary || "Cambio documental"),
    commandType: change.commandType || "replaceDocumentRange",
    createdAt: Math.max(0, Number(change.createdAt) || 0),
    status: change.status === "accepted" || change.status === "rejected" || change.status === "conflict" ? change.status : "pending",
    beforeSnapshot: typeof change.beforeSnapshot === "string" ? change.beforeSnapshot : null,
    afterRevision: Math.max(0, Number(change.afterRevision) || 0),
  })) : [];
  return {
    author: String(value?.author || "Autor local"),
    trackChanges: Boolean(value?.trackChanges),
    comments,
    bookmarks,
    changes,
  };
}

function normalizeDocumentRange(value?: Partial<DocumentRange>): DocumentRange {
  const start = value?.start ?? { blockId: "block-1", offset: 0 };
  const end = value?.end ?? start;
  return {
    start: { blockId: String(start.blockId || "block-1"), offset: Math.max(0, Math.round(Number(start.offset) || 0)) },
    end: { blockId: String(end.blockId || start.blockId || "block-1"), offset: Math.max(0, Math.round(Number(end.offset) || 0)) },
  };
}

function normalizeKind(kind: BlockKind | undefined): BlockKind {
  if (kind?.type === "heading") {
    return { type: "heading", level: clampInteger(kind.level, 1, 6) };
  }
  return { type: "paragraph" };
}

function normalizeAlignment(value: TextAlignment | undefined): TextAlignment {
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function normalizeFieldKind(value: DynamicFieldKind | undefined): DynamicFieldKind {
  return value === "page-count" || value === "date" || value === "time" || value === "title" || value === "section-name"
    ? value
    : "page-number";
}

function tokenToField(value: string): DynamicFieldKind {
  switch (value) {
    case "PAGES": return "page-count";
    case "DATE": return "date";
    case "TIME": return "time";
    case "TITLE": return "title";
    case "SECTION": return "section-name";
    default: return "page-number";
  }
}

function toRoman(value: number): string {
  const pairs: Array<[number, string]> = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remaining = value;
  let result = "";
  for (const [amount, symbol] of pairs) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }
  return result;
}

function uniqueBlockId(blocks: DocumentBlock[], base: string): string {
  const ids = new Set(blocks.map((block) => block.id));
  if (!ids.has(base)) return base;
  let index = 2;
  while (ids.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
