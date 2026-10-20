# SCRUM-1569 · ① J3 — la línea de `contactName` en `CAMPOS_PERSONALES`

**Medido contra:** `origin/main` = `139c5b34c5e202226d060bb0f7aaf8a0c57a7cca` · 2026-10-20T10:33:20Z (banco y R3 medidos sobre `e0c32fb5297e0ea98383d9f983ed8abfa67553c2`; lo que entró entre los dos es #2623, SCRUM-1456b, y no toca ningún fichero de esta rama)
A9: comprobación → `tests/scrum497-dato-personal-no-sobrevive.test.mjs`

Puesto J3 (`jv-j3b`) · árbol `j3b-1569-la-linea`. Encargo del orquestador `cobroflash-backend-09`. La medición
de partida es de `jv-j3a` y `jv-j4b` (SCRUM-1569 c.20092, c.20101, c.20103; PR #2624) y **no** se ha repetido salvo
el banco de antes/después de esta línea.

## La línea

`src/modules/system/domain/anonimizarMerchant.ts`: `customerSite: ['phone']` → `customerSite: ['phone', 'contactName']`.
Solo se añade; no se quita ninguna entrada.

**`phone` ya estaba cubierto, y por esta misma línea**: `main` llevaba `customerSite: ['phone']` desde SCRUM-1014.
El literal que midió J4 (`['phone', 'contactName']`) sobraba a medias: lo único nuevo es `contactName`. Ninguna otra
vía de `suprimirMerchant` toca `customer_sites` (`borradoMerchant.ts` lo lista, pero ese es el borrado, no el
anonimizado: lo dice su propio comentario de la línea 76).

## El rojo primero: banco PGlite de J4, sin escribir otro

`docs/master/evidencias/SCRUM-1569/banco-sitio.mjs` de #2624 (`da3c41e80`), byte a byte el mismo que el `sitio.mjs`
del banco de `jv-j4b` (`cmp` sin diferencias). PGlite copiada de ese banco, DDL regenerado desde el esquema de esta
rama (`migrate diff --from-empty`, 33 `CREATE TABLE` = 33 modelos). `dist` con `tsc --noCheck`, dos veces: con el
fichero de `origin/main` y con el de esta rama.

| campo de `customer_sites` | A, antes (`main`) | A, después (esta rama) | B, el vecino, en los dos |
|---|---|---|---|
| `contact_name` («Luis el portero») | **EN CLARO** | redactado | intacto |
| `phone` | redactado | redactado | intacto |
| `name`, `address`, `city`, `postal_code`, `province`, `country` | en claro | **en claro (control negativo)** | intacto |

`suprimir: ok=true` en los dos. `updateMany` pedido al sitio: antes `customerSite:phone`, después
`customerSite:phone,contactName`. Testigo del banco al final de las dos salidas: `TESTIGO: el banco corrio entero · EXIT=0`.

## El trinquete: en `main` no se mueve; con #2624 baja de 45 a 44

- **Sobre `main`** (censo por nombre exacto): `scrum497` + los seis `scrum244` = 64 tests, 63 ✔, 0 ✖, 1 saltado
  (el de Postgres, «sin LIBRO_PG_URL»). El trinquete sigue en **16**: ese censo no ve `contactName`, así que añadirlo
  no lo mueve.
- **Con los dos ficheros de test de #2624 puestos un momento encima** (`git checkout da3c41e80 --` de
  `tests/_censo-datos-personales.mjs` y `tests/scrum497-…`, restaurados después; `git status` solo enseña el `.ts`):
  14 tests, 13 ✔, **1 ✖, el TRINQUETE**: «el trinquete da 44 pendientes y eran 45 (…) si BAJA a 44 porque entró esa
  línea, quita su entrada de `SIN_DECIDIR` y pon 44 aquí». Lo que nombra es **`customerSite.contactName`**, y nada más.

**Esa entrada no existe en `main`**: la trae #2624. Así que quitarla le toca a la rama que entre SEGUNDA: si entra
antes esta, el CI del merge de #2624 sale rojo con ese mensaje; si entra antes #2624, el de esta. No es una nota:
es el trinquete el que lo hace cumplir.

⚠️ Las dos ramas crean este fichero: la segunda en entrar tendrá un conflicto add/add aquí, y un PR con conflicto
no dispara el CI. Se resuelve juntando los dos tramos.
