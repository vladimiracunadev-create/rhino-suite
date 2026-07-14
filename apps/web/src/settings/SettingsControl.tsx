import { useEffect, useRef, useState } from "react";
import { useSettings, type Lang, type Theme } from "./SettingsContext";

const langs: { value: Lang; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

/** Panel de configuración flotante en la esquina inferior derecha. */
export function SettingsControl() {
  const { lang, theme, setLang, setTheme, t } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: t("light"), icon: "☀" },
    { value: "dark", label: t("dark"), icon: "☾" },
    { value: "auto", label: t("auto"), icon: "◐" },
  ];

  return (
    <div className="settings-fab" ref={rootRef}>
      {open ? (
        <div className="settings-panel" role="dialog" aria-label={t("settings")}>
          <p className="settings-title">{t("settings")}</p>

          <div className="settings-group">
            <span className="settings-label">{t("language")}</span>
            <div className="settings-seg">
              {langs.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={lang === option.value ? "on" : ""}
                  onClick={() => setLang(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-group">
            <span className="settings-label">{t("visualMode")}</span>
            <div className="settings-seg">
              {themes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={theme === option.value ? "on" : ""}
                  onClick={() => setTheme(option.value)}
                >
                  <span aria-hidden>{option.icon}</span> {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="settings-btn"
        aria-label={t("settings")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="settings-gear" aria-hidden>⚙</span>
      </button>
    </div>
  );
}
