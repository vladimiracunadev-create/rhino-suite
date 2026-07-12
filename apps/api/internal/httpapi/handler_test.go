package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/document"
	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/httpapi"
)

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	store, err := document.NewFileStore(filepath.Join(t.TempDir(), "documents"))
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return httptest.NewServer(httpapi.New(store, logger, "http://localhost:5173"))
}

func TestHealth(t *testing.T) {
	server := newServer(t)
	defer server.Close()
	response, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.StatusCode)
	}
}

func TestDocumentLifecycle(t *testing.T) {
	server := newServer(t)
	defer server.Close()

	payload := map[string]any{
		"title":         "Documento de prueba",
		"kind":          "document",
		"schemaVersion": 2,
		"revision":      0,
		"content":       map[string]any{"blocks": []any{}},
	}
	body, _ := json.Marshal(payload)
	response, err := http.Post(server.URL+"/api/v1/documents", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 201, got %d: %s", response.StatusCode, data)
	}
	var created document.Record
	if err := json.NewDecoder(response.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}

	request, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, server.URL+"/api/v1/documents/"+created.ID, nil)
	getResponse, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer getResponse.Body.Close()
	if getResponse.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", getResponse.StatusCode)
	}
}
