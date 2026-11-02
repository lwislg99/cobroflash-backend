# SCRUM-1620 · el meta-guard ya no cabe en su job: se reparte en partes

**Medido contra:** `origin/main` = `40986008354181a012a7f0eeb46579d0bfe7bec7` · 2026-10-27T16:14:52Z (hora de GitHub) · S3

## Lo medido (antes de tocar nada)

El coste de cada guard sale de la HORA de cada veredicto en el log del job: el tiempo entre una línea y
la anterior se le apunta al guard de la línea (la primera de cada guard lleva su limpia). Instrumento:
`evidencias/SCRUM-1620/costes-por-guard.mjs`. Su control: la suma de todos los guards tiene que dar lo
mismo que el reloj del paso, y da lo mismo en los dos runs (1692 = 1692, 1667 = 1667).

| run | commit | censo | paso | lo más caro |
|---|---|---|---|---|
| 40518576319 · job 122241583529 (ROJO) | `77ce98573` | 707 de 884, CORTE | 1692 s | `scrum710b` 135 s (8 % del total) |
| 40532410727 · job 122288498233 (VERDE) | `ce1111a68` | 886 veredictos, 222 guards, ENTERO | 1667 s de 1695 | `scrum976` 91 s · `scrum710b` 81 s |

**El verde de las 15:35Z quedó a 28 s del presupuesto.** Salidas: `evidencias/SCRUM-1620/salida-1-…` y `salida-2-…`.

### Por qué abaratar no basta

- **Es una cola larga.** En el verde: 135 guards de menos de 5 s suman 362 s; 47 de 5-10 s, 322 s; los 5
  de más de 40 s, 304 s. Dejar `scrum710b` en cero ahorraría 81-135 s: un día de censo creciendo.
- **El runner manda más que cualquier guard.** El mismo `scrum710b` costó 135 s en un run y 81 en otro;
  `ci.yml` ya lo tenía medido: el runner lento tarda un 60 % más con la MISMA población.
- Así que la vía es la 2 del ticket: **repartir**. Ni se sube el techo ni sale una mutación del censo.

### El reparto, simulado con los costes medidos

`evidencias/SCRUM-1620/simular-reparto.mjs` sobre los 222 guards del verde, en el orden del censo
(`readdirSync`, que libuv ordena con `strcmp`). Presupuesto del paso: 1800 − 105 = 1695 s.
Salida completa: `evidencias/SCRUM-1620/salida-3-reparto.txt`.

| K | reparto | peor parte | margen | con runner ×1,6: peor | margen |
|---|---|---|---|---|---|
| 2 | por turno | 995 s | 700 s | 1591 s | **104 s** |
| **3** | **por turno** | **626 s** | **1069 s** | **1002 s** | **693 s** |
| 3 | huella del nombre | 709 s | 986 s | 1134 s | 561 s |
| 4 | por turno | 503 s | 1192 s | 805 s | 890 s |

**K = 3, por turno.** K = 2 vuelve a rozar el presupuesto en un runner lento. La huella del nombre
(sha1) es estable al añadir guards pero reparte peor; por turno se recoloca con cada guard nuevo, y da
igual: cada commit tiene su reparto, y el censo entero sigue juzgándose.

## Carriles

| pieza | dueño | qué |
|---|---|---|
| `scripts/meta-guard-mutaciones.mjs` | **S3** (este PR) | corre UNA parte con `META_PARTE=i/K`; los suelos, sobre el censo ENTERO |
| `.github/workflows/ci.yml` | **S5** | la matriz de 3 partes y el job que junta su veredicto |
| `scripts/vigia-silencio-de-main.mjs` | **J6** | NADA, si el job agregador conserva el nombre, el paso y el código (abajo) |

## La mitad de S5: `ci.yml` (especificación, NO hecha en este PR)

