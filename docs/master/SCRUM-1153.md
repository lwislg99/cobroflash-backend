# SCRUM-1153 — Censo AST: laboratorios que le prestan su entorno al sujeto

**Medido contra:** `origin/main` = `cbb30708590011f79b1f392f322c4d264eab537c` · 2026-09-26T13:10:54Z
**Rama:** `scrum-1153-censo-entorno-prestado` · **Carril:** Sesión 3 (instrumentos)

## Qué se construyó

`scripts/_censo-entorno-prestado.mjs` — hermano de `_censo-de-suelos.mjs` y `_censo-mkdtemp.mjs`, mismo
patrón (SCRUM-927/938/940). Por AST, acusa toda llamada `spawn`/`spawnSync`/`exec`/`execSync`/
`execFileSync` que cumpla LAS DOS a la vez:

1. lanza un `node` hijo (`process.execPath`, o el literal `'node'`/`'node.exe'`);
2. su resultado se parsea (`<r>.stdout` encadenado con `.match`/`.test`/`.split`, o envuelto en
   `JSON.parse(...)`), **y** su `env` no está construido a mano: falta del todo, es `process.env` a
   secas, o es `{ ...process.env, … }` sin que la variable reciba un `delete` antes de usarse.

Test de red: `tests/scrum1153-censo-entorno-prestado.test.mjs` (9 casos, todos verdes).

## 🔴 HALLAZGO SOBRE EL PROPIO ENCARGO — sólo 1 de los 3 casos históricos es control positivo de ESTE censo

El enunciado (tabla de "por qué existe este ticket" + criterio de aceptación 1) pide que el censo acuse
"los tres casos históricos": SCRUM-940 (`\b`), SCRUM-938 (`decidirVaciando`), SCRUM-928c (`correrPaso`).
Medido contra el código real de cada uno (no reconstruido de memoria):

| caso | ¿lanza un `node` hijo? | ¿parsea `stdout`? | ¿control positivo de ESTE censo? |
|---|---|---|---|
| **SCRUM-938** (`decidirVaciando`) | sí, `process.execPath` | sí, `r.stdout.match(...)` | ✅ SÍ — control real, `tests/scrum1153-….test.mjs` § ② |
| **SCRUM-940** (`_censo-de-suelos.mjs:198`) | no hay ningún `spawn`/`exec` en el fichero | — | ❌ NO — el defecto es `'\b'` como cadena DENTRO de una regex, sin proceso hijo de por medio. Es la MISMA familia («no pude mirar» = «no hay nada»), pero un mecanismo distinto; ningún censo de `spawn` puede alcanzarlo |
| **SCRUM-928c** (`correrPaso`) | no — spawnea **`bash`**; el `node` real corre dentro del guion sustituido, invisible para este AST | no — lee FICHEROS del temporal (`estados.txt`); el `.split('|')` vive en el test que llama a `correrPaso`, no en la función | ❌ NO — dos motivos independientes, cualquiera basta |

**Los tests ④ del fichero de red dejan esto escrito con el código real** (vía `git show HEAD:…`), no como
afirmación: si algún día `_censo-de-suelos.mjs` o `correrPaso` empiezan a encajar en el patrón, esos dos
tests dejan de estar vacíos y avisan.

**Recomendación:** corregir el criterio de aceptación 1 a "acusa el caso histórico de SCRUM-938 (control
real) y un caso fabricado (SCRUM-846)" — que es lo que este censo puede demostrar honestamente — en vez de
forzar un fixture que no reproduce el fichero que de verdad existió, o inventar una definición más ancha
del patrón sólo para poder marcar la casilla.

## Los otros 3 requisitos de aceptación

- **Control negativo derivado, no cableado a mano:** el negativo NO es un segundo texto escrito aparte —
  es el MISMO fabricado positivo, con el arreglo YA CONOCIDO (SCRUM-938: `{ ...process.env}` + `delete`)
  aplicado por una función de sustitución (`saneado()`), para que los dos casos no puedan divergir en
  forma. Y el control negativo REAL es el propio `scripts/censo-lista-como-fixture.mjs` de HOY, leído de
  git — no una copia hecha a mano.
- **Sin suelos escritos a mano:** el censo no fija ningún mínimo numérico. `motivosParaNoFiarse()` exige
  población > 0 y al menos una llamada vista, nada más (mismo patrón que `_censo-de-suelos.mjs`).
- **Fallando primero:** la primera versión del detector SÍ acusaba en falso el `decidirVaciando` YA
  ARREGLADO de hoy (buscaba el `delete` sólo dentro del closure `correr`, no en la función que lo
  envuelve, `decidirVaciando`, donde vive de verdad). Confirmado el rojo, corregido
  (`tieneDeleteAntes` busca en el fichero entero), confirmado el verde. Queda en el propio código
  fuente del censo (comentario junto a `tieneDeleteAntes`).

## Hallazgo adicional — 8 candidatos NUEVOS en el árbol de hoy (NO arreglados en este ticket)

Corriendo `censar('.')` sobre el árbol real: **1.405 ficheros, 246 mencionan la familia `spawn`, 9
llamadas son un `node` hijo cuya salida se parsea, 8 acusadas** (todas sin `env` en absoluto):

