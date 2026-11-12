# SCRUM-1712 · el operario ya no escribe precios en un albarán (puerta por campo en el alta y en el PATCH)

**Medido contra:** `origin/main` = `04e2524213149d700f24b07e86892f0e05b5126e` · 2026-11-12T13:01:37Z (hora de GitHub, de `scripts/equipo/ancla.mjs`; sesión S1, por encargo del orquestador `cobroflash-backend-5f`, PILOTO-1)

A9: sin fallo que generalice — el primer rojo del caso «desvalorar» salió 409 de versión y no 200, porque el test reusaba la versión que el PATCH anterior (que sí escribió) había movido; se corrigió el TEST para leer la versión antes de cada intento, y el rojo se volvió a medir entero.

**Cero textos** (el 403 no lleva `message`: es la misma forma que SCRUM-1078, `{error:'forbidden', required_role:'admin', field}`), **cero estados, cero flags, cero esquema.** Es una puerta de escritura.

## ⓪ Qué dice el máster, y qué decide esto

**La Parte S CALLA.** La tabla de capacidades (S1, «implementado; esta tabla es la verdad») no tiene fila de albaranes ni de valorar: el Técnico «Quotes/clientes crear-ver» ✅, «Facturas: emitir/anular/R1» ❌, «Marcar pagado / deshacer» ❌. Nada dice quién escribe los precios de un albarán. Medido con `git show origin/main:docs/YAQU_MASTER.md`, Parte S (líneas 666-895), buscando `albar|precio|valor|operario|técnico|parte`.

**Por eso la puerta es FAIL-CLOSED y se DECLARA aquí**, por encargo del orquestador (mensaje del 12-nov, tarde: «si el máster calla, tu puerta es fail-closed y lo DECLARAS en el registro»). Se apoya en dos decisiones que sí constan:
- **SCRUM-1078**: «precios SOLO admin, petición entera rechazada, como SCRUM-164» en el PARTE (decisión del fundador vía orquestador, `docs/master/SCRUM-1078.md`). El albarán es el mismo papel de obra visto del lado del cliente.
- **SCRUM-1707** (sin mergear): el operario deja de RECIBIR los precios del albarán. Escribir lo que no se puede leer no tiene caso legítimo.

⚠️ **El ticket pedía, si el máster no decidía, una pregunta corta al fundador.** No la he hecho yo: la decisión de construir fail-closed es del orquestador. Si el fundador decide que el técnico SÍ valora en algún caso, se abre la puerta con su motivo; cerrada es el lado seguro.

## ① El rojo, por la ruta real

`tests/scrum1712-precios-del-albaran-solo-admin.test.mjs`, caso «CON BASE», con un Postgres desechable propio (puerto 55716, loopback, base `yaqu_1712_test`, esquema con `prisma migrate diff --from-empty --to-schema-datamodel`, 33 tablas) y sesiones de verdad (`/auth/verify` con `authSession` de un `TeamMember` técnico y otro admin). **Contra `origin/main` sin tocar** (`evidencias/SCRUM-1712/rojo.salida.txt`), el técnico:

| intento | hoy |
|---|---|
| `POST /admin/jobs/:id/albaranes` `{modoValoracion:'VALORADO', lineas:[…precio 40…]}` | **201**: crea un VALORADO con sus precios |
| `PATCH /admin/albaranes/:id` de un SIN_VALORAR → `VALORADO` con precios | **200**: lo valora |
| `PATCH` de un VALORADO de la oficina con `precioUnitario: 1` | **200**: el precio pasa de 40 a 1 |
| `PATCH` de un VALORADO → `SIN_VALORAR` con líneas sin precio | **200**: **borra la valoración de la oficina** |
| `POST` SIN_VALORAR con una línea con precio | 400 `lineas_invalidas` (ya cerraba, por la validación) |

El ticket sólo nombraba escribir precios; **desvalorar** es el cuarto camino y es el peor: no deja rastro de importe.

## ② El arreglo

- `src/core/http/roleCapabilities.ts` · `adminOnlyAlbaranField(body, modoActual)` y `ADMIN_ONLY_ALBARAN_FIELDS`. Para quien no `seesAllJobs`: un `modoValoracion` que no sea quedarse en SIN_VALORAR (contra el modo ACTUAL: así desvalorar también cuenta), o una línea con `precioUnitario`/`tipoIva` presente (misma noción de «presente» que `validarLineas`; un 0 sí es un precio).
- **POR VALOR, no por presencia**, porque la pantalla del técnico manda `modoValoracion:'SIN_VALORAR'` en su alta y su edición de siempre (`public/dashboard/js/jobDetailView.js:2181` y `:3285`). Rechazar el campo por venir le cerraría el día a día (lo prueba la mutación M3).
- Cableado en las dos únicas puertas que escriben `lineas`/`modoValoracion` desde el cuerpo (censo de `albaran.update/create` en `src/`: las demás son emitir, firmar, duplicar, la firma pública, la recapitulativa y la factura, ninguna con precios del cuerpo):
  - `jobs.routes.ts` `POST /:id/albaranes`: después de la pertenencia (lo ajeno sigue en 404) y antes de validar.
  - `albaranes.routes.ts` `PATCH /:id`: después de encontrar el albarán y antes de todo lo demás, con su modo actual.
