import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PARAGRAPH_STYLE,
  DEFAULT_TEXT_STYLE,
  createEmptyParagraph,
  createTableBlock,
  createTextDocument,
  isBreakBlock,
  isImageBlock,
  isTableBlock,
  isTextBlock,
  normalizeDocument,
  tableCellText,
  type DocumentBlock,
  type TextBlock,
  type TextDocument,
  type TextRun,
} from "./model";
import { createStoredZip, readZip, zipText } from "./zip";

export type OfficeDocumentFormat = "docx" | "odt";

export interface ImportedOfficeDocument {
  format: OfficeDocumentFormat;
  document: TextDocument;
  warnings: string[];
}

export function exportDocument(documentModel: TextDocument, format: OfficeDocumentFormat): Uint8Array {
  return format === "docx" ? exportDocx(documentModel) : exportOdt(documentModel);
}

export async function importDocument(input: ArrayBuffer | Uint8Array, fileName = "documento"): Promise<ImportedOfficeDocument> {
  const entries = await readZip(input);
  if (entries.has("word/document.xml")) return importDocx(entries, fileName);
  if (entries.has("content.xml")) return importOdt(entries, fileName);
  throw new Error("El paquete no contiene un documento DOCX u ODT reconocible.");
}

export function exportDocx(documentModel: TextDocument): Uint8Array {
  const body = documentModel.blocks.map(blockToWordXml).join("");
  const sect = firstSectionWordXml(documentModel);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${sect}</w:body></w:document>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(documentModel.metadata.title)}</dc:title><dc:creator>${xmlEscape(documentModel.review.author)}</dc:creator><cp:revision>${documentModel.metadata.revision}</cp:revision></cp:coreProperties>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1,2,3,4,5,6].map((level)=>`<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>`).join("")}</w:styles>`;
  const reviewJson = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, review: documentModel.review });
  return createStoredZip([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "word/document.xml", data: documentXml },
    { name: "word/styles.xml", data: styles },
    { name: "docProps/core.xml", data: core },
    { name: "customXml/item1.xml", data: `<webOfficeReview xmlns="urn:web-office-suite">${xmlEscape(reviewJson)}</webOfficeReview>` },
  ]);
}

export function exportOdt(documentModel: TextDocument): Uint8Array {
  const body = documentModel.blocks.map(blockToOdtXml).join("");
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.3"><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  const meta = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta><dc:title>${xmlEscape(documentModel.metadata.title)}</dc:title><meta:initial-creator>${xmlEscape(documentModel.review.author)}</meta:initial-creator></office:meta></office:document-meta>`;
  return createStoredZip([
    { name: "mimetype", data: "application/vnd.oasis.opendocument.text" },
    { name: "content.xml", data: content },
    { name: "styles.xml", data: `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.3"><office:styles/></office:document-styles>` },
    { name: "meta.xml", data: meta },
    { name: "META-INF/manifest.xml", data: `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>` },
    { name: "Configurations2/web-office-review.json", data: JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, review: documentModel.review }, null, 2) },
  ]);
}

function importDocx(entries: Awaited<ReturnType<typeof readZip>>, fileName: string): ImportedOfficeDocument {
  const xml = zipText(entries, "word/document.xml");
  const title = entries.has("docProps/core.xml") ? firstText(zipText(entries, "docProps/core.xml"), /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/u) : stripExtension(fileName);
  const blocks = parseWordBody(xml);
  const documentModel = createTextDocument(`doc-${crypto.randomUUID()}`, title || stripExtension(fileName), Date.now());
  documentModel.blocks = blocks.length > 0 ? blocks : documentModel.blocks;
  documentModel.metadata.title = title || stripExtension(fileName);
  const warnings = ["Importación DOCX inicial: conserva texto, títulos, listas simples, tablas y saltos; los objetos avanzados pueden simplificarse."];
  return { format: "docx", document: normalizeDocument(documentModel), warnings };
}

function importOdt(entries: Awaited<ReturnType<typeof readZip>>, fileName: string): ImportedOfficeDocument {
  const xml = zipText(entries, "content.xml");
  const title = entries.has("meta.xml") ? firstText(zipText(entries, "meta.xml"), /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/u) : stripExtension(fileName);
  const blocks = parseOdtBody(xml);
  const documentModel = createTextDocument(`doc-${crypto.randomUUID()}`, title || stripExtension(fileName), Date.now());
  documentModel.blocks = blocks.length > 0 ? blocks : documentModel.blocks;
  documentModel.metadata.title = title || stripExtension(fileName);
  return { format: "odt", document: normalizeDocument(documentModel), warnings: ["Importación ODT inicial: conserva texto, títulos, listas simples y tablas."] };
}

