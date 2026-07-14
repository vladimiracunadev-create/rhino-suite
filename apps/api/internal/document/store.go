package document

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type Store interface {
	List(context.Context) ([]Record, error)
	Get(context.Context, string) (Record, error)
	Put(context.Context, Record) error
	Delete(context.Context, string) error
	ListFolders(context.Context) ([]Folder, error)
	GetFolder(context.Context, string) (Folder, error)
	PutFolder(context.Context, Folder) error
	DeleteFolder(context.Context, string) error
	ListVersions(context.Context, string) ([]Version, error)
	GetVersion(context.Context, string, int64) (Version, error)
}

// MaxVersions es cuántas instantáneas se conservan por documento. Sin tope el
// historial crecería sin límite; con él, se guarda un pasado reciente útil.
const MaxVersions = 40

type FileStore struct {
	directory string
	folders   string
	versions  string
	mu        sync.RWMutex
}

func NewFileStore(directory string) (*FileStore, error) {
	if err := os.MkdirAll(directory, 0o750); err != nil {
		return nil, err
	}
	folders := filepath.Join(directory, "folders")
	if err := os.MkdirAll(folders, 0o750); err != nil {
		return nil, err
	}
	versions := filepath.Join(directory, "versions")
	if err := os.MkdirAll(versions, 0o750); err != nil {
		return nil, err
	}
	return &FileStore{directory: directory, folders: folders, versions: versions}, nil
}

func (store *FileStore) List(_ context.Context) ([]Record, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	entries, err := os.ReadDir(store.directory)
	if err != nil {
		return nil, err
	}
	records := make([]Record, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		record, readErr := store.readUnlocked(filepath.Join(store.directory, entry.Name()))
		if readErr != nil {
			return nil, readErr
		}
		// Registros guardados antes de que existieran estos campos: se derivan al
		// vuelo para que el catálogo no salga vacío. Se persisten en el siguiente
		// guardado; recalcularlos aquí es barato comparado con no mostrarlos.
		if record.Preview == "" && record.WordCount == 0 && len(record.Content) > 0 {
			record.Preview, record.WordCount = Derive(record.Content)
		}
		records = append(records, record)
	}
	sort.Slice(records, func(i, j int) bool {
		return records[i].UpdatedAt.After(records[j].UpdatedAt)
	})
	return records, nil
}

func (store *FileStore) Get(_ context.Context, id string) (Record, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.readUnlocked(store.path(id))
}

func (store *FileStore) Put(_ context.Context, record Record) error {
	if err := record.Validate(); err != nil {
		return err
	}
	// El extracto y el conteo se derivan aquí, no se aceptan del cliente: son
	// lo que el catálogo muestra sin abrir el documento, y deben corresponder
	// siempre con el contenido que se está guardando.
	record.Preview, record.WordCount = Derive(record.Content)
	store.mu.Lock()
	defer store.mu.Unlock()
	payload, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return err
	}
	if err := writeAtomic(store.directory, store.path(record.ID), payload); err != nil {
		return err
	}
	// El historial se archiva después de guardar: que falle no debe impedir que
	// el documento quede a salvo, que es lo que de verdad importa.
	return store.archiveUnlocked(record)
}

// archiveUnlocked guarda la instantánea de esta revisión y poda las más viejas.
func (store *FileStore) archiveUnlocked(record Record) error {
	if len(record.Content) == 0 {
		return nil
	}
	directory := store.versionDirectory(record.ID)
	if err := os.MkdirAll(directory, 0o750); err != nil {
		return err
	}
	version := Version{
		Revision:  record.Revision,
		Title:     record.Title,
		WordCount: record.WordCount,
		SavedAt:   record.UpdatedAt,
		Content:   record.Content,
	}
	payload, err := json.Marshal(version)
	if err != nil {
		return err
	}
	destination := filepath.Join(directory, fmt.Sprintf("%020d.json", record.Revision))
	if err := writeAtomic(directory, destination, payload); err != nil {
		return err
	}
	return prune(directory, MaxVersions)
}

