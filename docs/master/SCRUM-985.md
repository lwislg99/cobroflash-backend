# SCRUM-985 · El aviso de importar clientes decía «CSV o Excel» y solo se lee .csv

**Medido contra:** `origin/main` = `5820ad9259054032ef0966c8101288b9f76e8248` · 2026-09-21T11:03:00Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-985-importar-solo-csv`
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-985-importar-solo-csv.md` (firma delegada, SCRUM-985 comentario 16104).

## Paso 0: el defecto existía hoy

Leído sobre el árbol de `5820ad92`: `customersView.js` fijaba `importBtn.title = "Importar clientes
desde un fichero CSV o Excel"` mientras `csvImport.js` declara `accept=".csv,.txt"` y `package.json`
no tiene ningún lector de hojas de cálculo. El texto prometía un formato que la pantalla no leía.

## Lo que cambia (una línea de `public/`)

`customersView.js`: el `title` pasa a «Importar clientes desde un fichero CSV» (literal firmado, ver
arriba). Nada más: ni servidor, ni esquema, ni dependencia. **Leer `.xlsx` queda fuera** (librería
nueva → decisión del fundador, regla 36); si algún día se decide, es otro ticket y el test de abajo se
reescribe a propósito.

## El juez: `tests/scrum985-el-aviso-de-importar-no-promete-excel.test.mjs`

Cinco pruebas, las cuatro primeras sobre el árbol real y la quinta sobre el propio detector:

| prueba | qué exige |
|---|---|
| tooltip | el `title` es EXACTAMENTE el texto firmado |
| `accept` | el `<input type="file">` de `csvImport.js` acepta solo `.csv` y `.txt` |
| dependencias | ningún lector de hojas de cálculo (`xlsx`, `exceljs`, …) en `package.json` |
| censo | «Excel»/«xlsx» en `public/*.{js,html}` solo aparece en la frase declarada de `csvImport.js`; **población declarada**: se exigen ≥ 50 ficheros vistos, y la frase permitida tiene que verse (si no, el «cero sospechosas» sería «no miré») |
| control | el detector ve la frase que se retiró (un cero sin este control no probaría nada) |

**Verificado en rojo** (cada mutación sobre el árbol, con el `git diff --numstat` a la vista, y restaurado
después):

| mutación | resultado |
|---|---|
| el tooltip vuelve a decir «CSV o Excel» | exit 1 · 2 caen (tooltip y censo) |
| el `accept` del importador añade `.xlsx` | exit 1 · 2 caen (`accept` y censo) |
| otro fichero de `public/` nombra `.xlsx` | exit 1 · 1 cae (censo) |
| entra `xlsx` en `dependencies` | exit 1 · 1 cae (dependencias) |

## Lo que NO se hizo

No se comprobó en yaqu.app/staging el tooltip renderizado: es un atributo `title` sin efecto visible en
móvil (no hay «hover»); lo que se midió es el DOM que fija el test, no una captura.
