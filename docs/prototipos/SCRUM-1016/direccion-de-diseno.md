# Prototipo: 3 ejes de venta posibles para la landing, sin decidir ninguno

**Medido contra:** `origin/main` = `beef7b362ed44a7bb431ab4f145879f11abd0c24` · 21-sep-2026 16:48:57Z
(hora de GitHub) · J5 · **no toca `public/index.html` ni `public/precios.html`, no escribe titular,
héroe ni respuesta al Kit Digital.** Ticket: SCRUM-1016 (comentario). Encargo: orquestador
(`cobroflash-backend-50`), tras mi entrega de SCRUM-1030.

## Qué es esto, y qué NO es

`docs/prototipos/SCRUM-1016/angulo-de-venta.html` es un **prototipo de comparación**: enseña cómo se
vería la estructura de la landing bajo tres ejes de venta distintos, cada uno respaldado por
competidores reales que YA lo usan. **No es un rediseño, no se despliega, no sustituye nada.**

**No decide el titular de YaQu.** Donde haría falta la frase real (H7/AB5, la promesa central que J4
dejó explícitamente sin proponer en SCRUM-1016), el prototipo deja un hueco marcado
`[PROMESA PRINCIPAL — pendiente de decisión]`. Las únicas frases completas que aparecen citadas son
de **competidores reales**, con su nombre al lado — eso está permitido y es precisamente lo que pide
el encargo ("cómo lo abre un competidor real, con su literal y quién es").

## Los tres ejes, con su respaldo medido

