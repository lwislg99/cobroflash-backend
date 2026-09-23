# SCRUM-1094 · nº1: `docs/RUNBOOKS.md` R7 retirado y realineado con el máster de hoy

**Fecha:** 23-sep-2026 · **Carril:** legal/ops · **Puesto:** J4
**Medido contra:** `origin/main` = `d8d724e1f3f41d1ce50b785cbfb275b76bd7b729` · 2026-09-23T11:01:57Z

## Encargo

SCRUM-1094 (abierto por el orquestador tras aplicar SCRUM-534n): seis sitios del repo
todavía describen la máquina de estados `VfSubmission`/rechazo de la AEAT que el máster
retiró de la Parte L esta mañana. Esta entrada cubre **solo el nº1**, el más grave: el
runbook R7 de `docs/RUNBOOKS.md`, porque trae un guion literal para decirle al merchant que
"la remisión a la AEAT se reanuda" — una remisión que nunca se ha construido.

Los nº2 y nº3 (dentro de `docs/YAQU_MASTER.md`) no se tocan en esta entrega: el máster lo
aplica un jefe o el orquestador, no una sesión (ver propuesta abajo). El nº4 (`.agents/`) es
de SCRUM-1089/J5. Los nº5 y nº6 no se han medido en esta entrega.

## Qué decía R7 antes de esto (PASO 0 — confirmado que el defecto existe hoy)

`docs/RUNBOOKS.md:73-83` (antes de este PR): título "SIF (AEAT) rechaza registros", síntoma
`VfSubmission` en `rejected`, acción que cita `VfSubmission.lastError` y
`docs/VERIFACTU_EVIDENCIAS.md` (fichero que **no existe** — mismo hallazgo que el "séptimo"
del ticket), y el guion: *"Tus facturas siguen emitiéndose con normalidad; la remisión a la
AEAT se reanuda en cuanto cerremos la incidencia técnica."*

## El texto de referencia (el máster de HOY, no una redacción nueva)

- **Parte L**, `docs/YAQU_MASTER.md:404` (post SCRUM-534n): `Invoice.vfEstado` sólo modela el
  sellado LOCAL (`pendiente_de_sellado → sellado | no_aplica`); "la cola de remisión a la
  AEAT NO está construida — no hay tabla, no hay envío, cero llamadas de red"; fuente
  `src/modules/invoicing/domain/selladoEstado.ts`.
- **Parte O · R7**, `docs/YAQU_MASTER.md:449`: "Falla el sellado local de una factura...
  **[FALTA decidir el mecanismo de reintento — hoy no hay ninguno automático, medido; no se
  propone aquí porque inventarlo es del carril de código, no de este runbook.]** Esto **NO es
  un rechazo de la AEAT**: la remisión telemática no está construida (S1-D)."

## Lo que hice

Reescribí `docs/RUNBOOKS.md` R7 usando sólo lo que dice el máster arriba:

- Título y síntoma alineados con Parte O · R7 del máster (sellado local, no AEAT).
- "Dónde mirar" cita `AuditLog`/`sellado_fallido` y el fichero fuente, ambos ya citados en
  el máster — no añade nada nuevo.
- **"Acción" y "Prevención": declaradas como hueco** (`[FALTA ...]`), igual que el propio
  máster declara el mecanismo de reintento como pendiente. No invento un procedimiento que
  el máster no describe.
- **El guion del merchant se RETIRA**, no se reescribe (mandato explícito del ticket):
  `[FALTA un guion aprobado. No comunicar nada... hasta que un jefe firme un texto (regla
  39)]`. No propongo texto sustituto porque decidir qué se le dice a un cliente en una
  incidencia sin diseñar es exactamente lo que el ticket prohíbe inventar.
- Nota `> CORREGIDO 23-sep-2026` al principio de la sección explicando el porqué, para que
  quien lo lea en el futuro no confunda esto con la redacción original.

## Lo que NO cubre esta entrega

