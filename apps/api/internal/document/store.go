package document

import (
	"context"
	"encoding/json"
	"errors"
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
}

type FileStore struct {
	directory string
	folders   string
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
	return &FileStore{directory: directory, folders: folders}, nil
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
	store.mu.Lock()
	defer store.mu.Unlock()
	payload, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(store.directory, store.path(record.ID), payload)
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
