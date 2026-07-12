import { describe, expect, it } from "vitest";
import { FallbackOfficeEngine } from "../src/engine";
import { createApproximateTextMeasurer, layoutDocument } from "../src/layout";
import {
  CURRENT_SCHEMA_VERSION,
  blockText,
  createBreakBlock,
  createDocumentSection,
  createEmptyParagraph,
  createTableBlock,
  headerFooterFromTemplate,
  headerFooterToTemplate,
  isBreakBlock,
  isImageBlock,
  isTableBlock,
  isTextBlock,
  resolveHeaderFooterContent,
  type DocumentFragment,
  type ImageResource,
  type TextDocument,
} from "../src/model";
import {
  WEB_OFFICE_CLIPBOARD_MIME,
  fragmentFromSelection,
  fragmentToPlainText,
  orderDocumentPoints,
  rekeyFragment,
} from "../src/selection";

function firstText(engine: FallbackOfficeEngine): string {
  const block = engine.getDocument().blocks.find(isTextBlock);
  return block ? blockText(block) : "";
}

describe("FallbackOfficeEngine schema v5", () => {
  it("preserves Unicode offsets", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Hola 🌎" }, 101);
    engine.apply({ type: "insertText", blockId: "block-1", offset: 5, text: "mundo " }, 102);
    expect(firstText(engine)).toBe("Hola mundo 🌎");
  });

  it("formats a selection spanning several paragraphs", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Primero" }, 101);
    engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 102);
    engine.apply({ type: "replaceBlockText", blockId: "block-2", text: "Segundo" }, 103);
    engine.apply({
      type: "formatDocumentRange",
      start: { blockId: "block-1", offset: 3 },
      end: { blockId: "block-2", offset: 4 },
      style: { bold: true },
    }, 104);
    const blocks = engine.getDocument().blocks.filter(isTextBlock);
    expect(blocks[0]?.runs.map((run) => [run.text, run.style.bold])).toEqual([["Pri", false], ["mero", true]]);
    expect(blocks[1]?.runs.map((run) => [run.text, run.style.bold])).toEqual([["Segu", true], ["ndo", false]]);
  });

  it("creates and removes section breaks while reassigning following blocks", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Secciones", 100);
    engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 101);
    const section = createDocumentSection("section-2", "Apéndice");
    const breakBlock = createBreakBlock("break-1", "section-1", "section", section.id, "next-page");
    engine.apply({ type: "insertBreak", afterBlockId: "block-1", breakBlock, newSection: section }, 102);
    let documentModel = engine.getDocument();
    expect(documentModel.sections).toHaveLength(2);
    expect(documentModel.blocks.find((block) => block.id === "block-2")?.sectionId).toBe("section-2");
    expect(documentModel.blocks.find(isBreakBlock)?.nextSectionId).toBe("section-2");
    engine.apply({ type: "removeBreak", blockId: "break-1" }, 103);
    documentModel = engine.getDocument();
    expect(documentModel.sections).toHaveLength(1);
    expect(documentModel.blocks.find((block) => block.id === "block-2")?.sectionId).toBe("section-1");
  });

  it("updates section page, columns and numbering properties", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Diseño", 100);
    engine.apply({
      type: "setSectionProperties",
      sectionId: "section-1",
      patch: {
        name: "Informe",
        pageSettings: { widthMm: 297, heightMm: 210 },
        columns: { count: 2, gapMm: 10, lineBetween: true },
        pageNumbering: { restart: true, start: 5, format: "roman-upper" },
      },
    }, 101);
    const section = engine.getDocument().sections[0];
    expect(section?.name).toBe("Informe");
    expect(section?.columns.count).toBe(2);
    expect(section?.pageSettings.widthMm).toBe(297);
    expect(section?.pageNumbering.start).toBe(5);
  });

  it("stores headers and footers as structured fields", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Informe anual", 100);
    const content = headerFooterFromTemplate("{{TITLE}} · {{SECTION}} · {{PAGE}}/{{PAGES}}", { enabled: true });
    engine.apply({ type: "setSectionHeaderFooter", sectionId: "section-1", area: "footer", variant: "default", content }, 101);
    const stored = engine.getDocument().sections[0]?.footers.default;
    expect(stored ? headerFooterToTemplate(stored) : "").toBe("{{TITLE}} · {{SECTION}} · {{PAGE}}/{{PAGES}}");
    expect(stored ? resolveHeaderFooterContent(stored, {
      pageNumber: 3,
      pageCount: 9,
      sectionPageNumber: 3,
      title: "Informe anual",
      sectionName: "Sección 1",
      now: new Date("2026-07-12T12:00:00Z"),
    }) : "").toBe("Informe anual · Sección 1 · 3/9");
  });

  it("replaces a multi-block range and merges its boundaries", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Hola uno" }, 101);
    engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 102);
    engine.apply({ type: "replaceBlockText", blockId: "block-2", text: "dos final" }, 103);
    engine.apply({
      type: "replaceDocumentRange",
      start: { blockId: "block-1", offset: 5 },
      end: { blockId: "block-2", offset: 3 },
      text: "nuevo",
      idPrefix: "replace-1",
    }, 104);
    expect(engine.getDocument().blocks.filter(isTextBlock).map(blockText)).toEqual(["Hola nuevo final"]);
  });

  it("creates and clears lists across selected blocks", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 101);
    engine.apply({ type: "setList", blockIds: ["block-1", "block-2"], list: { id: "list-1", kind: "number", level: 0, start: 3 } }, 102);
    expect(engine.getDocument().blocks.filter(isTextBlock).map((block) => block.list?.kind)).toEqual(["number", "number"]);
    engine.apply({ type: "setList", blockIds: ["block-1", "block-2"], list: null }, 103);
    expect(engine.getDocument().blocks.filter(isTextBlock).every((block) => block.list === null)).toBe(true);
  });

  it("inserts and edits a table as a document block", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    const table = createTableBlock("table-1", 2, 2, "table-1", "section-1");
    const tail = createEmptyParagraph("tail-1", "tail-run-1", "section-1");
    const fragment: DocumentFragment = { version: 1, sourceSchemaVersion: CURRENT_SCHEMA_VERSION, blocks: [table, tail], resources: { images: {} } };
    engine.apply({
      type: "replaceRangeWithFragment",
      start: { blockId: "block-1", offset: 0 },
      end: { blockId: "block-1", offset: 0 },
      fragment,
    }, 101);
    const inserted = engine.getDocument().blocks.find(isTableBlock);
    expect(inserted?.rows).toHaveLength(2);
    const cell = inserted?.rows[0]?.cells[0];
    expect(cell).toBeDefined();
    if (!inserted || !cell) return;
    engine.apply({ type: "updateTableCell", tableId: inserted.id, rowId: inserted.rows[0]!.id, cellId: cell.id, text: "Dato" }, 102);
    expect(engine.getDocument().blocks.find(isTableBlock)?.rows[0]?.cells[0]?.runs[0]?.text).toBe("Dato");
  });

  it("stores image resources separately from image blocks", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    const resource: ImageResource = {
      id: "resource-1",
      kind: "image",
      name: "pixel.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,AA==",
      byteLength: 1,
      createdAt: 100,
    };
    const fragment: DocumentFragment = {
      version: 1,
      sourceSchemaVersion: CURRENT_SCHEMA_VERSION,
      resources: { images: { [resource.id]: resource } },
      blocks: [{ blockType: "image", id: "image-1", sectionId: "section-1", resourceId: resource.id, alt: "Pixel", widthMm: 20, heightMm: 20, alignment: "center", caption: "Prueba", keepWithNext: false }, createEmptyParagraph("tail", "tail-run", "section-1")],
    };
    engine.apply({ type: "replaceRangeWithFragment", start: { blockId: "block-1", offset: 0 }, end: { blockId: "block-1", offset: 0 }, fragment }, 101);
    expect(engine.getDocument().resources.images[resource.id]?.name).toBe("pixel.png");
    expect(engine.getDocument().blocks.some(isImageBlock)).toBe(true);
  });

  it("migrates legacy JSON to the current schema", () => {
    const phaseThree = {
      metadata: { id: "legacy", title: "Anterior", schemaVersion: 3, createdAt: 1, updatedAt: 2, revision: 3 },
      pageSettings: { widthMm: 210, heightMm: 297, marginTopMm: 25.4, marginRightMm: 25.4, marginBottomMm: 25.4, marginLeftMm: 25.4 },
      resources: { images: {} },
      blocks: [{ blockType: "text", id: "block-1", kind: { type: "paragraph" }, paragraphStyle: { alignment: "left", lineHeight: 1.35, spaceBeforePt: 0, spaceAfterPt: 8, firstLineIndentMm: 0 }, list: null, runs: [{ id: "run-1", text: "Contenido", style: { bold: false, italic: false, underline: false, strike: false, fontFamily: "Arial", fontSizePt: 11, color: "#111111", highlight: null } }] }],
    } as unknown as TextDocument;
    const migrated = FallbackOfficeEngine.fromJson(JSON.stringify(phaseThree)).getDocument();
    expect(migrated.metadata.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.sections).toHaveLength(1);
    expect(migrated.blocks[0]?.sectionId).toBe(migrated.sections[0]?.id);
    expect(isTextBlock(migrated.blocks[0]!) ? migrated.blocks[0]!.paragraphStyle.widowControl : false).toBe(true);
  });

  it("supports undo and redo with section commands", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Demo", 100);
    engine.apply({ type: "setSectionProperties", sectionId: "section-1", patch: { columns: { count: 2 } } }, 101);
    engine.undo(102);
    expect(engine.getDocument().sections[0]?.columns.count).toBe(1);
    engine.redo(103);
    expect(engine.getDocument().sections[0]?.columns.count).toBe(2);
  });
});

