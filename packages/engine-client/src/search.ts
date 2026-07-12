import {
  blockText,
  headerFooterToTemplate,
  isTableBlock,
  isTextBlock,
  tableCellText,
  type DocumentPoint,
  type TextDocument,
} from "./model";

export type SearchScope = "body" | "headers-footers" | "comments";

export interface DocumentSearchMatch {
  id: string;
  scope: SearchScope;
  text: string;
  preview: string;
  start?: DocumentPoint;
  end?: DocumentPoint;
  sectionId?: string;
  commentId?: string;
  tableId?: string;
  cellId?: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegularExpression?: boolean;
  includeHeadersFooters?: boolean;
  includeComments?: boolean;
}

export function searchDocument(documentModel: TextDocument, query: string, options: SearchOptions = {}): DocumentSearchMatch[] {
  if (!query) return [];
  const expression = buildExpression(query, options);
  const matches: DocumentSearchMatch[] = [];
  for (const block of documentModel.blocks) {
    if (isTextBlock(block)) {
      collectTextMatches(blockText(block), expression, (start, end, text) => ({
        id: `body-${block.id}-${start}-${end}`,
        scope: "body",
        text,
        preview: makePreview(blockText(block), start, end),
        start: { blockId: block.id, offset: start },
        end: { blockId: block.id, offset: end },
        sectionId: block.sectionId,
      }), matches);
    } else if (isTableBlock(block)) {
      for (const row of block.rows) for (const cell of row.cells) {
        const value = tableCellText(cell);
        collectTextMatches(value, expression, (start, end, text) => ({
          id: `table-${block.id}-${cell.id}-${start}-${end}`,
          scope: "body",
          text,
          preview: makePreview(value, start, end),
          tableId: block.id,
          cellId: cell.id,
          sectionId: block.sectionId,
        }), matches);
      }
    }
  }
  if (options.includeHeadersFooters) {
    for (const section of documentModel.sections) {
      for (const area of [section.headers, section.footers]) for (const content of [area.default, area.first, area.even]) {
        const value = headerFooterToTemplate(content);
        collectTextMatches(value, expression, (start, end, text) => ({
          id: `hf-${section.id}-${matches.length}-${start}`,
          scope: "headers-footers",
          text,
          preview: makePreview(value, start, end),
          sectionId: section.id,
        }), matches);
      }
    }
  }
  if (options.includeComments) {
    for (const thread of documentModel.review.comments) for (const message of thread.messages) {
      collectTextMatches(message.text, expression, (start, end, text) => ({
        id: `comment-${thread.id}-${message.id}-${start}`,
        scope: "comments",
        text,
        preview: makePreview(message.text, start, end),
        commentId: thread.id,
        start: thread.range.start,
        end: thread.range.end,
      }), matches);
    }
  }
  return matches;
}

function buildExpression(query: string, options: SearchOptions): RegExp {
  const source = options.useRegularExpression ? query : escapeRegExp(query);
  const wrapped = options.wholeWord ? `\\b(?:${source})\\b` : source;
  try {
    return new RegExp(wrapped, options.caseSensitive ? "gu" : "giu");
  } catch (error) {
    throw new Error(`Expresión de búsqueda inválida: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function collectTextMatches(
  value: string,
  expression: RegExp,
  create: (start: number, end: number, text: string) => DocumentSearchMatch,
  output: DocumentSearchMatch[],
): void {
  expression.lastIndex = 0;
  for (const match of value.matchAll(expression)) {
    const utf16Start = match.index ?? 0;
    const utf16End = utf16Start + match[0].length;
    const start = Array.from(value.slice(0, utf16Start)).length;
    const end = start + Array.from(match[0]).length;
    output.push(create(start, end, match[0]));
    if (utf16End === utf16Start) expression.lastIndex += 1;
  }
}

function makePreview(value: string, start: number, end: number): string {
  const characters = Array.from(value);
  const from = Math.max(0, start - 24);
  const to = Math.min(characters.length, end + 36);
  return `${from > 0 ? "…" : ""}${characters.slice(from, to).join("")}${to < characters.length ? "…" : ""}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
