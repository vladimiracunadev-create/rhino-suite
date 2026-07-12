import {
  blockText,
  chooseHeaderFooterVariant,
  formatPageNumber,
  getSection,
  isBreakBlock,
  isImageBlock,
  isTableBlock,
  isTextBlock,
  resolveHeaderFooterContent,
  tableCellText,
  type BreakBlock,
  type DocumentBlock,
  type DocumentSection,
  type ImageBlock,
  type PageSettings,
  type TableBlock,
  type TableCell,
  type TextBlock,
  type TextDocument,
  type TextStyle,
  type TextAlignment,
} from "./model";

const CSS_PIXELS_PER_MM = 96 / 25.4;
const CSS_PIXELS_PER_POINT = 96 / 72;
const BREAK_MARKER_HEIGHT_PX = 24;

export interface TextMeasurer {
  measure(character: string, style: TextStyle): number;
}

export interface LayoutLine {
  start: number;
  end: number;
  text: string;
  widthPx: number;
  heightPx: number;
}

interface BaseBlockLayout {
  blockId: string;
  sectionId: string;
}

export interface TextBlockLayout extends BaseBlockLayout {
  kind: "text";
  lines: LayoutLine[];
  listLabel: string | null;
  listIndentPx: number;
  spaceBeforePx: number;
  spaceAfterPx: number;
  totalHeightPx: number;
  keepWithNext: boolean;
  keepLinesTogether: boolean;
  pageBreakBefore: boolean;
  widowControl: boolean;
}

export interface TableBlockLayout extends BaseBlockLayout {
  kind: "table";
  rowHeightsPx: number[];
  columnWidthsPx: number[];
  totalHeightPx: number;
  keepRowsTogether: boolean;
}

export interface ImageBlockLayout extends BaseBlockLayout {
  kind: "image";
  widthPx: number;
  heightPx: number;
  captionHeightPx: number;
  totalHeightPx: number;
  keepWithNext: boolean;
}

export interface BreakBlockLayout extends BaseBlockLayout {
  kind: "break";
  breakKind: BreakBlock["breakKind"];
  startType: BreakBlock["startType"];
  nextSectionId: string | null;
  totalHeightPx: number;
}

export type BlockLayout = TextBlockLayout | TableBlockLayout | ImageBlockLayout | BreakBlockLayout;

interface BasePageFragment {
  blockId: string;
  columnIndex: number;
}

export interface TextPageFragment extends BasePageFragment {
  kind: "text";
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
  firstFragment: boolean;
  lastFragment: boolean;
  heightPx: number;
}

export interface TablePageFragment extends BasePageFragment {
  kind: "table";
  rowStart: number;
  rowEnd: number;
  firstFragment: boolean;
  lastFragment: boolean;
  heightPx: number;
}

export interface ImagePageFragment extends BasePageFragment {
  kind: "image";
  heightPx: number;
}

export interface BreakPageFragment extends BasePageFragment {
  kind: "break";
  breakKind: BreakBlock["breakKind"];
  label: string;
  heightPx: number;
}

export type PageFragment = TextPageFragment | TablePageFragment | ImagePageFragment | BreakPageFragment;

export interface PageColumnLayout {
  index: number;
  xPx: number;
  widthPx: number;
  gapAfterPx: number;
  usedHeightPx: number;
  fragments: PageFragment[];
}

export interface PageLayout {
  number: number;
  sectionId: string;
  sectionPageNumber: number;
  pageLabel: string;
  pageWidthPx: number;
  pageHeightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  columnGapPx: number;
  lineBetweenColumns: boolean;
  columns: PageColumnLayout[];
  /** Vista plana para compatibilidad con consumidores anteriores. */
  fragments: PageFragment[];
  usedHeightPx: number;
  headerText: string;
  footerText: string;
  headerAlignment: TextAlignment;
  footerAlignment: TextAlignment;
  headerDistancePx: number;
  footerDistancePx: number;
}

