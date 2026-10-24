# SCRUM-1194 · «El servidor acepta un VALOR que la pantalla no ofrece»: medido, y la forma de SCRUM-1136 sale UNA vez

**Medido contra:** `origin/main` = `d2c8903c5e75c9defc732bf8f7a7eebf20e79561` · 2026-09-28T15:15:48Z

J6 (jv-j6). Medición, no construcción. No se toca `csvImport.js` (es SCRUM-1136, carril J2), ni la
sonda ni el trinquete de SCRUM-1185 (son de Luis).

## Qué es la forma, medida en el caso vivo

SCRUM-1136: la pantalla manda `{ fichero, codificacion, mapeo }`, y la clave `mapeo` **sí** llega.
Lo que falta son **valores**. El servidor acepta como claves de `mapeo` el vocabulario cerrado
`CAMPOS_CLIENTE`, de 12 valores (`importarClientes.service.ts`), y el desplegable sólo ofrece 4.
Por eso la sonda de 1185 no puede verlo, **y no es un fallo suyo**: mira **claves** del cuerpo, no
los **valores** de un vocabulario.

⚠️ **No confundir con los «99 candidatos» de 1185.** Aquéllos son de la dirección contraria: campos
que el servidor DEVUELVE y ninguna pantalla lee. Esta medición no los cubre.

## El instrumento: la sonda de 1185, no un segundo algoritmo

`docs/master/evidencias/SCRUM-1194/censo-vocabulario.mjs` (`node … .`). Es una medición de un solo
uso, **no un guard**. Para rutas, montajes y llamadores **reutiliza la sonda de SCRUM-1185**: la
carga como copia parcheada **fuera del árbol**, en un directorio temporal del sistema que se borra
nada más importarla. El parche sólo añade dos cosas: los identificadores de cada handler y que
`censar` devuelva sus rutas. Si alguna ancla del parche no casa exactamente una vez, sale CIEGO.

1. **Vocabularios del servidor**, por AST en `src/`: cada `z.enum([...])` y cada array constante de
   2 o más literales.
2. **Vocabulario → rutas** que lo usan: directamente, o a UN salto de import. El salto cuenta una
   función, una constante o un **tipo** exportado que lo nombre; el handler de 1136 no nombra el
   array, nombra su tipo `CampoCliente`.
3. **Rutas → pantallas llamadoras**: los llamadores exactos de 1185, más UN salto por envoltorio (si
   la llamada vive en `createCustomer` de `api.js`, también las pantallas que llaman a
   `createCustomer`).
4. **Valores que nombra cada pantalla**, por AST: literales de cadena, `value="…"` y **claves de
   objeto** (así declara `expensesView.js` sus categorías).

**Tres salidas, y la de «no supe mirar» es suya:** exit 0 (medido, haya o no hallazgos) · exit 2
**CIEGO** (el parche no casa, o falla el control positivo). Dentro de la medición, «no pude ligar»
y «sin pantalla» van en cubos propios, nunca como «no hay».

## El resultado

| cubo | nº | qué significa |
|---|---|---|
| vocabularios del servidor | **62** | 12 `z.enum` + 50 arrays de literales · 238 rutas (sonda de 1185) |
| **no pude ligar** a ninguna ruta | **25** | estado interno (estados de envío, orden de borrado, flags…). No se aceptan de fuera |
| pares vocabulario × ruta | **48** | |
| · GET | 10 | el vocabulario se **devuelve**, no se acepta: no es esta forma |
| · sin pantalla llamadora | 7 | ruta sin consumidor: es el dominio de SCRUM-1185 |
| · ofrece todo | 18 | |
| · **PARCIAL** | **2** | **SCRUM-1136**: el mismo vocabulario en `POST /admin/customers/import` y en `/import/preparar` |
| · no nombra NINGUNO | 11 | revisados uno a uno, abajo |
| · NO PUDE MEDIR | 0 | una pantalla llamadora que no se pudo leer |

### Los 11 «no nombra ninguno», clasificados a mano

| par | veredicto | por qué |
|---|---|---|
| `POST/PUT /admin/products` · `ITEM_KIND` (2) | falso positivo | los valores los pone el componente `switchTipoArticulo.js` |
| `POST /admin/customers` · `contactKind` | falso positivo | los pone el componente `switchFormaJuridica.js` |
| `POST /admin/entorno` · `ENTORNOS_APP` | falso positivo | lo calcula `window.entornoDeLaApp()`, en otro fichero |
| `POST /admin/albaranes/:id/fotos` · `FOTO_MIME_ALLOWLIST` | falso positivo | el MIME viene del propio archivo |
| `POST /admin/onboarding/serie` · `PROHIBIDOS_SERIE` | no es la forma | es una lista NEGRA de caracteres |
| `POST /admin/expenses/leer-ticket` · `MODELOS_LECTURA` | no es la forma | es configuración interna (modelos de IA) |
| `PATCH /admin/partes/:id` y `…/dictado` · `ESTADOS_PARTE` (2) | no es la forma | es estado interno del parte |
| `POST /admin/customers` · `billingPeriodicity` | **variante** | se acepta al CREAR y sólo se ofrece al EDITAR (ficha del cliente, PUT) |
| `POST /admin/partes` · `TIPOS_PARTE` | **variante** | el alta manda sólo `{ jobId }`; el `tipo` se ofrece en el PATCH. 1185 ya lo tiene como pieza de cuerpo (`cuerpo · POST /admin/partes::tipo`) |

