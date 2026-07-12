import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PARAGRAPH_STYLE,
  DEFAULT_TEXT_STYLE,
  blockText,
  characterLength,
  cloneDocumentBlock,
  createEmptyParagraph,
  createTextDocument,
  equalTextStyle,
  isBreakBlock,
  isImageBlock,
  isTableBlock,
  isTextBlock,
  normalizeBlock,
  normalizeDocument,
  normalizeRuns,
  sliceRuns,
  styleAtOffset,
  type BlockKind,
  type BreakBlock,
  type DocumentBlock,
  type DocumentCommand,
  type DocumentFragment,
  type DocumentSection,
  type DocumentPoint,
  type Bookmark,
  type CommentMessage,
  type CommentThread,
  type Hyperlink,
  type TrackedChange,
  type HeaderFooterArea,
  type HeaderFooterContent,
  type HeaderFooterVariant,
  type ImageBlock,
  type ListProperties,
  type ParagraphStylePatch,
  type TableBlock,
  type TableCell,
  type TableRow,
  type TextBlock,
  type TextDocument,
  type TextRun,
  type TextStyle,
  type TextStylePatch,
} from "./model";
import {
  emptyFragment,
  fragmentFromPlainText,
  orderDocumentPoints,
} from "./selection";

export type EngineKind = "rust-wasm" | "typescript-fallback";

export interface OfficeEngineClient {
  readonly kind: EngineKind;
  getDocument(): TextDocument;
  apply(command: DocumentCommand, now?: number): TextDocument;
  undo(now?: number): TextDocument;
  redo(now?: number): TextDocument;
  canUndo(): boolean;
  canRedo(): boolean;
  serialize(): string;
}

export class FallbackOfficeEngine implements OfficeEngineClient {
  readonly kind = "typescript-fallback" as const;
  private document: TextDocument;
  private readonly undoStack: TextDocument[] = [];
  private readonly redoStack: TextDocument[] = [];

  constructor(document: TextDocument) {
    this.document = normalizeDocument(structuredClone(document));
  }

  static create(id: string, title: string, now = Date.now()): FallbackOfficeEngine {
    return new FallbackOfficeEngine(createTextDocument(id, title, now));
  }

  static fromJson(json: string): FallbackOfficeEngine {
    return new FallbackOfficeEngine(JSON.parse(json) as TextDocument);
  }

  getDocument(): TextDocument {
    return structuredClone(this.document);
  }

  apply(command: DocumentCommand, now = Date.now()): TextDocument {
    const snapshot = structuredClone(this.document);
    const shouldTrack = this.document.review.trackChanges && isTrackableCommand(command);
    const beforeSnapshot = shouldTrack ? createReviewSnapshot(snapshot) : null;
    this.execute(command);
    this.document = normalizeDocument(this.document);
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack.length = 0;
    this.markChanged(now);
    if (shouldTrack && beforeSnapshot) {
      this.document.review.changes.push(createTrackedChange(command, this.document.review.author, beforeSnapshot, this.document.metadata.revision, now));
    }
    return this.getDocument();
  }

  undo(now = Date.now()): TextDocument {
    const previous = this.undoStack.pop();
    if (!previous) return this.getDocument();
    this.redoStack.push(structuredClone(this.document));
    this.restore(previous, now);
    return this.getDocument();
  }

