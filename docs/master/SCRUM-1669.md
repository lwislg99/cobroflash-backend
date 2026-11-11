# SCRUM-1669 — PILOTO-1 · el total por fila en GET /admin/albaranes

**Medido contra:** `origin/main` = `358e2a1bbd5a5d8c0868ae6db01a11fe44615604` · 2026-11-11T11:30:17Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1669-total-por-fila-de-albaran` · **Carril:** S1 · albaranes.

A9: comprobación → `tests/scrum1669-total-por-fila-de-albaran.test.mjs`

> Puesto S1 (servidor). Corte exacto en SCRUM-1669 c.21433: `albaranesListado.ts` (interfaz de la fila y mapeo
> de `listarAlbaranesDelMerchant`).

## El arreglo (sin texto nuevo)

- `FilaAlbaranListado.total: number | null`. Lleva la regla del detalle (`albaran.service.ts`:
  `totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null`): **número** (IVA incluido)
  para VALORADO y **`null`** para SIN_VALORAR. Un 0 diría «vale cero» de algo que solo no tiene precios.
- Cero consultas nuevas: las líneas ya venían en la fila del albarán.

## Rojo primero

`tests/scrum1669-total-por-fila-de-albaran.test.mjs`, sobre `listarAlbaranesDelMerchant` de verdad y con un
lector falso. **Sin** el arreglo: **2 ✖ / 1 ✔** (VALORADO → 86,30, el número del detalle con
`calcAlbaranTotales`; SIN_VALORAR → `null`, con la clave presente; el SUELO en verde). Con el arreglo: 3/3.
Junto a los otros bancos del listado (`scrum301`, `scrum831*`, `scrum304`): 44 ✔ / 0 ✖.

## Pendiente

- La columna en pantalla es de S2 (front). El servidor ya manda el dato.
- Verlo en yaqu.app después del merge: `GET /admin/albaranes` con un albarán VALORADO y uno SIN_VALORAR.

## Mitad S2 · la columna en pantalla (11-nov-2026 ~14:55Z, GitHub · base `origin/main` 412ddc20d)

Rama `scrum-1669c-importe-en-la-lista`. Carril S2 (`albaranesView.js`, `styles.css`).

| aceptación | qué se hace |
|---|---|
| la lista pinta el total de cada albarán valorado, Tinta ≥700 tabular | columna **«Importe»** detrás de «Trabajo»; celda `cell-amount` + `.amount` (Tinta 700, `tabular-nums`); `fmtMoneyEs(f.total, 'EUR')`. `total: null` (SIN_VALORAR) pinta «—», nunca «0,00 €» |
| «Emisión» de un borrador | **«—»**, y lo decide el SERVIDOR: rama de S1 `scrum-1669b-emision-vacia-en-borrador` (`emisionAt: null`). La vista ya pintaba «—» para un `null` (`fechaCorta`), así que aquí no se escribe nada propio: lo probé en el front y lo quité al ver la rama de S1, para no tener la regla en dos sitios. El test de S2 sólo vigila que «Importe» no mueva a «Emisión» de la 2.ª posición (la oculta `th:nth-child(2)`) |
| tarjeta de móvil | área `amount` en la línea de la fecha (`"date amount"`), sólo en `.table--albaranes`; la rejilla compartida no se toca |

**Texto:** «Importe» = texto firmado **n.º 17** de SCRUM-1656 c.21405 («Rótulo de la columna del importe · «Importe»»),
firma c.21408 ① «Entradas 1-23: aprobadas TAL CUAL están escritas en c.21405.» (alcance c.21411). Ningún otro texto nuevo.

**Tests:** nuevo `tests/scrum1669c-importe-en-la-lista-de-albaranes.test.mjs` (banco de vistas). Sobre los ficheros
de `origin/main`, los dos de importe (celda `.amount` con «242,36 €» / «—» para `null`, y el área `amount` de la
tarjeta) dan ✖ por el motivo esperado; con el arreglo, 3/3. Las dos fijaciones de cabecera (`scrum301` COPY_APROBADA
y `scrum831`) pasan de 7 a 8 columnas citando la firma: más estrictas, no más flojas. Ficha de mudez renovada
(`npm run censo:mudez -- --escribir`: 1 medido, VIVO). Con los bancos de la lista (301, 304, 719, 831, 1450,
1559g/i/k, 1659, 713c): 109 ✔ / 0 ✖.

**Medido en yaqu.app** (cuenta QA, sólo GET, `sondas-s2/lista-1669.mjs`, JS y CSS de la rama servidos sobre prod,
testigo `SCRUM-1669` en el JS servido): AB260006 = **242,36 €**; las 6 SIN_VALORAR «—» (esa medida llevaba aún el «—» del borrador
en el front, ya retirado: la «Emisión» se mide con la rama de S1 en prod); peso 700, `tabular-nums`. Página sin desborde horizontal en 320 · 390 · 641 · 769 · 800 · 929 · 1024 · 1280.

⚠️ **Lo que empeora, declarado:** la tabla pide ~77 px más. Scroll DENTRO de su `.table-scroll` (la página, 0):

| ancho | prod hoy | con «Importe» |
|---|---|---|
| 769 | 61 | 138 |
| 800 | 30 | 107 |
| 929 | 0 | **70** («Enviar para firmar» queda medio fuera hasta desplazar) |
| ≥1024, ≤641 | 0 | 0 |

769-899 ya scrolleaba (forma aceptada en SCRUM-1559k). Lo nuevo es 900-1023. Lo probé ocultando «Entrega» también
en 900-1023 y daba 0 a 929, pero el guard de SCRUM-1559k fija que «Entrega» SÓLO se oculta en 769-899 (regla 41: no
se toca el guard), así que **se queda fuera** y va como decisión para el orquestador.
---

## Tramo b — «Emisión» de un borrador (S1, 11-nov-2026)

**Medido contra:** `origin/main` = `412ddc20d0233162159567d4e7705bf845f71404` · 2026-11-11T14:47:25Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1669b-emision-vacia-en-borrador` · **Carril:** S1 · albaranes.

