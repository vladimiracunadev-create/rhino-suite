# Compatibilidad DOCX y ODT — Fase 2.4

## Objetivo

Probar la arquitectura de importación/exportación sin depender de ONLYOFFICE, LibreOffice, bibliotecas DOCX ni SDK comerciales.

## Implementación

- `zip.ts`: lectura del directorio central, método almacenado y Deflate.
- `formats.ts`: generación y lectura de XML OOXML/ODF.
- Paquetes de exportación creados con ZIP almacenado y CRC32 propio.

## DOCX

| Elemento | Exportar | Importar |
|---|---:|---:|
| Párrafos | Sí | Sí |
| Títulos 1-6 | Sí | Sí |
| Negrita/cursiva/subrayado/tachado | Sí | Parcial |
| Fuente, tamaño y color | Sí | Parcial |
| Listas | Como prefijo visible | Como texto |
| Tablas | Sí | Sí |
| Saltos página/columna | Sí | Sí |
| Configuración principal de página | Sí | Parcial |
| Imágenes | Marcador textual | Marcador textual |
| Encabezados/pies | No nativos aún | No |
| Comentarios/control de cambios Office | No nativos | No |
| Macros y objetos incrustados | No | No |

## ODT

| Elemento | Exportar | Importar |
|---|---:|---:|
| Párrafos | Sí | Sí |
| Títulos | Sí | Sí |
| Listas simples | Como prefijo visible | Como texto |
| Tablas | Sí | Sí |
| Imágenes | Marcador textual | Marcador textual |
| Estilos complejos | No | No |
| Comentarios/cambios nativos | No | No |

## Garantía actual

Se valida el round-trip de archivos generados por la propia suite y una lectura básica de paquetes externos que utilicen ZIP almacenado o Deflate. Un archivo complejo puede abrirse con simplificaciones y advertencias; nunca debe afirmarse fidelidad completa en esta fase.