## La respuesta a «¿cuántas?»

- **La forma de 1136 (un valor que ninguna pantalla puede mandar): 1**, y es el propio SCRUM-1136.
  Vocabulario y pantalla son los mismos en las dos rutas.
- **Una variante más suave: 2**, un valor que **no se puede poner al crear pero sí al editar**:
  `billingPeriodicity` en el alta del cliente y `tipo` en el alta del parte (este último ya estaba
  en 1185).
- Así que el número de trabajo enterrado es **«24 rutas + 1»**, y el 1 ya tiene ticket.

## Calibrado en sus salidas

- **Control positivo, DENTRO del instrumento:** 1136 tiene que salir PARCIAL con `taxId` entre lo
  que falta, o se sale CIEGO. Sale PARCIAL, con `mobile, taxId, tags` y los cinco `billing*`.
- **CIEGO de verdad:** en la primera pasada el instrumento se plantó con exit 2 («1136 ni
  aparece») en vez de dar números. La causa era que el salto de import no contaba los **tipos**
  exportados; se corrigió, porque `CampoCliente` es literalmente el vocabulario.
- **Control negativo, comprobado a mano:** `POST /admin/expenses` · `EXPENSE_CATEGORIES` sale
  «ofrece todo». Un grep manual con comillas decía que no (sólo `'otros'`). Se investigó antes de
  creer a ninguno: `expensesView.js` declara las categorías como **claves de objeto**
  (`materiales: { label: 'Materiales' }`). El instrumento tenía razón y el grep no.

## ⚠️ Lo que este instrumento NO ve

- **Vocabularios que no son literales:** listas calculadas, uniones de tipos TypeScript sin array en
  tiempo de ejecución, y arrays **dentro** de un handler (`if (!['a','b'].includes(x))`).
  **Enums de Prisma:** hoy son 0 en `schema.prisma` (medido), así que el hueco está vacío, pero el
  día que haya uno no entra solo.
- **Valores que pone OTRO fichero de la pantalla:** un componente, una función global. Cuatro de
  los once falsos positivos son esto. Se sigue UN salto por envoltorio de la llamada, no por
  componente.
- **Un valor que aparece en el fichero llamador por otro motivo cuenta como ofrecido** (p. ej.
  `name`). El «ofrece todo» es por tanto una cota optimista.
- **Un solo salto** de import en el servidor y un solo salto de envoltorio en el front.
- Todo lo que 1185 ya declara que no ve (URLs opacas, montajes que no reconstruye) tampoco lo ve
  esto.

## Propuesta — para Luis, no aplicada

Que sea un **segundo modo de la sonda de 1185** y no un instrumento aparte: que `censar` exponga
sus rutas con los identificadores de cada handler, que es exactamente lo que parchea esta medición.
Hoy la medición depende de dos anclas textuales en su fichero y sale CIEGA si cambian. Integrarla
es cosa de su dueño.

## J6 · SCRUM-1194b · la medición se había quedado CIEGA: positivo sembrado y la lista de hoy

**Medido contra:** `origin/main` = `25ad5d43b6a8ed41fdcb90c5fdbc0e2e388ec1be` · 2026-10-24T10:07:28Z (hora de GitHub al acabar las pasadas; sesión J6 `jv-j6bl` en su árbol `jv-j6bl`, por encargo del orquestador `cobroflash-backend-95`. Al escribir, `main` ya era `137c7fad02e7f4e01f94955d17cb6406035f7ed5`: 1 fichero, 0 en `src/`, `public/` o la sonda de 1185)

A9: comprobación → `docs/master/evidencias/SCRUM-1194/censo-vocabulario.mjs`

Reparación de MI medición del 28-sep, no construcción del método: sin test y sin trinquete (el
ticket no los pide y prefiere un modo de la sonda de 1185, que es de Luis). OK del orquestador por
mensaje. No se toca ninguna discrepancia: cada una es de su carril.

### Qué pasó

Corrida hoy tal como estaba: **exit 2, CIEGO** — «SCRUM-1136 no sale PARCIAL con taxId (sale:
ofrece todo)». Su control positivo era el propio defecto de 1136, y #1939 lo arregló
(`csvImport.js:168` ofrece ya los doce). El instrumento se jubiló el día que triunfó.

