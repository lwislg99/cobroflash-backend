# SCRUM-688 · El motor de revisiones tenía cero llamadores — ahora tiene uno, y una puerta

**Fecha:** 16-sep-2026 · **Carril:** backend (ruta + dominio) y frontend (pantalla) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `713a29b738966ecb524a25fffbb842e9f3d09a52` · 2026-09-16T04:49:22Z
**Re-medido contra:** `origin/main` = `8dac4cd5` — **main se movió durante el ticket** y la línea
base caduca cuando eso pasa. Se mergeó y se volvió a pasar la tanda ENTERA, no sólo lo mío: trae
`scrum628-cobertura-visual-del-dashboard`, y este ticket toca la pantalla y la hoja de estilos, así
que dar por bueno el verde anterior habría sido suponerlo. **0 colisiones de fichero, 0 fallos.**
**Rama:** `scrum-688-crear-revision`

> 🟢 **Construido con el SÍ del fundador**, y sólo lo que ese sí cubría: el POST que llama a
> `nuevaRevisionDe`, su llamada desde `quoteRevisiones.js` sobre la versión **vigente**, y esta
> entrada.
> ⛔ **El texto del botón NO lo he escrito yo** (regla 30). Va con centinela y se dice abajo.
> ⛔ **Sin ALTER, sin columna nueva, sin estado nuevo, sin dependencia.** No hizo falta ninguno.

---

## 1 · El control que decide, ANTES: un motor sin llamador

`nuevaRevisionDe` llevaba desde SCRUM-655 construido, probado y con su propio trinquete de
herencia (SCRUM-686). Lo que nadie había medido es si alguien lo llamaba.

Censo ejecutando la app de verdad —`app.router.stack` + `getAdminMounts()`—, **no por `grep`**:

| | rutas | POST | POST que cree una revisión |
|---|---|---|---|
| con el cableado **apagado** | 177 | 66 | **0** |
| con el cableado puesto | 178 | 67 | `POST /admin/quotes/:id/revisiones` |

Y `LLAMADORES EN src/ : 0`. «Construido ≠ alcanzable» en su forma pura: todo el trabajo de
SCRUM-655b, 661 y 686 vigilaba un camino que ningún profesional podía recorrer.

🔴 **Y el primer censo que escribí para esto estaba CIEGO**, conviene anotarlo porque casi publica
una conclusión falsa: andaba `app._router`, que **Express 5 ya no tiene** (aquí va la 5.1.0).
Devolvía `rutas: 0` — y el cero del árbol LIMPIO es lo único que lo delató, porque el cero de
después se lee exactamente igual que un «✅ la mutación cae». El censo definitivo lleva control
positivo: si con el cableado puesto no ve la ruta, aborta en vez de contar ceros.

## 2 · Qué hacía el profesional mientras tanto, y por eso el tamaño del arreglo

No podía editar el original —no existe ninguna ruta que edite el cuerpo de un presupuesto— así que
hacía **uno nuevo desde cero, con otro número base**. El cliente recibía `P2004227` en vez de
`P2004226.1`: dos documentos sin relación visible, sin histórico de qué se le enseñó, y con los 24
campos heredables rellenados a mano otra vez.

## 3 · ⛔ Lo que este camino NO es: un rodeo a `puedeEditarse`

Un presupuesto firmado **sigue sin poder tocarse**. Crear una revisión no edita nada: escribe una
fila nueva y la anterior se queda exactamente como estaba. Comprobado explícitamente, no asumido:

- `quote.update` se dobla y se cuenta — la función hace **0 UPDATE**;
- `signatureUrl` **no se hereda**: heredarla sería firmar por el cliente un documento que no ha
  visto. La mutación que la hereda (M4) tumba el caso.

## 4 · 🔴 El hueco (a) del ticket: que el `select` traiga los 24 campos de `REVISION_HEREDA`

`nuevaRevisionDe` copia con `if (campo in anterior)`. Un campo clasificado que el llamador no traiga
en su `select` **no viaja, y los tests siguen verdes**: no falla nada, el dato simplemente no está.

Cerrado **en la raíz, no con una lista paralela**: el `select` se **deriva** de `REVISION_HEREDA`,
no se escribe a mano.

```ts
const SELECT_PARA_REVISION = Object.freeze(Object.fromEntries(
  [...REVISION_HEREDA, 'id', 'merchantId', 'quoteNumber', 'revision', 'signatureUrl']
    .map((campo) => [campo, true]),
)) as Record<string, true>;
```

