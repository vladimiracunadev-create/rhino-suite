// Package auth gestiona las cuentas y las sesiones: quién es cada quien, para
// que cada usuario vea solo sus documentos.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

var (
	ErrNotFound     = errors.New("user not found")
	ErrEmailTaken   = errors.New("email already registered")
	ErrCredentials  = errors.New("invalid credentials")
	ErrSessionEnded = errors.New("session expired")
)

// SessionLifetime es cuánto dura una sesión sin volver a entrar.
const SessionLifetime = 30 * 24 * time.Hour

// Parámetros de Argon2id. Son deliberadamente costosos: encarecen la fuerza
// bruta contra las contraseñas si alguien se lleva el almacén.
const (
	argonTime    uint32 = 1
	argonMemory  uint32 = 64 * 1024
	argonThreads uint8  = 4
	argonKeyLen  uint32 = 32
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"passwordHash"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Public es el usuario tal como se le puede contar a un cliente: nunca lleva
// el hash de la contraseña.
type Public struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func (user User) Public() Public {
	return Public{ID: user.ID, Email: user.Email, Name: user.Name}
}

type Session struct {
	// TokenHash: el token en claro nunca se guarda, así que si alguien lee el
	// disco no se lleva sesiones utilizables.
	TokenHash string    `json:"tokenHash"`
	UserID    string    `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (session Session) Expired(now time.Time) bool {
	return now.After(session.ExpiresAt)
}

// NormalizeEmail deja el correo en una forma comparable, para que Ana@X.com y
// ana@x.com no sean dos cuentas.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// ValidEmail comprueba la forma mínima de un correo. No pretende validar que
// exista: eso solo lo dice enviarle algo.
func ValidEmail(email string) bool {
	at := strings.Index(email, "@")
	if at <= 0 || at == len(email)-1 {
		return false
	}
	domain := email[at+1:]
	return strings.Contains(domain, ".") && !strings.Contains(domain, " ") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}

// HashPassword deriva el hash con Argon2id y una sal aleatoria por contraseña.
func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf(
		"argon2id$%d$%d$%d$%s$%s",
		argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword compara en tiempo constante, para no filtrar por lo que tarda
// cuánto se acertó del hash.
func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "argon2id" {
		return false
	}
	memory, err1 := strconv.ParseUint(parts[1], 10, 32)
	times, err2 := strconv.ParseUint(parts[2], 10, 32)
	threads, err3 := strconv.ParseUint(parts[3], 10, 8)
	salt, err4 := base64.RawStdEncoding.DecodeString(parts[4])
	want, err5 := base64.RawStdEncoding.DecodeString(parts[5])
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil || err5 != nil || len(want) == 0 {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, uint32(times), uint32(memory), uint8(threads), uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1
}

// NewToken genera un token de sesión imposible de adivinar.
func NewToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

// HashToken es lo que se guarda del token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func NewID(prefix string) (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buffer), nil
}