Fuente: `docs/competencia/con-que-venden-sin-cobro-21sep-j5.md` (mi propia entrega de la sesión
anterior, 21-sep, PR #1601) y `docs/competencia/matriz.md` §7.5 (N1: "no copiar su pantalla, la
nuestra es un mensaje"). No invento ejes nuevos: son los que de verdad usa el mercado, agrupados como
ya los agrupó esa entrega.

### Eje A — Cumplir con Hacienda, rápido y sin pensar

**Quién lo usa (7/7 del bloque español abren así; 4/7 añaden VeriFactu en el H1 o el subtítulo
inmediato):** Verifacturamos (*"Crea facturas conformes con Hacienda y Verifactu en 2 min"*), Quipu
(*"Tu facturación lista para Verifactu. Sin complicaciones"*), Anfix, Billin, Holded (parcial).

### Eje B — Categoría + profesionalizar el oficio (organización y control del negocio)

**Quién lo usa (el grupo que hace LO MISMO que YaQu — presupuesto → trabajo → factura en campo):**
Jobber (*"Run a stronger service business"*), ServiceM8 (*"Smart software for contractors &
services"*), Housecall Pro (*"Everything to run and grow your business"*), Tradify, Fergus. Ninguno
de los cinco abre con "cobra" o "get paid" — ni con "cumple con Hacienda". Abren con la categoría y la
promesa de profesionalizar/crecer.

### Eje C — Gestión integral, todo en un solo sitio

**Quién lo usa:** Anfix (*"Simplifica la gestión de tu negocio"*), Contasimple, Sage, Holded (parcial,
*"Factura, cobra y cierra el mes"* — el único de los 13 que menciona cobro DENTRO del H1, como un
verbo de tres, no como gancho aislado).

## Por eje: estructura, coste, y si es verdad hoy en España

| | **Eje A · Hacienda** | **Eje B · Categoría/oficio** | **Eje C · Todo-en-uno** |
|---|---|---|---|
| **Qué sube en la página** | Un bloque "cumple con VeriFactu" cerca del héroe | Los 3 pasos (presupuesto→firma→organización) y prueba social de control del negocio | Un grid de "todo lo que incluye" (facturas, clientes, gastos, trabajos…) |
| **Qué se cae** | El vídeo de cobro, el FAQ de morosidad | El precio como primer argumento | La promesa de "en 30 segundos" (un ERP no se abre con velocidad) |
| **¿Es verdad HOY en España?** | 🔴 **NO.** `SIF_ENABLED: false`, cero remisión a la AEAT (`matriz.md` §2, fila 8). Afirmar "cumple con Hacienda" sin SIF-1 es exactamente lo que la regla 17 prohíbe — es el mismo problema que tiene el héroe actual, con "factura" en vez de "cobro" | 🟢 **Sí, entera.** Presupuesto en 30s, firma desde el móvil y organización de clientes/gastos/trabajos existen HOY, sin depender de ningún flag (`INVOICING_ES_ENABLED` no le afecta) | 🟡 **Parcial.** YaQu no es un ERP: no hay contabilidad, nóminas ni los 23 tipos de factura de Verifacturamos. Prometer "todo" sería inflar lo que hay |
| **Qué le falta a YaQu para usarlo con garantías** | SIF-1 completo (prioridad absoluta del máster) | Nada nuevo — es lo que ya construimos | Construir o adquirir todo lo que falta para parecer un ERP, que no es la dirección del producto (matriz.md N6: "contabilidad completa… son de otro cliente") |
| **Riesgo si se usa hoy tal cual** | Alto: repite el error legal que motivó este ticket, solo que con la palabra "factura". Y no partiría de cero: el **guion H2** —la única respuesta autorizada sobre VeriFactu (regla 26)— **ya dice dos cosas falsas hoy** y está parado en **SCRUM-534** (creado 19-ago-2026, "Acción del fundador", la prioridad más alta de esa lista, sin decidir desde entonces). Quien construya el Eje A construiría encima de un texto que ya sabemos que miente | Ninguno legal; el único coste es renunciar al gancho de morosidad que regla 26b llama "nº1" | Choca con la propia doctrina de diferenciación de YaQu (`matriz.md` N1: "su presupuesto es una hoja de contabilidad; el nuestro es un mensaje") |

## El coste de no decidir (hechos verificados, no una estimación)

- La enmienda de la regla 24 (SCRUM-612c) se mergeó a `origin/main` **hoy a las 14:55:34Z** (PR #1593,
  verificado con `gh pr view 1593`).
- El último commit que tocó `public/index.html` es del **20-ago-2026** — un mes antes. `precios.html`
  no se toca en este PR tampoco.
- 🔴 **Corrección propia, tras el aviso del orquestador: no es un subtítulo. Es pervasivo, y lo medí
  yo misma con `grep` antes de escribirlo, no de oídas.** En `public/index.html`, la promesa de cobro
  vive en al menos **once sitios**: `<title>`, `og:title`, `og:description`, `twitter:title`,
  `twitter:description`, la descripción JSON-LD, el **`<h1>` vivo** (línea 427: *"Del presupuesto al
  cobro, sin salir de WhatsApp"*), el subtítulo (línea 428: *"...te paga — con tarjeta, Bizum o
  transferencia"*), la animación de demo (*"Cobrado, sin perseguir a nadie"*, línea 434), el paso
  **"3 · Cobra"** (línea 609) y el FAQ (dos respuestas, líneas 759 y 761) y el CTA final (*"...cobran
  sin perseguir pagos"*, línea 767). En `public/precios.html`, **cuatro**: la meta description, el
  subtítulo (*"...cobra antes de empezar"*, línea 62), la nota de tarifa (*"...cuando cobras con
  tarjeta"*, línea 79) y, **el más grave de todos**: una línea de la tarjeta de precio, dentro de lo
  que el plan **incluye** — *"Cobro integrado: el cliente paga desde el móvil"* (línea 83). Eso no es
  un titular llamativo: es **una función enumerada en lo que alguien está a punto de pagar**.
  (Hay una segunda copia del héroe en `index.html`, `id="heroe-f4"`, con `hidden` y
  `data-microcopy="PENDIENTE_FUNDADOR"` — **no la cuento**: no la ve ningún visitante hoy.)
- **Esas líneas son falsas para cualquier profesional español desde las 14:55:34Z de hoy**:
  `INVOICING_ES_ENABLED` está en OFF y la regla 24 dice, literal, que con el interruptor en OFF **no
  se cobra por YaQu, de ningún tipo**.
- **No mido cuántas personas lo leen** (no tengo datos de tráfico de yaqu.app desde este puesto — SUELO
  declarado), pero el hecho de que el error exista no depende de cuánta gente lo vea: cada visita real
  desde las 14:55:34Z de hoy ha leído una promesa que el propio máster, mergeado esa misma tarde,
  dice que es falsa — y en `precios.html`, la ha leído como algo que está comprando.

## Mi recomendación (es mía, con su motivo — no es la decisión)

**Eje B.** No porque lo use la mayoría (de hecho el bloque español, que es mayoría de los 13, usa el
Eje A) — al contrario: el Eje A es mayoritario y es el que **no se puede usar hoy** sin repetir el
mismo error legal que originó este ticket. Mi motivo:

1. Es el único de los tres que es **enteramente cierto hoy**, sin esperar a SIF-1 ni a ningún flag.
2. Es el literal de mínimos que **J4 ya propuso** para el ítem #1 en SCRUM-1016 (*"Presupuesta en 30
   segundos, que tu cliente firme desde el móvil, y lleva clientes, gastos y trabajos en un solo
   sitio"*) — este prototipo no inventa una cuarta vía, respalda con estructura y competidores la que
   ya estaba sobre la mesa.
3. Los cinco competidores del Eje B son, de los 13 medidos, **los que hacen lo mismo que YaQu**
   (presupuesto → trabajo → factura en campo), no facturadores puros. Es la comparación más honesta.

El Eje A queda mejor **para la Etapa 2, post-SIF-1** (así lo prevé ya `regla 26b` en el máster, que J4
propuso matizar en el mismo sentido). No lo descarto: digo que hoy no se puede pagar su promesa.

## Lo que NO medí (declarado)

- **Sin capturas de pantalla ni matriz Android/iPhone/tablet (AB6).** Playwright no está instalado en
  este worktree (`node -e "require.resolve('playwright')"` falla) y este prototipo no es un cambio de
  producción — es material de decisión. Javier puede abrir `angulo-de-venta.html` directamente en
  cualquier navegador; es un único fichero HTML sin dependencias.
- **No mide conversión ni tráfico real.** Ningún eje se valida aquí con datos de comportamiento de
  usuarios — la matriz ya declaraba esto mismo límite en `con-que-venden-sin-cobro-21sep-j5.md` §4.
- **No encuesta a clientes reales de YaQu** (electricistas/fontaneros españoles) sobre cuál eje les
  convence más.
- **Billin/TS Facturas y Sage** no se verificaron con el mismo detalle que el resto en la entrega
  original (declarado allí, se hereda aquí sin repetir la medición).
