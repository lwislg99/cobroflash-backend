# SCRUM-1270 — El PR MUDO ≥3 h se avisa DENTRO del PR, diciendo por qué

**Medido contra:** `origin/main` = `7a94abae5260c5953b4171860e9779dd428f6527` · 2026-09-29T09:39:40Z

Sesión 3 (instrumentos). Sale de SCRUM-1263 (com. 17458: «nadie cubre el silencio»). Decisión del orquestador
(`cobroflash-backend-57`) sobre la medición: **no se construye otro avisador, se amplía el vigía que ya existe.**

## Lo medido

| Qué | Cifra | Cómo |
| --- | --- | --- |
| Cabezas empujadas del 22 al 29-sep | 587, en 328 PR | GraphQL; hora de empuje = primer `startedAt` de sus check-runs (el de `abrir-pr` corre en todo push) |
| Cabezas **mudas** (sin el check obligatorio) ≥1 h / ≥3 h / ≥12 h | 8 / 5 / 4 (la peor, #1642: 31,7 h) | idem |
| Qué las desatascó | 6 de 8, una mezcla de `main` (**conflicto**); 1, el cierre; 1, un re-push | asunto de la cabeza siguiente |
| ¿Había vigía? | **Sí**: `vigia-atascados.yml` ya clasificaba DIRTY y SIN-CHECKS, pero lo contaba en un **issue** | lectura del workflow |
| Cadencia real del cron «cada 3 h» | 60 pasadas del 17 al 29-sep: hueco mediano **4,9 h**, máximo **9,8 h**; 43 de 59 huecos ≥4 h | `gh run list --event schedule` |
| ¿`SIN-CHECKS` ve el mudo de #1943? | **No**: `008fbd51` tenía **1** check-run (`abrir-pr`), y SIN-CHECKS exige 0 | check-runs del sha |

## Lo construido

- `scripts/vigia-atascados.mjs` · `avisoEnElPR`: **mudo = falta un check obligatorio** sobre la cabeza, con la
  lista sacada de las reglas vivas de `main` (no «cero checks»). Solo avisa a partir de **3 h** sin push y dice
  **por qué**: si hay conflicto con `main`, que se mezcle `main`; si no lo hay, que no arrancó nada. Un conflicto
  cuyo check obligatorio **sí** corrió no se avisa (es el problema del verde olvidado, fuera de alcance). Si no se
  sabe qué checks son obligatorios, solo avisa con **cero** checks.
- `scripts/vigia-pasada.mjs` compone `avisos-pr.json` y comprueba cada cuerpo contra la mención.
- `vigia-atascados.yml`: paso nuevo que comenta **dentro del PR**, una vez por cabeza (la marca lleva el sha).
  Si no puede leer los comentarios, no publica y lo dice (`NO-SE-PUDO-MIRAR`). Permiso `pull-requests: write`.
  La cabecera dice la cadencia **real**.

## Pruebas

`tests/scrum1270-pr-mudo-avisado-en-el-pr.test.mjs`: el caso real de #1943 (DIRTY con un check-run), el hueco de
SIN-CHECKS, el verde olvidado (no se avisa), el umbral, la lista de obligatorios desconocida, y un laboratorio que
ejecuta la pasada **real**. Tres mutaciones declaradas; todas caen, y las de `scrum839c` siguen cayendo.

## Límites

- El aviso llega entre las 3 h y 3 h + el hueco del cron (hasta ~10 h medidas). Acortarlo pediría otro disparador,
  y eso no forma parte de este ticket.
- El vigía solo mira los PR con auto-merge armado o abiertos por el bot (su regla de siempre).
- El paso de publicación se prueba por su texto, no ejecutándolo: `gh` no existe en la tanda.
