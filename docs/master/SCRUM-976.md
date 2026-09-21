# SCRUM-976 · los censos y trinquetes que solo leen ficheros, dentro de `guards:entrada` (PARCIAL: censo medido, arreglo NO hecho)

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · 2026-09-20T20:22:34Z (GitHub)
**Rama:** `scrum-976-guards-de-lectura-en-la-entrada` · **Worktree:** `wt-976`

✅ **Estado (21-sep-2026): ENTREGADO en el «APÉNDICE · FASE b» de abajo.** Lo que sigue hasta ese apéndice
es el estado del 20-sep (censo medido, arreglo no hecho) y se conserva tal cual, como registro.

## ① El rojo, reproducido con el commit de verdad

El #1541 cayó en CI por `tests/scrum237-negacion-respaldada.test.mjs` (commit `4be8adcb`,
`tests/scrum320-que-falta-para-cobrar.test.mjs:418 «sin-facturar»`: una negación sin respaldo).

Reproducido en un worktree desechable en ese commit (`git worktree add --detach … 4be8adcb`, SIN `dist` y
SIN base):

    node --test tests/scrum237-negacion-respaldada.test.mjs   → tests 8 · pass 7 · fail 1   (cae)
    node scripts/guards-entrada.mjs                            → «4 guards de entrada en verde (26 tests)»  EXIT 0

O sea: **el mismo commit da ROJO en CI y VERDE en `guards:entrada`.** Ese es el rojo que el arreglo tiene
que poner en verde→rojo: con 237 dentro de `GUARDS`, `guards:entrada` sale 1 en ese commit. El worktree
`wt-976-rojo` sigue ahí para reproducirlo (no borrar sin pedirlo; se retira con
`git worktree remove --force D:\MILLONARIO\cobroFlash\wt-976-rojo`).

## ② Censo con población (917 ficheros `tests/*.test.mjs`)

Cada fichero corrido por separado, **sin `dist`, sin `DATABASE_URL`, `--test-force-exit`, 4 en paralelo**
(`docs/master/evidencias/scrum976/censo976.mjs`; resultados en `censo.json`; resumen con `analiza.mjs`).

    917 ficheros · 455 verdes limpios · 51 con skip · 411 rojos (sin dist o sin base: instrumento que no arranca)
    313 verdes sin mencionar dist/base/navegador  (suma 852 s, medida con 4 en paralelo)

**El criterio «puede poner un PR en rojo y se lee sin compilar» NO SE PUEDE APLICAR TAL CUAL**: lo cumplen
313 ficheros y suman ~14 min. Hay que estrecharlo. El discriminador que propongo, **NO medido todavía**:
un test entra si su población **crece sola cuando OTRO PR añade un fichero** (recorre `tests/`, `scripts/`,
`docs/master/`, `package.json` o `git ls-files`, no un fichero fijo). Un test de una pantalla concreta solo
cae si se toca esa pantalla, y a ese lo corre quien lo toca.

Los siete de la lista provisional, con su tiempo (**con 4 procesos en paralelo, o sea inflado; no medido en aislado**):

| test | resultado sin dist/base | ms | ya en guards:entrada |
|---|---|---|---|
| scrum237-negacion-respaldada | verde, 8 tests | 8.994 | NO |
| scrum258-nota-por-sesion | verde, 10 | 7.398 | NO |
| scrum267-ancla-de-medicion | verde, 14 | 11.396 | sí |
| scrum514-aprobado-y-aplicado | verde, 7 | 1.158 | NO |
| scrum522-guards-fuera-de-la-tanda | verde, 26 | 456 | NO |
| scrum548-peaje-package-json | verde, 8 | 226 | NO |
| scrum723-guard-contra-su-base | verde, 8 | 10.954 | NO |
| scrum514-leeme-multilinea | **ROJO sin dist** (importa `dist/`) | 283 | NO — **no entra** |

Los seis que faltan suman ~29 s con la máquina cargada. **Decisión pendiente del orquestador**: cuál es el
techo (~30 s dijo él) y si 237 + 723 + 258 (los tres de ~8-11 s) merecen sitio.

⚠️ 522 lo marqué «nav» por texto (menciona puppeteer) y sale verde y rápido: **es lectura pura**, la
clasificación por texto se equivoca; el criterio real es «pasa sin dist y sin base», no «no nombra nada».

## ③ Trampas que dejo

- 🔴 La clasificación estática por texto (`dist/`, `prisma`, `puppeteer`) da falsos positivos y falsos
  negativos; **el criterio decisivo es ejecutarlo sin `dist`/base y ver que corre tests de verdad**
  (`tests > 0`, `skipped = 0`).
