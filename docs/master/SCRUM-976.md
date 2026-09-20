# SCRUM-976 · los censos y trinquetes que solo leen ficheros, dentro de `guards:entrada` (PARCIAL: censo medido, arreglo NO hecho)

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · 2026-09-20T20:22:34Z (GitHub)
**Rama:** `scrum-976-guards-de-lectura-en-la-entrada` · **Worktree:** `wt-976`

🔴 **Estado: NO ENTREGADO.** Cierre por fin de uso a los ~25 min de empezar. Este expediente deja lo
medido para que el relevo no lo repita; **`scripts/guards-entrada.mjs` NO se ha tocado.** No se ha empujado.

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
