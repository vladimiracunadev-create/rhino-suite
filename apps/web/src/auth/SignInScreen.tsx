import { useState, type ChangeEvent, type FormEvent } from "react";
import { login, register, type Account } from "@web-office/engine-client";
import { RhinoMark } from "../branding/RhinoMark";
import { useSettings } from "../settings/SettingsContext";

const MIN_PASSWORD = 10;

/** Pantalla de entrada: crear cuenta o iniciar sesión. */
export function SignInScreen({ onSignedIn }: { onSignedIn: (account: Account) => void }) {
  const { t } = useSettings();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = mode === "register" && password.length > 0 && password.length < MIN_PASSWORD;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const account = mode === "register"
        ? await register(email, name, password)
        : await login(email, password);
      onSignedIn(account);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("signInFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit}>
        <div className="signin-brand">
          <span className="signin-mark"><RhinoMark size={34} /></span>
          <div>
            <strong>Rhino Suite</strong>
            <small>{t("signInSubtitle")}</small>
          </div>
        </div>

        <div className="signin-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "on" : ""}
            onClick={() => { setMode("login"); setError(null); }}
          >{t("signIn")}</button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "on" : ""}
            onClick={() => { setMode("register"); setError(null); }}
          >{t("createAccount")}</button>
        </div>

        <label className="signin-field">
          <span>{t("email")}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </label>

        {mode === "register" ? (
          <label className="signin-field">
            <span>{t("nameLabel")}</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
              placeholder={t("nameOptional")}
            />
          </label>
        ) : null}

        <label className="signin-field">
          <span>{t("password")}</span>
          <input
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={mode === "register" ? MIN_PASSWORD : undefined}
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
          />
          {mode === "register" ? (
            <small className={tooShort ? "warn" : ""}>{t("passwordHint", { n: MIN_PASSWORD })}</small>
          ) : null}
        </label>

        {error ? <p className="signin-error" role="alert">{error}</p> : null}

        <button type="submit" className="signin-submit" disabled={busy}>
          {busy ? "…" : mode === "register" ? t("createAccount") : t("signIn")}
        </button>

        <p className="signin-foot">{t("signInFoot")}</p>
      </form>
    </div>
  );
}
