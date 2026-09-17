# SCRUM-866 · La mutación no caía por DOS motivos, y reapuntarla sólo arregla uno

**Fecha:** 17-sep-2026 · **Carril:** B · instrumentos · **Gate:** arreglo de la muda + censo
**Medido contra:** `origin/main` = `018d18075c4aefb276dd21a47e1ba2186be630ad` · 2026-09-17T08:07:12Z
**Rama:** `scrum-866-la-mutacion-que-no-podia-caer`
**Preámbulo (A1):** `git rev-list --count HEAD..origin/main` = **0** tras mergear.

> **Obligación 0:** sin rama remota `scrum-866*`, sin expediente. El único commit que la nombra
> —`f0346f81`— es trabajo de **SCRUM-868** que sólo la cita al corregir una cifra. Causa **(a)**.
>
> ⚠️ Dos coincidencias descartadas antes de afirmarlo, porque las dos decían «866» y ninguna lo
> era: la rama `scrum-650-microcopy-aprobada` (su **sha** contiene `8721`… y el mismo filtro con
> `872` mordió igual) y `Merge pull request #872`, que es número de **PR**.

---

## 🔴 LO PRIMERO: MAIN YA TRAE UN ARREGLO DE ESTO, Y NO QUITA LA MUDEZ

Mientras este ticket estaba en curso entró en `main` el commit **`9f396783`** — *«SCRUM-859: la
mutación #2 del meta-guard apuntaba al fichero equivocado»* (SCRUM-839e, Claude Sonnet 5 vía el
bot). **Su diagnóstico es correcto** y coincide con el de este encargo: el test no llamaba a
`entradasTroceadas()`, usaba su propia copia local. Reapuntó la mutación a esa copia, con dos
líneas de contexto para no caer en la ocurrencia de `entradasReales()`.

**Medido hoy, con el instrumento de la casa, sobre el MISMO árbol mergeado y en la misma sesión:**

| versión | veredicto de `meta:mutaciones` |
|---|---|
| **main hoy** (`9f396783`) | **MUDA** |
| **esta rama** | **VIVA** |

```
linea base · pasados=20 caidos=0 · el test nombrado aparece EN VERDE: true
  → con los ficheros de origin/main:  MUDA · «el guard NO cayó»
  → con los de esta rama:             VIVA
```

La línea base es la misma y es válida en los dos casos (20 pasados, 0 caídos), así que la
diferencia es el arreglo y no el árbol.

> ⚠️ **Y su mutación tiene además un defecto propio que no cambia el veredicto pero conviene
> decir:** `a: "… const id = String(e.indice) …"`, y `e.indice` **no existe** en esos objetos —el
> `map` es `(e) => {}`, sin índice—. Todas las claves quedarían en `"undefined"`. No es la clave
> posicional que dice ser; y el aserto tampoco lo habría visto, que es el punto siguiente.

**El conflicto del merge se resolvió CONSERVANDO su hallazgo y acreditándolo**, con la medición de
por qué no bastaba pegada al lado. Lo que encontraron no se borra.

---

## ② ¿DESDE CUÁNDO? — NACIÓ MUDA, Y 17 MINUTOS DISFRAZADA DE CIEGA

No hay fecha en que dejara de caer, porque **nunca cayó**. Derivado del árbol, sin inventar sha:

| commit | hora | qué decía el meta-guard |
|---|---|---|
| `95016e56` | 15-sep 15:55 | **CIEGA** — `cae` era `'🔴 insertar una entrada NO puede desplazar ninguna clave'`, una frase descriptiva que no nombra ningún test |
| `b676ec8d` | 15-sep 16:12 | **MUDA** — `cae` corregido al título real; ya evaluable, y no cae |

En **los dos** commits el test ya traía su `claves()` privado, **3** copias de la línea derivadora
dentro y el mismo aserto débil:

```
$ git show 95016e56:tests/scrum859-…  | grep -c "const claves = (t) => {"                  → 1
$ git show 95016e56:tests/scrum859-…  | grep -c "const id = identidadDeEntrada(e.tituloC…"  → 3
```