function blockToWordXml(block: DocumentBlock): string {
  if (isTextBlock(block)) {
    const style = block.kind.type === "heading" ? `<w:pStyle w:val="Heading${block.kind.level}"/>` : "";
    const listPrefix = block.list ? (block.list.kind === "bullet" ? "• " : `${block.list.start}. `) : "";
    return `<w:p><w:pPr>${style}${block.paragraphStyle.pageBreakBefore ? "<w:pageBreakBefore/>" : ""}</w:pPr>${listPrefix ? wordRun(listPrefix, block.runs[0]) : ""}${block.runs.map((run) => wordRun(run.text, run)).join("")}</w:p>`;
  }
  if (isTableBlock(block)) {
    return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${block.rows.map((row)=>`<w:tr>${row.cells.map((cell)=>`<w:tc><w:p>${cell.runs.map((run)=>wordRun(run.text,run)).join("")}</w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  }
  if (isImageBlock(block)) return `<w:p>${wordRun(block.caption || block.alt || `[Imagen: ${block.resourceId}]`, undefined)}</w:p>`;
  if (isBreakBlock(block)) return `<w:p><w:r><w:br w:type="${block.breakKind === "column" ? "column" : "page"}"/></w:r></w:p>`;
  return "";
}

function wordRun(text: string, run?: TextRun): string {
  const style = run?.style ?? DEFAULT_TEXT_STYLE;
  const props = [style.bold ? "<w:b/>" : "", style.italic ? "<w:i/>" : "", style.underline ? '<w:u w:val="single"/>' : "", style.strike ? "<w:strike/>" : "", `<w:rFonts w:ascii="${xmlEscape(style.fontFamily)}" w:hAnsi="${xmlEscape(style.fontFamily)}"/>`, `<w:sz w:val="${Math.round(style.fontSizePt * 2)}"/>`, `<w:color w:val="${style.color.replace("#", "")}"/>`].join("");
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function firstSectionWordXml(documentModel: TextDocument): string {
  const section = documentModel.sections[0];
  if (!section) return "<w:sectPr/>";
  const width = Math.round(section.pageSettings.widthMm * 56.6929);
  const height = Math.round(section.pageSettings.heightMm * 56.6929);
  return `<w:sectPr><w:pgSz w:w="${width}" w:h="${height}"/><w:pgMar w:top="${Math.round(section.pageSettings.marginTopMm * 56.6929)}" w:right="${Math.round(section.pageSettings.marginRightMm * 56.6929)}" w:bottom="${Math.round(section.pageSettings.marginBottomMm * 56.6929)}" w:left="${Math.round(section.pageSettings.marginLeftMm * 56.6929)}"/></w:sectPr>`;
}

function blockToOdtXml(block: DocumentBlock): string {
  if (isTextBlock(block)) {
    const tag = block.kind.type === "heading" ? `text:h text:outline-level="${block.kind.level}"` : "text:p";
    const close = block.kind.type === "heading" ? "text:h" : "text:p";
    const prefix = block.list ? (block.list.kind === "bullet" ? "• " : `${block.list.start}. `) : "";
    return `<${tag}>${xmlEscape(prefix + block.runs.map((run)=>run.text).join(""))}</${close}>`;
  }
  if (isTableBlock(block)) return `<table:table table:name="${xmlEscape(block.id)}">${block.rows.map((row)=>`<table:table-row>${row.cells.map((cell)=>`<table:table-cell office:value-type="string"><text:p>${xmlEscape(tableCellText(cell))}</text:p></table:table-cell>`).join("")}</table:table-row>`).join("")}</table:table>`;
  if (isImageBlock(block)) return `<text:p>${xmlEscape(block.caption || block.alt || `[Imagen: ${block.resourceId}]`)}</text:p>`;
  if (isBreakBlock(block)) return `<text:p>${block.breakKind === "column" ? "[Salto de columna]" : block.breakKind === "section" ? "[Salto de sección]" : "[Salto de página]"}</text:p>`;
  return "";
}

function parseWordBody(xml: string): DocumentBlock[] {
  const body = firstText(xml, /<w:body[^>]*>([\s\S]*?)<\/w:body>/u) || xml;
  const tokens = body.match(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/gu) ?? [];
  const blocks: DocumentBlock[] = [];
  let index = 0;
  for (const token of tokens) {
    index += 1;
    if (token.startsWith("<w:tbl")) {
      const rows = token.match(/<w:tr\b[\s\S]*?<\/w:tr>/gu) ?? [];
      const table = createTableBlock(`import-table-${index}`, Math.max(1, rows.length), Math.max(1, countWordCells(rows[0] ?? "")), `import-table-${index}`);
      table.rows = rows.map((row, rowIndex) => ({ id: `import-table-${index}-row-${rowIndex+1}`, cells: (row.match(/<w:tc\b[\s\S]*?<\/w:tc>/gu) ?? []).map((cell, cellIndex) => ({ id: `import-table-${index}-cell-${rowIndex+1}-${cellIndex+1}`, paragraphStyle: { ...DEFAULT_PARAGRAPH_STYLE, spaceAfterPt: 0 }, runs: [{ id: `import-table-${index}-cell-${rowIndex+1}-${cellIndex+1}-run`, text: wordText(cell), style: { ...DEFAULT_TEXT_STYLE }, hyperlink: null }], backgroundColor: null })) }));
      table.columnWidthsMm = Array.from({length: Math.max(1, table.rows[0]?.cells.length ?? 1)},()=>35);
      blocks.push(table);
    } else {
      const text = wordText(token);
      const block = createEmptyParagraph(`import-block-${index}`, `import-run-${index}`);
      block.runs[0]!.text = text;
      const heading = token.match(/<w:pStyle[^>]*w:val="Heading([1-6])"/u)?.[1];
      if (heading) block.kind = { type: "heading", level: Number(heading) };
      if (/<w:br[^>]*w:type="column"/u.test(token)) blocks.push({ blockType: "break", id: `import-break-${index}`, sectionId: "section-1", breakKind: "column", startType: "next-page", nextSectionId: null });
      else if (/<w:br[^>]*w:type="page"/u.test(token)) blocks.push({ blockType: "break", id: `import-break-${index}`, sectionId: "section-1", breakKind: "page", startType: "next-page", nextSectionId: null });
      else blocks.push(block);
    }
  }
  return blocks;
}

function parseOdtBody(xml: string): DocumentBlock[] {
  const tokens = xml.match(/<table:table\b[\s\S]*?<\/table:table>|<text:h\b[\s\S]*?<\/text:h>|<text:p\b[\s\S]*?<\/text:p>/gu) ?? [];
  const blocks: DocumentBlock[] = [];
  let index = 0;
  for (const token of tokens) {
    index += 1;
    if (token.startsWith("<table:table")) {
      const rows = token.match(/<table:table-row\b[\s\S]*?<\/table:table-row>/gu) ?? [];
      const firstCells = rows[0]?.match(/<table:table-cell\b[\s\S]*?<\/table:table-cell>/gu) ?? [];
      const table = createTableBlock(`odt-table-${index}`, Math.max(1, rows.length), Math.max(1, firstCells.length), `odt-table-${index}`);
      table.rows = rows.map((row,rowIndex)=>({ id:`odt-table-${index}-row-${rowIndex+1}`, cells:(row.match(/<table:table-cell\b[\s\S]*?<\/table:table-cell>/gu)??[]).map((cell,cellIndex)=>({ id:`odt-table-${index}-cell-${rowIndex+1}-${cellIndex+1}`, paragraphStyle:{...DEFAULT_PARAGRAPH_STYLE,spaceAfterPt:0}, runs:[{id:`odt-table-${index}-cell-${rowIndex+1}-${cellIndex+1}-run`,text:xmlText(cell),style:{...DEFAULT_TEXT_STYLE},hyperlink:null}],backgroundColor:null })) }));
      table.columnWidthsMm=Array.from({length:Math.max(1,table.rows[0]?.cells.length??1)},()=>35);
      blocks.push(table);
    } else {
      const block=createEmptyParagraph(`odt-block-${index}`,`odt-run-${index}`);
      block.runs[0]!.text=xmlText(token);
      if(token.startsWith("<text:h")) block.kind={type:"heading",level:Math.max(1,Math.min(6,Number(token.match(/text:outline-level="([1-6])"/u)?.[1]??1)))};
      blocks.push(block);
    }
  }
  return blocks;
}

function wordText(xml: string): string {
  return (xml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gu) ?? []).map((part)=>xmlUnescape(firstText(part, /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/u))).join("");
}
function xmlText(xml:string):string { return xmlUnescape(xml.replace(/<[^>]+>/gu,"")); }
function countWordCells(row:string):number { return (row.match(/<w:tc\b/gu)??[]).length; }
function firstText(value:string,pattern:RegExp):string { return value.match(pattern)?.[1]??""; }
function stripExtension(value:string):string { return value.replace(/\.(docx|odt)$/iu,"")||"Documento importado"; }
function xmlEscape(value:string):string { return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;"); }
function xmlUnescape(value:string):string { return value.replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&quot;",'"').replaceAll("&apos;","'").replaceAll("&amp;","&"); }
