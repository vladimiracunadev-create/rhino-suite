package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/http/cookiejar"
	"path/filepath"
	"testing"

	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/auth"
	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/document"
	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/httpapi"
)

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	directory := t.TempDir()
	store, err := document.NewFileStore(filepath.Join(directory, "documents"))
	if err != nil {
		t.Fatal(err)
	}
	accounts, err := auth.NewFileStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return httptest.NewServer(httpapi.New(store, accounts, logger, "http://localhost:5173"))
}

// newClient devuelve un cliente que conserva la cookie de sesión, como haría
// un navegador.
func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Client{Jar: jar}
}

func postJSON(t *testing.T, client *http.Client, url string, payload any) *http.Response {
	t.Helper()
	body, _ := json.Marshal(payload)
	response, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	return response
}

// signUp crea una cuenta y deja al cliente con la sesión abierta.
func signUp(t *testing.T, server *httptest.Server, client *http.Client, email string) {
	t.Helper()
	response := postJSON(t, client, server.URL+"/api/v1/auth/register", map[string]any{
		"email": email, "name": "Prueba", "password": "contraseña larga",
	})
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("no se pudo registrar: %d %s", response.StatusCode, data)
	}
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

func TestSinSesionNoSeLlegaALosDocumentos(t *testing.T) {
	server := newServer(t)
	defer server.Close()
	response, err := http.Get(server.URL + "/api/v1/documents")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("sin sesión debería dar 401, dio %d", response.StatusCode)
	}
}

func TestDocumentLifecycle(t *testing.T) {
	server := newServer(t)
	defer server.Close()
	client := newClient(t)
	signUp(t, server, client, "ana@ejemplo.com")

	response := postJSON(t, client, server.URL+"/api/v1/documents", map[string]any{
		"title":         "Documento de prueba",
		"kind":          "document",
		"schemaVersion": 2,
		"revision":      0,
		"content":       map[string]any{"blocks": []any{}},
	})
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 201, got %d: %s", response.StatusCode, data)
	}
	var created document.Record
	if err := json.NewDecoder(response.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	if created.OwnerID == "" {
		t.Fatal("un documento nuevo debe quedar a nombre de quien lo crea")
	}

	getResponse, err := client.Get(server.URL + "/api/v1/documents/" + created.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer getResponse.Body.Close()
	if getResponse.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", getResponse.StatusCode)
	}
}

