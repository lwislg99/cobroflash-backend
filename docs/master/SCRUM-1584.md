# SCRUM-1584 · el medidor táctil de la casa no veía los select ni los campos

## 23-oct-2026 · J6 · `INTERACTIVOS` incluye `select`, `textarea` e `input:not([type="hidden"])` (opción B)

**Medido contra:** `origin/main` = `a3c13611ed6f078fa7fe5af5882b0b8b2d1b2d3f` · 2026-10-23T14:17:47Z

A9: aviso → cicatriz J6 «Atribuí dos select al fichero que guarda su decisión y no al que los crea, y con ello el carril del arreglo» — no se pudo comprobar: el guard nombra el elemento (`SELECT.input`), no el fichero que lo crea, y ningún instrumento cruza una cosa con la otra

**Qué cambia:** `scripts/_medidor-de-toque.mjs`, la constante `INTERACTIVOS`. Antes:
`a[href], button, [role="button"], summary, input[type="submit"], input[type="button"], input[type="checkbox"]`.
Ahora: `a[href], button, [role="button"], summary, input:not([type="hidden"]), select, textarea`.
La opción B la decidió el orquestador (cobroflash-backend-62); la medición de A y B es de jv-j6al, en SCRUM-1584 c.20491.

**Alcance (c.20491, censo:tactil-panel, 28 superficies × 2 anchos):** distintos < 44, de 72 (main) a 100 con B.

**`guard:objetivo-tactil` con B (re-medido por jv-j6an sobre `a3c13611e`):** `⟦veredicto⟧ 4 hallazgos · 0 ciegos → salida 1`.
Los cuatro, a 390 px: buscador de Clientes (37), los dos `select` de la lista de Clientes (39 y 39) y el campo de
etiquetas de la ficha 360 dentro de `#c360-meta` (36,9). En main, sin B, el mismo guard da 0 hallazgos (medido por
jv-j6al sobre `37311b671`; no re-medido sobre `a3c13611e`).

**Por qué no está en main:** el job `guards-visuales` no es obligatorio, y con B se quedaría rojo en main. Regla 41: no
se añaden excepciones. **B entra cuando estén arreglados los 4** → SCRUM-1592 (J2: los crea `customersView.js:137-220`
y el componente `etiquetasDelDocumento.js` dentro de `#c360-meta`; el arreglo es una regla acotada en el bloque de J2
de `styles.css`, como `.gastos-pantalla select.input`).

**Corrección a c.20491:** allí los dos `select` salían en `filtroClientes.js`. Ese fichero guarda la DECISIÓN del filtro
y no tiene DOM; los crea `customersView.js:198-220`.

**Fuera de este ticket:** el censo `censo:tactil-panel` (S3) cuenta los dos `select` de Facturación como `sinPintar`,
porque viven en una pestaña oculta al montar (decisión ② de SCRUM-962b) → SCRUM-1593 (equipo-luis, area-s3).

**Tests:** los 6 ficheros que importan el medidor (scrum542, 543, 562, 711b, 865, 1148): 51 de 51, 0 saltados.
