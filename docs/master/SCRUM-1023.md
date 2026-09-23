# SCRUM-1023 · Preguntas para asesores externos, agrupadas por especialista y listas para enviar

**Fecha:** 22-sep-2026 · **Carril:** legal / J4 · **Gate:** sin gate — no se corrige ni se envía nada
**Medido contra:** `origin/main` = `b8e3f81a61344f5cfa94184be9e31c45c1270cdd` · 2026-09-22T08:43:12Z

## Encargo

Javier, literal, 22-sep-2026: *"también quiero listadas todas las preguntas o consultas que hay que
hacer a asesores externos para trabajarlas."* La materia prima es `docs/legal/PREGUNTAS_ASESOR.md`
(835 líneas, 28 preguntas numeradas + 5 sub-preguntas del bloque 21 + P11-P17), que sigue siendo el
expediente técnico (fichero, línea y medición detrás de cada pregunta). Faltaba convertirlo en algo
que se le pueda mandar a un asesor tal cual.

## Entrega

`docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` (nuevo). Reorganiza el expediente en **23
preguntas de envío**, agrupadas por a quién se le preguntan — no por su número original:

- **15 fiscales** (AEAT/IVA/VeriFactu) — F1 es la más urgente de todo el documento (P14 del
  original: ¿"fabrica o comercializa" ya YaQu un sistema de facturación, art. 201 bis LGT?).
- **5 mercantiles/societarias** (contratos, ToS, consumo, presupuesto adicional).
- **3 de protección de datos** (supresión de profesional, supresión de cliente final, revisión de
  privacidad/cookies).

Cada una lleva: el enunciado sin jerga de código ("para el asesor"), qué desbloquea (ticket o pieza
del producto), y qué pasa si no se contesta. Dentro de cada especialista, ordenadas por lo que
desbloquean — no por número.

**Tres se sacan de la lista** porque no necesitan asesor (se dice por qué, en vez de mandarlas
igual): el coste/plazo de la revisión fiscal (es logística de la cita), una pregunta de producto que
depende de otra ya contestada, y la elección de modelo de representación ante la AEAT — que Javier ya
decidió el 16-sep-2026 (colaborador social); lo que falta del asesor es solo confirmar el trámite, no
elegir de nuevo.

**Un hallazgo cruzado con el trabajo de hoy mismo (SCRUM-534h):** la pregunta M3 (revisión del
alcance legal de la oferta Founding) manda a revisar `docs/legal/ALCANCE_BETA.md`, que cita
literalmente "se activa al cerrar la certificación" — la misma frase que el censo de SCRUM-534h de
hoy propone corregir porque no existe una "certificación" de VeriFactu. Se avisa en la propia
pregunta: si se manda al asesor antes de que esa corrección esté firmada, puede estar revisando una
frase que ya sabemos que hay que cambiar.

## SCRUM-143, dicho por Javier hoy — no se ha vuelto a buscar la respuesta de julio

Instrucción literal de Javier: *"no te preocupes, lo vuelvo a preguntar"* sobre si el Convenio 017 de
la AEAT exige sociedad mercantil. Esta sesión NO ha gastado tiempo buscando la respuesta de julio: la
pregunta entra en la lista (F3) como pendiente y se sigue.

## Lo que NO cubre esta entrada

* No contesta ninguna pregunta — ni siquiera las que esta sesión cree saber. El valor del documento
  es ser la lista.
* No envía nada a ningún asesor: eso lo hace un jefe (regla de puesto de J4).
* No aplica la corrección de "certificación" que menciona en el cruce con SCRUM-534h — eso vive en
  esa ficha, propuesto y sin aplicar, a la espera de firma verificable.
* No vuelve a medir el expediente técnico original (`PREGUNTAS_ASESOR.md`): se usa tal como está.

---

# APÉNDICE · 23-sep-2026 · SCRUM-1023 (parte 2) · El mapa: qué bloquea cada una, por gravedad, y cuáles no necesitan asesor

