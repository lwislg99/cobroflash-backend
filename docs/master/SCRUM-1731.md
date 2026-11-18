# SCRUM-1731 · La línea «Mutaciones:» entra en la A3, y el guard de la A9 la comprueba

**Medido contra:** `origin/main` = `6881a0d27e8b4e337bd55175c3068791c8304c69` · 2026-11-18T07:43:02Z
**Sesión:** S0 (consultoría, dueña de las normas comunes), worktree `s0-18nov`, rama `scrum-1731-norma-mutaciones-a3`.

**Autoridad.** Redacción de S0 en c.21965 (versión ACOTADA de la propuesta del equipo J), firmada por el
equipo de Luis por la delegación general (SCRUM-1656 c.21978) en c.21980, y **acuse del jefe J en c.21999**
(18-nov, ~06:00 Madrid): acepta la versión acotada literal, incluido el cambio de su punto (c).

**Qué entra.**
- `docs/equipo/00-normas-comunes.md`, A3: la viñeta firmada, LITERAL, con la nota de firma, acuse y corte.
- `tests/scrum1294-a9-leccion-en-a10.test.mjs`: el guard de la A9 valida la línea cuando EXISTE, en los
  tramos con ancla desde el 2026-11-18. `catálogo → <test>`: el test existe y declara al menos una mutación
  completa en `MUTACIONES_QUE_ME_TUMBAN`, leída por AST con `mutacionesDeclaradas` del meta-guard (no por
  texto). `una vez → <guion>`: el guion está en `git ls-files` (si git no contesta, el guard sale CIEGO y
  rojo, no verde). Ruta con o sin comillas invertidas, porque la norma firmada la escribe `→ <test>`. Una
  línea `Mutaciones:` sin una de las dos claves no es «la línea»: no la ve el guard; la ve quien cierra.

**Premisa medida antes de escribir la norma.** La redacción firmada dice «lo comprueba el guard de la A9
cuando la línea existe». En `origin/main` 6881a0d2, el guard de la A9 NO miraba ninguna línea
`Mutaciones:` (grep de `Mutaciones:` y `MUTACIONES_QUE_ME_TUMBAN` en él: 0). Escribir la norma sin ampliar el
guard la hacía falsa el día de su entrada; por eso van en el mismo PR. El guard es de S0 (SCRUM-1294).

**Barrido (A23 ①).** `docs/master/` tenía ~20 líneas que empiezan por «Mutaciones:», todas en prosa libre
(«6 de 6 caen…»), ninguna con la clave: ninguna cae. La de `docs/master/SCRUM-1743.md` (equipo J, de hoy, cuyo
encargo exige la línea) tampoco lleva la clave: no rompe nada, pero **no cuenta como evidencia al cerrar**.
Se avisa al orquestador para el canal con el equipo J; no es de este carril corregirla.

**Población (salida del guard):** 1312 registros · 2591 anclas · 1207 desde 2026-09-30 · Mutaciones desde
2026-11-18: 0 catálogo, 0 una vez antes de este registro (hacia adelante: arranca en cero, y lo que lo prueba
es el control positivo y el rojo real de abajo).

Mutaciones: catálogo → `tests/scrum1294-a9-leccion-en-a10.test.mjs`
(corregida en el tramo «Rojo del PR #3210», abajo: decía `una vez → docs/master/evidencias/SCRUM-1731/mutar.mjs`,
y ese guion se retiró porque un banco con lista propia queda fuera del catálogo y lo tumba SCRUM-1387.)

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

## Rojo real (A23 ⑧ y ⑨)

Sobre el commit `a2dd50f1fc8b028643addf5ddb2ed2517ef40bb2` (árbol entero commiteado antes de inyectar), con
`mutar.mjs`: **BASE rc=0 · pass 4 · fail 0**; luego, cada línea al final de este registro:

| línea inyectada | espera | sale | el rojo dice |
|---|---|---|---|
| `catálogo → \`tests/no-existe-1731.test.mjs\`` | rojo | rojo | «no existe en el repo» |
| `catálogo → \`tests/scrum1294-…\`` (existe, no declara) | rojo | rojo | «no declara ninguna mutación» |
| `- **Mutaciones:** una vez → \`…/no-esta.mjs\`` | rojo | rojo | «no está en git» |
| `catálogo → tests/no-existe-1731.test.mjs` (sin comillas) | rojo | rojo | «no existe en el repo» |
| `catálogo → \`tests/scrum1387d-…\`` (control: declara 4) | verde | verde | — |

**MAL 0 de 5**, restaurado por bytes: sí; `git status --porcelain` después, sin cambios míos. Con este registro
dentro, el guard cuenta `Mutaciones (desde 2026-11-18): 0 catálogo, 1 una vez` (la de arriba, que se valida sola).

**Tests corridos** (TAP fuera del árbol, código de salida en comando aparte): los 84 ficheros de `tests/` que
nombran `00-normas-comunes`, `scrum1294-a9` o `meta-guard-mutaciones`: 471 tests · 384 pass · 83 fail · 4 skip.
**Los 22 ficheros rojos importan `dist/`, y este worktree nuevo no tiene `dist/`** (comprobado: los 22 lo
nombran; 103 `ERR_MODULE_NOT_FOUND`). No hice `npm run build`: el cliente de Prisma de este árbol no casa con
`schema.prisma` (`_prisma-client-guard`: faltan `InvoicePayment` y `FiscalPlazoEstado`) y no regenero (A1).
Los de normas —scrum1294, scrum996/996d/996f, scrum1484c— en verde. La suite completa la corre el CI.

## Rojo del PR #3210 (obligatorio «build + tests»)

**Medido contra:** `origin/main` = `d69ccd51362c2861389ebc632a843e971330b406` · 2026-11-18T08:23:01Z

**Qué cayó** (run 44261510118, job 134655710442; solo los «✖ failing tests»): dos, con UNA causa.
`tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs` («ningún banco de mutación nuevo queda fuera del
catálogo»): `docs/master/evidencias/SCRUM-1731/mutar.mjs` traía su lista propia, entró después del corte del
guard y no nombra el catálogo. Y `tests/scrum976-guards-entrada-con-techo.test.mjs` ④, porque `guards:entrada`
corre ese mismo guard. La sospecha inicial (que la ampliación del guard de la A9 cazara líneas `Mutaciones:`
existentes) era FALSA: medido, la A9 no aparece en el rojo.

**Arreglo** (el guard no se toca, regla 41): las mutaciones pasan al catálogo. `tests/scrum1294-a9-leccion-en-a10.test.mjs`
exporta `MUTACIONES_QUE_ME_TUMBAN` (6, sobre su propio código, debajo de lo que mutan: el ancla de verdad es la
primera ocurrencia y empieza línea), todas con `cae` = su control positivo. Se retira `mutar.mjs` y la línea
`Mutaciones:` de arriba pasa de `una vez` a `catálogo`. La tabla «Rojo real» queda como medida HISTÓRICA de
aquel guion (inyectaba líneas en este registro); lo que se repite desde hoy es el catálogo.

**Rojo real de las 6** (aplicadas como el meta-guard, `texto.replace(de, a)`; base limpia primero; guion de
comprobación FUERA del árbol, en el tmp del trabajo): BASE rc=0 · 4 ok · 0 not ok; las 6 caen en el control
positivo, `ambiguedadDelAncla` = null en las 6; restaurado por bytes: sí. **MAL 0 de 6.**

Mutaciones: catálogo → `tests/scrum1294-a9-leccion-en-a10.test.mjs` (6 de 6 caen)

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`
