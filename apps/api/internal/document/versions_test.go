package document

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"
	"time"
)

func nuevoStore(t *testing.T) *FileStore {
	t.Helper()
	store, err := NewFileStore(filepath.Join(t.TempDir(), "documents"))
	if err != nil {
		t.Fatalf("no se pudo crear el almacén: %v", err)
	}
	return store
}

func registro(revision int64, texto string) Record {
	return Record{
		ID:        "doc-1",
		Title:     "Documento",
		Kind:      "document",
		Schema:    5,
		Revision:  revision,
		UpdatedAt: time.Now().UTC(),
		Content:   json.RawMessage(fmt.Sprintf(`{"blocks":[{"blockType":"text","runs":[{"text":%q}]}]}`, texto)),
	}
}

func TestGuardarArchivaCadaRevision(t *testing.T) {
	store := nuevoStore(t)
	ctx := context.Background()

	for revision := int64(1); revision <= 3; revision++ {
		if err := store.Put(ctx, registro(revision, fmt.Sprintf("version %d", revision))); err != nil {
			t.Fatalf("no se pudo guardar la revisión %d: %v", revision, err)
		}
	}

	versions, err := store.ListVersions(ctx, "doc-1")
	if err != nil {
		t.Fatalf("no se pudo listar el historial: %v", err)
	}
	if len(versions) != 3 {
		t.Fatalf("se esperaban 3 versiones, hay %d", len(versions))
	}
	// La más reciente va primero.
	if versions[0].Revision != 3 {
		t.Fatalf("la primera versión debería ser la 3, es la %d", versions[0].Revision)
	}
	if versions[0].Content != nil {
		t.Fatal("el listado del historial no debe arrastrar contenido")
	}

	old, err := store.GetVersion(ctx, "doc-1", 1)
	if err != nil {
		t.Fatalf("no se pudo leer una versión: %v", err)
	}
	if string(old.Content) == "" {
		t.Fatal("una versión concreta sí debe traer su contenido")
	}
	if old.WordCount != 2 {
		t.Fatalf("conteo inesperado en la versión: %d", old.WordCount)
	}
}

func TestElHistorialSePodaAlLimite(t *testing.T) {
	store := nuevoStore(t)
	ctx := context.Background()

	total := MaxVersions + 5
	for revision := int64(1); revision <= int64(total); revision++ {
		if err := store.Put(ctx, registro(revision, "texto")); err != nil {
			t.Fatalf("no se pudo guardar: %v", err)
		}
	}

	versions, err := store.ListVersions(ctx, "doc-1")
	if err != nil {
		t.Fatalf("no se pudo listar: %v", err)
	}
	if len(versions) != MaxVersions {
		t.Fatalf("el historial debería quedarse en %d, tiene %d", MaxVersions, len(versions))
	}
	// Se conservan las más recientes, no las primeras.
	if versions[0].Revision != int64(total) {
		t.Fatalf("debería conservarse la revisión %d, la más nueva es %d", total, versions[0].Revision)
	}
	if _, err := store.GetVersion(ctx, "doc-1", 1); err == nil {
		t.Fatal("la revisión 1 debería haberse podado")
	}
}

func TestHistorialVacioNoEsError(t *testing.T) {
	versions, err := nuevoStore(t).ListVersions(context.Background(), "doc-sin-historial")
	if err != nil {
		t.Fatalf("un documento sin historial no es un error: %v", err)
	}
	if len(versions) != 0 {
		t.Fatalf("se esperaba historial vacío, hay %d", len(versions))
	}
}
