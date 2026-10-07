# SCRUM-1490 · El año de la serie se guarda en el presupuesto, y el grupo de revisiones es {negocio, año, número}

**Medido contra:** `origin/main` = `73ce872cbcb6c914355830fd6b358e30aa066c77` · 2026-10-07T07:31:06Z
A9: comprobación → `tests/scrum1490-el-anio-de-la-serie.test.mjs`

🔴 **Bomba con fecha: el 1-ene-2027 la ficha de un presupuesto cuya secuencia se repita da 500.**

Carril S1 · sesión `s1-7octb` · rama `scrum-1490-anio-de-la-serie`. Es el paso ③ del orden del esquema (A5): esquema + código + tests. **El paso ② (el ALTER en las tres bases, que aplica el colaborador) NO consta hecho al escribir esto**: este PR nace en BORRADOR y no se marca listo hasta que conste.

## El defecto

La serie de presupuestos es anual (SCRUM-592) y `quotes` guardaba sólo la secuencia; el año se deducía de `createdAt`. Vale para un original. Una revisión es una fila nueva con su fecha: la `.1` de un original de diciembre creada en enero salía con el nombre de otro documento. Y el grupo de revisiones se armaba por {negocio, número} en tres sitios, sin año: con el 12 de 2026 y el 12 de 2027 en la tabla, leer el grupo lanzaba `RevisionesAmbiguas` y `GET /admin/quotes/:id` contestaba 500.

## Lo decidido, y dónde está escrito

- **La columna:** `seriesYear Int? @map("series_year")` en `model Quote`. Comentario 18536 del ticket, punto 1. El DDL (`ALTER TABLE "quotes" ADD COLUMN "series_year" INTEGER;`) está en los comentarios 18522 y 18617.
- **El relleno de lo viejo:** del `createdAt` en `Europe/Madrid`, con el supuesto declarado dentro. Comentario 18536, punto 2.

## Lo construido

| Pieza | Qué hace |
|---|---|
| `prisma/schema.prisma` | la columna, aditiva y nullable |
| `src/core/documentos/grupoDelPresupuesto.ts` (nuevo) | el ÚNICO sitio que dice qué año es una fila (`anioDeLaSerie`) y cómo se filtra un grupo por año (`whereDelAnio`, `whereDelGrupo`) |
| `quotes.routes.ts`, `maintenance.service.ts`, `albaranes.routes.ts` | los tres que reservan número guardan el `year` que `allocateQuoteNumber` ya devolvía y se tiraba |
| `revision.ts` + `quoteAdmin.ts` (`crearRevisionDeQuote`) | la revisión guarda el año de su grupo, no el del día en que se crea |
| `quoteAdmin.ts` (`getQuoteDetailAdmin`, `crearRevisionDeQuote`) y `accesoAlPresupuesto.ts` | el grupo y el recorte del Técnico pasan a {negocio, año, número} |
| `quoteNumber.service.ts` (`displayQuoteNumber`) | si la fila guarda el año, la serie (`P260012`) se escribe con ése |
| `scripts/rellenar-anio-de-la-serie.mjs` (nuevo) | el relleno: simulacro por defecto, `--aplicar` para escribir, destino comprobado por la clave (SCRUM-383) |

**La fila vieja** (año a NULL) se lee con el año de su `createdAt` en la zona del negocio, que es la función con la que se numeró. Es exacto para todo original, y para una revisión mientras su grupo tenga un solo original: cierto hasta el 1-ene-2027. Con el relleno hecho antes, ese respaldo deja de decidir.

## Medido

- `tests/scrum1490-el-anio-de-la-serie.test.mjs`: 10 de 10. Aceptación 3 (censo por AST de los 4 `quote.create` de `src/`, y `crearRevisionDeQuote` con el reloj en enero de 2027), 4 (por el manejador real de `GET /admin/quotes/:id`) y 5 (`wherePresupuestosVisibles`).
- **Rojo visto** con el commit `e366b46e21f48a31aeb0a6cc9924bd8ebb84353c` como base: quitando el año del `where` (`whereDelAnio` devolviendo `{}`; `git diff --numstat`: `1 0`) caen 4 de 10, los de las aceptaciones 3, 4 y 5 y el de la fila vieja. Restaurado y recompilado.
- Control dentro del test: agrupando por {negocio, número}, los dos originales de este banco lanzan `RevisionesAmbiguas`.
- Tanda dirigida de 151 ficheros de `tests/` (los que nombran lo tocado y los que censan `scripts/`, `docs/master` y el esquema): la primera pasada dio 25 rojos, todos míos, y están arreglados en esta rama; las cifras de la pasada final van en la entrega del ticket.

## Lo que este cambio obligó a tocar fuera de lo suyo

- Cuatro fixtures de `tests/` (`scrum688`, `scrum887c`, `scrum892`, `scrum984`) montaban una fila de `quotes` sin `createdAt`. Una fila real siempre lo trae; se les ha añadido. Y el doble de `scrum1489` aprende a evaluar el año y la zona.
- `docs/sql/deriva-prod.sql`: regenerado con `node scripts/generar-sql-deriva.mjs` (512 columnas).
- `docs/legal/AUDITORIA_CAMINO_EMISION.md`: una coordenada de línea de `schema.prisma` (917-918 → 922-923) que el esquema desplazó. Sólo el número.

## Lo que NO está hecho, o no está medido

- **Aceptación 2** (la constancia del ALTER en `main`): espera al colaborador.
- **Aceptación 6** (cuántas filas quedan sin año tras el relleno): el script está y cuenta su población, pero no se ha ejecutado contra ninguna base. Quién lo corre está sin decidir.
- **El número con serie en el panel** (`P260012` en vez de `#12`): NO entra aquí. No está en la aceptación, el papel sigue diciendo `#12` (`pdf.service.ts`, J1) y repartirlo es de SCRUM-1444. `numeroVisibleDelPresupuesto` no cambia.
- **La zona del relleno frente a la de la reserva:** la decisión dice Europe/Madrid; `allocateQuoteNumber` numera con la zona del negocio, que sin declarar es UTC. Sólo discrepan en la última hora UTC del 31-dic. El script NO rellena esas filas: las lista como `frontera_de_anio`. Cuántas hay en producción no se sabe.
- No se ha ejecutado contra un Postgres real: la mitad con base corre en el check obligatorio del CI.
