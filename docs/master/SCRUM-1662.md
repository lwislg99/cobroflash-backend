# SCRUM-1662 · TRABAJOS · «Qué hay que hacer» en su campo propio, que el operario SÍ ve (PILOTO-1)

**Medido contra:** `origin/main` = `acac25dbac0dbb870f6dbda9f240df3664326c2d` · 2026-11-12T08:03:59Z (fecha de commit de esa punta, #3069) · **Rama:** `scrum-1662-que-hay-que-hacer` · **Carril:** S1.

A9: comprobación → `tests/scrum1662-que-hay-que-hacer.test.mjs`

## Origen y firma

- **El defecto** (medido el 11-nov en yaqu.app, SCRUM-1674 c.21544): la descripción del alta de un trabajo
  caía en `Job.notes`, que la ficha pinta como «Notas internas · Solo tú las ves» (`textarea#job-notas-internas`).
  La tarea acababa en las notas privadas del jefe.
- **FIRMADO** por el fundador (c.21548, literal de la opción elegida): «Columna nueva — Campo propio con el
  rótulo "Qué hay que hacer" que el operario SÍ ve en su trabajo. […] Las notas internas siguen siendo
  privadas: la promesa "Solo tú las ves" no se rompe.» El rótulo «Qué hay que hacer» queda firmado con esa
  respuesta.
- **A5:** DDL de `node scripts/preview-migracion.mjs` (c.21552): `ALTER TABLE "jobs" ADD COLUMN "que_hay_que_hacer" TEXT;`
  Aplicado y verificado en PRODUCCIÓN y STAGING (c.21553). **La tercera base (`yaqu_dev_javier`) falta por
  confirmar**: la aplica el carril de Javier. **Este PR no se abre hasta esa confirmación** (la rama no se
  empuja: empujar abre el PR solo).

## Qué cambia (servidor; la pantalla es pieza aparte de S2)

- `prisma/schema.prisma` · `Job.queHayQueHacer String? @map("que_hay_que_hacer")`: nullable, sin default. Los
  trabajos anteriores quedan en `null`; **no se copia nada desde `notes`**, que se escribieron como privadas.
- `src/modules/jobs/domain/trabajoDirecto.ts` · `filaDeTrabajoDirecto`: la `descripcion` del alta va a
  `queHayQueHacer`; `notes` ya no se escribe en el alta (nace `null`).
- `src/modules/jobs/app/routes/jobs.routes.ts`:
  - `serializeJob` devuelve `queHayQueHacer` (lista, detalle, respuesta del POST y del PATCH).
  - `PATCH /admin/jobs/:id` acepta `queHayQueHacer`: recorta, tope 2.000 (el del alta), vacío → `null`.
    **No es admin-only**: la regla por campo de SCRUM-120/164 reserva al admin lo que toca dinero o fiscal;
    la tarea es operativa, como `titulo` (SCRUM-317). El operario la lee y la edita en SUS trabajos.

## Comprobación

- **Banco desechable** propio (Postgres 16 portátil, `127.0.0.1:55862`, base `yaqu_1662_test`, esquema de la
  rama con `prisma migrate diff --from-empty` local 6.18.0: 33 tablas, `que_hay_que_hacer` dentro).
- **Rojo primero** (código viejo en `dist`, test nuevo): 2/2 en rojo, cada uno por su causa: la fila no lleva
  `queHayQueHacer`; la tarea cae en `notes`; ni el POST ni el GET la devuelven; el PATCH no la edita; el
  operario no la ve.
- **Verde:** el test nuevo + vecinos con banco (120, 164, 317, 424×2, 427×2, 467, 651, 849, 917d/f/g/i, 992,
  1671, 1674, 1690, 1706) → **127/127, 0 saltos**.
- Declarado en `GATEADOS_DECLARADOS` (SCRUM-419).
- **En yaqu.app:** tras el merge, un alta con descripción en la cuenta QA y `GET /admin/jobs/:id` con
  `queHayQueHacer` lleno y `notes` vacío (regla 42).

## Hallazgo (11-nov) — decidido el 12-nov, ver el apéndice

`notes` («Notas internas · Solo tú las ves») **le llega hoy al operario**: `serializeJob` la devuelve a todos
los roles, el `PATCH` se la deja editar (es justo lo que SCRUM-120 escribió el 23-jul: «Técnico ✅: status,
scheduledAt, notes», y lo fija `tests/scrum120-patch-job-roles.test.mjs`), y va en el `DESCRIPTION:` del `.ics`.
El rótulo «Solo tú las ves» llegó DESPUÉS (SCRUM-427/917g, reutilizado de Presupuestos), sin revisar esa
regla. La firma de c.21548 dice que las notas internas siguen privadas. Propuesta enviada al orquestador; no
se cambia sin decisión, porque cambia la regla de SCRUM-120 y su test.

## Apéndice (12-nov) · las notas internas, SOLO del jefe

**FIRMADO** por el fundador (SCRUM-1662 **c.21555**, literal de la opción elegida): «Ocultarlas al operario — Las
notas pasan a ser SOLO del jefe, como promete el rótulo: el operario deja de verlas y de poder editarlas, y
tampoco van en el archivo de calendario. La tarea del operario vive en "Qué hay que hacer". Sin textos nuevos.»
Supera la regla de SCRUM-120 (23-jul: «Técnico ✅: status, scheduledAt, notes»), anterior al rótulo «Solo tú las ves».
Va en esta misma rama y con el mismo gate de la 3.ª base (c.21555).

### Qué cambia

- **(a) Lectura** · `src/modules/jobs/domain/trabajoParaElRol.ts` (nuevo): `trabajoParaElRol(s, rol)` deja
  `notes: null` para quien `seesOnlyOwnJobs` (la clave se conserva: misma forma para todos). Se aplica en las
  CINCO respuestas de `jobs.routes.ts` que llevan el Trabajo: lista, detalle, POST, PATCH y (por su campo) el
  `.ics`. **Por qué una proyección y no un parámetro de `serializeJob`:** las firmas y las llamadas de
  `serializeJob`/`serializeJobDetail` las fijan por texto los guards de SCRUM-58, 363 y 816; meterles el rol
  los ponía en rojo sin que su garantía cambiara (regla 41).
- **(b) Escritura** · `adminOnlyJobField` añade `notes` → **403** `{field:'notes'}`, fail-closed (mezclado con un
  campo legítimo se rechaza entero; con un campo de dinero mezclado el 403 sigue nombrando el de dinero, por eso
  va el último). `ADMIN_ONLY_JOB_FIELDS` y `FIELD_LEVEL_ROLE_GATES` (`adminRouteDeclarations.ts`) lo llevan,
  con su motivo; el comentario SCRUM-164 de `roleCapabilities.ts` cita la firma.
- **(c) Calendario** · `descripcionDelCalendario(job, rol)`: el `DESCRIPTION:` del `.ics` lleva `notes` para el
  jefe (como hasta hoy) y `queHayQueHacer` para el operario.
- **(d) Máster** · la tabla `## S1. Roles` (Parte S) **no nombra `notes`** para el técnico (medido en
  `origin/main` `6cf6a8176`): no hay nada que actualizar ahí. La única frase que lo dice es la entrada
  histórica «✅ SCRUM-120» (Parte V, «Técnico ✅: `status`, `scheduledAt`, `notes`»): es historia, no se
  reescribe aquí (SCRUM-273); queda señalada al orquestador por si quiere anotarla.

### Re-anclaje por regla nueva firmada (precedente 917c/C.1)

Con el código nuevo y los tests VIEJOS, cayeron justo las dos anclas de la regla vieja, y nada más:
- `tests/scrum120-patch-job-roles.test.mjs:105` — esperado 200, recibido **403** (técnico `{notes}`).
- `tests/scrum164-gate-por-campo.test.mjs:34` — esperado `null`, recibido **`'notes'`**.

Re-anclados a c.21555, citada en los dos ficheros: el técnico `{notes}` → 403 con `field:'notes'` y la fila
intacta; su día a día pasa a ser `{queHayQueHacer}` → 200; test puro nuevo «las notas internas son SOLO del jefe».

### Comprobación

- **Rojo primero** (código de `bdf1ad57b` en `dist`, test ③ nuevo): **11/11 causas** en rojo — detalle y lista
  dan las notas al operario, el PATCH las deja editar (200), la mezcla aplica, el `.ics` las lleva y no lleva la tarea.
- **Verde:** ③ con banco, con CONTROL en cada puerta (el jefe SÍ las ve en lista, detalle y `.ics`, y las edita).
- Tanda completa con banco: ver la cifra en el comentario del ticket.

### Queda FUERA (otro carril) — la pantalla

`public/dashboard/js/jobDetailView.js:1580` pinta la línea «Notas internas» y su editor a TODOS los roles
(`pintarNotasInternas`, PATCH `{notes}` en :3737). Con este servidor, el operario la vería vacía y, si escribe,
recibiría 403. La norma tras SCRUM-89 (máster, entrada SCRUM-120) pide el front en el MISMO PR; el fichero es
de S2. Pedido al orquestador: S2 oculta esa línea para el técnico (sin textos nuevos, c.21555) en esta rama o
en un PR que entre a la vez.

### Ancla de otro documento movida por el esquema de esta rama

Las 6 líneas de `Job.queHayQueHacer` en `prisma/schema.prisma` desplazan `model VfSubmission` de 1809 a 1815, y `tests/scrum525d-anclas-que-apuntan` lo cazó en `docs/legal/AUDITORIA_CAMINO_EMISION.md:40`. Se lleva la coordenada a donde está hoy (opción ① del propio guard; mismo precedente que SCRUM-1072, que movió esas anclas por `activityKind`). Solo el número de línea: el texto de la auditoría no cambia.

### 12-nov (S1 relevo) · cuatro rojos que la rama llevaba y el CI habría cazado

Medidos al correr la tanda entera con banco desde la rama apilada de SCRUM-1707 y confirmados en ESTE árbol
(`947f8e13c`): `scrum222`, `scrum461` y `scrum733` — `docs/sql/deriva-prod.sql` seguía con 515 columnas sin
`jobs.que_hay_que_hacer`— y `scrum1185` —`PATCH /admin/jobs/:id::queHayQueHacer` sin consumidor—. El traspaso
los contaba como «base de la antecesora»; no lo eran: en `main` no existe la columna.
- `deriva-prod.sql` regenerado con su generador (`node scripts/generar-sql-deriva.mjs`, 516 columnas). Ni a mano
  ni otro cambio.
- El campo del PATCH se DECLARA en `scripts/_sin-consumir-declarados.json` (carril S2, este ticket): el alta ya
  lo consume y el editor de la ficha es de S2. Si su commit en este PR lo conecta, la entrada pasa a `retiradas`.
Los cuatro, en verde tras esto (62/62 con `scrum480`/`scrum533` de EOL).

### 12-nov (S2) · la pantalla: «Notas internas» sólo para el admin

Lo que pedía «Queda FUERA (otro carril)», en este mismo PR (norma tras SCRUM-89). Firma: **c.21555**, ya
citada arriba («el operario deja de verlas y de poder editarlas … Sin textos nuevos»). **Cero textos nuevos.**
- `public/dashboard/js/jobDetailView.js` · `pintarNotasInternas` sólo se llama si
  `window.appUserRole === 'admin'` (LISTA BLANCA, como `veNegocio` del Inicio: un rol desconocido cae al lado
  seguro, SCRUM-147). Al que no es admin se le QUITA la línea entera del bloque «El trabajo» después de
  componerlo, para no mover el orden de SCRUM-817.
- `tests/scrum1662-notas-solo-admin.test.mjs` (nuevo, sin gate): monta la ficha en el banco de vistas con la
  red doblada; el admin ve la línea y la nota, el técnico y un rol desconocido no ven ni la línea ni el texto.
  **3/3 en verde** sobre la punta de S1 (`dca552b55` + este cherry-pick).
- Commit original `adadf10f6` (rama `s2-1662-front-notas`), traído aquí por cherry-pick sin conflicto.

**Skill UI:** no cargada · esta entrada QUITA una línea ya existente para un rol, sin componente nuevo, sin
estilo y sin texto: no hay nada que diseñar.

### 12-nov (S2, 2.º push) · la ficha: «Qué hay que hacer» (d) y el dinero del operario (D1)

**(d) «Qué hay que hacer»** — rótulo FIRMADO en **c.21548** (ya en el producto: el alta, `jobNuevoModal.js:57`).
- `public/dashboard/js/jobTrabajoPlegable.js` · `ROTULO_TAREA`, FUERA de `TEXTOS_EL_TRABAJO`: ese objeto lo
  fija entero la firma de SCRUM-917 (com. 15881/16142, `tests/scrum917g`) y su censo (`scrum1215i`) aprueba
  el grupo por cuenta; meterle una clave de otra firma tumbaba los dos sin que su garantía cambiara (regla 41).
- `public/dashboard/js/jobDetailView.js` · línea nueva `tarea` en «El trabajo», delante de las notas (donde
  vivía la tarea cuando el alta la escribía en `notes`). La ven el jefe Y el operario. Va **abierta**, con el
  texto en un párrafo (`.detail-tarea`, en `styles.css`, no en línea: `scrum713c`). **Sin tarea, sin línea**:
  no se inventa un «Sin tarea».
- **Sólo LECTURA.** Un editor necesita textos de guardado/error que no están firmados (regla 39): se PROPONE
  aparte. Por eso `PATCH /admin/jobs/:id::queHayQueHacer` sigue en `scripts/_sin-consumir-declarados.json`.

**D1 · el dinero del operario** (contexto SCRUM-1725 c.21713; firma c.21547 Q1: «ve el importe … pero SIN la
tarjeta "Por cobrar"»). El servidor de 1707 le manda lo cobrado vacío y la ficha derivaba de ahí
«Te falta por cobrar», «Cobrado» y la barra: con lo cobrado a 0, **cifras falsas**.
- `veCobro` = `window.veEstadoDeCobro(rol)` (S4, SCRUM-1725 / #3127), la MISMA pregunta que la lista
  (SCRUM-831). **Declarado:** #3127 no está en `main` al escribir esto, así que cae a su MISMA lista blanca
  (`rol === 'admin'`; un rol desconocido NO ve, SCRUM-147).
- Sin `veCobro`: ni foco, ni lado «Cobrado», ni barra, ni «Lo que falta» (la condición va DENTRO, para que la
  sección se siga montando bajo su propio `if`, `scrum320`). **Se queda «Aceptado»** (el importe). Cero textos.

### Comprobación (2.º push)

- `tests/scrum1662-ficha-tarea-y-cobro.test.mjs` (nuevo, sin gate, banco de vistas): **rojo primero** contra
  `39e2d63db` → 4/4 causas en rojo (admin y operario sin tarea; técnico y rol desconocido ven foco, barra y
  «Cobrado»); el negativo «sin tarea no hay línea» y el control del admin, verdes en los dos. **Verde: 6/6.**
- Vecinos (todo test que nombra la ficha, «El trabajo» o `styles.css`, + `scrum1395b`): **1611/1613, 0 fallos**,
  2 saltos declarados (`sin LIBRO_PG_URL`, `sin QA_DB_TEST`).
- En yaqu.app, tras el merge: ficha de un trabajo con tarea, como admin y como operario (regla 42).

**Skill UI:** no cargada · la línea nueva REUTILIZA el componente plegable de SCRUM-917g y su tipografía; la
única regla nueva de `styles.css` copia el cuerpo del valor de la línea (14 px, `--body`). Sin color ni
componente nuevo. **Revisar a 390 px tras el merge.**
A9: comprobación → `tests/scrum713c-trinquete-de-estilos-en-js.test.mjs`
