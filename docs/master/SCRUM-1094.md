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

## Propuesta para el nº3 (S1-G, línea 1045) — NO aplicada aquí

Sustituir la cita de `docs/VERIFACTU_EVIDENCIAS.md` por `docs/EVIDENCIAS_E2E.md` (el fichero
que sí existe, y que el propio ticket señala como el nombre correcto propagado con error) —
o, si `VERIFACTU_EVIDENCIAS.md` debe existir como documento propio distinto de
`EVIDENCIAS_E2E.md`, crearlo. No decido cuál de las dos: lo firma quien aplique el máster.

## Verificación

Sólo `docs/RUNBOOKS.md` y este expediente cambian en esta rama (ver diff). No toca
`src/`, `public/`, `prisma/schema.prisma` ni ningún camino de emisión — no aplica `npm test`.
Verificación = lectura del diff contra el texto del máster citado arriba.