// prune deja solo las `keep` instantáneas más recientes.
func prune(directory string, keep int) error {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			names = append(names, entry.Name())
		}
	}
	if len(names) <= keep {
		return nil
	}
	// El nombre lleva la revisión con ceros a la izquierda: ordenar por nombre
	// ordena por revisión.
	sort.Strings(names)
	for _, name := range names[:len(names)-keep] {
		if err := os.Remove(filepath.Join(directory, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}

func (store *FileStore) ListVersions(_ context.Context, id string) ([]Version, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	entries, err := os.ReadDir(store.versionDirectory(id))
	if errors.Is(err, os.ErrNotExist) {
		return []Version{}, nil
	}
	if err != nil {
		return nil, err
	}
	versions := make([]Version, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		version, readErr := readVersion(filepath.Join(store.versionDirectory(id), entry.Name()))
		if readErr != nil {
			return nil, readErr
		}
		version.Content = nil // el listado no arrastra contenido
		versions = append(versions, version)
	}
	sort.Slice(versions, func(i, j int) bool { return versions[i].Revision > versions[j].Revision })
	return versions, nil
}

func (store *FileStore) GetVersion(_ context.Context, id string, revision int64) (Version, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	path := filepath.Join(store.versionDirectory(id), fmt.Sprintf("%020d.json", revision))
	return readVersion(path)
}

func readVersion(path string) (Version, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return Version{}, ErrNotFound
	}
	if err != nil {
		return Version{}, err
	}
	var version Version
	if err := json.Unmarshal(payload, &version); err != nil {
		return Version{}, err
	}
	return version, nil
}

func (store *FileStore) versionDirectory(id string) string {
	return filepath.Join(store.versions, filepath.Base(id))
}

func (store *FileStore) Delete(_ context.Context, id string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	err := os.Remove(store.path(id))
	if errors.Is(err, os.ErrNotExist) {
		return ErrNotFound
	}
	return err
}

func (store *FileStore) ListFolders(_ context.Context) ([]Folder, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	entries, err := os.ReadDir(store.folders)
	if err != nil {
		return nil, err
	}
	folders := make([]Folder, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		folder, readErr := store.readFolderUnlocked(filepath.Join(store.folders, entry.Name()))
		if readErr != nil {
			return nil, readErr
		}
		folders = append(folders, folder)
	}
	sort.Slice(folders, func(i, j int) bool {
		return strings.ToLower(folders[i].Name) < strings.ToLower(folders[j].Name)
	})
	return folders, nil
}

func (store *FileStore) GetFolder(_ context.Context, id string) (Folder, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.readFolderUnlocked(store.folderPath(id))
}

func (store *FileStore) PutFolder(_ context.Context, folder Folder) error {
	if err := folder.Validate(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	payload, err := json.MarshalIndent(folder, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(store.folders, store.folderPath(folder.ID), payload)
}

func (store *FileStore) DeleteFolder(_ context.Context, id string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	err := os.Remove(store.folderPath(id))
	if errors.Is(err, os.ErrNotExist) {
		return ErrNotFound
	}
	return err
}

func (store *FileStore) readFolderUnlocked(path string) (Folder, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return Folder{}, ErrNotFound
	}
	if err != nil {
		return Folder{}, err
	}
	var folder Folder
	if err := json.Unmarshal(payload, &folder); err != nil {
		return Folder{}, err
	}
	return folder, nil
}

func (store *FileStore) folderPath(id string) string {
	return filepath.Join(store.folders, filepath.Base(id)+".json")
}

// writeAtomic escribe el contenido en un temporal y lo renombra, de modo que
// un fallo a medias nunca deja un archivo corrupto.
func writeAtomic(directory, destination string, payload []byte) error {
	temporary, err := os.CreateTemp(directory, "write-*.tmp")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if _, err = temporary.Write(payload); err != nil {
		temporary.Close()
		return err
	}
	if err = temporary.Sync(); err != nil {
		temporary.Close()
		return err
	}
	if err = temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryName, destination)
}

func (store *FileStore) readUnlocked(path string) (Record, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return Record{}, ErrNotFound
	}
	if err != nil {
		return Record{}, err
	}
	var record Record
	if err := json.Unmarshal(payload, &record); err != nil {
		return Record{}, err
	}
	return record, nil
}

func (store *FileStore) path(id string) string {
	return filepath.Join(store.directory, filepath.Base(id)+".json")
}