Esto corrige de paso lo que yo mismo declaré no haber medido al entregar SCRUM-554: **el rojo de
`meta:mutaciones` es anterior a aquella rama**, del 15-sep. Confirmado además por un tercero:
`f0346f81` dice *«la muda es de scrum859, ya en main antes de ese merge (su run sobre `3e5f58db`
dio 194 · 1 · 0)»*.

---

## ① EL ARREGLO — por el orden mandado, y con las dos mitades

El encargo manda intentar **primero que CAIGA**, y que si el test tiene su propia copia del
troceador el arreglo sea *que el test ejecute el código real*. Eso es correcto **y no basta**, y
está medido antes de escribir nada:

### La mitad que faltaba: el aserto no podía fallar

Con el ancla en la **línea exacta que el test ejercita**, el test **seguía pasando**. El motivo no
es el ancla:

```js
const perdidas = antes.filter((c) => !despues.includes(c));
assert.deepEqual(perdidas, []);
```

Reproducido el experimento del propio test con las dos formas de clave, sobre el fichero real:

| clave | entradas | `perdidas` (lo ÚNICO que miraba) |
|---|---|---|
| por **identidad** (lo bueno) | 7 → 8 | **0** |
| por **posición** (la mutación) | 7 → 8 | **0** |

Con claves `0..N-1`, al insertar una entrada quedan `0..N`: el conjunto **crece y no pierde nada**.
Vale para cualquier renumeración densa, así que **ninguna mutación posicional podía tumbarlo, en
ningún punto**. Mirar si la CADENA de la clave sigue en la lista no es mirar si sigue señalando
**la misma entrada** — que es justo lo que dice el nombre del test.

> 🔒 **Mover una clave no es que desaparezca: es que pase a nombrar a otra.**

### Las dos mitades del arreglo

1. **Una sola derivación.** `entradasConClave(nombre, texto)` en `tests/scrum267-…`, que usan
   `entradasTroceadas()`, `entradasReales()` y el test. Se van **las dos copias privadas** de
   `scrum859`. No es un guard que vigile que no diverjan —ése es el escalón de abajo—: es que ya
   no hay copias que puedan diverger.
2. **El aserto que sí ve el defecto.** Compara **a qué entrada apunta cada clave**, no si la
   cadena sigue en la lista. Se conserva el aserto viejo como primera mitad («ninguna clave
   DESAPARECE»), porque sigue siendo verdad y su mensaje distingue los dos fallos.

Y por eso **el ancla vuelve a `scrum267`**: ya no hay copia a la que reapuntar. La sangría baja de
6 a 4 espacios porque el código salió de un `flatMap` anidado — **el ancla se re-mide cuando el
código se mueve; heredarla es cómo nacen las que no casan**. La mutación usa `vistos.size` y no un
índice del `map`: da la clave posicional `0,1,2…` sin tocar la firma de la función real (una
mutación que además cambiara la firma mediría dos cosas).

---

## ④ LOS CONTROLES, EJECUTADOS

### Las dos mitades, o no es un control

| | resultado |
|---|---|
| **sin** la mutación | `20 pass · 0 fail` |
| **con** la mutación | **`not ok 17`** |

Y cae **por donde debe**, no por un error accidental:

```
🔴 insertar una entrada ha MOVIDO estas claves a OTRA entrada:
  SCRUM-244.md#1
      antes → SCRUM-244 · punto 3 (parte 1 de 2): EL REGISTRO de que se ejerció el derecho
      ahora → SCRUM-244 · entrada INSERTADA por el control de SCRUM-859
  SCRUM-244.md#2
      antes → SCRUM-244 · punto 2: LA COBERTURA — «dame TODO lo mío», derivado y no enumerado
      ahora → SCRUM-244 · punto 3 (parte 1 de 2): EL REGISTRO de que se ejerció el derecho
  … (cinco en total)
```

