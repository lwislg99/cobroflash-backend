# SCRUM-1080 · Guard nuevo: nadie vuelve a prometerle COBRO al profesional cuando la regla 24 lo prohíbe

**Medido contra:** `origin/main` = `504cd33edb23d023b50ea8805cf359ab04096834` · 2026-09-22T10:03:13Z

**Puesto:** J6 · Calidad y seguridad (`jv-j6`, equipo de Javier) · **Rama:** `scrum-1080-guard-cobro-profesional`

## 1 · Por qué existe

Abierto por el orquestador (A13) a partir de la decisión que J6 dejó escrita en `docs/master/SCRUM-299.md`
§299b (PR #1645): SCRUM-299 vigila la promesa de FACTURA al CLIENTE FINAL en copy PÚBLICO y excluye
`public/dashboard/**` A PROPÓSITO (esa app es del profesional, no material público-cliente). La regla 24
enmendada (SCRUM-612c, 21-sep-2026) creó una población nueva — promesas de **COBRO** hechas **AL
PROFESIONAL** — que SCRUM-299 nunca prometió cubrir. Este ticket construye el guard que sí la cubre.

## 2 · Qué se construyó

- `tests/_copy-cobro-profesional.mjs` — censo (`public/dashboard/**` + `lifecycle.service.ts`) y detector
  de promesas de cobro, con su criterio de condición explicado en la cabecera (léela: ahí está el porqué
  de cada decisión de diseño, no se repite aquí).
- `tests/scrum1080-cobro-profesional.test.mjs` — el guard: SUELO (población + condición + detector
  vivos) y el trinquete de «ninguna promesa sin condicionar».

**Población:** `public/dashboard/**` (recorrido completo del árbol, 84 `.js` + 2 `.html` a fecha de este
commit) + `src/modules/messaging/domain/lifecycle.service.ts`.

**Discriminador:** «cobrar/cobro/cliente+pagar/recordatorio de pago», NO «factura+entrega» (eso es
SCRUM-299). 5 patrones nombrados, cada uno calcado de una frase real medida (no inventada).

**Criterio:** una promesa de cobro es roja si el FICHERO que la contiene no tiene una condición REAL
sobre el modo de emisión (`getEmissionMode(` o `appModoEmision === /!== '...'` — la comparación, no la
mera presencia del identificador). Granularidad por FICHERO, no por función — declarado como el SUELO del
guard en su propia cabecera, con el porqué (los tres mecanismos de gateo medidos no comparten alcance
léxico con el texto en los tres casos a la vez).

## 3 · El barrido antes de escribir (A23 #1) encontró una 7ª superficie que #1650 no tocó

El censo de J3 (SCRUM-1029 §2/§11.1) midió 6 superficies y las gateó en PR #1650. El barrido previo a
este guard (A23 #1: comprobar que la prohibición no está YA rota antes de escribirlo) encontró una 7ª,
en un componente HERMANO que repite el mismo microcopy:

`public/dashboard/js/puertaSerie.js:98` — «Tu primera factura con YaQu será: …» — el MISMO texto
aprobado del Paso 2 del asistente (el propio fichero lo dice: «Microcopy APROBADO del Paso 2, literal»),
pero vive en un componente independiente («la puerta de última oportunidad», cargado en
`index.html:345` para quien ya pasó el onboarding). Mecanismo propio
(`window.appPuertaSerieDisponible` ← `debeOfrecerArranqueDeSerie`, `fiscalInput.ts:266-273`), sin
ninguna relación con país ni con `INVOICING_ES_ENABLED`/modo de emisión. Víctima HOY: cualquier
merchant ES con facturación OFF que ya completó el alta y aún no contestó la pregunta de numeración.

Reportado al orquestador (BLOQUEO), no arreglado por mí (`public/` no es de J6, A7) ni abierto como
ticket por mí (A13). Decisión del orquestador: **no se empuja el guard con una excepción declarada** —
se gatea el código primero, porque el arreglo es una línea del mismo patrón ya aprobado y una excepción
«temporal» sobre el caso que el guard existe para cazar lo dejaría débil desde el día 1. Lo gateó J1
(dueño de `puertaSerie.js`, `dos-equipos.md` §3.2) en **PR #1665**, mergeado 2026-09-22T09:44:23Z.

**Lección del expediente, tal como la pidió el orquestador:** tres barridos independientes sobre la
misma prohibición dieron tres números distintos — 5 (censo original) → 6 (el pie compartido, encontrado
al construir el gateo) → 7 (este guard, antes de escribirse). Las tres veces el hueco era el mismo tipo
de cosa: lo COMPARTIDO o lo HERMANO — un pie común entre 7 emails, un componente gemelo que repite un
microcopy aprobado en otra pantalla. Mirar pantalla por pantalla no lo ve; un barrido que recorre el
árbol completo por patrón, sí. Que lo cazara el PASO 0 antes de escribir el guard —y no el guard ya en
producción, meses después— es exactamente para lo que existe ese paso.

Dos observaciones menores del mismo barrido, con el orquestador de acuerdo en dejarlas como ALCANCE
DECLARADO (no excepción) en la cabecera de `_copy-cobro-profesional.mjs`, no aquí:
- `settingsView.js` (tarjeta Stripe Connect): sin víctima hoy, `PAYMENTS_CONNECT_ENABLED` OFF global.
- `settingsView.js` (checkbox de notificación «cuando un cliente paga»): preferencia del profesional,
  no promesa de marketing — categoría distinta, no hueco del detector.

## 4 · Verificación — rojo primero, contra las SIETE, luego verde

Secuencia exigida por el ticket: ① #1650 en `main` (mergeado 09:00:32Z, confirmado antes de empezar) →
② rojo contra el código anterior a #1650 → ③ verde contra el código de hoy.

**② ROJO**, worktree fijado al commit `fae6a849` (el padre del merge de #1650, confirmado con
`git show --format='%H %P' origin/main` antes de #1650 entrar) — las SIETE superficies caen, incluida
la que #1650 no tocó:

```
public/dashboard/js/onboardingView.js:193  [documento futuro atado a la emisión]
public/dashboard/js/plansView.js:102       [cliente + pagar, pegados]
public/dashboard/js/plansView.js:103       [recordatorio automático de pago/cobro]
public/dashboard/js/puertaSerie.js:98      [documento futuro atado a la emisión]   ← la 7ª
public/dashboard/js/settingsView.js:584    [cliente + pagar, pegados]
public/dashboard/js/settingsView.js:641    [cliente + pagar, pegados]
public/dashboard/js/settingsView.js:1278   [cliente + pagar, pegados]
public/dashboard/js/settingsView.js:1294   [cabecera "lista para cobrar"]
public/dashboard/js/tutorial.js:184        [cliente + pagar, pegados]
src/modules/messaging/domain/lifecycle.service.ts:61   [cobrar antes de empezar]
src/modules/messaging/domain/lifecycle.service.ts:131  [cobrar antes de empezar]
src/modules/messaging/domain/lifecycle.service.ts:155  [facturas se generan solas al cobrar]
```

(settingsView.js aparece varias veces porque las 4 líneas conviven en la misma superficie A, el
checklist de ajustes — no son 4 superficies distintas.)

**③ VERDE**, mismo guard, contra `origin/main` de la cabecera de este documento (con #1650 Y #1665
mergeados): `2 pass · 0 fail`.

**Control positivo del propio detector** (SUELO del test): una frase canónica («Vas a cobrar antes de
empezar») cae; `lifecycle.service.ts` y `settingsView.js` salen `condicionado: true` hoy — si alguno de
los dos diera `false`, el detector de condición estaría ciego y el verde no significaría nada.

## 5 · Suite completa

`npm test` sobre el árbol de esta rama (post #1665): `8106 tests · 7976 pass · 4 fail · 126 skipped`.
Los 4 fallos son **previos a esta rama y no relacionados** — verificado quitando temporalmente los dos
ficheros nuevos de este guard y repitiendo exactamente esos test: fallan igual sin ellos.

- `SCRUM-476` (reconciliación de censos de `node_modules` entre worktrees): topología de OTROS
  worktrees de esta máquina (`scrum-1016c/d/f`, de otras sesiones), sin `node_modules` — no es nada que
  este guard toque ni pueda arreglar.
- `SCRUM-939b` ×3 (trinquete de las skills, la ruta de `gh.exe`): una entrada de `FALSAS_DECLARADAS`
  quedó vieja desde que se instaló `gh` el 18-sep-2026 — bookkeeping de otro carril (S5/skills), no de
  este ticket.

Sí arreglado en esta rama, encontrado por el propio `npm test`: `SCRUM-737` (censo de cifras sin ancla)
subió de 81 a 83 por dos comentarios míos que decían «las 6 superficies medidas» sin anclar el número —
y encima ya estaba desfasado (eran 7 tras el hallazgo de §3). Reformulado sin el número (opción ② de las
que ofrece el propio guard): `git log` de esta rama lo muestra como commit separado si hace falta
auditarlo.

## 6 · Lo que NO se tocó

- `tests/_copy-publico.mjs` ni `tests/scrum299-copy-factura-publico.test.mjs` — se REUSA
  `literalesDeJs` de `_copy-publico.mjs` (import, no edición) para el mismo enmascarado AST que ya usa
  SCRUM-299; su contrato no cambia.
- Ningún copy: el texto sustituto de las 7 superficies sigue pendiente de firma de Javier (regla 39).
- Ninguna lista de excepciones ensanchada para que algo pasara — el único hallazgo que bloqueaba
  (`puertaSerie.js`) se resolvió gateando el código, no relajando el guard (decisión del orquestador,
  §3).

## 7 · Ticket

Jira **SCRUM-1080** (`equipo-javier`, `area-j6`, `calidad`). Lo cierra el orquestador (A13), no yo.
