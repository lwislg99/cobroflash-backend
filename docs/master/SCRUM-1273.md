# SCRUM-1273 · Archivar presupuestos

**Medido contra:** `origin/main` = `fcc889928bd077ecd81776fded32ca83658e7cbb` · 2026-09-29T10:09:43Z

## Paso ② de A5 · el ALTER, escrito y SIN APLICAR (S1, s1-29a)

La medición de S2 (s2-29a) mostró que archivar necesita columna nueva: `model Quote` no tiene
`archivedAt` ni nada parecido, y `status: 'archived'` no vale (estado nuevo en lista cerrada, Parte L;
y desarchivar exigiría recordar el estado anterior).

- Fichero: `docs/sql/scrum-1273-archivar-presupuestos.sql` —
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);` (nullable, sin default;
  ninguna fila cambia).
- **Sin `archived_by`:** el «quién» va a `recordAudit`, que ya guarda el autor. Dos sitios para el
  mismo hecho divergirían.
- DDL derivado OFFLINE con `previewMigracion` (control positivo: 31 tablas) contra `origin/main` =
  `223498dc`, con el candidato en el scratchpad. **`prisma/schema.prisma` no se ha tocado** (regla 40).
- Anotado en `docs/MIGRATIONS_PENDING.md` con las tres bases sin marcar. Lo aplica el equipo de Javier.

**El ticket sigue aparcado:** el PR ③ (esquema + código + pantalla) no se construye hasta que la
columna esté en las tres bases.