- `adminRouteDeclarations.ts` · `FIELD_LEVEL_ROLE_GATES` declara las dos (lo exige `scrum164-gate-por-campo`).

**Fuera, a propósito:** `ocultarPreciosEnDocumento` (qué imprime el papel, no cuánto vale) y `POST /:id/duplicar` (copia lo que la oficina ya puso). Un VALORADO en borrador queda sin editar para el técnico salvo `notas`/cabecera/fechas sin modo: su pantalla manda el modo y las líneas, y las líneas sin precio ya daban 400 en VALORADO.

## ③ El verde y las mutaciones

Después: **7/7** (`evidencias/SCRUM-1712/verde.salida.txt`), `tsc --noEmit` limpio. Controles positivos dentro del caso con banco: **la jefa SÍ** crea un VALORADO y **SÍ** cambia el precio (40 → 55, leído de la fila); **el técnico SIGUE** creando (201) y editando (200) su albarán SIN_VALORAR, con la forma exacta del cuerpo que manda su pantalla.

**Dos capas de mutación.** ⓐ Las que quedan para siempre: `MUTACIONES_QUE_ME_TUMBAN` del propio test (6, sobre `src/`), que aplica el meta-guard (SCRUM-745) y que caen en casos **sin banco** — el cableado por AST (que además exige que el PATCH pase el modo actual), la regla y el día a día —, porque un caso de banco se salta en local y el meta-guard lo daría por CIEGO. Un primer guion de evidencia con su lista propia lo tumbó `scrum1387` («banco nuevo fuera del catálogo») y se quitó: el catálogo es el sitio. ⓑ Las medidas UNA vez por comportamiento, sobre `dist/`, ancla única, con el banco, restauradas en bytes (`mutaciones.salida.txt`):

| mutación | cae |
|---|---|
| M1 · el PATCH sin la puerta | valorar, cambiar el precio y desvalorar (y el control de la jefa, porque el técnico ya desvaloró) |
| M2 · el PATCH sin el modo actual | **sólo** desvalorar |
| M3 · la regla por presencia de `modoValoracion` | **los dos controles positivos del técnico** (alta y edición sin precios → 403) |

El POST sin puerta es el rojo de ①. **Meta-guard completo** (`node scripts/meta-guard-mutaciones.mjs`, local): las 6 de 1712, ✔ las 6.

**Tanda entera, con el banco** (`node --test --test-force-exit "tests/*.test.mjs"` con `LIBRO_PG_URL`; TAP a fichero fuera del árbol): 13.386 casos, 13.373 ok, 8 SKIP (ninguno de 1712), **5 rojos, los 5 de esta rama**, arreglados en el código y vueltos a pasar (56/56 en el repaso, con banco):
- `scrum1185` · `ADMIN_ONLY_ALBARAN_FIELDS` exportado y sin consumir → quitado; y los dos handlers pasaban `req.body` ENTERO a la regla, que deja ciego el censo de lo que lee cada ruta → se le pasan sólo `{ modoValoracion, lineas }`.
- `scrum1387` · el guion de mutación con lista propia → al catálogo (ⓐ arriba).
- `scrum419` ×2 · el caso con banco, declarado en el inventario de lo que no corre.
- `scrum480/533` · CR en disco en dos evidencias guardadas con `*>` de PowerShell (el blob ya salía LF) → pasadas a LF.

## ④ Avisos

- **A S4 (pantalla, radar del ticket):** el editor del albarán **le ofrece hoy al técnico** la casilla «Con precios» y los campos de precio en borrador (`jobDetailView.js:2826` en adelante, sin rol). Con esto, si la marca, el servidor responde 403 y la pantalla cae a su texto genérico. El editor no debería ofrecérsela (como `isTecnico` en `jobDetailView.js:814` para las acciones de dinero). Texto nuevo = firma del fundador (regla 39).
- **Con SCRUM-1707 (sin empujar, `s1-1707`):** toca los mismos tres ficheros de `src/` y `scrum164`. Esta rama nace de `main` y no las toca; el choque al fundir se mide y se declara en el apéndice.

**Sin medir:** Linux/CI (lo corre el check obligatorio con su banco desechable); en producción no se ha probado (el arreglo sólo existe en esta rama).
