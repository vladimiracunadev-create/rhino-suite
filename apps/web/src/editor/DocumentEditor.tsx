import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CompositionEvent,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BookmarkIcon,
  BulletListIcon,
  ColumnBreakIcon,
  CommentIcon,
  DownloadIcon,
  ImageIcon,
  InspectorIcon,
  LayoutIcon,
  LinkIcon,
  NumberListIcon,
  OpenIcon,
  PageBreakIcon,
  PrintIcon,
  RedoIcon,
  ReviewIcon,
  SaveIcon,
  SectionBreakIcon,
  TableIcon,
  TrackChangesIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./EditorIcons";
import {
  WEB_OFFICE_CLIPBOARD_MIME,
  blockText,
  caretAfterFragment,
  characterLength,
  createBreakBlock,
  createCanvasTextMeasurer,
  createDocumentSection,
  createEmptyParagraph,
  createTableBlock,
  createTableCell,
  documentBlockText,
  emptyFragment,
  exportDocument,
  fragmentFromPlainText,
  fragmentFromSelection,
  fragmentToPlainText,
  getSection,
  headerFooterFromTemplate,
  headerFooterToTemplate,
  importDocument,
  isBreakBlock,
  isImageBlock,
  isTableBlock,
  isTextBlock,
  layoutDocument,
  orderDocumentPoints,
  parseClipboardFragment,
  rekeyFragment,
  searchDocument,
  sliceRuns,
  styleAtOffset,
  tableCellText,
  textBlockIdsInRange,
  type BreakBlock,
  type BreakPageFragment,
  type DocumentCommand,
  type DocumentFragment,
  type DocumentSection,
  type DocumentSelectionRange,
  type DocumentSearchMatch,
  type HeaderFooterArea,
  type HeaderFooterVariant,
  type ImageBlock,
  type ImageResource,
  type OfficeDocumentFormat,
  type OfficeEngineClient,
  type ParagraphStylePatch,
  type TableBlock,
  type TableCell,
  type TablePageFragment,
  type TextAlignment,
  type TextBlock,
  type TextDocument,
  type TextPageFragment,
  type TextStyle,
  type TextStylePatch,
} from "@web-office/engine-client";
import {
  readModelSelection,
  restoreModelSelection,
  type ModelSelection,
} from "./domSelection";

interface DocumentEditorProps {
  document: TextDocument;
  engine: OfficeEngineClient;
  onDocumentChange(document: TextDocument): void;
  onMessage(message: string): void;
  onOpenDocument(document: TextDocument): void;
  onSave(): void;
}

interface PendingSelection {
  selection: ModelSelection;
  focus: boolean;
}

const FONT_FAMILIES = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana"];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 24, 32, 40];

