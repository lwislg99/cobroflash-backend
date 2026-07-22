# prisma/migrations — CONGELADA (mar-2026) y ARCHIVADA aquí (SCRUM-40)

Estas 13 migraciones son la historia de schema de YaQu **hasta el 9-mar-2026**
(la última: `20260309122015_add_product_provider_relation`). Cubren ~11 de las
23 tablas actuales.

## Por qué están aquí y no en `prisma/`

Desde mar-2026 el schema se aplica con **`prisma db push`** (regla 3: Prisma sin
TTY), no con `migrate`. La carpeta `prisma/migrations` quedó **congelada** mientras
el schema siguió evolucionando por db push → **~12 tablas y decenas de columnas
nuevas NO están en estas migraciones**. Dejarla viva en `prisma/` era un TRAP:

- `prisma migrate deploy` contra una **BD nueva/vacía** (clon, CI, entorno nuevo)
  aplicaría solo estas 13 → schema de mar-2026 → faltan 12 tablas → app rota
  (P2021/P2022). *(Contra la prod actual sería un no-op: sus 13 ya constan en
  `_prisma_migrations`; el peligro es el entorno nuevo.)*
- `prisma migrate dev` detectaría el drift enorme → propondría **RESET (DROP)** de
  las tablas no migradas. *(El hook `guard-dangerous` ya lo bloquea.)*

Se archivó aquí (**SCRUM-40, opción B: formalizar db push**) para **conservar la
historia visible** sin que sea ejecutable por error. No se borró a propósito:
borrarla obligaría a arqueología en el historial de git.

## Cómo se aplica el schema HOY

Fuente de verdad = `prisma/schema.prisma`. Se aplica con el procedimiento guiado
**`scripts/db-push-prod`**: host-check del destino → preview `prisma migrate diff`
→ **GO explícito del operador** (la decisión NO se automatiza) → `prisma db push`
sin `--accept-data-loss` → verificación (`migrate diff` vacío) → se documenta en
`docs/MIGRATIONS_PENDING.md`. Ver también `docs/FLUJO_DE_TRABAJO.md`.

Volver a `migrate` con una migración **baseline** = **SCRUM-40 opción A**, ticket
futuro opcional (delicado sobre una prod ya divergente; sin prisa).
