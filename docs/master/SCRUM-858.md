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