export function DocumentEditor({
  document: documentModel,
  engine,
  onDocumentChange,
  onMessage,
  onOpenDocument,
  onSave,
}: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const officeInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSelectionRef = useRef<PendingSelection | null>(null);
  const composingRef = useRef(false);
  const compositionStartRef = useRef<ModelSelection | null>(null);
  const ignoreNextInputRef = useRef(false);
  const [selection, setSelection] = useState<ModelSelection | null>(null);
  const [typingStyle, setTypingStyle] = useState<TextStyle | null>(null);
  const [zoom, setZoom] = useState(0.88);
  const [showInspector, setShowInspector] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const measurer = useMemo(() => {
    try {
      return createCanvasTextMeasurer();
    } catch {
      return undefined;
    }
  }, []);
  const layout = useMemo(
    () => layoutDocument(documentModel, { zoom, ...(measurer ? { measurer } : {}) }),
    [documentModel, measurer, zoom],
  );
  const blocksById = useMemo(
    () => new Map(documentModel.blocks.map((block) => [block.id, block])),
    [documentModel.blocks],
  );
  const layoutsById = useMemo(
    () => new Map(layout.blocks.map((block) => [block.blockId, block])),
    [layout.blocks],
  );

  const selectedRange = useMemo(
    () => selection ? orderDocumentPoints(documentModel, selection.anchor, selection.focus) : null,
    [documentModel, selection],
  );
  const selectedTextIds = useMemo(
    () => selectedRange ? textBlockIdsInRange(documentModel, selectedRange) : [],
    [documentModel, selectedRange],
  );
  const activeBlock = selectedRange ? blocksById.get(selectedRange.start.blockId) : undefined;
  const activeTextBlock = activeBlock && isTextBlock(activeBlock) ? activeBlock : undefined;
  const selectedObject = selectedObjectId ? blocksById.get(selectedObjectId) : undefined;
  const activeSectionId = activeBlock?.sectionId
    ?? selectedObject?.sectionId
    ?? documentModel.blocks.find(isTextBlock)?.sectionId
    ?? documentModel.sections[0]?.id
    ?? "section-1";
  const activeSection = getSection(documentModel, activeSectionId);
  const activeStyle = useMemo(() => {
    if (!activeTextBlock || !selectedRange) {
      const firstText = documentModel.blocks.find(isTextBlock);
      return typingStyle ?? firstText?.runs[0]?.style ?? null;
    }
    const offset = selectedRange.collapsed
      ? selectedRange.start.offset
      : Math.min(selectedRange.start.offset, Math.max(0, characterLength(blockText(activeTextBlock)) - 1));
    return typingStyle ?? styleAtOffset(activeTextBlock, offset);
  }, [activeTextBlock, documentModel.blocks, selectedRange, typingStyle]);

  const commentedBlockIds = useMemo(() => new Set(documentModel.review.comments.flatMap((thread) => [thread.range.start.blockId, thread.range.end.blockId])), [documentModel.review.comments]);
  const bookmarkedBlockIds = useMemo(() => new Set(documentModel.review.bookmarks.flatMap((bookmark) => [bookmark.range.start.blockId, bookmark.range.end.blockId])), [documentModel.review.bookmarks]);
  const searchResult = useMemo<{ matches: DocumentSearchMatch[]; error: string | null }>(() => {
    if (!searchQuery.trim()) return { matches: [], error: null };
    try {
      return {
        matches: searchDocument(documentModel, searchQuery, { includeHeadersFooters: true, includeComments: true }),
        error: null,
      };
    } catch (error) {
      return { matches: [], error: error instanceof Error ? error.message : String(error) };
    }
  }, [documentModel, searchQuery]);
  const searchMatches = searchResult.matches;
  const searchError = searchResult.error;

  useEffect(() => {
    const handleSelectionChange = () => {
      const root = editorRef.current;
      if (!root) return;
      const next = readModelSelection(root);
      if (!next) return;
      setSelection(next);
      setSelectedObjectId(null);
      const range = orderDocumentPoints(documentModel, next.anchor, next.focus);
      if (!range) return;
      const block = blocksById.get(range.start.blockId);
      if (block && isTextBlock(block)) setTypingStyle(styleAtOffset(block, range.start.offset));
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [blocksById, documentModel]);

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    const root = editorRef.current;
    if (!pending || !root) return;
    requestAnimationFrame(() => {
      if (pending.focus) root.focus({ preventScroll: true });
      restoreModelSelection(root, pending.selection);
      setSelection(pending.selection);
      pendingSelectionRef.current = null;
    });
  }, [documentModel]);

  const commit = useCallback((
    command: DocumentCommand,
    nextSelection?: ModelSelection,
    nextObjectId?: string | null,
  ) => {
    try {
      const next = engine.apply(command);
      if (nextSelection) pendingSelectionRef.current = { selection: nextSelection, focus: true };
      if (nextObjectId !== undefined) setSelectedObjectId(nextObjectId);
      onDocumentChange(next);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No fue posible aplicar el comando.");
    }
  }, [engine, onDocumentChange, onMessage]);

  const currentSelection = useCallback((): ModelSelection | null => {
    const root = editorRef.current;
    return root ? readModelSelection(root) ?? selection : selection;
  }, [selection]);

  const currentRange = useCallback((override?: ModelSelection | null): DocumentSelectionRange | null => {
    const current = override ?? currentSelection();
    return current ? orderDocumentPoints(documentModel, current.anchor, current.focus) : null;
  }, [currentSelection, documentModel]);

  const commitFragment = useCallback((
    range: DocumentSelectionRange,
    fragment: DocumentFragment,
    nextSelection: ModelSelection,
    nextObjectId?: string | null,
  ) => {
    const suffix = crypto.randomUUID();
    commit({
      type: "replaceRangeWithFragment",
      start: range.start,
      end: range.end,
      fragment,
      trailingBlockId: `block-tail-${suffix}`,
      trailingRunId: `run-tail-${suffix}`,
    }, nextSelection, nextObjectId);
  }, [commit]);

  const replaceSelectionWithText = useCallback((
    text: string,
    style?: TextStylePatch,
    override?: ModelSelection | null,
  ) => {
    const range = currentRange(override);
    if (!range) return;
    const prefix = `paste-${crypto.randomUUID()}`;
    const sourceStyle = { ...(activeStyle ?? defaultStyle()), ...(style ?? {}) };
    const fragment = text.length === 0 ? emptyFragment() : fragmentFromPlainText(text, prefix, sourceStyle);
    const caret = text.length === 0 ? range.start : caretAfterFragment(range.start, fragment);
    const next = { anchor: caret, focus: caret };
    commitFragment(range, fragment, next);
  }, [activeStyle, commitFragment, currentRange]);

  const splitCurrentBlock = useCallback(() => {
    const range = currentRange();
    if (!range) return;
    const source = blocksById.get(range.start.blockId);
    if (!source || !isTextBlock(source)) return;
    const suffix = crypto.randomUUID();
    const first = createEmptyParagraph(`split-first-${suffix}`, `split-first-run-${suffix}`, source.sectionId);
    const second = createEmptyParagraph(`split-second-${suffix}`, `split-second-run-${suffix}`, source.sectionId);
    first.kind = structuredClone(source.kind);
    first.paragraphStyle = structuredClone(source.paragraphStyle);
    first.list = structuredClone(source.list);
    first.runs[0]!.style = { ...(activeStyle ?? defaultStyle()) };
    second.kind = source.kind.type === "heading" ? { type: "paragraph" } : structuredClone(source.kind);
    second.paragraphStyle = structuredClone(source.paragraphStyle);
    second.list = structuredClone(source.list);
    second.runs[0]!.style = { ...(activeStyle ?? defaultStyle()) };
    const fragment: DocumentFragment = {
      version: 1,
      sourceSchemaVersion: documentModel.metadata.schemaVersion,
      blocks: [first, second],
      resources: { images: {} },
    };
    const point = { blockId: second.id, offset: 0 };
    commitFragment(range, fragment, { anchor: point, focus: point });
  }, [activeStyle, blocksById, commitFragment, currentRange, documentModel.metadata.schemaVersion]);

  const deleteBackward = useCallback(() => {
    const range = currentRange();
    if (!range) return;
    if (!range.collapsed) {
      replaceSelectionWithText("");
      return;
    }
    const blockIndex = documentModel.blocks.findIndex((block) => block.id === range.start.blockId);
    const block = documentModel.blocks[blockIndex];
    if (!block || !isTextBlock(block)) return;
    if (range.start.offset > 0) {
      const point = { blockId: block.id, offset: range.start.offset - 1 };
      commit({ type: "deleteText", blockId: block.id, start: range.start.offset - 1, end: range.start.offset }, { anchor: point, focus: point });
      return;
    }
    const previous = documentModel.blocks[blockIndex - 1];
    if (!previous) return;
    if (isTextBlock(previous)) {
      const offset = characterLength(blockText(previous));
      const point = { blockId: previous.id, offset };
      commit({ type: "mergeWithPrevious", blockId: block.id }, { anchor: point, focus: point });
    } else {
      commit({ type: "removeBlock", blockId: previous.id }, { anchor: range.start, focus: range.start });
    }
  }, [commit, currentRange, documentModel.blocks, replaceSelectionWithText]);

  const deleteForward = useCallback(() => {
    const range = currentRange();
    if (!range) return;
    if (!range.collapsed) {
      replaceSelectionWithText("");
      return;
    }
    const blockIndex = documentModel.blocks.findIndex((block) => block.id === range.start.blockId);
    const block = documentModel.blocks[blockIndex];
    if (!block || !isTextBlock(block)) return;
    const length = characterLength(blockText(block));
    if (range.start.offset < length) {
      const point = { blockId: block.id, offset: range.start.offset };
      commit({ type: "deleteText", blockId: block.id, start: range.start.offset, end: range.start.offset + 1 }, { anchor: point, focus: point });
      return;
    }
    const next = documentModel.blocks[blockIndex + 1];
    if (!next) return;
    const point = { blockId: block.id, offset: range.start.offset };
    if (isTextBlock(next)) commit({ type: "mergeWithPrevious", blockId: next.id }, { anchor: point, focus: point });
    else commit({ type: "removeBlock", blockId: next.id }, { anchor: point, focus: point });
  }, [commit, currentRange, documentModel.blocks, replaceSelectionWithText]);

  const handleBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const native = event.nativeEvent as InputEvent;
    if (composingRef.current || native.isComposing) return;
    const inputType = native.inputType;
    if (inputType === "insertText" || inputType === "insertReplacementText") {
      event.preventDefault();
      replaceSelectionWithText(native.data ?? "", typingStyle ?? undefined);
    } else if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
      event.preventDefault();
      splitCurrentBlock();
    } else if (inputType === "deleteContentBackward" || inputType === "deleteWordBackward") {
      event.preventDefault();
      deleteBackward();
    } else if (inputType === "deleteContentForward" || inputType === "deleteWordForward") {
      event.preventDefault();
      deleteForward();
    } else if (inputType === "historyUndo") {
      event.preventDefault();
      onDocumentChange(engine.undo());
    } else if (inputType === "historyRedo") {
      event.preventDefault();
      onDocumentChange(engine.redo());
    }
  };

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    if (composingRef.current || ignoreNextInputRef.current) {
      ignoreNextInputRef.current = false;
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("[data-table-cell='true']")) return;
    const fragment = target.closest<HTMLElement>("[data-editor-fragment='true']");
    if (!fragment) return;
    const blockId = fragment.dataset.blockId;
    const block = blockId ? blocksById.get(blockId) : undefined;
    if (!blockId || !block || !isTextBlock(block)) return;
    const start = Number(fragment.dataset.start ?? 0);
    const end = Number(fragment.dataset.end ?? start);
    const text = (fragment.innerText || "").replaceAll("\u200b", "").replace(/\n$/u, "");
    const point = { blockId, offset: start + characterLength(text) };
    commit({ type: "replaceTextRange", blockId, start, end, text }, { anchor: point, focus: point });
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
    compositionStartRef.current = currentSelection();
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    ignoreNextInputRef.current = true;
    const started = compositionStartRef.current;
    compositionStartRef.current = null;
    if (!started) return;
    replaceSelectionWithText(event.data, typingStyle ?? undefined, started);
  };

  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    const range = currentRange();
    if (!range || range.collapsed) return;
    event.preventDefault();
    const fragment = fragmentFromSelection(documentModel, range);
    event.clipboardData.setData(WEB_OFFICE_CLIPBOARD_MIME, JSON.stringify(fragment));
    event.clipboardData.setData("text/plain", fragmentToPlainText(fragment));
    onMessage(`Copiado: ${fragment.blocks.length} bloque(s) con formato estructurado.`);
  };

  const handleCut = (event: ClipboardEvent<HTMLDivElement>) => {
    const range = currentRange();
    if (!range || range.collapsed) return;
    event.preventDefault();
    const fragment = fragmentFromSelection(documentModel, range);
    event.clipboardData.setData(WEB_OFFICE_CLIPBOARD_MIME, JSON.stringify(fragment));
    event.clipboardData.setData("text/plain", fragmentToPlainText(fragment));
    const point = range.start;
    commitFragment(range, emptyFragment(), { anchor: point, focus: point });
    onMessage(`Cortado: ${fragment.blocks.length} bloque(s).`);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const range = currentRange();
    if (!range) return;
    const structured = parseClipboardFragment(event.clipboardData.getData(WEB_OFFICE_CLIPBOARD_MIME));
    if (structured) {
      const fragment = rekeyFragment(structured, `clipboard-${crypto.randomUUID()}`);
      const caret = caretAfterFragment(range.start, fragment);
      commitFragment(range, fragment, { anchor: caret, focus: caret });
      onMessage(`Pegado estructurado: ${fragment.blocks.length} bloque(s).`);
      return;
    }
    replaceSelectionWithText(event.clipboardData.getData("text/plain"), typingStyle ?? undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === "s") {
      event.preventDefault();
      onSave();
    } else if (modifier && key === "z") {
      event.preventDefault();
      onDocumentChange(event.shiftKey ? engine.redo() : engine.undo());
    } else if (modifier && key === "y") {
      event.preventDefault();
      onDocumentChange(engine.redo());
    } else if (modifier && key === "b") {
      event.preventDefault();
      applyInlineStyle({ bold: !activeStyle?.bold });
    } else if (modifier && key === "i") {
      event.preventDefault();
      applyInlineStyle({ italic: !activeStyle?.italic });
    } else if (modifier && key === "u") {
      event.preventDefault();
      applyInlineStyle({ underline: !activeStyle?.underline });
    } else if (modifier && key === "a") {
      event.preventDefault();
      selectAllText();
    }
  };

  const selectAllText = () => {
    const textBlocks = documentModel.blocks.filter(isTextBlock);
    const first = textBlocks[0];
    const last = textBlocks.at(-1);
    if (!first || !last) return;
    const next = {
      anchor: { blockId: first.id, offset: 0 },
      focus: { blockId: last.id, offset: characterLength(blockText(last)) },
    };
    pendingSelectionRef.current = { selection: next, focus: true };
    requestAnimationFrame(() => {
      const root = editorRef.current;
      if (root) restoreModelSelection(root, next);
      setSelection(next);
    });
  };

  const applyInlineStyle = (patch: TextStylePatch) => {
    const range = currentRange();
    if (!range) return;
    setTypingStyle((currentStyle) => ({ ...(currentStyle ?? activeStyle ?? defaultStyle()), ...patch }));
    if (range.collapsed) return;
    const current = currentSelection();
    commit({ type: "formatDocumentRange", start: range.start, end: range.end, style: patch }, current ?? undefined);
  };

  const applyParagraphStyle = (patch: ParagraphStylePatch) => {
    const range = currentRange();
    if (!range) return;
    const current = currentSelection();
    commit({ type: "setParagraphStyleMany", blockIds: textBlockIdsInRange(documentModel, range), style: patch }, current ?? undefined);
  };

  const applyBlockKind = (value: string) => {
    const range = currentRange();
    if (!range) return;
    const kind = value === "paragraph"
      ? { type: "paragraph" as const }
      : { type: "heading" as const, level: Number(value.slice(1)) };
    const current = currentSelection();
    commit({ type: "setBlockKindMany", blockIds: textBlockIdsInRange(documentModel, range), kind }, current ?? undefined);
  };

  const toggleList = (kind: "bullet" | "number") => {
    const range = currentRange();
    if (!range) return;
    const ids = textBlockIdsInRange(documentModel, range);
    const everyActive = ids.length > 0 && ids.every((id) => {
      const block = blocksById.get(id);
      return block && isTextBlock(block) && block.list?.kind === kind;
    });
    const list = everyActive ? null : {
      id: `list-${crypto.randomUUID()}`,
      kind,
      level: 0,
      start: 1,
    };
    const current = currentSelection();
    commit({ type: "setList", blockIds: ids, list }, current ?? undefined);
  };

  const insertTable = () => {
    const range = currentRange();
    if (!range) return;
    const suffix = crypto.randomUUID();
    const table = createTableBlock(`table-${suffix}`, 2, 2, `table-${suffix}`, activeSectionId);
    const tail = createEmptyParagraph(`table-tail-${suffix}`, `table-tail-run-${suffix}`, activeSectionId);
    const fragment: DocumentFragment = {
      version: 1,
      sourceSchemaVersion: documentModel.metadata.schemaVersion,
      blocks: [table, tail],
      resources: { images: {} },
    };
    const point = { blockId: tail.id, offset: 0 };
    commitFragment(range, fragment, { anchor: point, focus: point }, table.id);
  };

  const requestImage = () => {
    if (!currentRange()) {
      onMessage("Ubique el cursor donde desea insertar la imagen.");
      return;
    }
    imageInputRef.current?.click();
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onMessage("El archivo seleccionado no es una imagen compatible.");
      return;
    }
    const range = currentRange();
    if (!range) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const dimensions = await readImageDimensions(dataUrl);
      const suffix = crypto.randomUUID();
      const resource: ImageResource = {
        id: `resource-${suffix}`,
        kind: "image",
        name: file.name,
        mimeType: file.type,
        dataUrl,
        byteLength: file.size,
        createdAt: Date.now(),
      };
      const widthMm = Math.min(140, Math.max(30, dimensions.width / 5));
      const heightMm = Math.min(190, Math.max(20, widthMm * dimensions.height / dimensions.width));
      const image: ImageBlock = {
        blockType: "image",
        id: `image-${suffix}`,
        sectionId: activeSectionId,
        resourceId: resource.id,
        alt: file.name,
        widthMm,
        heightMm,
        alignment: "center",
        caption: "",
        keepWithNext: false,
      };
      const tail = createEmptyParagraph(`image-tail-${suffix}`, `image-tail-run-${suffix}`, activeSectionId);
      const fragment: DocumentFragment = {
        version: 1,
        sourceSchemaVersion: documentModel.metadata.schemaVersion,
        blocks: [image, tail],
        resources: { images: { [resource.id]: resource } },
      };
      const point = { blockId: tail.id, offset: 0 };
      commitFragment(range, fragment, { anchor: point, focus: point }, image.id);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No fue posible leer la imagen.");
    }
  };

  const addTableRow = (table: TableBlock) => {
    const suffix = crypto.randomUUID();
    const row = {
      id: `${table.id}-row-${suffix}`,
      cells: table.columnWidthsMm.map((_, index) => createTableCell(`${table.id}-cell-${suffix}-${index + 1}`)),
    };
    const afterRowId = table.rows.at(-1)?.id;
    commit({ type: "addTableRow", tableId: table.id, ...(afterRowId ? { afterRowId } : {}), row }, undefined, table.id);
  };

  const addTableColumn = (table: TableBlock) => {
    const suffix = crypto.randomUUID();
    const cells = table.rows.map((_, index) => createTableCell(`${table.id}-column-${suffix}-cell-${index + 1}`));
    commit({
      type: "addTableColumn",
      tableId: table.id,
      afterColumnIndex: table.columnWidthsMm.length - 1,
      widthMm: 35,
      cells,
    }, undefined, table.id);
  };

  const removeSelectedObject = () => {
    if (!selectedObject) return;
    commit({ type: "removeBlock", blockId: selectedObject.id }, undefined, null);
  };

  const setSectionPatch = (patch: Extract<DocumentCommand, { type: "setSectionProperties" }>["patch"]) => {
    commit({ type: "setSectionProperties", sectionId: activeSection.id, patch });
  };

  const updateHeaderFooterTemplate = (
    area: HeaderFooterArea,
    variant: HeaderFooterVariant,
    template: string,
  ) => {
    const collection = area === "header" ? activeSection.headers : activeSection.footers;
    const previous = collection[variant];
    const content = headerFooterFromTemplate(template, {
      enabled: template.length > 0,
      alignment: previous.alignment,
      distanceFromEdgeMm: previous.distanceFromEdgeMm,
    }, `${activeSection.id}-${area}-${variant}-${crypto.randomUUID()}`);
    commit({ type: "setSectionHeaderFooter", sectionId: activeSection.id, area, variant, content });
  };

  const insertLayoutBreak = (breakKind: BreakBlock["breakKind"], startType: BreakBlock["startType"] = "next-page") => {
    const anchor = selectedObject ?? activeBlock ?? documentModel.blocks.find(isTextBlock);
    if (!anchor) {
      onMessage("No existe un bloque donde insertar el salto.");
      return;
    }
    const suffix = crypto.randomUUID();
    if (breakKind === "section") {
      const newSectionId = `section-${suffix}`;
      const newSection: DocumentSection = {
        ...structuredClone(activeSection),
        id: newSectionId,
        name: `Sección ${documentModel.sections.length + 1}`,
        pageNumbering: { ...activeSection.pageNumbering, restart: false },
      };
      const breakBlock = createBreakBlock(`break-section-${suffix}`, activeSection.id, "section", newSectionId, startType);
      const paragraph = createEmptyParagraph(`section-start-${suffix}`, `section-start-run-${suffix}`, newSectionId);
      commit({ type: "insertBreak", afterBlockId: anchor.id, breakBlock, newSection, paragraph }, undefined, breakBlock.id);
      onMessage(`Se creó ${newSection.name} con salto ${startType === "continuous" ? "continuo" : "de página"}.`);
      return;
    }
    const breakBlock = createBreakBlock(`break-${breakKind}-${suffix}`, activeSection.id, breakKind);
    commit({ type: "insertBreak", afterBlockId: anchor.id, breakBlock }, undefined, breakBlock.id);
  };

  const setOrientation = (orientation: "portrait" | "landscape") => {
    const current = activeSection.pageSettings;
    const portrait = current.heightMm >= current.widthMm;
    if ((orientation === "portrait") === portrait) return;
    setSectionPatch({ pageSettings: { widthMm: current.heightMm, heightMm: current.widthMm } });
  };

  const setPagePreset = (preset: "a4" | "letter") => {
    const landscape = activeSection.pageSettings.widthMm > activeSection.pageSettings.heightMm;
    const size = preset === "letter" ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 210, heightMm: 297 };
    setSectionPatch({ pageSettings: landscape ? { widthMm: size.heightMm, heightMm: size.widthMm } : size });
  };

  const jumpToRange = useCallback((start: { blockId: string; offset: number }, end: { blockId: string; offset: number }) => {
    const next = { anchor: start, focus: end };
    pendingSelectionRef.current = { selection: next, focus: true };
    requestAnimationFrame(() => {
      const root = editorRef.current;
      if (root) restoreModelSelection(root, next);
      setSelection(next);
    });
  }, []);

  const addComment = () => {
    const range = currentRange();
    if (!range || range.collapsed) {
      onMessage("Seleccione texto antes de agregar un comentario.");
      return;
    }
    const text = window.prompt("Comentario");
    if (!text?.trim()) return;
    const now = Date.now();
    const id = `comment-${crypto.randomUUID()}`;
    const quote = fragmentToPlainText(fragmentFromSelection(documentModel, range));
    commit({
      type: "addComment",
      thread: {
        id, range: { start: range.start, end: range.end }, quote, resolved: false, createdAt: now, updatedAt: now,
        messages: [{ id: `${id}-message-1`, author: documentModel.review.author, text: text.trim(), createdAt: now, updatedAt: now }],
      },
    }, currentSelection() ?? undefined);
    setShowReviewPanel(true);
  };

  const addBookmark = () => {
    const range = currentRange();
    if (!range) return;
    const name = window.prompt("Nombre del marcador", `Marcador ${documentModel.review.bookmarks.length + 1}`);
    if (!name?.trim()) return;
    commit({ type: "addBookmark", bookmark: { id: `bookmark-${crypto.randomUUID()}`, name: name.trim(), range: { start: range.start, end: range.end }, createdAt: Date.now() } }, currentSelection() ?? undefined);
    setShowReviewPanel(true);
  };

  const setHyperlink = () => {
    const range = currentRange();
    if (!range || range.collapsed) {
      onMessage("Seleccione texto para crear un hipervínculo.");
      return;
    }
    const href = window.prompt("Dirección del hipervínculo", "https://");
    if (href === null) return;
    const value = href.trim();
    if (!value) {
      commit({ type: "setHyperlink", start: range.start, end: range.end, hyperlink: null }, currentSelection() ?? undefined);
      return;
    }
    try {
      const normalized = new URL(value, window.location.href).toString();
      commit({ type: "setHyperlink", start: range.start, end: range.end, hyperlink: { href: normalized, title: null } }, currentSelection() ?? undefined);
    } catch {
      onMessage("La dirección del hipervínculo no es válida.");
    }
  };

  const downloadDocument = (format: OfficeDocumentFormat) => {
    const bytes = exportDocument(documentModel, format);
    const mime = format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.oasis.opendocument.text";
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(documentModel.metadata.title)}.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onMessage(`Exportación ${format.toUpperCase()} generada desde el modelo interno.`);
  };

  const handleOfficeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = await importDocument(await file.arrayBuffer(), file.name);
      onOpenDocument(imported.document);
      onMessage(`${file.name} importado. ${imported.warnings.join(" ")}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No fue posible importar el archivo.");
    }
  };

  const replaceAllSearchMatches = () => {
    const editable = searchMatches.filter((match) => match.scope === "body" && match.start && match.end && !match.tableId);
    if (editable.length === 0) {
      onMessage("No hay coincidencias de texto reemplazables.");
      return;
    }
    const ordered = [...editable].sort((left, right) => {
      const leftIndex = documentModel.blocks.findIndex((block) => block.id === left.start?.blockId);
      const rightIndex = documentModel.blocks.findIndex((block) => block.id === right.start?.blockId);
      return rightIndex - leftIndex || (right.start?.offset ?? 0) - (left.start?.offset ?? 0);
    });
    let next = documentModel;
    for (const match of ordered) {
      if (!match.start || !match.end) continue;
      next = engine.apply({ type: "replaceDocumentRange", start: match.start, end: match.end, text: replacementText, idPrefix: `search-${crypto.randomUUID()}` });
    }
    onDocumentChange(next);
    onMessage(`${ordered.length} coincidencia(s) reemplazada(s).`);
  };

  const wordCount = useMemo(() => documentModel.blocks
    .map(documentBlockText)
    .join(" ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length, [documentModel.blocks]);
  const characterCount = useMemo(() => documentModel.blocks.reduce(
    (sum, block) => sum + characterLength(documentBlockText(block)),
    0,
  ), [documentModel.blocks]);
  const selectedCharacterCount = selectedRange ? countSelectedCharacters(documentModel, selectedRange) : 0;

  return (
    <section className="document-studio">
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => void handleImageFile(event)} />
      <input ref={officeInputRef} type="file" accept=".docx,.odt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => void handleOfficeFile(event)} />
      <div className="ribbon" aria-label="Herramientas del documento">
        <div className="ribbon-group history-group">
          <button type="button" className="icon-button" title="Deshacer" disabled={!engine.canUndo()} onClick={() => onDocumentChange(engine.undo())}><UndoIcon /></button>
          <button type="button" className="icon-button" title="Rehacer" disabled={!engine.canRedo()} onClick={() => onDocumentChange(engine.redo())}><RedoIcon /></button>
          <button type="button" className="save-button" onClick={onSave}><SaveIcon /> Guardar</button>
        </div>
        <div className="ribbon-group">
          <select aria-label="Tipo de bloque" value={activeTextBlock?.kind.type === "heading" ? `h${activeTextBlock.kind.level}` : "paragraph"} onChange={(event: ChangeEvent<HTMLSelectElement>) => applyBlockKind(event.target.value)}>
            <option value="paragraph">Párrafo</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option>
          </select>
          <select aria-label="Fuente" value={activeStyle?.fontFamily ?? "Arial"} onChange={(event: ChangeEvent<HTMLSelectElement>) => applyInlineStyle({ fontFamily: event.target.value })}>
            {FONT_FAMILIES.map((font) => <option key={font}>{font}</option>)}
          </select>
          <select className="size-select" aria-label="Tamaño" value={activeStyle?.fontSizePt ?? 11} onChange={(event: ChangeEvent<HTMLSelectElement>) => applyInlineStyle({ fontSizePt: Number(event.target.value) })}>
            {FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="ribbon-group compact">
          <ToolbarToggle label="Negrita" active={Boolean(activeStyle?.bold)} onClick={() => applyInlineStyle({ bold: !activeStyle?.bold })}>B</ToolbarToggle>
          <ToolbarToggle label="Cursiva" active={Boolean(activeStyle?.italic)} onClick={() => applyInlineStyle({ italic: !activeStyle?.italic })}><i>I</i></ToolbarToggle>
          <ToolbarToggle label="Subrayado" active={Boolean(activeStyle?.underline)} onClick={() => applyInlineStyle({ underline: !activeStyle?.underline })}><u>U</u></ToolbarToggle>
          <ToolbarToggle label="Tachado" active={Boolean(activeStyle?.strike)} onClick={() => applyInlineStyle({ strike: !activeStyle?.strike })}><s>S</s></ToolbarToggle>
          <label className="color-control" title="Color del texto"><span>A</span><input type="color" value={activeStyle?.color ?? "#1f2937"} onChange={(event: ChangeEvent<HTMLInputElement>) => applyInlineStyle({ color: event.target.value })} /></label>
        </div>
        <div className="ribbon-group compact">
          {(["left", "center", "right", "justify"] as TextAlignment[]).map((alignment) => (
            <ToolbarToggle key={alignment} label={ALIGNMENT_LABELS[alignment]} active={activeTextBlock?.paragraphStyle.alignment === alignment} onClick={() => applyParagraphStyle({ alignment })}>{alignmentIcon(alignment)}</ToolbarToggle>
          ))}
        </div>
        <div className="ribbon-group compact insert-group">
          <ToolbarToggle label="Lista con viñetas" active={Boolean(activeTextBlock?.list?.kind === "bullet")} onClick={() => toggleList("bullet")}><BulletListIcon /></ToolbarToggle>
          <ToolbarToggle label="Lista numerada" active={Boolean(activeTextBlock?.list?.kind === "number")} onClick={() => toggleList("number")}><NumberListIcon /></ToolbarToggle>
          <button type="button" className="icon-button" title="Insertar tabla" onMouseDown={preserveSelection} onClick={insertTable}><TableIcon /></button>
          <button type="button" className="icon-button" title="Insertar imagen" onMouseDown={preserveSelection} onClick={requestImage}><ImageIcon /></button>
        </div>
        <div className="ribbon-group compact layout-group">
          <button type="button" className="icon-button" title="Salto de página" onMouseDown={preserveSelection} onClick={() => insertLayoutBreak("page")}><PageBreakIcon /></button>
          <button type="button" className="icon-button" title="Salto de columna" onMouseDown={preserveSelection} onClick={() => insertLayoutBreak("column")}><ColumnBreakIcon /></button>
          <button type="button" className="icon-button" title="Nueva sección" onMouseDown={preserveSelection} onClick={() => insertLayoutBreak("section")}><SectionBreakIcon /></button>
          <button type="button" className={showLayoutPanel ? "active" : ""} title="Diseño de página" onClick={() => setShowLayoutPanel((value) => !value)}><LayoutIcon /> Diseño</button>
        </div>
        <div className="ribbon-group compact review-group">
          <ToolbarToggle label="Control de cambios" active={documentModel.review.trackChanges} onClick={() => commit({ type: "setTrackChanges", enabled: !documentModel.review.trackChanges })}><TrackChangesIcon /></ToolbarToggle>
          <button type="button" className="icon-button" title="Añadir comentario" onMouseDown={preserveSelection} onClick={addComment}><CommentIcon /></button>
          <button type="button" className="icon-button" title="Insertar vínculo" onMouseDown={preserveSelection} onClick={setHyperlink}><LinkIcon /></button>
          <button type="button" className="icon-button" title="Añadir marcador" onMouseDown={preserveSelection} onClick={addBookmark}><BookmarkIcon /></button>
          <button type="button" className={showReviewPanel ? "active" : ""} title="Panel de revisión" onClick={() => setShowReviewPanel((value) => !value)}><ReviewIcon /> Revisar</button>
        </div>
        {selectedObject && isTableBlock(selectedObject) ? (
          <div className="ribbon-group object-group">
            <button type="button" onClick={() => addTableRow(selectedObject)}>＋ Fila</button>
            <button type="button" onClick={() => addTableColumn(selectedObject)}>＋ Columna</button>
            <button type="button" disabled={selectedObject.rows.length <= 1} onClick={() => commit({ type: "removeTableRow", tableId: selectedObject.id, rowId: selectedObject.rows.at(-1)!.id }, undefined, selectedObject.id)}>− Fila</button>
            <button type="button" disabled={selectedObject.columnWidthsMm.length <= 1} onClick={() => commit({ type: "removeTableColumn", tableId: selectedObject.id, columnIndex: selectedObject.columnWidthsMm.length - 1 }, undefined, selectedObject.id)}>− Columna</button>
            <button type="button" className="danger-button" onClick={removeSelectedObject}>Eliminar tabla</button>
          </div>
        ) : null}
        {selectedObject && isImageBlock(selectedObject) ? (
          <div className="ribbon-group object-group image-controls">
            <label>Ancho <input type="number" min="10" max="180" value={Math.round(selectedObject.widthMm)} onChange={(event: ChangeEvent<HTMLInputElement>) => commit({ type: "updateImage", blockId: selectedObject.id, widthMm: Number(event.target.value) }, undefined, selectedObject.id)} /> mm</label>
            <label>Alto <input type="number" min="10" max="240" value={Math.round(selectedObject.heightMm)} onChange={(event: ChangeEvent<HTMLInputElement>) => commit({ type: "updateImage", blockId: selectedObject.id, heightMm: Number(event.target.value) }, undefined, selectedObject.id)} /> mm</label>
            <button type="button" className="danger-button" onClick={removeSelectedObject}>Eliminar imagen</button>
          </div>
        ) : null}
        {selectedObject && isBreakBlock(selectedObject) ? (
          <div className="ribbon-group object-group">
            <strong>{selectedObject.breakKind === "section" ? "Salto de sección" : selectedObject.breakKind === "column" ? "Salto de columna" : "Salto de página"}</strong>
            <button type="button" className="danger-button" onClick={() => commit({ type: "removeBreak", blockId: selectedObject.id }, undefined, null)}>Eliminar salto</button>
          </div>
        ) : null}
        <div className="ribbon-group view-group">
          <button type="button" className="icon-button" title="Alejar" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}><ZoomOutIcon /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-button" title="Acercar" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}><ZoomInIcon /></button>
          <button type="button" className="icon-button" title="Imprimir" onClick={() => window.print()}><PrintIcon /></button>
          <button type="button" title="Descargar DOCX" onClick={() => downloadDocument("docx")}><DownloadIcon /> DOCX</button>
          <button type="button" title="Descargar ODT" onClick={() => downloadDocument("odt")}><DownloadIcon /> ODT</button>
          <button type="button" title="Abrir archivo DOCX u ODT" onClick={() => officeInputRef.current?.click()}><OpenIcon /> Abrir</button>
          <button type="button" className={showInspector ? "active" : ""} title="Inspector del modelo" onClick={() => setShowInspector((value) => !value)}><InspectorIcon /></button>
        </div>
      </div>

      {showLayoutPanel ? (
        <section className="layout-panel" aria-label="Diseño de sección">
          <div className="layout-panel-heading">
            <div><strong>Diseño de sección</strong><span>{activeSection.name} · {activeSection.id}</span></div>
            <button type="button" onClick={() => setShowLayoutPanel(false)}>Cerrar</button>
          </div>
          <div className="layout-grid">
            <label>Nombre
              <input key={`${activeSection.id}-name-${documentModel.metadata.revision}`} defaultValue={activeSection.name} onBlur={(event: FocusEvent<HTMLInputElement>) => setSectionPatch({ name: event.currentTarget.value })} />
            </label>
            <label>Tamaño
              <select value={Math.abs(activeSection.pageSettings.widthMm - 215.9) < 1 || Math.abs(activeSection.pageSettings.heightMm - 215.9) < 1 ? "letter" : "a4"} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPagePreset(event.target.value as "a4" | "letter")}>
                <option value="a4">A4</option><option value="letter">Carta</option>
              </select>
            </label>
            <label>Orientación
              <select value={activeSection.pageSettings.widthMm > activeSection.pageSettings.heightMm ? "landscape" : "portrait"} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOrientation(event.target.value as "portrait" | "landscape")}>
                <option value="portrait">Vertical</option><option value="landscape">Horizontal</option>
              </select>
            </label>
            <label>Columnas
              <select value={activeSection.columns.count} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSectionPatch({ columns: { count: Number(event.target.value) } })}>
                {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            <label>Separación columnas (mm)
              <input type="number" min="0" max="40" value={activeSection.columns.gapMm} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ columns: { gapMm: Number(event.target.value) } })} />
            </label>
            <label className="check-label"><input type="checkbox" checked={activeSection.columns.lineBetween} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ columns: { lineBetween: event.target.checked } })} /> Línea entre columnas</label>
            {(["marginTopMm", "marginRightMm", "marginBottomMm", "marginLeftMm"] as const).map((key) => (
              <label key={key}>{key === "marginTopMm" ? "Margen superior" : key === "marginRightMm" ? "Margen derecho" : key === "marginBottomMm" ? "Margen inferior" : "Margen izquierdo"} (mm)
                <input type="number" min="0" max="100" value={activeSection.pageSettings[key]} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ pageSettings: { [key]: Number(event.target.value) } })} />
              </label>
            ))}
          </div>
          <div className="header-footer-grid">
            <label>Encabezado predeterminado
              <input key={`${activeSection.id}-header-${documentModel.metadata.revision}`} defaultValue={headerFooterToTemplate(activeSection.headers.default)} placeholder="{{TITLE}} · {{SECTION}}" onBlur={(event: FocusEvent<HTMLInputElement>) => updateHeaderFooterTemplate("header", "default", event.currentTarget.value)} />
            </label>
            <label>Pie predeterminado
              <input key={`${activeSection.id}-footer-${documentModel.metadata.revision}`} defaultValue={headerFooterToTemplate(activeSection.footers.default)} placeholder="Página {{PAGE}} de {{PAGES}}" onBlur={(event: FocusEvent<HTMLInputElement>) => updateHeaderFooterTemplate("footer", "default", event.currentTarget.value)} />
            </label>
            <label>Encabezado primera página
              <input key={`${activeSection.id}-first-header-${documentModel.metadata.revision}`} disabled={!activeSection.differentFirstPage} defaultValue={headerFooterToTemplate(activeSection.headers.first)} onBlur={(event: FocusEvent<HTMLInputElement>) => updateHeaderFooterTemplate("header", "first", event.currentTarget.value)} />
            </label>
            <label>Pie primera página
              <input key={`${activeSection.id}-first-footer-${documentModel.metadata.revision}`} disabled={!activeSection.differentFirstPage} defaultValue={headerFooterToTemplate(activeSection.footers.first)} onBlur={(event: FocusEvent<HTMLInputElement>) => updateHeaderFooterTemplate("footer", "first", event.currentTarget.value)} />
            </label>
          </div>
          <div className="layout-options-row">
            <label className="check-label"><input type="checkbox" checked={activeSection.differentFirstPage} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ differentFirstPage: event.target.checked })} /> Primera página diferente</label>
            <label className="check-label"><input type="checkbox" checked={activeSection.differentOddEven} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ differentOddEven: event.target.checked })} /> Pares e impares diferentes</label>
            <label className="check-label"><input type="checkbox" checked={activeSection.pageNumbering.restart} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ pageNumbering: { restart: event.target.checked } })} /> Reiniciar numeración</label>
            <label>Inicio <input type="number" min="1" value={activeSection.pageNumbering.start} onChange={(event: ChangeEvent<HTMLInputElement>) => setSectionPatch({ pageNumbering: { start: Number(event.target.value) } })} /></label>
            <label>Formato <select value={activeSection.pageNumbering.format} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSectionPatch({ pageNumbering: { format: event.target.value as "decimal" | "roman-lower" | "roman-upper" } })}><option value="decimal">1, 2, 3</option><option value="roman-lower">i, ii, iii</option><option value="roman-upper">I, II, III</option></select></label>
            <button type="button" onClick={() => insertLayoutBreak("section", "continuous")}>Sección continua</button>
          </div>
          <div className="layout-options-row paragraph-flow">
            <strong>Composición del párrafo</strong>
            <label className="check-label"><input type="checkbox" checked={Boolean(activeTextBlock?.paragraphStyle.keepWithNext)} disabled={!activeTextBlock} onChange={(event: ChangeEvent<HTMLInputElement>) => applyParagraphStyle({ keepWithNext: event.target.checked })} /> Mantener con el siguiente</label>
            <label className="check-label"><input type="checkbox" checked={Boolean(activeTextBlock?.paragraphStyle.keepLinesTogether)} disabled={!activeTextBlock} onChange={(event: ChangeEvent<HTMLInputElement>) => applyParagraphStyle({ keepLinesTogether: event.target.checked })} /> Mantener líneas juntas</label>
            <label className="check-label"><input type="checkbox" checked={Boolean(activeTextBlock?.paragraphStyle.pageBreakBefore)} disabled={!activeTextBlock} onChange={(event: ChangeEvent<HTMLInputElement>) => applyParagraphStyle({ pageBreakBefore: event.target.checked })} /> Salto antes</label>
            <label className="check-label"><input type="checkbox" checked={activeTextBlock?.paragraphStyle.widowControl !== false} disabled={!activeTextBlock} onChange={(event: ChangeEvent<HTMLInputElement>) => applyParagraphStyle({ widowControl: event.target.checked })} /> Control de viudas y huérfanas</label>
          </div>
          <p className="field-help">Campos disponibles: <code>{"{{PAGE}}"}</code>, <code>{"{{PAGES}}"}</code>, <code>{"{{TITLE}}"}</code>, <code>{"{{SECTION}}"}</code>, <code>{"{{DATE}}"}</code> y <code>{"{{TIME}}"}</code>.</p>
        </section>
      ) : null}

      {showReviewPanel ? (
        <section className="review-panel" aria-label="Revisión y búsqueda">
          <div className="review-panel-heading"><div><strong>Revisión documental</strong><span>{documentModel.review.changes.filter((change) => change.status === "pending").length} cambios pendientes · {documentModel.review.comments.filter((thread) => !thread.resolved).length} comentarios abiertos</span></div><button type="button" onClick={() => setShowReviewPanel(false)}>Cerrar</button></div>
          <div className="review-toolbar">
            <label>Autor <input value={documentModel.review.author} onChange={(event: ChangeEvent<HTMLInputElement>) => commit({ type: "setReviewAuthor", author: event.target.value })} /></label>
            <label className="check-label"><input type="checkbox" checked={documentModel.review.trackChanges} onChange={(event: ChangeEvent<HTMLInputElement>) => commit({ type: "setTrackChanges", enabled: event.target.checked })} /> Registrar cambios</label>
            <button type="button" disabled={!documentModel.review.changes.some((change) => change.status === "pending")} onClick={() => commit({ type: "acceptAllChanges" })}>Aceptar todos</button>
            <button type="button" disabled={!documentModel.review.changes.some((change) => change.status === "pending")} onClick={() => commit({ type: "rejectAllChanges" })}>Rechazar todos</button>
          </div>
          <div className="review-columns">
            <section className="review-section"><h3>Buscar y reemplazar</h3><div className="search-row"><input value={searchQuery} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)} placeholder="Buscar en documento, encabezados y comentarios"/><input value={replacementText} onChange={(event: ChangeEvent<HTMLInputElement>) => setReplacementText(event.target.value)} placeholder="Reemplazar por"/><button type="button" onClick={replaceAllSearchMatches}>Reemplazar todo</button></div>{searchError ? <p className="review-error">{searchError}</p> : <small>{searchMatches.length} coincidencia(s)</small>}<div className="review-list search-results">{searchMatches.slice(0, 30).map((match) => <button type="button" key={match.id} onClick={() => match.start && match.end ? jumpToRange(match.start, match.end) : undefined}><strong>{match.scope}</strong><span>{match.preview}</span></button>)}</div></section>
            <section className="review-section"><h3>Comentarios</h3><div className="review-list">{documentModel.review.comments.map((thread) => <article key={thread.id} className={thread.resolved ? "resolved" : ""}><button type="button" className="review-anchor" onClick={() => jumpToRange(thread.range.start, thread.range.end)}>{thread.quote || "Selección"}</button>{thread.messages.map((message) => <p key={message.id}><strong>{message.author}</strong> {message.text}</p>)}<div><button type="button" onClick={() => commit({ type: "resolveComment", threadId: thread.id, resolved: !thread.resolved })}>{thread.resolved ? "Reabrir" : "Resolver"}</button><button type="button" onClick={() => commit({ type: "removeComment", threadId: thread.id })}>Eliminar</button></div></article>)}</div></section>
            <section className="review-section"><h3>Cambios</h3><div className="review-list">{[...documentModel.review.changes].reverse().map((change) => <article key={change.id} className={`change-${change.status}`}><p><strong>{change.author}</strong> · {change.summary}</p><small>{new Date(change.createdAt).toLocaleString()} · {change.status}</small>{change.status === "pending" ? <div><button type="button" onClick={() => commit({ type: "acceptChange", changeId: change.id })}>Aceptar</button><button type="button" onClick={() => commit({ type: "rejectChange", changeId: change.id })}>Rechazar</button></div> : null}</article>)}</div><h3>Marcadores</h3><div className="review-list bookmarks">{documentModel.review.bookmarks.map((bookmark) => <div key={bookmark.id}><button type="button" onClick={() => jumpToRange(bookmark.range.start, bookmark.range.end)}>{bookmark.name}</button><button type="button" onClick={() => commit({ type: "removeBookmark", bookmarkId: bookmark.id })}>×</button></div>)}</div></section>
          </div>
        </section>
      ) : null}

      <div className={`studio-body ${showInspector ? "with-inspector" : ""}`}>
        <div className="page-viewport">
          <div
            ref={editorRef}
            className="document-pages"
            role="textbox"
            aria-multiline="true"
            aria-label="Editor de documentos"
            tabIndex={0}
            onBeforeInput={handleBeforeInput}
            onInput={handleInput}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
          >
            {layout.pages.map((page) => (
              <article
                className="document-page"
                key={page.number}
                aria-label={`Página ${page.pageLabel}`}
                data-section-id={page.sectionId}
                style={{
                  width: `${page.pageWidthPx}px`,
                  minHeight: `${page.pageHeightPx}px`,
                }}
              >
                {page.headerText ? (
                  <div className="page-header" style={{ top: `${page.headerDistancePx}px`, left: `${page.marginLeftPx}px`, right: `${page.marginRightPx}px`, textAlign: page.headerAlignment }}>
                    {page.headerText}
                  </div>
                ) : null}
                <div
                  className="page-content-columns"
                  style={{
                    top: `${page.marginTopPx}px`,
                    left: `${page.marginLeftPx}px`,
                    width: `${page.contentWidthPx}px`,
                    height: `${page.contentHeightPx}px`,
                    gap: `${page.columnGapPx}px`,
                  }}
                >
                  {page.columns.map((column) => (
                    <div
                      className={`document-column ${page.lineBetweenColumns && column.index < page.columns.length - 1 ? "with-column-rule" : ""}`}
                      key={`${page.number}-column-${column.index}`}
                      style={{ width: `${column.widthPx}px`, minWidth: `${column.widthPx}px`, height: `${page.contentHeightPx}px` }}
                    >
                      {column.fragments.map((fragment, fragmentIndex) => {
                        const block = blocksById.get(fragment.blockId);
                        if (!block) return null;
                        if (fragment.kind === "text" && isTextBlock(block)) {
                          const blockLayout = layoutsById.get(block.id);
                          return (
                            <EditableFragment
                              key={`${page.number}-${column.index}-${fragment.blockId}-${fragment.lineStart}-${fragmentIndex}`}
                              block={block}
                              fragment={fragment}
                              listLabel={blockLayout?.kind === "text" ? blockLayout.listLabel : null}
                              zoom={zoom}
                              commented={commentedBlockIds.has(block.id)}
                              bookmarked={bookmarkedBlockIds.has(block.id)}
                            />
                          );
                        }
                        if (fragment.kind === "table" && isTableBlock(block)) {
                          return (
                            <TableFragment
                              key={`${page.number}-${column.index}-${fragment.blockId}-${fragment.rowStart}`}
                              table={block}
                              fragment={fragment}
                              selected={selectedObjectId === block.id}
                              onSelect={() => setSelectedObjectId(block.id)}
                              onCellChange={(rowId, cellId, text) => commit({ type: "updateTableCell", tableId: block.id, rowId, cellId, text }, undefined, block.id)}
                            />
                          );
                        }
                        if (fragment.kind === "image" && isImageBlock(block)) {
                          const resource = documentModel.resources.images[block.resourceId];
                          const blockLayout = layoutsById.get(block.id);
                          return (
                            <ImageFragment
                              key={`${page.number}-${column.index}-${fragment.blockId}`}
                              image={block}
                              resource={resource}
                              widthPx={blockLayout?.kind === "image" ? blockLayout.widthPx : 300}
                              heightPx={blockLayout?.kind === "image" ? blockLayout.heightPx : 200}
                              selected={selectedObjectId === block.id}
                              onSelect={() => setSelectedObjectId(block.id)}
                              onCaptionChange={(caption) => commit({ type: "updateImage", blockId: block.id, caption }, undefined, block.id)}
                            />
                          );
                        }
                        if (fragment.kind === "break" && isBreakBlock(block)) {
                          return <BreakFragment key={`${page.number}-${column.index}-${fragment.blockId}`} fragment={fragment} selected={selectedObjectId === block.id} onSelect={() => setSelectedObjectId(block.id)} />;
                        }
                        return null;
                      })}
                    </div>
                  ))}
                </div>
                {page.footerText ? (
                  <div className="page-footer" style={{ bottom: `${page.footerDistancePx}px`, left: `${page.marginLeftPx}px`, right: `${page.marginRightPx}px`, textAlign: page.footerAlignment }}>
                    {page.footerText}
                  </div>
                ) : null}
                <span className="page-number">{page.pageLabel}</span>
                <span className="page-section-name">{getSection(documentModel, page.sectionId).name}</span>
              </article>
            ))}
          </div>
        </div>
        {showInspector ? (
          <aside className="model-inspector">
            <header><strong>Modelo documental</strong><span>schema v{documentModel.metadata.schemaVersion}</span></header>
            <pre>{JSON.stringify(documentModel, null, 2)}</pre>
          </aside>
        ) : null}
      </div>
      <footer className="editor-statusbar">
        <span>{layout.pages.length} página(s)</span>
        <span>{wordCount} palabras</span>
        <span>{characterCount} caracteres</span>
        <span>{selectedCharacterCount > 0 ? `${selectedCharacterCount} seleccionados` : selectedTextIds.length > 1 ? `${selectedTextIds.length} párrafos` : "Sin selección"}</span>
        <span>{documentModel.blocks.filter(isTableBlock).length} tabla(s)</span>
        <span>{documentModel.blocks.filter(isImageBlock).length} imagen(es)</span>
        <span>{documentModel.sections.length} sección(es)</span>
        <span>{documentModel.blocks.filter(isBreakBlock).length} salto(s)</span>
        <span>{documentModel.review.comments.filter((thread) => !thread.resolved).length} comentario(s)</span>
        <span>{documentModel.review.changes.filter((change) => change.status === "pending").length} cambio(s)</span>
        <span className="status-spacer" />
        <span>Ctrl+C/X/V estructurado · Ctrl+A todo · Ctrl+S guardar</span>
      </footer>
    </section>
  );
}

function EditableFragment({ block, fragment, listLabel, zoom, commented, bookmarked }: {
  block: TextBlock;
  fragment: TextPageFragment;
  listLabel: string | null;
  zoom: number;
  commented: boolean;
  bookmarked: boolean;
}) {
  const runs = sliceRuns(block, fragment.start, fragment.end);
  const blockStyle: CSSProperties = {
    textAlign: block.paragraphStyle.alignment,
    lineHeight: block.paragraphStyle.lineHeight,
    marginTop: fragment.firstFragment ? `${block.paragraphStyle.spaceBeforePt * 96 / 72 * zoom}px` : 0,
    marginBottom: fragment.lastFragment ? `${block.paragraphStyle.spaceAfterPt * 96 / 72 * zoom}px` : 0,
    textIndent: fragment.firstFragment ? `${block.paragraphStyle.firstLineIndentMm * 96 / 25.4 * zoom}px` : 0,
  };
  const headingScale = block.kind.type === "heading"
    ? block.kind.level === 1 ? 1.85 : block.kind.level === 2 ? 1.5 : 1.25
    : 1;
  const isEmpty = fragment.start === fragment.end && blockText(block).length === 0;
  const listIndent = block.list ? 18 + block.list.level * 16 : 0;
  return (
    <div className={`text-block-row ${block.list ? "list-block" : ""}`} style={{ paddingLeft: `${listIndent * zoom}px` }}>
      {block.list && fragment.firstFragment ? <span className="list-marker" style={{ width: `${Math.max(18, listIndent) * zoom}px` }}>{listLabel}</span> : null}
      <div
        className={`editable-fragment ${block.kind.type === "heading" ? `heading-${block.kind.level}` : "paragraph"} ${commented ? "has-comment" : ""} ${bookmarked ? "has-bookmark" : ""}`}
        data-editor-fragment="true"
        data-block-id={block.id}
        data-start={fragment.start}
        data-end={fragment.end}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        style={blockStyle}
      >
        {isEmpty ? <span className="empty-run">{"\u200b"}</span> : runs.map((run) => run.hyperlink ? (
          <a key={run.id} href={run.hyperlink.href} title={run.hyperlink.title ?? undefined} target="_blank" rel="noreferrer" style={runStyle(run.style, zoom, headingScale)} onClick={(event: MouseEvent<HTMLAnchorElement>) => event.preventDefault()}>{run.text}</a>
        ) : <span key={run.id} style={runStyle(run.style, zoom, headingScale)}>{run.text}</span>)}
      </div>
    </div>
  );
}

function TableFragment({ table, fragment, selected, onSelect, onCellChange }: {
  table: TableBlock;
  fragment: TablePageFragment;
  selected: boolean;
  onSelect(): void;
  onCellChange(rowId: string, cellId: string, text: string): void;
}) {
  const rows = table.rows.slice(fragment.rowStart, fragment.rowEnd);
  return (
    <div className={`table-object ${selected ? "selected-object" : ""}`} data-document-object={table.id} onMouseDown={(event: MouseEvent<HTMLDivElement>) => { event.stopPropagation(); onSelect(); }}>
      {!fragment.firstFragment ? <div className="continued-label">Tabla continuada</div> : null}
      <table style={{ borderColor: table.style.borderColor }}>
        <colgroup>{table.columnWidthsMm.map((width, index) => <col key={index} style={{ width: `${width}mm` }} />)}</colgroup>
        <tbody>
          {rows.map((row, localIndex) => {
            const absoluteIndex = fragment.rowStart + localIndex;
            return (
              <tr key={row.id} className={absoluteIndex < table.style.headerRows ? "header-row" : ""}>
                {row.cells.map((cell) => (
                  <td key={cell.id} style={{ backgroundColor: cell.backgroundColor ?? undefined, padding: `${table.style.cellPaddingMm}mm`, borderColor: table.style.borderColor }}>
                    <div
                      data-table-cell="true"
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck
                      onBeforeInput={(event: FormEvent<HTMLDivElement>) => event.stopPropagation()}
                      onInput={(event: FormEvent<HTMLDivElement>) => event.stopPropagation()}
                      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => event.stopPropagation()}
                      onBlur={(event: FormEvent<HTMLDivElement>) => {
                        const next = (event.currentTarget.innerText || "").replace(/\n$/u, "");
                        if (next !== tableCellText(cell)) onCellChange(row.id, cell.id, next);
                      }}
                    >{tableCellText(cell)}</div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ImageFragment({ image, resource, widthPx, heightPx, selected, onSelect, onCaptionChange }: {
  image: ImageBlock;
  resource: ImageResource | undefined;
  widthPx: number;
  heightPx: number;
  selected: boolean;
  onSelect(): void;
  onCaptionChange(caption: string): void;
}) {
  return (
    <figure
      className={`image-object align-${image.alignment} ${selected ? "selected-object" : ""}`}
      data-document-object={image.id}
      onMouseDown={(event: MouseEvent<HTMLElement>) => { event.stopPropagation(); onSelect(); }}
    >
      {resource?.dataUrl ? (
        <img src={resource.dataUrl} alt={image.alt} style={{ width: `${widthPx}px`, height: `${heightPx}px` }} />
      ) : <div className="missing-image" style={{ width: `${widthPx}px`, height: `${heightPx}px` }}>Recurso de imagen no disponible</div>}
      <figcaption
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Agregar descripción"
        onBeforeInput={(event: FormEvent<HTMLElement>) => event.stopPropagation()}
        onInput={(event: FormEvent<HTMLElement>) => event.stopPropagation()}
        onBlur={(event: FormEvent<HTMLElement>) => {
          const caption = (event.currentTarget.innerText || "").replace(/\n$/u, "");
          if (caption !== image.caption) onCaptionChange(caption);
        }}
      >{image.caption}</figcaption>
    </figure>
  );
}

function BreakFragment({ fragment, selected, onSelect }: {
  fragment: BreakPageFragment;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      className={`break-marker ${selected ? "selected-object" : ""}`}
      data-document-object={fragment.blockId}
      onMouseDown={(event: MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); onSelect(); }}
      title="Seleccione el salto para eliminarlo o inspeccionarlo"
    >
      <span />
      <strong>{fragment.label}</strong>
      <span />
    </button>
  );
}

function runStyle(style: TextStyle, zoom: number, scale: number): CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSizePt * 96 / 72 * zoom * scale}px`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: [style.underline ? "underline" : "", style.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none",
    color: style.color,
    backgroundColor: style.highlight ?? "transparent",
  };
}