### Lo que cambia

- **Positivo SEMBRADO en memoria** (nada se escribe en el árbol): la pareja del ejemplo del ticket
  —un vocabulario de los 12 valores de `CAMPOS_CLIENTE`, una ruta que lo acepta montada en
  `app.ts`, y una pantalla que hace `fetch` y ofrece sólo los 4 de antes de #1939—. Entra por el
  camino real de la sonda de 1185. Tiene que salir PARCIAL con exactamente los 8 que faltan.
- **Control que NO casa, sembrado:** la gemela que ofrece los 12 tiene que salir «ofrece todo».
- **La siembra no cuenta en nada:** si deja otro número de pares que 2, CIEGO; después se quita
  de todas las cifras.
- **Comprobado quitándola:** `--sin-siembra` da **exit 2, CIEGO** («ni aparece»), no verde.
- **CIEGO de verdad en la primera pasada sembrada:** las dos pantallas se llamaban `enviar`, y el
  salto por envoltorio casa por NOMBRE, así que metía la gemela como llamadora de la parcial y el
  positivo salía «ofrece todo». Se arregló en la siembra (un nombre por pantalla) y se midió lo
  mismo en el árbol real: cubo nuevo «ofrece todo SÓLO gracias al envoltorio».
- **Marca nueva:** una fila cuya ruta no lee `req.body` (según la sonda de 1185) lo dice.

### El resultado de hoy

| cubo | 28-sep | hoy |
|---|---|---|
| vocabularios del servidor | 62 | **71** (13 `z.enum` + 58 arrays) · 244 rutas |
| no pude ligar a ninguna ruta | 25 | 30 |
| pares vocabulario × ruta | 48 | 55 |
| · GET | 10 | 11 |
| · sin pantalla llamadora | 7 | 9 |
| · ofrece todo | 18 | 21 |
| · **PARCIAL** | 2 (1136) | **1** |
| · no nombra NINGUNO | 11 | 13 |
| · NO PUDE MEDIR | 0 | 0 |
| «ofrece todo» sólo por envoltorio | — | 8 |

- **SCRUM-1136 real** (`POST /admin/customers/import`): **ofrece todo**. Arreglado por efecto.
- **El único PARCIAL, `POST /admin/quotes/:id/archivar` · `ESTADOS_ARCHIVABLES`, falta `expired`:
  falso positivo, revisado a mano.** La ruta no lee cuerpo (`quotesDetailView.js:229` manda
  `{ method: 'POST' }`); `archivado.ts:9` se compara con el `status` GUARDADO, y el botón se ofrece
  en cualquier estado (decide el 409). Lo que nombra la pantalla (`draft`, `rejected`) está ahí
  por otro motivo.
- **Los 13 «no nombra NINGUNO»:** los 11 del 28-sep siguen con su veredicto (el
  `customerCreateSchema` de `POST /admin/customers` son ahora dos filas: `EMPRESA/PERSONA` es el
  `contactKind` del componente, y `NINGUNA/QUINCENAL/MENSUAL` es la variante «sólo al editar»).
  Los 2 nuevos son `ESTADOS_PARTE` en `POST /admin/partes/:id/firmar-tecnico` (`partes.routes.ts:660`)
  y `…/firmar` (`:735`): **estado interno del parte, por analogía con el PATCH del 28-sep; no
  abiertos uno a uno.**
- **Los 8 «sólo por envoltorio»** son `POST /quote/create` (5 vocabularios), `PUT /admin/merchant`
  (2) y `POST /admin/customers` (`PARTICULAR/EMPRESARIO`): la llamada vive en `api.js` y los
  valores en las vistas. Es el caso para el que existe el salto; **no los he abierto uno a uno**.

### La respuesta a «¿cuántas?», hoy

**0** rutas con la forma de 1136, sobre 55 pares de 71 vocabularios, con el positivo sembrado
saliendo y la gemela sin salir. Las 2 variantes «sólo al editar» del 28-sep siguen:
`POST /admin/customers` · `billingPeriodicity` y `POST /admin/partes` · `tipo`. Carril medido con
`carriles.mjs de`: `customersAdmin.routes.ts` y `customersView.js` son **J2**; `partes.routes.ts` es
**S1** y `jobDetailView.js` **S2** (equipo de Luis). Son decisión de producto, no defecto: no se tocan.
(Primero lo escribí «J2/J1» sin consultar; lo cacé al correrlo.)

### ⚠️ Lo que sigue sin verse

Todo lo declarado el 28-sep, y además: el salto por envoltorio **casa por nombre de función**, así
que una pantalla ajena con una función homónima cuenta como llamadora (medido con la siembra). El
cubo de 8 lo pone a la vista; no lo resuelve.
