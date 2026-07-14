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
	"strconv"
	"strings"
	"time"

	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/document"
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
	mux.HandleFunc("POST /api/v1/documents/{id}/move", handler.moveDocument)
	mux.HandleFunc("POST /api/v1/documents/{id}/star", handler.starDocument)
	mux.HandleFunc("POST /api/v1/documents/{id}/trash", handler.trashDocument)
	mux.HandleFunc("POST /api/v1/documents/{id}/restore", handler.restoreDocument)
	mux.HandleFunc("GET /api/v1/documents/{id}/versions", handler.listVersions)
	mux.HandleFunc("GET /api/v1/documents/{id}/versions/{revision}", handler.getVersion)
	mux.HandleFunc("POST /api/v1/documents/{id}/versions/{revision}/restore", handler.restoreVersion)
	mux.HandleFunc("GET /api/v1/folders", handler.listFolders)
	mux.HandleFunc("POST /api/v1/folders", handler.createFolder)
	mux.HandleFunc("PUT /api/v1/folders/{id}", handler.updateFolder)
	mux.HandleFunc("DELETE /api/v1/folders/{id}", handler.deleteFolder)
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
	// Sin contenido: el catálogo se pinta con el extracto y el conteo guardados.
	// El documento completo se pide al abrirlo.
	summaries := make([]document.Summary, 0, len(records))
	for _, record := range records {
		summaries = append(summaries, record.Summary())
	}
	writeJSON(writer, http.StatusOK, map[string]any{"items": summaries})
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
	// Si el documento ya existe, su organización (carpeta, destacado, papelera)
	// se conserva: solo la cambian los endpoints de acción.
	if existing, err := handler.store.Get(request.Context(), input.ID); err == nil {
		input.CreatedAt = existing.CreatedAt
		input.FolderID = existing.FolderID
		input.Starred = existing.Starred
		input.TrashedAt = existing.TrashedAt
	} else {
		input.CreatedAt = now
	}
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
	input.FolderID = existing.FolderID
	input.Starred = existing.Starred
	input.TrashedAt = existing.TrashedAt
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

// ── Acciones de organización ────────────────────────────────────────────────
// Cambian solo metadatos, así que no exigen elevar la revisión del documento.

func (handler *Handler) loadDocument(writer http.ResponseWriter, request *http.Request) (document.Record, bool) {
	record, err := handler.store.Get(request.Context(), request.PathValue("id"))
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Documento no encontrado.")
		return document.Record{}, false
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return document.Record{}, false
	}
	return record, true
}

// saveDocument persiste cambios de organización. No toca UpdatedAt: esa fecha
// es cuándo se modificó el documento, y destacarlo o moverlo no lo modifica.
func (handler *Handler) saveDocument(writer http.ResponseWriter, request *http.Request, record document.Record) {
	if err := handler.store.Put(request.Context(), record); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, record)
}

func (handler *Handler) moveDocument(writer http.ResponseWriter, request *http.Request) {
	record, ok := handler.loadDocument(writer, request)
	if !ok {
		return
	}
	var input struct {
		FolderID string `json:"folderId"`
	}
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	if input.FolderID != document.Root {
		if _, err := handler.store.GetFolder(request.Context(), input.FolderID); err != nil {
			writeProblem(writer, http.StatusNotFound, "La carpeta de destino no existe.")
			return
		}
	}
	record.FolderID = input.FolderID
	handler.saveDocument(writer, request, record)
}

func (handler *Handler) starDocument(writer http.ResponseWriter, request *http.Request) {
	record, ok := handler.loadDocument(writer, request)
	if !ok {
		return
	}
	var input struct {
		Starred bool `json:"starred"`
	}
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	record.Starred = input.Starred
	handler.saveDocument(writer, request, record)
}

func (handler *Handler) trashDocument(writer http.ResponseWriter, request *http.Request) {
	record, ok := handler.loadDocument(writer, request)
	if !ok {
		return
	}
	now := time.Now().UTC()
	record.TrashedAt = &now
	handler.saveDocument(writer, request, record)
}

func (handler *Handler) restoreDocument(writer http.ResponseWriter, request *http.Request) {
	record, ok := handler.loadDocument(writer, request)
	if !ok {
		return
	}
	record.TrashedAt = nil
	handler.saveDocument(writer, request, record)
}

// ── Historial de versiones ──────────────────────────────────────────────────

func (handler *Handler) listVersions(writer http.ResponseWriter, request *http.Request) {
	versions, err := handler.store.ListVersions(request.Context(), request.PathValue("id"))
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	summaries := make([]document.VersionSummary, 0, len(versions))
	for _, version := range versions {
		summaries = append(summaries, version.Summary())
	}
	writeJSON(writer, http.StatusOK, map[string]any{"items": summaries})
}

