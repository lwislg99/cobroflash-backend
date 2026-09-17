# SCRUM-858 · La tanda no tarda más porque algo crezca — la hipótesis se cae, y aquí está lo descartado

**Medido contra:** `origin/main` = `99ea4b5e370b103738714b584d70f570d3a60c02` · 2026-09-16T05:32:01Z
**Rama:** `scrum-858-lo-que-crece-entre-tandas` · **Carril:** instrumentos · proceso
**Gate:** sin gate — esta tarea **sólo mide**: no toca `src/`, ni un test, ni la población de la tanda.

> ⛔ No se ha reducido la población de la tanda, no se ha saltado ni un test, y no se ha matado
> ningún proceso ajeno: los obreros de carga del §4 son hijos propios y se matan por su handle.

---

## 0 · Obligación 0

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-858(-|$)"  ->  NINGUNA
git log origin/main --oneline -i --grep="scrum-858"                 ->  sólo MENCIONES mías
docs/master/SCRUM-858.md                                            ->  no existía
```

**Caso (a): nunca se empujó.** El rastro en `main` son dos commits que *nombran* el ticket (el mío
de SCRUM-862 y un renombrado por colisión), no trabajo suyo. Un commit con el número puesto no es
trabajo hecho.

## 1 · 🔴 LA HIPÓTESIS SE CAE, Y CON TRES MEDICIONES

> «Algo que la tanda recorre CRECE entre ejecuciones.»

**No.** Los mismos tests que en la tanda lenta costaron 33–41 s **vuelven a costar 3–6 s** corridos
solos una hora después:

| test | tanda rápida (18 min) | tanda lenta (45 min) | **solo, después** |
|---|---|---|---|
| `scrum757` | 1,9 s | 41,5 s | **3,6 s** |
| `scrum737` | 1,3 s | 37,5 s | **6,7 s** |
| `scrum745` | 0,8 s | 33,6 s | **3,8 s** |
| `scrum753` | 16,5 s | 65,0 s | **23,1 s** |

**Una propiedad que hubiera crecido no vuelve a bajar.** Y el árbol creció ~12 ficheros entre las
dos tandas: de ahí no sale un ×40. La hipótesis del ticket queda **tumbada**, y lo digo con las
cifras delante en vez de buscarle una salida.

## 2 · Lo descartado, cada cosa con su medición

| candidato | cómo se midió | veredicto |
|---|---|---|
| **Población de `TMPDIR`** | experimento controlado: coste de `mkdtempSync` con 0 / 1.000 / 5.000 / 15.000 / 30.000 / 55.000 entradas hermanas | **×1,3** (0,172 → 0,226 ms). **NO es la causa** |
| **Contención de la máquina** | A/B: el mismo test solo y con 6 obreros parseando el árbol, 3 muestras cada uno, 12 núcleos | **×1,9** (3.109 → 5.798 ms). Real, pero **no basta** |
| **Red durante la tanda** | censo por AST de llamadas `git fetch/ls-remote/clone` sobre **1.120 ficheros** de `tests/` y `scripts/` | **4** llamadas, y el censo de alcanzabilidad corre con `traer:false` dentro de la tanda. **NO es** |
| **Crecimiento del árbol** | 808 ficheros de test en las dos tandas; 828 hoy | **no puede explicar ×40** |

## 3 · Dónde está el tiempo de verdad — y NO está concentrado

Comparando las **duraciones test a test** de las dos tandas (5.982 tests presentes en ambas):

```
suma de duraciones   ·   rápida 641 s   →   lenta 1.740 s   (×2,7)
delta total ................................. +1.250 s
   los  10 que más crecen aportan   324 s  (26 % del delta)
   los  20 ...........................  501 s  (40 %)
   los  50 ...........................  801 s  (64 %)
   los 100 ........................... 1.024 s  (82 %)