- **61 rojos sin `dist/base/nav` en el texto** (p. ej. `scrum356`, `scrum804`, `scrum836`, `scrum867`):
  fallan sin `dist` por una vía indirecta (importan un script que sí lo usa). No entran, pero **no se
  investigó cuál es la vía**: no medido.
- **2 con skip** entre los limpios (`scrum476`, `scrum858b`): un skip es un verde que no dice nada.
- Los tiempos de aislamiento **no se midieron** en solitario. Hay que repetir los candidatos de uno en uno.
- `guards:entrada` ya tardaba **11,5 s** en el commit `4be8adcb` (no «~5 s»): 267 solo son ~11 s.
- **964c** (`origin/scrum-964c-parsea-antes-de-empujar`, sin mergear) también edita `GUARDS` y sube `MINIMO`
  de 4 a 5: al empujar 976, **mezclar main** y contar con ese conflicto.

## ④ Lo que falta para cerrar 976

1. Repetir por separado los candidatos y decidir el corte con el orquestador (techo de segundos).
2. Subir a `GUARDS` con `porque` y subir `MINIMO` para que nadie quite una línea sin que salte.
3. **Rojo:** un test que lanza `guards-entrada` contra el commit del §① (o contra un fixture con una
   negación sin respaldo) y exige EXIT ≠ 0. Y control positivo con el árbol actual (EXIT 0).
4. Mezclar `origin/main` (no rebasar), control de sufijo en su propio comando, empujar.


# APÉNDICE · FASE b (21-sep-2026) · ENTREGADO: seis censos de lectura pura dentro de `guards:entrada`, con techo de 60 s

> ⚠️ Se ANEXA. Nada de lo de arriba se toca, salvo la línea de «Estado», que dejaba de ser verdad.

**Medido contra:** `origin/main` = `b950b04365813b976d06fa18e25d9b51b45c0d5f` · 2026-09-21T07:17:41Z (GitHub)
**Rama:** `scrum-976-guards-de-lectura-en-la-entrada` · **Worktree:** `wt-976`

**Decisión del orquestador (21-sep, con la medición de arriba delante):** el criterio tal cual NO cabe
(313 ficheros, ~14 min). Entran SEIS y nada más — 237, 258, 514, 522, 548 y 723 — y el comando ENTERO
tiene un techo de 60 s, escrito como mecanismo y no como número en un comentario. Este apéndice lo
aplica; el «discriminador propuesto» del §② queda como propuesta NO adoptada (258 y 723 no lo cumplen:
están por decisión, no por deducción, y el comentario de `scripts/guards-entrada.mjs` lo dice así).

## ① Lo que cambia

- `scripts/guards-entrada.mjs`: seis entradas en `GUARDS`, cada una con su `porque`; `MINIMO` 5 → 11;
  `GUARDS`, `MINIMO` y `TECHO_MS` exportados; el plazo (`TECHO_MS = 60000`) lo hace cumplir el propio
  comando con el `timeout` del `spawnSync` (`ETIMEDOUT` → exit 1 con «se pasaron del TECHO»); el entorno
  puede BAJARLO (`GUARDS_ENTRADA_TECHO_MS`), nunca subirlo; la línea final dice cuánto tardó.
- `tests/scrum976-guards-entrada-con-techo.test.mjs` (4 tests): ① los once por NOMBRE + suelo ≥ once;
  ② techo fijado y solo bajable; ③ mitad NEGATIVA (plazo de 1 ms → exit 1 y «se pasaron del TECHO»);
  ④ mitad POSITIVA (el comando de verdad, exit 0, dentro del techo, con el recuento de tests).
- No se toca `src/`, `public/`, ni el resto de tests. El conflicto esperado con SCRUM-964c no se dio:
  964c ya estaba en main (`MINIMO` 4 → 5) y se conservó su quinta entrada.

## ② Lo medido

Sin `dist` y sin base, con `FORCE_COLOR` borrado y comprobado, cada uno SOLO (no con 4 en paralelo):

    237  2,9 s (8 tests)  ·  258  4,6 s (10)  ·  514  2,2 s (7)  ·  522  0,3 s (26)  ·  548  0,2 s (8)  ·  723  9,5 s (8)
    los seis, uno tras otro: ~19,7 s · todos con skipped 0

