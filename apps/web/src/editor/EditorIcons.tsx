import type { ReactNode } from "react";

/**
 * Set de iconos del editor. Todos comparten rejilla 24×24, trazo de 1.8 y
 * `currentColor`, de modo que heredan el color del botón y se ven como una
 * familia coherente en lugar de una mezcla de glifos unicode.
 */
function Icon({ children, size = 17 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const UndoIcon = () => (
  <Icon><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Icon>
);
export const RedoIcon = () => (
  <Icon><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></Icon>
);
export const SaveIcon = () => (
  <Icon>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8" /><path d="M7 3v5h7" />
  </Icon>
);

export const AlignLeftIcon = () => <Icon><path d="M4 6h16M4 12h10M4 18h13" /></Icon>;
export const AlignCenterIcon = () => <Icon><path d="M4 6h16M7 12h10M5 18h14" /></Icon>;
export const AlignRightIcon = () => <Icon><path d="M4 6h16M10 12h10M7 18h13" /></Icon>;
export const AlignJustifyIcon = () => <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;

export const BulletListIcon = () => (
  <Icon>
    <circle cx="4.5" cy="7" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="17" r="1.15" fill="currentColor" stroke="none" />
    <path d="M9 7h11M9 12h11M9 17h11" />
  </Icon>
);
export const NumberListIcon = () => (
  <Icon>
    <text x="1.5" y="9.2" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">1</text>
    <text x="1.5" y="14.6" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">2</text>
    <text x="1.5" y="20" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">3</text>
    <path d="M9 7h11M9 12.4h11M9 17.8h11" />
  </Icon>
);

export const TableIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9.5 4v16M15.5 4v16" />
  </Icon>
);
export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.7" />
    <path d="m20.5 16.5-4.5-4.5L6 21.5" />
  </Icon>
);

export const PageBreakIcon = () => (
  <Icon>
    <path d="M5 9V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4" />
    <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
    <path d="M2.5 12h19" strokeDasharray="3 2.4" />
  </Icon>
);
export const ColumnBreakIcon = () => (
  <Icon>
    <rect x="3" y="4" width="7" height="16" rx="1" />
    <rect x="14" y="4" width="7" height="16" rx="1" />
    <path d="M12 3v18" strokeDasharray="2.5 2.2" />
  </Icon>
);
export const SectionBreakIcon = () => (
  <Icon>
    <path d="M4 5h16M4 8.6h10" />
    <path d="M4 15.4h10M4 19h16" />
    <path d="M2.5 12h19" strokeDasharray="3 2.4" />
  </Icon>
);
export const LayoutIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M9.5 9.5V20" />
  </Icon>
);

export const TrackChangesIcon = () => (
  <Icon><path d="M12 20h9" /><path d="M16.6 3.4a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z" /></Icon>
);
export const CommentIcon = () => (
  <Icon><path d="M21 14.5a2 2 0 0 1-2 2H8l-5 4v-16a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></Icon>
);
export const LinkIcon = () => (
  <Icon>
    <path d="M10.5 13.5a4.5 4.5 0 0 0 6.7.5l2.5-2.5a4.7 4.7 0 0 0-6.6-6.6l-1.4 1.4" />
    <path d="M13.5 10.5a4.5 4.5 0 0 0-6.7-.5L4.3 12.5a4.7 4.7 0 0 0 6.6 6.6l1.4-1.4" />
  </Icon>
);
export const BookmarkIcon = () => (
  <Icon><path d="m19 21-7-4.8L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /></Icon>
);
export const ReviewIcon = () => (
  <Icon><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></Icon>
);

export const ZoomOutIcon = () => (
  <Icon><circle cx="10.5" cy="10.5" r="6.8" /><path d="m20.5 20.5-4.8-4.8M7.5 10.5h6" /></Icon>
);
export const ZoomInIcon = () => (
  <Icon><circle cx="10.5" cy="10.5" r="6.8" /><path d="m20.5 20.5-4.8-4.8M7.5 10.5h6M10.5 7.5v6" /></Icon>
);
export const PrintIcon = () => (
  <Icon>
    <path d="M6.5 9V3.5h11V9" />
    <path d="M6.5 17.5h-2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="6.5" y="14" width="11" height="6.5" rx="1" />
  </Icon>
);
export const DownloadIcon = () => (
  <Icon><path d="M12 3.5v11" /><path d="m7.5 10 4.5 4.5L16.5 10" /><path d="M4.5 20.5h15" /></Icon>
);
export const OpenIcon = () => (
  <Icon><path d="M12 14.5v-11" /><path d="M7.5 8 12 3.5 16.5 8" /><path d="M4.5 20.5h15" /></Icon>
);
export const InspectorIcon = () => (
  <Icon>
    <path d="M8.5 4h-1a2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2 2 2 0 0 1 2 2V18a2 2 0 0 0 2 2h1" />
    <path d="M15.5 4h1a2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2 2 2 0 0 0-2 2V18a2 2 0 0 1-2 2h-1" />
  </Icon>
);