Y el censo no lee el código: **captura el `select` real desde el doble** y lo compara campo a campo
contra `REVISION_HEREDA`, con suelo (`REVISION_HEREDA.length >= 20`) para que una lista vacía no
pase por «todos viajan». Dos casos separados, porque son dos afirmaciones distintas: lo que se
**pide** y lo que **llega a la fila**.

## 5 · 🔴 El hueco (b): el PDF de una revisión — **defecto vivo, medido y NO arreglado aquí**

El PDF de la revisión **sale**, y sale con su contenido heredado (total y líneas, comprobado sobre
los datos que la función escribió, no sobre un objeto inventado).

**Pero no puede decir de qué versión es.**

```ts
// src/modules/invoicing/infra/pdf/pdf.service.ts
export type ParamsPdfPresupuesto = { quoteId: number; … quoteNumber?: number | null; … }   // :157
.text(`${QUOTE_LABEL} #${params.quoteNumber ?? params.quoteId}`, { align: 'right' });        // :749
```

`quoteNumber` es un **entero**: estructuralmente no admite el `.1`. La revisión y la original salen
con el mismo `#2004226`. `params.number` —el que sí lleva texto— pertenece al PDF de **factura**,
no al de presupuesto. El cliente recibiría dos papeles que se llaman igual: exactamente lo que las
revisiones existen para evitar.

⛔ **Por qué NO se arregla en este ticket, y queda dicho en vez de hecho:**

1. Cambiarlo es **modificar `pdf.service.ts`**, el fichero del camino de emisión — se lee, no se
   modifica (reglas 38/40).
2. No es un detalle de formato: es **qué número ve el cliente** en un documento, que es microcopy
   del fundador (reglas 30/39).
3. El encargo acotó el alcance a «el endpoint, la llamada desde la pantalla y la entrada». Esto se
   sale, y el sitio de decirlo es aquí.

El caso queda **fijando el estado de hoy**, no saltado: `tests/scrum688-crear-revision.test.mjs`
afirma que el PDF **no** lleva el `.1` y **sí** lleva el número base. Si alguien arregla el PDF, ese
test cae — y su mensaje dice que hay que **girarlo**, no borrarlo.

## 6 · 🔴 El rol lo puso el guard, no yo

La ruta nació sin declarar rol y la red fail-closed de SCRUM-55 dio rojo con su nombre dentro:

```
🔴 RUTA /admin SIN DECLARAR ROL (1):
   · POST /admin/quotes/:p/revisiones
```

Se arregló **el código, no el guard** (regla 41). Se elige `requireRole('admin')` —el default de
S1— por una razón medida y no por comodidad: crear una revisión **crea un presupuesto**, y
`POST /admin/quotes` tampoco está en `TECNICO_ALLOWED`. Lo que el Operario sí tiene sobre un
presupuesto (verlo, su PDF, notas, accept/reject, envíos) se queda igual; esto no le quita nada,
le cierra una puerta que hasta hoy no existía.

## 7 · ⛔ El texto del botón: centinela, no microcopy mía

Dos textos hacen falta y **ninguno es mío**. Van en un bloque **separado** de los seis aprobados el
3-sep-2026, para que lo pendiente no se mezcle con lo firmado:

```js
const TEXTOS_SIN_APROBAR = {
  crearRevision: '⛔ PENDIENTE DE MICROCOPY (SCRUM-688)',
  errorCrear:    '⛔ PENDIENTE DE MICROCOPY (SCRUM-688)',
};
```

El guard del ticket vigila las dos direcciones: que el centinela **siga** en los pendientes, y que
`TEXTOS` **siga teniendo seis** entradas — un texto nuevo ahí dentro es microcopy sin aprobar
disfrazada. Y lo mide **cargando la pantalla** con `cargarDashboard` (el banco de SCRUM-417, que
corre los scripts del panel en orden con `window === global`), no leyendo su texto: leerlo mide el
parecido, cargarlo mide lo que el profesional tendrá delante.

## 8 · Las dos cabeceras contradictorias de `revision.ts:15-25`