describe("structured clipboard", () => {
  it("copies, serializes and rekeys a multi-block fragment", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Clipboard", 100);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Primero" }, 101);
    engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 102);
    engine.apply({ type: "replaceBlockText", blockId: "block-2", text: "Segundo" }, 103);
    const documentModel = engine.getDocument();
    const range = orderDocumentPoints(documentModel, { blockId: "block-1", offset: 2 }, { blockId: "block-2", offset: 4 });
    expect(range).not.toBeNull();
    if (!range) return;
    const fragment = fragmentFromSelection(documentModel, range);
    expect(fragmentToPlainText(fragment)).toBe("imero\nSegu");
    const rekeyed = rekeyFragment(fragment, "copy-1");
    expect(rekeyed.blocks[0]?.id).toBe("copy-1-block-1");
    expect(WEB_OFFICE_CLIPBOARD_MIME).toContain("web-office");
  });
});

describe("section-aware document layout", () => {
  it("paginates long text deterministically", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Layout", 100);
    const longText = Array.from({ length: 800 }, (_, index) => `palabra${index}`).join(" ");
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: longText }, 101);
    const layout = layoutDocument(engine.getDocument(), { measurer: createApproximateTextMeasurer() });
    const first = layout.blocks[0];
    expect(first?.kind).toBe("text");
    expect(first?.kind === "text" ? first.lines.length : 0).toBeGreaterThan(20);
    expect(layout.pages.length).toBeGreaterThan(1);
  });

  it("creates columns, resolves fields and formats restarted page numbers", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Memoria", 100);
    engine.apply({
      type: "setSectionProperties",
      sectionId: "section-1",
      patch: { columns: { count: 2, gapMm: 12, lineBetween: true }, pageNumbering: { restart: true, start: 4, format: "roman-lower" } },
    }, 101);
    engine.apply({
      type: "setSectionHeaderFooter",
      sectionId: "section-1",
      area: "footer",
      variant: "default",
      content: headerFooterFromTemplate("{{TITLE}} · {{PAGE}}/{{PAGES}}", { enabled: true }),
    }, 102);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: Array.from({ length: 1000 }, (_, index) => `texto${index}`).join(" ") }, 103);
    const layout = layoutDocument(engine.getDocument(), { measurer: createApproximateTextMeasurer(), now: new Date("2026-07-12T12:00:00Z") });
    expect(layout.pages[0]?.columns).toHaveLength(2);
    expect(layout.pages[0]?.lineBetweenColumns).toBe(true);
    expect(layout.pages[0]?.pageLabel).toBe("iv");
    expect(layout.pages[0]?.footerText).toContain("Memoria · 4/");
  });

  it("honors page breaks and page-break-before paragraphs", () => {
    const engine = FallbackOfficeEngine.create("doc-1", "Saltos", 100);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Primera página" }, 101);
    engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 102);
    engine.apply({ type: "replaceBlockText", blockId: "block-2", text: "Segunda página" }, 103);
    engine.apply({ type: "setParagraphStyle", blockId: "block-2", style: { pageBreakBefore: true, keepLinesTogether: true } }, 104);
    const layout = layoutDocument(engine.getDocument(), { measurer: createApproximateTextMeasurer() });
    expect(layout.pages.length).toBeGreaterThanOrEqual(2);
    expect(layout.pages[1]?.fragments.some((fragment) => fragment.blockId === "block-2")).toBe(true);
  });
});


describe("phase 2.4 review and interoperability", () => {
  it("stores comments, bookmarks, hyperlinks and tracked changes", () => {
    const engine = FallbackOfficeEngine.create("review", "Review", 100);
    engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Texto revisable" }, 101);
    engine.apply({ type: "setTrackChanges", enabled: true }, 102);
    engine.apply({ type: "insertText", blockId: "block-1", offset: 5, text: " muy" }, 103);
    const range = { start: { blockId: "block-1", offset: 0 }, end: { blockId: "block-1", offset: 5 } };
    engine.apply({ type: "addBookmark", bookmark: { id: "b1", name: "Inicio", range, createdAt: 104 } }, 104);
    engine.apply({ type: "setHyperlink", ...range, hyperlink: { href: "https://example.com/", title: null } }, 105);
    const documentModel = engine.getDocument();
    expect(documentModel.metadata.schemaVersion).toBe(5);
    expect(documentModel.review.changes.some((change) => change.status === "pending")).toBe(true);
    expect(documentModel.review.bookmarks[0]?.name).toBe("Inicio");
    expect(documentModel.blocks.filter(isTextBlock)[0]?.runs.some((run) => run.hyperlink)).toBe(true);
  });
});
