package document

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var ErrNotFound = errors.New("document not found")

type Record struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Kind      string          `json:"kind"`
	Schema    int             `json:"schemaVersion"`
	Revision  int64           `json:"revision"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
	Content   json.RawMessage `json:"content"`
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
