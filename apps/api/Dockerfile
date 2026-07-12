FROM golang:1.23-alpine AS build
WORKDIR /src/apps/api
COPY apps/api/go.mod ./
COPY apps/api/ ./
RUN CGO_ENABLED=0 go test ./... && go build -trimpath -ldflags="-s -w" -o /out/web-office-api ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/web-office-api /app/web-office-api
ENV PORT=8080 DATA_DIR=/data WEB_ORIGIN=http://localhost:8088
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/app/web-office-api"]
