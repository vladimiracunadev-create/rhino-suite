package document

import (
	"encoding/json"
	"strings"
	"testing"
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

func TestDeriveToleraContenidoInvalido(t *testing.T) {
	preview, words := Derive(json.RawMessage(`{"x":1}`))
	if preview != "" || words != 0 {
		t.Fatalf("un contenido sin bloques no deriva nada, se obtuvo %q y %d", preview, words)
	}
}