### 🔴 CONTROL NEGATIVO OBLIGATORIO

*«Una negación sin prueba de que lo negado puede ocurrir es un verde permanente.»* Se rompió **a
mano y en el fichero** —ejerciendo el camino entero, lector incluido— la OTRA mutación de este
guard, que está viva:

```
── ① ESTADO REAL           VIVA · INVISIBLE_HASTA_859 está cerrado en CINCO
                           VIVA · insertar una entrada en medio NO mueve ninguna clave
── ② SE ROMPE A MANO       la rotura ENTRÓ: 8e93d2fe… → 5b9c0a6e…
                           VEREDICTO: MUDA
── ③ SE DESHACE            restaurado byte a byte: true
                           VEREDICTO tras deshacer: VIVA
✅ viva → rota → deshecha :  VIVA → MUDA → VIVA
```

> ⚠️ La rotura cambia **bytes** pero no comportamiento (`= 5;` con un comentario detrás). Tenía que
> ser así: el meta-guard sale **CIEGO —no mudo—** si la mutación no cambia el fichero, de modo que
> una rotura que no tocara bytes no habría probado nada.

### SUELO

No se afirma: se ejerce sobre las funciones puras del meta-guard.

```
sueloDelCenso({guards:0, declaraciones:0})  → "EL CENSO HA ENCOGIDO: 0 guards y 0 declaraciones…"
sueloDeEjecucion({vivas:0, mudas:0})        → "NO SE HA EJECUTADO NI UNA MUTACIÓN. Este exit no
                                               dice que los guards estén vivos: dice que no he
                                               medido nada."
sueloDeEjecucion({vivas:N, mudas:1})        → null   (hay medición: el suelo no salta)
```

---

## ③ ¿CUÁNTAS CAEN POR EL SITIO QUE DICEN?

Evidencia: `docs/master/evidencias/SCRUM-866/censo-866.mjs` + `espia-lecturas.mjs`, salida íntegra
en `salida-censo-866.txt`. El lector de declaraciones **no se reescribe**: se importa
`censoDeDeclaraciones` del meta-guard — un tercer lector que cuente distinto es el defecto que este
ticket persigue.

**POBLACIÓN: 227 mutaciones declaradas en 72 guards.** (SCRUM-836d censó 178; el árbol dice 227
hoy. Se mide contra el número del árbol, no contra el del enunciado — y se declara la población,
no sólo el resultado.)

**El criterio:** se corre **sólo el test que la declaración nombra** (`--test-name-pattern`) y se
pregunta si la mutación puede alcanzarlo por el punto declarado. Dos vías legítimas, y las dos
cuentan: **ejecutar** la línea (cobertura por test) o **leer** el fichero (media casa son guards
estáticos que asertan sobre el texto; se espían las lecturas reales de `fs`, no se adivinan con un
grep).

🔴 **No vale la cobertura por fichero, y este ticket lo demuestra:** al correr `scrum859` se importa
`scrum267`, cuyos propios tests SÍ recorren la línea. A nivel de fichero habría salido «cubierta» —
y era justo la que no pasaba por ahí.

| | n |
|---|---|
| ✅ la mutación **alcanza** a su test por el punto declarado | **204** |
| · ejecutando la línea | 122 |
| · leyendo el fichero (guards estáticos) | 82 |
| 🔴 **NO RECORRE** el punto | **0** |
| ⚠️ **NO CLASIFICADAS** (cuentan del lado malo) | **23** |
| · objetivo en `src/`: se ejecuta `dist/` y las líneas no se corresponden | 22 |
| · el objetivo no es código cargable por Node (`.gitattributes`, lo lee git) | 1 |
| **LADO MALO** | **23** |
| | **227 de 227 ✅ cuadra** |

### 🔴 CUATRO CEGUERAS DE MI PROPIO INSTRUMENTO, Y LAS CUATRO HABRÍAN ACUSADO EN FALSO

Esto es la parte instructiva, y va escrita porque el ticket trata exactamente de esto: un
apuntador que señala donde no mide.