El fichero llevaba dos cabeceras que se desmentían. Una afirmaba que **`Quote` no tiene columna de
revisión** — falso desde SCRUM-674. Se sustituyen por una sola que dice lo que el código hace
**hoy**: leer por `getQuoteDetailAdmin`, crear por `crearRevisionDeQuote` + `POST
/admin/quotes/:id/revisiones`. La falsa **se corrige diciendo que lo era**, no se borra en silencio:
quien la escribió tenía razón el día que la escribió, y saber cuándo dejó de tenerla es la mitad
del valor del comentario.

## 9 · 🔴 Las mutaciones — siete, y cada una tumba SÓLO la suya

Instrumento en `spawnSync({ shell: false })`, sin shell. Cada mutación **demuestra que entró**
(comparación de contenido; si no cambia, aborta) y el fuente se restaura **byte a byte**
(`Buffer.compare === 0`) comprobado tras cada pasada.

| | mutación | qué cae |
|---|---|---|
| M1 | la ruta no se registra | censo: 178→177 rutas, 67→**66** POST, **0** de revisión |
| M2 | el `select` deja de derivarse de `REVISION_HEREDA` | el censo de campos heredables |
| M3 | `siguiente` suma uno a la abierta, no al grupo | el número sale del GRUPO ENTERO |
| M4 | la revisión hereda la FIRMA | NO escribe en la versión anterior |
| M5 | el botón desaparece de la pantalla | el botón apunta a la VIGENTE |
| M6 | se escribe microcopy propia en vez del centinela | el texto sigue MARCADO |
| M7 | la ruta pierde `requireRole('admin')` | la ruta exige rol `admin` |

⚠️ **Tres defectos del instrumento, encontrados y arreglados antes de fiarme de una sola cifra.**
Se anotan porque los tres producían un verde o un «cae» que no significaba nada:

1. **El censo ciego de `app._router`** (§1). Daba «✅ CAE» sobre una medición vacía.
2. **Restaurar el fuente no restaura `dist/`**, y los tests corren contra `dist/`. M5 y M6 —que
   sólo tocan un `.js` del panel— tumbaban un test de backend: seguían corriendo contra el `dist/`
   mutado de M4. Ahora se reconstruye tras restaurar.
3. **M5 anclada en `data-revision-crear=`** dejaba vivo el selector `[data-revision-crear]` del
   cableado: la mutación entraba y no apagaba nada. El ancla es sin el `=`.

Y una precondición barata **antes** de gastar un `tsc` por mutación: cada `espera` tiene que ser
substring de un nombre de test real. Cuesta un `readFileSync`; no comprobarlo cuesta una pasada
entera que declara «no cae» porque el nombre no casa.

## 10 · ✅ Controles negativos

- `tests/scrum55-admin-fail-closed.test.mjs` — la red /admin, **en verde con la ruta nueva dentro**.
- `tests/scrum263-sin-lineas-409.test.mjs`, `tests/scrum286-censo-nuevo-presupuesto.test.mjs`,
  `tests/scrum127-paywall-bloquea.test.mjs`, `tests/scrum600-un-solo-front-documento.test.mjs`,
  `tests/tenancy-permisos.test.mjs` — crear un presupuesto normal sigue funcionando igual.
- `vistaDeRevisiones` sigue dando la misma vista: **ver** revisiones no ha cambiado.

## 11 · Ficheros

| fichero | qué |
|---|---|
| `src/modules/system/quoteAdmin.ts` | `crearRevisionDeQuote` + `SELECT_PARA_REVISION` derivado + `RevisionNoCreable` |
| `src/modules/system/app/routes/quotesAdmin.routes.ts` | `POST /:id/revisiones` con `requireRole('admin')` |
| `src/modules/quotes/domain/revision.ts` | las dos cabeceras contradictorias → una, con lo que es falso dicho |
| `public/dashboard/js/quoteRevisiones.js` | botón sobre la vigente, cableado del POST, centinela de microcopy |
| `tests/scrum688-crear-revision.test.mjs` | 13 casos (suelo, censo, el que decide, PDF, rol, microcopy, botón) |

## 12 · 🔴 Los cuatro guards que saltaron, y ninguno se relajó

La tanda completa dio **4 rojos, los cuatro míos**. Se arreglaron los cuatro arreglando el código
(regla 41). Van aquí porque tres de ellos dicen algo que el ticket no sabía.

### a) SCRUM-411 · el registro de huérfanos tenía apuntados EXACTAMENTE los tres que cablé