**Medido contra:** `origin/main` = `61bbfa79ddd53a5b1882a47509230e2a6278d6b6` · 2026-09-23T09:06:55Z
**Carril:** J4 · **Gate:** ninguno — censo y clasificación, no contesta ni envía nada.

## PASO 0 — dos premisas del encargo no aguantan la medición

**1. "Ninguna pregunta consta contestada" es falso hoy.** El motivo del ticket cita un grep de J1
(«0 coincidencias de contestad/respondid/RESUELT»). Ese grep no encuentra lo que hay: desde ayer
(commit `2eb8d951`, SCRUM-1079, 2026-09-22T09:07:21Z — **antes** de que se abriera este ticket),
`docs/legal/PREGUNTAS_ASESOR.md` lleva una sección **`## RESPUESTAS · 22-sep-2026`** de ~250 líneas
que contesta, con cita, **A-G, P11-P13, P14, SCRUM-143, P15-P16 y P17** — la búsqueda de J1 no la
encuentra porque «RESPUESTAS» no comparte raíz con «respondid» (responder ≠ respuesta), y «contestad»
sólo aparece dentro de esas mismas respuestas, no como marcador de búsqueda. Verificado con mi propio
grep (`-nio "contestad\|respondid\|resuelt"`): 8 apariciones, todas dentro de ese apéndice o de las
preguntas que lo citan.

⚠️ **Matiz que no se puede callar:** esas respuestas las preparó una sesión de IA consultando la FAQ
de la AEAT y el BOE — **no las revisó un asesor humano**. Javier decidió el 22-sep (SCRUM-1079,
comentario 16403) mantener la cabecera «asesor» así y así. Sus 14 marcas ⚠ de citas sin releer
quedaron **cotejadas y CONFIRMADAS el 23-sep** (SCRUM-1088, mi propia sesión anterior). Por eso, más
abajo, distingo «RESPONDIDA» (con cita verificable, lista para que Javier la dé por buena o la mande
a revisar) de «necesita asesor» (nadie ha podido citarla todavía).

**2. «55 preguntas abiertas» no lo reproduzco con ninguna convención de recuento.** Medido:
- El expediente técnico (`PREGUNTAS_ASESOR.md`) tiene 28 preguntas numeradas (A-G) + 5 sub-preguntas
  del bloque 21 (Libro registro) + P11-P20 (cada una con 2-4 sub-preguntas) + Q-C1…Q-C9 = entre
  ~38 grupos y ~86 preguntas atómicas según el grano que se use — nunca 55.
- Ayer mismo (22-sep, antes de que existieran Q-C/P18/P19/P20 con su forma actual) este mismo carril
  ya hizo esta reorganización una vez: `docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` agrupa **26
  preguntas de envío** (F1-F18 fiscal, M1-M5 mercantil, P1-P3 RGPD), cubriendo ~42 de las numeradas
  originales. **No llegó a incluir Q-C1-Q-C9** (SCRUM-1039 las añadió al expediente técnico ese mismo
  día, pero nunca se propagaron a esta reorganización — confirmado por `git log`, esa reorganización
  sólo la tocaron los commits de creación, P18 y P19+P20).

No adivino de dónde sale 55. Uso como ID canónico la reorganización de ayer (F/M/P), que es la que ya
aprobó este carril, **extendida con Q-C1-Q-C9** (nunca integradas) → **35 grupos**, y clasifico cada
uno por si tiene ya una `RESPUESTA` citable en el apéndice de arriba.

## El mapa