- No toca `docs/YAQU_MASTER.md` (nº2 `:434`* y nº3 `:1028`* del ticket — *ver nota de líneas
  abajo). Los propongo, no los aplico.
- No toca `.agents/skills/yaqu-verifactu-sif/SKILL.md` (nº4): SCRUM-1089, en curso por J5.
- No mide ni toca los nº5 (`docs/legal/SEMAFORO_CALIBRACION.md:196-198`) ni nº6
  (`docs/equipo/puesto-j1.md:15-16`).
- No corrige la cita rota a `docs/VERIFACTU_EVIDENCIAS.md` en ningún otro sitio que no sea
  esta sección de R7 (donde desaparece al retirar el guion completo).

## Nota de líneas (para quien aplique el nº2/nº3)

Los números de línea que da el ticket para `YAQU_MASTER.md` (434 y 1028) no casan con el
`origin/main` de este momento (`434` cae en Parte N5/microcopy de landing; `1028` cae en un
párrafo de SCRUM-80 sobre tests, sin relación). Localicé el contenido real que sí coincide
con la descripción del ticket por texto, no por número:

- **Parte L**, línea **404**: es la entrada de `Invoice.vfEstado` — **ya está corregida**
  hoy (no cita `VfSubmission.lastError` ni "la cola remite al reanudar"; dice literalmente
  que la cola NO está construida). Si el nº2 del ticket apuntaba aquí, **ya no aplica**.
- **S1-G**, línea **1045** (no 1028): `**S1-G · Evidencias:** docs/VERIFACTU_EVIDENCIAS.md
  (capturas, IDs, fechas) + paso a PRODUCCIÓN AEAT con ≥1 factura real remitida y
  aceptada.` — esta sí sigue citando el fichero inexistente `VERIFACTU_EVIDENCIAS.md`, y
  encaja con lo que describe el nº3. Candidato real para el nº3, con la línea corregida.

No decido si esto cierra el nº2 o lo reduce a "ya no aplica" — se lo dejo a quien aplique el
máster, con el número de línea correcto medido hoy en vez del original.

## SCRUM-1094b · Censo de `docs/VERIFACTU_EVIDENCIAS.md` (23-sep-2026, jv-j4)

El orquestador pidió NO decidir a ciegas si es "error de nombre" (sustituir por
`EVIDENCIAS_E2E.md`) o "falta un documento": medir cuántos sitios lo citan hoy y qué esperan
encontrar. Censo por `git grep "VERIFACTU_EVIDENCIAS"` sobre este árbol:

**Vivos y desactualizados (siguen afirmando que el fichero es el sitio correcto):**
- `docs/YAQU_MASTER.md:1045` (S1-G) — nº3 del ticket, máster, lo aplica el orquestador.
- `.agents/skills/yaqu-verifactu-sif/SKILL.md:49` — nº4 del ticket, va por SCRUM-1089/J5.
- `.agents/skills/yaqu-release-check/SKILL.md:24` — **NO es uno de los seis del censo del
  19-ago**, y el suelo del ticket dice "si aparece un séptimo, se añade, no se ajusta al
  número": lo añado aquí. Cita `EVIDENCIAS_E2E.md` y `VERIFACTU_EVIDENCIAS.md` juntos como
  ejemplos de "docs de evidencia que pida la tarea". Es la misma familia que el nº4 (mirror
  `.agents/` sin sincronizar) — no lo toco, es SCRUM-1089/J5.

**Ya corregidos (confirman que NO existe y remiten a `EVIDENCIAS_E2E.md`):**
- `.claude/skills/yaqu-verifactu-sif/SKILL.md:87-90` — ya dice "no existe (comprobado el
  20-ago-2026). Cítese `docs/EVIDENCIAS_E2E.md`... cuando lo que se quiera adjuntar sean
  evidencias E2E."
- `.claude/skills/yaqu-release-check/SKILL.md` — ya NO contiene la cadena (0 ocurrencias hoy);
  `docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md:199-208` describe una versión vieja de este
  fichero (su hallazgo A7) que ya no está — el propio inventario quedó desactualizado por el
  mismo mecanismo que este ticket entero corrige (una copia se arregla, la otra no se entera).

