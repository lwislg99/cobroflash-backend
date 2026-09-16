# SCRUM-871 · Los dos que no corría nadie: uno entra en la tanda y el otro va aislado

**Medido contra:** `origin/main` = `956be91d588031cd46b68b577968b82c4bc01660` · 2026-09-16T08:31:19Z
**Rama:** `scrum-871-los-dos-que-no-corre-nadie` · **Carril:** `tests/` (Sesión 3) · **Gate:** sin gate

> Un test desgateado que nadie ha visto caer es un verde nuevo sin respaldo — peor que el skip que
> sustituye. Y uno que se cae una de cada tantas tandas entrena a relanzar, que es peor todavía.

⏱ Horas **de GitHub** (el reloj local va 333 s adelantado, medido el 16-sep-2026).

---

## 0 · De dónde sale esto, y cuál era el «antes»

Grupo B del reparto de SCRUM-868: los dos gateados que **no ponía nadie**. `SERIE_PG_URL` y
`TRAMOS_PG_URL` no estaban en ningún workflow, ni en `package.json`, ni en ningún script.

El «antes», leído en el log del job `build + tests (con banco desechable)` de `main` (run
`35070739613`, 16-sep-2026), no deducido:

```
﹣ SCRUM-728 · el aviso del ce…        ← saltado
﹣ SCRUM-814 · los dos caminos que…    ← saltado
ℹ tests 6946 · pass 6849 · fail 0 · skipped 97
```

`scrum728` vigila el aviso del **cerrojo de numeración** saturado; `scrum814`, la **carrera de
tramos**, que emite facturas. Dinero y camino fiscal, sin ejecutar en ningún sitio.

## 1 · EN ROJO, contra banco REAL — primero, porque si no caen no hay nada que empujar

Banco local desechable en loopback, una base `_test` por fichero. Mutaciones de radio mínimo, cada
una el defecto de SU ticket:

| mutación | ¿cae? | con qué mensaje |
|---|---|---|
| ① `cerrojoSaturado.ts`: el traductor deja de reconocer `P2028` | 🔴 **CAE** «con el cerrojo retenido >5 s, la respuesta es LEGIBLE y no un `internal_error`» | «🔴 sale 500 `{"error":"internal_error"}`» — el fallo original, literal |
| ② `quotes.routes.ts:718`: se apaga el RECUENTO dentro de la transacción | 🔴 **CAE** «CLIENTE FINAL · tres carreras en `/:token/decision`: nunca dos del mismo tramo» | «🔴 RONDA 1: DOS FACTURAS DEL MISMO TRAMO ["Anticipo","Anticipo"]» |

Verde de referencia antes de mutar: `scrum728` **6/6 en 25 s**, `scrum814` **4/4 en 64 s**. Fuentes
restauradas y **verificadas byte a byte** tras cada caso, `dist/` recompilado, y los dos de vuelta en
verde. Sin `git stash` (A15). `src/` queda intacto: las mutaciones son del arnés, no del PR.

### ⚠️ La primera pasada del arnés dio un diagnóstico FALSO

Dijo «el build falló con la mutación puesta: la mutación no es válida» para las dos. Era mentira del
instrumento: `spawnSync('npm.cmd')` sin shell falla en Windows desde Node 20. **Lo delató que el
build fallara también DESPUÉS de restaurar** — si sólo hubiera fallado con las mutaciones puestas,
habría publicado «estas mutaciones no compilan» y me habría quedado tan ancho.

## 2 · 🔴 EL ENSAYO QUE CAMBIÓ LA FORMA DEL CAMBIO

La propuesta era meter los dos en la tanda. Antes de empujar se ensayó eso mismo: `npm test` con las
**tres** variables puestas, sobre bases recién creadas.

```
6965 tests · 6867 pass · 2 fail · 96 skipped
✔ SCRUM-728 · el aviso del cerrojo saturado (20,9 s)
✖ SCRUM-814 · los dos caminos que el test de staging no cubre (70,3 s)

Transaction already closed: … The timeout for this transaction was 5000 ms,
however 6583 ms passed since the start of the transaction.
```

Bajo la carga de los ~800 ficheros en paralelo la transacción de emisión **se pasa del `timeout` de
Prisma**: `scrum814` se ahoga por la MISMA saturación que documenta `scrum728`, no por el defecto que
vigila. 70 s dentro de la tanda frente a 64 s corriendo solo, y con fallo.

🔒 **Meterlo así habría añadido un rojo intermitente en el camino del dinero** — un verde nuevo sin
respaldo, y encima de los que entrenan a relanzar la tanda.

### ⚠️ Y el primer ensayo NO valía, aunque apuntara a lo mismo

La primera vez salió lo mismo, pero con 18 fallos que incluían los de libro —que CI corre verdes
todos los días— y con `scrum814` cayendo **también en solitario**. La causa no era el árbol: **mi
Postgres local se había apagado a mitad**, y lo delató el log (`database system was shut down`). Lo
había arrancado desde una tarea en segundo plano, así que al terminar la tarea se llevó al servidor
por delante. Se relanzó como proceso independiente y **se repitió todo sobre bases recreadas**; los
números de arriba son los de esa segunda vuelta. Un ensayo medido contra un instrumento que se muere
no dice nada, ni para bien ni para mal.