  redo(now = Date.now()): TextDocument {
    const next = this.redoStack.pop();
    if (!next) return this.getDocument();
    this.undoStack.push(structuredClone(this.document));
    this.restore(next, now);
    return this.getDocument();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  serialize(): string {
    return JSON.stringify(this.document, null, 2);
  }

  private execute(command: DocumentCommand): void {
    switch (command.type) {
      case "setTitle":
        this.document.metadata.title = command.title;
        return;
      case "replaceBlockText": {
        const block = this.textBlock(command.blockId);
        const style = styleAtOffset(block, 0);
        block.runs = normalizeRuns(block.id, [{ id: `${block.id}-replace`, text: command.text, style }], style);
        return;
      }
      case "replaceTextRange":
        this.replaceTextRange(command.blockId, command.start, command.end, command.text, command.style);
        return;
      case "replaceDocumentRange": {
        const fragment = command.text.length === 0
          ? emptyFragment()
          : fragmentFromPlainText(command.text, command.idPrefix, this.styleForPoint(command.start, command.style));
        this.replaceRangeWithFragment(command.start, command.end, fragment, `${command.idPrefix}-tail`, `${command.idPrefix}-tail-run`);
        return;
      }
      case "replaceRangeWithFragment":
        this.replaceRangeWithFragment(
          command.start,
          command.end,
          command.fragment,
          command.trailingBlockId,
          command.trailingRunId,
        );
        return;
      case "insertText":
        this.replaceTextRange(command.blockId, command.offset, command.offset, command.text, command.style);
        return;
      case "deleteText":
        this.replaceTextRange(command.blockId, command.start, command.end, "");
        return;
      case "formatText":
        this.formatTextRange(command.blockId, command.start, command.end, command.style);
        return;
      case "formatDocumentRange":
        this.formatDocumentRange(command.start, command.end, command.style);
        return;
      case "setBlockKind":
        this.textBlock(command.blockId).kind = validateKind(command.kind);
        return;
      case "setBlockKindMany":
        for (const blockId of unique(command.blockIds)) this.textBlock(blockId).kind = validateKind(command.kind);
        return;
      case "setParagraphStyle":
        this.patchParagraphStyle(this.textBlock(command.blockId), command.style);
        return;
      case "setParagraphStyleMany":
        for (const blockId of unique(command.blockIds)) this.patchParagraphStyle(this.textBlock(blockId), command.style);
        return;
      case "setList":
        this.setList(command.blockIds, command.list);
        return;
      case "setSectionProperties":
        this.setSectionProperties(command.sectionId, command.patch);
        return;
      case "setSectionHeaderFooter":
        this.setSectionHeaderFooter(command.sectionId, command.area, command.variant, command.content);
        return;
      case "insertBreak":
        this.insertBreak(command.afterBlockId, command.breakBlock, command.newSection, command.paragraph);
        return;
      case "removeBreak":
        this.removeBreak(command.blockId);
        return;
      case "splitBlock":
        this.splitBlock(command.blockId, command.offset, command.newBlockId, command.newRunId);
        return;
      case "mergeWithPrevious":
        this.mergeWithPrevious(command.blockId);
        return;
      case "addParagraph": {
        const afterIndex = command.afterBlockId
          ? this.document.blocks.findIndex((item) => item.id === command.afterBlockId)
          : this.document.blocks.length - 1;
        if (command.afterBlockId && afterIndex < 0) throw new Error(`No se encontró el bloque '${command.afterBlockId}'.`);
        const sectionId = command.sectionId
          ?? this.document.blocks[afterIndex]?.sectionId
          ?? this.document.sections[0]?.id
          ?? "section-1";
        const block = createEmptyParagraph(command.blockId, command.runId, sectionId);
        const index = command.afterBlockId ? afterIndex + 1 : this.document.blocks.length;
        this.assertUniqueBlockId(block.id);
        this.document.blocks.splice(index, 0, block);
        return;
      }
      case "removeBlock":
        this.removeBlock(command.blockId);
        return;
      case "addResource":
        this.document.resources.images[command.resource.id] = structuredClone(command.resource);
        return;
      case "updateTableCell":
        this.updateTableCell(command.tableId, command.rowId, command.cellId, command.text);
        return;
      case "addTableRow":
        this.addTableRow(command.tableId, command.afterRowId, command.row);
        return;
      case "removeTableRow":
        this.removeTableRow(command.tableId, command.rowId);
        return;
      case "addTableColumn":
        this.addTableColumn(command.tableId, command.afterColumnIndex, command.widthMm, command.cells);
        return;
      case "removeTableColumn":
        this.removeTableColumn(command.tableId, command.columnIndex);
        return;
      case "updateImage":
        this.updateImage(command.blockId, command);
        return;
      case "setReviewAuthor":
        this.document.review.author = command.author.trim() || "Autor local";
        return;
      case "setTrackChanges":
        this.document.review.trackChanges = command.enabled;
        return;
      case "addComment":
        this.addComment(command.thread);
        return;
      case "replyComment":
        this.replyComment(command.threadId, command.message);
        return;
      case "resolveComment":
        this.resolveComment(command.threadId, command.resolved);
        return;
      case "removeComment":
        this.document.review.comments = this.document.review.comments.filter((thread) => thread.id !== command.threadId);
        return;
      case "addBookmark":
        this.addBookmark(command.bookmark);
        return;
      case "removeBookmark":
        this.document.review.bookmarks = this.document.review.bookmarks.filter((bookmark) => bookmark.id !== command.bookmarkId);
        return;
      case "setHyperlink":
        this.setHyperlinkRange(command.start, command.end, command.hyperlink);
        return;
      case "acceptChange":
        this.setChangeStatus(command.changeId, "accepted");
        return;
      case "rejectChange":
        this.rejectChange(command.changeId);
        return;
      case "acceptAllChanges":
        for (const change of this.document.review.changes) if (change.status === "pending") change.status = "accepted";
        return;
      case "rejectAllChanges":
        this.rejectAllChanges();
    }
  }

  private replaceTextRange(
    blockId: string,
    start: number,
    end: number,
    text: string,
    patch?: TextStylePatch,
  ): void {
    const block = this.textBlock(blockId);
    const length = characterLength(blockText(block));
    this.assertRange(start, end, length);
    const [before, remainder] = splitRuns(block.runs, start);
    const [, after] = splitRuns(remainder, end - start);
    const baseStyle = applyTextStyle(styleAtOffset(block, start), patch);
    const inserted: TextRun[] = text.length > 0
      ? [{ id: `${block.id}-insert`, text, style: baseStyle }]
      : [];
    block.runs = normalizeRuns(block.id, [...before, ...inserted, ...after], baseStyle);
  }

  private replaceRangeWithFragment(
    start: DocumentPoint,
    end: DocumentPoint,
    fragment: DocumentFragment,
    trailingBlockId?: string,
    trailingRunId?: string,
  ): void {
    const range = orderDocumentPoints(this.document, start, end);
    if (!range) throw new Error("La selección documental no es válida.");
    const startSource = this.document.blocks[range.startBlockIndex];
    const endSource = this.document.blocks[range.endBlockIndex];
    if (!startSource || !endSource || !isTextBlock(startSource) || !isTextBlock(endSource)) {
      throw new Error("Los extremos de una selección deben pertenecer a bloques de texto.");
    }
    this.assertRange(range.start.offset, range.start.offset, characterLength(blockText(startSource)));
    this.assertRange(range.end.offset, range.end.offset, characterLength(blockText(endSource)));

    const removedImageResourceIds = this.document.blocks
      .slice(range.startBlockIndex, range.endBlockIndex + 1)
      .filter(isImageBlock)
      .map((block) => block.resourceId);
    const prefix = sliceRuns(startSource, 0, range.start.offset);
    const suffix = sliceRuns(endSource, range.end.offset, characterLength(blockText(endSource)));
    const prefixHasText = range.start.offset > 0;
    const suffixHasText = range.end.offset < characterLength(blockText(endSource));
    const inserted = fragment.blocks.map((block, index) => normalizeBlock(structuredClone(block), index, startSource.sectionId));
    for (const block of inserted) block.sectionId = startSource.sectionId;
    this.importResources(fragment);

    const replacement: DocumentBlock[] = [];
    if (inserted.length === 0) {
      const merged = structuredClone(startSource);
      merged.runs = normalizeRuns(merged.id, [...prefix, ...suffix], styleAtOffset(startSource, range.start.offset));
      replacement.push(merged);
    } else if (inserted.length === 1 && inserted[0] && isTextBlock(inserted[0])) {
      const only = inserted[0];
      only.id = startSource.id;
      only.sectionId = startSource.sectionId;
      if (prefixHasText) {
        only.kind = structuredClone(startSource.kind);
        only.paragraphStyle = structuredClone(startSource.paragraphStyle);
        only.list = structuredClone(startSource.list);
      }
      only.runs = normalizeRuns(
        only.id,
        [...prefix, ...only.runs, ...suffix],
        styleAtOffset(startSource, range.start.offset),
      );
      replacement.push(only);
    } else {
      const first = inserted[0];
      const last = inserted.at(-1);
      if (!first || !last) throw new Error("El fragmento insertado no es válido.");

      if (isTextBlock(first)) {
        first.id = startSource.id;
        first.sectionId = startSource.sectionId;
        if (prefixHasText) {
          first.kind = structuredClone(startSource.kind);
          first.paragraphStyle = structuredClone(startSource.paragraphStyle);
          first.list = structuredClone(startSource.list);
        }
        first.runs = normalizeRuns(first.id, [...prefix, ...first.runs], styleAtOffset(startSource, range.start.offset));
      } else if (prefixHasText) {
        const left = structuredClone(startSource);
        left.runs = normalizeRuns(left.id, prefix, styleAtOffset(startSource, range.start.offset));
        replacement.push(left);
      }

      replacement.push(...inserted);

      if (isTextBlock(last)) {
        last.runs = normalizeRuns(last.id, [...last.runs, ...suffix], styleAtOffset(endSource, range.end.offset));
      } else if (suffixHasText || !replacement.some(isTextBlock)) {
        const id = trailingBlockId ?? `${endSource.id}-tail-${this.document.metadata.revision + 1}`;
        const runId = trailingRunId ?? `${id}-run-1`;
        const right = structuredClone(endSource);
        right.id = id;
        right.runs = normalizeRuns(id, suffix, styleAtOffset(endSource, range.end.offset), runId);
        replacement.push(right);
      }
    }

    this.assertReplacementIds(replacement, range.startBlockIndex, range.endBlockIndex);
    this.document.blocks.splice(
      range.startBlockIndex,
      range.endBlockIndex - range.startBlockIndex + 1,
      ...replacement,
    );
    for (const resourceId of removedImageResourceIds) this.removeUnusedImageResource(resourceId);
    this.ensureTextBlock();
  }

  private formatTextRange(blockId: string, start: number, end: number, patch: TextStylePatch): void {
    const block = this.textBlock(blockId);
    const length = characterLength(blockText(block));
    this.assertRange(start, end, length);
    if (start === end) return;
    const fallback = styleAtOffset(block, start);
    const [before, remainder] = splitRuns(block.runs, start);
    const [selected, after] = splitRuns(remainder, end - start);
    const formatted = selected.map((run) => ({ ...run, style: applyTextStyle(run.style, patch) }));
    block.runs = normalizeRuns(block.id, [...before, ...formatted, ...after], fallback);
  }

  private formatDocumentRange(start: DocumentPoint, end: DocumentPoint, patch: TextStylePatch): void {
    const range = orderDocumentPoints(this.document, start, end);
    if (!range || range.collapsed) return;
    for (let index = range.startBlockIndex; index <= range.endBlockIndex; index += 1) {
      const block = this.document.blocks[index];
      if (!block || !isTextBlock(block)) continue;
      const length = characterLength(blockText(block));
      const from = index === range.startBlockIndex ? range.start.offset : 0;
      const to = index === range.endBlockIndex ? range.end.offset : length;
      if (from < to) this.formatTextRange(block.id, from, to, patch);
    }
  }

  private splitBlock(blockId: string, offset: number, newBlockId: string, newRunId: string): void {
    const index = this.document.blocks.findIndex((item) => item.id === blockId);
    const source = this.document.blocks[index];
    if (index < 0 || !source || !isTextBlock(source)) throw new Error(`No se encontró el bloque de texto '${blockId}'.`);
    this.assertUniqueBlockId(newBlockId);
    const length = characterLength(blockText(source));
    this.assertRange(offset, offset, length);
    const [left, right] = splitRuns(source.runs, offset);
    const fallbackStyle = styleAtOffset(source, offset);
    source.runs = normalizeRuns(source.id, left, fallbackStyle);
    const nextKind: BlockKind = source.kind.type === "heading" ? { type: "paragraph" } : structuredClone(source.kind);
    const newBlock: TextBlock = {
      blockType: "text",
      id: newBlockId,
      sectionId: source.sectionId,
      kind: nextKind,
      paragraphStyle: structuredClone(source.paragraphStyle),
      list: structuredClone(source.list),
      runs: normalizeRuns(newBlockId, right, fallbackStyle, newRunId),
    };
    this.document.blocks.splice(index + 1, 0, newBlock);
  }

  private mergeWithPrevious(blockId: string): void {
    const index = this.document.blocks.findIndex((item) => item.id === blockId);
    if (index < 0) throw new Error(`No se encontró el bloque '${blockId}'.`);
    if (index === 0) throw new Error("El primer bloque no puede unirse con uno anterior.");
    const current = this.document.blocks[index];
    const previous = this.document.blocks[index - 1];
    if (!current || !previous || !isTextBlock(current) || !isTextBlock(previous)) {
      throw new Error("Solo es posible unir dos bloques de texto contiguos.");
    }
    previous.runs = normalizeRuns(
      previous.id,
      [...previous.runs, ...current.runs],
      previous.runs.at(-1)?.style ?? DEFAULT_TEXT_STYLE,
    );
    this.document.blocks.splice(index, 1);
  }

  private setList(blockIds: string[], list: ListProperties | null): void {
    const ids = unique(blockIds);
    for (const blockId of ids) {
      const block = this.textBlock(blockId);
      block.list = list ? {
        ...structuredClone(list),
        level: clampInteger(list.level, 0, 8),
        start: clampInteger(list.start, 1, 9999),
      } : null;
      if (block.kind.type === "heading" && block.list) block.kind = { type: "paragraph" };
    }
  }

  private patchParagraphStyle(block: TextBlock, patch: ParagraphStylePatch): void {
    block.paragraphStyle = {
      ...block.paragraphStyle,
      ...patch,
      lineHeight: patch.lineHeight === undefined ? block.paragraphStyle.lineHeight : clamp(patch.lineHeight, 0.8, 4),
      spaceBeforePt: patch.spaceBeforePt === undefined ? block.paragraphStyle.spaceBeforePt : Math.max(0, patch.spaceBeforePt),
      spaceAfterPt: patch.spaceAfterPt === undefined ? block.paragraphStyle.spaceAfterPt : Math.max(0, patch.spaceAfterPt),
      firstLineIndentMm: patch.firstLineIndentMm === undefined
        ? block.paragraphStyle.firstLineIndentMm
        : clamp(patch.firstLineIndentMm, -30, 100),
    };
  }

  private removeBlock(blockId: string): void {
    const index = this.document.blocks.findIndex((item) => item.id === blockId);
    if (index < 0) throw new Error(`No se encontró el bloque '${blockId}'.`);
    const target = this.document.blocks[index];
    if (target && isBreakBlock(target)) {
      this.removeBreak(blockId);
      return;
    }
    const [removed] = this.document.blocks.splice(index, 1);
    if (removed && isImageBlock(removed)) this.removeUnusedImageResource(removed.resourceId);
    this.ensureTextBlock();
  }

  private updateTableCell(tableId: string, rowId: string, cellId: string, text: string): void {
    const table = this.tableBlock(tableId);
    const row = table.rows.find((item) => item.id === rowId);
    const cell = row?.cells.find((item) => item.id === cellId);
    if (!cell) throw new Error(`No se encontró la celda '${cellId}'.`);
    const style = cell.runs[0]?.style ?? DEFAULT_TEXT_STYLE;
    cell.runs = normalizeRuns(cell.id, [{ id: `${cell.id}-edit`, text, style }], style);
  }

  private addTableRow(tableId: string, afterRowId: string | undefined, row: TableRow): void {
    const table = this.tableBlock(tableId);
    const columnCount = table.columnWidthsMm.length;
    if (row.cells.length !== columnCount) throw new Error(`La fila debe contener ${columnCount} celdas.`);
    const normalized = normalizeTableRow(row, table.id, table.rows.length, columnCount);
    const index = afterRowId
      ? table.rows.findIndex((item) => item.id === afterRowId) + 1
      : table.rows.length;
    if (index === 0) throw new Error(`No se encontró la fila '${afterRowId}'.`);
    table.rows.splice(index, 0, normalized);
  }

  private removeTableRow(tableId: string, rowId: string): void {
    const table = this.tableBlock(tableId);
    if (table.rows.length === 1) throw new Error("Una tabla debe conservar al menos una fila.");
    const index = table.rows.findIndex((row) => row.id === rowId);
    if (index < 0) throw new Error(`No se encontró la fila '${rowId}'.`);
    table.rows.splice(index, 1);
    table.style.headerRows = Math.min(table.style.headerRows, table.rows.length);
  }

  private addTableColumn(tableId: string, afterColumnIndex: number, widthMm: number, cells: TableCell[]): void {
    const table = this.tableBlock(tableId);
    if (cells.length !== table.rows.length) throw new Error(`Se requieren ${table.rows.length} celdas para la nueva columna.`);
    const index = clampInteger(afterColumnIndex + 1, 0, table.columnWidthsMm.length);
    table.columnWidthsMm.splice(index, 0, clamp(widthMm, 10, 120));
    table.rows.forEach((row, rowIndex) => {
      const source = cells[rowIndex];
      if (!source) throw new Error("La definición de columna está incompleta.");
      row.cells.splice(index, 0, normalizeTableCell(source, `${table.id}-cell-new-${rowIndex + 1}`));
    });
  }

  private removeTableColumn(tableId: string, columnIndex: number): void {
    const table = this.tableBlock(tableId);
    if (table.columnWidthsMm.length === 1) throw new Error("Una tabla debe conservar al menos una columna.");
    if (columnIndex < 0 || columnIndex >= table.columnWidthsMm.length) throw new Error("La columna indicada no existe.");
    table.columnWidthsMm.splice(columnIndex, 1);
    for (const row of table.rows) row.cells.splice(columnIndex, 1);
  }

  private updateImage(blockId: string, patch: Extract<DocumentCommand, { type: "updateImage" }>): void {
    const image = this.imageBlock(blockId);
    if (patch.alt !== undefined) image.alt = patch.alt;
    if (patch.caption !== undefined) image.caption = patch.caption;
    if (patch.widthMm !== undefined) image.widthMm = clamp(patch.widthMm, 10, 180);
    if (patch.heightMm !== undefined) image.heightMm = clamp(patch.heightMm, 10, 240);
    if (patch.alignment !== undefined) image.alignment = patch.alignment;
    if (patch.keepWithNext !== undefined) image.keepWithNext = patch.keepWithNext;
  }

  private setSectionProperties(
    sectionId: string,
    patch: Extract<DocumentCommand, { type: "setSectionProperties" }>["patch"],
  ): void {
    const section = this.document.sections.find((item) => item.id === sectionId);
    if (!section) throw new Error(`No se encontró la sección '${sectionId}'.`);
    if (patch.name !== undefined) section.name = patch.name.trim() || section.name;
    if (patch.pageSettings) section.pageSettings = { ...section.pageSettings, ...patch.pageSettings };
    if (patch.columns) section.columns = { ...section.columns, ...patch.columns };
    if (patch.differentFirstPage !== undefined) section.differentFirstPage = patch.differentFirstPage;
    if (patch.differentOddEven !== undefined) section.differentOddEven = patch.differentOddEven;
    if (patch.pageNumbering) section.pageNumbering = { ...section.pageNumbering, ...patch.pageNumbering };
  }

  private setSectionHeaderFooter(
    sectionId: string,
    area: HeaderFooterArea,
    variant: HeaderFooterVariant,
    content: HeaderFooterContent,
  ): void {
    const section = this.document.sections.find((item) => item.id === sectionId);
    if (!section) throw new Error(`No se encontró la sección '${sectionId}'.`);
    section[area === "header" ? "headers" : "footers"][variant] = structuredClone(content);
  }

  private insertBreak(
    afterBlockId: string,
    sourceBreak: BreakBlock,
    newSection?: DocumentSection,
    paragraph?: TextBlock,
  ): void {
    const index = this.document.blocks.findIndex((item) => item.id === afterBlockId);
    if (index < 0) throw new Error(`No se encontró el bloque '${afterBlockId}'.`);
    this.assertUniqueBlockId(sourceBreak.id);
    const sourceSectionId = this.document.blocks[index]?.sectionId ?? this.document.sections[0]?.id ?? "section-1";
    const breakBlock: BreakBlock = {
      ...structuredClone(sourceBreak),
      blockType: "break",
      sectionId: sourceSectionId,
      nextSectionId: sourceBreak.breakKind === "section" ? sourceBreak.nextSectionId : null,
    };
    let targetSectionId = sourceSectionId;
    if (breakBlock.breakKind === "section") {
      if (!newSection) throw new Error("Un salto de sección requiere la definición de la nueva sección.");
      if (this.document.sections.some((section) => section.id === newSection.id)) throw new Error(`La sección '${newSection.id}' ya existe.`);
      this.document.sections.push(structuredClone(newSection));
      breakBlock.nextSectionId = newSection.id;
      targetSectionId = newSection.id;
      for (let cursor = index + 1; cursor < this.document.blocks.length; cursor += 1) {
        const block = this.document.blocks[cursor];
        if (!block) continue;
        if (isBreakBlock(block) && block.breakKind === "section") break;
        block.sectionId = targetSectionId;
      }
    }
    this.document.blocks.splice(index + 1, 0, breakBlock);
    if (paragraph) {
      const next = normalizeBlock(structuredClone(paragraph), 0, targetSectionId);
      next.sectionId = targetSectionId;
      this.assertUniqueBlockId(next.id);
      this.document.blocks.splice(index + 2, 0, next);
    } else if (index + 2 >= this.document.blocks.length) {
      const id = `${breakBlock.id}-paragraph`;
      this.document.blocks.push(createEmptyParagraph(id, `${id}-run-1`, targetSectionId));
    }
  }

  private removeBreak(blockId: string): void {
    const index = this.document.blocks.findIndex((item) => item.id === blockId);
    const block = this.document.blocks[index];
    if (index < 0 || !block || !isBreakBlock(block)) throw new Error(`No se encontró el salto '${blockId}'.`);
    if (block.breakKind === "section" && block.nextSectionId) {
      const nextSectionId = block.nextSectionId;
      for (let cursor = index + 1; cursor < this.document.blocks.length; cursor += 1) {
        const candidate = this.document.blocks[cursor];
        if (!candidate) continue;
        if (isBreakBlock(candidate) && candidate.breakKind === "section") break;
        if (candidate.sectionId === nextSectionId) candidate.sectionId = block.sectionId;
      }
      this.document.sections = this.document.sections.filter((section) => section.id !== nextSectionId);
    }
    this.document.blocks.splice(index, 1);
    this.ensureTextBlock();
  }

  private importResources(fragment: DocumentFragment): void {
    for (const resource of Object.values(fragment.resources.images)) {
      this.document.resources.images[resource.id] = structuredClone(resource);
    }
  }

  private removeUnusedImageResource(resourceId: string): void {
    if (this.document.blocks.some((block) => isImageBlock(block) && block.resourceId === resourceId)) return;
    delete this.document.resources.images[resourceId];
  }

  private ensureTextBlock(): void {
    if (this.document.blocks.some(isTextBlock)) return;
    let index = 1;
    let id = "block-text-1";
    while (this.document.blocks.some((block) => block.id === id)) {
      index += 1;
      id = `block-text-${index}`;
    }
    const sectionId = this.document.blocks.at(-1)?.sectionId ?? this.document.sections[0]?.id ?? "section-1";
    this.document.blocks.push(createEmptyParagraph(id, `${id}-run-1`, sectionId));
  }

  private addComment(thread: CommentThread): void {
    if (this.document.review.comments.some((item) => item.id === thread.id)) throw new Error(`El comentario '${thread.id}' ya existe.`);
    if (!orderDocumentPoints(this.document, thread.range.start, thread.range.end)) throw new Error("El rango del comentario no es válido.");
    this.document.review.comments.push(structuredClone(thread));
  }

  private replyComment(threadId: string, message: CommentMessage): void {
    const thread = this.document.review.comments.find((item) => item.id === threadId);
    if (!thread) throw new Error(`No se encontró el comentario '${threadId}'.`);
    thread.messages.push(structuredClone(message));
    thread.updatedAt = Math.max(thread.updatedAt, message.updatedAt, message.createdAt);
  }

  private resolveComment(threadId: string, resolved: boolean): void {
    const thread = this.document.review.comments.find((item) => item.id === threadId);
    if (!thread) throw new Error(`No se encontró el comentario '${threadId}'.`);
    thread.resolved = resolved;
    thread.updatedAt = Date.now();
  }

  private addBookmark(bookmark: Bookmark): void {
    if (!orderDocumentPoints(this.document, bookmark.range.start, bookmark.range.end)) throw new Error("El rango del marcador no es válido.");
    const normalizedName = bookmark.name.trim();
    if (!normalizedName) throw new Error("El marcador requiere un nombre.");
    this.document.review.bookmarks = this.document.review.bookmarks.filter((item) => item.name.toLocaleLowerCase() !== normalizedName.toLocaleLowerCase());
    this.document.review.bookmarks.push({ ...structuredClone(bookmark), name: normalizedName });
  }

  private setHyperlinkRange(start: DocumentPoint, end: DocumentPoint, hyperlink: Hyperlink | null): void {
    const range = orderDocumentPoints(this.document, start, end);
    if (!range || range.collapsed) return;
    for (let index = range.startBlockIndex; index <= range.endBlockIndex; index += 1) {
      const block = this.document.blocks[index];
      if (!block || !isTextBlock(block)) continue;
      const length = characterLength(blockText(block));
      const localStart = index === range.startBlockIndex ? range.start.offset : 0;
      const localEnd = index === range.endBlockIndex ? range.end.offset : length;
      if (localStart >= localEnd) continue;
      const fallback = styleAtOffset(block, localStart);
      const [before, remainder] = splitRuns(block.runs, localStart);
      const [selected, after] = splitRuns(remainder, localEnd - localStart);
      const linked = selected.map((run) => ({ ...run, hyperlink: hyperlink ? structuredClone(hyperlink) : null }));
      block.runs = normalizeRuns(block.id, [...before, ...linked, ...after], fallback);
    }
  }

  private setChangeStatus(changeId: string, status: "accepted" | "rejected"): void {
    const change = this.document.review.changes.find((item) => item.id === changeId);
    if (!change) throw new Error(`No se encontró el cambio '${changeId}'.`);
    if (change.status === "pending") change.status = status;
  }

  private rejectChange(changeId: string): void {
    const pending = this.document.review.changes.filter((item) => item.status === "pending");
    const change = pending.find((item) => item.id === changeId);
    if (!change) throw new Error(`No se encontró el cambio pendiente '${changeId}'.`);
    const latest = pending.at(-1);
    if (!latest || latest.id !== changeId || !change.beforeSnapshot) {
      change.status = "conflict";
      return;
    }
    const currentReview = structuredClone(this.document.review);
    const restored = normalizeDocument(JSON.parse(change.beforeSnapshot) as TextDocument);
    const rejectedChanges = currentReview.changes.map((item) => item.id === changeId ? { ...item, status: "rejected" as const, beforeSnapshot: null } : item);
    restored.review = { ...currentReview, trackChanges: false, changes: rejectedChanges };
    this.document = restored;
  }

  private rejectAllChanges(): void {
    const pending = this.document.review.changes.filter((item) => item.status === "pending" && item.beforeSnapshot);
    const first = pending[0];
    if (!first?.beforeSnapshot) return;
    const currentReview = structuredClone(this.document.review);
    const restored = normalizeDocument(JSON.parse(first.beforeSnapshot) as TextDocument);
    restored.review = {
      ...currentReview,
      trackChanges: false,
      changes: currentReview.changes.map((item) => item.status === "pending" ? { ...item, status: "rejected" as const, beforeSnapshot: null } : item),
    };
    this.document = restored;
  }

  private styleForPoint(point: DocumentPoint, patch?: TextStylePatch): TextStyle {
    const block = this.textBlock(point.blockId);
    return applyTextStyle(styleAtOffset(block, point.offset), patch);
  }

  private textBlock(id: string): TextBlock {
    const block = this.document.blocks.find((item) => item.id === id);
    if (!block || !isTextBlock(block)) throw new Error(`No se encontró el bloque de texto '${id}'.`);
    return block;
  }

  private tableBlock(id: string): TableBlock {
    const block = this.document.blocks.find((item) => item.id === id);
    if (!block || !isTableBlock(block)) throw new Error(`No se encontró la tabla '${id}'.`);
    return block;
  }

  private imageBlock(id: string): ImageBlock {
    const block = this.document.blocks.find((item) => item.id === id);
    if (!block || !isImageBlock(block)) throw new Error(`No se encontró la imagen '${id}'.`);
    return block;
  }

  private assertRange(start: number, end: number, length: number): void {
    if (start < 0 || end < start || end > length) {
      throw new Error(`Rango inválido: inicio=${start}, fin=${end}, longitud=${length}.`);
    }
  }

  private assertUniqueBlockId(id: string): void {
    if (this.document.blocks.some((block) => block.id === id)) throw new Error(`El bloque '${id}' ya existe.`);
  }

  private assertReplacementIds(replacement: DocumentBlock[], startIndex: number, endIndex: number): void {
    const replacingIds = new Set(this.document.blocks.slice(startIndex, endIndex + 1).map((block) => block.id));
    const outsideIds = new Set(this.document.blocks.filter((_, index) => index < startIndex || index > endIndex).map((block) => block.id));
    const seen = new Set<string>();
    for (const block of replacement) {
      if (outsideIds.has(block.id) && !replacingIds.has(block.id)) throw new Error(`El bloque '${block.id}' ya existe.`);
      if (seen.has(block.id)) throw new Error(`El fragmento contiene el identificador duplicado '${block.id}'.`);
      seen.add(block.id);
    }
  }

  private markChanged(now: number): void {
    this.document.metadata.schemaVersion = CURRENT_SCHEMA_VERSION;
    this.document.metadata.updatedAt = now;
    this.document.metadata.revision += 1;
  }

  private restore(snapshot: TextDocument, now: number): void {
    const revision = this.document.metadata.revision + 1;
    const id = this.document.metadata.id;
    const createdAt = this.document.metadata.createdAt;
    this.document = normalizeDocument(structuredClone(snapshot));
    this.document.metadata.id = id;
    this.document.metadata.createdAt = createdAt;
    this.document.metadata.updatedAt = now;
    this.document.metadata.revision = revision;
  }
}

function splitRuns(runs: TextRun[], offset: number): [TextRun[], TextRun[]] {
  const left: TextRun[] = [];
  const right: TextRun[] = [];
  let cursor = 0;
  for (const run of runs) {
    const characters = Array.from(run.text);
    const runEnd = cursor + characters.length;
    if (offset <= cursor) {
      right.push(structuredClone(run));
    } else if (offset >= runEnd) {
      left.push(structuredClone(run));
    } else {
      const local = offset - cursor;
      const leftText = characters.slice(0, local).join("");
      const rightText = characters.slice(local).join("");
      if (leftText) left.push({ ...structuredClone(run), text: leftText });
      if (rightText) right.push({ ...structuredClone(run), text: rightText });
    }
    cursor = runEnd;
  }
  return [left, right];
}

function applyTextStyle(style: TextStyle, patch?: TextStylePatch): TextStyle {
  if (!patch) return { ...style };
  return {
    ...style,
    ...patch,
    fontSizePt: patch.fontSizePt === undefined ? style.fontSizePt : clamp(patch.fontSizePt, 6, 144),
  };
}

function validateKind(kind: BlockKind): BlockKind {
  if (kind.type === "heading" && (!Number.isInteger(kind.level) || kind.level < 1 || kind.level > 6)) {
    throw new Error(`El nivel de encabezado ${kind.level} no es válido.`);
  }
  return structuredClone(kind);
}

function normalizeTableRow(row: TableRow, tableId: string, rowIndex: number, columnCount: number): TableRow {
  return {
    id: row.id || `${tableId}-row-${rowIndex + 1}`,
    cells: Array.from({ length: columnCount }, (_, columnIndex) =>
      normalizeTableCell(row.cells[columnIndex], `${tableId}-cell-${rowIndex + 1}-${columnIndex + 1}`),
    ),
  };
}

function normalizeTableCell(cell: TableCell | undefined, id: string): TableCell {
  const source = cell ?? {
    id,
    paragraphStyle: { ...DEFAULT_PARAGRAPH_STYLE, spaceAfterPt: 0 },
    runs: [{ id: `${id}-run-1`, text: "", style: { ...DEFAULT_TEXT_STYLE } }],
    backgroundColor: null,
  };
  const cellId = source.id || id;
  return {
    ...structuredClone(source),
    id: cellId,
    runs: normalizeRuns(cellId, source.runs, source.runs[0]?.style ?? DEFAULT_TEXT_STYLE),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function isTrackableCommand(command: DocumentCommand): boolean {
  return ![
    "setReviewAuthor", "setTrackChanges", "addComment", "replyComment", "resolveComment", "removeComment",
    "addBookmark", "removeBookmark", "acceptChange", "rejectChange", "acceptAllChanges", "rejectAllChanges",
  ].includes(command.type);
}

function createReviewSnapshot(documentModel: TextDocument): string {
  const snapshot = structuredClone(documentModel);
  snapshot.review.changes = snapshot.review.changes.map((change) => ({ ...change, beforeSnapshot: null }));
  return JSON.stringify(snapshot);
}

function createTrackedChange(
  command: DocumentCommand,
  author: string,
  beforeSnapshot: string,
  afterRevision: number,
  now: number,
): TrackedChange {
  return {
    id: `change-${crypto.randomUUID()}`,
    kind: changeKind(command),
    author: author || "Autor local",
    summary: describeCommand(command),
    commandType: command.type,
    createdAt: now,
    status: "pending",
    beforeSnapshot,
    afterRevision,
  };
}

function changeKind(command: DocumentCommand): TrackedChange["kind"] {
  if (command.type === "insertText" || (command.type === "replaceDocumentRange" && command.start.blockId === command.end.blockId && command.start.offset === command.end.offset && command.text)) return "insert";
  if (command.type === "deleteText" || (command.type === "replaceDocumentRange" && !command.text)) return "delete";
  if (command.type === "formatText" || command.type === "formatDocumentRange" || command.type === "setHyperlink") return "format";
  if (command.type === "replaceTextRange" || command.type === "replaceRangeWithFragment" || command.type === "replaceBlockText") return "replace";
  return "structure";
}

function describeCommand(command: DocumentCommand): string {
  const labels: Partial<Record<DocumentCommand["type"], string>> = {
    setTitle: "Cambió el título", replaceBlockText: "Reemplazó un párrafo", replaceTextRange: "Editó texto",
    replaceDocumentRange: "Reemplazó una selección", replaceRangeWithFragment: "Pegó o sustituyó contenido estructurado",
    insertText: "Insertó texto", deleteText: "Eliminó texto", formatText: "Aplicó formato", formatDocumentRange: "Aplicó formato a una selección",
    setBlockKind: "Cambió el estilo de párrafo", setBlockKindMany: "Cambió estilos de párrafo", setParagraphStyle: "Cambió composición de párrafo",
    setParagraphStyleMany: "Cambió composición de párrafos", setList: "Cambió una lista", splitBlock: "Dividió un párrafo", mergeWithPrevious: "Unió párrafos",
    addParagraph: "Agregó un párrafo", removeBlock: "Eliminó un bloque", addResource: "Agregó un recurso", updateTableCell: "Editó una celda",
    addTableRow: "Agregó una fila", removeTableRow: "Eliminó una fila", addTableColumn: "Agregó una columna", removeTableColumn: "Eliminó una columna",
    updateImage: "Modificó una imagen", setSectionProperties: "Cambió el diseño de sección", setSectionHeaderFooter: "Cambió encabezado o pie",
    insertBreak: "Insertó un salto", removeBreak: "Eliminó un salto", setHyperlink: "Cambió un hipervínculo",
  };
  return labels[command.type] ?? "Cambio documental";
}

interface WasmOfficeEngineInstance {
  applyJson(command: string, now: number): string;
  undo(now: number): string;
  redo(now: number): string;
  documentJson(): string;
  canUndo(): boolean;
  canRedo(): boolean;
}

interface WasmOfficeEngineConstructor {
  new (id: string, title: string, now: number): WasmOfficeEngineInstance;
  fromJson(json: string): WasmOfficeEngineInstance;
}

interface WasmModule {
  default(input?: string | URL | Request | WebAssembly.Module): Promise<unknown>;
  OfficeEngine: WasmOfficeEngineConstructor;
}

class WasmOfficeEngineAdapter implements OfficeEngineClient {
  readonly kind = "rust-wasm" as const;
  private readonly inner: WasmOfficeEngineInstance;

  constructor(inner: WasmOfficeEngineInstance) {
    this.inner = inner;
  }

  getDocument(): TextDocument {
    return normalizeDocument(JSON.parse(this.inner.documentJson()) as TextDocument);
  }

  apply(command: DocumentCommand, now = Date.now()): TextDocument {
    return normalizeDocument(JSON.parse(this.inner.applyJson(JSON.stringify(command), now)) as TextDocument);
  }

  undo(now = Date.now()): TextDocument {
    return normalizeDocument(JSON.parse(this.inner.undo(now)) as TextDocument);
  }

  redo(now = Date.now()): TextDocument {
    return normalizeDocument(JSON.parse(this.inner.redo(now)) as TextDocument);
  }

  canUndo(): boolean {
    return this.inner.canUndo();
  }

  canRedo(): boolean {
    return this.inner.canRedo();
  }

  serialize(): string {
    return this.inner.documentJson();
  }
}

async function loadWasm(): Promise<WasmModule> {
  const moduleUrl = "/wasm/office_wasm.js";
  const wasm = (await import(/* @vite-ignore */ moduleUrl)) as WasmModule;
  await wasm.default();
  return wasm;
}

export async function createOfficeEngine(title = "Documento sin título"): Promise<OfficeEngineClient> {
  const id = `doc-${crypto.randomUUID()}`;
  try {
    const wasm = await loadWasm();
    return new WasmOfficeEngineAdapter(new wasm.OfficeEngine(id, title, Date.now()));
  } catch (error) {
    console.info("Motor Rust/WASM no disponible; se usa el motor TypeScript compatible.", error);
    return FallbackOfficeEngine.create(id, title);
  }
}

export async function restoreOfficeEngine(json: string): Promise<OfficeEngineClient> {
  try {
    const wasm = await loadWasm();
    return new WasmOfficeEngineAdapter(wasm.OfficeEngine.fromJson(json));
  } catch (error) {
    console.info("Restauración Rust/WASM no disponible; se usa el motor TypeScript compatible.", error);
    return FallbackOfficeEngine.fromJson(json);
  }
}

export function restoreFallbackEngine(json: string): OfficeEngineClient {
  return FallbackOfficeEngine.fromJson(json);
}
