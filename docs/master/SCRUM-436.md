# SCRUM-436 · un solo formato de euros — y el ticket no era el que parecía

**Fecha:** 10-ago-2026 · **Carril:** front (dashboard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `38a6f4a6e9e732c4a5c9e35c6e7c3d54992058ca` · 2026-08-10T18:23:37+02:00

## PASO 0 — y la primera medición desmiente el encargo

El encargo decía «cuatro formateadores y **ninguno compartido**». **Falso, y el censo que lo dijo
era mío** (SCRUM-428).

`fmtMoneyEs(n, currency)` existe en **`api.js:190`**, está en `window` y lo usan **20 ficheros con
66 llamadas**. Lo que había eran **tres copias que se habían separado de él** — y una la escribí yo
sin buscar antes si existía.

### Los cuatro, medidos con la misma batería (no razonados)

| valor | compartida (`api.js`) | `libroRegistro` | `reports` / `jobs` |
|---|---|---|---|
| `0` | `0,00 €` | `0,00 €` | `0,00 €` |
| `null` | `0,00 €` | **`—`** | `0,00 €` |
| **`1000`** | **`1.000,00 €`** | **`1000,00 €`** | **`1000,00 €`** |
| **`9999.99`** | **`9.999,99 €`** | **`9999,99 €`** | **`9999,99 €`** |
| `1234567.5` | `1.234.567,50 €` | `1.234.567,50 €` | `1.234.567,50 €` |
| `'texto'` | `0,00 €` | **`NaN €`** | **`NaN €`** |
| moneda ≠ EUR | la respeta | la respeta | **fuerza `€`** |

**El agrupado de miles no es cosmético.** es-ES **no agrupa las cuatro cifras** por CLDR; `api.js`
lo fuerza con `useGrouping:'always'` desde A18.2 (AB6, «9.999,99 €»). Cada copia **reintrodujo el
defecto que la original ya había corregido**, y el tramo **1.000–9.999 €** es el importe corriente
de un trabajo de oficio.

### La diferencia que SÍ era deliberada — y no se unifica a ciegas

`libroRegistroView` devuelve **`—`** para `null`, y **su propio comentario lo dice**: *«`null` NO es
cero»*. En un libro de registro que se imprime y se entrega, poner `0,00 €` donde no hay dato es
afirmar un importe que nadie ha calculado. **Se conserva.**

Y en el mismo comentario está la prueba de que lo otro **no** era deliberado: exige que
*«9.999,99 € tiene que caber y leerse»* — y su `Intl` sin `useGrouping:'always'` imprimía
**`9999,99 €`**. **El fichero incumplía su propia especificación escrita.**

## Lo entregado

**`fmtMoneyEsOAusente(n, currency, ausente = '—')`** en `api.js`, **construido SOBRE `fmtMoneyEs`**:
separador de miles, decimales, posición del símbolo y moneda son los mismos **por construcción**.
Lo único que añade es la decisión sobre el ausente — y también trata como ausente el dato ilegible,
que antes salía `NaN €`.

| llamada | queda | motivo |
|---|---|---|
| `expensesView.js:424` | **sin cambios** | ya delegaba en `fmtMoneyEs`; nunca fue una copia |
| `libroRegistroView.js:92` | → `fmtMoneyEsOAusente` | conserva su `—` y **gana el agrupado que su comentario exigía** |
| `reportsView.js:447` | → `fmtMoneyEs` | la **misma pantalla** ya usaba `fmtMoneyEs` diez líneas antes: imprimía los dos formatos a la vez |
| `jobsView.js:80` | → `fmtMoneyEs` | el que metí yo en SCRUM-428; este fichero **ya usaba `fmtMoneyEs` en cuatro sitios** |
| **`reportsView.js:542`** | → `fmtMoneyEs` | **el QUINTO, que no vio ninguna persona: lo cazó el censo de este ticket mientras se escribía** |

Ese quinto llevaba `minimumFractionDigits` **sin** `maximumFractionDigits` ni agrupado: podía soltar
más de dos decimales.

## El guard, DERIVADO del árbol y no de un `grep`

`tests/_censo-formato-euros.mjs` recorre el **AST** (compilador de TypeScript, que parsea JS) de
`public/dashboard/js/*.js` y reconoce las dos formas de construir un importe a mano:

1. `new Intl.NumberFormat(…, { style: 'currency', … })` — lo declara el propio objeto de opciones;
2. una concatenación cuyo literal lleva símbolo de moneda (`€`, `EUR`, `$`, `£`).

Un `grep` por «€» se caza a sí mismo en el comentario que explica la prohibición, y no distingue
`(x*100).toFixed(0) + '%'` de `n.toFixed(2) + ' €'`. **Ya nos costó una vez medir con la misma
técnica cuyo fallo denunciábamos.**

Allowlist **visible y con motivo** (`PUEDEN_FORMATEAR`): sólo `api.js`, que es el formateador.

## Verificación

- **Control positivo:** los mismos importes dan **el mismo texto** en las cuatro pantallas, para
  `0`, `1000`, `9999.99`, `1234567.5`, `-50`, `0.005`. Más el caso que motivó todo:
  `fmtMoneyEs(1000) === '1.000,00 €'`.
- **Control negativo:** un porcentaje, una cantidad (`' ud'`), un `Intl.DateTimeFormat` y una
  concatenación de texto **no caen**. *Un guard que marca todo no marca nada.*
- **SUELO doble:** el censo tiene que mirar **≥40 ficheros**, y el detector tiene que reconocer las
  **2** formas conocidas sobre fuente sintética — control que **sobrevive al arreglo**, que es lo
  que un suelo tiene que hacer.
- **El ausente sigue siendo el ausente:** `fmtMoneyEsOAusente` da `—` para `null`, `undefined`, `''`,
  texto y `NaN`; y **`0` sigue siendo `0,00 €`** (esconder un cero real es la mentira simétrica).
  `fmtMoneyEs` **no cambia** su trato del ausente: lo usan 20 ficheros y cambiarlo sería cambiar lo
  que dicen veinte pantallas sin pedirlo.

## El carácter invisible, otra vez — y esta vez me lo cacé yo

La primera versión del normalizador llevaba el **espacio duro (U+00A0) pegado en el fuente**.
Funcionaba, y era una trampa: se lee como un espacio normal, así que el siguiente que toque la línea
lo sustituye sin enterarse y **el normalizador deja de normalizar en silencio**. Misma familia que
el `\b` que entró como `0x08` en SCRUM-428.

Ahora se escribe **por su código** (`String.fromCharCode(0xa0)`) y hay un test que comprueba que
sigue siendo el carácter que creo. *(Y de paso: `Intl` separa cifra y símbolo con ese espacio duro,
así que comparar contra `'1.000,00 €'` escrito a mano falla por un carácter invisible con un diff
que se ve idéntico.)*

## Dos bancos de prueba que simulaban un navegador roto

`scrum296-pantalla-libro` y `scrum406-canal-prometido-existe` evalúan `libroRegistroView.js` en un
`vm` con `window: {}` y **sin cargar `api.js`** — algo que el navegador nunca hace
(`index.html:215` va antes que `:257`). Al pasar la vista a usar el formateador compartido, esos
bancos se pusieron rojos **por su propia laguna**, no por el producto.

Se les añade la carga de `api.js` **y la reposición del doble de `apiRequest`** (api.js define el
suyo, el de red, y pisaba el del banco). Son dos guards ajenos y se tocan **sólo** para que dejen de
simular un navegador al que le falta un `<script>`; ni una aserción cambiada.

## Lo que NO se ha tocado

**Ningún cálculo.** Este ticket cambia **cómo se pinta** un número, jamás cuánto vale: los cinco
cambios son de formateo y ninguno toca una suma, un total ni un importe. `prisma/schema.prisma`,
el camino de emisión y el backend, intactos.

## Evidencia

- Worktree limpio desde el remoto con entorno completo: **2607 tests · 2533 pass · 0 fail ·
  74 skipped · `$? = 0`**.
- `npm run guards:entrada`: **`$? = 0`**.
