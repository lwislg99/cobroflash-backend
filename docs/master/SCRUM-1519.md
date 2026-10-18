# SCRUM-1519 · La forma de la fuga: quién confía en que otro comprobó el comercio

**Medido contra:** `origin/main` = `0472952cd2c54e1c336170fa502ca902e6fda8cf` · 2026-10-13T00:05:42Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1519/medir-los-llamadores.mjs`

13-oct-2026 · **J1** (sesión `jv-j1`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J1. El encargo es la descripción de SCRUM-1519, leída entera en Jira, con su comentario c.19109.]

**Es MEDICIÓN. No se ha tocado `src/`, ni `prisma/`, ni ningún test.** Carril: `jobs.routes.ts` es de S1
por la fila general de `docs/equipo/dos-equipos.md` («todo lo demás de `src/`»); aquí sólo se lee.

## El veredicto, en una frase

**En `src/` hay 143 consultas, en 49 ficheros, que buscan por `id` y sin comercio una fila de un modelo
que SÍ tiene columna de comercio; de los 5 llamadores de `serializeJob`, ninguno cruza hoy por la puerta,
y 4 de los 5 entregan el cliente o el presupuesto de otro comercio en cuanto la fila del Trabajo apunta
fuera.**

Lo que esa frase NO dice, y va en la misma línea: 143 es **dónde está escrita la forma**, no cuántas
son un riesgo. No están clasificadas una a una. Por efecto sólo están medidos los 5 llamadores.

## 1 · Los llamadores de `serializeJob`, por efecto

Instrumento: `docs/master/evidencias/SCRUM-1519/medir-los-llamadores.mjs`. Salida:
`salida-llamadores.txt`.

Población: **5 sitios de llamada en 5 rutas** (4 llaman a `serializeJob`; `GET /admin/jobs/:id` lo
hace a través de `serializeJobDetail`). No hay ninguno fuera de `jobs.routes.ts`: los otros 4 ficheros
donde aparece el nombre lo nombran en comentarios.

Dos preguntas por llamador, y no son la misma:

- **P · la puerta.** La sesión del comercio 21 pide lo del 22 por esa ruta.
- **D · la dependencia.** El Trabajo es del 21, pero su fila apunta a algo del 22. Ese estado lo
  **siembra el instrumento** en su almacén. Si la ruta lo entrega, la ruta no comprueba: confía.

| llamador | sitio | P · pide lo de B | D · cliente de B | D · presupuesto de B | D · operario de B |
|---|---|---|---|---|---|
| `GET /admin/jobs/:id` | `:923` (vía `:569`) | 404, nada | **ENTREGA** nombre, teléfono, correo y NIF | **ENTREGA** el número | nada |
| `PATCH /admin/jobs/:id` | `:1136` | 404, nada | **ENTREGA** nombre y teléfono | **ENTREGA** el número | nada |
| `GET /admin/jobs/:id/ics` | `:1152` | 404, nada | **ENTREGA** el nombre | **ENTREGA** el número | nada |
| `GET /admin/jobs` | `:854` (con lote) | no está en la lista | **ENTREGA** nombre y teléfono | **ENTREGA** el número | nada |
| `POST /admin/jobs` | `:904` | 404, nada | no aplica | no aplica | no aplica |

- **Cruzan por la puerta: 0 de 5.**
- **Confían: 4 de 5.** El quinto, `POST`, crea la fila: no hay estado previo que leer, y su puerta
  (el `customerId` del cuerpo) contesta 404 con el cliente de B.
- **El operario no se entrega en ninguno.** Es el negativo que trae la propia función: esa consulta sí
  lleva el comercio (`:385`), y la del cliente (`:379`, `:583`) y la del presupuesto (`:330`) no. La
  lista hace lo mismo en lote: `:212` y `:224` leen por `id in (…)` sin comercio.
- **La ruta que edita no puede fabricar el estado sembrado:** `PATCH /admin/jobs/501` con
  `customerId`, `quoteId` y `operarioId` de B en el cuerpo deja la fila como estaba, y la nota del
  mismo cuerpo sí se escribe (la petición llegó).

### De quién depende entonces

`Job.customerId` lo escriben tres sitios:

| quién escribe | comprueba | cómo lo sé |
|---|---|---|
| `POST /admin/jobs` (`jobs.routes.ts:890`) | sí | **medido**: 404 con el cliente de B |
| aceptar un presupuesto (`job.service.ts:101-104`) | hereda `quote.customerId` | **leído**, no medido |
| fusionar clientes (`fusionClientes.ts:178`) | el `where` lleva comercio | **leído**, no medido |

El segundo es la cadena un nivel más arriba: la seguridad del Trabajo descansa en quien creó el
presupuesto. `quotes.routes.ts:125` comprueba el cliente contra el comercio antes de crear (**leído**).
Los otros dos sitios que crean presupuestos (`albaranes.routes.ts:1643`, `maintenance.service.ts:416`)
copian el `customerId` de otra fila: **no los he seguido.**

## 2 · La forma, en general

Instrumento: `docs/master/evidencias/SCRUM-1519/censo-de-la-forma.mjs` (AST de TypeScript, no grep).
Salida con la lista entera, fichero y línea: `salida-censo.txt`.

Población: **322 ficheros `.ts` de `src/`, 768 llamadas a Prisma** (13 operaciones), en 125 ficheros.
Modelos leídos de `prisma/schema.prisma`: 33, **25 con columna de comercio**.

| clase de modelo | llamadas |
|---|---|
| con columna de comercio | 614 |
| `merchant` (su `id` ES el comercio) | 137 |
| sin columna (sólo se atan por el padre) | 17 |

De las 614:

| veredicto | llamadas | qué es |
|---|---|---|
| ATADA | 385 | el `where` nombra el comercio |
| **SOLO-POR-ID** | **143** | lleva `id` y no nombra el comercio — **la forma** |
| POR-OTRA-CLAVE | 67 | ni `id` ni comercio (token, `jobId`, `quoteId`…) |
| ILEGIBLE | 17 | el `where` viene de otro sitio: **no juzgadas** |
| SIN-WHERE | 2 | dos `groupBy` |

Las 143, repartidas:

| | en fichero de ruta | fuera |
|---|---|---|
| escribe (`update`, `delete`, `upsert`) | 38 | 50 |
| lee una fila | 20 | 31 |
| lee varias | 2 | 2 |

Por modelo, las mayores: factura 33, presupuesto 31, cobro 13, cliente 13, albarán 9, trabajo 9.

**«Entregan algo que vuelve al cliente» NO está derivado para las 143.** Lo más cerca que llega este
censo es la casilla «lee, en fichero de ruta»: **22**. De esas, 5 son las de `jobs.routes.ts` medidas
arriba por efecto (`:212`, `:224`, `:330`, `:379`, `:583`), y las 5 entregan. Las otras 17 no están
ejecutadas.

Lo que hay dentro de las 143 y este censo no separa:

- escrituras por `id` justo después de una lectura atada (`jobs.routes.ts:1118` y `:1120` son eso):
  la forma, en su versión de escritura;
- caminos sin sesión (webhooks de pago, enlaces públicos con token), donde no hay comercio de sesión
  con el que atar y el `id` sale de una fila ya localizada por otra clave;
- tareas internas.

## 3 · Los controles

**El par se siembra; no se toma del árbol.** `resend-whatsapp` ya está arreglado y no se usa de positivo.

| instrumento | par sembrado | sale | con el instrumento sordo | sin el par |
|---|---|---|---|---|
| llamadores | 4 rutas de mentira montadas en memoria × 3 casos | 12 de 12 · salida 0 | **salida 1**, 4 casos fallan | **salida 2**, CIEGO |
| censo | 11 fuentes de mentira | 11 de 11 · salida 0 | **salida 1**, 7 fallan | **salida 2**, CIEGO |

Una de las cuatro rutas sembradas, `filtra-y-confia`, tiene exactamente la forma de `serializeJob`:
404 al pedir lo de B, y entrega al sembrar la fila.

**El doble sordo repite la lección de SCRUM-1514c.** Con el almacén atando toda consulta al comercio de
la sesión, el resumen dice «cruzan 0 · confían 0»: una tabla limpia y creíble. Lo único que la delata
es el par (`salida-llamadores-rojo-doble-sordo.txt`).

Controles propios, uno por llamador: el Trabajo sano del 21 tiene que llegar al serializador y traer
su cliente. Si alguno no llega, sale 2. Llegan los 5.

El censo tiene que contener el caso del ticket: `jobs.routes.ts:379` está, y con él `:583`.

## 4 · Lo que no se ha hecho

- **Nada por HTTP ni contra Postgres.** Manejadores reales de `dist/` (compilado con `tsc --noCheck`),
  Prisma doblado por un almacén en memoria. La sesión se inyecta en la petición: **el middleware de
  autenticación no se ejecuta.**
- **El almacén no es Postgres.** Aplica `id`, comercio, `in`, `AND/OR/NOT` y relaciones a un salto. En
  esta pasada no dejó ningún `where` sin evaluar (lo imprimiría).
- **Las 143 no están ejecutadas**, salvo las 7 de `jobs.routes.ts`. Ni clasificadas una a una.
- **Las 17 ILEGIBLES y las 67 POR-OTRA-CLAVE** están listadas, no juzgadas.
- **Los dos creadores de presupuesto que copian `customerId` de otra fila**, sin seguir.
- **No se ha arreglado nada**, y no se ha abierto ticket.
- 0 envíos a Meta, 0 intentos de red (los cuenta el instrumento).

## 5 · Mis errores de hoy

- La primera corrida de los llamadores murió al cargar (`createRequire` con ruta relativa) y dejó una
  salida de **0 bytes**. Lo cantó el tamaño, antes de mirar ningún veredicto.
- **No leí en Jira** los comentarios c.18964, c.18968, c.18972, c.18977 y c.18985 de SCRUM-1514 que
  pedía el encargo: leí mi traspaso y el instrumento de 1514c, que los resumen. Lo que diga de ellos
  viene de ahí.
- De `00-normas-comunes.md` leí A3, A6, A7 y A8 desde `origin/main`, **no el fichero entero**.

## Cómo se repite

```
node <checkout compartido>/node_modules/typescript/bin/tsc --noCheck
node docs/master/evidencias/SCRUM-1519/medir-los-llamadores.mjs .                 # 0
node docs/master/evidencias/SCRUM-1519/medir-los-llamadores.mjs . --doble-sordo   # 1
node docs/master/evidencias/SCRUM-1519/medir-los-llamadores.mjs . --sin-siembra   # 2
node docs/master/evidencias/SCRUM-1519/censo-de-la-forma.mjs . <ruta a typescript> --lista
```

Sin `FORCE_COLOR` y con `NO_COLOR=1`. ⛔ `prisma generate` no, en árbol anidado.


# SCRUM-1519b · Los tres escritores de `Job.customerId` y `Job.quoteId`: ninguno ORIGINA una fila cruzada, y uno la COPIA

**Medido contra:** `origin/main` = `0472952cd2c54e1c336170fa502ca902e6fda8cf` · 2026-10-13T00:15:56Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1519b/medir-los-escritores.mjs`

