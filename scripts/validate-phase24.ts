import {
  FallbackOfficeEngine,
  blockText,
  exportDocx,
  exportOdt,
  fragmentFromSelection,
  importDocument,
  isTextBlock,
  orderDocumentPoints,
  searchDocument,
} from "../packages/engine-client/src/index";

let assertions = 0;
function check(condition: unknown, message: string): void {
  assertions += 1;
  if (!condition) throw new Error(`Validación fallida: ${message}`);
}

async function main(): Promise<void> {
  const engine = FallbackOfficeEngine.create("phase24", "Informe Fase 2.4", 100);
  engine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Documento revisable con enlace y comentario." }, 101);
  engine.apply({ type: "setReviewAuthor", author: "Vladimir" }, 102);
  engine.apply({ type: "setTrackChanges", enabled: true }, 103);
  engine.apply({ type: "insertText", blockId: "block-1", offset: 10, text: " profesional" }, 104);
  let documentModel = engine.getDocument();
  check(documentModel.metadata.schemaVersion === 5, "schema v5");
  check(documentModel.review.author === "Vladimir", "autor de revisión");
  check(documentModel.review.changes.length === 1, "cambio registrado");
  check(documentModel.review.changes[0]?.status === "pending", "cambio pendiente");

  const range = orderDocumentPoints(documentModel, { blockId: "block-1", offset: 0 }, { blockId: "block-1", offset: 9 });
  check(Boolean(range), "rango para revisión");
  if (!range) return;
  const now = 105;
  engine.apply({
    type: "addComment",
    thread: {
      id: "comment-1",
      range: { start: range.start, end: range.end },
      quote: "Documento",
      messages: [{ id: "message-1", author: "Vladimir", text: "Revisar introducción", createdAt: now, updatedAt: now }],
      resolved: false,
      createdAt: now,
      updatedAt: now,
    },
  }, 105);
  engine.apply({ type: "addBookmark", bookmark: { id: "bookmark-1", name: "Introducción", range: { start: range.start, end: range.end }, createdAt: 106 } }, 106);
  engine.apply({ type: "setHyperlink", start: range.start, end: range.end, hyperlink: { href: "https://example.com/", title: "Referencia" } }, 107);
  documentModel = engine.getDocument();
  check(documentModel.review.comments.length === 1, "comentario persistido");
  check(documentModel.review.bookmarks.length === 1, "marcador persistido");
  check(documentModel.blocks.filter(isTextBlock)[0]?.runs.some((run) => run.hyperlink?.href === "https://example.com/"), "hipervínculo estructurado");

  const bodyMatches = searchDocument(documentModel, "profesional");
  const commentMatches = searchDocument(documentModel, "introducción", { includeComments: true });
  check(bodyMatches.length === 1, "búsqueda en cuerpo");
  check(commentMatches.some((match) => match.scope === "comments"), "búsqueda en comentarios");
  check(fragmentFromSelection(documentModel, range).blocks.length === 1, "fragmento de comentario copiable");

  const docx = exportDocx(documentModel);
  const odt = exportOdt(documentModel);
  check(docx[0] === 0x50 && docx[1] === 0x4b, "DOCX es un paquete ZIP");
  check(odt[0] === 0x50 && odt[1] === 0x4b, "ODT es un paquete ZIP");
  const importedDocx = await importDocument(docx, "fase24.docx");
  const importedOdt = await importDocument(odt, "fase24.odt");
  check(importedDocx.format === "docx", "importación DOCX");
  check(importedOdt.format === "odt", "importación ODT");
  check(importedDocx.document.blocks.filter(isTextBlock).some((block) => blockText(block).includes("Documento")), "roundtrip DOCX");
  check(importedOdt.document.blocks.filter(isTextBlock).some((block) => blockText(block).includes("Documento")), "roundtrip ODT");

  const pending = engine.getDocument().review.changes.filter((change) => change.status === "pending");
  const latest = pending.at(-1);
  check(Boolean(latest), "cambio pendiente para rechazo");
  if (latest) engine.apply({ type: "rejectChange", changeId: latest.id }, 108);
  check(engine.getDocument().review.changes.some((change) => change.id === latest?.id && change.status === "rejected"), "rechazo de último cambio");

  const acceptedEngine = FallbackOfficeEngine.create("accept", "Aceptar", 200);
  acceptedEngine.apply({ type: "setTrackChanges", enabled: true }, 201);
  acceptedEngine.apply({ type: "replaceBlockText", blockId: "block-1", text: "Cambio aceptable" }, 202);
  const changeId = acceptedEngine.getDocument().review.changes[0]?.id;
  if (changeId) acceptedEngine.apply({ type: "acceptChange", changeId }, 203);
  check(acceptedEngine.getDocument().review.changes[0]?.status === "accepted", "aceptación de cambio");

  console.log(`Fase 2.4 validada: ${assertions} aserciones.`);
}

void main();