A9: comprobación → `tests/scrum1669b-emision-vacia-en-borrador.test.mjs`

### ① La decisión

Aceptación 2 del ticket: «decidido y escrito qué enseña "Emisión" para un borrador». S1 lo propuso en
SCRUM-1669 c.21486 (`emisionAt: null` + la raya que ya existe) y el orquestador respondió que sí, el
11-nov por la tarde, en un mensaje a S1: «`emisionAt: null` en el borrador y el «—» que ya existe
(coincide con lo que decidí ayer para esa columna: raya, sin palabra)».

### ② El arreglo (sin texto nuevo)

- `albaranesListado.ts`: `emisionAt: a.estado === 'borrador' ? null : a.createdAt`, y el tipo de la fila
  pasa a `Date | string | null`. Emitido y firmado siguen con `createdAt` (SCRUM-67).
- Pantalla: nada que tocar. `fechaCorta` de `albaranesView.js` ya devuelve `—` para un valor vacío, y
  `emisionAt` no tiene otro consumidor en `public/` ni en `src/`, que lo he buscado con grep.
- La fecha del PDF (`albaran.service.ts:834`) no cambia: un borrador no tiene PDF emitido.

### ③ Medido

- **Rojo primero:** sin el arreglo, 1 ✖ (el borrador salía con `emisionAt: "2026-10-16T12:41:22.412Z"`)
  y 2 ✔ (el suelo, y el control de que emitido y firmado conservan su fecha).
- **Verde:** los 19 ficheros de `tests/` que leen `emisionAt` o el listado (`albaranesListado` /
  `listarAlbaranes`) dan **158 ✔ / 0 ✖ / 0 saltados**.
- En prod, antes del arreglo: AB260003 (borrador, cuenta QA) traía `emisionAt` = su `createdAt`.

### ④ Pendiente

- La columna del importe (aceptación 3) es de S2: el campo es `total`.
- Verlo en yaqu.app después del merge: en `GET /admin/albaranes`, AB260003 con `emisionAt: null`, y la
  lista enseñando «—» en «Emisión» para esa fila, a 390 y a 1280 px.