// Lo esencial de tener cuentas: que lo de uno no se vea desde la de otro.
func TestUnUsuarioNoVeLosDocumentosDeOtro(t *testing.T) {
	server := newServer(t)
	defer server.Close()

	ana := newClient(t)
	signUp(t, server, ana, "ana@ejemplo.com")
	response := postJSON(t, ana, server.URL+"/api/v1/documents", map[string]any{
		"title": "Privado de Ana", "kind": "document", "schemaVersion": 5, "revision": 0,
		"content": map[string]any{"blocks": []any{}},
	})
	var deAna document.Record
	json.NewDecoder(response.Body).Decode(&deAna)
	response.Body.Close()

	beto := newClient(t)
	signUp(t, server, beto, "beto@ejemplo.com")

	listado, err := beto.Get(server.URL + "/api/v1/documents")
	if err != nil {
		t.Fatal(err)
	}
	defer listado.Body.Close()
	var payload struct {
		Items []document.Summary `json:"items"`
	}
	json.NewDecoder(listado.Body).Decode(&payload)
	if len(payload.Items) != 0 {
		t.Fatalf("Beto no debería ver nada, ve %d documentos", len(payload.Items))
	}

	directo, err := beto.Get(server.URL + "/api/v1/documents/" + deAna.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer directo.Body.Close()
	if directo.StatusCode != http.StatusNotFound {
		t.Fatalf("pedirlo directamente debería dar 404, dio %d", directo.StatusCode)
	}
}

func TestCompartirDaAccesoYElPermisoSeRespeta(t *testing.T) {
	server := newServer(t)
	defer server.Close()

	ana := newClient(t)
	signUp(t, server, ana, "ana@ejemplo.com")
	beto := newClient(t)
	signUp(t, server, beto, "beto@ejemplo.com")

	response := postJSON(t, ana, server.URL+"/api/v1/documents", map[string]any{
		"title": "Compartido", "kind": "document", "schemaVersion": 5, "revision": 0,
		"content": map[string]any{"blocks": []any{}},
	})
	var doc document.Record
	json.NewDecoder(response.Body).Decode(&doc)
	response.Body.Close()

	compartir := postJSON(t, ana, server.URL+"/api/v1/documents/"+doc.ID+"/share", map[string]any{
		"email": "beto@ejemplo.com", "role": "viewer",
	})
	if compartir.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(compartir.Body)
		t.Fatalf("compartir debería dar 200, dio %d: %s", compartir.StatusCode, data)
	}
	compartir.Body.Close()

	// Beto ya lo ve...
	lectura, _ := beto.Get(server.URL + "/api/v1/documents/" + doc.ID)
	defer lectura.Body.Close()
	if lectura.StatusCode != http.StatusOK {
		t.Fatalf("Beto debería poder leerlo, dio %d", lectura.StatusCode)
	}

	// ...pero como lector no puede escribirlo.
	escritura := postJSON(t, beto, server.URL+"/api/v1/documents/"+doc.ID+"/star", map[string]any{"starred": true})
	defer escritura.Body.Close()
	if escritura.StatusCode != http.StatusForbidden {
		t.Fatalf("un lector no debería poder modificarlo, dio %d", escritura.StatusCode)
	}

	// Y no puede repartir acceso de un documento que no es suyo.
	reparto := postJSON(t, beto, server.URL+"/api/v1/documents/"+doc.ID+"/share", map[string]any{
		"email": "ana@ejemplo.com", "role": "editor",
	})
	defer reparto.Body.Close()
	if reparto.StatusCode != http.StatusForbidden {
		t.Fatalf("quien recibe no puede compartir, dio %d", reparto.StatusCode)
	}
}

func TestLaPrimeraCuentaAdoptaLoQueNoTeniaDueno(t *testing.T) {
	directory := t.TempDir()
	store, err := document.NewFileStore(filepath.Join(directory, "documents"))
	if err != nil {
		t.Fatal(err)
	}
	// Un documento de antes de que existieran las cuentas: sin dueño.
	if err := store.Put(context.Background(), document.Record{
		ID: "doc-viejo", Title: "Heredado", Kind: "document", Schema: 5,
		Content: json.RawMessage(`{"blocks":[]}`),
	}); err != nil {
		t.Fatal(err)
	}
	accounts, err := auth.NewFileStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(httpapi.New(store, accounts, slog.New(slog.NewTextHandler(io.Discard, nil)), "*"))
	defer server.Close()

	ana := newClient(t)
	signUp(t, server, ana, "ana@ejemplo.com")

	listado, _ := ana.Get(server.URL + "/api/v1/documents")
	defer listado.Body.Close()
	var payload struct {
		Items []document.Summary `json:"items"`
	}
	json.NewDecoder(listado.Body).Decode(&payload)
	if len(payload.Items) != 1 {
		t.Fatalf("la primera cuenta debería adoptar el documento previo, ve %d", len(payload.Items))
	}

	// La segunda cuenta ya no adopta nada.
	beto := newClient(t)
	signUp(t, server, beto, "beto@ejemplo.com")
	listado2, _ := beto.Get(server.URL + "/api/v1/documents")
	defer listado2.Body.Close()
	var payload2 struct {
		Items []document.Summary `json:"items"`
	}
	json.NewDecoder(listado2.Body).Decode(&payload2)
	if len(payload2.Items) != 0 {
		t.Fatalf("la segunda cuenta no debe heredar nada, ve %d", len(payload2.Items))
	}
}