13-oct-2026 · **J1** (sesión `jv-j1`, relevo; equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J1. El encargo es el mensaje de reparto del orquestador más SCRUM-1519 leído entero en Jira con sus dos comentarios, c.19109 y c.19148.]

**Es MEDICIÓN. No se ha tocado `src/`, ni `prisma/`, ni ningún test.** La rama lleva mezclada la de
SCRUM-1519 (`764b9caac`, PR #2341, sin mergear al escribir esto) porque este instrumento reutiliza su almacén.

## El veredicto, en una frase

**El cero de hoy es estable por la puerta y NO lo es por herencia:** pidiéndoselo con la sesión del
comercio 21 y recursos del 22, **ninguno de los dos escritores que faltaban deja una fila de Trabajo
cruzada** (0 de 6 intentos), pero el de la aceptación (`job.service.ts:101`) **no comprueba nada: copia
el cliente del presupuesto**, y con un presupuesto ya cruzado fabrica el Trabajo cruzado (2 de 2).

Lo que esa frase no dice: la aceptación traslada la pregunta al presupuesto. De los cuatro sitios que
crean un presupuesto con cliente, **sólo uno está ejecutado** (`POST /quote/create`: no deja). Los otros
tres están LEÍDOS, no ejecutados.

## 1 · Los escritores, por efecto

Sesión del comercio 21. El veredicto sale del ALMACÉN, no de la respuesta: tras cada caso se recorren
todas las filas de Trabajo y de Presupuesto y se compara su comercio con el de aquello a lo que apuntan.

| escritor | sitio | control propio | P · se le pide lo de B | D · el dato ya viene cruzado |
|---|---|---|---|---|
| 1 · crear un Trabajo | `jobs.routes.ts:890` | (medido en SCRUM-1519) | 404, no escribe (SCRUM-1519) | no aplica |
| 2 · aceptar un presupuesto | `job.service.ts:101` | escribe limpio | aceptar el de B: 404, no escribe · la función a pelo sobre el de B: crea un Trabajo de B con cliente de B (coherente, no cruzado) | **CRUZA, 2 de 2** (a pelo y por la ruta) |
| 3 · fusionar clientes | `fusionClientes.ts:178` | escribe limpio (mueve el Trabajo 505) | 409 y no escribe, 4 de 4 (el que queda es de B; el que desaparece es de B; por la ruta y a pelo) | no aplica |
| aguas arriba del 2 · crear el presupuesto | `quotes.routes.ts:192` | escribe limpio | 404 con el cliente de B · 403 con `merchant_id` de B | no aplica |

- **El 2 no tiene puerta que guardar:** `ensureJobForQuote(quoteId)` no recibe comercio. Toma `merchantId`,
  `customerId` y `quoteId` del MISMO presupuesto, así que `Job.quoteId` es del comercio del Trabajo por
  construcción, y `Job.customerId` vale lo que valga `Quote.customerId`.
- **El 3 lleva el comercio dos veces:** valida los dos clientes con comercio y además el `updateMany` lleva
  `merchantId` en el `where`.
- A pelo sobre el presupuesto de B, la función del 2 escribe filas de B (el Trabajo nuevo y `Quote.jobId`).
  No es una fila cruzada. Sus tres llamadores están LEÍDOS: `quotesAdmin.routes.ts:151` (ejecutado, 404
  antes), `quotes.routes.ts:519` y `whatsappIncoming.routes.ts:493` (no ejecutados).

## 2 · Quién escribe (censo por texto, no AST)

323 ficheros `.ts`, 32 llamadas que escriben en `job` (7) o en `quote` (25).

- `job`: `jobs.routes.ts:890` (create), `:1118` y `:1120` (update con `data` en variable: SCRUM-1519 midió
  que el PATCH no reapunta), `job.service.ts:101` (create), `:196` y `:297` (update, sólo totales),
  `fusionClientes.ts:178` (updateMany). **Los escritores de `customerId`/`quoteId` son tres, como dijo c.19148.**
- `quote` con cliente: `quotes.routes.ts:192` (EJECUTADO), `quoteAdmin.ts:593` (revisión: copia de un
  presupuesto propio, LEÍDO), `albaranes.routes.ts:1641` (copia `job.customerId`: cierra el círculo
  Trabajo → presupuesto → Trabajo, LEÍDO), `maintenance.service.ts:413` (copia `plan.customerId`; el plan
  se crea validando cliente y presupuesto con comercio, `maintenance.routes.ts:43` y `:49`, LEÍDO) y
  `fusionClientes.ts:177` (con comercio; va en la misma transacción que la `:178`, cuyo camino sí se ejecutó).

## 3 · Los controles

| control | sale |
|---|---|
| par sembrado: 5 escritores de mentira, 10 casos (3 cruzan, 2 filtran, cada uno con su caso limpio) | 10 de 10, salida 0 |
| `--doble-sordo` | salida 1: los 3 que deben cruzar dicen NO-ESCRIBE, y el resumen de los reales sale IGUAL que el bueno |
| `--sin-siembra` | salida 2 (CIEGO) |
| control propio de cada escritor real (con recursos del 21 TIENE que escribir) | 3 de 3 escriben |
| control sembrado del censo (1 comentario + 3 llamadas de mentira) | 3 de 3, el comentario fuera |

Uno de los sembrados cruza sólo por `quoteId` con cliente propio: si el detector mirase sólo el cliente, callaría.

## 4 · Lo que no se ha hecho

- Nada por HTTP ni contra Postgres. Manejadores y funciones reales de `dist/` (`tsc --noCheck`) con Prisma
  doblado por un almacén en memoria; la sesión va inyectada y el middleware de autenticación no se ejecuta.
  **Las claves foráneas no existen en el almacén.**
- Tres de los cuatro creadores de presupuesto, dos de los tres llamadores de `ensureJobForQuote` y la
  ruta pública de decisión: LEÍDOS, no ejecutados.
- Escrituras anidadas (`job: { create | connect }` dentro de otro modelo): buscadas con una expresión de
  una línea, 0 resultados, sin control positivo. Es un cero sin positivo y se dice.
- `Job.operarioId` no era el encargo. Que una fila de cliente cambie de comercio (lo que cruzaría el
  Trabajo sin tocarlo) no está mirado.
- No se han tocado las 143 consultas sólo-por-id.
- **No leí** los comentarios de SCRUM-1514 que cita c.19148, ni `docs/equipo/00-normas-comunes.md` (sólo
  medí su tamaño en `origin/main`: 65.517 B), ni `dos-equipos.md`. Leí la ficha del 13-oct entera, el
  ticket con sus dos comentarios, la entrada vigente del traspaso y el instrumento de SCRUM-1519.
- Tanda completa local no corrida. El obligatorio del PR está SIN LEER al escribir esto.

## 5 · Mis errores de hoy

- La primera medida de contexto la leí del jsonl de OTRA sesión (el más reciente de la carpeta de
  proyectos era de `scrum-1500h`): dio 246.061 y eran 106.581. Lo cantó el nombre de la carpeta.
- El resumen decía «escritores medidos 3» contando la fila de aguas arriba; corregido antes de guardar la salida.

## Cómo se repite

    node <checkout compartido>/node_modules/typescript/bin/tsc --noCheck
    node docs/master/evidencias/SCRUM-1519b/medir-los-escritores.mjs . [--doble-sordo] [--sin-siembra]

Salidas guardadas: `salida-escritores.txt` (0), `salida-escritores-rojo-doble-sordo.txt` (1) y
`salida-escritores-ciego-sin-siembra.txt` (2), en `docs/master/evidencias/SCRUM-1519b/`.


# SCRUM-1519c · Los tres creadores de presupuesto que estaban leídos: ninguno ORIGINA un presupuesto cruzado, y uno lo COPIA

**Medido contra:** `origin/main` = `dfda86d65b8de9594b59b277fd38ea0ac3eda93a` · 2026-10-13T04:45:06Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1519c/medir-los-creadores.mjs`

13-oct-2026 · **J1** (sesión `jv-j1`, relevo; equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J1. El encargo es el mensaje de reparto del orquestador más SCRUM-1519 leído entero en Jira con sus tres comentarios, c.19109, c.19148 y c.19156.]

**Es MEDICIÓN. No se ha tocado `src/`, ni `prisma/`, ni ningún test.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha del 13-oct.

## El veredicto, en una frase

Con sesión del comercio 21 y recursos del 22, **ninguno de los tres creadores deja un presupuesto cruzado
pidiéndoselo por la puerta (0 de 3 intentos; 0 de 7 contando el plan y la fusión)**; con el dato ya cruzado, **dos de los tres se niegan y uno
lo copia**: la revisión (`quoteAdmin.ts:593`) fabrica otro presupuesto cruzado, 2 de 2.

Lo que esa frase no dice: la cadena **no tiene origen medido, pero sí dos eslabones que propagan** —
la aceptación (c.19156) y la revisión (esto). «Cerrada» a secas sería falso; «nadie la abre por la
puerta y dos la propagan si ya está abierta» es lo medido.

## 1 · Los creadores, por efecto

El veredicto sale del almacén: tras cada caso se recorren todas las filas de Trabajo, de Presupuesto y
de Plan de mantenimiento y se compara su comercio con el de aquello a lo que apuntan.

| creador | sitio | control propio | P · se le pide lo de B | D · el dato ya viene cruzado |
|---|---|---|---|---|
| A · la revisión | `quoteAdmin.ts:593` | crea, limpio | revisar el presupuesto de B: 404 por la ruta, lanza a pelo; no escribe (2 de 2) | **CRUZA, 2 de 2** (por la ruta y a pelo): la revisión nace con el cliente de B |
| B · el adicional del albarán | `albaranes.routes.ts:1641` | emite la factura y crea el adicional, limpio | convertir el parte de B: 404, no escribe | **no escribe**: 500, y la consola dice `cliente_no_encontrado_al_congelar:702` |
| C · el ciclo de mantenimiento | `maintenance.service.ts:413` | crea, limpio | no aplica (es un cron, no hay sesión) | **no escribe**: `plan 832: customer_gone` |
| aguas arriba del C · crear el plan | `maintenance.routes.ts:60` | crea el plan, limpio | 404 con el cliente de B; 404 con el presupuesto de B | no aplica |
| de paso · fusionar clientes (mueve `Quote.customerId`) | `fusionClientes.ts:177` | mueve el presupuesto, limpio | 409 y no escribe, 2 de 2 | no aplica |

- **A copia.** Lee el presupuesto atado al comercio y hereda todos sus campos; del cliente no pregunta.
- **B no llega.** Lo que lo para no es una comprobación del adicional: es `congelarCliente`, que ata el
  cliente al comercio para congelar la ficha de la factura, **antes** de emitir. Ni adicional ni factura
  (lo segundo, por orden de las líneas leído; la foto no mira la tabla de facturas).
- **C comprueba de verdad**: compara el comercio del cliente con el del plan y se salta el plan.
- Quién escribe `Quote.customerId`, por el censo de TEXTO de SCRUM-1519b (no AST): cuatro `create` y un
  `updateMany`. Con esta pasada están los cinco ejecutados.

## 2 · Los controles

| control | sale |
|---|---|
| par sembrado: 5 creadores de mentira, 10 casos (2 cruzan por la puerta, 1 por herencia, 2 filtran) | 10 de 10, salida 0 |
| `--doble-sordo` (el almacén ata toda consulta al comercio 21) | salida 1: caen los 2 de la puerta; **el resumen de los reales sale idéntico al bueno** |
| `--detector-sordo` (el detector no mira las filas de Presupuesto) | salida 1: caen los 3 que cruzan; **la revisión sale «escribe limpio, escribe limpio»** |
| `--sin-siembra` | salida 2, CIEGO |
| control propio de cada creador real: con recursos del 21 tiene que crear | 5 de 5 (los tres creadores, con presupuesto nuevo en el almacén) |

El doble sordo no toca el eje de la herencia: quien hereda no consulta nada de B, así que sigue cruzando
con el almacén sordo. Por eso hay un segundo rojo. Y la pareja `hereda/copia` · `hereda/comprueba` es la
que separa «copia» de «comprueba», que es la pregunta de esta pasada.

## 3 · Lo que no se ha hecho

- Nada por HTTP ni contra Postgres. Manejadores y funciones reales de `dist/` (`tsc --noCheck`) con Prisma
  doblado por un almacén en memoria; el middleware de autenticación no se ejecuta, **las claves foráneas
  no existen en el almacén** y las consultas en crudo devuelven vacío.
- Para llegar al adicional y al mantenimiento, la fila EN MEMORIA del comercio 21 lleva encendidos
  `INVOICING_ES_ENABLED` y `MAINTENANCE_ENABLED`. Con ellos apagados, que es como están por defecto, B sale
  409 y C se salta el plan antes de mirar nada: no medido aquí, leído.
- B emite una factura dentro del almacén (camino de emisión EJECUTADO en memoria, no modificado). 0 envíos, 0 intentos de red.
- Un caso por forma: un presupuesto cruzado, un Trabajo cruzado, un plan cruzado. No se agotan variantes
  (revisión de una versión no vigente, plan con `quoteId`, parte sin presupuesto).
- Escrituras de `Quote` en crudo: 0 con una expresión de texto (23 líneas de SQL en crudo en `src/`, vistas
  con otra expresión: el positivo no es del mismo patrón). `connect:` anidado: 0 en todo `src/`, sin positivo.
  **Los dos son ceros que no distinguen.**
- Los dos llamadores de `ensureJobForQuote` que c.19156 dejó leídos (`quotes.routes.ts:519`,
  `whatsappIncoming.routes.ts:493`): siguen LEÍDOS.
- Que una fila de cliente cambie de comercio, y las 143 consultas sólo-por-id: sin tocar.
- **No leí** los comentarios de SCRUM-1514 que cita c.19148, ni `dos-equipos.md`. Sí leí enteras la ficha
  del 13-oct, `00-normas-comunes.md` (986 líneas, desde el árbol, que estaba en `origin/main`), este ticket
  con sus tres comentarios y el instrumento de SCRUM-1519b.
- Tanda completa local no corrida.

## 4 · Mis errores de hoy

- Di por bueno el rojo del doble sordo sin mirar qué eje ensordecía: de los tres sembrados que cruzan sólo
  cayeron dos. El tercero, el de la herencia, seguía cruzando. Añadí `--detector-sordo` y lo vi en rojo.
- La salida guardada se regeneró después de ese cambio; es igual a la anterior salvo la huella de la factura
  de prueba, que cambia en cada corrida.

## Cómo se repite

    node <checkout compartido>/node_modules/typescript/bin/tsc --noCheck -p .
    node docs/master/evidencias/SCRUM-1519c/medir-los-creadores.mjs . [--doble-sordo] [--detector-sordo] [--sin-siembra]

Salidas guardadas en `docs/master/evidencias/SCRUM-1519c/`: `salida-creadores.txt` (0),
`salida-creadores-rojo-doble-sordo.txt` (1), `salida-creadores-rojo-detector-sordo.txt` (1) y
`salida-creadores-ciego-sin-siembra.txt` (2).

# SCRUM-1519d · La REVISIÓN ya no copia el cliente de otro comercio. La ACEPTACIÓN, NO ESTÁ

**Medido contra:** `origin/main` = `e59be9fa384b5bb1d4fbaa6d429a32a5a8a6be8d` · 2026-10-17T23:51:12Z
A9: comprobación → `tests/scrum1519d-la-revision-ata-el-cliente.test.mjs`

Escribe S1 (equipo de Luis), en su carril: `dos-equipos.md` §3.1, «todo lo demás de `src/` (…
jobs, … system) → S1», sin regla más específica para `quoteAdmin.ts` ni para `job.service.ts`
(medido en `.claude/carriles.json`). Decisiones del fundador: c.19205 ① y ②, recogidas por el
orquestador. Reparto: el orquestador del equipo de Luis, 18-oct-2026.

## 🔴 Lo primero: esto es MEDIO arreglo, y se dice aquí para que nadie lea «1519 hecho»

| eslabón que PROPAGA (c.19192) | estado |
| --- | --- |
| la revisión (`crearRevisionDeQuote`) | ✅ arreglado en este tramo |
| la aceptación (`ensureJobForQuote`) | ⛔ **NO ESTÁ.** Espera una firma del fundador |

**Por qué falta la aceptación.** c.19205 ② decide que la aceptación pasa sin Trabajo «y queda
registrado de forma que alguien lo vea», como un cable trampa, con `avisoPuerta.service.ts` de
precedente y «NO al log solo». Medido en `e59be9fa`: no existe ningún vehículo para ese registro que
no pida algo nuevo.

- **A.** Fila de auditoría con una acción nueva (`recordAudit`, la puerta que no tumba nada). Pero
  `AuditAction` es una unión CERRADA (regla 5), y ampliarla la firma el fundador (precedente:
  `encolado_fallido`, SCRUM-1296 c.17642).
- **B.** WhatsApp al fundador, como `avisoPuerta`. Es un envío automático nuevo (regla 28), con
  texto nuevo y una variable de Railway.
- **C.** `console.error` solo: lo que el fundador descartó.

Recomendada la A, sin texto visible, sin envío, sin variable y sin esquema. El orquestador la sube
al fundador en una línea: «¿Firmas levantar la regla 5 para la acción `trabajo_omitido_cliente_ajeno`
(meta `{quoteId, customerId}`), y ninguna más?». **El ticket no se cierra hasta que estén las dos
mitades.**

## Qué hace el arreglo

`decidirRevisionDe` (`src/modules/system/quoteAdmin.ts`) lee DOS veces el presupuesto: la versión
ABIERTA y la VIGENTE, que es la que se copia cuando no coinciden. Las dos lecturas piden ahora
también `customer: { merchantId }`. Si el cliente es de otro comercio la fila no aparece y se
contesta `quote_not_found` («El presupuesto no existe.»), el código y el texto que ya existían para
un id ajeno (decisión del fundador, c.19205 ①: un 404 no confirma que el cliente exista). Sin texto
nuevo, sin esquema y sin tocar el camino de emisión: la revisión crea un presupuesto, no una factura.

## Rojo primero, verde después, y quitar cada pieza

Instrumento de J1, sin cambios: `docs/master/evidencias/SCRUM-1519c/medir-los-creadores.mjs`.

| fila del instrumento | antes (`e59be9fa`) | después |
| --- | --- | --- |
| C · revisión del propio, cliente propio | ESCRIBE-LIMPIO 201 | ESCRIBE-LIMPIO 201 |
| P · revisión del presupuesto de B (ruta y a pelo) | NO-ESCRIBE, NO-ESCRIBE | NO-ESCRIBE, NO-ESCRIBE |
| H · revisión del propio SEMBRADO con cliente de B (ruta y a pelo) | **CRUZA, CRUZA** | **NO-ESCRIBE, NO-ESCRIBE** (404 `quote_not_found`) |
| par sembrado (10 casos) | 10 de 10 | 10 de 10 |

Salidas: `docs/master/evidencias/SCRUM-1519d/salida-creadores-antes.txt` y
`salida-creadores-despues.txt` (las dos salen 0).

Test nuevo, 3 casos: control (con el cliente propio SE CREA), abierta con cliente ajeno y abierta
sana con la VIGENTE ajena. Su doble respeta el `where` (id, negocio y negocio del cliente).

| mutante | test nuevo | instrumento (fila H) |
| --- | --- | --- |
| sin la pieza de la ABIERTA | cae el caso de la abierta (2 de 3 pasan) | vuelve a CRUZA, CRUZA |
| sin la pieza de la VIGENTE | cae el caso de la vigente (2 de 3 pasan) | sigue NO-ESCRIBE: **el instrumento no distingue esta pieza**; la distingue sólo el test |

## De paso, un doble que pidió crecer

`tests/scrum1490-el-anio-de-la-serie.test.mjs` tiene un doble que LANZA ante una clave del `where`
que no sabe evaluar («amplía el doble, no la ignores»). Cayó con la clave `customer`. Se amplió:
el cliente de cada fila es de su mismo negocio, y la clave `customer` se evalúa. No se aflojó nada.

## Lo que se ha corrido

- Los 24 ficheros de `tests/` que nombran `quoteAdmin` o `crearRevisionDeQuote`, más el nuevo:
  206 tests, 201 pasan, 0 caen, 5 saltados con su motivo (3 de Postgres: `LIBRO_PG_URL`, corren en
  el obligatorio; 2 de `QA_DB_TEST`). Los de Postgres de la revisión (1150c, 1188d) siembran el
  cliente en el mismo comercio que el presupuesto: leído, no ejecutado aquí.
- `npm run guards:entrada`: 15 en verde. Los 5 de árbol entero (195, 414, 694, 710b, 737) a mano:
  38 de 38.
- La tanda completa, no (en esta máquina la mata la memoria); la juzga el obligatorio del CI.

## Lo que NO se ha medido

- Nada por HTTP ni contra Postgres en local: dist/ real con Prisma doblado.
- La aceptación: ni tocada.
- Si existe HOY alguna fila cruzada en una base real (la segunda pregunta de J1, c.19192): sigue
  abierta y es del fundador.
- `tsc` sale con el error ya conocido de `merchantAdmin.ts` (cliente de Prisma del árbol
  compartido, sin regenerar a propósito); emite `dist/` igual, y no viene de este cambio.

## Cómo se repite

    npm run build
    node --test tests/scrum1519d-la-revision-ata-el-cliente.test.mjs
    node docs/master/evidencias/SCRUM-1519c/medir-los-creadores.mjs .