func parseRevision(value string) (int64, error) {
	return strconv.ParseInt(value, 10, 64)
}

func (handler *Handler) getVersion(writer http.ResponseWriter, request *http.Request) {
	revision, err := parseRevision(request.PathValue("revision"))
	if err != nil {
		writeProblem(writer, http.StatusBadRequest, "La revisión debe ser un número.")
		return
	}
	version, err := handler.store.GetVersion(request.Context(), request.PathValue("id"), revision)
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Esa versión no existe.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, version)
}

// restoreVersion vuelve a poner el contenido de una versión anterior como el
// actual. No borra nada: se guarda como una revisión nueva, de modo que
// restaurar también queda en el historial y se puede deshacer.
func (handler *Handler) restoreVersion(writer http.ResponseWriter, request *http.Request) {
	revision, err := parseRevision(request.PathValue("revision"))
	if err != nil {
		writeProblem(writer, http.StatusBadRequest, "La revisión debe ser un número.")
		return
	}
	record, ok := handler.loadDocument(writer, request)
	if !ok {
		return
	}
	version, err := handler.store.GetVersion(request.Context(), record.ID, revision)
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Esa versión no existe.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}

	record.Title = version.Title
	record.Revision = record.Revision + 1
	record.UpdatedAt = time.Now().UTC()
	// El documento lleva su revisión dentro: se reescribe para que el registro y
	// su contenido no digan cosas distintas.
	record.Content = document.WithRevision(version.Content, record.Revision, record.UpdatedAt)
	if err := handler.store.Put(request.Context(), record); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, record)
}

// ── Carpetas ────────────────────────────────────────────────────────────────

func (handler *Handler) listFolders(writer http.ResponseWriter, request *http.Request) {
	folders, err := handler.store.ListFolders(request.Context())
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"items": folders})
}

func (handler *Handler) createFolder(writer http.ResponseWriter, request *http.Request) {
	var input document.Folder
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(input.ID) == "" {
		input.ID = "folder-" + randomHex()
	}
	if input.ParentID != document.Root {
		if _, err := handler.store.GetFolder(request.Context(), input.ParentID); err != nil {
			writeProblem(writer, http.StatusNotFound, "La carpeta padre no existe.")
			return
		}
	}
	now := time.Now().UTC()
	input.CreatedAt = now
	input.UpdatedAt = now
	if err := handler.store.PutFolder(request.Context(), input); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writer.Header().Set("Location", "/api/v1/folders/"+input.ID)
	writeJSON(writer, http.StatusCreated, input)
}

func (handler *Handler) updateFolder(writer http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	existing, err := handler.store.GetFolder(request.Context(), id)
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Carpeta no encontrada.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	var input document.Folder
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	input.ID = id
	input.CreatedAt = existing.CreatedAt
	input.UpdatedAt = time.Now().UTC()
	if input.ParentID != document.Root {
		if input.ParentID == id {
			writeProblem(writer, http.StatusUnprocessableEntity, "Una carpeta no puede contenerse a sí misma.")
			return
		}
		if _, err := handler.store.GetFolder(request.Context(), input.ParentID); err != nil {
			writeProblem(writer, http.StatusNotFound, "La carpeta padre no existe.")
			return
		}
	}
	if err := handler.store.PutFolder(request.Context(), input); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, input)
}

// deleteFolder elimina la carpeta sin perder contenido: los documentos que
// contenía vuelven a la raíz y sus subcarpetas suben a la carpeta padre.
func (handler *Handler) deleteFolder(writer http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	folder, err := handler.store.GetFolder(request.Context(), id)
	if errors.Is(err, document.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "Carpeta no encontrada.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}

	records, err := handler.store.List(request.Context())
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	for _, record := range records {
		if record.FolderID != id {
			continue
		}
		// Cambiar de carpeta no modifica el documento: UpdatedAt no se toca.
		record.FolderID = document.Root
		if err := handler.store.Put(request.Context(), record); err != nil {
			handler.internalError(writer, request, err)
			return
		}
	}

	children, err := handler.store.ListFolders(request.Context())
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	for _, child := range children {
		if child.ParentID != id {
			continue
		}
		child.ParentID = folder.ParentID
		child.UpdatedAt = time.Now().UTC()
		if err := handler.store.PutFolder(request.Context(), child); err != nil {
			handler.internalError(writer, request, err)
			return
		}
	}

	if err := handler.store.DeleteFolder(request.Context(), id); err != nil {
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
	return "doc-" + randomHex()
}

func randomHex() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buffer)
}