function ToolbarToggle({ label, active, onClick, children }: { label: string; active: boolean; onClick(): void; children: ReactNode }) {
  return <button type="button" title={label} aria-pressed={active} className={active ? "active" : ""} onMouseDown={preserveSelection} onClick={onClick}>{children}</button>;
}

function preserveSelection(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

function alignmentIcon(alignment: TextAlignment): ReactNode {
  if (alignment === "left") return <AlignLeftIcon />;
  if (alignment === "center") return <AlignCenterIcon />;
  if (alignment === "right") return <AlignRightIcon />;
  return <AlignJustifyIcon />;
}

const ALIGNMENT_LABELS: Record<TextAlignment, string> = {
  left: "Alinear a la izquierda",
  center: "Centrar",
  right: "Alinear a la derecha",
  justify: "Justificar",
};

function defaultStyle(): TextStyle {
  return {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    fontFamily: "Arial",
    fontSizePt: 11,
    color: "#1f2937",
    highlight: null,
  };
}

function countSelectedCharacters(documentModel: TextDocument, range: DocumentSelectionRange): number {
  if (range.collapsed) return 0;
  let total = 0;
  for (let index = range.startBlockIndex; index <= range.endBlockIndex; index += 1) {
    const block = documentModel.blocks[index];
    if (!block) continue;
    if (!isTextBlock(block)) {
      total += characterLength(documentBlockText(block));
      continue;
    }
    const length = characterLength(blockText(block));
    const start = index === range.startBlockIndex ? range.start.offset : 0;
    const end = index === range.endBlockIndex ? range.end.offset : length;
    total += Math.max(0, end - start);
  }
  return total;
}

function safeFileName(value: string): string {
  return value.trim().replace(/[\/:*?"<>|]+/gu, "-").replace(/\s+/gu, " ").slice(0, 120) || "documento";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No fue posible leer el archivo de imagen."));
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) });
    image.onerror = () => reject(new Error("El navegador no pudo decodificar la imagen."));
    image.src = dataUrl;
  });
}
