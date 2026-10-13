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
| `quotes.routes.ts`, `maintenance.service.ts`, `albaranes.routes.ts` | los tres que reservan número guardan el `year` que `allocateQuoteNumber` ya devolvía y se tiraba *(nota del 13-oct: `albaranes.routes.ts` ya NO; ver abajo)* |
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

---

## 13-oct-2026 · la rama se pone al día y deja de esperar al ALTER

**Medido contra:** `origin/main` = `cf0a4cb7eb8613d394f98bc3134ba9a89896839c` · 2026-10-13T13:56:02Z
A9: comprobación → `tests/scrum1490-el-anio-de-la-serie.test.mjs`

Sesión de S1 que releva a `s1-13octd`. Lo de arriba es del 7-oct y se deja como se escribió; lo que cambia va aquí.

### El paso ② (el ALTER), y quién lo ha medido

`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "series_year" INTEGER;` — **aplicado en los tres destinos según el equipo de Javier** (comentario 19370 del ticket, rectificado en el 19373 sólo en lo que decía de esta rama):

| Destino | Quién lo aplicó | Quién lo ha medido |
|---|---|---|
| dev y tests (`yaqu_dev_javier`, la misma base) | el orquestador del equipo de Javier | él, leyendo el catálogo, con control positivo y negativo. **NO medido por nosotros** |
| staging | el fundador («OK hecho») | **NO medido por nosotros**, y el 19370 no dice que nadie lo leyera del catálogo |
| producción | el fundador («OK hecho») | el check «constancia del ALTER» del CI de este PR, que se lo pregunta a producción: el 7-oct cayó nombrando `quotes.series_year`. Su resultado de hoy va en la entrega del ticket |

Este árbol no tiene ninguna clave de base (`node scripts/comprobar-claves-bd.mjs`: las tres ausentes), así que dev y staging no se han podido mirar desde aquí.

### Lo que cambia respecto al 7-oct

- **`albaranes.routes.ts` ya NO se toca.** El tercer sitio que reserva número es el presupuesto ADICIONAL que nace al convertir un albarán en factura, y su `quote.create` vive dentro del manejador `POST /:id/convertir-en-factura`, debajo de `sellarTrasEmision`: es camino de emisión (reglas 38 y 40) y modificarlo pide el OK del fundador, que no consta. El 7-oct se tocó; hoy la rama deja ese fichero idéntico al de `main` (`git diff origin/main -- src/modules/jobs/app/routes/albaranes.routes.ts`: vacío). **Consecuencia, declarada:** ese adicional nace con el año a NULL y se lee por su `createdAt`, que para un original es exacto mientras el negocio no cambie de zona; su revisión sí guarda el año del grupo. El censo del test lo lleva como la única excepción, exacta en los dos sentidos. El OK está pedido en el ticket.
- **`crearRevisionDeQuote` cambió en `main`** (SCRUM-1150c: cerrojo de transacción y el grupo leído dos veces). El año del grupo se resuelve ahora dentro de `decidirRevisionDe`, con el lector que le toque (el global la primera vez, el de la transacción la segunda), y la revisión lo recibe ya resuelto.
- **El doble del test devolvía la fila entera** y por eso no veía un `select` cerrado sin el campo (aviso del equipo de Javier). Ahora proyecta lo que el `select` pide, y hay un caso nuevo: revisar la `.1` creada en enero sigue en el 12 de 2026.

### Medido el 13-oct

- `tests/scrum1490-el-anio-de-la-serie.test.mjs`: 10 de 10.
- **Tres mutantes sobre `dist/`, con la base sin mutar antes y después (10 de 10 las dos veces):**
  - `SELECT_PARA_REVISION` sin `seriesYear` → cae el 5 (aceptación 3). **El mismo mutante con el doble de antes (fila entera) dejaba el 5 en verde**: sólo caía el control del propio doble.
  - `whereDelAnio` devolviendo `{}` (el grupo por número a secas, que es el defecto) → caen 4 de 10: el 3 (aceptación 4, la ficha), el 4 (la fila vieja), el 5 (aceptación 3) y el 8 (aceptación 5).
  - la revisión sin recibir el año del grupo → cae el 5.
- Tanda dirigida, 378 ficheros de `tests/` (los que nombran algo de lo tocado): la primera pasada dio 3.630 tests con 8 rojos, todos de esta rama y arreglados en ella — dos fixtures de `main` que montaban una fila de presupuesto sin `createdAt` (`scrum1150`, `scrum1150c`) y una coordenada de `schema.prisma` en `docs/legal/AUDITORIA_CAMINO_EMISION.md` que la columna desplaza cinco líneas. Las cifras de la pasada final van en la entrega del ticket.
- `docs/legal/AUDITORIA_CAMINO_EMISION.md`: tres coordenadas, sólo el número (1795 → 1800; 917-918 → 922-923; 916 → 921). Las dos últimas no llevan testigo y ningún guard las habría cazado.

### Lo que sigue sin hacer

- **Aceptación 6** (cuántas filas quedan sin año tras el relleno): el script sigue sin ejecutarse contra ninguna base, y quién lo corre sigue sin decidir.
- **El adicional del albarán** no guarda el año (arriba).
- **No se ha ejecutado contra un Postgres real** en local: la mitad con base la corre el check obligatorio del CI.
