package document

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestDeriveExtraeTextoDeParrafosYTablas(t *testing.T) {
	content := json.RawMessage(`{"blocks":[
		{"blockType":"text","runs":[{"text":"Hola "},{"text":"mundo"}]},
		{"blockType":"table","rows":[{"cells":[{"runs":[{"text":"celda uno"}]},{"runs":[{"text":"celda dos"}]}]}]},
		{"blockType":"image","resourceId":"r1"}
	]}`)

	preview, words := Derive(content)

	if preview != "Hola mundo celda uno celda dos" {
		t.Fatalf("extracto inesperado: %q", preview)
	}
	if words != 6 {
		t.Fatalf("conteo inesperado: %d", words)
	}
}

func TestDeriveRecortaExtractosLargos(t *testing.T) {
	long := strings.Repeat("palabra ", 60)
	content := json.RawMessage(`{"blocks":[{"blockType":"text","runs":[{"text":"` + long + `"}]}]}`)

	preview, words := Derive(content)

	if !strings.HasSuffix(preview, "…") {
		t.Fatalf("un extracto largo debe terminar en puntos suspensivos: %q", preview)
	}
	if runes := []rune(preview); len(runes) > previewRunes+1 {
		t.Fatalf("extracto demasiado largo: %d runas", len(runes))
	}
	if words != 60 {
		t.Fatalf("conteo inesperado: %d", words)
	}
}

func TestWithRevisionReescribeLaRevisionDelContenido(t *testing.T) {
	content := json.RawMessage(`{"metadata":{"id":"doc-1","revision":2,"updatedAt":1},"blocks":[]}`)
	momento := time.UnixMilli(1_700_000_000_000).UTC()

	patched := WithRevision(content, 7, momento)

	var shape struct {
		Metadata struct {
			ID        string `json:"id"`
			Revision  int64  `json:"revision"`
			UpdatedAt int64  `json:"updatedAt"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(patched, &shape); err != nil {
		t.Fatalf("el contenido reescrito no es JSON válido: %v", err)
	}
	if shape.Metadata.Revision != 7 {
		t.Fatalf("la revisión del contenido debería ser 7, es %d", shape.Metadata.Revision)
	}
	if shape.Metadata.UpdatedAt != momento.UnixMilli() {
		t.Fatalf("updatedAt no se reescribió: %d", shape.Metadata.UpdatedAt)
	}
	if shape.Metadata.ID != "doc-1" {
		t.Fatal("no debe tocar el resto de los metadatos")
	}
}

func TestWithRevisionDevuelveElContenidoSiNoPuedeReescribirlo(t *testing.T) {
	original := json.RawMessage(`no es json`)
	if string(WithRevision(original, 3, time.Now())) != string(original) {
		t.Fatal("ante un contenido ilegible debe devolverlo tal cual, no romperlo")
	}
}

func TestDeriveToleraContenidoInvalido(t *testing.T) {
	preview, words := Derive(json.RawMessage(`{"x":1}`))
	if preview != "" || words != 0 {
		t.Fatalf("un contenido sin bloques no deriva nada, se obtuvo %q y %d", preview, words)
	}
}