Lo que el vigía de main de J6 lee hoy, y que por eso el job agregador tiene que conservar tal cual
(`vigia-silencio-de-main.mjs`, `JOB_META_GUARD` y `PASO_DEL_META_GUARD`): el **nombre** del job
`meta-guard · los guards caen cuando deben`, el **paso que cae** `Cada guard cae con la mutación que
declara` (y que sea el ÚNICO que cae) y el **código 2** en la anotación «Process completed with exit
code 2.». Y lo que el propio meta-guard lee de `ci.yml` (`techoDelJob`): UN solo job con la línea
`run: npm run meta:mutaciones` **exacta** — por eso la parte va por `env:`, no como argumento.

```yaml
  meta-mutaciones:                      # la clave se queda (la lee scrum935d)
    name: meta-guard · parte ${{ matrix.parte }} de 3
    runs-on: ubuntu-latest
    timeout-minutes: 30                 # NO se toca: cada parte tiene su presupuesto entero
    strategy:
      fail-fast: false                  # una parte en rojo no cancela a las otras
      matrix:
        parte: [1, 2, 3]
    steps:
      # … checkout, `main`, setup-node, npm ci, build y la marca de arranque: IGUAL que hoy …
      - name: Cada guard cae con la mutación que declara
        env:
          META_PARTE: ${{ matrix.parte }}/3
          META_SALIDA_EN: meta-partes/parte-${{ matrix.parte }}.json
        run: npm run meta:mutaciones
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: meta-parte-${{ matrix.parte }}
          path: meta-partes/
          if-no-files-found: ignore     # sin fichero, el agregador lo dice CIEGO
      # … «¿Cuánto ha tardado?», igual que hoy (ahora mide UNA parte) …

  meta-veredicto:
    name: meta-guard · los guards caen cuando deben   # EL nombre que lee el vigía de J6
    needs: meta-mutaciones
    if: always()                        # también si una parte se canceló: eso es un CIEGO, no un gris
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - uses: actions/download-artifact@v4
        continue-on-error: true         # sin artefactos, lo dice `--juntar`; este paso no puede ser el que cae
        with: { pattern: meta-parte-*, path: meta-partes, merge-multiple: true }
      - name: Cada guard cae con la mutación que declara
        run: node scripts/meta-guard-mutaciones.mjs --juntar meta-partes 3
```

`--juntar` (este PR) lee los K resúmenes y sale con el código PEOR (3 > 1 > 2 > 0). Una parte sin
resumen —cancelada, cortada por el job o sin arrancar— es **CIEGO**, nunca verde. Si las partes no suman
las declaraciones del censo, también. E imprime **el margen de la parte más lenta**, en segundos.

⚠️ Coste, para que lo pese quien decide: el repo es público y los minutos de Actions no se cobran. En
runner-minutos, 3 partes ≈ 3 × (626 + 73) s ≈ 35 min por run frente a ~29 hoy, más ~1 min del agregador;
el job deja de ocupar un runner 29 min para ocupar tres ~12.

## Lo que hace este PR (S3, `scripts/meta-guard-mutaciones.mjs`)

| pieza | qué |
|---|---|
| `parteDelEntorno` | lee `META_PARTE=i/K`; sin ella, el censo entero (local, y el CI hasta que S5 ponga la matriz). Ilegible → **CIEGO** (2), antes de tocar el árbol: correr el censo entero en cada parte sería el corte otra vez |
| `parteDelCenso` | por turno, `n % K === i - 1`, en el orden del censo. Los **suelos** del censo se aplican ANTES y sobre el censo ENTERO |
| `rotuloDeLaParte` | `parte 2 de 3: 76 de los 228 guards y 279 de las 906 declaraciones del censo · el resto lo juzgan las otras 2 partes, cada una en su job` |
| `rotuloDelResultado` | en una parte añade `· PARTE i de K (el censo entero: N declaraciones)`; sin parte, la línea de 1387d byte a byte |
| `avisoDeNoCabe` | con el corte, en CI: `::warning title=meta-guard · NO CABE en su presupuesto::…`, **el aviso que la aceptación 4 pide distinguible de cualquier otro rojo**. No contiene «Process completed with exit code», de donde el vigía de J6 lee el 2 |
| `META_SALIDA_EN` | al salir por CUALQUIER puerta deja `{parte, codigo, juzgadas, declaraciones, declaracionesDelCenso, segundos, presupuestoS}` |
| `--juntar <dir> <K>` | junta los K resúmenes: código peor (3 > 1 > 2 > 0); parte sin resumen o sin código → CIEGO; partes que no suman el censo → CIEGO; e imprime **el margen de la parte más lenta, en segundos** |