Y el comando entero, con los once (el runner reparte los ficheros): **17,2 s, exit 0, 95 tests** — 3,5 veces
de margen bajo el techo. Los tiempos del §② de arriba (9,0 / 7,4 / 11,0 s) estaban inflados por el paralelo.

## ③ El rojo, con dos controles y el rojo REAL

- **Rojo real (el del #1541):** worktree `wt-976-rojo` en `4be8adcb36b9572add7c6fd6add3f6bdc76292ae`, sin
  `dist` y sin base. Con el `guards-entrada.mjs` de ese commit: **exit 0** (verde, el defecto). Copiándole
  encima el de esta rama (`git diff --numstat` → `86 11 scripts/guards-entrada.mjs`, la inyección se
  aplicó): **exit 1**, y la salida trae `✖ SCRUM-237 · ninguna negación de la suite se queda SIN
  respaldo`. Se restauró (`git checkout --`) y el worktree quedó limpio (`status` = 0 líneas).
- **Inyección 1** (commit `83babb7883fc4b2dbe37e262700164177226a216` hecho ANTES): renombrar la línea de 237
  en `GUARDS` (`git diff --numstat` → `1 1`) → el test ① cae (exit 1). Revertido con
  `git restore --source=HEAD --staged --worktree`, `status --porcelain` = 0.
- **Inyección 2** (mismo commit): quitar `timeout: techo` del `spawnSync` (`1 1`) → el test ③ cae (exit 1,
  9,9 s: el comando corrió entero y salió verde en vez de 1) y ①②④ siguen en verde. Es la que demuestra
  que el techo MUERDE. Revertido igual, `status --porcelain` = 0.

## ④ Trampas y lo que NO se midió

- 🔴 El techo se mide en RELOJ, y la tanda corre esto mientras otros ficheros corren en paralelo. Con 17 s
  frente a 60 s hay margen; **no se midió** bajo la tanda completa cargada. Si algún día ④ cae por
  el techo en CI y no en local, el dato es ése, no un guard roto.
- `514-leeme-multilinea` sigue FUERA (importa `dist/`, rojo sin build): no es de lectura pura.
- Los 61 rojos sin `dist/base` en el texto (§③ de arriba) siguen sin investigar: no entran en este
  encargo y no se midió su vía indirecta.
- 522 tocará a #1541 (917e) y #1552 (970): el conflicto lo resuelve quien mergea, derivando la cifra.


# APÉNDICE · FASE c (21-sep-2026) · el techo de `guards:entrada` sube de 60 a 90 s

> ⚠️ Se ANEXA. Nada de lo de arriba se toca: la fase b decía 60 s y era la medida de aquel momento.

**Medido contra:** `origin/main` = `3ac838a5e055bb9e70a484560ee5b23187c6f491` · 2026-09-21T07:48:58Z (GitHub)
**Rama:** `scrum-976b-techo-90-s` · **Worktree:** `wt-976b`

**Decisión del orquestador (21-sep):** techo a 90 s. Un guard que cae por sorteo enseña a desconfiar de
los rojos, que es peor que un techo algo más alto.

## De dónde sale el 90 (para quien lo lea después)

Los once guards juntos, `npm run guards:entrada` sobre el mismo árbol, el mismo día:

    máquina en FRÍO ......... 11,1 s · 17,2 s (corridas de la mañana, con menos sesiones trabajando)
    máquina CARGADA ......... 44,5 s  (otras sesiones de fondo trabajando en la misma máquina)

Con 60 s de techo el margen de la corrida cargada era de 1,3 veces: el test ④ de
`tests/scrum976-guards-entrada-con-techo.test.mjs` (que lanza el comando y lo cronometra) podía caer en
CI, que también corre cargado, sin que ningún guard estuviera roto. Con 90 s son 2 veces sobre la peor
medida, y sigue siendo un techo: 5 veces lo que tarda en frío.

## Lo que cambia

`TECHO_MS` 60000 → 90000 en `scripts/guards-entrada.mjs` (comentario con las dos medidas) y, en el test, el
valor fijado (`assert.equal(TECHO_MS, 90000, …)`) y su título. El mecanismo es el mismo: el plazo lo hace
cumplir el `spawnSync` y el entorno sólo puede BAJARLO. Subirlo otra vez exige tocar el número fijado en el
test, o sea un PR que lo diga.

## Lo que NO se midió

- El comando bajo la tanda COMPLETA de CI, con todos los ficheros de `tests/` a la vez: la corrida cargada
  de arriba es una máquina de escritorio con otras sesiones, no el runner. Si ④ cae por el techo en CI y
  no en local, ése es el dato.
