# SCRUM-1089 · La skill de VeriFactu existe duplicada, y las dos copias difieren

**Fecha:** 23-sep-2026 · **Carril:** facturación (excepción del día: J5 en carril fiscal, ver
`docs/equipo/orquestador.md` §11bis — el área normal de J5 sigue siendo Competencia y producto)
**Gate:** sin gate; es medición, no toca código del camino de emisión
**Medido contra:** `origin/main` = `d739ffdc5fe4a8bb13a7f1e520071b76e7a02cbf` · 2026-09-23T08:47:04Z

## Qué es, y qué NO es

Este ticket **mide**; no arregla. El encargo (SCRUM-1089) pide, en orden, (1) cuál copia carga de
verdad una sesión, (2) qué dice cada una que la otra no, (3) desde cuándo divergen y por qué, (4) si
hay más skills en la misma situación — y prohíbe explícitamente borrar cualquiera de las dos copias
o fusionar el contenido a ojo. Este documento es esa medición, completa, y una propuesta sin
ejecutar.

## 1. Cuál carga de verdad (ejercitada, no leída)

Invoqué la skill `yaqu-verifactu-sif` con la herramienta `Skill` de esta misma sesión de Claude
Code. La respuesta declaró expresamente su origen:

```
Base directory for this skill: C:\Users\Javier Pereira\cobroflash-backend\.claude\skills\yaqu-verifactu-sif
```

Carga **`.claude/skills/`**, no `.agents/skills/`. Dos confirmaciones independientes, no leídas de
un documento:

- `scripts/censo-afirmaciones-de-skills.mjs` (el censo de afirmaciones falsas en skills, SCRUM-939,
  que SÍ se ejecuta en cada tanda vía `tests/scrum939b-trinquete-de-las-skills.test.mjs`) lee de
  `DIR = path.join(RAIZ, '.claude', 'skills')` — la propia tooling del repo ya trata
  `.claude/skills/` como el árbol operativo.
- `AGENTS.md` (§"Lo único específico de Codex") lo declara por escrito: `.agents/skills/` es el
  **"espejo de skills para Codex"** — un espejo, no una segunda fuente. El dueño es
  `.claude/skills/`.

## 2. Qué dice cada una que la otra no

`.agents/skills/yaqu-verifactu-sif/SKILL.md` (2.899 B) es una foto de `.claude/`'s tal y como
estaba el 29-jun-2026. **No afirma nada sobre VeriFactu que `.claude/` no cubra ya** (corregido o
igual): es un subconjunto anterior, no una fuente independiente con criterio propio. Lo que
`.agents/` sigue afirmando, sin marcar, y que `.claude/` ya corrigió en SCRUM-538
(20-ago-2026, decidido por el fundador):

| en `.agents/` (obsoleto, sin marcar) | en `.claude/` (corregido) |
| --- | --- |
| «Flujo de control AEAT: respetar `TiempoEsperaEnvio`… sin respuesta → reenviar» | 🔴 NO CONSTRUIDO — no hay envío ni respuesta que esperar (auditoría, eslabones 8 y 9) |
| «FSM `VfSubmission`: `pending → sent → accepted`… `manual_review`» | 🔴 NO CONSTRUIDO — la entidad no existe en `prisma/schema.prisma` |
| «`SIF_ENABLED` off = seguro: la cola pausa…» | 🔴 NO CONSTRUIDO — no hay cola que pausar |
| QA: «Rechazo forzado → retry con backoff → `manual_review` al 5º intento» | 🔴 NO CONSTRUIDO — no es casilla que falte marcar, es una que nadie puede marcar |
| QA: «Evidencias de pruebas AEAT → `docs/VERIFACTU_EVIDENCIAS.md`» | ese fichero no existe; cítese `docs/EVIDENCIAS_E2E.md` |
| (sin el aviso) | caja del árbitro: «EL ÁRBITRO ES EL CÓDIGO» (SCRUM-538 punto 2) |

Ninguna línea de `.agents/` afirma algo sobre VeriFactu que `.claude/` no cubra ya. No hay una
fusión que decidir: es aplicar a la copia un parche que el fundador ya firmó y que nunca llegó al
espejo.

## 3. Desde cuándo divergen, y por qué (`git log --follow` de cada ruta)

