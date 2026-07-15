package auth

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Store interface {
	CreateUser(ctx context.Context, email, name, password string) (User, error)
	Authenticate(ctx context.Context, email, password string) (User, error)
	UserByID(ctx context.Context, id string) (User, error)
	UserByEmail(ctx context.Context, email string) (User, error)
	CountUsers(ctx context.Context) (int, error)
	StartSession(ctx context.Context, userID string) (string, Session, error)
	SessionUser(ctx context.Context, token string) (User, error)
	EndSession(ctx context.Context, token string) error
}

type FileStore struct {
	users    string
	sessions string
	mu       sync.RWMutex
}

func NewFileStore(directory string) (*FileStore, error) {
	users := filepath.Join(directory, "users")
	sessions := filepath.Join(directory, "sessions")
	for _, path := range []string{users, sessions} {
		if err := os.MkdirAll(path, 0o750); err != nil {
			return nil, err
		}
	}
	return &FileStore{users: users, sessions: sessions}, nil
}

func (store *FileStore) userPath(id string) string {
	return filepath.Join(store.users, filepath.Base(id)+".json")
}

func (store *FileStore) sessionPath(tokenHash string) string {
	return filepath.Join(store.sessions, filepath.Base(tokenHash)+".json")
}

func writeJSONFile(directory, destination string, value any) error {
	payload, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(directory, "write-*.tmp")
	if err != nil {
		return err
	}
	name := temporary.Name()
	defer os.Remove(name)
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
	return os.Rename(name, destination)
}

func readJSONFile(path string, into any) error {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(payload, into)
}

func (store *FileStore) allUsersUnlocked() ([]User, error) {
	entries, err := os.ReadDir(store.users)
	if err != nil {
		return nil, err
	}
	users := make([]User, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		var user User
		if err := readJSONFile(filepath.Join(store.users, entry.Name()), &user); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

func (store *FileStore) CountUsers(_ context.Context) (int, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	users, err := store.allUsersUnlocked()
	if err != nil {
		return 0, err
	}
	return len(users), nil
}

func (store *FileStore) UserByEmail(_ context.Context, email string) (User, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.userByEmailUnlocked(NormalizeEmail(email))
}

func (store *FileStore) userByEmailUnlocked(email string) (User, error) {
	users, err := store.allUsersUnlocked()
	if err != nil {
		return User{}, err
	}
	for _, user := range users {
		if user.Email == email {
			return user, nil
		}
	}
	return User{}, ErrNotFound
}

func (store *FileStore) UserByID(_ context.Context, id string) (User, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	var user User
	if err := readJSONFile(store.userPath(id), &user); err != nil {
		return User{}, err
	}
	return user, nil
}

func (store *FileStore) CreateUser(_ context.Context, email, name, password string) (User, error) {
	normalized := NormalizeEmail(email)
	hash, err := HashPassword(password)
	if err != nil {
		return User{}, err
	}
	id, err := NewID("user-")
	if err != nil {
		return User{}, err
	}

	store.mu.Lock()
	defer store.mu.Unlock()
	// La comprobación va dentro del candado: si no, dos altas a la vez con el
	// mismo correo podrían pasar ambas.
	if _, err := store.userByEmailUnlocked(normalized); err == nil {
		return User{}, ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return User{}, err
	}

	user := User{ID: id, Email: normalized, Name: name, PasswordHash: hash, CreatedAt: time.Now().UTC()}
	if err := writeJSONFile(store.users, store.userPath(user.ID), user); err != nil {
		return User{}, err
	}
	return user, nil
}

func (store *FileStore) Authenticate(_ context.Context, email, password string) (User, error) {
	store.mu.RLock()
	user, err := store.userByEmailUnlocked(NormalizeEmail(email))
	store.mu.RUnlock()
	if errors.Is(err, ErrNotFound) {
		// Se comprueba una contraseña igualmente: así entrar con un correo que
		// no existe tarda lo mismo que con uno que sí, y no se puede averiguar
		// quién tiene cuenta midiendo el tiempo de respuesta.
		_ = VerifyPassword("argon2id$65536$1$4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", password)
		return User{}, ErrCredentials
	}
	if err != nil {
		return User{}, err
	}
	if !VerifyPassword(user.PasswordHash, password) {
		return User{}, ErrCredentials
	}
	return user, nil
}

func (store *FileStore) StartSession(_ context.Context, userID string) (string, Session, error) {
	token, err := NewToken()
	if err != nil {
		return "", Session{}, err
	}
	now := time.Now().UTC()
	session := Session{
		TokenHash: HashToken(token),
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(SessionLifetime),
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if err := writeJSONFile(store.sessions, store.sessionPath(session.TokenHash), session); err != nil {
		return "", Session{}, err
	}
	return token, session, nil
}

func (store *FileStore) SessionUser(ctx context.Context, token string) (User, error) {
	if token == "" {
		return User{}, ErrNotFound
	}
	hash := HashToken(token)

	store.mu.RLock()
	var session Session
	err := readJSONFile(store.sessionPath(hash), &session)
	store.mu.RUnlock()
	if err != nil {
		return User{}, err
	}
	if session.Expired(time.Now().UTC()) {
		_ = store.EndSession(ctx, token)
		return User{}, ErrSessionEnded
	}
	return store.UserByID(ctx, session.UserID)
}

func (store *FileStore) EndSession(_ context.Context, token string) error {
	if token == "" {
		return nil
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	err := os.Remove(store.sessionPath(HashToken(token)))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