De paso: el «CIEGO impreso dos veces» que nombraba el ticket ya lo arregló #2948 (1387①), mergeado a las 17:00:26Z (`efe2cc598dabd3072b650284e5be1b4aa36a0463`).

## Verificado

- **Test nuevo** `tests/scrum1620-el-censo-por-partes.test.mjs`, 7 casos, escrito ANTES del código (rojo: «does not provide an export named 'avisoDeNoCabe'»).
- **Sus 5 mutaciones, VIVAS** con la maquinaria del propio meta-guard (`evidencias/SCRUM-1620/juzgar-guards.mjs`). La primera vez la ⑤ salió **MUDA**: un resumen sin código seguía saliendo CIEGO por otro camino y mi test no lo distinguía. Se endureció (que diga «NO DEJÓ RESUMEN» y no sume) y quedó viva. Con las de `scrum1387d` (4), `scrum812` (5) y `scrum935d` (4): **18 de 18 vivas** (`salida-9-…`).
- **Censo antes/después** (HEAD = `efe2cc598` contra el árbol, con el lector del meta-guard; `salida-8-…`): 227 → 228 declarantes, 901 → 906 declaraciones; **un solo fichero cambia, y SUBE** (el nuevo, 0 → 5). Ninguno baja.
- **Trinquete regenerado por su medida:** `SUELO_GUARD_QUE_DECLARAN` 36 → 37 en `scrum812` (su test: «LA COBERTURA HA SUBIDO a 37»), con su mutación movida a 37 → 36.
- **Los 34 ficheros de test que importan el meta-guard: 300 tests · 295 pass · 1 fail · 4 skipped.** El fallo es `scrum1321` («el temporal no se alcanza desde la raíz del repo (¿otra unidad?)»): rojo de esta máquina (temporal en C:, repo en D:), que cae igual sin este cambio.
- **Pasada real por partes en local** (`salida-4/5/6`): la parte 2/3 con `META_PRESUPUESTO_S=40` dice su parte, corta, emite el `::warning … NO CABE` y deja su resumen con código 2; `META_PARTE=4/3` sale CIEGO en 5 s sin mutar, y su resumen también queda; `--juntar` sobre esa carpeta: partes 1 y 3 «NO DEJÓ RESUMEN», «juzgadas 1 de 906», **«margen de la parte más lenta: -2 s»** (el negativo también se dice), código 2.

## El margen, con número, y cuánto aguanta

Censo de hoy: **906 declaraciones** (901 en `main` + las 5 de este PR). Coste medido: 1667 s / 886 = **1,88 s por declaración** en el runner rápido; ×1,6 en el lento. **Crecimiento medido** (`salida-7-…`, el lector sobre `main` en tres fechas): **534 (13-oct) → 615 (20-oct) → 901 (27-oct)**: +81 y **+286 la última semana**.

| K | runner | peor parte hoy | **margen hoy** | cabe hasta | a +286/sem | a +81/sem |
|---|---|---|---|---|---|---|
| 1 (hoy) | rápido | ~1705 s | **≈ −10 s** | ~901 decl. | ya no cabe | ya no cabe |
| **3** | rápido | 640 s | **1055 s** | 2.399 decl. | 5,2 sem | 18 sem |
| **3** | lento | 1024 s | **671 s** | 1.499 decl. | **2,1 sem** | 7,3 sem |
| 4 | rápido | 514 s | 1181 s | 2.986 decl. | 7,3 sem | 26 sem |
| 4 | lento | 823 s | 872 s | 1.866 decl. | 3,4 sem | 12 sem |

