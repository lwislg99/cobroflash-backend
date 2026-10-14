# SCRUM-1273 · Archivar presupuestos

**Medido contra:** `origin/main` = `fcc889928bd077ecd81776fded32ca83658e7cbb` · 2026-09-29T10:09:43Z

## Paso ② de A5 · el ALTER, escrito y SIN APLICAR (S1, s1-29a)

La medición de S2 (s2-29a) mostró que archivar necesita columna nueva: `model Quote` no tiene
`archivedAt` ni nada parecido, y `status: 'archived'` no vale (estado nuevo en lista cerrada, Parte L;
y desarchivar exigiría recordar el estado anterior).

- Fichero: `docs/sql/scrum-1273-archivar-presupuestos.sql` —
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);` (nullable, sin default;
  ninguna fila cambia).
- **Sin `archived_by`:** el «quién» va a `recordAudit`, que ya guarda el autor. Dos sitios para el
  mismo hecho divergirían.
- DDL derivado OFFLINE con `previewMigracion` (control positivo: 31 tablas) contra `origin/main` =
  `223498dc`, con el candidato en el scratchpad. **`prisma/schema.prisma` no se ha tocado** (regla 40).
- Anotado en `docs/MIGRATIONS_PENDING.md` con las tres bases sin marcar. Lo aplica el equipo de Javier.

**El ticket sigue aparcado:** el PR ③ (esquema + código + pantalla) no se construye hasta que la
columna esté en las tres bases.

## La mitad de S2 · la pantalla, contra el contrato firmado (s2-14oct, 14-oct-2026)

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T08:26:53Z (`Date:` de GitHub).
**Skill UI:** cargada (`yaqu-premium-ui`).

**Error propio:** escribí mi propia regla para pintar el motivo del servidor («sólo en el 409») y
abrí la tabla de acciones dentro de la vista, sin buscar antes si la casa ya tenía la pieza. La
tenía (`mensajeParaPersona`, y el patrón `destinoAccionTrabajo`), y me lo dijeron los guards, no yo.

A9: comprobación → `tests/scrum1233-mensaje-para-persona.test.mjs`

Firmas y decisiones en SCRUM-1273 comentario 19605 (el orquestador; responde al 19604 de S2). El
reparto: **S1 primero** (esquema + `POST /admin/quotes/:id/archivar|desarchivar` + el filtro de
`GET /admin/quotes`), **S2 después**. Esta mitad se construye contra ese contrato, con un DOBLE del
servidor en el banco, y **su PR se queda en borrador y sin armar hasta que la parte de S1 esté en
`main`**. A esta hora la parte de S1 no está en `main` ni tiene PR.

| qué | dónde |
| --- | --- |
| La fila `btnBorrar` («Borrar») pasa a `btnArchivar` («Archivar»): `overflow` en `draft`, `rejected` y `expired`; `oculta` en el resto. Siguen siendo 13 filas | `quoteActionsRegistry.js` |
| `destinoAccionPresupuesto(id, estado)`: la pregunta «¿en qué destino va esta acción en este estado?» vive junto a la tabla y se expone, como `destinoAccionTrabajo` en `jobActionsRegistry.js`. Falla cerrada (null) con una acción o un estado que no conoce | `quoteActionsRegistry.js` |
| «Archivar» en la cabecera, junto a «⎘ Duplicar» (la ficha no pinta «⋮»). Se ofrece si `destinoAccionPresupuesto('btnArchivar', estado)` no es `oculta` y el presupuesto no está archivado; sin la tabla cargada, no se ofrece | `quotesDetailView.js` |
| `confirm()` con T2; T5/T6 al terminar; el fallo pasa por `mensajeParaPersona` (SCRUM-1233): el `message` del servidor si lo trae (así llega T10 en el 409), y si no, T7/T8 | `quotesDetailView.js` |
| En un archivado (`archivedAt` del detalle), el aviso T3 con «Desarchivar» (T4), en cualquier estado | `quotesDetailView.js` |
| «Archivados» en el selector de estado: se pide con `?archivados=1`, no con `status`; su vacío dice T9 | `quotesListView.js` |
| El viaje entero con las dos pantallas montadas, la tabla contra la pantalla en los seis estados, cancelar, el 409 y los otros fallos | `tests/scrum1273-archivar-presupuesto.test.mjs` |
| Los textos, literales | `docs/microcopy/2026-10-14-SCRUM-1273-archivar-presupuestos.md` |

**Dos guards cambian a propósito, porque la conducta cambia:**
- `tests/scrum421-registro-presupuesto.test.mjs` («los trece rótulos»): `btnBorrar: 'Borrar'` →
  `btnArchivar: 'Archivar'`, y un assert más: `btnBorrar` no vuelve a la tabla.
- Censo 1157 (`scripts/_censo-convenio-microcopy-declarados.json`): `btnBorrar` sale de «acusadas» y
  entra en «retiradas» con su motivo. `btnArchivar` lleva la firma en su línea y sale APROBADO como
  firma PROPIA, no de grupo. La CLI: `0 nuevas · 0 que sobran · 34 acusadas · 170 aprobadas por grupo`
  (antes, 35 acusadas). Era la última hoja de SCRUM-1215 en el carril de S2.

**Cinco guards se pusieron en rojo con la primera versión, y se arregló el CÓDIGO, no los guards:**
- `scrum837` (decisión encerrada): la ficha abría `QUOTE_ACTION_REGISTRY` ella misma → la pregunta
  pasa a `destinoAccionPresupuesto`, expuesta junto a la tabla.
- `scrum1233` (un `.message` pintado a mano): leía `err.data.message` con su propia regla → pasa por
  `mensajeParaPersona`, la de la casa. Mi regla («sólo en el 409») era una variante nueva.
- `scrum713c` (estilos escritos desde JS): el aviso llevaba `style.cssText` → `alert info` dentro de
  una `detail-section`, clases que ya existen.
- `scrum1415` (tests de nombre construido): el bucle por estados → `casosEscritos`, nombres literales.
- `scrum514` (texto aprobado sin aplicar): T10 estaba en la ficha de microcopy y lo aplica la ruta
  de S1, no esta pantalla → sale de la sección de literales; se explica en la ficha.

**Rojos de la tanda que NO son de esta rama:** 11, en `scrum222`, `scrum235`, `scrum245`, `scrum252`,
`scrum461`, `scrum733` (el cliente Prisma del `node_modules` compartido va por detrás del esquema: el
`npm run build` local da 5 errores de tipos por eso) y `scrum1321` (el temporal está en otra unidad).
**Base:** los mismos 7 ficheros sobre `origin/main` = `e2be1c9f` sin mis cambios dan los mismos 11 rojos.

**Desviación declarada:** el comentario 19604 decía que también cambiaba `tests/scrum984-…:509-511`.
**No ha hecho falta:** esas líneas cuentan 13 filas y comparan el conjunto de la tabla con el de los
rótulos; con el cambio de nombre en los dos sitios siguen siendo 13 e iguales. El fichero no se toca.

**Control positivo:** dos mutantes, uno en cada pantalla, ponen rojo el viaje: pedir «Archivados» como
`status=archivados`, e invertir el `archivedAt` que la ficha guarda tras el POST.

**Lo que NO prueba, y lo que no hace:**
- **Que la ruta de verdad cumpla el contrato.** El doble lo da por hecho. Eso lo prueban los tests de
  S1 en su PR y el viaje en yaqu.app con la cuenta QA, que queda POR HACER cuando entren las dos mitades.
- **Un POST vencido** (`incierto`, SCRUM-459) no dice «no se pudo»: la ficha se vuelve a leer del
  servidor, que es quien sabe si quedó archivado. No lleva texto nuevo, y no está en el banco.
- **El CSV:** con «Archivados» elegido, el enlace de exportación es el de «Todos los estados»
  (decisión 2: archivar no saca nada del CSV).
- Los textos dicen «presupuesto» también donde el panel dice «cotización» (MX, CO, PE, CL): la firma
  es del literal.
- La marca «Archivado» en el buscador: sin construir, como decidió el comentario 19605.