**Históricos, no se tocan** (expedientes/snapshots, no specs vivas):
`docs/historico/YAQU_MASTER_v5.3_pre-14jun_con-progreso.md`,
`docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md` (es el propio informe de hallazgo, con fecha),
y `docs/master/SCRUM-{534,538,804,939,955,1089}.md` (expedientes de ticket: registran lo que
se encontró ENTONCES, no se reescriben).

### Lo que esperan encontrar — y por qué NO es (solo) un error de nombre

Las dos citas vivas (S1-G y la skill de VeriFactu) esperan lo mismo entre sí: **evidencia de
un envío real a producción de la AEAT** ("capturas, IDs, fechas" + "≥1 factura real remitida
y aceptada"). Eso es DISTINTO de lo que contiene `EVIDENCIAS_E2E.md` (evidencia de un flujo
E2E de producto en móvil, confirmado por el fundador — nada de AEAT). **No son el mismo
documento con dos nombres: son dos evidencias de dos cosas distintas**, y la de la AEAT no
existe todavía por la misma razón que S1-G sigue ⏳ en el máster: **el envío real a
producción de la AEAT no ha ocurrido** (S1-D es sólo pruebas, no producción). Sustituir la
cita por `EVIDENCIAS_E2E.md` sería incorrecto — mezclaría dos evidencias distintas.

**Corrección a mi propia propuesta de la sección anterior** (creada antes de este censo): dije
que la solución podía ser "sustituir por `EVIDENCIAS_E2E.md` o crear el documento". Medido
ahora: **no es una sustitución** — es un documento futuro y legítimo que se crea cuando S1-G
se complete, no antes. Lo único que hay que corregir HOY en los sitios que lo citan es el
TIEMPO VERBAL: no "está aquí" sino "se creará aquí cuando exista un envío real". No decido si
el nombre final debe ser `VERIFACTU_EVIDENCIAS.md`: eso lo fija quien complete S1-G.

## nº5 y nº6 (23-sep-2026, jv-j4 — asignados por el orquestador tras el nº1)

Localizados por TEXTO, no por el número de línea del ticket (el propio orquestador confirmó
que los seis números del censo del 19-ago pueden estar corridos, igual que el nº2/nº3).

- **nº5 · `docs/legal/SEMAFORO_CALIBRACION.md`** — el bloque real está en las líneas 196-200
  (el ticket decía 196-198; coincide aproximadamente). Afirmaba: *"La cola `VfSubmission`
  (máster, Parte L) es el sitio donde se gestionan"* los códigos 3000-3004. Corregido:
  declara que hoy no hay ningún sitio donde se gestionen (máster, Parte L; S1-D), y conserva
  sin tocar la parte que SÍ es spec pura de la AEAT (las banderas `Subsanacion` /
  `RechazoPrevio` / `SinRegistroPrevio`, que vienen del anexo del PDF y no dependen de si
  YaQu ya las implementa).
- **nº6 · `docs/equipo/puesto-j1.md`** — el bloque real está en las líneas 15-17 (el ticket
  decía 15-16; el texto cruza a la 17). Listaba "la cola `VfSubmission`, el envío a la AEAT"
  como si ya existiera, dentro del área de J1. **Esta ficha la lee J1 al arrancar cada
  tanda** (nota del orquestador) — corregido para decir que la remisión es **S1-D, aún sin
  construir** (máster, Parte L), sin quitarla del área de J1: seguirá siendo su trabajo
  cuando se construya, sólo que hoy no existe.

## Verificación

Cambian `docs/RUNBOOKS.md`, `docs/legal/SEMAFORO_CALIBRACION.md`, `docs/equipo/puesto-j1.md`
y este expediente (ver diff). No toca `src/`, `public/`, `prisma/schema.prisma` ni ningún
camino de emisión — no aplica `npm test`. Verificación = lectura del diff contra el texto del
máster citado arriba.