(Proyección: la peor parte de K = 3 y K = 4 sale de la simulación sobre los costes medidos, escalada a 906; no es todavía una pasada de CI. La primera pasada con la matriz la dará medida.)

Lo que avisa cuando vuelva a no caber: el `::warning … NO CABE` de cada parte, y antes el aviso de los 1200 s del paso «¿Cuánto ha tardado?» de `ci.yml`, que pasa a medir UNA parte. Subir K es cambiar un número de la matriz; si la matriz y `--juntar` no dicen el mismo K, las partes no suman el censo y `--juntar` sale CIEGO.

## La cola del CI (lo pidió el orquestador el 27-oct ~17:10Z)

Repartir son **más jobs en la cola, no menos**: K = 3 pasa de 1 job a 4 (3 partes + el agregador). En runner-segundos por run: hoy el job se corta en el techo, así que ya gasta ~1800 s; con K = 3, 3 × (73 + ~570) + ~40 ≈ **1970 s, un ~10 % más**, en tres runners de ~11 min en vez de uno de 30. Ese ~10 % de máquina es el precio de que el meta-guard vuelva a juzgar el censo entero.

## A9

Mi fallo de esta tanda: escribí el caso ⑤ de mi test y lo creí discriminante; el meta-guard lo dio MUDO
(un resumen sin código salía CIEGO por el mapeo de códigos desconocidos, con o sin la comprobación que
el caso decía vigilar). Ya no depende de que yo me acuerde: la mutación que lo destapó queda DECLARADA
en el propio test y la ejecuta el meta-guard en cada PR.

A9: comprobación → `tests/scrum1620-el-censo-por-partes.test.mjs`

## 29-oct-2026 ~10:00Z (hora de GitHub) · S3 · las dos puertas que el obligatorio no pasaba

La rama `de7d43ba5` llevaba desde el 27-oct con `build + tests (con banco desechable)` en rojo
(run 40551845913): `ℹ tests 12868 · pass 12857 · fail 2 · skipped 9`. Los dos rojos, medidos:

| trinquete | qué acusaba | ¿cierto? | arreglo |
|---|---|---|---|
| SCRUM-702 (tope 22, censo 23) | `tests/scrum1620-el-censo-por-partes.test.mjs` con `GITHUB_ACTIONS` | el TEXTO sí; una lectura del entorno, NO: el test le pasa a `avisoDeNoCabe` un `env` escrito a mano, y lo nombra en el `de:` de una mutación. Es el mismo caso que `scrum935d` | declarado en `scrum702`, tope 22 → 23, como pide su mensaje |
| SCRUM-737 (censo 81, hay 82) | `scripts/meta-guard-mutaciones.mjs:304` «una parte de 74 guards … un censo de 222» | sí: un recuento sin ancla, mío | opción ② de su mensaje: reformulado sin número. Control positivo: con el texto viejo, local, «HAY 82 … ESTABA EN 81» |

Sobre `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29`, fundido (merge, no rebase). Local: los 5
ficheros de las puertas, 36/36; los 53 que nombran el meta-guard, `tests 403 · pass 398 · fail 1 · skipped 4`.
El rojo es `scrum1321` (temporal en C:, repo en D:, rojo de esta máquina); los 4 saltados son SCRUM-781
(Postgres real, los corre el banco del CI).

⚠️ **Entrar este PR NO pone en verde el meta-guard de `main`.** Sin `META_PARTE` el script recorre el
censo entero como antes y se sigue cortando; ahora con el `::warning … NO CABE` en vez de una CIEGA más.
La matriz de `ci.yml` quedó revocada por el orquestador (Jira c.21171) tras la medida de S5 (c.21168).
La aceptación 1 sigue NO HECHA.

## 29-oct-2026 · S5 · SCRUM-1620b · la matriz de `ci.yml` (la mitad de S5)

**Medido contra:** `origin/main` = `b5190eedcf6165f477b23a942e3720253657aa9e` · 2026-10-29T18:28:06Z