```

> 🔴 **Ése es el dato que decide.** Si un fichero o una población hubieran crecido, el retraso
> estaría en unos pocos tests. **Hace falta llegar a 100 tests para explicar el 82 %**: el retraso
> está REPARTIDO. Eso es la firma de un factor de máquina —contención, caché, memoria—, no la de
> algo que la tanda recorra y haya engordado.

Los que más se mueven son todos de la misma familia —censos que recorren y **parsean el árbol
entero** (`scrum753`, `757`, `737`, `745`, `740`, `411`, el de `public/`…)—, que es
exactamente la clase de trabajo que más sufre cuando la máquina va justa de E/S o de memoria.

⚠️ Y un detalle que le da la vuelta a la lectura fácil: **solos cuestan MÁS que en la tanda
rápida** (3,8 s contra 0,8 s). O sea que dentro de la tanda hay algo que los ABARATA —caché del
sistema de ficheros caliente entre ficheros—, y lo que falla los días malos es justamente eso.

## 4 · Las poblaciones, que van siempre con el tiempo

| tanda | tiempo | ficheros | tests |
|---|---|---|---|
| SCRUM-530 | **18 min, completa** | 808 | 6.865 |
| SCRUM-862 | **45 min, SIN TERMINAR** | 808 | 6.032 al corte |
| hoy, en el árbol | — | **828** | — |

Un minuto por tanda no significa nada sin saber sobre cuántos, y por eso las dos cifras van juntas.

## 5 · ⚠️ Un hallazgo que NO es la causa, y aun así hay que decir

**`TMPDIR` tiene 55.229 entradas y 24.740 son restos de esta casa**: `yaqu*` 15.679, `scrum723`
3.675, `scrum385` 1.827, `scrum778` 1.230, `scrum670` 880, `scrum727` 709, `scrum846` 524… Son
directorios de `mkdtempSync` que sus tests no borran. **No ralentizan la tanda** (§2), pero es
basura que crece sin techo en la máquina de todos. Va a `docs/BUGS.md`. **No se borra desde aquí**:
ese directorio lo comparten ~26 worktrees y cinco sesiones, y ahora mismo puede haber una usándolo.

## 6 · Límites declarados

1. **No he reproducido la tanda lenta.** Lo que hay es la comparación entre dos tandas reales y los
   experimentos de §2; falta pillarla lenta **con un medidor de máquina delante** (CPU, E/S,
   memoria, y qué más corría). Eso es lo siguiente y no cabía aquí.
2. **Mi censo de red tiene un punto ciego declarado:** ve `execFileSync('git', ['fetch'…])` pero no
   una llamada indirecta como `gitDe(raiz)('fetch', …)`, que es como lo hace
   `_censo-alcanzabilidad.mjs`. Lo comprobé a mano ahí; en otros sitios podría habérseme escapado.
3. **El A/B de contención usa obreros de CPU+lectura**, no presión de MEMORIA. Si el factor de los
   días malos es RAM (varias tandas parseando ASTs a la vez), mi ×1,9 lo subestima.

## 7 · Lo que NO se ha tocado

`src/` · ningún test · la población de la tanda · ningún skip · ningún proceso ajeno · `TMPDIR` ·
`prisma/schema.prisma` · ninguna rama ajena. Esta tarea sólo mide.

---

## SCRUM-858b · Cuelgue NO reproducido en N pasadas; cierre instalado

**Medido contra:** `origin/main` = `545d5a929a227e2f54eb13c109855a5131989376` · 2026-09-17T14:37:37Z
**Rama:** `scrum-858b-la-tanda-sin-resumen-falla` · **Carril:** Sesión 3 (instrumentos) · GO del orquestador a la opción (A), tope de 15 min (17-sep 17:45 CEST).

### 1 · PASO 0: la tanda completa, medida con tope
**Sonda** (fuera del árbol: meterla dentro puso en rojo SCRUM-708, que es justo lo que ese guard debe cazar). Lanza `node --test --test-force-exit --test-reporter=tap tests/*.test.mjs` sin shell, mide los silencios del TAP, cuenta los `node.exe` de la máquina y, si calla más de 20 min, mata SOLO su árbol. **Validada antes de usarla:** con un cuelgue fabricado da «MUDA» y no deja procesos; con una tanda sana da exit 0 y resumen.

| main | PATH | pasada | min | resumen | tests | peor silencio | tras |
|---|---|---|---|---|---|---|---|
| `e48c18d5` | sin `bash` | 1 | 9,3 | sí | 7270 | 137 s | SCRUM-600g ⑧ |
| `e48c18d5` | sin `bash` | 2 | 8,1 | sí | 7270 | 195 s | SCRUM-600g ⑧ |
| `2be8fe16` | con `bash` | 1 | 6,1 | sí | 7310 | 75 s | SCRUM-530 |
| `2be8fe16` | con `bash` | 2 | 6,0 | sí | 7310 | 105 s | SCRUM-772 |
| `2be8fe16` | con `bash` | 3 | 5,0 | sí | 7310 | 77 s | SCRUM-530 |

Además hubo 5 `npm test` completos de ramas el mismo día, todos terminados.

**SUELO: el cuelgue NO se reproduce en 5 pasadas + 5 `npm test`.** Los rojos de las pasadas fueron de montaje y se dicen: sin `bash` en el PATH, 39 tests que lo exigen; y SCRUM-708 por los ficheros de control dentro del árbol. El único rojo de `main` fue SCRUM-804, arreglado en 804f/804g.

### 2 · El silencio tras SCRUM-600g ⑧ es un FICHERO LENTO, no un cuelgue
Es `tests/scrum601-copy-del-documento-vs-flag.test.mjs`. **Solo, tarda 120 y 152 s**, y todo A NIVEL DE MÓDULO (líneas 42-44): sus tests marcan 1 ms, así que el `duration_ms` del TAP no lo ve, y el reporter retiene la salida de los ficheros que vienen detrás. Por tramos:

| tramo | tiempo | población |
|---|---|---|
| `poblacion` | 28 ms | 381 ficheros |
| `portadoresDelFlag(FLAG)` | 64,9 s | 29.911 definiciones · 1.497 portadores · 7 vueltas |
| `portadoresDelFlag(TIPO)` | 70,9 s | 1.373 portadores · 7 vueltas |
| `censoCopy` | 26,3 s | |

Que esto explique las 2,7 y 4,3 horas del 15-sep **no está probado**.

### 3 · El cierre: `npm test` pasa por `scripts/tanda-con-veredicto.mjs`
**Por qué un envoltorio y no un `--import`:** medido con Node 24.8, con `node --test --import=…` y con `NODE_OPTIONS=--import`, el módulo SOLO se carga en el proceso HIJO (`NODE_TEST_CONTEXT=child-v8`), nunca en el padre que imprime el resumen.

**Script:** `npm run build && node scripts/tanda-con-veredicto.mjs node --test --test-force-exit tests/*.test.mjs`. El envoltorio:
- lanza la tanda sin shell y pasa su salida tal cual;
- si calla más de `TANDA_SILENCIO_MAX_MIN` (15 min, 4,6× el peor silencio sano medido), lo dice, para SOLO su árbol y sale con **3**;
- si sale con 0 sin línea de recuento (`ℹ tests N` / `# tests N`), sale con **4**;
- en cualquier otro caso devuelve el código de la tanda;
- reenvía SIGINT/SIGTERM al hijo.

**Tests (`tests/scrum858b-la-tanda-sin-veredicto.test.mjs`, rojo comiteado antes, `153ad293`), con tandas FABRICADAS:**
- tanda muda → 3, sin `node` huérfanos. Incluye un hijo que no escribe nunca, que es el caso que distingue parar de no parar;
- 0 sin recuento → 4 (reporter a fichero, y `node -e` a secas);
- POSITIVO: la tanda sana sale igual, salida enmascarando tiempos y mismo código;
- NEGATIVO: la tanda roja da el mismo código que sin envoltorio;
- SEÑAL propagada: sólo POSIX; en Windows se salta con motivo y lo mide el CI (Linux).

**Ajustados, con su motivo:**
- `scrum708` y `scrum711` leen los patrones detrás de `--test`: el `.mjs` del envoltorio salía como «patrón de tests».
- `scrum850` nombra la forma envuelta como SANA en su control negativo.

El CI sigue con `npm test`.

**Mutantes:**
| Mutante | Resultado |
|---|---|
| M1 siempre 0 | cae NEGATIVO |
| M2 no detecta la falta de resumen | cae 0-sin-recuento |
| M3 sale 3 sin parar el árbol | **equivalente en Windows** (medido: libuv mete a los hijos en un job object que los mata al salir el padre); declarado al meta-guard, que corre en Linux, donde el hijo va `detached` y SÍ sobrevive |
| M4 708 lee tras el primer `node` | cae el lector de 708 |

M1, M2 y M3 están declarados en `MUTACIONES_QUE_ME_TUMBAN`.

**Suite completa local con `npm test` ya envuelto:** primera pasada (antes de subir el tope de 702 y sin expediente) 7.343 tests, 2 rojos, ambos de esta rama (SCRUM-702 por las dos lecturas nuevas de `process.platform` y SCRUM-854 por faltar esta entrada), y el envoltorio devolvió EXIT=1, el código real de la tanda. La repetición tras arreglar los dos se anota abajo.
