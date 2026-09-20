# SCRUM-949 · El suelo como cociente, y por qué en este caso el mínimo sale 1

**Medido contra:** `origin/main` = `4a7ff1ec74c138c74d30a1c7bebc70d67a5d0d1c` · 2026-09-18T09:00:17Z

**Rama:** `scrum-949-el-suelo-como-cociente`

**Carril:** S3 (suelos e instrumentos, §11bis). ⚠️ **EXCEPCIÓN A20** para la S2, declarada por el
asesor, **sólo para SCRUM-949 y sólo el 18-sep-2026**. Consta en Jira, comentario 15892 de
SCRUM-949. El motivo es la continuidad con SCRUM-812c: la S2 vivió la reversión que explica por qué
`SUELO_GUARDS` y `SUELO_DECLARACIONES` no se tocan.

**Preámbulo (A1):** `prisma generate` con el CLI local (exit 0). `git rev-list --count
HEAD..origin/main` = **0** al ramificar, sobre `41bad7c8`. Sin `git stash` (A15). `main` avanzó 2
commits durante la tanda (SCRUM-933): integrados con `git merge origin/main`, sin tocar ningún fichero
de esta rama.

> ⛔ **No se han convertido los 496**: uno, probado, y la forma escrita. ⛔ Los **410 desnudos** quedan
> fuera. ⛔ `SUELO_GUARDS`, `SUELO_DECLARACIONES` y `ci.yml` están intactos. ⛔ Ni `src/`, ni estado o
> flag nuevo (27), ni dependencia (36).

---

## 0 · PASO 0 · la premisa sigue viva, comprobado ejecutando

El suelo de `tests/public-js-parsea.test.mjs` era `SUELO_FICHEROS = 40`. Su recorrido hoy ve **96**:
podía perder 56 ficheros sin que saltara. La tabla del §3 lo confirma ejecutando: ante una ceguera
parcial realista, el suelo **calla** con 96, 196 y 496 ficheros.

**¿Estaba MUERTO o SUSTITUIDO?** Ésta es la pregunta que ordena el ticket. Sobre la misma población
vigila otra pieza: la entrada `ficheros-js-de-public` del registro de SCRUM-810b. **No lo
sustituye**, por dos motivos:
1. Recorre `public/` con **su propia copia** del recorrido, así que si se rompe el del guard no se
   entera.
2. En CI **se salta**, porque el job `build + tests` no trae `origin/main` (SCRUM-948).

Así que estaba muerto, y nadie importa esa constante: cambiarla no le quita el control negativo a
nadie.

## 1 · ① La forma, y el caso

**La forma** (`scripts/_suelo-por-cociente.mjs`) compara dos sondas **independientes** de la misma
población:

- **VISTOS**: lo que el instrumento recorre de verdad. Es su propio colector, no una copia.
- **CENSADOS**: lo que otra fuente dice que existe.

```
cociente = |vistos ∩ censados| / |vistos ∪ censados|
```

- **El umbral sale de la población** en cada ejecución, así que crecer lo mueve solo.
- **Se cruzan CONJUNTOS, no cuentas** (A3), y el mensaje **nombra** lo que falta de cada lado, con un
  resumen por carpeta.
- **Como el denominador es la unión, ninguna sonda puede quedarse ciega en silencio.** Si el
  colector deja de ver, sobran censados; si el censo deja de ver, sobran vistos.
- **Cero entre cero da cero, no uno.** Dos sondas vacías no están de acuerdo: no han mirado.

**Por qué no es el «espejo» que descartó SCRUM-810.** Aquel ticket dijo que derivar el suelo de la
población de hoy es circular. Lo es cuando la población la mide **la misma** sonda que se vigila.
Aquí la mide otra, y la prueba de que no es un espejo es el rojo: dejar ciego al colector hace saltar
el suelo.

**Por qué este caso deja la prueba más limpia:**
- Su población es un conjunto de rutas, y eso tiene una segunda sonda **exacta**: git, preguntado
  por lo que hay **en el disco** (indexados, más los no indexados, también los ignorados, menos los
  borrados sin `git rm`).
