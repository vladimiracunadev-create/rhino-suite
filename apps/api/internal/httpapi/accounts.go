package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/auth"
)

const sessionCookie = "rhino_session"

// minPasswordLength: la longitud es lo que más protege una contraseña, así que
// se exige largo en vez de reglas de símbolos que solo generan "P@ssw0rd!".
const minPasswordLength = 10

type contextKey string

const userKey contextKey = "rhino.user"

// userFrom devuelve el usuario de la petición. Solo hay usuario si el
// middleware lo puso, así que un handler protegido puede confiar en él.
func userFrom(request *http.Request) (auth.User, bool) {
	user, ok := request.Context().Value(userKey).(auth.User)
	return user, ok
}

func (handler *Handler) setSessionCookie(writer http.ResponseWriter, request *http.Request, token string) {
	http.SetCookie(writer, &http.Cookie{
		Name:  sessionCookie,
		Value: token,
		Path:  "/",
		// HttpOnly: el token no debe ser legible desde JavaScript, para que un
		// script inyectado no pueda llevárselo.
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		// Secure solo si se sirve por HTTPS: en http://localhost una cookie
		// Secure no llegaría nunca y no se podría entrar.
		Secure: request.TLS != nil,
		MaxAge: int(auth.SessionLifetime.Seconds()),
	})
}

func (handler *Handler) clearSessionCookie(writer http.ResponseWriter, request *http.Request) {
	http.SetCookie(writer, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   request.TLS != nil,
		MaxAge:   -1,
	})
}

func sessionToken(request *http.Request) string {
	cookie, err := request.Cookie(sessionCookie)
	if err != nil {
		return ""
	}
	return cookie.Value
}

// requireUser protege los endpoints: sin sesión válida no se pasa. Es la única
// puerta, de modo que ningún handler tiene que acordarse de comprobarlo.
func (handler *Handler) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		user, err := handler.accounts.SessionUser(request.Context(), sessionToken(request))
		if err != nil {
			writeProblem(writer, http.StatusUnauthorized, "Hay que iniciar sesión.")
			return
		}
		next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), userKey, user)))
	})
}

type credentials struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

func (handler *Handler) register(writer http.ResponseWriter, request *http.Request) {
	var input credentials
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	email := auth.NormalizeEmail(input.Email)
	if !auth.ValidEmail(email) {
		writeProblem(writer, http.StatusBadRequest, "El correo no tiene una forma válida.")
		return
	}
	if len([]rune(input.Password)) < minPasswordLength {
		writeProblem(writer, http.StatusBadRequest, "La contraseña debe tener al menos 10 caracteres.")
		return
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = email
	}

	// ¿Es la primera cuenta? Se mira antes de crearla.
	count, err := handler.accounts.CountUsers(request.Context())
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}

	user, err := handler.accounts.CreateUser(request.Context(), email, name, input.Password)
	if errors.Is(err, auth.ErrEmailTaken) {
		writeProblem(writer, http.StatusConflict, "Ya hay una cuenta con ese correo.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}

	// Los documentos y carpetas que existían antes de que hubiera cuentas se
	// quedarían sin dueño y, por tanto, invisibles. La primera cuenta los
	// adopta; a partir de ahí, nadie más puede reclamarlos.
	if count == 0 {
		if err := handler.claimOrphans(request.Context(), user.ID); err != nil {
			handler.logger.Error("no se pudieron adoptar los documentos previos", "error", err)
		}
	}

	token, _, err := handler.accounts.StartSession(request.Context(), user.ID)
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	handler.setSessionCookie(writer, request, token)
	writeJSON(writer, http.StatusCreated, user.Public())
}

func (handler *Handler) login(writer http.ResponseWriter, request *http.Request) {
	var input credentials
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	user, err := handler.accounts.Authenticate(request.Context(), input.Email, input.Password)
	if errors.Is(err, auth.ErrCredentials) {
		// No se distingue "no existe" de "contraseña mala": decirlo permitiría
		// averiguar qué correos tienen cuenta.
		writeProblem(writer, http.StatusUnauthorized, "El correo o la contraseña no son correctos.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	token, _, err := handler.accounts.StartSession(request.Context(), user.ID)
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	handler.setSessionCookie(writer, request, token)
	writeJSON(writer, http.StatusOK, user.Public())
}

func (handler *Handler) logout(writer http.ResponseWriter, request *http.Request) {
	if err := handler.accounts.EndSession(request.Context(), sessionToken(request)); err != nil {
		handler.internalError(writer, request, err)
		return
	}
	handler.clearSessionCookie(writer, request)
	writer.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) currentUser(writer http.ResponseWriter, request *http.Request) {
	user, ok := userFrom(request)
	if !ok {
		writeProblem(writer, http.StatusUnauthorized, "Hay que iniciar sesión.")
		return
	}
	writeJSON(writer, http.StatusOK, user.Public())
}
