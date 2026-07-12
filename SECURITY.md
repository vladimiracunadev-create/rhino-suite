# Seguridad

Rhino Suite es todavía un entorno de desarrollo por fases y no debe exponerse directamente a Internet.

- La API aún no implementa autenticación.
- El CORS debe configurarse mediante `WEB_ORIGIN`.
- Los documentos se limitan a 10 MiB por solicitud.
- Los identificadores se normalizan antes de formar rutas de archivo.
- La escritura usa archivo temporal y renombrado atómico.
- Los parsers DOCX, XLSX, PPTX y PDF futuros deberán tratar todo documento como entrada hostil.

Informe vulnerabilidades de forma privada antes de publicar detalles.
