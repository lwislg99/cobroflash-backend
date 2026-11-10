# SCRUM-1501 · scrum475 compara la estructura del modelo, no sus comentarios

**Medido contra:** `origin/main` = `5d7ed59e0c6d6b313c2303d9498bb6c125299430` · 2026-10-23T20:30:25Z (hora de GitHub; el que se mezcló en la rama)

A9: comprobación → `tests/scrum475-schema-vs-sql.test.mjs`

Puesto J6 (sesión `jv-j6ay`, equipo de Javier). Decisión del fundador en SCRUM-1501 c.20653: «Que compare solo estructura».

## Ⓐ Qué se toca

| fichero | qué |
|---|---|
| `tests/scrum475-schema-vs-sql.test.mjs` | el caso «línea a línea» compara con `estructuraDelModelo`: quita el comentario `//` de cada línea (respetando las cadenas entre comillas), la sangría y las líneas vacías. Nuevo caso `SCRUM-1501 · AUTOPRUEBA` sembrado, y cinco mutaciones declaradas en `MUTACIONES_QUE_ME_TUMBAN` |
| `prisma/schema.prisma` | SOLO dos comentarios de `EmailMessage` (`kind` y `relatedType`), con las líneas A9 y A10 de SCRUM-1401 c.18779, firmadas en c.18780 |
| `docs/master/evidencias/scrum1501/` | el conductor de mutaciones y sus salidas, y las dos salidas del preview |

No se toca el bloque ```` ```prisma ```` de `docs/master/SCRUM-475.md` (entrada aprobada de otro ticket): sigue con sus comentarios viejos, y ya no hace falta que coincidan.

## Ⓑ Las mutaciones, ANTES y DESPUÉS (las mismas)

Conductor: `docs/master/evidencias/scrum1501/mutar475.mjs`. Aplica cada mutación al bloque de `docs/master/SCRUM-475.md`, corre SOLO el caso «línea a línea», lee su línea del TAP (una y sólo una, o dice CIEGO) y restaura los bytes, verificados.

| mutación | ANTES (`origin/main`) | DESPUÉS (`555b3aec`) |
|---|---|---|
| 0 · base sin mutar | PASA | PASA |
| 1 · un campo de más | CAE | CAE |
| 2 · un tipo cambiado (`Int` → `BigInt`) | CAE | CAE |
| 3 · `@unique` quitado | CAE | CAE |
| 4 · un índice distinto | CAE | CAE |
| 5 · un campo comentado (`// error String?`) | CAE | CAE |
| 6 · SOLO un comentario distinto | CAE | **PASA** ← el cambio decidido |

Salidas literales: `antes.txt` y `despues.txt`. Las cinco de estructura (1-5) van declaradas en el propio guard, con literal (scrum745/757/765), y el conductor las toma de ahí (`mutacionesDeclaradas`); `--solo-censo` del meta-guard las cuenta (730 declaraciones). La 6 no se puede declarar: el meta-guard sólo sabe de mutaciones que tumban.

⚠️ `antes.txt` salió de la primera versión del conductor, que llevaba la lista escrita dentro con los MISMOS literales: contra el guard de `origin/main` no hay catálogo del que leerlas. `despues.txt` es de la versión que sí lee el catálogo.

Lo que me salió mal, dos veces, y lo cazó un instrumento las dos: la primera pasada del conductor dijo CIEGO en las siete (le pasé al hijo `NODE_TEST_CONTEXT` vacío en vez de quitarlo); y la versión con lista propia la tumbó `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs` (vía `guards:entrada` de scrum976), por traer su lista en vez de tomar la del catálogo. Se arregló el banco, no el guard.

## Ⓒ El esquema: sólo comentarios

- `node scripts/preview-migracion.mjs --desde <esquema anterior>`: «✔ control positivo: la herramienta responde (33 tablas)» y «✔ sin cambios pendientes» (`preview.txt`).
- Control positivo del mismo instrumento: el esquema anterior con un campo sembrado da `DROP COLUMN "sembrado"` y sale con código 2 (`preview-sembrado.txt`). La siembra casó en dos modelos, `whatsapp_messages` y `email_messages`.
- Quién trata un cambio solo de comentarios como cambio de esquema: el hook `guard-dangerous.mjs` sólo para `db pull` y `db push`, no una edición; y los 84 ficheros de test que leen el esquema pasan con el cambio (Ⓓ).
- Los dos textos firmados siguen siendo ciertos hoy (leído en el código): `CLASES_DE_CORREO` está en `src/modules/messaging/domain/registroDeEnvios.ts:87`, y de `EmailMessage.relatedType` sólo pasa valor `email.service.ts` (`:52` invoice, `:242` quote). Es un barrido por texto: un suelo, no un censo.

## Ⓓ Tandas

| qué | ficheros | casos | pasan | caen | saltan |
|---|---|---|---|---|---|
| `scrum475` entero | 1 | 6 | 6 | 0 | 0 |
| guards de suite (237, 976, 824 ×3, 836, 419, 702, 700, 719, 1415, 475, 745, 757, 765) | 18 | 215 | 215 | 0 | 0 |
| todos los `tests/*.test.mjs` que nombran `schema.prisma` o `SCHEMA_POR_DEFECTO` | 84 | 932 | 923 | 0 | 9 |

Los 9 saltados piden `LIBRO_PG_URL` (banco desechable): no los he corrido. Árbol anidado: `dist/` con `tsc --noCheck`, y `node_modules` enlazado por junction al del checkout compartido durante la medición (sin `prisma generate`), quitado después. No se corrió la tanda completa.

## Ⓔ De paso, sin arreglar

`registroDeEnvios.ts` y el bloque de `docs/master/SCRUM-475.md` siguen enumerando la lista vieja en comentarios. El primero es `src/` y no entra en la decisión; el segundo es la entrada aprobada de otro ticket. Ya no los ata ningún guard.
