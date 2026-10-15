# SCRUM-1183 · «Trabajos CSV» en Informes (y la supervisión por operario, que está sustituida)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:16:04Z (`Date:` de GitHub)
**Skill UI:** cargada · `yaqu-premium-ui`: es la quinta fila de una lista que ya existe (`makeExportBtn`, `.btn-secondary.btn-sm`); ni clase, ni estilo, ni componente nuevos.
A9: sin fallo que generalice — el único tropiezo lo cazó el propio control de ceguera del test (`load()` no llega al año sin un P&L con forma real) antes de ningún verde.

Carril S2 · árbol `s2-1183` · rama `scrum-1183-trabajos-csv`.

## Las dos piezas del ticket

| pieza | estado | por qué |
|---|---|---|
| `GET /admin/metrics/operarios` | **NO se construye** | SUSTITUIDA por el hub de Equipo (SCRUM-136, `getTeamOverview`), medido por S1 en c.17343 y aceptado en c.19799. Se queda en `declaradas` del censo, ahora con su motivo; la fija `tests/scrum24-operarios-metrics` |
| `GET /admin/exports/jobs.csv` | **construido aquí** | existía desde SCRUM-25 y sólo salía dentro del paquete de «Descargar datos» |

## Qué cambia (sólo front, sin servidor y sin ALTER)

- `public/dashboard/js/reportsView.js`: «⬇ Trabajos CSV» entre «Presupuestos CSV» y «Clientes CSV», con el año del
  selector (`?from=AÑO-01-01&to=AÑO-12-31`), en el mismo sitio donde lo reciben sus hermanos.
- **Por qué vale el mismo año:** `jobs.csv` y `quotes.csv` filtran los dos por `createdAt` con `from`/`to`
  (`exports.routes.ts:666` y `:711`). Medido ANTES de pedir la firma.
- `scripts/_sin-consumir-declarados.json`: `ruta · GET /admin/exports/jobs.csv` pasa a `retiradas`.
- Texto: «Trabajos CSV», firmado por el ORQUESTADOR, no por el fundador (c.19799). Ficha:
  `docs/microcopy/2026-10-15-SCRUM-1183-trabajos-csv.md`.

## Verificado, ejecutando

- `tests/scrum1183-trabajos-csv.test.mjs`: **4 de 4**. Monta Informes en el banco: el botón (uno, con su rótulo y
  su ruta), el MISMO rango de año que «Presupuestos CSV» (con control de ceguera: si «Presupuestos CSV» aún no
  tiene año, el test dice CIEGO, no verde), el filtro por `createdAt` de las dos rutas, y la ficha de la firma.
- **Control por mutación**, con la base en verde: sin la línea del año cae SU caso; sin colgar el botón caen los dos
  de pantalla.
