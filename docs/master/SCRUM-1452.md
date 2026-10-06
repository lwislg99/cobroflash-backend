# SCRUM-1452 · Los dos guards por AST del patrón gemelo: el número y el importe en crudo

**Medido contra:** `origin/main` = `0dbf8eae7e47b8fd272aa644b810041c6ec3f9c0` · 2026-10-06T10:41Z

A9: comprobación → `tests/scrum1452-gemelo-crudo.test.mjs`

Sesión S3 · rama `scrum-1452-guards-gemelo-crudo`. Por encargo del orquestador (6-oct). Sale de
SCRUM-1444, que censó el patrón por texto y dejó escrito que los dos guards eran de S3 y por AST.

## Qué hay

- `scripts/_censo-gemelo-crudo.mjs` — el censo. Parsea cada `.ts` de `src/` (sintaxis, sin tipos).
  A mano: `node scripts/_censo-gemelo-crudo.mjs --lineas`.
- `tests/scrum1452-gemelo-crudo.test.mjs` — el trinquete, en la tanda.

Dos formas:

| Forma | Qué casa | Qué la libra |
|---|---|---|
| NUMERO | un valor interpolado justo detrás de un `#`, en una plantilla o en una concatenación | que el valor pase por `displayQuoteNumber`, `numeroConRevision`, `formatInvoiceNumber`, `formatAlbaranNumber` o `formatParteNumber` |
| IMPORTE | un `toFixed(2)` dentro de un texto que lleva una moneda, escrita (`€`, `EUR`) o interpolada (`${x.currency}`) | usar `formatMoneyEs` |

Y a dónde va el texto, subiendo por el árbol hasta lo que lo consume:

| Destino | Qué es | ¿Se acusa? |
|---|---|---|
| DENTRO | argumento de `console.*`, `logger.*`, `log.*` | no |
| FUERA | una propiedad `text`, `subject`, `html`, `title`… o una llamada `res.send`, `doc.text`… | sí |
| NO_DECIDIBLE | todo lo demás: una variable, un `return`, una propiedad que no conozco | sí, y se cuenta aparte |

Sólo DENTRO libra. Un sumidero que falte en mi lista baja un sitio de FUERA a NO_DECIDIBLE, nunca a limpio.

## Lo que salió (6-oct-2026, sobre el SHA de arriba)

Población: 316 ficheros `.ts` en `src/`, 0 sin analizar.

| Forma | Sitios | FUERA | NO_DECIDIBLE | DENTRO (no se acusan) |
|---|---|---|---|---|
| NUMERO | 54 | 13 | 29 | 12 |
| IMPORTE | 12 | 0 | 12 | 0 |

Además hay 39 `toFixed(2)` que no se acusan: 4 en un texto sin moneda (XML de VeriFactu, mensajes de
error) y 35 fuera de todo texto (cálculos).

Los 54 sitios acusados caen en 32 identidades (forma + fichero + función). Declarados:

| Clase | Identidades | Sitios | Quién los retira |
|---|---|---|---|
| DEUDA | 27 | 48 | S1: 24 sitios · J2: 16 · J1: 8 |
| LEGITIMO | 5 | 6 | nadie: el respaldo del propio `formatMoneyEs`, el catálogo que se le pasa a la IA (2), el color hexadecimal de `qrPagina` (2) y el PDF del presupuesto, que ya pasa por `numeroConRevision` |

**En 12 sitios de la deuda el valor es sólo un `id`, por su nombre** (`#${charge.id}`, `#${id}`, `#${quoteId}`):
los «cobro #id» de J2, el aviso de solicitud del bot y los dos correos de `merchantNotifications`. El nombre
no dice qué llega: según el comentario 18228 de SCRUM-1444, a `sendMerchantQuoteAcceptedEmail` el bot le pasa
el id GLOBAL de la tabla, y a `sendTechQuoteApprovedEmail` le llega la secuencia del merchant.

### Lo que el censo por texto no veía

El patrón de SCRUM-1444 pedía `.id`, `Id` o `quoteNumber` dentro de la interpolación, y `git grep` mira
línea a línea. Por AST aparecen 11 sitios de NUMERO que no estaban, 9 de ellos deuda:

| Sitio | Por qué no lo veía el texto |
|---|---|
| `sendQuote.service.ts` — el WhatsApp del presupuesto al cliente, 3 sitios | el valor es una variable (`displayNum`) |
| `quoteDecisionLanding.routes.ts` — la página de rechazo | lo mismo |
| `quoteDecisionLanding.routes.ts` — «Cotización #…» cuando no hay presupuesto | enseña el **token** como si fuera el número |
| `payCard.routes.ts` — «Cobro #id» como nombre del producto en el pago con tarjeta | el valor se llama `id` a secas |
| `jobs.routes.ts` — la cita de calendario | `s.quote.number` |
| `trabajoDirecto.ts` — el título del trabajo | una variable (`num`) |
| `pdf.service.ts` y `qrPagina.service.ts` (2) | no son deuda: declarados LEGITIMO |

