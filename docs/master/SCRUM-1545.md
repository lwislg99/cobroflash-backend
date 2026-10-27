# SCRUM-1545 · Guardar como plantilla un presupuesto de 3 opciones

**Medido contra:** `origin/main` = `ea8dece1df90430ae0b269e200be137ff5462b72` · 2026-10-19T11:18:55Z
A9: comprobación → `tests/scrum1545c-tiers-de-plantilla-con-forma.test.mjs`

## SCRUM-1545c · el servidor valida la forma de `tiers` (punto 3 de la aceptación)

Puesto S1. Encargo del orquestador del 19-oct («defensivo, sin texto, y hoy no lo manda nadie; rojo primero»).
Es SÓLO el punto 3. Los puntos 1 (dónde vive el gesto, encargo de diseño), 2 (el consumidor), 4 (textos)
y 5 (mover las dos claves de `declaradas` a `retiradas`) siguen sin hacer: **este tramo no cierra el ticket**.

### El defecto

`POST /admin/templates` y `PUT /admin/templates/:id` guardaban `tiers` sin mirar su forma: un objeto, un
texto, dos opciones o una opción sin líneas entraban en la columna. Hoy no lo manda nadie, así que no ha
mordido; el día que exista el consumidor (punto 2) leería como «3 opciones» lo que no lo es.

### Lo construido

| Pieza | Qué hace |
|---|---|
| `templates.routes.ts` (`tiersParaLaBase`) | `tiers` distinto de `null` tiene que pasar `CreateQuoteSchema.shape.tiers`, la MISMA regla que acepta un presupuesto de 3 opciones (no hay una segunda lista). Si no: `400 { error: 'invalid_tiers' }` y no se escribe nada. Lo que se guarda es lo que devuelve esa regla. |
| `tests/scrum1545c-tiers-de-plantilla-con-forma.test.mjs` (nuevo) | el handler real de `dist/` con la base doblada: 9 formas malas → 400 sin escritura (POST y PUT); tres opciones buenas → se guardan; `null` y la clave ausente, como antes |
| `tests/scrum1188d-tiers-tambien-se-vacia.test.mjs` | su fixture `NIVELES` no llevaba `label`; con la regla nueva daba 400. Se le añade. Lo que mide no cambia |

**Sin texto:** el 400 lleva sólo un código, como `name_required` y `lines_required` de la misma ruta.
**`schemas.ts` no se toca:** `CreateQuoteSchema` ya se exporta, y ese fichero tiene coordenadas de línea citadas
en `docs/` que cualquier línea nueva desplazaría.

### Lo que cambia para quien llame a mano, declarado

- `tiers: []` antes se guardaba (una lista vacía); ahora es 400. Vaciar es `tiers: null` (SCRUM-1188d).
- Lo guardado sale de la regla: una opción sin `recommended` se guarda con `recommended: false`, y las claves
  que la regla no declara no se guardan.

### Medido

- **Rojo primero:** el test nuevo contra el código de `main` sin tocar: 4 de 9 caen (los dos «forma mala» y los dos «se guarda como la regla»); el control y los casos de `null`/ausente, verdes.
- Con el cambio: 9 de 9; con `scrum1188c` y `scrum1188d`, 17 pasan y 3 saltan (piden base).
- **Contra Postgres real** (cluster desechable propio, `127.0.0.1`, base `yaqu1545_test`, esquema de `main` por `migrate diff --from-empty`): `scrum1188d` + el nuevo, 13 de 13, los tres de base incluidos.
- **Control de que la regla corre en el camino con base:** el mismo `scrum1188d` con el fixture viejo (sin `label`), copiado aparte y borrado después: caen 2 de 4.
- Tanda dirigida, 542 ficheros (`templates.routes`, `quoteTemplate`, `/admin/templates`, `status(400)`, trinquetes y censos): 5.374 tests, 7 rojos. Míos y arreglados en la rama: `scrum1415` (nombres de test construidos: ahora literales) y `scrum854` (este registro). Los otros 5 (`scrum222` deriva 515/514, `scrum461` ×2, `scrum733` ×2) son el cliente de Prisma local desfasado, la familia conocida que también cae en `main`; no se ha corrido `prisma generate` (orden del orquestador).