| ID | Tema | Bloquea | Estado | ¿Necesita asesor real? |
|---|---|---|---|---|
| **F1** | P14 — ¿"fabrica/comercializa" ya un SIF? | riesgo legal (201 bis LGT), no un ticket técnico | ✅ RESPONDIDA (RESPUESTAS·P14): "hoy, no", con 3 riesgos señalados | NO — cita AEAT en mano, falta que un humano la firme |
| **F2** | A — modelo de representación AEAT | S1-D | ✅ RESPONDIDA (RESPUESTAS·A): colaborador social viable, Anexo I | NO |
| **F3** | SCRUM-143 — ¿Convenio 017 exige sociedad? | F2, constituir SL | ✅ Contestada desde julio, **pero Javier pidió el 22-sep "volver a preguntar" sin dar la de julio por buena** | Repetirla es decisión de Javier, no falta de fuente |
| **F4** | F — exentas/no sujetas/ISP | SCRUM-212 | ✅ RESPONDIDA (RESPUESTAS·F, tabla, 6 marcas CONFIRMADAS 23-sep) | NO — **duplica QC1 y QC2** |
| **F5** | P13 — recargo de equivalencia | SCRUM-294 | 🟡 PARCIAL — "no se da en servicios" respondido; **el total sellado (punto 2) y el criterio de caja/RECC (punto 4) siguen sin respuesta** | El punto 4, SÍ — **duplica QC4 (parcial) y QC6 (idéntica)** |
| **F6** | P11 — factura sin NIF | SCRUM-292 | ✅ RESPONDIDA (RESPUESTAS·B3, art. 4.2.c ROF, umbral 3.000€) | NO |
| **F7** | P12 — suplidos | SCRUM-293 | ✅ RESPONDIDA (P11-P13 + cotejo 23-sep, art. 78.Tres.3º) | NO — **duplica QC3** |
| **F8** | P15 — formato Libros Registro | SCRUM-325/426 | 🟡 PARCIAL — formato (P15.1) respondido; deducible importe-vs-booleano (P15.2) y contador propio (P15.3) sin respuesta | Puntos 2-3, SÍ |
| **F9** | P16 — tipo de factura declarado | SCRUM-413 (diff ya escrito, esperando GO) | 🔴 ABIERTA — la sección "P15-P16" sólo toca P15, ninguna de las 4 sub de P16 tiene respuesta | SÍ |
| **F10** | B2/C5 — datos del productor | rellenar declaración responsable | ✅ RESPONDIDA (RESPUESTAS·B+C): persona física mientras no haya SL | NO |
| **F11** | B4 — tipo de rectificativa | S1-C | ✅ RESPONDIDA: "Confirmado I. Cerrado." | NO |
| **F12** | C8 — anticipos e IVA | comportamiento fiscal cobros parciales | ✅ RESPONDIDA (remite al expediente P1-P10 aparte, nada lo contradice) | NO |
| **F13** | SCRUM-324 — microcopy "no deduce IVA" | SCRUM-324 (aviso no se pinta hoy) | 🔴 ABIERTA — sin entrada en RESPUESTAS | SÍ |
| **F14** | 21.1-21.5 — avisos de integridad del Libro | 5 ranuras UI (16/21 ya aprobadas) | 🔴 ABIERTA — sin entrada en RESPUESTAS | SÍ |
| **F15** | coste/plazo revisión + alta AEAT | presupuesto S1-F | 🟡 alta AEAT (D12) ✅ RESPONDIDA ("no hay alta previa"); coste (D11) explícitamente **"SIN FUENTE, decisión del fundador"** | El coste NO es legal — es logística/precio |
| **F16** | P18 — emisor en rectificativa | **SCRUM-665** | 🔴 ABIERTA — sin entrada en RESPUESTAS | SÍ |
| **F17** | P19 — productor, ¿dos personas? | rellenar `DECLARACION_RESPONSABLE.md` §1 | 🔴 ABIERTA — Javier fijó la intención de negocio, pero las 4 sub-preguntas legales (comunidad de bienes, responsabilidad del firmante solo, reemisión) siguen sin respuesta | SÍ |
| **F18** | 🔴 P20 — ¿PDF también inmutable? | decisión de diseño, **SCRUM-665** | 🔴 ABIERTA — sin entrada en RESPUESTAS; marcada urgente dos veces ya (yo y el orquestador) | SÍ |
| **M1** | C6 — ToS, reparto de responsabilidad | bundle Y3 | ✅ RESPONDIDA (RESPUESTAS·C6, art. 5.1 ROF/art. 6 RRSIF) | NO |
| **M2** | C7 — condiciones económicas (0,9 %, Stripe Connect) | bundle Y3 | 🔴 ABIERTA — C7 no aparece en la sección "C" de RESPUESTAS (sólo C5/C6/C8/C9) | SÍ |
| **M3** | Revisión de `ALCANCE_BETA.md` (Founding) | cobrar Founding con alcance escrito | 🔴 ABIERTA — no cubierta; **su propio texto cita "se activa al cerrar la certificación", la frase que SCRUM-534 tiene bloqueada hoy (ver Encargo 1)** | SÍ, y **conviene esperar** a que esa corrección esté aplicada antes de mandarla |
| **M4/M5** | G — presupuesto adicional | SCRUM-290 | ✅ RESPONDIDA (ADDENDA·G, normativa Comunidad de Madrid, tabla completa) — **es normativa autonómica**, fuera de Madrid falta cotejar | Para Madrid, NO; para el resto de CCAA, SÍ |
| **P1** | E — baja de un profesional | SCRUM-244 | ✅ RESPONDIDA (RESPUESTAS·E, cotejada 23-sep) | NO |
| **P2** | P17 — cliente final y sus datos congelados | flujo de supresión cliente final | ✅ RESPONDIDA (RESPUESTAS·P17) | NO |
| **P3** | Modelo RGPD/cookies completo | corregir `yaqu.app/privacidad` | 🔴 **ABIERTA — y el hueco ya está PUBLICADO y activo hoy** (no cubre IBAN/NIF/teléfono del profesional, dirección del cliente final ni evidencia de firma); RESPUESTAS sólo la roza de refilón en C9 | SÍ — es la más grave de las abiertas: no bloquea construir algo futuro, exhibe un documento público ya defectuoso |
| **QC1** | Reforma vivienda 10 % | CON-08/09 (no bloqueante, declarado en su propio ticket) | 🟢 Sustancialmente respondida por **F4** (misma cita LIVA 91.Uno.2.10º, ya incluye comunidades de propietarios) | NO nueva — cruzar con F4 |
| **QC2** | ISP en obra/subcontrata | ídem | 🟢 Sustancialmente respondida por **F4** (LIVA 84.f, subcontrata explícita) | NO nueva — cruzar con F4 |
| **QC3** | Suplidos, mandato expreso | ídem | 🟢 Sustancialmente respondida por **F7** (LIVA 78.Tres.3º, "mandato expreso" ya cotejado) | NO nueva — cruzar con F7 |
| **QC4** | Recargo: tipos + a quién aplica | ídem | 🟡 Igual que F5: "no se da en servicios" sí, tipos exactos no | Parcial — **duplica F5** |
| **QC5** | Retención 1 %/2 % (módulos) | ídem | ✅ Autocontestada por cita (RIRPF 95.4-6), pendiente confirmación | NO — es decisión de PRODUCTO (ofrecerlo o no), no legal |
| **QC6** | Criterio de caja / RECC | módulo RECC sin llamadores | 🔴 ABIERTA — **pregunta IDÉNTICA a F5 punto 4**, en otro sitio del expediente, ninguna de las dos contestada | SÍ — **duplicada exacta de F5** |
| **QC7** | Tipos IVA 2/5/7,5 % "raros" | bajo, no declarado bloqueante | 🔴 ABIERTA, no cubierta en ningún sitio | SÍ, o retirar del selector si nadie los usa |
| **QC8** | Plazos 130/131/111/115/347/390 | bajo, no declarado bloqueante | 🟡 PARCIAL — el 303 ya citado; el resto no localizado | NO es de asesor — falta **buscar más**, no juicio legal |
| **QC9** | Exenciones/no-sujeción resto LIVA art. 20 | bajo | ✅ Autocontestada por cita (art. 7 completo + parte de 20.Uno), pendiente confirmación | NO — sólo confirmación |

