# SCRUM-1670 · P0 · El tipo de intervención elegido al crear no se ve en ningún sitio — mitad SERVIDOR

**Medido contra:** `origin/main` = `e5145bc54e9709de09ac362a6d6c4d156bb32ac4` · 2026-11-17T16:58:41Z (fecha de commit de esa punta) · **Rama:** `scrum-1670-tipo-intervencion-viaja` · **Carril:** S1.
A9: comprobación → `tests/scrum1670-tipo-intervencion-viaja.test.mjs`

## La pregunta del encargo: ¿lo GUARDA y no lo devuelve, o lo PIERDE?

**Lo guarda y no lo devuelve.** Tres mediciones, de la más barata a la más cara:

1. **Esquema:** la columna existe — `Job.tipoIntervencion String? @map("tipo_intervencion")` (SCRUM-651). Sin
   esquema nuevo, sin A5/ALTER.
2. **Código:** `POST /admin/jobs` crea con `filaDeTrabajoDirecto` (`src/modules/jobs/domain/trabajoDirecto.ts`),
   que escribe `tipoIntervencion`. Las tres respuestas (POST, la lista `GET /admin/jobs` y la ficha
   `GET /admin/jobs/:id`) salen de `serializeJob`, que **no tenía la clave**. La proyección por rol
   (`trabajoParaElRol`) copia con `...trabajo`, así que no quitaba nada: no le llegaba.
3. **Banco desechable** (Postgres propio en loopback, base `yaqu_1670_test`, esquema por `migrate diff --from-empty`):
   en el rojo, la aserción «la fila GUARDA el tipo» **pasó** y las seis de «la respuesta lo DEVUELVE» fallaron.
   Corrobora lo de producción del 11-nov (`docs/master/SCRUM-1674.md`): el parte abierto desde el trabajo #81,
   creado por POST con `MANTENIMIENTO`, heredó «mantenimiento» leyéndolo de esa fila.

## El arreglo

Una clave en `serializeJob` (`src/modules/jobs/app/routes/jobs.routes.ts`):
`tipoIntervencion: job.tipoIntervencion ?? null`. Aditivo; `null` = no consta, sin valor por defecto. Al ser el
serializador común, llega a las tres respuestas a la vez. La proyección por rol queda intacta: el tipo no es
dinero ni nota interna, así que el operario lo ve (es lo que hereda su parte, SCRUM-1674).

Sin textos (regla 39): no se añade ningún rótulo; la pantalla es de S4.

## La otra mitad del síntoma — MI LECTURA, para S4

«Tipo de trabajo: Una obra o reforma de varios días» en la ficha del #84 **no es el tipo de intervención**: es el
rótulo de `tipoOperacion = 'TRABAJO_UNICO'` (la bandera fiscal de SCRUM-66, valor por defecto de todo trabajo) en
`public/dashboard/js/jobDetailView.js:1431`. Por eso «enseña otro tipo»: son dos campos distintos con un nombre
parecido. Pintar `tipoIntervencion` en la ficha y en la tarjeta, y decidir cómo convive con ese rótulo, es de S4
(y el rótulo, texto: regla 39).

## Pruebas

- **Rojo primero** (sin el arreglo, banco desechable): 6 fallos, todos por el motivo esperado — ① POST y ficha sin
  el tipo · ② POST y ficha sin `null` (clave ausente) · ③ lista sin el tipo y sin `null`. La fila guardaba el tipo.
- **Verde:** el nuevo + 1674, 651, 816 → 37/37 ✔ con `LIBRO_PG_URL` al banco desechable.
- Control ② sin tipo → `null` en fila y respuestas; control ④ un valor fuera del vocabulario → 400 (SCRUM-651).
- Proyección por rol: test sin banco — el técnico ve el tipo y sigue sin ver notas ni dinero.
- **En yaqu.app:** pendiente del merge (crear un trabajo con tipo en la cuenta QA y leer `tipoIntervencion` en la
  respuesta del POST y en `GET /admin/jobs/:id`).