export interface DocumentLayout {
  pageWidthPx: number;
  pageHeightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  blocks: BlockLayout[];
  pages: PageLayout[];
}

export interface LayoutOptions {
  zoom?: number;
  measurer?: TextMeasurer;
  now?: Date;
}

export function createCanvasTextMeasurer(): TextMeasurer {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const cache = new Map<string, number>();
  return {
    measure(character, style) {
      const key = `${style.fontFamily}|${style.fontSizePt}|${style.bold}|${style.italic}|${character}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      if (!context) return approximateMeasure(character, style);
      context.font = `${style.italic ? "italic " : ""}${style.bold ? "700 " : "400 "}${style.fontSizePt * CSS_PIXELS_PER_POINT}px ${style.fontFamily}`;
      const width = context.measureText(character).width;
      cache.set(key, width);
      return width;
    },
  };
}

export function createApproximateTextMeasurer(): TextMeasurer {
  return { measure: approximateMeasure };
}

export function layoutDocument(
  documentModel: TextDocument,
  options: LayoutOptions = {},
): DocumentLayout {
  const zoom = clamp(options.zoom ?? 1, 0.5, 2);
  const measurer = options.measurer ?? createApproximateTextMeasurer();
  const listLabels = computeListLabels(documentModel);
  const blocks: BlockLayout[] = [];
  const pages: PageLayout[] = [];
  const sectionPageCounts = new Map<string, number>();
  let page: PageLayout | null = null;
  let columnIndex = 0;

  const ensurePage = (sectionId: string, forceNew = false): PageLayout => {
    if (!page || forceNew || page.sectionId !== sectionId) {
      const section = getSection(documentModel, sectionId);
      const sectionPageNumber = (sectionPageCounts.get(section.id) ?? 0) + 1;
      sectionPageCounts.set(section.id, sectionPageNumber);
      page = createPageLayout(pages.length + 1, section, sectionPageNumber, zoom);
      pages.push(page);
      columnIndex = 0;
    }
    return page;
  };

  const advanceColumn = (sectionId: string): void => {
    const current = ensurePage(sectionId);
    if (columnIndex + 1 < current.columns.length) {
      columnIndex += 1;
    } else {
      ensurePage(sectionId, true);
    }
  };

  for (const source of documentModel.blocks) {
    const section = getSection(documentModel, source.sectionId);
    const current = ensurePage(section.id);
    const column = current.columns[columnIndex] ?? current.columns[0];
    if (!column) continue;
    const layout = layoutBlock(source, column.widthPx, zoom, measurer, listLabels.get(source.id) ?? null);
    blocks.push(layout);

    if (layout.kind === "break") {
      const fragment: BreakPageFragment = {
        kind: "break",
        blockId: layout.blockId,
        columnIndex,
        breakKind: layout.breakKind,
        label: breakLabel(layout.breakKind),
        heightPx: layout.totalHeightPx,
      };
      if (remainingHeight(current, columnIndex) >= fragment.heightPx) pushFragment(current, columnIndex, fragment);
      if (layout.breakKind === "column") {
        advanceColumn(section.id);
      } else if (layout.breakKind === "page") {
        ensurePage(section.id, true);
      } else {
        const nextSectionId = layout.nextSectionId ?? section.id;
        if (layout.startType === "continuous" && canContinueSection(current, getSection(documentModel, nextSectionId), zoom)) {
          if (columnIndex + 1 < current.columns.length) {
            columnIndex += 1;
          } else {
            ensurePage(nextSectionId, true);
          }
        } else {
          ensurePage(nextSectionId, true);
        }
      }
      continue;
    }

    if (layout.kind === "text" && layout.pageBreakBefore && current.columns.some((item) => item.fragments.length > 0)) {
      ensurePage(section.id, true);
      columnIndex = 0;
    }

    if (layout.kind === "text") {
      paginateText(layout, section.id, () => ensurePage(section.id), () => advanceColumn(section.id), () => columnIndex, (value) => { columnIndex = value; });
    } else if (layout.kind === "table") {
      paginateTable(layout, section.id, () => ensurePage(section.id), () => advanceColumn(section.id), () => columnIndex);
    } else {
      paginateImage(layout, section.id, () => ensurePage(section.id), () => advanceColumn(section.id), () => columnIndex);
    }
  }

  if (pages.length === 0) pages.push(createPageLayout(1, documentModel.sections[0] ?? getSection(documentModel, "section-1"), 1, zoom));
  finalizePages(documentModel, pages, options.now ?? new Date());
  const first = pages[0];
  return {
    pageWidthPx: first?.pageWidthPx ?? mmToPx(210) * zoom,
    pageHeightPx: first?.pageHeightPx ?? mmToPx(297) * zoom,
    contentWidthPx: first?.contentWidthPx ?? mmToPx(159.2) * zoom,
    contentHeightPx: first?.contentHeightPx ?? mmToPx(246.2) * zoom,
    marginTopPx: first?.marginTopPx ?? mmToPx(25.4) * zoom,
    marginRightPx: first?.marginRightPx ?? mmToPx(25.4) * zoom,
    marginBottomPx: first?.marginBottomPx ?? mmToPx(25.4) * zoom,
    marginLeftPx: first?.marginLeftPx ?? mmToPx(25.4) * zoom,
    blocks,
    pages,
  };

  function paginateText(
    block: TextBlockLayout,
    sectionId: string,
    getPage: () => PageLayout,
    nextColumn: () => void,
    getColumnIndex: () => number,
    setColumnIndex: (value: number) => void,
  ): void {
    let lineStart = 0;
    if (block.keepLinesTogether && block.totalHeightPx <= getPage().contentHeightPx && block.totalHeightPx > remainingHeight(getPage(), getColumnIndex())) nextColumn();
    while (lineStart < block.lines.length) {
      const currentPage = getPage();
      const currentColumnIndex = getColumnIndex();
      const available = remainingHeight(currentPage, currentColumnIndex);
      const firstFragment = lineStart === 0;
      const before = firstFragment ? block.spaceBeforePx : 0;
      let used = before;
      let lineEnd = lineStart;
      while (lineEnd < block.lines.length) {
        const line = block.lines[lineEnd];
        if (!line || used + line.heightPx > available) break;
        used += line.heightPx;
        lineEnd += 1;
      }
      if (lineEnd === lineStart) {
        nextColumn();
        continue;
      }
      if (block.widowControl) {
        const remainingLines = block.lines.length - lineEnd;
        const placedLines = lineEnd - lineStart;
        if (remainingLines === 1 && placedLines > 1) {
          lineEnd -= 1;
          used -= block.lines[lineEnd]?.heightPx ?? 0;
        } else if (lineStart === 0 && placedLines === 1 && block.lines.length > 1 && currentPage.columns[currentColumnIndex]?.fragments.length) {
          nextColumn();
          continue;
        }
      }
      const lastFragment = lineEnd === block.lines.length;
      if (lastFragment && used + block.spaceAfterPx <= available) used += block.spaceAfterPx;
      const start = block.lines[lineStart]?.start ?? 0;
      const end = block.lines[Math.max(lineStart, lineEnd - 1)]?.end ?? start;
      pushFragment(currentPage, currentColumnIndex, {
        kind: "text",
        blockId: block.blockId,
        columnIndex: currentColumnIndex,
        start,
        end,
        lineStart,
        lineEnd,
        firstFragment,
        lastFragment,
        heightPx: used,
      });
      lineStart = lineEnd;
      if (!lastFragment) nextColumn();
    }
    setColumnIndex(getColumnIndex());
  }

  function paginateTable(
    block: TableBlockLayout,
    sectionId: string,
    getPage: () => PageLayout,
    nextColumn: () => void,
    getColumnIndex: () => number,
  ): void {
    if (block.keepRowsTogether && block.totalHeightPx <= getPage().contentHeightPx && block.totalHeightPx > remainingHeight(getPage(), getColumnIndex())) nextColumn();
    let rowStart = 0;
    while (rowStart < block.rowHeightsPx.length) {
      const currentPage = getPage();
      const currentColumnIndex = getColumnIndex();
      const available = remainingHeight(currentPage, currentColumnIndex);
      let rowEnd = rowStart;
      let used = rowStart === 0 ? 4 : 0;
      while (rowEnd < block.rowHeightsPx.length) {
        const height = block.rowHeightsPx[rowEnd] ?? 0;
        if (used + height > available) break;
        used += height;
        rowEnd += 1;
      }
      if (rowEnd === rowStart) {
        nextColumn();
        continue;
      }
      const lastFragment = rowEnd === block.rowHeightsPx.length;
      pushFragment(currentPage, currentColumnIndex, {
        kind: "table",
        blockId: block.blockId,
        columnIndex: currentColumnIndex,
        rowStart,
        rowEnd,
        firstFragment: rowStart === 0,
        lastFragment,
        heightPx: used,
      });
      rowStart = rowEnd;
      if (!lastFragment) nextColumn();
    }
  }

  function paginateImage(
    block: ImageBlockLayout,
    sectionId: string,
    getPage: () => PageLayout,
    nextColumn: () => void,
    getColumnIndex: () => number,
  ): void {
    const currentPage = getPage();
    const currentColumnIndex = getColumnIndex();
    if (block.totalHeightPx > remainingHeight(currentPage, currentColumnIndex) && currentPage.columns[currentColumnIndex]?.fragments.length) nextColumn();
    const targetPage = getPage();
    const targetColumn = getColumnIndex();
    pushFragment(targetPage, targetColumn, {
      kind: "image",
      blockId: block.blockId,
      columnIndex: targetColumn,
      heightPx: Math.min(block.totalHeightPx, targetPage.contentHeightPx),
    });
  }
}

export function computeListLabels(documentModel: TextDocument): Map<string, string> {
  const labels = new Map<string, string>();
  const counters = new Map<string, number>();
  for (const block of documentModel.blocks) {
    if (!isTextBlock(block) || !block.list) continue;
    if (block.list.kind === "bullet") {
      const bullets = ["•", "◦", "▪", "–"];
      labels.set(block.id, bullets[block.list.level % bullets.length] ?? "•");
      continue;
    }
    const current = counters.get(block.list.id) ?? block.list.start;
    labels.set(block.id, `${current}.`);
    counters.set(block.list.id, current + 1);
  }
  return labels;
}

function layoutBlock(
  block: DocumentBlock,
  contentWidthPx: number,
  zoom: number,
  measurer: TextMeasurer,
  listLabel: string | null,
): BlockLayout {
  if (isTextBlock(block)) return layoutTextBlock(block, contentWidthPx, zoom, measurer, listLabel);
  if (isTableBlock(block)) return layoutTableBlock(block, contentWidthPx, zoom, measurer);
  if (isImageBlock(block)) return layoutImageBlock(block, contentWidthPx, zoom);
  return {
    kind: "break",
    blockId: block.id,
    sectionId: block.sectionId,
    breakKind: block.breakKind,
    startType: block.startType,
    nextSectionId: block.nextSectionId,
    totalHeightPx: BREAK_MARKER_HEIGHT_PX * zoom,
  };
}

function layoutTextBlock(
  block: TextBlock,
  contentWidthPx: number,
  zoom: number,
  measurer: TextMeasurer,
  listLabel: string | null,
): TextBlockLayout {
  const text = blockText(block);
  const headingScale = block.kind.type === "heading"
    ? block.kind.level === 1 ? 1.85 : block.kind.level === 2 ? 1.5 : 1.25
    : 1;
  const characters = Array.from(text);
  const styles = stylesByCharacter(block);
  const lines: LayoutLine[] = [];
  const listIndentPx = block.list ? (18 + block.list.level * 16) * zoom : 0;
  const indentPx = mmToPx(block.paragraphStyle.firstLineIndentMm) * zoom;
  let start = 0;
  let lineIndex = 0;

  if (characters.length === 0) {
    const style = block.runs[0]?.style;
    const fontSize = (style?.fontSizePt ?? 11) * CSS_PIXELS_PER_POINT * zoom * headingScale;
    lines.push({ start: 0, end: 0, text: "", widthPx: 0, heightPx: fontSize * block.paragraphStyle.lineHeight });
  }

  while (start < characters.length) {
    const available = Math.max(20, contentWidthPx - listIndentPx - (lineIndex === 0 ? indentPx : 0));
    let cursor = start;
    let width = 0;
    let maxFontPx = 11 * CSS_PIXELS_PER_POINT * zoom * headingScale;
    let lastBreak = -1;
    let widthAtBreak = 0;

    while (cursor < characters.length) {
      const character = characters[cursor] ?? "";
      if (character === "\n") break;
      const style = styles[cursor] ?? block.runs.at(-1)?.style;
      if (!style) break;
      const charWidth = measurer.measure(character, style) * zoom * headingScale;
      maxFontPx = Math.max(maxFontPx, style.fontSizePt * CSS_PIXELS_PER_POINT * zoom * headingScale);
      if (/\s/u.test(character)) {
        lastBreak = cursor;
        widthAtBreak = width + charWidth;
      }
      if (width + charWidth > available && cursor > start) break;
      width += charWidth;
      cursor += 1;
    }

    let end = cursor;
    let measuredWidth = width;
    if (cursor < characters.length && characters[cursor] !== "\n" && lastBreak >= start) {
      end = lastBreak + 1;
      measuredWidth = widthAtBreak;
    }
    if (end === start && cursor < characters.length && characters[cursor] !== "\n") {
      end = cursor + 1;
      const style = styles[cursor] ?? block.runs.at(-1)?.style;
      measuredWidth = style ? measurer.measure(characters[cursor] ?? "", style) * zoom * headingScale : 0;
    }

    lines.push({
      start,
      end,
      text: characters.slice(start, end).join(""),
      widthPx: measuredWidth,
      heightPx: maxFontPx * block.paragraphStyle.lineHeight,
    });
    start = end;
    if (characters[start] === "\n") start += 1;
    lineIndex += 1;
  }

  const spaceBeforePx = block.paragraphStyle.spaceBeforePt * CSS_PIXELS_PER_POINT * zoom;
  const spaceAfterPx = block.paragraphStyle.spaceAfterPt * CSS_PIXELS_PER_POINT * zoom;
  const totalHeightPx = lines.reduce((sum, line) => sum + line.heightPx, 0) + spaceBeforePx + spaceAfterPx;
  return {
    kind: "text",
    blockId: block.id,
    sectionId: block.sectionId,
    lines,
    listLabel,
    listIndentPx,
    spaceBeforePx,
    spaceAfterPx,
    totalHeightPx,
    keepWithNext: block.paragraphStyle.keepWithNext,
    keepLinesTogether: block.paragraphStyle.keepLinesTogether,
    pageBreakBefore: block.paragraphStyle.pageBreakBefore,
    widowControl: block.paragraphStyle.widowControl,
  };
}

function layoutTableBlock(
  block: TableBlock,
  contentWidthPx: number,
  zoom: number,
  measurer: TextMeasurer,
): TableBlockLayout {
  const rawWidths = block.columnWidthsMm.map((width) => mmToPx(width) * zoom);
  const rawTotal = rawWidths.reduce((sum, width) => sum + width, 0) || contentWidthPx;
  const scale = rawTotal > contentWidthPx ? contentWidthPx / rawTotal : 1;
  const columnWidthsPx = rawWidths.map((width) => width * scale);
  const paddingPx = mmToPx(block.style.cellPaddingMm) * zoom;
  const rowHeightsPx = block.rows.map((row) => Math.max(
    24 * zoom,
    ...row.cells.map((cell, index) => measureTableCell(cell, Math.max(20, (columnWidthsPx[index] ?? 60) - paddingPx * 2), zoom, measurer) + paddingPx * 2),
  ));
  return {
    kind: "table",
    blockId: block.id,
    sectionId: block.sectionId,
    rowHeightsPx,
    columnWidthsPx,
    totalHeightPx: rowHeightsPx.reduce((sum, height) => sum + height, 0) + 8 * zoom,
    keepRowsTogether: block.style.keepRowsTogether,
  };
}

function measureTableCell(cell: TableCell, widthPx: number, zoom: number, measurer: TextMeasurer): number {
  const text = tableCellText(cell);
  const style = cell.runs[0]?.style;
  if (!style) return 18 * zoom;
  const lineHeight = style.fontSizePt * CSS_PIXELS_PER_POINT * zoom * cell.paragraphStyle.lineHeight;
  if (!text) return lineHeight;
  let lines = 1;
  let current = 0;
  for (const character of Array.from(text)) {
    if (character === "\n") {
      lines += 1;
      current = 0;
      continue;
    }
    const width = measurer.measure(character, style) * zoom;
    if (current + width > widthPx && current > 0) {
      lines += 1;
      current = width;
    } else {
      current += width;
    }
  }
  return lines * lineHeight;
}

function layoutImageBlock(block: ImageBlock, contentWidthPx: number, zoom: number): ImageBlockLayout {
  const widthPx = Math.min(contentWidthPx, mmToPx(block.widthMm) * zoom);
  const scale = widthPx / Math.max(1, mmToPx(block.widthMm) * zoom);
  const heightPx = mmToPx(block.heightMm) * zoom * scale;
  const captionHeightPx = block.caption ? 24 * zoom : 0;
  return {
    kind: "image",
    blockId: block.id,
    sectionId: block.sectionId,
    widthPx,
    heightPx,
    captionHeightPx,
    totalHeightPx: heightPx + captionHeightPx + 10 * zoom,
    keepWithNext: block.keepWithNext,
  };
}

function createPageLayout(
  number: number,
  section: DocumentSection,
  sectionPageNumber: number,
  zoom: number,
): PageLayout {
  const page = section.pageSettings;
  const pageWidthPx = mmToPx(page.widthMm) * zoom;
  const pageHeightPx = mmToPx(page.heightMm) * zoom;
  const marginTopPx = mmToPx(page.marginTopMm) * zoom;
  const marginRightPx = mmToPx(page.marginRightMm) * zoom;
  const marginBottomPx = mmToPx(page.marginBottomMm) * zoom;
  const marginLeftPx = mmToPx(page.marginLeftMm) * zoom;
  const contentWidthPx = Math.max(40, pageWidthPx - marginLeftPx - marginRightPx);
  const contentHeightPx = Math.max(40, pageHeightPx - marginTopPx - marginBottomPx);
  const count = clampInteger(section.columns.count, 1, 4);
  const gap = mmToPx(section.columns.gapMm) * zoom;
  const columnWidth = Math.max(20, (contentWidthPx - gap * (count - 1)) / count);
  const columns = Array.from({ length: count }, (_, index): PageColumnLayout => ({
    index,
    xPx: index * (columnWidth + gap),
    widthPx: columnWidth,
    gapAfterPx: index < count - 1 ? gap : 0,
    usedHeightPx: 0,
    fragments: [],
  }));
  return {
    number,
    sectionId: section.id,
    sectionPageNumber,
    pageLabel: String(number),
    pageWidthPx,
    pageHeightPx,
    contentWidthPx,
    contentHeightPx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    columnGapPx: gap,
    lineBetweenColumns: section.columns.lineBetween,
    columns,
    fragments: [],
    usedHeightPx: 0,
    headerText: "",
    footerText: "",
    headerAlignment: "center",
    footerAlignment: "center",
    headerDistancePx: mmToPx(12.7) * zoom,
    footerDistancePx: mmToPx(12.7) * zoom,
  };
}

function pushFragment(page: PageLayout, columnIndex: number, fragment: PageFragment): void {
  const column = page.columns[columnIndex];
  if (!column) return;
  column.fragments.push(fragment);
  column.usedHeightPx += fragment.heightPx;
  page.fragments.push(fragment);
  page.usedHeightPx = Math.max(page.usedHeightPx, column.usedHeightPx);
}

function remainingHeight(page: PageLayout, columnIndex: number): number {
  const column = page.columns[columnIndex];
  return Math.max(0, page.contentHeightPx - (column?.usedHeightPx ?? 0));
}

function finalizePages(documentModel: TextDocument, pages: PageLayout[], now: Date): void {
  const sectionPageIndex = new Map<string, number>();
  for (const page of pages) {
    const section = getSection(documentModel, page.sectionId);
    const index = (sectionPageIndex.get(section.id) ?? 0) + 1;
    sectionPageIndex.set(section.id, index);
    const numeric = section.pageNumbering.restart
      ? section.pageNumbering.start + index - 1
      : page.number;
    page.sectionPageNumber = numeric;
    page.pageLabel = formatPageNumber(numeric, section.pageNumbering.format);
    const variant = chooseHeaderFooterVariant(section, index);
    const header = section.headers[variant];
    const footer = section.footers[variant];
    const context = {
      pageNumber: page.number,
      pageCount: pages.length,
      sectionPageNumber: numeric,
      title: documentModel.metadata.title,
      sectionName: section.name,
      now,
    };
    page.headerText = resolveHeaderFooterContent(header, context);
    page.footerText = resolveHeaderFooterContent(footer, context);
    page.headerAlignment = header.alignment;
    page.footerAlignment = footer.alignment;
    page.headerDistancePx = mmToPx(header.distanceFromEdgeMm) * (page.pageWidthPx / Math.max(1, mmToPx(section.pageSettings.widthMm)));
    page.footerDistancePx = mmToPx(footer.distanceFromEdgeMm) * (page.pageWidthPx / Math.max(1, mmToPx(section.pageSettings.widthMm)));
  }
}

function canContinueSection(page: PageLayout, section: DocumentSection, zoom: number): boolean {
  const settings = section.pageSettings;
  return nearlyEqual(page.pageWidthPx, mmToPx(settings.widthMm) * zoom)
    && nearlyEqual(page.pageHeightPx, mmToPx(settings.heightMm) * zoom)
    && page.columns.length === section.columns.count;
}

function breakLabel(kind: BreakBlock["breakKind"]): string {
  if (kind === "column") return "Salto de columna";
  if (kind === "section") return "Salto de sección";
  return "Salto de página";
}

function stylesByCharacter(block: TextBlock): TextStyle[] {
  const result: TextStyle[] = [];
  for (const run of block.runs) {
    for (let index = 0; index < Array.from(run.text).length; index += 1) result.push(run.style);
  }
  return result;
}

function approximateMeasure(character: string, style: TextStyle): number {
  const fontPx = style.fontSizePt * CSS_PIXELS_PER_POINT;
  if (/\s/u.test(character)) return fontPx * 0.32;
  if (/[ilI1.,;:!|]/u.test(character)) return fontPx * 0.3;
  if (/[MW@#%&]/u.test(character)) return fontPx * 0.9;
  if (/[^\u0000-\u00ff]/u.test(character)) return fontPx;
  return fontPx * (style.bold ? 0.59 : 0.55);
}

function mmToPx(value: number): number {
  return value * CSS_PIXELS_PER_MM;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.5;
}
