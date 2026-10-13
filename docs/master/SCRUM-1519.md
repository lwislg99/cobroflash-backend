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