## Por gravedad (lo que bloquean, no lo interesante) — las que SÍ necesitan asesor hoy

1. **P3** — hueco YA publicado en `yaqu.app/privacidad` (no es un bloqueo futuro: es un documento
   público con un hueco activo hoy mismo).
2. **F18 (P20)** y **F16 (P18)** — bloquean **SCRUM-665**, ambas marcadas urgentes ya.
3. **F9 (P16)** — bloquea **SCRUM-413**, con el diff ya escrito esperando sólo esta respuesta.
4. **F17 (P19)** — bloquea rellenar la declaración responsable, condición previa a SIF-1 8/8.
5. **M2** y **M3** — bloquean poder cobrar (ToS correctos / alcance Founding por escrito). M3 además
   cruza con el bloqueo de hoy de SCRUM-534 (Encargo 1): conviene mandarla después.
6. **F13, F14** — microcopy/UI (5+1 ranuras), menor: no bloquean dinero ni una decisión de diseño.
7. **F5/QC6 (criterio de caja)** y **F8 residual** — bloquean una columna de schema o un módulo que
   hoy "clasifica y avisa, no liquida": sin urgencia mientras `INVOICING_ES_ENABLED` siga OFF.
8. **QC7** — bajo impacto, declarado no bloqueante por su propio ticket de origen.