### 18-nov-2026 · el rojo de #3199 era PROPIO
- CI de `f22ba6847` (medido por S2): 2 ✖ en `scrum419-ci-declara-lo-que-no-corre` (l.510 y l.630), «se declaran 175 y hay 176». El gateado nuevo de este ticket no estaba en el inventario.
- Arreglo: `scrum1670-tipo-intervencion-viaja.test.mjs: 1` declarado en `GATEADOS_DECLARADOS`, con su motivo. El total se deriva con `.reduce()`: no hay cifra a mano. Merge de `origin/main` (iba 85 por detrás).
- Verde: `scrum419` 8/8 (TAP a fichero fuera del árbol, 0 `not ok`).
- ⚠️ `tsc --noEmit` NO verde EN ESTE ÁRBOL: 10 errores, todos `InvoicePayment`/`FiscalPlazoEstado`. Es el cliente de Prisma compartido, que va por detrás del schema de main (el guard: causa A+B). Este árbol cuelga del `node_modules` compartido, así que no regenero (trampas-del-entorno §10). No toca este diff; lo juzga el check de CI.

## 18-nov-2026 (S2) · la FICHA pinta el tipo de intervención

**Medido contra:** `origin/main` = `d69ccd51362c2861389ebc632a843e971330b406` · 2026-11-18T08:19:36Z · **Rama:** `scrum-1670b-ficha-tipo-intervencion` · **Carril:** S2
**Skill UI:** cargada (`yaqu-premium-ui`) · no hay token, color ni componente nuevo: reutiliza la línea plegable de 917g en su variante fija (`sinCuerpo`)
A9: comprobación → `tests/scrum1670b-ficha-tipo-intervencion.test.mjs`

**Forma aprobada** por el orquestador con la delegación de firma: SCRUM-1670 **c.22019** (propuesta de S2, aprobada tal cual).

- **Qué se pinta.** Una línea de SOLO LECTURA en «El trabajo», justo DEBAJO de «Tipo de trabajo». Rótulo: «Tipo de intervención». No es un texto nuevo: es el mismo literal que rotula ese campo en el alta (`jobNuevoModal.js`, `tn-tipo`), y vive en `ROTULO_TIPO_INTERVENCION` (`jobTrabajoPlegable.js`), fuera de `TEXTOS_EL_TRABAJO` por la misma razón que `ROTULO_TAREA`. Valor: el rótulo que manda el servidor (`/admin/me` → `tiposIntervencion`), resuelto por `rotuloDeTipoIntervencion`. El navegador no tiene su propia lista del vocabulario.
- **Convivencia (c.21989).** «Tipo de trabajo» sigue siendo `tipoOperacion`, la bandera fiscal, con sus dos tarjetas: no se toca ni se mueve. Las dos líneas dicen «qué clase de trabajo es», pero son datos distintos y con rótulos distintos.
- **Sin dato, sin línea.** Con `null`, con un valor que el vocabulario recibido no nombra o sin vocabulario no se pinta nada: ni «Sin especificar» ni el valor de la enum en bruto. La ven el jefe y el operario, porque no es dinero.
- **Por qué no se edita:** un editor pediría textos de guardado sin firmar (regla 39). El tipo se elige en el alta.

**Pruebas.**
- Rojo primero: 5/7 ✖ sin el cambio. Los 2 negativos (sin línea) pasaban por vacío, y por eso hay mutación.
- Verde 7/7. Mutación «si el servidor no lo nombra, pinta el valor en bruto» → cae «NO se pinta en bruto».
- `scrum651` (fuente única del vocabulario) cayó con la primera versión del test, que COPIABA los tres valores. El guard tenía razón: ahora el test los importa de `dist/modules/jobs/domain/tipoIntervencion.js`.
- Vecinos (115 ficheros que leen la ficha, el plegable o el vocabulario): 1031 tests, 0 fallos tras ese arreglo.
- **Vista previa en yaqu.app ANTES del merge** (sonda de solo GET `sondas-s2/prod-1670b-tipo-intervencion.mjs`, fuera del repo; LOCAL_DIR = este árbol). Prod aún no devolvía la clave (`tipoServidor: (sin clave)`), así que `tipoIntervencion = MANTENIMIENTO` se INYECTÓ en la respuesta del GET, y queda declarado. Trabajo #77, 390 y 1280, admin real y operario SIMULADO en el front: 6/6 OK (línea justo debajo de «tipo», rótulo y valor, fija, desborde 0, 0 errores). Control `null` forzado: sin línea. Capturas fuera de git (`sondas-s2/evid-1670b-ficha/antes-del-merge`).
- **Pendiente (regla 42):** tras el merge, la misma sonda SIN inyectar, sobre un trabajo creado con tipo.
