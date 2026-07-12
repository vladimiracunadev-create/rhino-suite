package document

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

type Store interface {
	List(context.Context) ([]Record, error)
	Get(context.Context, string) (Record, error)
	Put(context.Context, Record) error
	Delete(context.Context, string) error
}

type FileStore struct {
	directory string
	mu        sync.RWMutex
}

func NewFileStore(directory string) (*FileStore, error) {
	if err := os.MkdirAll(directory, 0o750); err != nil {
		return nil, err
	}
	return &FileStore{directory: directory}, nil
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
	temporary, err := os.CreateTemp(store.directory, "document-*.tmp")
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
	return os.Rename(temporaryName, store.path(record.ID))
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
