//! Núcleo documental independiente de plataforma para Rhino Suite.
//!
//! La Fase 2.4 incorpora revisión, comentarios, hipervínculos, marcadores,
//! control de cambios y compatibilidad inicial de intercambio. Conserva además
//! secciones, encabezados, pies, saltos y reglas de composición avanzada. La crate no depende del DOM ni del sistema
//! operativo y puede ejecutarse en WebAssembly, Tauri o servidor.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};
use std::fmt::{Display, Formatter};

pub const CURRENT_SCHEMA_VERSION: u32 = 5;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMetadata {
    pub id: String,
    pub title: String,
    pub schema_version: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct PageSettings {
    pub width_mm: f64,
    pub height_mm: f64,
    pub margin_top_mm: f64,
    pub margin_right_mm: f64,
    pub margin_bottom_mm: f64,
    pub margin_left_mm: f64,
}

impl Default for PageSettings {
    fn default() -> Self {
        Self {
            width_mm: 210.0,
            height_mm: 297.0,
            margin_top_mm: 25.4,
            margin_right_mm: 25.4,
            margin_bottom_mm: 25.4,
            margin_left_mm: 25.4,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct SectionColumns {
    pub count: u8,
    pub gap_mm: f64,
    pub line_between: bool,
    pub balance: bool,
}

impl Default for SectionColumns {
    fn default() -> Self {
        Self {
            count: 1,
            gap_mm: 8.0,
            line_between: false,
            balance: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum PageNumberFormat {
    #[default]
    #[serde(rename = "decimal")]
    Decimal,
    #[serde(rename = "roman-lower")]
    RomanLower,
    #[serde(rename = "roman-upper")]
    RomanUpper,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct PageNumbering {
    pub restart: bool,
    pub start: u32,
    pub format: PageNumberFormat,
}

impl Default for PageNumbering {
    fn default() -> Self {
        Self {
            restart: false,
            start: 1,
            format: PageNumberFormat::Decimal,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct TextStyle {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strike: bool,
    pub font_family: String,
    pub font_size_pt: f64,
    pub color: String,
    pub highlight: Option<String>,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            font_family: "Arial".to_string(),
            font_size_pt: 11.0,
            color: "#1f2937".to_string(),
            highlight: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct TextStylePatch {
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub strike: Option<bool>,
    pub font_family: Option<String>,
    pub font_size_pt: Option<f64>,
    pub color: Option<String>,
    pub highlight: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum TextAlignment {
    #[default]
    Left,
    Center,
    Right,
    Justify,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DynamicFieldKind {
    #[serde(rename = "page-number")]
    PageNumber,
    #[serde(rename = "page-count")]
    PageCount,
    #[serde(rename = "date")]
    Date,
    #[serde(rename = "time")]
    Time,
    #[serde(rename = "title")]
    Title,
    #[serde(rename = "section-name")]
    SectionName,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum HeaderFooterItem {
    Text {
        id: String,
        text: String,
        #[serde(default)]
        style: TextStyle,
    },
    Field {
        id: String,
        field: DynamicFieldKind,
        #[serde(default)]
        style: TextStyle,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct HeaderFooterContent {
    pub enabled: bool,
    pub alignment: TextAlignment,
    pub distance_from_edge_mm: f64,
    pub items: Vec<HeaderFooterItem>,
}

impl Default for HeaderFooterContent {
    fn default() -> Self {
        Self {
            enabled: false,
            alignment: TextAlignment::Center,
            distance_from_edge_mm: 12.7,
            items: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct HeaderFooterVariants {
    pub default: HeaderFooterContent,
    pub first: HeaderFooterContent,
    pub even: HeaderFooterContent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct DocumentSection {
    pub id: String,
    pub name: String,
    pub page_settings: PageSettings,
    pub columns: SectionColumns,
    pub headers: HeaderFooterVariants,
    pub footers: HeaderFooterVariants,
    pub different_first_page: bool,
    pub different_odd_even: bool,
    pub page_numbering: PageNumbering,
}

impl Default for DocumentSection {
    fn default() -> Self {
        default_section()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct DocumentSectionPatch {
    pub name: Option<String>,
    pub page_settings: Option<PageSettingsPatch>,
    pub columns: Option<SectionColumnsPatch>,
    pub different_first_page: Option<bool>,
    pub different_odd_even: Option<bool>,
    pub page_numbering: Option<PageNumberingPatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct PageSettingsPatch {
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub margin_top_mm: Option<f64>,
    pub margin_right_mm: Option<f64>,
    pub margin_bottom_mm: Option<f64>,
    pub margin_left_mm: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct SectionColumnsPatch {
    pub count: Option<u8>,
    pub gap_mm: Option<f64>,
    pub line_between: Option<bool>,
    pub balance: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct PageNumberingPatch {
    pub restart: Option<bool>,
    pub start: Option<u32>,
    pub format: Option<PageNumberFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HeaderFooterArea {
    Header,
    Footer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HeaderFooterVariant {
    Default,
    First,
    Even,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct ParagraphStyle {
    pub alignment: TextAlignment,
    pub line_height: f64,
    pub space_before_pt: f64,
    pub space_after_pt: f64,
    pub first_line_indent_mm: f64,
    pub keep_with_next: bool,
    pub keep_lines_together: bool,
    pub page_break_before: bool,
    pub widow_control: bool,
}

impl Default for ParagraphStyle {
    fn default() -> Self {
        Self {
            alignment: TextAlignment::Left,
            line_height: 1.35,
            space_before_pt: 0.0,
            space_after_pt: 8.0,
            first_line_indent_mm: 0.0,
            keep_with_next: false,
            keep_lines_together: false,
            page_break_before: false,
            widow_control: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct ParagraphStylePatch {
    pub alignment: Option<TextAlignment>,
    pub line_height: Option<f64>,
    pub space_before_pt: Option<f64>,
    pub space_after_pt: Option<f64>,
    pub first_line_indent_mm: Option<f64>,
    pub keep_with_next: Option<bool>,
    pub keep_lines_together: Option<bool>,
    pub page_break_before: Option<bool>,
    pub widow_control: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Hyperlink {
    pub href: String,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextRun {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub style: TextStyle,
    #[serde(default)]
    pub hyperlink: Option<Hyperlink>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BlockKind {
    #[default]
    Paragraph,
    Heading {
        level: u8,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ListKind {
    Bullet,
    Number,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ListProperties {
    pub id: String,
    pub kind: ListKind,
    pub level: u8,
    pub start: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextBlock {
    #[serde(rename = "blockType")]
    pub block_type: String,
    pub id: String,
    #[serde(default = "default_section_id")]
    pub section_id: String,
    #[serde(default)]
    pub kind: BlockKind,
    #[serde(default)]
    pub paragraph_style: ParagraphStyle,
    #[serde(default)]
    pub list: Option<ListProperties>,
    pub runs: Vec<TextRun>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCell {
    pub id: String,
    #[serde(default)]
    pub paragraph_style: ParagraphStyle,
    pub runs: Vec<TextRun>,
    #[serde(default)]
    pub background_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableRow {
    pub id: String,
    pub cells: Vec<TableCell>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct TableStyle {
    pub border_color: String,
    pub border_width_pt: f64,
    pub cell_padding_mm: f64,
    pub header_rows: usize,
    pub keep_rows_together: bool,
}

impl Default for TableStyle {
    fn default() -> Self {
        Self {
            border_color: "#6b7280".to_string(),
            border_width_pt: 0.75,
            cell_padding_mm: 2.0,
            header_rows: 0,
            keep_rows_together: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableBlock {
    #[serde(rename = "blockType")]
    pub block_type: String,
    pub id: String,
    #[serde(default = "default_section_id")]
    pub section_id: String,
    pub rows: Vec<TableRow>,
    pub column_widths_mm: Vec<f64>,
    #[serde(default)]
    pub style: TableStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ImageAlignment {
    Left,
    #[default]
    Center,
    Right,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageBlock {
    #[serde(rename = "blockType")]
    pub block_type: String,
    pub id: String,
    #[serde(default = "default_section_id")]
    pub section_id: String,
    pub resource_id: String,
    #[serde(default)]
    pub alt: String,
    pub width_mm: f64,
    pub height_mm: f64,
    #[serde(default)]
    pub alignment: ImageAlignment,
    #[serde(default)]
    pub caption: String,
    #[serde(default)]
    pub keep_with_next: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum BreakKind {
    Page,
    Column,
    Section,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum SectionStartType {
    #[default]
    #[serde(rename = "next-page")]
    NextPage,
    #[serde(rename = "continuous")]
    Continuous,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BreakBlock {
    #[serde(rename = "blockType")]
    pub block_type: String,
    pub id: String,
    #[serde(default = "default_section_id")]
    pub section_id: String,
    pub break_kind: BreakKind,
    #[serde(default)]
    pub start_type: SectionStartType,
    #[serde(default)]
    pub next_section_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum DocumentBlock {
    Text(TextBlock),
    Table(TableBlock),
    Image(ImageBlock),
    Break(BreakBlock),
}

impl DocumentBlock {
    pub fn id(&self) -> &str {
        match self {
            Self::Text(block) => &block.id,
            Self::Table(block) => &block.id,
            Self::Image(block) => &block.id,
            Self::Break(block) => &block.id,
        }
    }

    fn as_text(&self) -> Option<&TextBlock> {
        match self {
            Self::Text(block) => Some(block),
            _ => None,
        }
    }

    fn as_text_mut(&mut self) -> Option<&mut TextBlock> {
        match self {
            Self::Text(block) => Some(block),
            _ => None,
        }
    }

    fn as_table_mut(&mut self) -> Option<&mut TableBlock> {
        match self {
            Self::Table(block) => Some(block),
            _ => None,
        }
    }

    fn as_image_mut(&mut self) -> Option<&mut ImageBlock> {
        match self {
            Self::Image(block) => Some(block),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageResource {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub mime_type: String,
    pub data_url: String,
    pub byte_length: u64,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct DocumentResources {
    pub images: BTreeMap<String, ImageResource>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRange {
    pub start: DocumentPoint,
    pub end: DocumentPoint,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommentMessage {
    pub id: String,
    pub author: String,
    pub text: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommentThread {
    pub id: String,
    pub range: DocumentRange,
    pub quote: String,
    #[serde(default)]
    pub messages: Vec<CommentMessage>,
    pub resolved: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub name: String,
    pub range: DocumentRange,
    pub created_at: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ReviewChangeStatus {
    Pending,
    Accepted,
    Rejected,
    Conflict,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ReviewChangeKind {
    Insert,
    Delete,
    Replace,
    Format,
    Structure,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrackedChange {
    pub id: String,
    pub kind: ReviewChangeKind,
    pub author: String,
    pub summary: String,
    pub command_type: String,
    pub created_at: u64,
    pub status: ReviewChangeStatus,
    #[serde(default)]
    pub before_snapshot: Option<String>,
    pub after_revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct ReviewState {
    pub author: String,
    pub track_changes: bool,
    pub comments: Vec<CommentThread>,
    pub bookmarks: Vec<Bookmark>,
    pub changes: Vec<TrackedChange>,
}

impl Default for ReviewState {
    fn default() -> Self {
        Self {
            author: "Autor local".to_string(),
            track_changes: false,
            comments: Vec::new(),
            bookmarks: Vec::new(),
            changes: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextDocument {
    pub metadata: DocumentMetadata,
    #[serde(default)]
    pub page_settings: PageSettings,
    #[serde(default = "default_sections")]
    pub sections: Vec<DocumentSection>,
    #[serde(default)]
    pub resources: DocumentResources,
    #[serde(default)]
    pub review: ReviewState,
    pub blocks: Vec<DocumentBlock>,
}

impl TextDocument {
    pub fn new(id: impl Into<String>, title: impl Into<String>, now_ms: u64) -> Self {
        Self {
            metadata: DocumentMetadata {
                id: id.into(),
                title: title.into(),
                schema_version: CURRENT_SCHEMA_VERSION,
                created_at: now_ms,
                updated_at: now_ms,
                revision: 0,
            },
            page_settings: PageSettings::default(),
            sections: default_sections(),
            resources: DocumentResources::default(),
            review: ReviewState::default(),
            blocks: vec![DocumentBlock::Text(empty_paragraph("block-1", "run-1"))],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPoint {
    pub block_id: String,
    pub offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentFragment {
    pub version: u32,
    pub source_schema_version: u32,
    pub blocks: Vec<DocumentBlock>,
    #[serde(default)]
    pub resources: DocumentResources,
    #[serde(default)]
    pub sections: Vec<DocumentSection>,
}

// Enum de comandos consumido por valor en `apply`. Sus variantes tienen
// tamaños dispares por diseño; boxear cada variante grande complicaría todos
// los sitios de construcción y `match` sin beneficio real en este flujo.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum DocumentCommand {
    SetTitle {
        title: String,
    },
    ReplaceBlockText {
        block_id: String,
        text: String,
    },
    ReplaceTextRange {
        block_id: String,
        start: usize,
        end: usize,
        text: String,
        #[serde(default)]
        style: Option<TextStylePatch>,
    },
    ReplaceDocumentRange {
        start: DocumentPoint,
        end: DocumentPoint,
        text: String,
        #[serde(default)]
        style: Option<TextStylePatch>,
        id_prefix: String,
    },
    ReplaceRangeWithFragment {
        start: DocumentPoint,
        end: DocumentPoint,
        fragment: DocumentFragment,
        #[serde(default)]
        trailing_block_id: Option<String>,
        #[serde(default)]
        trailing_run_id: Option<String>,
    },
    InsertText {
        block_id: String,
        offset: usize,
        text: String,
        #[serde(default)]
        style: Option<TextStylePatch>,
    },
    DeleteText {
        block_id: String,
        start: usize,
        end: usize,
    },
    FormatText {
        block_id: String,
        start: usize,
        end: usize,
        style: TextStylePatch,
    },
    FormatDocumentRange {
        start: DocumentPoint,
        end: DocumentPoint,
        style: TextStylePatch,
    },
    SetBlockKind {
        block_id: String,
        kind: BlockKind,
    },
    SetBlockKindMany {
        block_ids: Vec<String>,
        kind: BlockKind,
    },
    SetParagraphStyle {
        block_id: String,
        style: ParagraphStylePatch,
    },
    SetParagraphStyleMany {
        block_ids: Vec<String>,
        style: ParagraphStylePatch,
    },
    SetList {
        block_ids: Vec<String>,
        list: Option<ListProperties>,
    },
    SplitBlock {
        block_id: String,
        offset: usize,
        new_block_id: String,
        new_run_id: String,
    },
    MergeWithPrevious {
        block_id: String,
    },
    AddParagraph {
        after_block_id: Option<String>,
        block_id: String,
        run_id: String,
        #[serde(default)]
        section_id: Option<String>,
    },
    RemoveBlock {
        block_id: String,
    },
    AddResource {
        resource: ImageResource,
    },
    UpdateTableCell {
        table_id: String,
        row_id: String,
        cell_id: String,
        text: String,
    },
    AddTableRow {
        table_id: String,
        after_row_id: Option<String>,
        row: TableRow,
    },
    RemoveTableRow {
        table_id: String,
        row_id: String,
    },
    AddTableColumn {
        table_id: String,
        after_column_index: isize,
        width_mm: f64,
        cells: Vec<TableCell>,
    },
    RemoveTableColumn {
        table_id: String,
        column_index: usize,
    },
    UpdateImage {
        block_id: String,
        #[serde(default)]
        alt: Option<String>,
        #[serde(default)]
        width_mm: Option<f64>,
        #[serde(default)]
        height_mm: Option<f64>,
        #[serde(default)]
        alignment: Option<ImageAlignment>,
        #[serde(default)]
        caption: Option<String>,
        #[serde(default)]
        keep_with_next: Option<bool>,
    },
    SetSectionProperties {
        section_id: String,
        patch: DocumentSectionPatch,
    },
    SetSectionHeaderFooter {
        section_id: String,
        area: HeaderFooterArea,
        variant: HeaderFooterVariant,
        content: HeaderFooterContent,
    },
    InsertBreak {
        after_block_id: String,
        break_block: BreakBlock,
        #[serde(default)]
        new_section: Option<DocumentSection>,
        #[serde(default)]
        paragraph: Option<TextBlock>,
    },
    RemoveBreak {
        block_id: String,
    },
    SetReviewAuthor {
        author: String,
    },
    SetTrackChanges {
        enabled: bool,
    },
    AddComment {
        thread: CommentThread,
    },
    ReplyComment {
        thread_id: String,
        message: CommentMessage,
    },
    ResolveComment {
        thread_id: String,
        resolved: bool,
    },
    RemoveComment {
        thread_id: String,
    },
    AddBookmark {
        bookmark: Bookmark,
    },
    RemoveBookmark {
        bookmark_id: String,
    },
    SetHyperlink {
        start: DocumentPoint,
        end: DocumentPoint,
        hyperlink: Option<Hyperlink>,
    },
    AcceptChange {
        change_id: String,
    },
    RejectChange {
        change_id: String,
    },
    AcceptAllChanges,
    RejectAllChanges,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineError {
    BlockNotFound(String),
    WrongBlockType(String),
    InvalidRange {
        start: usize,
        end: usize,
        len: usize,
    },
    InvalidSelection,
    CannotMerge,
    CannotRemoveLastTableRow,
    CannotRemoveLastTableColumn,
    InvalidHeadingLevel(u8),
    DuplicateBlockId(String),
    InvalidTable(String),
    SectionNotFound(String),
    NewSectionRequired,
    Serialization(String),
}

impl Display for EngineError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BlockNotFound(id) => write!(formatter, "No se encontró el bloque '{id}'."),
            Self::WrongBlockType(id) => write!(
                formatter,
                "El bloque '{id}' no corresponde al tipo requerido."
            ),
            Self::InvalidRange { start, end, len } => write!(
                formatter,
                "Rango inválido: inicio={start}, fin={end}, longitud={len}."
            ),
            Self::InvalidSelection => write!(formatter, "La selección documental no es válida."),
            Self::CannotMerge => write!(
                formatter,
                "Solo es posible unir dos bloques de texto contiguos."
            ),
            Self::CannotRemoveLastTableRow => {
                write!(formatter, "Una tabla debe conservar al menos una fila.")
            }
            Self::CannotRemoveLastTableColumn => {
                write!(formatter, "Una tabla debe conservar al menos una columna.")
            }
            Self::InvalidHeadingLevel(level) => {
                write!(formatter, "El nivel de encabezado {level} no es válido.")
            }
            Self::DuplicateBlockId(id) => write!(formatter, "El bloque '{id}' ya existe."),
            Self::InvalidTable(message) => write!(formatter, "Tabla inválida: {message}"),
            Self::SectionNotFound(id) => write!(formatter, "No se encontró la sección '{id}'."),
            Self::NewSectionRequired => {
                write!(formatter, "Un salto de sección requiere una nueva sección.")
            }
            Self::Serialization(message) => write!(formatter, "Error de serialización: {message}"),
        }
    }
}

impl std::error::Error for EngineError {}

#[derive(Debug, Clone)]
pub struct OfficeEngine {
    document: TextDocument,
    undo_stack: Vec<TextDocument>,
    redo_stack: Vec<TextDocument>,
    max_history: usize,
}

impl OfficeEngine {
    pub fn new(mut document: TextDocument) -> Self {
        normalize_document(&mut document);
        Self {
            document,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_history: 200,
        }
    }

    pub fn new_text_document(id: impl Into<String>, title: impl Into<String>, now_ms: u64) -> Self {
        Self::new(TextDocument::new(id, title, now_ms))
    }

    pub fn from_json(json: &str) -> Result<Self, EngineError> {
        let mut value: Value = serde_json::from_str(json)
            .map_err(|error| EngineError::Serialization(error.to_string()))?;
        migrate_json_value(&mut value);
        let mut document: TextDocument = serde_json::from_value(value)
            .map_err(|error| EngineError::Serialization(error.to_string()))?;
        normalize_document(&mut document);
        validate_document(&document)?;
        Ok(Self::new(document))
    }

    pub fn document(&self) -> &TextDocument {
        &self.document
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn apply(
        &mut self,
        command: DocumentCommand,
        now_ms: u64,
    ) -> Result<&TextDocument, EngineError> {
        let snapshot = self.document.clone();
        let should_track = self.document.review.track_changes && is_trackable_command(&command);
        let before_snapshot = if should_track {
            Some(create_review_snapshot(&snapshot)?)
        } else {
            None
        };
        let command_copy = command.clone();
        apply_command(&mut self.document, command)?;
        normalize_document(&mut self.document);
        validate_document(&self.document)?;
        self.push_undo(snapshot);
        self.redo_stack.clear();
        self.mark_changed(now_ms);
        if let Some(before_snapshot) = before_snapshot {
            self.document.review.changes.push(create_tracked_change(
                &command_copy,
                &self.document.review.author,
                before_snapshot,
                self.document.metadata.revision,
                now_ms,
            ));
        }
        Ok(&self.document)
    }

    pub fn undo(&mut self, now_ms: u64) -> Option<&TextDocument> {
        let previous = self.undo_stack.pop()?;
        let current = self.document.clone();
        self.redo_stack.push(current);
        self.restore_content(previous, now_ms);
        Some(&self.document)
    }

    pub fn redo(&mut self, now_ms: u64) -> Option<&TextDocument> {
        let next = self.redo_stack.pop()?;
        let current = self.document.clone();
        self.push_undo(current);
        self.restore_content(next, now_ms);
        Some(&self.document)
    }

    pub fn to_json(&self) -> Result<String, EngineError> {
        serde_json::to_string_pretty(&self.document)
            .map_err(|error| EngineError::Serialization(error.to_string()))
    }

    fn push_undo(&mut self, snapshot: TextDocument) {
        self.undo_stack.push(snapshot);
        if self.undo_stack.len() > self.max_history {
            self.undo_stack.remove(0);
        }
    }

    fn mark_changed(&mut self, now_ms: u64) {
        self.document.metadata.schema_version = CURRENT_SCHEMA_VERSION;
        self.document.metadata.updated_at = now_ms;
        self.document.metadata.revision += 1;
    }

    fn restore_content(&mut self, mut snapshot: TextDocument, now_ms: u64) {
        let revision = self.document.metadata.revision + 1;
        let id = self.document.metadata.id.clone();
        let created_at = self.document.metadata.created_at;
        normalize_document(&mut snapshot);
        self.document = snapshot;
        self.document.metadata.id = id;
        self.document.metadata.created_at = created_at;
        self.document.metadata.updated_at = now_ms;
        self.document.metadata.revision = revision;
    }
}

fn apply_command(document: &mut TextDocument, command: DocumentCommand) -> Result<(), EngineError> {
    match command {
        DocumentCommand::SetTitle { title } => document.metadata.title = title,
        DocumentCommand::ReplaceBlockText { block_id, text } => {
            let block = find_text_block_mut(document, &block_id)?;
            let style = style_at_offset(block, 0);
            block.runs = normalize_runs(
                &block.id,
                vec![TextRun {
                    id: format!("{}-replace", block.id),
                    text,
                    style: style.clone(),
                    hyperlink: None,
                }],
                style,
                None,
            );
        }
        DocumentCommand::ReplaceTextRange {
            block_id,
            start,
            end,
            text,
            style,
        } => {
            replace_text_range(document, &block_id, start, end, &text, style.as_ref())?;
        }
        DocumentCommand::ReplaceDocumentRange {
            start,
            end,
            text,
            style,
            id_prefix,
        } => {
            let base_style = {
                let block = find_text_block(document, &start.block_id)?;
                apply_text_style(style_at_offset(block, start.offset), style.as_ref())
            };
            let fragment = if text.is_empty() {
                empty_fragment()
            } else {
                fragment_from_plain_text(&text, &id_prefix, &base_style)
            };
            replace_range_with_fragment(
                document,
                &start,
                &end,
                &fragment,
                Some(format!("{id_prefix}-tail")),
                Some(format!("{id_prefix}-tail-run")),
            )?;
        }
        DocumentCommand::ReplaceRangeWithFragment {
            start,
            end,
            fragment,
            trailing_block_id,
            trailing_run_id,
        } => {
            replace_range_with_fragment(
                document,
                &start,
                &end,
                &fragment,
                trailing_block_id,
                trailing_run_id,
            )?;
        }
        DocumentCommand::InsertText {
            block_id,
            offset,
            text,
            style,
        } => {
            replace_text_range(document, &block_id, offset, offset, &text, style.as_ref())?;
        }
        DocumentCommand::DeleteText {
            block_id,
            start,
            end,
        } => {
            replace_text_range(document, &block_id, start, end, "", None)?;
        }
        DocumentCommand::FormatText {
            block_id,
            start,
            end,
            style,
        } => {
            format_text_range(document, &block_id, start, end, &style)?;
        }
        DocumentCommand::FormatDocumentRange { start, end, style } => {
            format_document_range(document, &start, &end, &style)?;
        }
        DocumentCommand::SetBlockKind { block_id, kind } => {
            validate_kind(&kind)?;
            find_text_block_mut(document, &block_id)?.kind = kind;
        }
        DocumentCommand::SetBlockKindMany { block_ids, kind } => {
            validate_kind(&kind)?;
            for id in unique_strings(block_ids) {
                find_text_block_mut(document, &id)?.kind = kind.clone();
            }
        }
        DocumentCommand::SetParagraphStyle { block_id, style } => {
            patch_paragraph_style(
                &mut find_text_block_mut(document, &block_id)?.paragraph_style,
                &style,
            );
        }
        DocumentCommand::SetParagraphStyleMany { block_ids, style } => {
            for id in unique_strings(block_ids) {
                patch_paragraph_style(
                    &mut find_text_block_mut(document, &id)?.paragraph_style,
                    &style,
                );
            }
        }
        DocumentCommand::SetList { block_ids, list } => {
            for id in unique_strings(block_ids) {
                let block = find_text_block_mut(document, &id)?;
                block.list = list.clone().map(normalize_list);
                if block.list.is_some() && matches!(block.kind, BlockKind::Heading { .. }) {
                    block.kind = BlockKind::Paragraph;
                }
            }
        }
        DocumentCommand::SplitBlock {
            block_id,
            offset,
            new_block_id,
            new_run_id,
        } => {
            split_block(document, &block_id, offset, new_block_id, new_run_id)?;
        }
        DocumentCommand::MergeWithPrevious { block_id } => {
            merge_with_previous(document, &block_id)?
        }
        DocumentCommand::AddParagraph {
            after_block_id,
            block_id,
            run_id,
            section_id,
        } => {
            assert_unique_block_id(document, &block_id)?;
            let index = match after_block_id.as_ref() {
                Some(id) => find_block_index(document, id)? + 1,
                None => document.blocks.len(),
            };
            let inferred_section_id = section_id
                .or_else(|| {
                    index
                        .checked_sub(1)
                        .and_then(|position| document.blocks.get(position))
                        .map(block_section_id)
                })
                .unwrap_or_else(default_section_id);
            let mut paragraph = empty_paragraph(&block_id, &run_id);
            paragraph.section_id = inferred_section_id;
            document
                .blocks
                .insert(index, DocumentBlock::Text(paragraph));
        }
        DocumentCommand::RemoveBlock { block_id } => remove_block(document, &block_id)?,
        DocumentCommand::AddResource { resource } => {
            document
                .resources
                .images
                .insert(resource.id.clone(), resource);
        }
        DocumentCommand::UpdateTableCell {
            table_id,
            row_id,
            cell_id,
            text,
        } => {
            update_table_cell(document, &table_id, &row_id, &cell_id, text)?;
        }
        DocumentCommand::AddTableRow {
            table_id,
            after_row_id,
            row,
        } => {
            add_table_row(document, &table_id, after_row_id.as_deref(), row)?;
        }
        DocumentCommand::RemoveTableRow { table_id, row_id } => {
            remove_table_row(document, &table_id, &row_id)?;
        }
        DocumentCommand::AddTableColumn {
            table_id,
            after_column_index,
            width_mm,
            cells,
        } => {
            add_table_column(document, &table_id, after_column_index, width_mm, cells)?;
        }
        DocumentCommand::RemoveTableColumn {
            table_id,
            column_index,
        } => {
            remove_table_column(document, &table_id, column_index)?;
        }
        DocumentCommand::UpdateImage {
            block_id,
            alt,
            width_mm,
            height_mm,
            alignment,
            caption,
            keep_with_next,
        } => {
            let image = find_image_block_mut(document, &block_id)?;
            if let Some(value) = alt {
                image.alt = value;
            }
            if let Some(value) = width_mm {
                image.width_mm = clamp(value, 10.0, 180.0);
            }
            if let Some(value) = height_mm {
                image.height_mm = clamp(value, 10.0, 240.0);
            }
            if let Some(value) = alignment {
                image.alignment = value;
            }
            if let Some(value) = caption {
                image.caption = value;
            }
            if let Some(value) = keep_with_next {
                image.keep_with_next = value;
            }
        }
        DocumentCommand::SetSectionProperties { section_id, patch } => {
            set_section_properties(document, &section_id, patch)?;
        }
        DocumentCommand::SetSectionHeaderFooter {
            section_id,
            area,
            variant,
            content,
        } => {
            set_section_header_footer(document, &section_id, area, variant, content)?;
        }
        DocumentCommand::InsertBreak {
            after_block_id,
            break_block,
            new_section,
            paragraph,
        } => {
            insert_break(
                document,
                &after_block_id,
                break_block,
                new_section,
                paragraph,
            )?;
        }
        DocumentCommand::RemoveBreak { block_id } => {
            remove_break(document, &block_id)?;
        }
        DocumentCommand::SetReviewAuthor { author } => {
            document.review.author = if author.trim().is_empty() {
                "Autor local".to_string()
            } else {
                author.trim().to_string()
            };
        }
        DocumentCommand::SetTrackChanges { enabled } => document.review.track_changes = enabled,
        DocumentCommand::AddComment { thread } => document.review.comments.push(thread),
        DocumentCommand::ReplyComment { thread_id, message } => {
            let thread = document
                .review
                .comments
                .iter_mut()
                .find(|item| item.id == thread_id)
                .ok_or_else(|| {
                    EngineError::Serialization(format!("comentario '{thread_id}' no encontrado"))
                })?;
            thread.updated_at = thread
                .updated_at
                .max(message.updated_at.max(message.created_at));
            thread.messages.push(message);
        }
        DocumentCommand::ResolveComment {
            thread_id,
            resolved,
        } => {
            let thread = document
                .review
                .comments
                .iter_mut()
                .find(|item| item.id == thread_id)
                .ok_or_else(|| {
                    EngineError::Serialization(format!("comentario '{thread_id}' no encontrado"))
                })?;
            thread.resolved = resolved;
        }
        DocumentCommand::RemoveComment { thread_id } => document
            .review
            .comments
            .retain(|thread| thread.id != thread_id),
        DocumentCommand::AddBookmark { bookmark } => {
            document
                .review
                .bookmarks
                .retain(|item| !item.name.eq_ignore_ascii_case(&bookmark.name));
            document.review.bookmarks.push(bookmark);
        }
        DocumentCommand::RemoveBookmark { bookmark_id } => document
            .review
            .bookmarks
            .retain(|bookmark| bookmark.id != bookmark_id),
        DocumentCommand::SetHyperlink {
            start,
            end,
            hyperlink,
        } => set_hyperlink_range(document, &start, &end, hyperlink)?,
        DocumentCommand::AcceptChange { change_id } => {
            set_change_status(document, &change_id, ReviewChangeStatus::Accepted)?
        }
        DocumentCommand::RejectChange { change_id } => reject_change(document, &change_id)?,
        DocumentCommand::AcceptAllChanges => {
            for change in &mut document.review.changes {
                if matches!(change.status, ReviewChangeStatus::Pending) {
                    change.status = ReviewChangeStatus::Accepted;
                }
            }
        }
        DocumentCommand::RejectAllChanges => reject_all_changes(document)?,
    }
    Ok(())
}

fn block_section_id(block: &DocumentBlock) -> String {
    match block {
        DocumentBlock::Text(value) => value.section_id.clone(),
        DocumentBlock::Table(value) => value.section_id.clone(),
        DocumentBlock::Image(value) => value.section_id.clone(),
        DocumentBlock::Break(value) => value.section_id.clone(),
    }
}

fn set_block_section_id(block: &mut DocumentBlock, section_id: &str) {
    match block {
        DocumentBlock::Text(value) => value.section_id = section_id.to_string(),
        DocumentBlock::Table(value) => value.section_id = section_id.to_string(),
        DocumentBlock::Image(value) => value.section_id = section_id.to_string(),
        DocumentBlock::Break(value) => value.section_id = section_id.to_string(),
    }
}

fn find_section_mut<'a>(
    document: &'a mut TextDocument,
    section_id: &str,
) -> Result<&'a mut DocumentSection, EngineError> {
    document
        .sections
        .iter_mut()
        .find(|section| section.id == section_id)
        .ok_or_else(|| EngineError::SectionNotFound(section_id.to_string()))
}

fn set_section_properties(
    document: &mut TextDocument,
    section_id: &str,
    patch: DocumentSectionPatch,
) -> Result<(), EngineError> {
    let is_first = document.sections.first().map(|item| item.id.as_str()) == Some(section_id);
    {
        let section = find_section_mut(document, section_id)?;
        if let Some(name) = patch.name {
            if !name.trim().is_empty() {
                section.name = name;
            }
        }
        if let Some(value) = patch.page_settings {
            if let Some(item) = value.width_mm {
                section.page_settings.width_mm = item;
            }
            if let Some(item) = value.height_mm {
                section.page_settings.height_mm = item;
            }
            if let Some(item) = value.margin_top_mm {
                section.page_settings.margin_top_mm = item;
            }
            if let Some(item) = value.margin_right_mm {
                section.page_settings.margin_right_mm = item;
            }
            if let Some(item) = value.margin_bottom_mm {
                section.page_settings.margin_bottom_mm = item;
            }
            if let Some(item) = value.margin_left_mm {
                section.page_settings.margin_left_mm = item;
            }
        }
        if let Some(value) = patch.columns {
            if let Some(item) = value.count {
                section.columns.count = item;
            }
            if let Some(item) = value.gap_mm {
                section.columns.gap_mm = item;
            }
            if let Some(item) = value.line_between {
                section.columns.line_between = item;
            }
            if let Some(item) = value.balance {
                section.columns.balance = item;
            }
        }
        if let Some(value) = patch.different_first_page {
            section.different_first_page = value;
        }
        if let Some(value) = patch.different_odd_even {
            section.different_odd_even = value;
        }
        if let Some(value) = patch.page_numbering {
            if let Some(item) = value.restart {
                section.page_numbering.restart = item;
            }
            if let Some(item) = value.start {
                section.page_numbering.start = item;
            }
            if let Some(item) = value.format {
                section.page_numbering.format = item;
            }
        }
        normalize_section(section);
    }
    if is_first {
        if let Some(section) = document.sections.first() {
            document.page_settings = section.page_settings.clone();
        }
    }
    Ok(())
}

fn set_section_header_footer(
    document: &mut TextDocument,
    section_id: &str,
    area: HeaderFooterArea,
    variant: HeaderFooterVariant,
    mut content: HeaderFooterContent,
) -> Result<(), EngineError> {
    normalize_header_footer_content(&mut content);
    let section = find_section_mut(document, section_id)?;
    let variants = match area {
        HeaderFooterArea::Header => &mut section.headers,
        HeaderFooterArea::Footer => &mut section.footers,
    };
    match variant {
        HeaderFooterVariant::Default => variants.default = content,
        HeaderFooterVariant::First => variants.first = content,
        HeaderFooterVariant::Even => variants.even = content,
    }
    Ok(())
}

fn insert_break(
    document: &mut TextDocument,
    after_block_id: &str,
    mut break_block: BreakBlock,
    new_section: Option<DocumentSection>,
    paragraph: Option<TextBlock>,
) -> Result<(), EngineError> {
    let index = find_block_index(document, after_block_id)?;
    assert_unique_block_id(document, &break_block.id)?;
    let source_section_id = document
        .blocks
        .get(index)
        .map(block_section_id)
        .unwrap_or_else(default_section_id);
    break_block.block_type = "break".to_string();
    break_block.section_id = source_section_id.clone();
    let mut target_section_id = source_section_id.clone();
    if matches!(break_block.break_kind, BreakKind::Section) {
        let mut section = new_section.ok_or(EngineError::NewSectionRequired)?;
        if section.id.is_empty() {
            section.id = format!("section-{}", document.sections.len() + 1);
        }
        if document.sections.iter().any(|item| item.id == section.id) {
            return Err(EngineError::DuplicateBlockId(section.id));
        }
        normalize_section(&mut section);
        target_section_id = section.id.clone();
        break_block.next_section_id = Some(section.id.clone());
        document.sections.push(section);
        for candidate in document.blocks.iter_mut().skip(index + 1) {
            if matches!(candidate, DocumentBlock::Break(value) if matches!(value.break_kind, BreakKind::Section))
            {
                break;
            }
            set_block_section_id(candidate, &target_section_id);
        }
    } else {
        break_block.next_section_id = None;
    }
    document
        .blocks
        .insert(index + 1, DocumentBlock::Break(break_block.clone()));
    if let Some(mut value) = paragraph {
        assert_unique_block_id(document, &value.id)?;
        value.block_type = "text".to_string();
        value.section_id = target_section_id.clone();
        document
            .blocks
            .insert(index + 2, DocumentBlock::Text(value));
    } else if index + 2 >= document.blocks.len() {
        let id = format!("{}-paragraph", break_block.id);
        let mut value = empty_paragraph(&id, &format!("{id}-run-1"));
        value.section_id = target_section_id;
        document.blocks.push(DocumentBlock::Text(value));
    }
    Ok(())
}

fn remove_break(document: &mut TextDocument, block_id: &str) -> Result<(), EngineError> {
    let index = find_block_index(document, block_id)?;
    let break_block = match document.blocks.get(index) {
        Some(DocumentBlock::Break(value)) => value.clone(),
        _ => return Err(EngineError::WrongBlockType(block_id.to_string())),
    };
    if matches!(break_block.break_kind, BreakKind::Section) {
        if let Some(next_section_id) = break_block.next_section_id.as_ref() {
            for candidate in document.blocks.iter_mut().skip(index + 1) {
                if matches!(candidate, DocumentBlock::Break(value) if matches!(value.break_kind, BreakKind::Section))
                {
                    break;
                }
                if block_section_id(candidate) == next_section_id.as_str() {
                    set_block_section_id(candidate, &break_block.section_id);
                }
            }
            document
                .sections
                .retain(|section| section.id != next_section_id.as_str());
        }
    }
    document.blocks.remove(index);
    ensure_text_block(document);
    Ok(())
}

fn replace_text_range(
    document: &mut TextDocument,
    block_id: &str,
    start: usize,
    end: usize,
    text: &str,
    patch: Option<&TextStylePatch>,
) -> Result<(), EngineError> {
    let block = find_text_block_mut(document, block_id)?;
    validate_range(start, end, block_char_len(block))?;
    let fallback = apply_text_style(style_at_offset(block, start), patch);
    let (before, remainder) = split_runs(&block.runs, start)?;
    let (_, after) = split_runs(&remainder, end - start)?;
    let mut runs = before;
    if !text.is_empty() {
        runs.push(TextRun {
            id: format!("{}-insert", block.id),
            text: text.to_string(),
            style: fallback.clone(),
            hyperlink: None,
        });
    }
    runs.extend(after);
    block.runs = normalize_runs(&block.id, runs, fallback, None);
    Ok(())
}

fn format_text_range(
    document: &mut TextDocument,
    block_id: &str,
    start: usize,
    end: usize,
    patch: &TextStylePatch,
) -> Result<(), EngineError> {
    let block = find_text_block_mut(document, block_id)?;
    validate_range(start, end, block_char_len(block))?;
    if start == end {
        return Ok(());
    }
    let fallback = style_at_offset(block, start);
    let (before, remainder) = split_runs(&block.runs, start)?;
    let (selected, after) = split_runs(&remainder, end - start)?;
    let formatted = selected
        .into_iter()
        .map(|mut run| {
            run.style = apply_text_style(run.style, Some(patch));
            run
        })
        .collect::<Vec<_>>();
    block.runs = normalize_runs(
        &block.id,
        before.into_iter().chain(formatted).chain(after).collect(),
        fallback,
        None,
    );
    Ok(())
}

fn format_document_range(
    document: &mut TextDocument,
    start: &DocumentPoint,
    end: &DocumentPoint,
    patch: &TextStylePatch,
) -> Result<(), EngineError> {
    let range = ordered_range(document, start, end)?;
    if range.start_index == range.end_index && range.start.offset == range.end.offset {
        return Ok(());
    }
    for index in range.start_index..=range.end_index {
        let Some(DocumentBlock::Text(block)) = document.blocks.get(index) else {
            continue;
        };
        let length = block_char_len(block);
        let from = if index == range.start_index {
            range.start.offset
        } else {
            0
        };
        let to = if index == range.end_index {
            range.end.offset
        } else {
            length
        };
        if from < to {
            let id = block.id.clone();
            format_text_range(document, &id, from, to, patch)?;
        }
    }
    Ok(())
}

fn replace_range_with_fragment(
    document: &mut TextDocument,
    start: &DocumentPoint,
    end: &DocumentPoint,
    fragment: &DocumentFragment,
    trailing_block_id: Option<String>,
    trailing_run_id: Option<String>,
) -> Result<(), EngineError> {
    let range = ordered_range(document, start, end)?;
    let start_source = document
        .blocks
        .get(range.start_index)
        .and_then(DocumentBlock::as_text)
        .cloned()
        .ok_or(EngineError::InvalidSelection)?;
    let end_source = document
        .blocks
        .get(range.end_index)
        .and_then(DocumentBlock::as_text)
        .cloned()
        .ok_or(EngineError::InvalidSelection)?;
    validate_range(
        range.start.offset,
        range.start.offset,
        block_char_len(&start_source),
    )?;
    validate_range(
        range.end.offset,
        range.end.offset,
        block_char_len(&end_source),
    )?;

    let removed_image_resource_ids = document.blocks[range.start_index..=range.end_index]
        .iter()
        .filter_map(|block| match block {
            DocumentBlock::Image(image) => Some(image.resource_id.clone()),
            _ => None,
        })
        .collect::<Vec<_>>();
    let prefix = slice_runs(&start_source, 0, range.start.offset);
    let suffix = slice_runs(&end_source, range.end.offset, block_char_len(&end_source));
    let prefix_has_text = range.start.offset > 0;
    let suffix_has_text = range.end.offset < block_char_len(&end_source);
    let mut inserted = fragment.blocks.clone();
    for block in &mut inserted {
        normalize_block(block);
        set_block_section_id(block, &start_source.section_id);
        if let DocumentBlock::Break(value) = block {
            if matches!(value.break_kind, BreakKind::Section) {
                value.break_kind = BreakKind::Page;
                value.next_section_id = None;
            }
        }
    }
    for (id, resource) in &fragment.resources.images {
        document
            .resources
            .images
            .insert(id.clone(), resource.clone());
    }

    let mut replacement: Vec<DocumentBlock> = Vec::new();
    if inserted.is_empty() {
        let mut merged = start_source.clone();
        merged.runs = normalize_runs(
            &merged.id,
            prefix.into_iter().chain(suffix).collect(),
            style_at_offset(&start_source, range.start.offset),
            None,
        );
        replacement.push(DocumentBlock::Text(merged));
    } else if inserted.len() == 1 {
        match inserted.remove(0) {
            DocumentBlock::Text(mut only) => {
                only.id = start_source.id.clone();
                if prefix_has_text {
                    only.kind = start_source.kind.clone();
                    only.paragraph_style = start_source.paragraph_style.clone();
                    only.list = start_source.list.clone();
                }
                only.runs = normalize_runs(
                    &only.id,
                    prefix.into_iter().chain(only.runs).chain(suffix).collect(),
                    style_at_offset(&start_source, range.start.offset),
                    None,
                );
                replacement.push(DocumentBlock::Text(only));
            }
            other => {
                if prefix_has_text {
                    let mut left = start_source.clone();
                    left.runs = normalize_runs(
                        &left.id,
                        prefix,
                        style_at_offset(&start_source, range.start.offset),
                        None,
                    );
                    replacement.push(DocumentBlock::Text(left));
                }
                replacement.push(other);
                if suffix_has_text || !replacement.iter().any(|block| block.as_text().is_some()) {
                    replacement.push(DocumentBlock::Text(trailing_text_block(
                        &end_source,
                        suffix,
                        trailing_block_id,
                        trailing_run_id,
                        document.metadata.revision,
                    )));
                }
            }
        }
    } else {
        if let Some(first) = inserted.first_mut() {
            match first {
                DocumentBlock::Text(block) => {
                    block.id = start_source.id.clone();
                    if prefix_has_text {
                        block.kind = start_source.kind.clone();
                        block.paragraph_style = start_source.paragraph_style.clone();
                        block.list = start_source.list.clone();
                    }
                    block.runs = normalize_runs(
                        &block.id,
                        prefix,
                        style_at_offset(&start_source, range.start.offset),
                        None,
                    )
                    .into_iter()
                    .chain(block.runs.clone())
                    .collect::<Vec<_>>();
                    block.runs = normalize_runs(
                        &block.id,
                        block.runs.clone(),
                        style_at_offset(&start_source, range.start.offset),
                        None,
                    );
                }
                _ if prefix_has_text => {
                    let mut left = start_source.clone();
                    left.runs = normalize_runs(
                        &left.id,
                        prefix,
                        style_at_offset(&start_source, range.start.offset),
                        None,
                    );
                    replacement.push(DocumentBlock::Text(left));
                }
                _ => {}
            }
        }

        if let Some(last) = inserted.last_mut() {
            match last {
                DocumentBlock::Text(block) => {
                    block.runs.extend(suffix.clone());
                    block.runs = normalize_runs(
                        &block.id,
                        block.runs.clone(),
                        style_at_offset(&end_source, range.end.offset),
                        None,
                    );
                }
                _ if suffix_has_text => {
                    // El bloque de cola se agrega después de insertar el fragmento.
                }
                _ => {}
            }
        }

        let last_is_text = inserted.last().and_then(DocumentBlock::as_text).is_some();
        replacement.extend(inserted);
        if !last_is_text
            && (suffix_has_text || !replacement.iter().any(|block| block.as_text().is_some()))
        {
            replacement.push(DocumentBlock::Text(trailing_text_block(
                &end_source,
                suffix,
                trailing_block_id,
                trailing_run_id,
                document.metadata.revision,
            )));
        }
    }

    validate_replacement_ids(document, &replacement, range.start_index, range.end_index)?;
    document
        .blocks
        .splice(range.start_index..=range.end_index, replacement);
    for resource_id in removed_image_resource_ids {
        remove_unused_image_resource(document, &resource_id);
    }
    ensure_text_block(document);
    Ok(())
}

fn trailing_text_block(
    end_source: &TextBlock,
    suffix: Vec<TextRun>,
    trailing_block_id: Option<String>,
    trailing_run_id: Option<String>,
    revision: u64,
) -> TextBlock {
    let id =
        trailing_block_id.unwrap_or_else(|| format!("{}-tail-{}", end_source.id, revision + 1));
    let mut right = end_source.clone();
    right.id = id.clone();
    right.runs = normalize_runs(
        &id,
        suffix,
        style_at_offset(end_source, block_char_len(end_source)),
        trailing_run_id,
    );
    right
}

fn split_block(
    document: &mut TextDocument,
    block_id: &str,
    offset: usize,
    new_block_id: String,
    new_run_id: String,
) -> Result<(), EngineError> {
    assert_unique_block_id(document, &new_block_id)?;
    let index = find_block_index(document, block_id)?;
    let source = document
        .blocks
        .get(index)
        .and_then(DocumentBlock::as_text)
        .cloned()
        .ok_or_else(|| EngineError::WrongBlockType(block_id.to_string()))?;
    validate_range(offset, offset, block_char_len(&source))?;
    let (left, right) = split_runs(&source.runs, offset)?;
    let fallback = style_at_offset(&source, offset);
    let mut current = source.clone();
    current.runs = normalize_runs(&current.id, left, fallback.clone(), None);
    let next_kind = match source.kind {
        BlockKind::Heading { .. } => BlockKind::Paragraph,
        other => other,
    };
    let next = TextBlock {
        block_type: "text".to_string(),
        id: new_block_id.clone(),
        section_id: source.section_id.clone(),
        kind: next_kind,
        paragraph_style: source.paragraph_style,
        list: source.list,
        runs: normalize_runs(&new_block_id, right, fallback, Some(new_run_id)),
    };
    document.blocks[index] = DocumentBlock::Text(current);
    document.blocks.insert(index + 1, DocumentBlock::Text(next));
    Ok(())
}

fn merge_with_previous(document: &mut TextDocument, block_id: &str) -> Result<(), EngineError> {
    let index = find_block_index(document, block_id)?;
    if index == 0 {
        return Err(EngineError::CannotMerge);
    }
    let current = document
        .blocks
        .get(index)
        .and_then(DocumentBlock::as_text)
        .cloned()
        .ok_or(EngineError::CannotMerge)?;
    let previous = document
        .blocks
        .get(index - 1)
        .and_then(DocumentBlock::as_text)
        .cloned()
        .ok_or(EngineError::CannotMerge)?;
    let fallback = previous
        .runs
        .last()
        .map(|run| run.style.clone())
        .unwrap_or_default();
    let mut merged = previous.clone();
    merged.runs = normalize_runs(
        &merged.id,
        previous.runs.into_iter().chain(current.runs).collect(),
        fallback,
        None,
    );
    document.blocks[index - 1] = DocumentBlock::Text(merged);
    document.blocks.remove(index);
    Ok(())
}

fn remove_block(document: &mut TextDocument, block_id: &str) -> Result<(), EngineError> {
    let index = find_block_index(document, block_id)?;
    let removed = document.blocks.remove(index);
    if let DocumentBlock::Image(image) = removed {
        remove_unused_image_resource(document, &image.resource_id);
    }
    ensure_text_block(document);
    Ok(())
}

fn remove_unused_image_resource(document: &mut TextDocument, resource_id: &str) {
    let still_used = document.blocks.iter().any(
        |block| matches!(block, DocumentBlock::Image(image) if image.resource_id == resource_id),
    );
    if !still_used {
        document.resources.images.remove(resource_id);
    }
}

fn update_table_cell(
    document: &mut TextDocument,
    table_id: &str,
    row_id: &str,
    cell_id: &str,
    text: String,
) -> Result<(), EngineError> {
    let table = find_table_block_mut(document, table_id)?;
    let row = table
        .rows
        .iter_mut()
        .find(|row| row.id == row_id)
        .ok_or_else(|| EngineError::InvalidTable(format!("fila '{row_id}' no encontrada")))?;
    let cell = row
        .cells
        .iter_mut()
        .find(|cell| cell.id == cell_id)
        .ok_or_else(|| EngineError::InvalidTable(format!("celda '{cell_id}' no encontrada")))?;
    let style = cell
        .runs
        .first()
        .map(|run| run.style.clone())
        .unwrap_or_default();
    cell.runs = normalize_runs(
        &cell.id,
        vec![TextRun {
            id: format!("{}-edit", cell.id),
            text,
            style: style.clone(),
            hyperlink: None,
        }],
        style,
        None,
    );
    Ok(())
}

fn add_table_row(
    document: &mut TextDocument,
    table_id: &str,
    after_row_id: Option<&str>,
    mut row: TableRow,
) -> Result<(), EngineError> {
    let table = find_table_block_mut(document, table_id)?;
    let columns = table.column_widths_mm.len();
    if row.cells.len() != columns {
        return Err(EngineError::InvalidTable(format!(
            "la fila debe contener {columns} celdas"
        )));
    }
    normalize_table_row(&mut row, table_id, table.rows.len(), columns);
    let index = match after_row_id {
        Some(id) => {
            table
                .rows
                .iter()
                .position(|item| item.id == id)
                .ok_or_else(|| EngineError::InvalidTable(format!("fila '{id}' no encontrada")))?
                + 1
        }
        None => table.rows.len(),
    };
    table.rows.insert(index, row);
    Ok(())
}

fn remove_table_row(
    document: &mut TextDocument,
    table_id: &str,
    row_id: &str,
) -> Result<(), EngineError> {
    let table = find_table_block_mut(document, table_id)?;
    if table.rows.len() <= 1 {
        return Err(EngineError::CannotRemoveLastTableRow);
    }
    let index = table
        .rows
        .iter()
        .position(|row| row.id == row_id)
        .ok_or_else(|| EngineError::InvalidTable(format!("fila '{row_id}' no encontrada")))?;
    table.rows.remove(index);
    table.style.header_rows = table.style.header_rows.min(table.rows.len());
    Ok(())
}

fn add_table_column(
    document: &mut TextDocument,
    table_id: &str,
    after_column_index: isize,
    width_mm: f64,
    mut cells: Vec<TableCell>,
) -> Result<(), EngineError> {
    let table = find_table_block_mut(document, table_id)?;
    if cells.len() != table.rows.len() {
        return Err(EngineError::InvalidTable(format!(
            "se requieren {} celdas para la columna",
            table.rows.len()
        )));
    }
    let proposed = after_column_index.saturating_add(1).max(0) as usize;
    let index = proposed.min(table.column_widths_mm.len());
    table
        .column_widths_mm
        .insert(index, clamp(width_mm, 10.0, 120.0));
    for (row_index, row) in table.rows.iter_mut().enumerate() {
        let mut cell = cells.remove(0);
        normalize_table_cell(&mut cell, &format!("{table_id}-cell-new-{}", row_index + 1));
        row.cells.insert(index, cell);
    }
    Ok(())
}

fn remove_table_column(
    document: &mut TextDocument,
    table_id: &str,
    column_index: usize,
) -> Result<(), EngineError> {
    let table = find_table_block_mut(document, table_id)?;
    if table.column_widths_mm.len() <= 1 {
        return Err(EngineError::CannotRemoveLastTableColumn);
    }
    if column_index >= table.column_widths_mm.len() {
        return Err(EngineError::InvalidTable("columna inexistente".to_string()));
    }
    table.column_widths_mm.remove(column_index);
    for row in &mut table.rows {
        row.cells.remove(column_index);
    }
    Ok(())
}

fn find_block_index(document: &TextDocument, id: &str) -> Result<usize, EngineError> {
    document
        .blocks
        .iter()
        .position(|block| block.id() == id)
        .ok_or_else(|| EngineError::BlockNotFound(id.to_string()))
}

fn find_text_block<'a>(document: &'a TextDocument, id: &str) -> Result<&'a TextBlock, EngineError> {
    document
        .blocks
        .iter()
        .find(|block| block.id() == id)
        .ok_or_else(|| EngineError::BlockNotFound(id.to_string()))?
        .as_text()
        .ok_or_else(|| EngineError::WrongBlockType(id.to_string()))
}

fn find_text_block_mut<'a>(
    document: &'a mut TextDocument,
    id: &str,
) -> Result<&'a mut TextBlock, EngineError> {
    document
        .blocks
        .iter_mut()
        .find(|block| block.id() == id)
        .ok_or_else(|| EngineError::BlockNotFound(id.to_string()))?
        .as_text_mut()
        .ok_or_else(|| EngineError::WrongBlockType(id.to_string()))
}

fn find_table_block_mut<'a>(
    document: &'a mut TextDocument,
    id: &str,
) -> Result<&'a mut TableBlock, EngineError> {
    document
        .blocks
        .iter_mut()
        .find(|block| block.id() == id)
        .ok_or_else(|| EngineError::BlockNotFound(id.to_string()))?
        .as_table_mut()
        .ok_or_else(|| EngineError::WrongBlockType(id.to_string()))
}

fn find_image_block_mut<'a>(
    document: &'a mut TextDocument,
    id: &str,
) -> Result<&'a mut ImageBlock, EngineError> {
    document
        .blocks
        .iter_mut()
        .find(|block| block.id() == id)
        .ok_or_else(|| EngineError::BlockNotFound(id.to_string()))?
        .as_image_mut()
        .ok_or_else(|| EngineError::WrongBlockType(id.to_string()))
}

#[derive(Debug, Clone)]
struct OrderedRange {
    start: DocumentPoint,
    end: DocumentPoint,
    start_index: usize,
    end_index: usize,
}

fn ordered_range(
    document: &TextDocument,
    anchor: &DocumentPoint,
    focus: &DocumentPoint,
) -> Result<OrderedRange, EngineError> {
    let anchor_index = find_block_index(document, &anchor.block_id)?;
    let focus_index = find_block_index(document, &focus.block_id)?;
    let anchor_block = document.blocks[anchor_index]
        .as_text()
        .ok_or(EngineError::InvalidSelection)?;
    let focus_block = document.blocks[focus_index]
        .as_text()
        .ok_or(EngineError::InvalidSelection)?;
    let anchor_offset = anchor.offset.min(block_char_len(anchor_block));
    let focus_offset = focus.offset.min(block_char_len(focus_block));
    let anchor_before = anchor_index < focus_index
        || (anchor_index == focus_index && anchor_offset <= focus_offset);
    if anchor_before {
        Ok(OrderedRange {
            start: DocumentPoint {
                block_id: anchor.block_id.clone(),
                offset: anchor_offset,
            },
            end: DocumentPoint {
                block_id: focus.block_id.clone(),
                offset: focus_offset,
            },
            start_index: anchor_index,
            end_index: focus_index,
        })
    } else {
        Ok(OrderedRange {
            start: DocumentPoint {
                block_id: focus.block_id.clone(),
                offset: focus_offset,
            },
            end: DocumentPoint {
                block_id: anchor.block_id.clone(),
                offset: anchor_offset,
            },
            start_index: focus_index,
            end_index: anchor_index,
        })
    }
}

fn block_text(block: &TextBlock) -> String {
    block.runs.iter().map(|run| run.text.as_str()).collect()
}

fn block_char_len(block: &TextBlock) -> usize {
    block_text(block).chars().count()
}

fn style_at_offset(block: &TextBlock, offset: usize) -> TextStyle {
    let total = block_char_len(block);
    let mut cursor = 0;
    for run in &block.runs {
        let end = cursor + run.text.chars().count();
        if offset < end || (offset == end && end == total) {
            return run.style.clone();
        }
        cursor = end;
    }
    block
        .runs
        .last()
        .map(|run| run.style.clone())
        .unwrap_or_default()
}

fn slice_runs(block: &TextBlock, start: usize, end: usize) -> Vec<TextRun> {
    let mut result = Vec::new();
    let mut cursor = 0;
    for run in &block.runs {
        let chars = run.text.chars().collect::<Vec<_>>();
        let run_start = cursor;
        let run_end = cursor + chars.len();
        let from = start.max(run_start);
        let to = end.min(run_end);
        if from < to {
            result.push(TextRun {
                id: format!("{}-slice-{from}-{to}", block.id),
                text: chars[from - run_start..to - run_start].iter().collect(),
                style: run.style.clone(),
                hyperlink: run.hyperlink.clone(),
            });
        }
        cursor = run_end;
    }
    normalize_runs(&block.id, result, style_at_offset(block, start), None)
}

fn split_runs(
    runs: &[TextRun],
    offset: usize,
) -> Result<(Vec<TextRun>, Vec<TextRun>), EngineError> {
    let total: usize = runs.iter().map(|run| run.text.chars().count()).sum();
    validate_range(offset, offset, total)?;
    let mut left = Vec::new();
    let mut right = Vec::new();
    let mut cursor = 0;
    for run in runs {
        let chars = run.text.chars().collect::<Vec<_>>();
        let run_end = cursor + chars.len();
        if offset <= cursor {
            right.push(run.clone());
        } else if offset >= run_end {
            left.push(run.clone());
        } else {
            let local = offset - cursor;
            if local > 0 {
                left.push(TextRun {
                    id: run.id.clone(),
                    text: chars[..local].iter().collect(),
                    style: run.style.clone(),
                    hyperlink: run.hyperlink.clone(),
                });
            }
            if local < chars.len() {
                right.push(TextRun {
                    id: run.id.clone(),
                    text: chars[local..].iter().collect(),
                    style: run.style.clone(),
                    hyperlink: run.hyperlink.clone(),
                });
            }
        }
        cursor = run_end;
    }
    Ok((left, right))
}

fn normalize_runs(
    owner_id: &str,
    runs: Vec<TextRun>,
    fallback_style: TextStyle,
    empty_run_id: Option<String>,
) -> Vec<TextRun> {
    let mut merged: Vec<TextRun> = Vec::new();
    for run in runs {
        if run.text.is_empty() {
            continue;
        }
        if let Some(previous) = merged.last_mut() {
            if previous.style == run.style && previous.hyperlink == run.hyperlink {
                previous.text.push_str(&run.text);
                continue;
            }
        }
        merged.push(run);
    }
    if merged.is_empty() {
        return vec![TextRun {
            id: empty_run_id.unwrap_or_else(|| format!("{owner_id}-run-1")),
            text: String::new(),
            style: fallback_style,
            hyperlink: None,
        }];
    }
    merged
        .into_iter()
        .enumerate()
        .map(|(index, mut run)| {
            run.id = format!("{owner_id}-run-{}", index + 1);
            run
        })
        .collect()
}

fn apply_text_style(mut style: TextStyle, patch: Option<&TextStylePatch>) -> TextStyle {
    let Some(patch) = patch else {
        return style;
    };
    if let Some(value) = patch.bold {
        style.bold = value;
    }
    if let Some(value) = patch.italic {
        style.italic = value;
    }
    if let Some(value) = patch.underline {
        style.underline = value;
    }
    if let Some(value) = patch.strike {
        style.strike = value;
    }
    if let Some(value) = &patch.font_family {
        style.font_family = value.clone();
    }
    if let Some(value) = patch.font_size_pt {
        style.font_size_pt = clamp(value, 6.0, 144.0);
    }
    if let Some(value) = &patch.color {
        style.color = value.clone();
    }
    if let Some(value) = &patch.highlight {
        style.highlight = value.clone();
    }
    style
}

fn patch_paragraph_style(style: &mut ParagraphStyle, patch: &ParagraphStylePatch) {
    if let Some(value) = &patch.alignment {
        style.alignment = value.clone();
    }
    if let Some(value) = patch.line_height {
        style.line_height = clamp(value, 0.8, 4.0);
    }
    if let Some(value) = patch.space_before_pt {
        style.space_before_pt = value.max(0.0);
    }
    if let Some(value) = patch.space_after_pt {
        style.space_after_pt = value.max(0.0);
    }
    if let Some(value) = patch.first_line_indent_mm {
        style.first_line_indent_mm = clamp(value, -30.0, 100.0);
    }
    if let Some(value) = patch.keep_with_next {
        style.keep_with_next = value;
    }
    if let Some(value) = patch.keep_lines_together {
        style.keep_lines_together = value;
    }
    if let Some(value) = patch.page_break_before {
        style.page_break_before = value;
    }
    if let Some(value) = patch.widow_control {
        style.widow_control = value;
    }
}

fn validate_range(start: usize, end: usize, len: usize) -> Result<(), EngineError> {
    if start > end || end > len {
        return Err(EngineError::InvalidRange { start, end, len });
    }
    Ok(())
}

fn validate_kind(kind: &BlockKind) -> Result<(), EngineError> {
    if let BlockKind::Heading { level } = kind {
        if !(1..=6).contains(level) {
            return Err(EngineError::InvalidHeadingLevel(*level));
        }
    }
    Ok(())
}

fn normalize_list(mut list: ListProperties) -> ListProperties {
    list.level = list.level.min(8);
    list.start = list.start.clamp(1, 9999);
    list
}

fn empty_paragraph(block_id: &str, run_id: &str) -> TextBlock {
    TextBlock {
        block_type: "text".to_string(),
        id: block_id.to_string(),
        section_id: default_section_id(),
        kind: BlockKind::Paragraph,
        paragraph_style: ParagraphStyle::default(),
        list: None,
        runs: vec![TextRun {
            id: run_id.to_string(),
            text: String::new(),
            style: TextStyle::default(),
            hyperlink: None,
        }],
    }
}

fn empty_fragment() -> DocumentFragment {
    DocumentFragment {
        version: 1,
        source_schema_version: CURRENT_SCHEMA_VERSION,
        blocks: Vec::new(),
        resources: DocumentResources::default(),
        sections: Vec::new(),
    }
}

fn fragment_from_plain_text(text: &str, prefix: &str, style: &TextStyle) -> DocumentFragment {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let blocks = normalized
        .split('\n')
        .enumerate()
        .map(|(index, line)| {
            DocumentBlock::Text(TextBlock {
                block_type: "text".to_string(),
                id: format!("{prefix}-block-{}", index + 1),
                section_id: default_section_id(),
                kind: BlockKind::Paragraph,
                paragraph_style: ParagraphStyle::default(),
                list: None,
                runs: vec![TextRun {
                    id: format!("{prefix}-run-{}", index + 1),
                    text: line.to_string(),
                    style: style.clone(),
                    hyperlink: None,
                }],
            })
        })
        .collect();
    DocumentFragment {
        version: 1,
        source_schema_version: CURRENT_SCHEMA_VERSION,
        blocks,
        resources: DocumentResources::default(),
        sections: Vec::new(),
    }
}

fn default_section_id() -> String {
    "section-1".to_string()
}

fn default_section() -> DocumentSection {
    DocumentSection {
        id: default_section_id(),
        name: "Sección 1".to_string(),
        page_settings: PageSettings::default(),
        columns: SectionColumns::default(),
        headers: HeaderFooterVariants::default(),
        footers: HeaderFooterVariants::default(),
        different_first_page: false,
        different_odd_even: false,
        page_numbering: PageNumbering::default(),
    }
}

fn default_sections() -> Vec<DocumentSection> {
    vec![default_section()]
}

fn normalize_header_footer_content(content: &mut HeaderFooterContent) {
    content.distance_from_edge_mm = clamp(content.distance_from_edge_mm, 0.0, 50.0);
}

fn normalize_section(section: &mut DocumentSection) {
    if section.id.is_empty() {
        section.id = default_section_id();
    }
    if section.name.trim().is_empty() {
        section.name = "Sección".to_string();
    }
    section.page_settings.width_mm = clamp(section.page_settings.width_mm, 50.0, 1000.0);
    section.page_settings.height_mm = clamp(section.page_settings.height_mm, 50.0, 1000.0);
    section.page_settings.margin_top_mm = clamp(section.page_settings.margin_top_mm, 0.0, 100.0);
    section.page_settings.margin_right_mm =
        clamp(section.page_settings.margin_right_mm, 0.0, 100.0);
    section.page_settings.margin_bottom_mm =
        clamp(section.page_settings.margin_bottom_mm, 0.0, 100.0);
    section.page_settings.margin_left_mm = clamp(section.page_settings.margin_left_mm, 0.0, 100.0);
    section.columns.count = section.columns.count.clamp(1, 4);
    section.columns.gap_mm = clamp(section.columns.gap_mm, 0.0, 50.0);
    section.page_numbering.start = section.page_numbering.start.max(1);
    normalize_header_footer_content(&mut section.headers.default);
    normalize_header_footer_content(&mut section.headers.first);
    normalize_header_footer_content(&mut section.headers.even);
    normalize_header_footer_content(&mut section.footers.default);
    normalize_header_footer_content(&mut section.footers.first);
    normalize_header_footer_content(&mut section.footers.even);
}

fn normalize_document(document: &mut TextDocument) {
    document.metadata.schema_version = CURRENT_SCHEMA_VERSION;
    if document.sections.is_empty() {
        let mut section = default_section();
        section.page_settings = document.page_settings.clone();
        document.sections.push(section);
    }
    for section in &mut document.sections {
        normalize_section(section);
    }
    let section_ids = document
        .sections
        .iter()
        .map(|section| section.id.clone())
        .collect::<HashSet<_>>();
    let mut active_section_id = document
        .sections
        .first()
        .map(|section| section.id.clone())
        .unwrap_or_else(default_section_id);
    if document.blocks.is_empty() {
        let mut paragraph = empty_paragraph("block-1", "run-1");
        paragraph.section_id = active_section_id.clone();
        document.blocks.push(DocumentBlock::Text(paragraph));
    }
    for block in &mut document.blocks {
        normalize_block(block);
        if !section_ids.contains(&block_section_id(block)) {
            set_block_section_id(block, &active_section_id);
        }
        match block {
            DocumentBlock::Break(value)
                if matches!(value.break_kind, BreakKind::Section)
                    && value
                        .next_section_id
                        .as_ref()
                        .is_some_and(|id| section_ids.contains(id)) =>
            {
                active_section_id = value
                    .next_section_id
                    .clone()
                    .unwrap_or_else(default_section_id);
            }
            DocumentBlock::Break(_) => {}
            _ => active_section_id = block_section_id(block),
        }
    }
    if let Some(first) = document.sections.first() {
        document.page_settings = first.page_settings.clone();
    }
    ensure_text_block(document);
}

fn normalize_block(block: &mut DocumentBlock) {
    match block {
        DocumentBlock::Text(text) => {
            text.block_type = "text".to_string();
            if text.id.is_empty() {
                text.id = "text-block".to_string();
            }
            if text.section_id.is_empty() {
                text.section_id = default_section_id();
            }
            text.runs = normalize_runs(
                &text.id,
                text.runs.clone(),
                text.runs
                    .first()
                    .map(|run| run.style.clone())
                    .unwrap_or_default(),
                None,
            );
            if let Some(list) = text.list.take() {
                text.list = Some(normalize_list(list));
            }
            text.paragraph_style.line_height = clamp(text.paragraph_style.line_height, 0.8, 4.0);
            text.paragraph_style.space_before_pt = text.paragraph_style.space_before_pt.max(0.0);
            text.paragraph_style.space_after_pt = text.paragraph_style.space_after_pt.max(0.0);
            let _ = validate_kind(&text.kind);
        }
        DocumentBlock::Table(table) => {
            table.block_type = "table".to_string();
            if table.section_id.is_empty() {
                table.section_id = default_section_id();
            }
            if table.rows.is_empty() {
                table.rows.push(TableRow {
                    id: format!("{}-row-1", table.id),
                    cells: vec![empty_table_cell(&format!("{}-cell-1-1", table.id))],
                });
            }
            let columns = table
                .rows
                .iter()
                .map(|row| row.cells.len())
                .max()
                .unwrap_or(1)
                .max(1);
            if table.column_widths_mm.len() != columns {
                table.column_widths_mm = (0..columns).map(|_| 35.0).collect();
            }
            for (row_index, row) in table.rows.iter_mut().enumerate() {
                normalize_table_row(row, &table.id, row_index, columns);
            }
            table.style.border_width_pt = clamp(table.style.border_width_pt, 0.1, 8.0);
            table.style.cell_padding_mm = clamp(table.style.cell_padding_mm, 0.0, 20.0);
            table.style.header_rows = table.style.header_rows.min(table.rows.len());
        }
        DocumentBlock::Image(image) => {
            image.block_type = "image".to_string();
            if image.section_id.is_empty() {
                image.section_id = default_section_id();
            }
            image.width_mm = clamp(image.width_mm, 10.0, 180.0);
            image.height_mm = clamp(image.height_mm, 10.0, 240.0);
        }
        DocumentBlock::Break(value) => {
            value.block_type = "break".to_string();
            if value.section_id.is_empty() {
                value.section_id = default_section_id();
            }
            if !matches!(value.break_kind, BreakKind::Section) {
                value.next_section_id = None;
            }
        }
    }
}

fn normalize_table_row(row: &mut TableRow, table_id: &str, row_index: usize, columns: usize) {
    if row.id.is_empty() {
        row.id = format!("{table_id}-row-{}", row_index + 1);
    }
    while row.cells.len() < columns {
        row.cells.push(empty_table_cell(&format!(
            "{table_id}-cell-{}-{}",
            row_index + 1,
            row.cells.len() + 1
        )));
    }
    row.cells.truncate(columns);
    for (column_index, cell) in row.cells.iter_mut().enumerate() {
        normalize_table_cell(
            cell,
            &format!("{table_id}-cell-{}-{}", row_index + 1, column_index + 1),
        );
    }
}

fn normalize_table_cell(cell: &mut TableCell, fallback_id: &str) {
    if cell.id.is_empty() {
        cell.id = fallback_id.to_string();
    }
    cell.runs = normalize_runs(
        &cell.id,
        cell.runs.clone(),
        cell.runs
            .first()
            .map(|run| run.style.clone())
            .unwrap_or_default(),
        None,
    );
    cell.paragraph_style.space_after_pt = cell.paragraph_style.space_after_pt.max(0.0);
}

fn empty_table_cell(id: &str) -> TableCell {
    let paragraph_style = ParagraphStyle {
        space_after_pt: 0.0,
        ..Default::default()
    };
    TableCell {
        id: id.to_string(),
        paragraph_style,
        runs: vec![TextRun {
            id: format!("{id}-run-1"),
            text: String::new(),
            style: TextStyle::default(),
            hyperlink: None,
        }],
        background_color: None,
    }
}

fn ensure_text_block(document: &mut TextDocument) {
    if document
        .blocks
        .iter()
        .any(|block| block.as_text().is_some())
    {
        return;
    }
    let mut index = 1;
    loop {
        let id = format!("block-text-{index}");
        if !document.blocks.iter().any(|block| block.id() == id) {
            let mut paragraph = empty_paragraph(&id, &format!("{id}-run-1"));
            paragraph.section_id = document
                .blocks
                .last()
                .map(block_section_id)
                .or_else(|| document.sections.first().map(|section| section.id.clone()))
                .unwrap_or_else(default_section_id);
            document.blocks.push(DocumentBlock::Text(paragraph));
            break;
        }
        index += 1;
    }
}

fn validate_document(document: &TextDocument) -> Result<(), EngineError> {
    let section_ids = document
        .sections
        .iter()
        .map(|section| section.id.clone())
        .collect::<HashSet<_>>();
    if section_ids.is_empty() {
        return Err(EngineError::SectionNotFound(default_section_id()));
    }
    let mut ids = HashSet::new();
    let mut has_text = false;
    for block in &document.blocks {
        if !ids.insert(block.id().to_string()) {
            return Err(EngineError::DuplicateBlockId(block.id().to_string()));
        }
        let section_id = block_section_id(block);
        if !section_ids.contains(&section_id) {
            return Err(EngineError::SectionNotFound(section_id));
        }
        match block {
            DocumentBlock::Text(text) => {
                has_text = true;
                validate_kind(&text.kind)?;
            }
            DocumentBlock::Table(table) => {
                if table.rows.is_empty() || table.column_widths_mm.is_empty() {
                    return Err(EngineError::InvalidTable(
                        "sin filas o columnas".to_string(),
                    ));
                }
                if table
                    .rows
                    .iter()
                    .any(|row| row.cells.len() != table.column_widths_mm.len())
                {
                    return Err(EngineError::InvalidTable(
                        "filas con distinto número de celdas".to_string(),
                    ));
                }
            }
            DocumentBlock::Image(_) => {}
            DocumentBlock::Break(value) => {
                if matches!(value.break_kind, BreakKind::Section) {
                    let Some(next) = value.next_section_id.as_ref() else {
                        return Err(EngineError::NewSectionRequired);
                    };
                    if !document
                        .sections
                        .iter()
                        .any(|section| section.id == next.as_str())
                    {
                        return Err(EngineError::SectionNotFound(next.clone()));
                    }
                }
            }
        }
    }
    if !has_text {
        return Err(EngineError::InvalidSelection);
    }
    Ok(())
}

fn validate_replacement_ids(
    document: &TextDocument,
    replacement: &[DocumentBlock],
    start_index: usize,
    end_index: usize,
) -> Result<(), EngineError> {
    let outside = document
        .blocks
        .iter()
        .enumerate()
        .filter(|(index, _)| *index < start_index || *index > end_index)
        .map(|(_, block)| block.id().to_string())
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    for block in replacement {
        if outside.contains(block.id()) || !seen.insert(block.id().to_string()) {
            return Err(EngineError::DuplicateBlockId(block.id().to_string()));
        }
    }
    Ok(())
}

fn assert_unique_block_id(document: &TextDocument, id: &str) -> Result<(), EngineError> {
    if document.blocks.iter().any(|block| block.id() == id) {
        return Err(EngineError::DuplicateBlockId(id.to_string()));
    }
    Ok(())
}

fn unique_strings(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn set_hyperlink_range(
    document: &mut TextDocument,
    start: &DocumentPoint,
    end: &DocumentPoint,
    hyperlink: Option<Hyperlink>,
) -> Result<(), EngineError> {
    let range = ordered_range(document, start, end)?;
    if range.start_index == range.end_index && range.start.offset == range.end.offset {
        return Ok(());
    }
    for index in range.start_index..=range.end_index {
        let Some(DocumentBlock::Text(block)) = document.blocks.get(index) else {
            continue;
        };
        let length = block_char_len(block);
        let from = if index == range.start_index {
            range.start.offset
        } else {
            0
        };
        let to = if index == range.end_index {
            range.end.offset
        } else {
            length
        };
        if from >= to {
            continue;
        }
        let id = block.id.clone();
        let block = find_text_block_mut(document, &id)?;
        let fallback = style_at_offset(block, from);
        let (before, remainder) = split_runs(&block.runs, from)?;
        let (mut selected, after) = split_runs(&remainder, to - from)?;
        for run in &mut selected {
            run.hyperlink = hyperlink.clone();
        }
        block.runs = normalize_runs(
            &block.id,
            before.into_iter().chain(selected).chain(after).collect(),
            fallback,
            None,
        );
    }
    Ok(())
}

fn set_change_status(
    document: &mut TextDocument,
    change_id: &str,
    status: ReviewChangeStatus,
) -> Result<(), EngineError> {
    let change = document
        .review
        .changes
        .iter_mut()
        .find(|item| item.id == change_id)
        .ok_or_else(|| EngineError::Serialization(format!("cambio '{change_id}' no encontrado")))?;
    if matches!(change.status, ReviewChangeStatus::Pending) {
        change.status = status;
    }
    Ok(())
}

fn reject_change(document: &mut TextDocument, change_id: &str) -> Result<(), EngineError> {
    let pending_indices = document
        .review
        .changes
        .iter()
        .enumerate()
        .filter(|(_, change)| matches!(change.status, ReviewChangeStatus::Pending))
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    let Some(index) = pending_indices
        .iter()
        .copied()
        .find(|index| document.review.changes[*index].id == change_id)
    else {
        return Err(EngineError::Serialization(format!(
            "cambio pendiente '{change_id}' no encontrado"
        )));
    };
    if pending_indices.last().copied() != Some(index) {
        document.review.changes[index].status = ReviewChangeStatus::Conflict;
        return Ok(());
    }
    let Some(snapshot) = document.review.changes[index].before_snapshot.clone() else {
        document.review.changes[index].status = ReviewChangeStatus::Conflict;
        return Ok(());
    };
    let mut restored: TextDocument = serde_json::from_str(&snapshot)
        .map_err(|error| EngineError::Serialization(error.to_string()))?;
    normalize_document(&mut restored);
    let mut review = document.review.clone();
    review.track_changes = false;
    review.changes[index].status = ReviewChangeStatus::Rejected;
    review.changes[index].before_snapshot = None;
    restored.review = review;
    *document = restored;
    Ok(())
}

fn reject_all_changes(document: &mut TextDocument) -> Result<(), EngineError> {
    let Some(first) = document
        .review
        .changes
        .iter()
        .find(|change| {
            matches!(change.status, ReviewChangeStatus::Pending) && change.before_snapshot.is_some()
        })
        .cloned()
    else {
        return Ok(());
    };
    let mut restored: TextDocument =
        serde_json::from_str(first.before_snapshot.as_deref().unwrap_or("{}"))
            .map_err(|error| EngineError::Serialization(error.to_string()))?;
    normalize_document(&mut restored);
    let mut review = document.review.clone();
    review.track_changes = false;
    for change in &mut review.changes {
        if matches!(change.status, ReviewChangeStatus::Pending) {
            change.status = ReviewChangeStatus::Rejected;
            change.before_snapshot = None;
        }
    }
    restored.review = review;
    *document = restored;
    Ok(())
}

fn is_trackable_command(command: &DocumentCommand) -> bool {
    !matches!(
        command,
        DocumentCommand::SetReviewAuthor { .. }
            | DocumentCommand::SetTrackChanges { .. }
            | DocumentCommand::AddComment { .. }
            | DocumentCommand::ReplyComment { .. }
            | DocumentCommand::ResolveComment { .. }
            | DocumentCommand::RemoveComment { .. }
            | DocumentCommand::AddBookmark { .. }
            | DocumentCommand::RemoveBookmark { .. }
            | DocumentCommand::AcceptChange { .. }
            | DocumentCommand::RejectChange { .. }
            | DocumentCommand::AcceptAllChanges
            | DocumentCommand::RejectAllChanges
    )
}

fn create_review_snapshot(document: &TextDocument) -> Result<String, EngineError> {
    let mut snapshot = document.clone();
    for change in &mut snapshot.review.changes {
        change.before_snapshot = None;
    }
    serde_json::to_string(&snapshot).map_err(|error| EngineError::Serialization(error.to_string()))
}

fn create_tracked_change(
    command: &DocumentCommand,
    author: &str,
    before_snapshot: String,
    after_revision: u64,
    now_ms: u64,
) -> TrackedChange {
    TrackedChange {
        id: format!("change-{after_revision}-{now_ms}"),
        kind: command_change_kind(command),
        author: if author.is_empty() {
            "Autor local".to_string()
        } else {
            author.to_string()
        },
        summary: command_summary(command).to_string(),
        command_type: command_name(command).to_string(),
        created_at: now_ms,
        status: ReviewChangeStatus::Pending,
        before_snapshot: Some(before_snapshot),
        after_revision,
    }
}

fn command_change_kind(command: &DocumentCommand) -> ReviewChangeKind {
    match command {
        DocumentCommand::InsertText { .. } => ReviewChangeKind::Insert,
        DocumentCommand::DeleteText { .. } => ReviewChangeKind::Delete,
        DocumentCommand::FormatText { .. }
        | DocumentCommand::FormatDocumentRange { .. }
        | DocumentCommand::SetHyperlink { .. } => ReviewChangeKind::Format,
        DocumentCommand::ReplaceBlockText { .. }
        | DocumentCommand::ReplaceTextRange { .. }
        | DocumentCommand::ReplaceDocumentRange { .. }
        | DocumentCommand::ReplaceRangeWithFragment { .. } => ReviewChangeKind::Replace,
        _ => ReviewChangeKind::Structure,
    }
}

fn command_name(command: &DocumentCommand) -> &'static str {
    match command {
        DocumentCommand::SetTitle { .. } => "setTitle",
        DocumentCommand::ReplaceBlockText { .. } => "replaceBlockText",
        DocumentCommand::ReplaceTextRange { .. } => "replaceTextRange",
        DocumentCommand::ReplaceDocumentRange { .. } => "replaceDocumentRange",
        DocumentCommand::ReplaceRangeWithFragment { .. } => "replaceRangeWithFragment",
        DocumentCommand::InsertText { .. } => "insertText",
        DocumentCommand::DeleteText { .. } => "deleteText",
        DocumentCommand::FormatText { .. } => "formatText",
        DocumentCommand::FormatDocumentRange { .. } => "formatDocumentRange",
        DocumentCommand::SetHyperlink { .. } => "setHyperlink",
        _ => "structure",
    }
}

fn command_summary(command: &DocumentCommand) -> &'static str {
    match command_change_kind(command) {
        ReviewChangeKind::Insert => "Insertó texto",
        ReviewChangeKind::Delete => "Eliminó texto",
        ReviewChangeKind::Replace => "Reemplazó contenido",
        ReviewChangeKind::Format => "Aplicó formato",
        ReviewChangeKind::Structure => "Cambió la estructura documental",
    }
}

fn migrate_json_value(value: &mut Value) {
    let Some(root) = value.as_object_mut() else {
        return;
    };
    if !root.contains_key("pageSettings") {
        root.insert(
            "pageSettings".to_string(),
            serde_json::to_value(PageSettings::default()).unwrap_or(Value::Null),
        );
    }
    if !root.contains_key("resources") {
        root.insert("resources".to_string(), serde_json::json!({ "images": {} }));
    }
    if !root.contains_key("review") {
        root.insert(
            "review".to_string(),
            serde_json::to_value(ReviewState::default()).unwrap_or(Value::Null),
        );
    }
    if !root.contains_key("sections") {
        let page_settings = root.get("pageSettings").cloned().unwrap_or_else(|| {
            serde_json::to_value(PageSettings::default()).unwrap_or(Value::Null)
        });
        root.insert(
            "sections".to_string(),
            serde_json::json!([{
                "id": "section-1",
                "name": "Sección 1",
                "pageSettings": page_settings,
                "columns": SectionColumns::default(),
                "headers": HeaderFooterVariants::default(),
                "footers": HeaderFooterVariants::default(),
                "differentFirstPage": false,
                "differentOddEven": false,
                "pageNumbering": PageNumbering::default()
            }]),
        );
    }
    if let Some(metadata) = root.get_mut("metadata").and_then(Value::as_object_mut) {
        metadata.insert(
            "schemaVersion".to_string(),
            Value::from(CURRENT_SCHEMA_VERSION),
        );
    }
    if let Some(blocks) = root.get_mut("blocks").and_then(Value::as_array_mut) {
        let mut active_section_id = default_section_id();
        for block in blocks {
            let Some(object) = block.as_object_mut() else {
                continue;
            };
            if !object.contains_key("blockType") {
                let block_type = if object.contains_key("breakKind") {
                    "break"
                } else if object.contains_key("rows") {
                    "table"
                } else if object.contains_key("resourceId") {
                    "image"
                } else {
                    "text"
                };
                object.insert("blockType".to_string(), Value::from(block_type));
            }
            object
                .entry("sectionId".to_string())
                .or_insert_with(|| Value::from(active_section_id.clone()));
            let block_type = object
                .get("blockType")
                .and_then(Value::as_str)
                .unwrap_or("text");
            match block_type {
                "text" => {
                    object.entry("list".to_string()).or_insert(Value::Null);
                    object
                        .entry("paragraphStyle".to_string())
                        .or_insert_with(|| {
                            serde_json::to_value(ParagraphStyle::default()).unwrap_or(Value::Null)
                        });
                    if let Some(runs) = object.get_mut("runs").and_then(Value::as_array_mut) {
                        for run in runs {
                            let Some(run_object) = run.as_object_mut() else {
                                continue;
                            };
                            let style = run_object
                                .entry("style".to_string())
                                .or_insert_with(|| serde_json::json!({}));
                            if let Some(style_object) = style.as_object_mut() {
                                let defaults = serde_json::to_value(TextStyle::default())
                                    .unwrap_or_else(|_| serde_json::json!({}));
                                if let Some(default_object) = defaults.as_object() {
                                    for (key, default_value) in default_object {
                                        style_object
                                            .entry(key.clone())
                                            .or_insert_with(|| default_value.clone());
                                    }
                                }
                            }
                        }
                    }
                }
                "table" => {
                    object.entry("style".to_string()).or_insert_with(|| {
                        serde_json::to_value(TableStyle::default()).unwrap_or(Value::Null)
                    });
                }
                "image" => {
                    object
                        .entry("keepWithNext".to_string())
                        .or_insert(Value::Bool(false));
                }
                "break" => {
                    object
                        .entry("startType".to_string())
                        .or_insert(Value::from("next-page"));
                    object
                        .entry("nextSectionId".to_string())
                        .or_insert(Value::Null);
                    if object.get("breakKind").and_then(Value::as_str) == Some("section") {
                        if let Some(next) = object.get("nextSectionId").and_then(Value::as_str) {
                            active_section_id = next.to_string();
                        }
                    }
                }
                _ => {}
            }
        }
    }
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    if !value.is_finite() {
        return min;
    }
    value.max(min).min(max)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(document: &TextDocument, id: &str) -> String {
        block_text(find_text_block(document, id).expect("text block"))
    }

    #[test]
    fn multi_block_format_and_replace_work() {
        let mut engine = OfficeEngine::new_text_document("doc", "Demo", 1);
        engine
            .apply(
                DocumentCommand::ReplaceBlockText {
                    block_id: "block-1".to_string(),
                    text: "Primero".to_string(),
                },
                2,
            )
            .unwrap();
        engine
            .apply(
                DocumentCommand::AddParagraph {
                    after_block_id: Some("block-1".to_string()),
                    block_id: "block-2".to_string(),
                    run_id: "run-2".to_string(),
                    section_id: None,
                },
                3,
            )
            .unwrap();
        engine
            .apply(
                DocumentCommand::ReplaceBlockText {
                    block_id: "block-2".to_string(),
                    text: "Segundo".to_string(),
                },
                4,
            )
            .unwrap();
        engine
            .apply(
                DocumentCommand::FormatDocumentRange {
                    start: DocumentPoint {
                        block_id: "block-1".to_string(),
                        offset: 3,
                    },
                    end: DocumentPoint {
                        block_id: "block-2".to_string(),
                        offset: 4,
                    },
                    style: TextStylePatch {
                        bold: Some(true),
                        ..Default::default()
                    },
                },
                5,
            )
            .unwrap();
        assert!(find_text_block(engine.document(), "block-1")
            .unwrap()
            .runs
            .iter()
            .any(|run| run.style.bold));
        engine
            .apply(
                DocumentCommand::ReplaceDocumentRange {
                    start: DocumentPoint {
                        block_id: "block-1".to_string(),
                        offset: 3,
                    },
                    end: DocumentPoint {
                        block_id: "block-2".to_string(),
                        offset: 4,
                    },
                    text: "X".to_string(),
                    style: None,
                    id_prefix: "replace".to_string(),
                },
                6,
            )
            .unwrap();
        assert_eq!(text(engine.document(), "block-1"), "PriXndo");
    }

    #[test]
    fn manages_sections_headers_and_breaks() {
        let mut engine = OfficeEngine::new_text_document("doc", "Informe", 1);
        engine
            .apply(
                DocumentCommand::SetSectionProperties {
                    section_id: "section-1".to_string(),
                    patch: DocumentSectionPatch {
                        columns: Some(SectionColumnsPatch {
                            count: Some(2),
                            line_between: Some(true),
                            ..Default::default()
                        }),
                        page_numbering: Some(PageNumberingPatch {
                            restart: Some(true),
                            start: Some(3),
                            format: Some(PageNumberFormat::RomanUpper),
                        }),
                        ..Default::default()
                    },
                },
                2,
            )
            .unwrap();
        let mut section = default_section();
        section.id = "section-2".to_string();
        section.name = "Anexo".to_string();
        engine
            .apply(
                DocumentCommand::InsertBreak {
                    after_block_id: "block-1".to_string(),
                    break_block: BreakBlock {
                        block_type: "break".to_string(),
                        id: "break-1".to_string(),
                        section_id: "section-1".to_string(),
                        break_kind: BreakKind::Section,
                        start_type: SectionStartType::NextPage,
                        next_section_id: Some("section-2".to_string()),
                    },
                    new_section: Some(section),
                    paragraph: None,
                },
                3,
            )
            .unwrap();
        assert_eq!(engine.document().sections.len(), 2);
        engine
            .apply(
                DocumentCommand::RemoveBreak {
                    block_id: "break-1".to_string(),
                },
                4,
            )
            .unwrap();
        assert_eq!(engine.document().sections.len(), 1);
    }

    #[test]
    fn migrates_v2_json() {
        let json = r#"{
          "metadata":{"id":"legacy","title":"Legacy","schemaVersion":2,"createdAt":1,"updatedAt":1,"revision":0},
          "pageSettings":{"widthMm":210,"heightMm":297,"marginTopMm":25.4,"marginRightMm":25.4,"marginBottomMm":25.4,"marginLeftMm":25.4},
          "blocks":[{"id":"block-1","kind":{"type":"paragraph"},"paragraphStyle":{"alignment":"left","lineHeight":1.35,"spaceBeforePt":0,"spaceAfterPt":8,"firstLineIndentMm":0},"runs":[{"id":"run-1","text":"Hola","style":{"bold":false,"italic":false,"underline":false}}]}]
        }"#;
        let engine = OfficeEngine::from_json(json).unwrap();
        assert_eq!(
            engine.document().metadata.schema_version,
            CURRENT_SCHEMA_VERSION
        );
        assert!(matches!(
            engine.document().blocks[0],
            DocumentBlock::Text(_)
        ));
    }
}