---

## Mitad S2 · tramo 2 — la banda 900-1023 y el guard de SCRUM-1559k re-anclado (11-nov-2026, tarde)

Rama `scrum-1669c-importe-en-la-lista` (con `origin/main` fusionado, que ya trae el tramo b de S1). Carril S2.

A9: comprobación → `tests/scrum1559k-albaranes-769-899.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar `styles.css`; el cambio no añade tokens, componentes ni textos: oculta una columna que ya existe en una banda más)

**La decisión.** El tramo 1 de arriba dejó fuera, como pregunta, el desborde de 70 px a 929 que trae «Importe»
(pregunta de S2 en SCRUM-1669 c.21494). Respuesta del orquestador, en su encargo al relevo de S2 (11-nov, tarde): «SÍ a su arreglo
probado: con la columna «Importe», «Entrega» se oculta TAMBIÉN en la banda 900-1023 (deja el desborde en 0)»,
y que el guard de SCRUM-1559k «se RE-ANCLA al diseño nuevo EN EL MISMO PR».

**Por qué no es tocar un guard en rojo (regla 41).** El guard de 1559k fijaba el diseño de 1559k: «Entrega»
oculta SÓLO en 769-899. Ese diseño cambia con una columna FIRMADA: «Importe», texto n.º 17 de SCRUM-1656
c.21405, firma c.21408 ① («Entradas 1-23: aprobadas TAL CUAL están escritas en c.21405»). El guard no se afloja:
sigue fijando lo mismo, con la banda nueva, y gana un aserto (el suelo y «Entrega» se acotan por separado).

| | antes (1559k) | ahora |
|---|---|---|
| «Entrega» oculta (cabecera y `td.cell-date`) | 769-899 | **769-1023** |
| suelo `.table-scroll .table--albaranes { min-width: 0 }` | 769-899 | 769-899 (sin cambio: desde 900 el carril pasa de 520) |
| «Entrega» oculta fuera de su banda | prohibido | prohibido (aserto propio) |
| suelo anulado fuera de 769-899 | prohibido | prohibido (aserto propio) |

**Rojo y verde del guard** (espejo de `HEAD` en un temporal FUERA del árbol, cruzando guard × CSS; el 4.º test,
el del banco, falla en el espejo por falta de `dist`, y en el worktree pasa: 4/4):

| guard | CSS | los 3 asertos de reglas |
|---|---|---|
| viejo | viejo | 3 ✔ |
| viejo | nuevo | **2 ✖** (el viejo ve «Entrega» oculta fuera de 769-899) |
| nuevo | viejo | **2 ✖** (no la ve oculta en 769-1023) |
| nuevo | nuevo | 3 ✔ |

Bancos de la lista (301, 304, 719, 831, 1450, 1559g/i/k, 1659, 713c, 1669c), antes de fusionar main: 112 ✔ / 0 ✖.

**Medido en yaqu.app** (cuenta QA, sólo GET, `sondas-s2/lista-1669.mjs local <rama> testigo` con
`TESTIGO_CSS=c.21494`: el JS y el CSS servidos son los de la rama). Desborde DENTRO de `.table-scroll`; la
página da 0 en todos:

| ancho | tramo 1 (con «Importe») | ahora | columnas visibles |
|---|---|---|---|
| 390 | 0 | 0 | tarjeta |
| 769 · 800 | 138 · 107 | 138 · 107 | Nº, Cliente, Trabajo, Importe, Estado, Acciones (sin cambio: banda de 1559k) |
| 899 | — | 8 | ídem |
| 900 · 905 | — | **7 · 2** | ídem |
| 910 · 929 · 1000 · 1023 | 70 a 929 | **0** | ídem |
| 1024 | 0 | 0 | + Entrega |
| 1280 | 0 | 0 | + Emisión, Entrega |

⚠️ **Declarado:** el «0» de la decisión vale desde 910. Entre 900 y 909 quedan 2-7 px de scroll dentro de su
carril (el patrón del design system, el mismo que 769-899 ya tenía). No lo he estrujado más: sería tocar
rellenos o columnas fuera de lo decidido.
