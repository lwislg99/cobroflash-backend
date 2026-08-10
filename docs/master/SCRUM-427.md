# SCRUM-427 · G4: la nota del Trabajo se ve donde se trabaja

**Medido contra:** `origin/main` = `74dbd20ab9308ff9cf980a1cdf29bf8d19e3adc6` · 2026-08-10T17:05:51+02:00
**Rama:** `scrum-427-notas-internas`

**10-ago-2026, 17:05 CEST (UTC+0200)** · commit `d3222b98ce10a9971be09da4a8ef9cfb148048a9`

## PASO 0 — y reencuadra el ticket

### (1) Entrada: qué ve hoy el profesional

Abre el detalle del Trabajo y encuentra seis secciones: **Qué falta para cobrar · Datos · Tipo de
trabajo · Albaranes · Gastos de este trabajo · Facturas**. Ninguna es notas. Lo que ve, sobre notas,
es **nada**.

### (2) Mecanismo: había DOS almacenamientos, y no hacía falta ninguno nuevo

| campo | estado medido |
|---|---|
| **`Job.notes`** | **vivo y enchufado de punta a punta MENOS la pantalla** |
| `Quote.internalNotes` | vivo, pero es **otra cosa**: las notas del PRESUPUESTO |

`Job.notes` se persiste, la API lo devuelve (`jobs.routes.ts:250`), se escribe por `PATCH` con tope
de 2.000 caracteres y **gate por CAMPO** (SCRUM-120, que se lo da al operario a propósito), y hasta
**viaja al calendario** dentro del `DESCRIPTION:` del `.ics`.

> **Y ya había un editor: en la LISTA de trabajos** (`jobsView.js`), que guarda al perder el foco.

**Así que el defecto no era «no existen las notas».** Era que **la nota que escribes desde la lista
es invisible desde la pantalla donde trabajas**, y quien abre el detalle no tiene forma de saber que
existe. Medirlo antes evitó construir un segundo sitio donde vivieran las notas del mismo trabajo —
que habría dejado dos verdades y la que vieras dependería de por dónde entraras.

**No se ha creado ningún almacenamiento, ningún campo ni ningún endpoint.**

## Lo que se entrega

Una sección en el detalle que **lee y escribe `Job.notes`** por el camino que ya existía. Guarda al
perder el foco —igual que la lista— y **solo si cambió**: sin esa comparación, abrir el detalle y
cerrarlo mandaría un `PATCH` por visita sobre un campo que otra pantalla también toca.

`SECCIONES_CUERPO` gana `notas` **la última**, y el cambio del contrato es deliberado: las cuatro
primeras son pasos del **ciclo del dinero** (qué falta → entregado → facturado) y ésta **no es un
paso, es contexto**. En medio rompería la lectura del ciclo; fuera de la lista quedaría escondida
del contrato, que es donde se mira qué secciones existen.

## Microcopy — reutilizada, no inventada

La sección de notas **ya existe en Presupuestos**, con su rótulo, su píldora **«Solo tú las ves»** y
su placeholder aprobados. Se reutilizan **literales**, y hay un test que compara las dos pantallas
carácter a carácter — y que también se pone rojo **si la premisa se rompe**, es decir si el texto
desaparece de Presupuestos y este guard pasara a comparar contra algo que se fue.

Si el fundador quiere otras palabras, es una línea; lo que no se ha hecho es inventarlas (regla 30).

## Verificado en rojo — cuatro, por `$?`

| # | inyectado | sale |
|---|---|---|
| 1 | la sección se declara pero **no se pinta** | 🔴 «declararla y no pintarla es peor que no tenerla» |
| 2 | se quita la comparación antes de guardar | 🔴 «cada visita al detalle escribiría en la base» |
| 3 | microcopy divergente del de Presupuestos | 🔴 nombra el texto que difiere |
| 4 | usar `internalNotes` **de verdad** | 🔴 — prueba que el guard caza el uso real, no solo el comentario |

## Dos guards de la casa me cazaron a mí, y los dos tenían razón

- **El mío se cazó a sí mismo.** La sección lleva escrito en su cabecera por qué NO toca
  `internalNotes`, y un guard de texto no distingue la prohibición de su explicación (SCRUM-203).
  **Quinta vez que muerde en este repo.** Arreglado leyendo el código sin comentarios
  (`soloEjecutable`), y el rojo nº 4 existe precisamente para probar que al taparlo no se quedó ciego.
- **SCRUM-237:** mi negación `!/internalNotes/` **no tenía respaldo**. Añadido el hermano positivo
  sobre Presupuestos, que sí lo usa: si el detector no lo encuentra donde está, su silencio sobre el
  detalle no significa nada.

## Lo que NO toca

La **lista** de trabajos (otro carril) · **Presupuestos** y `Quote.internalNotes` (otro carril) ·
`prisma/schema.prisma` · el gate de permisos, que ya daba `notes` al operario.

Ficheros: `public/dashboard/js/jobDetailView.js` · `public/dashboard/js/jobDocsReparto.js` ·
`tests/scrum319-documentos-por-tipo.test.mjs` · `tests/scrum427-notas-internas-detalle.test.mjs` (nuevo).
