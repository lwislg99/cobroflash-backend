# SCRUM-1056 · «Volver a llamar»: diseño y `.sql` del ALTER (paso ② de A5)

**Medido contra:** `origin/main` = `c30b4ed43e27b79d65f8e8aabefd7154058e6245` · 2026-09-27T16:12:23Z

**Escribe:** Sesión 1 (S1, `s1-27a`) · **Rama:** `scrum-1056-volver-a-llamar-alter` · **Carril:** S1
(servidor) + S2 (pantallas) · bloque CRM (SCRUM-977), ola 3.

## Alcance de esta rama: SÓLO el ②

Diseño y `docs/sql/scrum-1056-volver-a-llamar.sql`. No toca `prisma/schema.prisma` (regla 40) ni
código, y no aplica nada a ninguna base.

## PASO 0 — medido en origin/main

- Ningún modelo de seguimiento: `callback|followUp|volverA` en `schema.prisma` → 0. Lo que sale con
  `remind` son los recordatorios de PAGO (`reminder7SentAt`…), otra cosa.
- `CustomerEvent` existe y es el historial del cliente (`type` libre, con la lista en comentario).
- D6 = tarea PROPIA (`docs/producto/CRM.md` §6); `MAINTENANCE_ENABLED` no se toca.

## El diseño: dos columnas en `customers`, no una tabla

La aceptación pide UNA pendiente por cliente («poner otra sustituye a la anterior») y que «hecho»
deje el apunte en `CustomerEvent`. El historial ya tiene tabla; otra tabla sería un historial paralelo
y necesitaría un índice parcial para «una activa por cliente». Por eso:

- `callback_on DATE` (NULL = nada pendiente). `DATE`, porque es un día del calendario; «vencido» se
  decide contra HOY en la zona del merchant (`diaNaturalEn`), nunca con el reloj del proceso.
- `callback_note TEXT` (NULL = sin nota).
- Índice `(merchant_id, callback_on)` para «hoy o vencidos» y «esta semana».

DDL derivado offline con `previewMigracion` (control positivo: ok, 31 tablas): 2 `ADD COLUMN`
nullables sin `DEFAULT` + 1 `CREATE INDEX`. Nada más.

## Criterios de aceptación que añade el esquema al ③

1. `callbackNote` entra en la lista de `customer` de `anonimizarMerchant.ts`, con test.
2. «Hecho» pone las dos columnas a NULL y crea el `CustomerEvent` en la MISMA transacción (test).
3. «Vencido/hoy» se calcula con la zona del merchant (test en la frontera del día, Europe/Madrid).
4. Toda lectura/escritura filtra por `req.merchantId`; otro merchant no la ve (test).
5. El tipo nuevo de `CustomerEvent` se añade a la lista de su comentario en el esquema (en el ③).