```
🔴 HAY 3 DECLARACIÓN(ES) QUE YA NO CORRESPONDEN A NINGÚN HUÉRFANO:
   src/modules/quotes/domain/revision.ts::vigenteUnicaDe
   src/modules/quotes/domain/revision.ts::REVISION_HEREDA
   src/modules/quotes/domain/revision.ts::nuevaRevisionDe
```

La línea de `nuevaRevisionDe` decía, **textualmente**: *«Se borra esta línea el día que un POST la
cablee.»* Ese día fue hoy. La deuda duró del **2-sep-2026 al 16-sep-2026**: catorce días con la
regla «un presupuesto FIRMADO no se reescribe» construida, probada y sin un camino por el que un
profesional llegara a ella.

Las tres se retiran **con constancia de por qué**, no en silencio: el propio guard avisa de que una
lista que mengua tiene dos causas —la cableaste, o el detector se quedó ciego— y saber cuál fue es
lo único que distingue las dos el día que alguien lo relea. `revisionesDe`, `REVISION_NO_HEREDA` y
`REVISION_LA_PONE_EL_SISTEMA` **siguen** en el registro: no tienen llamador.

### b) SCRUM-421 · un `select` no es una escritura — y el control unitario medía otro algoritmo

El censo de estados leía mi `select: { …, status: true }` como una escritura de `status` cuyo valor
no sabía resolver, y con una sola sin resolver **el fichero entero se declara CIEGO**. No lo era:
en Prisma lo que se escribe va bajo `data:`; `select:`/`include:` son proyecciones. Se le enseña a
distinguirlo **por estructura**, igual que ya distinguía el `res.json` — y con su negativo, que es
lo que separa «enseñarle a ver» de «taparle un ojo»: la escritura bajo `data:` se sigue contando.

🔴 **Y al escribir ese caso salió algo mayor:** `censarFuente` —la puerta que usan los controles
unitarios, anunciada como *«igual, pero sobre una fuente suelta»*— **no llamaba a
`dentroDeEscrituraQuote`**. Miraba todo `status:` viniera de donde viniera, así que los controles
del guard ejercitaban un algoritmo distinto del que se aplica al árbol. El control del `res.json`
seguía verde **por una razón que no era la suya**: `status: q.status` no se resuelve, así que caía
en `sinResolver` —donde ese test no mira— en vez de contarse como escritura. La cuenta salía; el
motivo, no. Las dos puertas comparten ya el mismo filtro.

### c) SCRUM-713c · el estilo en línea, y el color que además estaba mal

349 sobre un techo de 348: un `style.cssText` mío en `quoteRevisiones.js`. Sale a su clase en
`styles.css` (regla 4), sin tokens nuevos. Y el trinquete arregló dos cosas de una: el color que
había puesto era `--danger`, cuando **esta misma hoja ya midió** (línea ~600) que para texto la
tinta es `--danger-ink` — `--danger` sobre fondo claro no llega a 4,5:1.

### d) SCRUM-533 · CRLF en un fichero que toca esta rama

`tests/_censo-estados-presupuesto.mjs` quedó en CRLF al editarlo (blob en HEAD: **0 bytes CR**;
disco: **216**). Devuelto a LF y **comprobados los diez ficheros** de la rama, no sólo ése. No se
tocó `.gitattributes`.

---

**`npm run guards:entrada`: 4 guards, 26 tests, 0 fallos.**
**Tanda completa (con main dentro): 6937 tests · 6827 pass · 0 fail · 110 skipped** (los gateados de siempre —
`QA_DB_TEST`, `LIBRO_PG_URL`, staging—; este ticket **no añade ni un salto**).

---

# APÉNDICE · 16-sep-2026 · EL MICROCOPY, FIRMADO

**Medido contra:** `origin/main` = `8dac4cd52eda32fa0ebed21ea7050cfdc643658d` · 2026-09-16T09:34:50+01:00
**Qué cambia respecto al §7 de arriba:** aquel decía que los dos textos estaban MARCADOS, y era
cierto cuando se escribió. El fundador los ha firmado, así que el centinela se retira.

## Los dos literales aprobados

| ranura | literal |
|---|---|
| `crearRevision` | `Crear revisión` |
| `errorCrear` | `No se ha podido crear la revisión. Vuelve a intentarlo.` |

Ficha: `docs/microcopy/2026-09-16-SCRUM-688-crear-revision.md`. El registro
`MICROCOPY_APROBADA_SIN_APLICAR.md` está **congelado** desde SCRUM-709 — un fichero por
aprobación, para que dos sesiones que firman el mismo día no choquen.

