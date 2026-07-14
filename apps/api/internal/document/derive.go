package document

import (
	"encoding/json"
	"strings"
)

const previewRunes = 180

// contentShape es la parte del documento que hace falta para derivar el
// extracto: solo el texto. Todo lo demás del schema se ignora.
type contentShape struct {
	Blocks []struct {
		BlockType string `json:"blockType"`
		Runs      []struct {
			Text string `json:"text"`
		} `json:"runs"`
		Rows []struct {
			Cells []struct {
				Runs []struct {
					Text string `json:"text"`
				} `json:"runs"`
			} `json:"cells"`
		} `json:"rows"`
	} `json:"blocks"`
}

// Derive obtiene el extracto y el conteo de palabras del contenido. El servidor
// los calcula al guardar y los almacena junto al registro, de modo que el
// catálogo se puede listar sin devolver los documentos completos. Es el servidor
// quien manda: así el resumen es correcto sea cual sea el cliente que guardó.
func Derive(content json.RawMessage) (string, int) {
	var shape contentShape
	if err := json.Unmarshal(content, &shape); err != nil {
		return "", 0
	}

	var builder strings.Builder
	for _, block := range shape.Blocks {
		switch block.BlockType {
		case "text":
			for _, run := range block.Runs {
				builder.WriteString(run.Text)
			}
			builder.WriteByte(' ')
		case "table":
			for _, row := range block.Rows {
				for _, cell := range row.Cells {
					for _, run := range cell.Runs {
						builder.WriteString(run.Text)
					}
					builder.WriteByte(' ')
				}
			}
		}
	}

	fields := strings.Fields(strings.ReplaceAll(builder.String(), "​", ""))
	text := strings.Join(fields, " ")

	preview := text
	if runes := []rune(text); len(runes) > previewRunes {
		preview = strings.TrimRight(string(runes[:previewRunes]), " ") + "…"
	}
	return preview, len(fields)
}
