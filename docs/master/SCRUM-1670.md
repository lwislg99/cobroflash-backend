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

## SCRUM-1670c · La TARJETA de Trabajos dice el tipo de intervención (18-nov-2026)

**Puesto:** S4 · **Rama:** `scrum-1670c-tarjeta-tipo-intervencion` · mitad TARJETA (la ficha es de S2, SCRUM-1670b)
**Skill UI:** cargada (`yaqu-premium-ui`, antes de editar. `DESIGN.md` no se releyó entero: el cambio no trae token, color ni cuerpo nuevo; reutiliza la regla que ya pinta la dirección de la tarjeta)
**Medido contra:** `origin/main` = `f63ec0dda6aa86266cfef48d113735d12f0dc390` · 2026-11-18T11:30:20Z (cabecera `Date:` de `gh api -i zen`). El banco corrió minutos antes con el árbol sobre `25b6c8f9c7edaf4eb7ded049abdd59d75a22974a`; entre las dos puntas `main` sólo movió tres ficheros de `docs/` y `.claude/`, ninguno de `public/`.
A9: sin fallo que generalice — el único tropiezo fue un parámetro por defecto mal usado en el test nuevo, visto en su primera pasada y antes de cualquier commit

### La decisión (no es mía: se cita)

Propuse la forma ANTES de construir y la aprobó el orquestador por delegación del fundador: **SCRUM-1670 c.22036**, que cita la delegación general **SCRUM-1656 c.21978**. Literal de su respuesta: «SÍ a la propuesta A TAL CUAL (sin rótulo, valor del vocabulario, renglón propio entre cliente y tarea, --muted con la regla de la dirección, null→sin renglón)».

**Cero textos nuevos.** Lo que se pinta es el rótulo que el servidor ya da en `/admin/me` → `tiposIntervencion` (firmados en SCRUM-703). No se escribe «Tipo de intervención» delante: los tres valores se explican solos y en móvil la columna del cliente mide unas 19 letras por línea.

### El defecto, visto hoy

En yaqu.app, cuenta QA, 9 tarjetas en la lista de Trabajos y **0** dicen qué clase de trabajo es, aunque 5 de esos trabajos tienen tipo de intervención y la lista ya lo trae desde SCRUM-1670 (`evidencias/SCRUM-1670/antes-390.txt` y `antes-1280.txt`, línea `TESTIGO`).

### Qué cambia

- `public/dashboard/js/jobsView.js`, `jobRow`: bajo el nombre del cliente nace un renglón `.jobs-fila-tipo` con el rótulo que corresponde a `j.tipoIntervencion` en `window.appTiposIntervencion`. Sin tipo, o con un valor que el vocabulario no conoce, no nace nada: el código crudo no se pinta nunca. Ninguna lista de tipos en el navegador.
- `public/dashboard/css/styles.css`: `.jobs-fila-tipo` se suma a los selectores que ya pintan `.jobs-fila-direccion` (13 px, peso 400, `--muted`, una línea en escritorio y dos en móvil, tope de 46ch). Ninguna declaración nueva.
- No toca la ficha, ni el servidor, ni el modal.

### Medido en la página real, con el front del árbol servido encima de producción

Instrumento: `docs/master/evidencias/SCRUM-1670/c1670c-tarjeta.mjs` (acción del banco H6; no escribe). Cuatro pasadas, las cuatro con código de salida 0. Población: 9 tarjetas, idéntica en las cuatro.

| | ANTES (producción) | DESPUÉS (árbol) |
|---|---|---|
| tarjetas con el tipo, a 390 y a 1280 | 0 de 9 | 5 de 9 |
| tipo que NO es un rótulo del vocabulario de la página | — | 0 |
| tipo que no va justo debajo del cliente | — | 0 |
| tipo con cuerpo, peso o color distinto de la dirección | — | 0 (13px · 400 · `rgb(106, 116, 110)` los dos) |
| desborde de la página | 0 | 0 |

- A 1280 el tipo ocupa una línea en las cinco. A 390, «Reparación / Asistencia técnica» ocupa dos (sin cortar) y «Mantenimiento» una.
- Las cinco: cuatro «Reparación / Asistencia técnica» (entre ellas el trabajo QA #86) y una «Mantenimiento». «Instalación» no la lleva ningún trabajo de la cuenta: no vista en pantalla, sí en el test.
- Capturas: `evidencias/SCRUM-1670/antes-390.png`, `antes-1280.png`, `despues-390.png`, `despues-1280.png`.

### El test

`tests/scrum1670c-tarjeta-tipo-intervencion.test.mjs`: 6 casos sobre el banco de vistas, con el vocabulario REAL (`tiposIntervencionParaUI()`, 3 tipos). Ata: cada tipo pinta su rótulo una vez y sin el código crudo; va entre el cliente y la tarea; sin tipo o con valor desconocido no nace renglón; y el rótulo sale del vocabulario que da el servidor (con otro rótulo para el mismo valor, la tarjeta dice el otro; sin vocabulario, nada).

- Con el cambio: 6 de 6. Con el `jobsView.js` de `origin/main` en su lugar: caen 3 (los que piden el renglón) y pasan los 3 que sólo niegan.
- La familia: los 38 ficheros de `tests/` que nombran `jobsView`, `jobs-fila` o los censos de clases, más `scrum1233g` y `scrum703`: 359 pruebas, 0 fallos (TAP a fichero fuera del árbol).
- NO corrida: la suite completa (no tenía el turno, y la máquina marcaba 1.520 MB libres, bajo el umbral). La juzga el check de CI.

### Aceptación → dónde se ve

Las filas son las de la decisión c.22036 (la aceptación literal de Jira no la ha leído esta sesión: no tiene Rovo).

| aceptación | dónde se ve |
|---|---|
| El valor del vocabulario del servidor, sin rótulo delante | `tests/scrum1670c-tarjeta-tipo-intervencion.test.mjs` (casos 2 y 6) · `evidencias/SCRUM-1670/despues-390.txt`, líneas `VOCABULARIO` y `TESTIGO` |
| Renglón propio entre el cliente y la tarea | mismo test (caso 3) · `evidencias/SCRUM-1670/despues-390.png` y `despues-1280.png` |
| `--muted`, con la regla de la dirección | `despues-390.txt` y `despues-1280.txt`: cuerpo, peso y color calculados iguales a los de la dirección en las 5 tarjetas |
| `null` → sin renglón | mismo test (casos 4 y 5) · en pantalla, 4 de las 9 tarjetas no pintan renglón de tipo |
| Visto en yaqu.app con el código DESPLEGADO (regla 42) | NO HECHO todavía → S4, cuando este PR mergee y despliegue: la tarjeta del trabajo QA #86 tiene que decir «Reparación / Asistencia técnica» |

### Lo que NO está hecho o no se ha medido

- La regla 42 (fila de arriba).
- El operario: las pasadas son con la cookie de administrador.
- Un teléfono de verdad y Safari (`-webkit-line-clamp`), como en SCRUM-1679.
- La ficha (SCRUM-1670b, S2) trae su propia función `rotuloDeTipoIntervencion` en `jobTrabajoPlegable.js`. Aquí la búsqueda va dentro de `jobRow`, sin función global, para no chocar con ese nombre mientras su PR sigue abierto. Cuando las dos estén en `main`, la tarjeta puede llamar a la de la ficha y quedar una sola.