```
tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs:192
tests/scrum750-los-dos-calendarios.test.mjs:55
tests/scrum815-idempotencia-del-webhook.test.mjs:42
tests/scrum899-sesion-lista-blanca.test.mjs:206
tests/scrum899b-arranque-de-la-tanda.test.mjs:116
tests/scrum951a-equipo-configurable.test.mjs:184
tests/scrum954-vivo-no-es-listado.test.mjs:263
tests/scrum959b-el-arranque-no-duplica-el-equipo.test.mjs:194
```

La única LIMPIA es `scripts/censo-lista-como-fixture.mjs:357` (el `decidirVaciando` ya arreglado).

⛔ **No se ha verificado víctima HOY para estos 8** (si de verdad fallan al correr dentro de otro
`node --test`, que es exactamente el mecanismo de SCRUM-938/928c) — eso es otra tanda, y "un hallazgo
sólo es ticket si tiene víctima HOY, tope 3 por tanda" (norma del día). Quedan aquí, con su línea exacta,
para que el orquestador reparta hasta 3 como ticket nuevo si al comprobarlos tienen víctima.

## Verificación

- `node --test --test-force-exit tests/scrum1153-censo-entorno-prestado.test.mjs` → 9/9 pass.
- Junto a los hermanos (938/940/928c/927): 38/38 pass, 34,8 s.
- `npm run guards:entrada` → 112/112 pass, exit 0.
- `npm run build` → sin errores.
- No se corrió la tanda completa (7.7xx tests, ~340 s) por presupuesto de contexto de la tanda; no se
  tocó ningún fichero de `src/`, `scripts/` o `tests/` fuera de los dos nuevos, así que el riesgo de
  regresión fuera de lo verificado es bajo, pero queda declarado en vez de omitido.

---

# APÉNDICE · 27-sep-2026 · SCRUM-1153b · `tests/scrum750-los-dos-calendarios.test.mjs`, curado

**Medido contra:** `origin/main` = `37bda5dbc6991cc33a54ee7248020be30d2f977f` · 2026-09-27T15:51:17Z

Rama `scrum-1153b-scrum750-env-explicito`. *(El ancla la generó `node scripts/equipo/ancla.mjs` el
27-sep; la primera versión de este apéndice decía «`origin/main` en el momento del push», que no es
un ancla y que `tests/scrum267-ancla-de-medicion.test.mjs` acusa trozo a trozo.)*

Cierra uno de los 8 acusados del censo de arriba: `tests/scrum750-los-dos-calendarios.test.mjs`
(entonces línea 55), cuya `sonda()` lanzaba el `node` hijo con `{ encoding: 'utf8' }` — sin `env`
en absoluto, así que heredaba `process.env` completo de la tanda. `NODE_TEST_CONTEXT` (que node
`--test` fija en el proceso padre y que cambia el formato de salida del hijo),
`FORCE_COLOR`/`NODE_OPTIONS` (de la máquina, no del sujeto que se está probando) viajaban sin
querer al subproceso.

## El arreglo — el mismo patrón que SCRUM-938 (`decidirVaciando`)

```js
const entornoSonda = { ...process.env };
delete entornoSonda.FORCE_COLOR;
delete entornoSonda.NODE_OPTIONS;
delete entornoSonda.NODE_TEST_CONTEXT;
// …
const r = spawnSync(process.execPath, [...], { encoding: 'utf8', env: entornoSonda });
```

`entornoSonda` se construye UNA vez, junto al `cache` de la sonda (memorizado igual que antes), y
se reutiliza en cada llamada — no cambia la firma de `sonda()` ni el resto del fichero.

## El censo baja en uno — MEDIDO (S1, 27-sep)

La primera versión de este apéndice (una invocación de `@claude` sin permiso para lanzar `node`)
dejó el número sin medir y lo dijo. Medido después por la S1 con `censar()` de
`scripts/_censo-entorno-prestado.mjs`, sobre los DOS árboles y con la misma población:

| árbol | ficheros | con spawn/exec | llamadas nuestras | acusados | limpios | suelo |
|---|---|---|---|---|---|---|
| `origin/main` (`37bda5db`) | 1.410 | 249 | 11 | **10** | 1 | ok |
| esta rama | 1.410 | 249 | 11 | **9** | 2 | ok |

La única diferencia entre los dos conjuntos de acusados es `tests/scrum750-los-dos-calendarios.test.mjs:55`,
que pasa a limpio. (El cuerpo de este fichero registraba 8 el 26-sep. Comparado con su lista, las dos llamadas acusadas
nuevas son `tests/scrum1123-vigia-despliegue-aviso.test.mjs:95` y `:131`, entradas después del
censo; no son de esta rama y quedan para quien siga con SCRUM-1153.)

## Verificación

- Los 8 tests de `tests/scrum750-los-dos-calendarios.test.mjs` en verde (CI, run del PR de este
  apéndice): `SUELO`, `EL QUE DECIDE`, `el mismo día…`, `CONTROL POSITIVO`, `fechaDeAtajo DELEGA…`,
  `FAIL-CLOSED`, `la VISTA le pasa el merchant…`, `mis mutaciones las LEE el lector oficial…`.
- No se tocó ningún otro fichero de `src/`, `scripts/` o `tests/`: el diff es una sola línea de
  import de `env` en la llamada existente a `spawnSync`, más las cuatro líneas que construyen
  `entornoSonda`.
- Esta misma entrada es lo que exigía el guard SCRUM-854 (`docs/master/SCRUM-1153.md` tenía que
  aparecer en los ficheros que toca la rama): el rojo del check obligatorio no era del código, era
  de este expediente, que faltaba.