| # | habría reportado | causa real |
|---|---|---|
| 1 | **3** «no recorre» | guards **estáticos**: leen el fichero con `readFileSync` y asertan sobre el texto |
| 2 | **98** no clasificadas | Node **excluye los ficheros de test** de la cobertura por defecto → lcov vacío |
| 3 | **1** «no recorre» | el test mide en un **proceso nieto** (`scrum750` arranca una sonda en otra zona horaria) |
| 4 | **1** «no recorre» | el fichero lo lee **git**, no Node (`.gitattributes` vía `execFileSync`) |

**Cómo se destapó la nº2, que es la que vale:** mi propia mutación de `scrum859` salió
«NO CLASIFICADA en 0,2 s» **justo después** de haberla medido cayendo. Dos cosas que no pueden ser
ciertas a la vez — y gana el instrumento sólo DESPUÉS de comprobar el instrumento. Las otras tres
se cayeron al abrir el caso concreto antes de publicarlo, no después.

La nº3 se cerró midiendo, no razonando: propagando el espía a los nietos con `NODE_OPTIONS`, las
lecturas del módulo mutado pasan de **0 a 1**.

> ⚠️ **El límite que queda declarado:** «lee el fichero» no prueba que mire **esa** línea. Para las
> 82 de esa vía la respuesta honesta es *«la mutación puede alcanzarle»*, no *«le alcanza seguro»*.

### ¿UN CASO O UNA CAPA?

**Un caso.** Cero apuntan hoy a un sitio que su test no recorra, y las 23 del lado malo lo están
por límites del criterio, no por un defecto medido en ellas. Pero la **forma** que lo permite sí es
una capa fina y se nombra sin arreglarla (regla 9): un censo estático aparte encontró **5**
declaraciones cuyo texto anclado existe **también dentro del fichero del propio test** —
`scrum750`, `scrum751` (×2), `scrum775` (×2)— y **1** con el ancla no única en su fichero
(`scrum767`, ×2 apariciones; `replace` coge la primera). Las seis tumban lo suyo hoy: es forma, no
defecto. Eran **6** antes de este ticket; `scrum859` sale de la lista al dejar de tener copia.

---

## LA TANDA

```
META-GUARD:  08:07:09 → 08:21:39 UTC · 227 mediciones
             vivas 227 · mudas 0 · ciegas 0 · rc=0
ARBOL QUIETO DESDE: 08:23:10 UTC
ARBOL QUIETO HASTA: 08:27:05 UTC
# tests 7188 · # pass 7078 · # fail 0 · # skipped 110
```

`npm run guards:entrada`: 26 tests, 0 fallos, `# skipped 0`.

> ⚠️ **La única edición posterior a la tanda son las cifras de este bloque**, sustituidas en este
> fichero de texto; después se relanzaron `guards:entrada` y `scrum854`. Ni una línea de código
> cambió después de la hora de arriba.
>
> ⚠️ `origin/main` avanzó **149 commits** durante el ticket, y uno de ellos tocaba el fichero
> central. Se mergeó, se resolvió el conflicto a mano y se volvió a medir todo contra el árbol
> resultante. La población de mutaciones subió de 209 a **227** por ese merge.

---

## LO NO TOCADO

- **`scripts/meta-guard-mutaciones.mjs`: ni una línea.** No se relaja ni se sube ningún tope (41);
  `SUELO_GUARDS` y `SUELO_DECLARACIONES` quedan como estaban. Silenciar la muda no era una salida
  y no se ha usado: la declaración **sigue en pie** y ahora tumba lo suyo.
- **Las 5 declaraciones con la forma de riesgo, y `scrum767`: ni una línea.** Nombradas arriba;
  tumban lo suyo hoy.
- `src/` intacto · ningún estado ni flag nuevo (27) · ninguna dependencia (36) ·
  `prisma/schema.prisma`, el camino de emisión fiscal y el copy, intactos · nada de producción ni
  de staging · `git stash` no usado · historia no reescrita.