- Nadie importa su suelo.
- Se puede probar **entero sin tocar el árbol**: se copia el instrumento real, byte a byte, a un
  árbol temporal con su propio git, y se le hace crecer, perder y quedarse ciego allí.

## 2 · ② De dónde sale el porcentaje

**El cociente mínimo es 1, y no sale de una intuición.** Sale de una construcción: la segunda sonda
ve igual que el colector **todo cambio honesto**, así que ningún cambio honesto separa las dos
sondas. Lo único que las separa es que una de las dos esté ciega. Eso está **probado uno a uno**, no
argumentado (control NEGATIVO del §4), con estos cambios:
- alta sin `git add`;
- alta con `git add`;
- borrado grande con `git rm`;
- borrado a mano;
- renombre a mano;
- `git rm --cached`;
- fichero ignorado.

**Y un cociente FIJO por debajo de 1 se midió antes de descartarlo.** Para derivarlo hacía falta una
serie, no dos puntos (la objeción de S4 en SCRUM-940). Se sacó de los **688 commits** de la historia
de `main` que tocan `public/` (`evidencias/scrum949/serie-del-historial.mjs`, salida en
`salida-serie.json`):

| | |
|---|---|
| menor coincidencia padre↔hijo, con población | **0,818** (9/11): commit `688fb6dd` del 19-may, +2 sobre 9 |
| · la misma, contando sólo desde 50 ficheros (ventana ELEGIDA, 321 commits) | **0,9775**: +2 sobre 87 |
| mayor número de ficheros que cambian en un commit (altas + bajas), con población | **2**: en 4 de los 683 commits con población · por PR, **2** en 6 de 561 |
| bajas en toda la historia | 3 commits, **ninguno** con más de una |

**Lo que dice la serie:** el cambio honesto es **absoluto y plano**, 1 o 2 ficheros por commit, igual
con 9 de población que con 96. De ahí salen los dos candidatos a porcentaje, y los dos fallan:

- **0,818 (el historial entero)**: lo fija la época en que había 9 ficheros. Hoy tolera 17 ficheros
  sin mirar.
- **0,97 (el historial desde 50)**: exige elegir una ventana (A10: una ventana fija es una tolerancia
  disfrazada). Y **envejece**: la ceguera plausible es de tamaño FIJO, mientras la población crece en
  otra carpeta.

## 3 · 🔴 La tabla que decide la forma, ejecutada

`evidencias/scrum949/el-que-decide.mjs`, salida en `salida-el-que-decide.txt`. Cada celda es el
**código de salida del instrumento REAL** en una copia, no una cuenta hecha a mano. El «cableado» es
el fichero de `origin/main` tal cual.

**Escenario ①, ceguera plausible (tiene que SALTAR).** El recorrido se estrecha a
`public/dashboard/js` y pierde `sw.js` y `public/js/*`, **3 ficheros que no crecen con el árbol**.

| suelo | P=96 | P=196 | P=496 |
|---|---|---|---|
| cableado `SUELO_FICHEROS = 40` | calla | calla | calla |
| cociente fijo 0,818 | calla | calla | calla |
| cociente fijo 0,97 | **SALTA** | calla | calla |
| **cociente 1 contra git (esta rama)** | **SALTA** | **SALTA** | **SALTA** |

**Escenario ②, borrado honesto de 1 fichero sin `git rm` (tiene que CALLAR):** calla en las 12
celdas.

**Un 0,97 ve la ceguera hoy y la pierde en cuanto crece la población:** a partir de 100 ficheros,
cuatro más de los que hay. Es el mismo defecto con otra sintaxis, el que el control que decide venía
a cazar.

> ⚠️ **Lo que SÍ es juicio mío, y lo digo:** que «estrechar el recorrido a `dashboard/js`» sea la
> ceguera PLAUSIBLE. No está medido que vaya a ocurrir. Lo que está medido es la estructura (93 · 2 ·
> 1) y que esa pérdida no crece con el árbol. Si la ceguera real fuera siempre proporcional, un
> cociente fijo bastaría. Con 1, no hay que acertar cuál es.

