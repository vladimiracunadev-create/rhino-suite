package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestHashPasswordNoGuardaLaContrasena(t *testing.T) {
	hash, err := HashPassword("secreto muy largo 123")
	if err != nil {
		t.Fatalf("no se pudo derivar: %v", err)
	}
	if strings.Contains(hash, "secreto") {
		t.Fatal("el hash no puede contener la contraseña")
	}
	if !strings.HasPrefix(hash, "argon2id$") {
		t.Fatalf("formato inesperado: %q", hash)
	}
}

func TestHashPasswordUsaSalAleatoria(t *testing.T) {
	a, _ := HashPassword("misma contraseña")
	b, _ := HashPassword("misma contraseña")
	if a == b {
		t.Fatal("dos hashes de la misma contraseña deben diferir: si no, no hay sal")
	}
}

func TestVerifyPassword(t *testing.T) {
	hash, _ := HashPassword("correcta")
	if !VerifyPassword(hash, "correcta") {
		t.Fatal("la contraseña correcta debe validar")
	}
	if VerifyPassword(hash, "incorrecta") {
		t.Fatal("una contraseña distinta no puede validar")
	}
	if VerifyPassword("basura", "correcta") {
		t.Fatal("un hash ilegible no puede validar nada")
	}
	if VerifyPassword("argon2id$1$2$3$@@@$@@@", "correcta") {
		t.Fatal("un hash con base64 inválido no puede validar")
	}
}

func TestNormalizeEmail(t *testing.T) {
	if NormalizeEmail("  Ana@Ejemplo.COM ") != "ana@ejemplo.com" {
		t.Fatal("el correo debe normalizarse para no duplicar cuentas")
	}
}

func TestValidEmail(t *testing.T) {
	validos := []string{"a@b.co", "ana.perez@ejemplo.com"}
	invalidos := []string{"", "sin-arroba", "@ejemplo.com", "ana@", "ana@sinpunto", "ana@ b.com"}
	for _, email := range validos {
		if !ValidEmail(email) {
			t.Fatalf("%q debería ser válido", email)
		}
	}
	for _, email := range invalidos {
		if ValidEmail(email) {
			t.Fatalf("%q no debería ser válido", email)
		}
	}
}

func TestNoSePuedeRepetirElCorreo(t *testing.T) {
	store, err := NewFileStore(t.TempDir())
	if err != nil {
		t.Fatalf("no se pudo crear el almacén: %v", err)
	}
	ctx := context.Background()
	if _, err := store.CreateUser(ctx, "ana@ejemplo.com", "Ana", "contraseña larga"); err != nil {
		t.Fatalf("no se pudo crear: %v", err)
	}
	// Mayúsculas y espacios no valen para colarse con el mismo correo.
	if _, err := store.CreateUser(ctx, " ANA@Ejemplo.com ", "Otra", "otra contraseña"); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("se esperaba ErrEmailTaken, se obtuvo %v", err)
	}
}

func TestAutenticarYSesion(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())
	ctx := context.Background()
	creado, err := store.CreateUser(ctx, "ana@ejemplo.com", "Ana", "contraseña larga")
	if err != nil {
		t.Fatalf("no se pudo crear: %v", err)
	}

	if _, err := store.Authenticate(ctx, "ana@ejemplo.com", "equivocada"); !errors.Is(err, ErrCredentials) {
		t.Fatalf("una contraseña mala debe dar ErrCredentials, dio %v", err)
	}
	if _, err := store.Authenticate(ctx, "nadie@ejemplo.com", "loquesea"); !errors.Is(err, ErrCredentials) {
		t.Fatalf("un correo inexistente debe dar ErrCredentials (no revelar si existe), dio %v", err)
	}

	user, err := store.Authenticate(ctx, "ANA@ejemplo.com", "contraseña larga")
	if err != nil {
		t.Fatalf("debería entrar: %v", err)
	}
	if user.ID != creado.ID {
		t.Fatal("entró como otro usuario")
	}

	token, _, err := store.StartSession(ctx, user.ID)
	if err != nil {
		t.Fatalf("no se pudo abrir sesión: %v", err)
	}
	desde, err := store.SessionUser(ctx, token)
	if err != nil || desde.ID != user.ID {
		t.Fatalf("la sesión debería devolver al usuario: %v", err)
	}
	if _, err := store.SessionUser(ctx, "token-inventado"); err == nil {
		t.Fatal("un token inventado no puede abrir sesión")
	}

	if err := store.EndSession(ctx, token); err != nil {
		t.Fatalf("no se pudo cerrar: %v", err)
	}
	if _, err := store.SessionUser(ctx, token); err == nil {
		t.Fatal("tras cerrar sesión el token no debe servir")
	}
}

func TestElTokenEnClaroNoSeGuarda(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())
	ctx := context.Background()
	user, _ := store.CreateUser(ctx, "ana@ejemplo.com", "Ana", "contraseña larga")
	token, session, _ := store.StartSession(ctx, user.ID)
	if session.TokenHash == token {
		t.Fatal("se está guardando el token en claro")
	}
	if session.TokenHash != HashToken(token) {
		t.Fatal("debe guardarse el hash del token")
	}
}

func TestPublicNoFiltraElHash(t *testing.T) {
	user := User{ID: "user-1", Email: "a@b.co", Name: "Ana", PasswordHash: "argon2id$secreto"}
	public := user.Public()
	if strings.Contains(public.Name+public.Email+public.ID, "argon2id") {
		t.Fatal("el usuario público no puede llevar el hash")
	}
}
