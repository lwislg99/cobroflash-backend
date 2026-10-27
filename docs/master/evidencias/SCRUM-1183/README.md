# SCRUM-1183c · Los tres `where` muertos de `exports.routes.ts`, medidos ejecutando

S1 · 16-oct-2026 11:26Z (`Date:` de GitHub) · `origin/main` = `7e53b1474096bde7aa23898d9f30caf2097b5d70`.
Encargo del orquestador: medir sin borrar. **No se ha borrado nada**: se van después de que entre
`scrum-1183b` (S2, #2508), y los quita quien reparta el orquestador.

## Qué se mide

En `src/modules/exports/app/routes/exports.routes.ts`, `charges.csv`, `jobs.csv` y `quotes.csv`
construyen un `const where = { merchantId: req.merchantId } …` que **ninguna línea usa**: la ruta
llama a `buildCobros` / `buildTrabajos` / `buildPresupuestos(req.merchantId, { from, to }, status)`,
que montan su propio filtro con `whereRango` (`src/modules/exports/domain/exportData.ts`).

## Cómo

`sonda-where.cjs` carga el router COMPILADO (`dist/`) en express, con una base falsa que apunta cada
`findMany`, y hace 9 peticiones (sin filtro, con rango y con `status`; tres por ruta). Tres modos:

- `base`: el router tal cual.
- `mutante`: los tres bloques `where` borrados (en memoria; el ancla tiene que salir EXACTAMENTE 3
  veces, si no la sonda se declara CIEGA y sale con 2).
- `control`: control positivo, los builders reciben `'all'` en vez de `status` (ancla: 4, porque
  `buildFacturas` también lo recibe y no está en la batería).

    node docs/master/evidencias/SCRUM-1183/sonda-where.cjs <raíz> base|mutante|control <salida.json>
    node docs/master/evidencias/SCRUM-1183/compara-where.mjs <a.json> <b.json>

Requiere `npm run build` antes. Al salir, Node en Windows imprime `Assertion failed … async.c`
DESPUÉS de escribir el fichero; no afecta a la salida.

## Resultado (`salida.txt`)

- `base` frente a `mutante`: **9 de 9 idénticas** (el CSV y el `where` que llega a Prisma). Muertos.
- `base` frente a `control`: **3 distintas**, justo las 3 que llevan `status`. La sonda ve lo que importa.
- 🔴 **El de `jobs.csv` además MIENTE**: dice `createdAt`, y a `prisma.job` le llega `scheduledAt`
  (`CAMPO_FECHA_TRABAJOS`, SCRUM-106). Los de `charges` y `quotes` coinciden con su builder.
- Origen: `eded32c4e` (22-jul-2026, SCRUM-25 B+E) cambió `findMany({ where })` por el builder y dejó
  la declaración en estas tres rutas; en clientes y facturas sí se quitó. No es una migración a medias.
- Si se quitan hoy cae `tests/scrum1183-trabajos-csv.test.mjs:73` de `main`, que lee el texto muerto;
  `scrum-1183b` ya lo cambia por el filtro que se ejecuta de verdad.

`dist/` se compiló desde `scrum-1072-actividad-irpf-servidor`; `src/modules/exports` y
`src/core/db/prisma.ts` son idénticos entre aquel `main` (`48fc00f6a`) y este (`git diff` vacío).