## 4 · Los controles, en `tests/scrum949-el-suelo-como-cociente.test.mjs` (10 tests, dentro de `npm test`)

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** · copia con 96 ficheros → **+100** (50 indexados, 50 sin `git add`) | umbral 96 → **196 solo**. El instrumento es **byte a byte** el mismo. Con 196, la ceguera plausible **sigue saltando** y nombra los 3 |
| 🔴 **ROJO** · el recorrido deja de bajar a subdirectorios | salta: «el RECORRIDO no ve 95 — por carpeta: `public/dashboard/js/` 93 · `public/js/` 2», y los nombra |
| 🔴 **ROJO** · el censo se estrecha a `public/js` | salta: «el CENSO no tiene 94». Ninguna sonda se queda ciega en silencio |
| 🔴 **sin git** (`GIT_DIR` a una ruta que no existe) | **ROJO con CIEGO, no un salto**: un salto sale 0, que es el defecto de SCRUM-948 |
| ✅ **POSITIVO** · el árbol de hoy, intacto | verde, y **declara su población**: `población 96 (recorrido 96 · censo 96) · de acuerdo 96 · cociente 1.0000 · mínimo 1 → umbral 96` |
| ✅ **NEGATIVO** · un borrado a mano, sin `git rm` | calla (95 / 95) |
| ✅ **NEGATIVO** · todos los cambios honestos a la vez | calla (69 / 69 / 69 / 69) |
| **MUTACIÓN** · las 6 declaradas, con el bucle del meta-guard (`evidencias/scrum908b/banco-908b.mjs`) | **6/6 VIVA**, dos veces (antes y después de reescribir los ayudantes del §7) · árbol restaurado, `git status` idéntico antes y después |

Entre las mutaciones hay dos que demuestran algo:
- **La nº5 sube `COCIENTE_MINIMO` a 0,97**, y la tumba el control que decide. Es la tabla del §3
  hecha test.
- **La nº6 desactiva el aserto del instrumento real**, y la tumba el rojo. Prueba que los controles
  de la copia ejercen **el instrumento de verdad**, no uno de mentira.

## 5 · Lo que esto NO cubre

1. **Sólo vale para poblaciones de ficheros.** Una población que no es un conjunto de rutas
   (declaraciones, rutas del router, tests de un TAP) necesita su propia segunda sonda, y su propia
   derivación del mínimo. **Para ésas, la serie de este ticket es el método**, y su primer resultado
   avisa: si el cambio honesto de esa población también es absoluto, un porcentaje fijo envejecerá
   igual.
2. **Si las dos sondas se quedan ciegas de la misma forma, no se ve.** Son mecanismos independientes
   (`readdirSync` y el índice y el recorrido de git), pero no es imposible.
3. **El censo de SCRUM-940 leerá este suelo como «declarado 1».** Su clasificador (`clasificar`,
   pensado para números fijos) lo llamaría AJUSTADO, y no lo es: no salta con cambios honestos (§4).
   Le falta una clase para los suelos derivados. **No se toca aquí**: es su instrumento.
4. **El trinquete de SCRUM-810b sobre esta misma población sigue saltándose en CI.** Es SCRUM-948 y
   espera al fundador.

## 6 · Hallazgos que se reportan y NO se arreglan (A7, regla 37)

1. 🔴 **`scripts/_censo-de-suelos.mjs`: `magnitudDeListaFija` es SIEMPRE `false`.** La línea
   `new RegExp('\b' + n + '\b')` lleva `'\b'` en una cadena, y en una cadena de JavaScript eso es un
   RETROCESO (0x08), no un límite de palabra.
   - **Reproducido** con una lista fija sintética (`CONOCIDOS.length >= CENSO_MIN`): sale `false`.
   - En disco hay 0 bytes 0x08, así que el guard de A22 no puede verlo: el carácter lo fabrica el
     intérprete.
   - **Víctima:** la clase `LISTA_FIJA` no se alcanza nunca. Las tres acusaciones en falso que S4
     cazó a mano en SCRUM-940 las repetiría el código.
   - **Carril:** S3/S4 (su instrumento). **Siguiente acción:** `'\\b'`, con un test que ponga una
     lista fija delante.