## Las que NO necesitan asesor nuevo — se pueden cerrar hoy con lo ya citado

**17 respondidas con cita verificable, pendientes sólo de que alguien (Javier) las dé por buenas y se
propaguen a sus tickets bloqueados:** F1, F2, F4, F6, F7, F10, F11, F12, M1, M4/M5 (Madrid), P1, P2,
QC1, QC2, QC3, QC5, QC9. Ninguna de las 17 la contesto yo aquí ni la aplico: cada una ya tiene su cita
en `PREGUNTAS_ASESOR.md` (sección RESPUESTAS) esperando confirmación. **QC8** tampoco necesita asesor,
pero por otra razón — falta buscar más órdenes ministeriales, no un juicio legal.

## Duplicadas por contenido (no por número)

- **QC1 ↔ F4** (vivienda 10 %, misma cita LIVA 91.Uno.2.10º)
- **QC2 ↔ F4** (ISP en obra, misma cita LIVA 84.f)
- **QC3 ↔ F7** (suplidos, misma cita LIVA 78.Tres.3º)
- **QC4 ↔ F5** (recargo de equivalencia, mismo tema y mismo hueco)
- **QC6 ↔ F5 (punto 4)** — la misma pregunta del criterio de caja, palabra por palabra, en dos sitios
  distintos del expediente. Ninguna de las dos copias tiene respuesta.

## Cruce con el Encargo 1 de hoy (SCRUM-534, comentario 16583) — no decido, sólo señalo

Al verificar A17/"la décima" en `DECLARACION_RESPONSABLE.md` (ver mi mensaje de bloqueo de esta misma
tanda) until encontré que esa línea declara la modalidad VERI\*FACTU del sistema entero, y que Javier
mismo la ató a **P14** (= **F1** de este mapa). F1 **ya tiene una respuesta preliminar** (RESPUESTAS·
P14: "hoy, no es productor, mientras el flag siga OFF"). No decido si eso resuelve la décima — sólo
dejo el enlace escrito para quien lo decida.

## Lo que NO cubre esta entrada

* No contesta ninguna pregunta ni aplica ninguna respuesta a `PREGUNTAS_ASESOR_POR_ESPECIALISTA.md`
  ni a los tickets bloqueados — eso es propagar, y lo decide un jefe.
* No repite el detalle de fichero/línea de cada pregunta: ya vive en `PREGUNTAS_ASESOR.md` y en la
  reorganización de ayer; este apéndice sólo cruza y clasifica.
* No resuelve F3 (si hay que volver a preguntar el Convenio 017): es decisión de Javier, no mía.