Y en IMPORTE, las dos líneas de `invoicesAdmin.routes.ts` («Recibidos … de …») son cinco llamadas, no dos.

**Un carril distinto al del ticket:** SCRUM-1444 pone `whatsappIncoming.routes.ts`, `botFlow.service.ts` y
`customerPortal.routes.ts` en S1. `dos-equipos.md` §3.1 dice J2 (`src/modules/whatsappBot/**` y
`customerPortal.routes.ts`). La lista declarada sigue a la tabla.

## Visto en rojo

Con el árbol comiteado en `cd98863b52ed241bfba51aa33bc686fc3f7fba33`, cuatro siembras en `src/`, una a una, cada
una restaurada con `git restore --source=HEAD` y el árbol comprobado limpio después. Base y final: 20 pass, 0 fail.

| Siembra | `git diff --numstat` | Resultado | Qué caso cae |
|---|---|---|---|
| un `text:` con `#${q.id}` nuevo | `2 0 src/modules/quotes/domain/expire.service.ts` | 19 pass, 1 fail | «ningún sitio NUEVO…» |
| un `text:` con `toFixed(2)` y `${q.currency}` nuevo | `2 0` el mismo fichero | 19 pass, 1 fail | «ningún sitio NUEVO…» |
| quitarle el `#` a un sitio declarado | `1 1` el mismo fichero | 19 pass, 1 fail | «ninguna entrada declarada ha BAJADO…» |
| un fichero `.ts` nuevo que no parsea | fichero sin seguir | 19 pass, 1 fail | «…no deja ningún fichero sin analizar» |

No hace falta `npm run build` entre siembras: el censo lee `src/`, no `dist/`.

## Lo que NO ve

- Las familias donde el crudo es la **ausencia** de una llamada: `esc()`, `normalizePhone` y «aceptado»
  (`status === 'accepted'`). SCRUM-1444 las dejó fuera a propósito y siguen fuera.
- El importe que pasa por una variable (`const t = x.toFixed(2)` y luego `${t} €`). Se cuenta, no se acusa.
- El número que pasa por una variable y **sí** viene de un helper: lo acusa igual (es el caso del PDF,
  declarado LEGITIMO a mano). No sigue datos.
- `toFixed` con otro número de decimales, `Intl.NumberFormat` y `toLocaleString` escritos a mano.
- Un `#` que no toca al valor: `nº ${id}`, `# ${id}`.
- `public/` entero. La población es `src/**/*.ts`.
- Si un NO_DECIDIBLE acaba de verdad delante de una persona. De los 41 que hay no he abierto ninguno
  para seguirlo: se acusan por no poder demostrar lo contrario.

## Error propio

La primera regla de IMPORTE exigía que la moneda fuese la pieza de **al lado** del `toFixed(2)`. Dio 9
sitios y me pareció que cuadraba con los 7 de SCRUM-1444. Al cruzar línea a línea con su censo vi que en
«Recibidos A de B EUR» sólo acusaba B: tres importes de cinco se quedaban fuera. La regla pasó a «el
mismo texto lleva una moneda» y el caso está en el test (`lejos`).

## Lo que NO está hecho

- No se arregla ningún sitio: cambiar un número o un importe visible es texto que lee el usuario (regla 39).
- Ningún sitio visto en pantalla ni en un mensaje real.
- Suite completa en local: no corrida. Corridos, tras `npm run build`: `npm run guards:entrada` (13 guards,
  158 tests, verde) y `npm run tanda:dirigida` (232 ficheros de 1.235, 2.301 tests, 1 fail: `scrum1321`
  PUERTA 1b, el ciego conocido de esta máquina). El veredicto es el del CI.

# SCRUM-1452b · Corrección: los sitios de deuda que el texto no veía son 8, no 9

**Medido contra:** `origin/main` = `8c589a8e48b69bf39141181f126239610ed4e03f` · 2026-10-06T11:08Z

A9: aviso → A10 «Un número derivado no se elige: se recalcula.» — no se pudo comprobar: la cifra vive en prosa de un registro y ningún guard la recalcula

Arriba dice «11 sitios de NUMERO que no estaban, 9 de ellos deuda». Los 11 están bien contados; los de
deuda son **8**: de los 11, tres son LEGITIMO (el del PDF y los dos de `qrPagina`). Uno por uno: tres en
`sendQuote.service.ts`, dos en `quoteDecisionLanding.routes.ts` (la página de rechazo y el «Cotización #token»),
`payCard.routes.ts`, `jobs.routes.ts` y `trabajoDirecto.ts`.

Escribí el 9 restando de memoria en vez de contar la tabla que tenía debajo, y lo repetí en el comentario
de entrega de Jira (18281), corregido allí también. No cambia ni el censo ni la lista declarada: `DECLARADOS`
sale del censo, no de esta frase.
