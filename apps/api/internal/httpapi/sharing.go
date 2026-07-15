package httpapi

import (
	"errors"
	"net/http"

	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/auth"
	"github.com/vladimiracunadev-create/rhino-suite/apps/api/internal/document"
)

// shareDocument concede acceso a otra persona por su correo. Solo el dueño
// reparte acceso: quien recibe un documento no puede repartirlo a su vez.
func (handler *Handler) shareDocument(writer http.ResponseWriter, request *http.Request) {
	record, ok := handler.documentFor(writer, request, true)
	if !ok {
		return
	}
	user, _ := userFrom(request)
	if record.OwnerID != user.ID {
		writeProblem(writer, http.StatusForbidden, "Solo quien creó el documento puede compartirlo.")
		return
	}

	var input struct {
		Email string        `json:"email"`
		Role  document.Role `json:"role"`
	}
	if err := decodeJSON(writer, request, &input); err != nil {
		writeProblem(writer, http.StatusBadRequest, err.Error())
		return
	}
	if !input.Role.Valid() {
		writeProblem(writer, http.StatusBadRequest, "El permiso debe ser viewer o editor.")
		return
	}

	target, err := handler.accounts.UserByEmail(request.Context(), input.Email)
	if errors.Is(err, auth.ErrNotFound) {
		writeProblem(writer, http.StatusNotFound, "No hay ninguna cuenta con ese correo.")
		return
	}
	if err != nil {
		handler.internalError(writer, request, err)
		return
	}
	if target.ID == record.OwnerID {
		writeProblem(writer, http.StatusUnprocessableEntity, "El documento ya es tuyo.")
		return
	}

	// Compartir otra vez con la misma persona cambia su permiso, no lo duplica.
	updated := false
	for index, share := range record.Shares {
		if share.UserID == target.ID {
			record.Shares[index].Role = input.Role
			record.Shares[index].Email = target.Email
			record.Shares[index].Name = target.Name
			updated = true
			break
		}
	}
	if !updated {
		record.Shares = append(record.Shares, document.Share{
			UserID: target.ID,
			Email:  target.Email,
			Name:   target.Name,
			Role:   input.Role,
		})
	}

	if err := handler.store.Put(request.Context(), record); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, record.SummaryFor(user.ID))
}

// unshareDocument retira el acceso. El dueño puede retirárselo a cualquiera; y
// quien lo recibió puede quitárselo a sí mismo, para dejar de verlo.
func (handler *Handler) unshareDocument(writer http.ResponseWriter, request *http.Request) {
	record, ok := handler.documentFor(writer, request, false)
	if !ok {
		return
	}
	user, _ := userFrom(request)
	targetID := request.PathValue("userId")
	if record.OwnerID != user.ID && targetID != user.ID {
		writeProblem(writer, http.StatusForbidden, "No puedes cambiar con quién está compartido.")
		return
	}

	shares := make([]document.Share, 0, len(record.Shares))
	for _, share := range record.Shares {
		if share.UserID != targetID {
			shares = append(shares, share)
		}
	}
	record.Shares = shares
	if err := handler.store.Put(request.Context(), record); err != nil {
		writeProblem(writer, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}