### Por qué #2962 no curó el corte (medido antes de construir)

El log del meta-guard de `main` @ `eafca9fe154c26d38b05a748ca816ba098943724` (run 40872477063, job
123442782267, con #2962 dentro: `merge-base --is-ancestor fd24ce099 eafca9fe1` = 0) dice
«parte ÚNICA: el censo entero, 238 guards y 940 declaraciones» y corta en «Juzgadas 735 de 940
mutaciones. SIN JUZGAR 205, en 46 guard(s)», con el `::warning` NO CABE de #2962. Causa: `ci.yml` no
pasaba `META_PARTE`, así que el script corría el censo entero, como avisaba el tramo de S3 de arriba.
No era un fallo de #2962: era la mitad que faltaba. Cifra honesta de ese run: 192 guards con alguna
mutación juzgada de 238 (238 − 46), no el «238 de 1565 (15 %)» del rótulo, que es el censo.

### Lo que hace este tramo

| pieza | qué |
|---|---|
| `ci.yml` · `meta-mutaciones` | matriz `parte: [1, 2, 3]`, `fail-fast: false`, nombre `meta-guard · parte N de 3`; el paso pasa `META_PARTE=N/3` y `META_SALIDA_EN`; sube el resumen con `always()`. Techo 30 min por parte, sin tocar |
| `ci.yml` · `meta-veredicto` | nombre `meta-guard · los guards caen cuando deben` y paso `Cada guard cae con la mutación que declara` (los que lee el vigía de J6), `needs: meta-mutaciones`, `if: !cancelled()`; `--juntar meta-partes 3` y sale con SU código después de escribir el resumen |
| `scripts/meta-guard-mutaciones.mjs` | el resumen de cada parte lleva `guardsJuzgados` y `guardsDelCenso`; `--juntar` imprime «guards con alguna mutación juzgada: X de N del censo» («?» si una parte no lo dijo) |
| `tests/scrum1620b-la-matriz-del-ci.test.mjs` | 4 casos, 5 mutaciones declaradas |
| `tests/scrum812…` | suelo 37 → 38 por su medida («LA COBERTURA HA SUBIDO a 38») |

`!cancelled()` y no `always()` (que pedía la especificación de arriba): con `always()` el agregador corre
también en un run CANCELADO y lo pinta CIEGO (2) por partes que nadie dejó acabar. ⚠️ LECTURA MÍA, sin
medir: en un run sustituido el agregador saldrá `skipped` o `cancelled`; si es `skipped`, la rama
«sustituido en la cola» del vigía de J6 (`canceladoSinArrancar`) no lo reconoce y daría «sin probar».
Se mira en el primer run cancelado con la matriz, y si pasa, es de J6.

### Verificado (local, Windows)

- Base: los 4 ficheros que leen este job (1620b, 1620, 935d, 1284): 27/27.
- Mutaciones con la maquinaria del meta-guard (`evidencias/SCRUM-1620/juzgar-guards.mjs`) sobre 1620b,
  1620 y 935d: **14 de 14 VIVAS**; el árbol queda limpio.
- `guards-entrada`: 15 guards, 170/170. Los 5 de árbol entero + 812 + 702: 737 cayó por mis cifras sin
  ancla (reformuladas sin número) y 812 por la cobertura (suelo subido); después, 15/15.
- **NO HECHO aquí:** que las tres partes juzguen ≥ 940 y quepan. Lo dice la primera pasada del CI de este
  PR (línea «censo por partes: juzgadas N de M» y «guards con alguna mutación juzgada»). Si N < 940, la
  matriz no vale y se para.

## A9

Mi fallo de esta tanda: medí mi contexto tarde y lo crucé (213.878 en el jsonl) a mitad de la tarea, en
vez de medirlo tras el paso 1. Lo que lo ata ya existe (latido y la norma A19); lo que no cumplí fue
mirarlo después de cada pieza.

A9: comprobación → `tests/scrum1620b-la-matriz-del-ci.test.mjs`