## El bloque de pendientes se va ENTERO

No se queda vacío. Una caja que ya no distingue nada sólo puede engañar al que la lea después, y
`TEXTOS` pasa de 6 a **8** entradas: las seis del 3-sep-2026 más estas dos.

`errorCrear` sólo se pinta cuando **el servidor no manda motivo propio**. Cuando lo manda
—`quote_not_found`, `quote_sin_numero`, `revisiones_ambiguas`— se enseña el suyo: el motivo no se
inventa.

## El test se GIRÓ, no se borró

Es la misma disciplina que se dejó escrita para el caso del PDF. El de ayer exigía que el centinela
siguiera puesto; hoy exige el literal firmado, y **no se fía de mi palabra**: contrasta los dos
textos contra el registro con `constaAprobado()` —la única función que barre `docs/microcopy/` y el
congelado— y lleva su propio **suelo**, probando primero con uno de los seis del 3-sep-2026. Sin ese
suelo, un buscador ciego diría «no consta» sin haber mirado, y eso se lee igual que «falta firma».

**Centinelas vivos de SCRUM-688 en código: 0.** Lo que queda del literal está en la ficha de
aprobación (que narra de dónde venía), en las aserciones que exigen que NO aparezca, y en el §7 de
arriba, que es registro fechado.

## 🔴 Y el rótulo firmado tumbó un guard — cuyo verde de ayer era SUERTE

`scrum655c-pantalla-revisiones` exigía que la pantalla **no ofreciera crear** una revisión, con
este motivo escrito: *«el POST que la crea NO está aprobado, y un botón que el servidor no atiende
es peor que no tenerlo»*. Era cierto al escribirlo. El fundador aprobó el POST el 15-sep-2026, así
que **la premisa está anulada**: el botón sí tiene quien lo atienda.

Lo que importa no es eso, sino **por qué siguió verde un día de más**. Su patrón nombraba
`data-revision-editar`, `data-revision-nueva` y el rótulo `Crear revisi`. El botón de SCRUM-688 se
llama `data-revision-crear` y el 15-sep llevaba por texto un **centinela de microcopy**, así que no
casaba con ninguno de los tres. **La pantalla ya ofrecía crear y el test decía que no.** No cayó al
añadir el botón: cayó hoy, al ponerle su texto firmado.

Un `!/…/` sólo dice que no vio lo que buscaba — no distingue «no está» de «se llama de otra
forma». Por eso el caso se parte en dos y el segundo se afirma **en positivo**:

- **EDITAR sigue prohibido** (`data-revision-editar`, `data-revision-nueva`), y esa mitad no se
  toca: un presupuesto firmado no se reescribe.
- **CREAR ahora se EXIGE** (`data-revision-crear=`): es la única salida cuando la vigente está
  firmada.

**Tanda completa: 6938 tests · 6828 pass · 0 fail · 110 skipped.**

---

# APÉNDICE · 16-sep-2026 · EL HUECO (b), CERRADO — el papel ya dice de qué versión es

**Medido contra:** `origin/main` = `396e65caa92cd008632d0eb79d39bb56b7f2faef` · 2026-09-16T10:10:11+01:00
**Qué cambia respecto al §5 de arriba:** aquél declaraba el defecto VIVO y decía por qué no se
tocaba. El fundador dio luz verde el 16-sep-2026 sobre la medición que sostenía el PARO.

## 1 · La respuesta a la pregunta que condicionaba el diseño

**¿Lee `generateInvoicePdf` el tipo de `:157`? NO.** Declara el suyo **en línea** en la 244
(`params: { number: string; invoiceId: number; … }`) y no menciona `ParamsPdfPresupuesto`. Sus dos
únicos lectores son `generateQuotePdf` (702) y `presupuestoParaPdf.ts`. Así que el campo nuevo no
roza la factura, y —como decía el encargo— ni esa conversación.

## 2 · El tipo NO se ensancha: la revisión viaja como dato propio

```ts
quoteNumber?: number | null;          // SIGUE siendo number
revision?: number | null;             // SCRUM-688 · el dato nuevo
```

Ensanchar `quoteNumber` a texto era la salida fácil y es la que habría metido a la factura en el
cambio: un número que a veces es texto deja de poder ordenarse ni compararse en ningún sitio.