- Nacieron IDÉNTICAS el 12-jun-2026 (`a40fcf45`).
- El espejo se creó el 29-jun-2026 (`4964d26d`, «añadir skills yaqu… config Codex… AGENTS.md») —
  copia manual, de una sola vez.
- `.claude/skills/yaqu-verifactu-sif/SKILL.md` recibió 3 commits más, los tres de SCRUM-538
  (20-ago-2026: `aa37bfe0`, `d12118e3`, `b75a608d`).
- `.agents/skills/yaqu-verifactu-sif/SKILL.md` no se ha vuelto a tocar desde el 29-jun-2026.

**Mecanismo:** el espejo se copió una vez a mano y nunca se volvió a sincronizar. No hay proceso
(script, hook, CI) que lo mantenga al día — a diferencia de `impeccable`, que SÍ está gobernado por
hash en `skills-lock.json`.

## 4. Censo completo de las dos carpetas (`este defecto rara vez viene solo`)

`.claude/skills/` (9): `cerebro-yaqu`, `impeccable`, `verifactu`, `yaqu-fase-b`, `yaqu-premium-ui`,
`yaqu-release-check`, `yaqu-sprint`, `yaqu-verifactu-sif`, `yaqu-wa-templates`.
`.agents/skills/` (5): `impeccable`, `yaqu-premium-ui`, `yaqu-release-check`, `yaqu-sprint`,
`yaqu-verifactu-sif`.

De las 5 que existen en ambos lados (bytes exactos contra `origin/main`):

| skill | `.agents/` | `.claude/` | ¿igual? |
| --- | --- | --- | --- |
| `impeccable` | 22.275 B | 22.275 B | igual (gobernada por hash, `skills-lock.json`) |
| `yaqu-premium-ui` | 2.500 B | 2.500 B | igual |
| `yaqu-sprint` | 2.257 B | 2.257 B | igual |
| `yaqu-release-check` | 2.114 B | 3.379 B | **DIFIERE** |
| `yaqu-verifactu-sif` | 2.899 B | 6.213 B | **DIFIERE** — este ticket |

**`yaqu-release-check` tiene el MISMO defecto, con el MISMO mecanismo:** nació igual el 11-jun-2026
(`b028bad6`), se copió al espejo el mismo 29-jun-2026 (`4964d26d`), y `.claude/` recibió 3
correcciones más que el espejo no vio — una de ellas, otra vez, `aa37bfe0` (SCRUM-538, la misma
corrección de «dejar de describir un envío a la AEAT que no existe»).

Las 4 skills de `.claude/skills/` sin espejo (`cerebro-yaqu`, `verifactu`, `yaqu-fase-b`,
`yaqu-wa-templates`) no están duplicadas-y-divergentes: nunca se copiaron. Es un hueco distinto
(Codex no las tiene, en vez de tenerlas mal) — anotado, no investigado más en este ticket.

## Propuesta (sin ejecutar — pide DECISIÓN de un jefe)

No se ha tocado ningún fichero de skill ni de configuración. Propuesta para un ticket de arreglo:

1. **Sincronizar el espejo con la fuente** en los dos pares que divergen (`yaqu-verifactu-sif`,
   `yaqu-release-check`): sustituir `.agents/skills/<x>/SKILL.md` por el contenido de
   `.claude/skills/<x>/SKILL.md`, byte a byte. No es fusión — `.claude/` ya es superconjunto
   corregido de `.agents/` (punto 2), y la corrección la firmó el fundador en SCRUM-538 — pero
   toca contenido fiscal y el propio ticket pide sign-off explícito antes de escribirlo.
2. **Guard nuevo, solo lectura** (no toca el camino de emisión → no es STOP, regla 38): comparar
   por hash `.claude/skills/<x>/SKILL.md` contra `.agents/skills/<x>/SKILL.md` para toda skill
   `yaqu-*` presente en ambos lados (excluyendo `impeccable`, ya gobernada por hash propio en
   `skills-lock.json`), y caer si divergen — para que este defecto no vuelva a congelarse 86 días
   sin que nadie lo note.

## Suelo

Ninguno: los cuatro puntos del encargo se midieron por completo — ejercitando la skill (no leyendo
sobre ella), diffando el contenido íntegro de las dos copias, leyendo `git log --follow` de las dos
rutas, y censando las dos carpetas enteras. Nada queda en «probablemente».
