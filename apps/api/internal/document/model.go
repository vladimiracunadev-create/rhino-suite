package document

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var ErrNotFound = errors.New("document not found")

// Root identifica la carpeta raíz de la unidad de archivos.
const Root = ""

type Record struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Kind     string `json:"kind"`
	Schema   int    `json:"schemaVersion"`
	Revision int64  `json:"revision"`
	// Campos de organización. Solo se modifican a través de los endpoints de
	// acción (move, star, trash, restore); guardar el documento los conserva.
	FolderID  string          `json:"folderId"`
	Starred   bool            `json:"starred"`
	TrashedAt *time.Time      `json:"trashedAt"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
	Content   json.RawMessage `json:"content"`
}

// Folder es un contenedor de documentos dentro de la unidad de archivos.
type Folder struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	ParentID  string     `json:"parentId"`
	TrashedAt *time.Time `json:"trashedAt"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

func (folder Folder) Validate() error {
	if strings.TrimSpace(folder.ID) == "" {
		return errors.New("id is required")
	}
	if strings.TrimSpace(folder.Name) == "" {
		return errors.New("name is required")
	}
	if folder.ParentID == folder.ID {
		return errors.New("a folder cannot contain itself")
	}
	return nil
}

func (record Record) Validate() error {
	if strings.TrimSpace(record.ID) == "" {
		return errors.New("id is required")
	}
	if strings.TrimSpace(record.Title) == "" {
		return errors.New("title is required")
	}
	if record.Kind != "document" && record.Kind != "spreadsheet" && record.Kind != "presentation" && record.Kind != "pdf" {
		return errors.New("unsupported document kind")
	}
	if record.Schema < 1 {
		return errors.New("schemaVersion must be at least 1")
	}
	if !json.Valid(record.Content) {
		return errors.New("content must be valid JSON")
	}
	return nil
}
