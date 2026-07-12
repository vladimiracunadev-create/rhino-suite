import { FallbackOfficeEngine } from "../packages/engine-client/src/engine";
import { createApproximateTextMeasurer, layoutDocument } from "../packages/engine-client/src/layout";
import {
  blockText,
  createEmptyParagraph,
  createTableBlock,
  isImageBlock,
  isTableBlock,
  isTextBlock,
  type DocumentFragment,
  type ImageResource,
  type TextDocument,
} from "../packages/engine-client/src/model";
import {
  fragmentFromSelection,
  fragmentToPlainText,
  orderDocumentPoints,
  rekeyFragment,
} from "../packages/engine-client/src/selection";

let assertions = 0;
const check = (condition: unknown, message: string) => {
  assertions += 1;
  if (!condition) throw new Error(`Validación fallida: ${message}`);
};

const engine = FallbackOfficeEngine.create("doc-1", "Fase 2.3", 100);
engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Hola 🌎" }, 101);
engine.apply({ type: "insertText", blockId: "block-1", offset: 5, text: "mundo " }, 102);
check(engine.getDocument().blocks.find(isTextBlock)?.runs.map((run) => run.text).join("") === "Hola mundo 🌎", "Unicode");

engine.apply({ type: "addParagraph", afterBlockId: "block-1", blockId: "block-2", runId: "run-2" }, 103);
engine.apply({ type: "replaceBlockText", blockId: "block-2", text: "Segundo párrafo" }, 104);
engine.apply({
  type: "formatDocumentRange",
  start: { blockId: "block-1", offset: 5 },
  end: { blockId: "block-2", offset: 7 },
  style: { bold: true },
}, 105);
const textBlocks = engine.getDocument().blocks.filter(isTextBlock);
check(textBlocks[0]?.runs.some((run) => run.style.bold), "Formato multipárrafo inicial");
check(textBlocks[1]?.runs.some((run) => run.style.bold), "Formato multipárrafo final");

engine.apply({ type: "setList", blockIds: ["block-1", "block-2"], list: { id: "list-1", kind: "number", level: 0, start: 1 } }, 106);
check(engine.getDocument().blocks.filter(isTextBlock).every((block) => block.list?.kind === "number"), "Listas");

const table = createTableBlock("table-1", 2, 2, "table-1");
const tail = createEmptyParagraph("tail-1", "tail-run-1");
const tableFragment: DocumentFragment = { version: 1, sourceSchemaVersion: 3, blocks: [table, tail], resources: { images: {} } };
engine.apply({ type: "replaceRangeWithFragment", start: { blockId: "block-2", offset: 7 }, end: { blockId: "block-2", offset: 7 }, fragment: tableFragment }, 107);
const insertedTable = engine.getDocument().blocks.find(isTableBlock);
check(insertedTable?.rows.length === 2 && insertedTable.columnWidthsMm.length === 2, "Tabla 2x2");
if (!insertedTable) throw new Error("Tabla ausente");
const firstCell = insertedTable.rows[0]?.cells[0];
if (!firstCell) throw new Error("Celda ausente");
engine.apply({ type: "updateTableCell", tableId: insertedTable.id, rowId: insertedTable.rows[0]!.id, cellId: firstCell.id, text: "Dato" }, 108);
check(engine.getDocument().blocks.find(isTableBlock)?.rows[0]?.cells[0]?.runs[0]?.text === "Dato", "Edición de celda");

const resource: ImageResource = { id: "resource-1", kind: "image", name: "pixel.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==", byteLength: 1, createdAt: 109 };
const imageFragment: DocumentFragment = {
  version: 1,
  sourceSchemaVersion: 3,
  resources: { images: { [resource.id]: resource } },
  blocks: [
    { blockType: "image", id: "image-1", resourceId: resource.id, alt: "Pixel", widthMm: 20, heightMm: 20, alignment: "center", caption: "Prueba" },
    createEmptyParagraph("image-tail", "image-tail-run"),
  ],
};
engine.apply({ type: "replaceRangeWithFragment", start: { blockId: "tail-1", offset: 0 }, end: { blockId: "tail-1", offset: 0 }, fragment: imageFragment }, 109);
check(engine.getDocument().blocks.some(isImageBlock), "Bloque de imagen");
check(engine.getDocument().resources.images[resource.id]?.name === "pixel.png", "Recurso separado");

const current = engine.getDocument();
const range = orderDocumentPoints(current, { blockId: "block-1", offset: 2 }, { blockId: "block-2", offset: 4 });
check(range !== null, "Selección documental");
if (!range) throw new Error("Rango ausente");
const copied = fragmentFromSelection(current, range);
check(copied.blocks.length >= 2, "Fragmento multipárrafo");
check(fragmentToPlainText(copied).length > 0, "Texto plano del portapapeles");
check(rekeyFragment(copied, "copy").blocks[0]?.id === "copy-block-1", "Rekey portapapeles");

const layout = layoutDocument(current, { measurer: createApproximateTextMeasurer() });
check(layout.pages.length >= 1, "Paginación");
check(layout.blocks.some((block) => block.kind === "table"), "Layout de tabla");
check(layout.blocks.some((block) => block.kind === "image"), "Layout de imagen");

const legacy = {
  metadata: { id: "legacy", title: "Fase 2.1", schemaVersion: 2, createdAt: 1, updatedAt: 2, revision: 3 },
  pageSettings: { widthMm: 210, heightMm: 297, marginTopMm: 25.4, marginRightMm: 25.4, marginBottomMm: 25.4, marginLeftMm: 25.4 },
  blocks: [{ id: "legacy-block", kind: { type: "paragraph" }, paragraphStyle: { alignment: "left", lineHeight: 1.35, spaceBeforePt: 0, spaceAfterPt: 8, firstLineIndentMm: 0 }, runs: [{ id: "legacy-run", text: "Contenido", style: { bold: false, italic: false, underline: false, strike: false, fontFamily: "Arial", fontSizePt: 11, color: "#111111", highlight: null } }] }],
} as unknown as TextDocument;
const migrated = FallbackOfficeEngine.fromJson(JSON.stringify(legacy)).getDocument();
check(migrated.metadata.schemaVersion === 5, "Migración histórica normalizada a schema v5");
check(migrated.blocks[0]?.blockType === "text", "Discriminador de bloque migrado");
check(Object.keys(migrated.resources.images).length === 0, "Recursos migrados");

engine.undo(110);
engine.redo(111);
check(engine.getDocument().metadata.revision > current.metadata.revision, "Undo/redo y revisión");

console.log(`Fase 2.3 validada: ${assertions} aserciones.`);
