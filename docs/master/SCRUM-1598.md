# SCRUM-1598 · `bulk-paid`: un id que no cabe en la columna se descarta, como uno que no es entero

## J1 · SCRUM-1598 · `filter(Number.isInteger)` pasa a `filter(cabeEnColumnaInt)` en `POST /admin/invoices/bulk-paid`

**Medido contra:** `origin/main` = `a08813ddf313a8475722bb62e9b1b08039c60ebe` · 2026-10-23T19:54:53Z (hora de GitHub; sesión J1 `jv-j1aw`, por encargo del orquestador `cobroflash-backend-62`)

A9: comprobación → `tests/scrum1598-bulk-paid-id-que-no-cabe.test.mjs`

[Escrito por J1, una sesión; no por el fundador.] La línea `A9:` apunta al test que cae si la lectura de
ids del lote vuelve a `Number.isInteger`: el hueco lo dejó abierto SCRUM-1455c («Lo que no hace este
tramo»), y ahora tiene su caso por la ruta.

**GO:** SCRUM-1598 **c.20641** (fundador, 23-oct-2026, transcrito por el orquestador): respuesta literal
«Ignorarlo». Cubre el cambio de `:464` y que el id que no cabe se descarte igual que uno que no es entero,
con las demás facturas del lote marcadas igual. **No cubre** ningún texto, ningún otro cambio de la ruta
de cobro, ni nada del sellado (regla 40). Leído entero en Jira el 23-oct; es el único comentario del ticket.

### El cambio

- `src/modules/system/app/routes/invoicesAdmin.routes.ts:464` (`POST /bulk-paid`):
  `req.body.ids.map(Number).filter(Number.isInteger)` → `req.body.ids.map(Number).filter(cabeEnColumnaInt)`.
  El `import` ya estaba (`:30`, SCRUM-1379). El helper es de S1 y no se toca.

Nada más: ni el `where` (sigue con `merchantId: req.merchantId`, regla 2, y con `NO_SE_MARCAN_PAGADAS_EN_LOTE`),
ni la fecha, ni la auditoría, ni ningún texto. Un lote que sólo traía ids que no caben contesta ahora
`400 no_ids`, que es lo que la ruta ya contestaba a un lote de sólo no enteros: no nace una respuesta nueva.

### Rojo → verde, por la ruta

`tests/scrum1598-bulk-paid-id-que-no-cabe.test.mjs`, copiado del modelo de `scrum1455c`: las peticiones
entran por HTTP en un `express` montado como `src/app.ts` (`/admin/invoices`, con el `requireRole('admin')`
de la propia ruta); sólo `requireAuth` se sustituye, por `reqDeSesion`. La base doblada lanza, como
Postgres, si le llega un número que no cabe en un int4, y `invoice.updateMany` marca sobre una tabla
doblada que respeta `id in` + `merchantId` (el `updated` sale de lo que pide la consulta).

- **Antes del arreglo** (`dist/` compilado con `tsc --noCheck` sin tocar `src/`): 5 casos, **3 pasan, 2 caen**;
  el lote `[1,99999999999999999999,2]` contesta **500**.
- **Después:** 5 de 5.
- Casos: lote con un id que no cabe (`99999999999999999999`, `2147483648`, `10000000000`, `-2147483649`)
  → 200 y se marcan 1 y 2 · lote sólo con `99999999999999999999` → mismo cuerpo que `["abc"]` (400) y cero
  consultas · CONTROL: `[1,2,3,2147483647]` se marca entero · CONTROL regla 2: `[1,7]` con la 7 de otro
  merchant marca sólo la 1 · CONTROL: `abc` y `1.5` se descartan igual que hoy.
- **Mutación declarada sobre `dist/`** (nunca sobre `src/`): en
  `dist/modules/system/app/routes/invoicesAdmin.routes.js`, el literal
  `map(Number).filter(enteroDeColumna_1.cabeEnColumnaInt)` → `map(Number).filter(Number.isInteger)` (casa
  una sola vez): **caen los 2 casos 🔴 y pasan los 3 controles**. `dist/` restaurado desde copia y
  comprobado por recuento del literal.

### Lo corrido, con su población

- **Guards de suite y de registro** (21 ficheros: 237, 976, 824 + 824b ×2, 836, 419, 702, 700, 719, 113, 262,
  1415, 745, 757, 765, 1294, 267, 273, 622, 1344) **más el test nuevo: 223 tests, 223 pasan, 0 caen, 0 se
  saltan** (TAP a fichero fuera del árbol). Corrido ANTES de escribir este registro; la suite entera, abajo,
  es la que lo mide a él.
- **Suite entera local: NO CORRIDA.** Lanzada una vez en primer plano con `timeout 530`; la cortó ese
  límite (salida 124) y el TAP quedó **sin resumen**: 8.635 casos numerados, 17 `not ok`, sin total que
  sumar. Lo que se leyó de esos 17, sin darlo por medido: ninguno nombra `bulk-paid` ni `invoicesAdmin`;
  los que se abrieron caen por el entorno de este árbol anidado (sin `node_modules` propio: `scrum1199`
  da `Cannot find module …\node_modules\express`; 245, 351, 385, 475 y 476 piden el CLI de Prisma o el
  censo de `node_modules`). `scrum534b` suelto no acabó en 200 s y lo paré sin leerlo. El obligatorio de
  CI hace de suite.

### Lo que no hace este tramo, dicho

- **No visto en yaqu.app:** no lo he intentado. Es un POST que marca facturas como cobradas (dinero), con
  sesión de admin; no tengo credenciales ni las busco.
- **No medido:** qué hace la pantalla del lote con un id así. La única llamada del repositorio,
  `public/dashboard/js/invoicesView.js:486`, manda los ids de `selectedIds`, que se llena con `inv.id` (`:626`)
  y con `Number(cb.dataset.id)` de las filas pintadas (`:515`): ids leídos de la base, así que un id que no
  cabe sólo llega por una petición hecha a mano. Leído, no ejecutado.
