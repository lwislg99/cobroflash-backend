# SCRUM-1634 · Las cinco categorías de gasto de siempre: sin firma, y fuera del censo

**Medido contra:** `origin/main` = `eafca9fe154c26d38b05a748ca816ba098943724` · 2026-10-29T17:46:37Z

**Puesto:** S4 · **Fecha:** 29-oct-2026, ~17:45Z (cabecera `Date` de GitHub 17:46:37Z) · **Medido sobre:**
`origin/main` `eafca9fe154c26d38b05a748ca816ba098943724` · **Encargo:** orquestador del equipo de Luis (29-oct,
17:26Z): «primero MIDE: ¿hay firma y el censo no la encuentra, o no hay firma? Si no hay firma, NO las firmes:
prepara la petición y párate ahí» (regla 39).

**Skill UI:** no cargada · sólo medir; ninguna línea de `public/` cambia en este tramo.

## Veredicto: NO HAY FIRMA. Es deuda real, no un defecto del censo

Los cinco rótulos de `CATEGORY_LABELS` (`public/dashboard/js/expensesView.js:6-9` y `:13`):
«Materiales» · «Desplazamiento» · «Herramientas» · «Subcontrata» · «Otros».

| dónde se buscó la firma | qué hay |
|---|---|
| origen del literal | `73417aff9` (22-may-2026, «feat(5.4): módulo de gastos»), con `git log -S"Subcontrata"`: anterior a la regla 30 |
| `docs/YAQU_MASTER.md` (K1/N5) | 0 apariciones de los cinco como rótulo de gasto |
| `docs/microcopy/` | los literales «Materiales» y «Desplazamiento» SÍ están firmados, pero son **otros rótulos**: los del parte de trabajo (SCRUM-720, SCRUM-703, SCRUM-1491/1492). No son esta hoja |
| `docs/MICROCOPY_APROBADA_SIN_APLICAR.md:698` | «Bloque 2 · Materiales» = Partes por valorar (SCRUM-703), no Gastos |
| **SCRUM-920 c.15992** (la firma de la microcopy de Gastos, 20-sep) | **NO los firma.** Leída entera: firma los textos NUEVOS y enumera cuáles. Los cinco están en `docs/prototipos/SCRUM-920/textos-propuestos.md:132-136`, sección «Lo que se queda EXACTAMENTE como está», que no forma parte de lo firmado |
| `docs/prototipos/SCRUM-920/encargo-construccion-s2.md:52,61,68` | los marca «F = ya existe y **está firmado**» (L4 filtro, L11 píldora), **sin localizador**. Es la familia de SCRUM-1502: una afirmación de firma que no dice dónde consta |

## Por qué el censo no los ve (y por qué no es avería del censo)

El censo de SCRUM-1157 (`scripts/_censo-convenio-microcopy.mjs`) sólo mete en su población un objeto que
**lleva un comentario de convención** (cabecera o interno); lo demás no entra ni se cuenta (`:38-41`). Medido
(`evidencias/SCRUM-1634/salida.txt`, sonda `censo-gastos.mjs`; población 100 ficheros · 52 objetos · 348 hojas,
igual que la CLI):

- **hoy:** de `expensesView.js` entra **una** hoja, `CATEGORY_LABELS.alquiler.label`, **APROBADO**. Entra porque su
  objeto interno lleva `// APROBADO por Javier el 23-oct-2026 (SCRUM-1066 c.20497, opción A)` en la línea del
  `label`. Los cinco no llevan nada → sus objetos no entran → no son ni «firmados» ni «pendientes»: no existen
  para el censo.
- **control positivo, en memoria** (`control-positivo.mjs`, nada escrito en el árbol): con la misma marca de 1588
  en la línea de cada uno, el censo da **6 hojas APROBADO**; con `// [PENDIENTE microcopy oficial]`, **5
  PENDIENTE + «Alquiler de local» APROBADO**. Es decir: el censo SÍ los vería en cuanto el fichero diga algo, y
  la firma que ya hay (1588) **sigue contando como firmada** (aceptación 3 del ticket).

O sea: aquí el censo hace lo que declara. El hueco es que **un objeto sin ningún comentario es invisible**, y eso
es lo que el punto 1 del ticket (medir cuántos rótulos están igual en todo `public/`) tiene que contar. **Ese
recuento de población NO lo he hecho** en este tramo.

## La petición para el fundador (preparada; NO firmo nada)

Mismo patrón que «Alquiler de local» (SCRUM-1066 c.20497 → `// APROBADO por <quién> el <fecha> (SCRUM-N c.NNN)` en
la línea del `label`). Texto propuesto para el comentario en SCRUM-1634, que firma quien firme:

> **Rótulos de las categorías de gasto (los cinco de siempre).** Están en pantalla desde el 22-may-2026 y nadie
> los firmó nunca. No se propone cambiarlos: se pide que consten.
>
> | clave interna (no se ve) | rótulo en pantalla |
> |---|---|
> | `materiales` | **Materiales** |
> | `desplazamiento` | **Desplazamiento** |
> | `herramientas` | **Herramientas** |
> | `subcontrata` | **Subcontrata** |
> | `otros` | **Otros** |
>
> **Dónde los ve el profesional** (todos salen de `CATEGORY_LABELS`, `expensesView.js`): ① el filtro de
> categoría de la lista de Gastos (`:153`) · ② la píldora de cada fila (`:437`) · ③ la píldora de la ficha del
> gasto (`:573`) · ④ el KPI «Mayor categoría» (`:278`) · ⑤ el desplegable «Categoría» del alta y la edición de un
> gasto (`:802`). «Otros» es además el nombre con el que sale cualquier categoría que la pantalla no reconoce
> (`categoriaDe`, `:22-26`). Ningún texto del servidor ni del CSV los pinta (el CSV filtra por la clave).
>
> **A (recomendada):** se ratifican los cinco tal cual.
> **B:** se cambia alguno → decir cuál y con qué literal (y entonces es un cambio de texto, con su ticket).

## Lo que queda, y de quién (no lo hago: me paro aquí por el encargo)

1. **La firma** → el fundador (o quien firmó 1588: c.20497 lo firmó **Javier**; quién firma éste lo decide el
   orquestador).
2. **Escribir la marca en la línea de cada `label`** con el número del comentario de la firma → `expensesView.js`
   es **S2** (`dos-equipos.md:152`, «todo lo demás de `public/`»; el ticket dice `:150`, que es la fila del
   contenedor). Con eso el censo los cuenta como APROBADO (medido arriba) sin tocar el
   censo.
3. **Mientras no haya firma**, si se quiere que el censo los reclame YA, la vía es la marca
   `// [PENDIENTE microcopy oficial]` en su línea + declararlos en «acusadas» de
   `scripts/_censo-convenio-microcopy-declarados.json`. **No medido:** si ese marcador dispara otros guards
   (SCRUM-402 «marcador no se pinta», SCRUM-420 ④ sobre la primera pantalla). Lo decide el orquestador.
4. **Punto 1 del ticket** (cuántos rótulos de `public/` están igual: en un objeto sin ningún comentario de
   convención, invisibles al censo): sin medir.

A9: sin fallo que generalice — sólo medir; ningún código cambiado