⚠️ **Opcional aquí, obligatorio para quien construye los parámetros.** `presupuestoParaPdf.ts`
deriva su tipo con `Completo<ParamsPdfPresupuesto>`, que quita el `?` de **todas** las claves: el
campo no se puede olvidar en el constructor —no compila— y a la vez no rompe a ningún llamador con
un objeto de antes. La `?` es compatibilidad, no laxitud.

## 3 · El número lo forma el DOMINIO, no el documento

```ts
const numeroVisible = params.quoteNumber == null
  ? String(params.quoteId)
  : numeroConRevision({ numero: String(params.quoteNumber), revision: Number(params.revision ?? 0) });
```

`numeroConRevision` **ya llevaba dentro** la regla «sólo con `revision > 0`»: devuelve el número
pelado cuando no la hay. No se reimplementa nada — dos sitios que forman el mismo número acaban
formándolo distinto. El respaldo al `quoteId` se conserva, y sobre un id **no** se pinta revisión:
no es un número de documento, es una clave interna.

Todo el cambio vive **por encima de la 702**; lo único fuera es el `import` y el campo del tipo.

## 4 · Los controles

### 🔴 EL QUE DECIDE — ejecutado, antes y después

```
ANTES                                   DESPUÉS
ORIGINAL  → Presupuesto #2004226        ORIGINAL  → Presupuesto #2004226
REVISIÓN  → Presupuesto #2004226        REVISIÓN  → Presupuesto #2004226.1
¿`revision` en los params? false        ¿`revision` en los params? true
```

### ✅ NEGATIVO — la factura, POR CONTENIDO

Generada con el código de antes (`faead250`) y con el de ahora: **dice exactamente lo mismo**, 500
caracteres comparados, con su número `2026-CF-0007` dentro (suelo: un papel mudo coincidiría
consigo mismo sin probar nada).

🔴 **Y por qué no por bytes.** El encargo lo corrigió citando SCRUM-665, y se comprobó **aquí**
antes de aceptarlo, con dos pasadas seguidas y **parámetros idénticos** —mismo `invoiceId`, fecha
clavada— para que la diferencia no pudiera ser el dato:

```
bytes iguales entre dos pasadas idénticas:      false      ← el formato NO es determinista
tamaños:                                        4883 vs 4883
contenido igual entre dos pasadas idénticas:    true
```

Dos salidas que difieren en bytes no prueban nada aquí. El contenido sí.

### ✅ POSITIVO — un presupuesto sin revisiones

Idéntico en contenido a como salía antes (324 caracteres), con su número y **sin ningún `.0`**.

### 🔴 MUTACIÓN — y la que NO cayó era un hueco de verdad

| | mutación | qué cae |
|---|---|---|
| MP1 | el rótulo vuelve a ignorar la revisión | el que decide, **y** el del camino real |
| MP2 | el constructor manda `revision: 0` fijo | el del camino real |

**MP2 no tumbaba nada la primera vez**, y no era una mutación equivalente: mis casos llamaban a
`generateQuotePdf` **directamente**, pasándole `revision` a mano. Con eso sólo se demuestra que el
documento SABE pintar el sufijo — el cable entre la fila de la base y el papel estaba **sin
vigilar**, y romperlo devolvía en silencio los dos documentos con el mismo número.

Es la misma forma del defecto que da nombre a este ticket: «el documento puede» no es «el producto
lo hace». Se cerró con un caso que entra por la MISMA puerta que las cuatro rutas reales
—`paramsDePresupuestoParaPdf`— y con su suelo (`'revision' in params`).

Las dos mutaciones demuestran que **entraron** (contenido distinto; si no cambia, aborta) y el
fuente se restauró **byte a byte** con reconstrucción de `dist/` después.

### El test de ayer se GIRÓ

Afirmaba que el papel **no** llevaba el «.1», con esta instrucción dentro: *«no lo borres:
gíralo»*. Hoy exige lo contrario, y además que **el original siga sin sufijo** y que los dos
papeles **no digan lo mismo**.

## 5 · Un mordisco del instrumento, anotado

El lector de cifras de la mutación salió **CIEGO** en la primera pasada: el heredoc se comió una
barra y `'(\d+)'` quedó `(d+)`, que no casa nunca. El instrumento **se declaró ciego en vez de
inventar un cero** —para eso está el suelo—, pero la causa era mía. Ahora usa `[0-9]`, que no tiene
barra que perder por el camino.