## 3 · Lo que entra

| | dónde corre | por qué |
|---|---|---|
| `scrum728` | **dentro de la tanda** (`SERIE_PG_URL` en el paso `Tests`) | medido: pasa en ~21 s con los ~800 ficheros corriendo a la vez, dos veces seguidas |
| `scrum814` | **paso propio, aislado y después** (`TRAMOS_PG_URL` sólo ahí) | medido: dentro de la tanda cae por saturación; solo, verde y repetible |

* **Tres bases `_test`, una por fichero.** `node --test` corre los ficheros en paralelo; compartir
  base haría que las escrituras de uno falsearan la medición del otro (`scrum728` mide el coste por
  reserva; `scrum814` emite facturas). Mismo esquema en las tres, aplicado con
  `migrate diff --from-empty` — nunca `db push` (regla 3).
* **Ninguna variable de entorno nueva:** las dos ya las leían esos tests desde SCRUM-728 y
  SCRUM-814. Lo único que faltaba era ponerlas.
* **Ninguna infraestructura nueva:** el servicio `postgres:16-alpine` del job ya existía.
* **No se sube ningún `timeout`** (lo prohíbe el guard de SCRUM-728) y **no se toca ni un test**.
* **`assertSafeStagingUrl` no se roza.** Estos dos no van contra staging: su propio guard exige
  loopback y base terminada en `_test`, y si no se cumple **no se saltan, fallan**.

### El ensayo en la forma final (bases recreadas)

```
tanda (LIBRO + SERIE):  6962 tests · 6864 pass · 1 fail · 97 skipped
                        ✔ SCRUM-728 · el aviso del cerrojo saturado (21,6 s)
scrum814 aislado:       4 tests · 4 pass · 0 fail (63,9 s)
```

⚠️ **Ese 1 fail es de mi máquina, y se comprueba en vez de suponerse:** es
`SCRUM-728d · SUELO: el banco es desechable, y el RTT en loopback es ~0`, un test de `LIBRO_PG_URL`
que **CI ya corre hoy y pasa** — `✔ … (100 ms)` en el run `35070739613` de `main`. Bajo la carga de
esta máquina Windows el RTT local se dispara y su suelo, con razón, dice que eso no es loopback. No
lo toca este ticket.

## 4 · Y que corren DE VERDAD en CI, leído en el log

Un `skipped` y un `pass` se leen igual en la línea de resumen, así que la prueba es el log:

> 🔴 **CORRECCIÓN (16-sep-2026, arrastrada en SCRUM-876).** Este apartado se publicó «pendiente de
> leer» porque sólo se podía comprobar después del PR, y el PR se mergeó antes. Lo que dice ahora
> es lo que se leyó; lo que decía antes, y lo que predecía mal, queda anotado debajo.

Leído en el log del job `build + tests (con banco desechable)` del PR #1328 (job `104722799796`,
mergeado el 16-sep-2026 a las 08:39:04Z):

```
✔ SCRUM-728 · el aviso del ce…                        ← dentro del paso `Tests`
﹣ SCRUM-814 · los dos caminos que el test de staging… ← saltado DENTRO de la tanda, a propósito
✔ SCRUM-814 · los dos caminos que el test de staging… ← en el paso aislado: 4 tests · 4 pass · 0 fail

tanda:  6986 tests · 6890 pass · 0 fail · 96 skipped
bancos: yaqu_libro_test · yaqu_serie_test · yaqu_tramos_test — 30 tablas cada uno
```

⚠️ **Y una predicción mía que salió mal.** Aquí se escribió que el recuento de `skipped` bajaría **en
2** respecto a los 97 de `main`. Bajó **en 1** (97 → 96). Lo correcto era 1, y el error fue mío al
escribirlo: `scrum814` sale de la tanda pero sigue contando como **saltado dentro de ella** —corre en
su propio paso—, así que dentro de la tanda sólo deja de saltarse `scrum728`. La cifra corregida no
cambia nada de lo medido; lo que estaba mal era la predicción, y se deja escrita en vez de borrarla.

## 5 · Lo que esto NO arregla

* `scrum419` —el trinquete de «CI declara lo que no ha ejecutado»— sigue anclado a `LIBRO_PG_URL`.
  Con esto los dos nuevos sí corren, pero si mañana aparece un gate con otra variable volverá a
  entrar sin que nada se ponga rojo. Reportado en SCRUM-868 §7 y **no tocado aquí**.
* Los 93 de `QA_DB_TEST` son SCRUM-869 (Sesión 1). `a55` y `bot-suite` siguen gateados: son el
  grupo C, y su ruta al banco desechable es diseño aparte.
* **Por qué la transacción de emisión tarda >5 s bajo carga** no se investiga aquí: es el fenómeno de
  SCRUM-728 visto desde otro sitio, y meterle mano sería tocar el cerrojo.

## ⛔ No tocado

`assertSafeStagingUrl` y todo `scripts/_db-guard.mjs` · `tests/_staging-db.mjs` · el gate de ningún
test · `src/` · los tests de `QA_DB_TEST` · `scrum419` · `scrum728d` · ningún `timeout` de Prisma.
