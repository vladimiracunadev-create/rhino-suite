package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/your-user/web-office-suite-evolution/apps/api/internal/document"
)

const maxBodyBytes = 10 << 20

type Handler struct {
	store     document.Store
	logger    *slog.Logger
	webOrigin string
}

func New(store document.Store, logger *slog.Logger, webOrigin string) http.Handler {
	handler := &Handler{store: store, logger: logger, webOrigin: webOrigin}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.health)
	mux.HandleFunc("GET /api/v1/documents", handler.listDocuments)
	mux.HandleFunc("POST /api/v1/documents", handler.createDocument)
	mux.HandleFunc("GET /api/v1/documents/{id}", handler.getDocument)
	mux.HandleFunc("PUT /api/v1/documents/{id}", handler.updateDocument)
	mux.HandleFunc("DELETE /api/v1/documents/{id}", handler.deleteDocument)
	return handler.recover(handler.cors(handler.logging(mux)))
}

func (handler *Handler) health(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "web-office-api",
		"time":    time.Now().UTC(),
	})
}

func (handler *Handler) listDocuments(writer http.ResponseWriter, request *http.Request) {
	records, err := handler.store.List(request.Context())
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"items": records})
}

func (handler *Handler) createDocument(writer http.ResponseWriter, request *http.Request) {
	var input document.Record
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	now := time.Now().UTC()
	if strings.TrimSpace(input.ID) == "" {
		input.ID = newID()
	}
	input.CreatedAt = now
	input.UpdatedAt = now
	if err := handler.store.Put(request.Context(), input); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writer.Header().Set("Location", "/api/v1/documents/"+input.ID)
	writeJSON(writer, http.StatusCreated, input)
}

func (handler *Handler) getDocument(writer http.ResponseWriter, request *http.Request) {
	record, err := handler.store.Get(request.Context(), request.PathValue("id"))
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Documento no encontrado.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, record)
}

func (handler *Handler) updateDocument(writer http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	existing, err := handler.store.Get(request.Context(), id)
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Documento no encontrado.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	var input document.Record
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	input.ID = id
	input.CreatedAt = existing.CreatedAt
	input.UpdatedAt = time.Now().UTC()
	if input.Revision <= existing.Revision {
		writeProblem(writer, http.StatusConflict, "La revisión debe ser mayor que la almacenada.")
		return
	}
	if err := handler.store.Put(request.Context(), input); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, input)
}

func (handler *Handler) deleteDocument(writer http.ResponseWriter, request *http.Request) {
	err := handler.store.Delete(request.Context(), request.PathValue("id"))
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Documento no encontrado.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", handler.webOrigin)
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		writer.Header().Set("Vary", "Origin")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func (handler *Handler) logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		next.ServeHTTP(writer, request)
		handler.logger.Info("http request", "method", request.Method, "path", request.URL.Path, "duration", time.Since(started))
	})
}

func (handler *Handler) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				handler.logger.Error("panic recovered", "value", recovered)
				writeProblem(writer, http.StatusInternalServerError, "Error interno del servidor.")
			}
		}()
		next.ServeHTTP(writer, request)
	})
}

func (handler *Handler) internalError(writer http.ResponseWriter, request *http.Request, err error) {
	handler.logger.Error("request failed", "path", request.URL.Path, "error", err)
	writeProblem(writer, http.StatusInternalServerError, "Error interno del servidor.")
}

func decodeJSON(writer http.ResponseWriter, request *http.Request, destination any) error {
	request.Body = http.MaxBytesReader(writer, request.Body, maxBodyBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("JSON inválido: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("el cuerpo debe contener un único objeto JSON")
	}
	return nil
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeProblem(writer http.ResponseWriter, status int, detail string) {
	writeJSON(writer, status, map[string]any{
		"type":   "about:blank",
		"status": status,
		"detail": detail,
	})
}

func newID() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("doc-%d", time.Now().UnixNano())
	}
	return "doc-" + hex.EncodeToString(buffer)
}
