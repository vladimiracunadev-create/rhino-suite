package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/your-user/web-office-suite-evolution/apps/api/internal/document"
	"github.com/your-user/web-office-suite-evolution/apps/api/internal/httpapi"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	store, err := document.NewFileStore(environment("DATA_DIR", "./apps/api/data"))
	if err != nil {
		logger.Error("could not initialize document store", "error", err)
		os.Exit(1)
	}
	server := &http.Server{
		Addr:              ":" + environment("PORT", "8080"),
		Handler:           httpapi.New(store, logger, environment("WEB_ORIGIN", "http://localhost:5173")),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       20 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	stopped := make(chan os.Signal, 1)
	signal.Notify(stopped, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		logger.Info("api listening", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-stopped
	context, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(context); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("api stopped")
}

func environment(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
