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
	FolderID  string     `json:"folderId"`
	Starred   bool       `json:"starred"`
	TrashedAt *time.Time `json:"trashedAt"`
	// Quién es el dueño y con quién está compartido. Como los campos de
	// organización, solo los cambian sus endpoints: guardar no los toca.
	OwnerID string  `json:"ownerId"`
	Shares  []Share `json:"shares"`
	// Derivados del contenido que el catálogo necesita para pintar la lista.
	// Se guardan aquí para poder listar sin devolver el documento entero.
	Preview   string          `json:"preview"`
	WordCount int             `json:"wordCount"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
	Content   json.RawMessage `json:"content"`
}

// Role es lo que alguien puede hacer con un documento compartido.
type Role string

const (
	RoleViewer Role = "viewer"
	RoleEditor Role = "editor"
)

func (role Role) Valid() bool {
	return role == RoleViewer || role == RoleEditor
}

// Share es el acceso concedido a otra persona.
type Share struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Role   Role   `json:"role"`
}

// Access resuelve qué puede hacer un usuario con este documento.
func (record Record) Access(userID string) (canRead bool, canWrite bool) {
	// Sin dueño: documento heredado de antes de que existieran las cuentas.
	// Lo reclama la primera cuenta que se crea, no cualquiera que pase.
	if record.OwnerID == "" {
		return false, false
	}
	if record.OwnerID == userID {
		return true, true
	}
	for _, share := range record.Shares {
		if share.UserID == userID {
			return true, share.Role == RoleEditor
		}
	}
	return false, false
}

// Summary es el registro sin el contenido. Es lo que devuelve el listado: una
// unidad con cien documentos no tiene por qué transferir cien documentos
// completos solo para dibujar sus tarjetas.
type Summary struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	Kind      string     `json:"kind"`
	Schema    int        `json:"schemaVersion"`
	Revision  int64      `json:"revision"`
	FolderID  string     `json:"folderId"`
	Starred   bool       `json:"starred"`
	TrashedAt *time.Time `json:"trashedAt"`
	OwnerID   string     `json:"ownerId"`
	Shares    []Share    `json:"shares"`
	// Owned dice si el catálogo lo lista por ser tuyo o por compartido.
	Owned     bool      `json:"owned"`
	Role      Role      `json:"role"`
	Preview   string    `json:"preview"`
	WordCount int       `json:"wordCount"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (record Record) SummaryFor(userID string) Summary {
	_, canWrite := record.Access(userID)
	role := RoleViewer
	if canWrite {
		role = RoleEditor
	}
	shares := record.Shares
	if shares == nil {
		shares = []Share{}
	}
	return Summary{
		ID:        record.ID,
		Title:     record.Title,
		Kind:      record.Kind,
		Schema:    record.Schema,
		Revision:  record.Revision,
		FolderID:  record.FolderID,
		Starred:   record.Starred,
		TrashedAt: record.TrashedAt,
		OwnerID:   record.OwnerID,
		Shares:    shares,
		Owned:     record.OwnerID == userID,
		Role:      role,
		Preview:   record.Preview,
		WordCount: record.WordCount,
		CreatedAt: record.CreatedAt,
		UpdatedAt: record.UpdatedAt,
	}
}

// Version es una instantánea del documento tal como quedó en una revisión.
type Version struct {
	Revision  int64           `json:"revision"`
	Title     string          `json:"title"`
	WordCount int             `json:"wordCount"`
	SavedAt   time.Time       `json:"savedAt"`
	Content   json.RawMessage `json:"content,omitempty"`
}

// VersionSummary describe una versión sin arrastrar su contenido, para poder
// listar el historial barato.
type VersionSummary struct {
	Revision  int64     `json:"revision"`
	Title     string    `json:"title"`
	WordCount int       `json:"wordCount"`
	SavedAt   time.Time `json:"savedAt"`
}

func (version Version) Summary() VersionSummary {
	return VersionSummary{
		Revision:  version.Revision,
		Title:     version.Title,
		WordCount: version.WordCount,
		SavedAt:   version.SavedAt,
	}
}

// Folder es un contenedor de documentos dentro de la unidad de archivos.
type Folder struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	ParentID  string     `json:"parentId"`
	OwnerID   string     `json:"ownerId"`
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