## 7 · Lo que me salió mal (A9)

1. **Mi serie resolvía `origin/main` dos veces**, al arrancar y al terminar. A mitad de la pasada otra
   sesión hizo `fetch` (los refs se comparten entre worktrees), y `main` pasó de `41bad7c8` a
   `4a7ff1ec`. Esta vez los 2 commits nuevos no tocaban `public/`, pero la cabecera habría citado una
   punta distinta de la medida. **Lo cazó la tabla del §3**, que imprimía otro SHA. Arreglado: el SHA
   se fija una vez; la pasada vieja se paró y se repitió.
2. **La primera ejecución de mis controles dio 2 rojos, y los dos eran del banco:**
   - La lista de nombres cortada en 40 escondía `public/js/`. De ahí salió el resumen por carpeta,
     que es mejor mensaje.
   - `git rm` se negaba a borrar en una copia sin commits; se arregló con `-f`.

   Ninguno era del instrumento, y los dos se leyeron por su mensaje antes de tocar nada.
3. **Escribí un carácter invisible raro (`U+FE7E`) dentro de una regex** del último test. Lo vi al
   releer, antes de ejecutar, y la aserción se quitó. Tras escribir se hizo el recuento de bytes de
   control (A22): **0** en los cuatro ficheros. Los dos `U+FE0F` que salen son el selector de «⚠️».
4. **`$TMPDIR` está vacío en este shell**, y el primer log de `prisma generate` apuntó a `/`: exit 1,
   y no llegó a correr. Se repitió con el scratchpad (exit 0).
5. 🔴 **Mi propio comentario reprodujo el defecto que el ticket viene a cerrar.** En
   `public-js-parsea.test.mjs` escribí «3 ficheros… a partir de 100 ficheros»: cifras del árbol, a
   mano y sin ancla. Lo cazó SCRUM-737 en la primera tanda completa (81 → 83 cifras sin ancla). Se
   reformuló sin números, que es la opción ② de su propio mensaje. El guard no se tocó (regla 41).
6. **Mi test creaba ficheros en un `dir` que llegaba como PARÁMETRO**, y el censo de SCRUM-824 no
   podía probar que colgara de `os.tmpdir()`. Lo dijo en la misma tanda. Se reescribió con cierres
   sobre `const dir = temporal(…)`, y ahora el censo lo prueba. `SIN_PROBAR_CONOCIDOS` no se tocó.
7. **Pasé a `node --test` un fichero que no existe** (un nombre de test de SCRUM-737 mal
   recordado), y salió **0 con «19 pass»**: el patrón que no casa con nada se ignora en silencio. Lo
   cazó el recuento, 19 = 10 + 9 de los otros dos ficheros, no el código de salida. Se repitió con el
   nombre real (32/32).
8. **Mi primera idea fue derivar el porcentaje del historial entero (0,818).** Era la más «limpia»
   (sin parámetros) y la tabla del §3 la deja en *calla · calla · calla*. Habría entregado un suelo
   tan muerto como el que venía a sustituir para la ceguera que importa, y con una derivación
   impecable.

## 8 · Ficheros

| fichero | qué |
|---|---|
| `scripts/_suelo-por-cociente.mjs` | la forma: `censoDeGit`, `medirCociente`, `explicarCociente`, `poblacionDeclarada` |
| `tests/public-js-parsea.test.mjs` | el único caso convertido. El test de SUELO conserva su nombre |
| `tests/scrum949-el-suelo-como-cociente.test.mjs` | los controles sobre el instrumento real, y 6 mutaciones declaradas |
| `tests/scrum810b-los-suelos-derivados.test.mjs` | la anotación `suelo:` que citaba el número viejo |
| `docs/master/evidencias/scrum949/serie-del-historial.mjs` · `salida-serie.json` | la serie de 688 commits |
| `docs/master/evidencias/scrum949/el-que-decide.mjs` · `salida-el-que-decide.txt` | la tabla del §3 |
