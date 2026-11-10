# SCRUM-1650 · Lectores que pintaban el cliente VIVO donde el documento lo lleva congelado

Partición de SCRUM-1595 (los 5 sitios LIBRES de la medida de S1 en SCRUM-1595 c.21337). Este tramo
construye **2 de los 5**; los otros 3 se paran por el matiz del propio ticket (abajo).

## 2026-11-03 · Listado de albaranes y buscador leen lo congelado

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-03T07:43:06Z (hora de GitHub, `api.github.com/zen`)

A9: comprobación → `tests/scrum1650-listado-y-buscador-leen-el-cliente-congelado.test.mjs`

### ① Qué se ha construido

| # (c.21337) | sitio | qué cambia |
|---|---|---|
| 1 | `albaranesListado.ts` (columna «cliente») + los dos `select` de `albaranes.routes.ts` (admin y técnico) | pide `customerName`/`customerLegalName` y pinta con `clienteDelDocumento`; borrador (columnas a NULL) → ficha de hoy, como antes |
| 7 | `search.routes.ts` (facturas) | pide `customerName` y pinta `customer.name` con `clienteDelDocumento`; la columna cruda no viaja, la forma de la respuesta no cambia. Se sigue BUSCANDO por la ficha viva (eso es encontrar, no pintar: clase c de 1576) |

- Sin esquema, sin ALTER, sin texto nuevo. Nada del camino de emisión: en `albaranes.routes.ts` sólo
  se tocan los `select` del listado (`GET /`), y en la MISMA línea que ya existía, para no mover los
  números de línea del resto del fichero.
- El tipo `LectorListado` exige las dos columnas: un lector que no las pida no compila.

### ② Lo que NO se ha construido, y por qué (los 3 restantes alimentan al FIRMANTE)

El ticket dice: «Si el arreglo cambia de dónde sale el nombre PRECARGADO del firmante, eso toca lo
que se sella: se para y se pregunta antes de construir esa línea». Medido hoy, eso no le pasa sólo
al #3:

| # | sitio | por qué se para |
|---|---|---|
| 2 | `albaranes.routes.ts` `GET /:id` → `customer.name` | la pantalla de firma presencial lo usa como sugerencia del firmante: `albaranDetailView.js:780` (`firmante: { sugerencia: alb.customer.name }`) → `signaturePad.js:120` lo escribe en el campo del nombre |
| 3 | `albaranPublic.routes.ts` `loadContext` | `firmanteCamposHtml(customerName)` (:291) precarga el firmante; y sólo cambiar el saludo haría que la página dijera un nombre y su PDF (#4 de 1595, STOP, lee la ficha viva) otro |
| 4 | `precarga.service.ts` (`clienteNombre`) | su propio comentario: «es la sugerencia de un toque del firmante (SCRUM-300)» |

La medida de c.21337 sólo vio el matiz en el #3. **Los tres esperan la misma respuesta:** ¿el nombre
sugerido al firmante sale del albarán congelado o de la ficha de hoy?

### ③ Pruebas

- Test nuevo, por las rutas reales de `dist/` con el `select` proyectado como Prisma (lo que no se
  pide no viaja): listado como admin y como técnico (los dos lectores) y buscador.
- **Control positivo:** sin el arreglo en `src/` (stash + build), **3/3 rojos** con su mensaje;
  con el arreglo, 3/3 verdes.
- **Mutante** en `dist` (`delDocumento?.legalName || customer?.legalName || …`: la razón social de
  hoy colándose por el hueco de un congelado sin ella): cae el caso del albarán A-2 en los dos roles.
- Vecinos: scrum301, 1483, 1489, 1576, 1576b, 729, 577 → 79 tests, 78 ok, 0 fallos, 1 salto
  declarado (scrum1489 «CON BASE», sin `LIBRO_PG_URL`: corre en el obligatorio del CI).
