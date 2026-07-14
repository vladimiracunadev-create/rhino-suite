interface RhinoMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Silueta de rinoceronte de perfil, compuesta con formas simples y rellena con
 * `currentColor` para que herede el color del contexto (blanco sobre la marca,
 * acento en otros lugares). Es la identidad visual de Rhino Suite.
 */
export function RhinoMark({ size = 28, className, title = "Rhino Suite" }: RhinoMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 44) / 64}
      viewBox="0 0 64 44"
      role="img"
      aria-label={title}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* patas */}
      <rect x="22" y="28" width="6" height="14" rx="2" />
      <rect x="31" y="29" width="6" height="13" rx="2" />
      <rect x="44" y="28" width="6" height="14" rx="2" />
      <rect x="52" y="29" width="6" height="13" rx="2" />
      {/* cuerpo y cabeza */}
      <ellipse cx="37" cy="20" rx="22" ry="12.5" />
      <ellipse cx="13" cy="22" rx="11" ry="9" />
      <ellipse cx="7" cy="25.5" rx="6" ry="5.5" />
      {/* cuerno principal y secundario */}
      <path d="M3.5 23 L7 2.5 L11.5 22 Z" />
      <path d="M13 15 L16 5.5 L19.5 15 Z" />
      {/* oreja */}
      <path d="M20 12 L25.5 10.5 L22 3.5 Z" />
      {/* cola */}
      <path d="M56 15 L63.5 10 L57 21 Z" />
      {/* ojo (perfora la silueta) */}
      <circle cx="10" cy="20.5" r="1.7" fill="#0b1020" opacity="0.55" />
    </svg>
  );
}
