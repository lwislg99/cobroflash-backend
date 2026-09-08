# SCRUM-754 · El juez que oscila: reproducido, y la avería era peor de lo que decía el ticket

**Fecha:** 7-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — el guard corre en `npm test`
**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T18:56:51+02:00
**Worktree:** b5 · Windows 11, Node v24.18.0 · cinco sesiones más vivas al lado

> El ticket pedía, en este orden: **reproducirlo**; entender por qué la línea base salía CIEGA la
> primera vez y no las otras tres; y **descartar midiendo** —no deduciendo— que la medición se
> contaminara con escritura en `tests/` en paralelo.
>
> Está **reproducido**. La hipótesis del comentario era la buena. Y el hallazgo se movió de sitio
> exactamente como el ticket anticipaba, sólo que a un sitio peor: el instrumento no sólo
> enmudecía — **firmaba verdes falsos**.

---

## ① EL SUELO PRIMERO: en árbol quieto NO se reproduce, y se dice

Cinco líneas base consecutivas de `scrum751` en frío, árbol quieto (7-sep-2026, 07:09:13→07:10:46):

```
pasada 1: 11.9s · pasados=3 caidos=0 · PUERTA1=VERDE
pasada 2: 20.3s · pasados=3 caidos=0 · PUERTA1=VERDE
pasada 3: 20.2s · pasados=3 caidos=0 · PUERTA1=VERDE
pasada 4:  9.6s · pasados=3 caidos=0 · PUERTA1=VERDE
pasada 5: 29.3s · pasados=3 caidos=0 · PUERTA1=VERDE
```

**La anomalía NO va con «la primera vez».** No hay caché, ni `dist/` que se compile al vuelo, ni
temporal que la primera pasada cree y las siguientes reusen: el meta-guard **no compila nunca**
(ya medido en SCRUM-763) y la marca de SCRUM-808 se borra en cada mutación. Lo que sí se ve en
esos números es la **varianza de reloj** —9,6 s a 29,3 s con cinco sesiones al lado—: no es la
causa, pero es lo que abre y cierra la ventana en la que la causa muerde.

---

## ② EL SUJETO: por qué las DOS declaraciones salían CIEGAS a la vez

`scrum751-clave-duplicada-en-silencio.test.mjs` declara **exactamente dos** mutaciones, las dos
sobre `tests/scrum402-marcador-no-se-pinta.test.mjs` y las dos nombrando **el mismo test**:
«NINGÚN objeto literal del árbol repite una clave». Comparten PUERTA 1, y PUERTA 1 se contesta con
una sola pasada limpia: por eso caen **juntas**, que es la firma que describe el ticket.

Y ese test **barre el árbol entero** —`tests/`, `scripts/`, `src/`, `public/`, `prisma/`— con
`readdirSync` y luego `readFileSync` fichero a fichero. Entre los dos hay un hueco. Si en ese
hueco un fichero se esfuma: `ENOENT` → `ilegibles` → `assert.deepEqual(ilegibles, [])` en rojo.
El test se cae **por algo que no tiene nada que ver con la mutación**.

🔴 Es la clase que **SCRUM-740 ya cerró** para seis barredores con `_barrido-estable.mjs`
(`leerSiSigueAhi` + `exigirCorpusLeido`). `_claves-duplicadas.mjs` (SCRUM-751) nació después y
**no la adoptó**.

---

## ③ REPRODUCIDO — provocando, no esperando

Agitador: un proceso aparte que crea y **borra** en bucle apretado un `.mjs` **sin ningún
defecto** dentro de una carpeta. No introduce claves duplicadas ni toca nada del árbol.

### El mecanismo, con su contraste (dos rondas, 07:12:52→07:14)

| brazo | PUERTA 1 |
|---|---|
| A · árbol quieto | VERDE · VERDE |
| B · agitando `tests/` | **ROJO · ROJO** — `ilegibles: tests/_sonda754-agitador-N.mjs` |
| C · agitando `docs/` — que ese escáner **no** barre | VERDE · VERDE |

C es lo que hace legible a B: si el rojo saliera también agitando algo que el escáner no lee, el
detector de causa sería el que miente.

### El veredicto real (07:15:48→07:17:26)

| # | caso | veredicto |
|---|---|---|
| ① | las DOS declaraciones reales, árbol **quieto** | **VIVA · VIVA** |
| ② | las MISMAS dos, árbol **moviéndose** | **CIEGA · CIEGA** ← la oscilación del ticket |
| ③ | control positivo: guard **realmente mudo**, quieto | **MUDA** |
| ④ | control positivo: declaración que no se puede juzgar | **CIEGA** |
| ⑤ | el mudo de ③, con el árbol moviéndose | **CIEGA** — la agitación **tapa** la mudez |

Mismo fichero, mismas dos declaraciones, nada cambiado entre medio, veredicto distinto. Y ③ y ④
dicen que no se ha desactivado nada.

---

## ④ 🔴🔴 LO QUE EL TICKET NO CONTEMPLABA: EL VERDE FALSO

②y⑤ ensucian por el lado seguro. Faltaba preguntar por el otro. Receta: **línea base EN QUIETO**
—así PUERTA 1 pasa— y la agitación entrando **sólo durante la pasada mutada**, con una mutación
que **NO introduce el defecto**; o sea, un guard que tiene que salir **MUDO**. 07:18:25→07:18:49:

```
intento 1: VIVA  🔴🔴 VERDE FALSO (colaterales 0)
intento 2: MUDA
intento 3: VIVA  🔴🔴 VERDE FALSO (colaterales 0)
intento 4: VIVA  🔴🔴 VERDE FALSO (colaterales 0)
recuento: {"VIVA":3,"MUDA":1}   (el correcto es MUDA en los cuatro)
```

**Tres verdes falsos de cuatro.** El meta-guard firmaba como VIVO a un guard que no cayó: el test
declarado sí estaba entre los caídos, pero se había caído por el `ENOENT` del barrido, no por la
mutación. `cayo()` lo veía caído y no tenía forma de saber otra cosa. Y con **`colaterales 0`**,
así que ni la instrumentación de SCRUM-784 lo insinuaba.

> Un verde falso es peor que cualquier CIEGO: el CIEGO manda a alguien a mirar; el verde falso
> cierra el asunto. Y toda entrega de la casa se apoya en un «vivas N · mudas 0».

---

## ⑤ EL ARREGLO — que el juez sepa decir que NO PUEDE JUZGAR

`scripts/_arbol-quieto.mjs` (nuevo) + tres enganches en `meta-guard-mutaciones.mjs`.

**⛔ NO se toca `cayo()`, ni `murioElFichero()`, ni `MUERTE_CUENTA_COMO`.** Lo que cambia es el
**orden en que se les pregunta**, no lo que contestan. `cayo()` sigue exigiendo el nombre
declarado, ni uno más.

### Por qué NO vale una huella antes/después

Medido: el agitador crea y borra en bucle, así que en las dos fotos el fichero está **ausente**.
Una huella antes/después habría dicho «árbol quieto» sobre la pasada que fabricó los tres verdes
falsos: habría sido **un detector mudo dentro del arreglo de un detector mudo**. Hay que observar
**DURANTE** — `fs.watch` recursivo, que en esta máquina ve los 8 efímeros del agitador.

### Lo que `fs.watch` dice de más, y por qué decide el disco

En Windows **leer** un fichero emite `change` (libuv pide también `LAST_ACCESS`). Censado sobre los
48 guards del meta-guard corriendo **solos**: 7 «movían» el perímetro y los 7 movían **únicamente
`dist/`**, que es de donde importan. Si eso contara como movimiento, siete guards sanos saldrían
CIEGOS y el instrumento quedaría apagado por el otro lado.

| estado del candidato | veredicto |
|---|---|
| ya no está | MOVIMIENTO (lo borraron, o fue transitorio) |
| está y su `mtime` es posterior al arranque | MOVIMIENTO (lo escribieron mientras medía) |
| está y su `mtime` es anterior | **fue una LECTURA. No es movimiento.** |

### Las tres puertas

- **PUERTA 0** — línea base tomada sobre un árbol movido: **no se muta nada**, CIEGO nombrando qué
  se movió. Va antes de PUERTA 1 porque PUERTA 1 *lee* la línea base.
- **PUERTA 3** — pasada mutada sobre un árbol movido: CIEGO **antes** de preguntar a `cayo()`, y el
  mensaje dice qué habría salido sin ella.
- **SUELO ③, en el arranque** — control positivo de la propia vigilancia sobre el árbol REAL: se le
  enseña un fichero que nace y muere dentro de `tests/` y se le exige verlo; y la otra mitad, que
  **no** cuente una lectura como movimiento. Si falla: **CIEGO y salida 2**.

Perímetro: `tests, scripts, src, public, prisma, docs, dist`. **`dist/` entra a propósito** y
cierra un hueco DECLARADO en SCRUM-763: allí quedó escrito que «una sesión que corriera la suite
entre dos pasadas curaría el árbol sin darse cuenta —eso no está medido—», porque `npm test`
empieza por `npm run build`.

### En los dos sentidos, con las mismas sondas

| # | caso | ANTES | DESPUÉS |
|---|---|---|---|
| ① | dos declaraciones reales, quieto | VIVA · VIVA | **VIVA · VIVA** (no se ha desactivado) |
| ② | las mismas, árbol movido | CIEGA · CIEGA *(motivo falso)* | **CIEGA · CIEGA** *(«SE MOVIÓ BAJO MIS PIES» + el fichero)* |
| ③ | guard realmente mudo, quieto | MUDA | **MUDA** |
| ④ | declaración injuzgable | CIEGA | **CIEGA** |
| 🔴 | **verde falso** | **VIVA 3 de 4** | **CIEGA 6 de 6** |

El veredicto correcto de la última fila **en quieto** es MUDA, y ③ demuestra que lo sigue dando.
Con el árbol moviéndose **no se puede medir**: el arreglo no convierte el verde falso en el
veredicto bueno — lo convierte en **una negativa a firmar**.

---

## ⑥ TRES AVERÍAS APARECIERON AL MEDIR EL ARREGLO, Y LAS TRES LAS CAZÓ EL PROPIO INSTRUMENTO

### (a) El guard se cazó a sí mismo

La primera versión de `tests/scrum754-…` corría su control positivo **en vivo sobre `RAIZ`**: crea
y borra su sonda dentro de `tests/`. El meta-guard sacó **las cuatro declaraciones CIEGAS**
(`línea base 7✔/0✖ · movidos 1 → tests/.quietud-sonda-…`).

**Eso no es un fallo de PUERTA 0: es PUERTA 0 funcionando.** Un guard que escribe dentro del
perímetro mientras se le mide no se puede medir. Lo que sobraba era el SITIO: ahora el mecanismo
se prueba sobre una raíz temporal, y la prueba sobre el árbol REAL la hace el juez en su arranque,
que es el único momento en que no está midiendo a nadie.

Y una segunda del mismo caso: la mitad «no inventa» usaba `package.json` como «fichero de antes», y
en una raíz recién creada acababa de escribirse → caía dentro de la ventana. Lo cazó el propio test
saliendo rojo diciendo que la vigilancia «inventa». **Lo inventado era la medición.**

### (b) 🔴 El corte por reloj estaba mal el 97,5 % de las veces

| criterio | falsos POSITIVOS | falsos NEGATIVOS |
|---|---|---|
| `mtimeMs >= Date.now()` | **390 de 400** (desfase hasta **+1,76 ms**) | 0 |
| referencia tomada del sistema de ficheros | 0 de 400 | **211 de 400** |
| `Date.now() + 25 ms` | **0 de 200** | **0 de 40** (movimientos a 150 ms) |

`Date.now()` entrega milisegundos ENTEROS y `mtimeMs` trae fracción, así que un fichero escrito un
instante ANTES sale «después». La alternativa de tomar la referencia del propio sistema de ficheros
falla por el otro lado, porque dos escrituras seguidas comparten marca: granularidad medida aquí,
salto mediano 1,0 ms y **máximo 4,0 ms** (1.337 escrituras, 553 marcas distintas).

De ahí sale `MARGEN_MS = 25` —~6× la mayor de las dos—, con **suelo (≥10) Y TOPE (≤100)**: el
margen es tiempo en el que NO se vigila, y subirlo «por si acaso» es la forma barata de que un rojo
incómodo deje de salir.

### (c) 🔴🔴 Y la de verdad: una pasada le quitaba la mutación a otra EN VUELO

La primera pasada completa con las puertas puestas dio `vivas 144 · mudas 0 · **ciegas 4**`, las
cuatro de `scrum765`, con «`scripts/_puerta-de-entrada.mjs` — ES UNA PIEZA MÍA Y YA NO TIENE MIS
BYTES». **Discriminado, no deducido:**

```
marca en disco: SÍ → 🔴 la mutación VUELVE A LOS BYTES ORIGINALES a mitad de medición
marca en disco: NO →    la mutación SIGUE PUESTA — nadie la toca
```

El mecanismo: la mutación de `scrum765` abre la puerta de entrada SIEMPRE; con ella puesta, la
sonda de ese guard importa el meta-guard y **le ejecuta el bloque principal dentro del test**. Ese
meta-guard **anidado** llamaba a `restaurarDesdeMarca()`, encontraba la marca de la pasada de
FUERA —viva y midiendo— y le devolvía la mutación a sus bytes originales.

**Determinista** (tres repeticiones idénticas: 1 VIVA + 4 CIEGA) y **hasta hoy invisible**, porque
quien restauraba lo hacía con los bytes BUENOS y `git status` no veía nada. Es decir: **cuatro de
las «vivas» de `main` no medían nada.**

El arreglo es preguntar lo que el comentario de SCRUM-808 ya afirmaba sin comprobarlo —«¿quedó una
mutación de una pasada ANTERIOR?»—: si el dueño de la marca sigue vivo. `procesoVivo(pid)` con
`kill(pid, 0)` (`EPERM` = existe y no es mío = vivo). La regla es **«OTRA pasada viva»**: una marca
con MI propio pid sí se repara —es lo que hace el banco de SCRUM-808— y la de un proceso ajeno vivo
no se toca; el llamante sale CIEGO diciendo pid, hora y piezas.

Tras el arreglo `scrum765` vuelve a **5 VIVAS**, ahora sobre un árbol que de verdad seguía mutado, y
`scrum808` sigue **10 de 10**.

> Y esa puerta se probó sola, en producción y sin buscarlo: al matar mal una pasada de fondo, la
> siguiente invocación se **negó** a repararle la marca a un proceso que seguía vivo, y lo dijo con
> su pid y su hora. Control positivo en el árbol real, no en banco.

---

## 🔴 EL CONTROL QUE DECIDE — N = 3, y las tres IDÉNTICAS

Tres pasadas completas **consecutivas** sobre el mismo árbol, ya con `main` mezclado dentro
(7-sep-2026, 19:30:15 → 20:04:27):

```
pasada 1 · exit=0 · vivas 158 · mudas 0 · ciegas 0 · ficheros muertos 0
pasada 2 · exit=0 · vivas 158 · mudas 0 · ciegas 0 · ficheros muertos 0
pasada 3 · exit=0 · vivas 158 · mudas 0 · ciegas 0 · ficheros muertos 0

md5 de las tres salidas: 53939dbdaaf94971503691982f21887c  → IDÉNTICAS BYTE A BYTE
```

Y antes del merge, otras tres igual de idénticas: `vivas 151 · mudas 0 · ciegas 0`, md5
`c24e750c8fbb8c0cf0f0096815bad1ff`. **Seis pasadas, dos árboles, cero oscilación.**
`git status` limpio después de cada una.

⚠️ Que salgan idénticas **no es la prueba de que esté arreglado** —seis pasadas buenas seguidas es
lo que ya tenía SCRUM-763 sin explicación—. La prueba es la tabla de ⑤, donde el defecto se provoca
y el instrumento lo declara. Esto es el suelo: si oscilara, aquí se vería.

---

## MUTACIONES DECLARADAS — 7, las 7 VIVAS

| # | fichero | qué imita |
|---|---|---|
| A | `_arbol-quieto.mjs` | el observador, **ciego al transitorio** — la avería original |
| B | `_arbol-quieto.mjs` | el observador **grita siempre** — el instrumento apagado por el otro lado |
| C | `meta-guard-mutaciones.mjs` | **PUERTA 0** se rinde: la línea base movida vuelve a juzgarse |
| D | `meta-guard-mutaciones.mjs` | **PUERTA 3** se rinde: el veredicto vuelve a decidirse antes de preguntar |
| E | `_arbol-quieto.mjs` | la exención de lo propio pasa a ser **por ruta** (una lista blanca) |
| F | `_arbol-quieto.mjs` | **margen 0** → 151 falsos positivos de 200 |
| G | `_marca-de-arbol.mjs` | vuelve a **repararle la marca a quien está midiendo** |

---

## TANDA

`npm test` tras mezclar `main` (61 commits dentro), 7-sep-2026 19:26→19:30:
**5921 tests · 5819 pass · 0 fail · 102 skipped.**

El merge trajo un rojo de compilación que no es de este ticket: el cliente de Prisma estaba viejo
frente al schema recién entrado (`firmadoTecnicoAt`, `signatureUrl`, de SCRUM-653). Resuelto con
`scripts/_prisma-sync.mjs` —el mecanismo de la casa que ya corre en `pretest`—, sin `npx` y sin
tocar `schema.prisma`.

---

## FICHEROS

- `scripts/_arbol-quieto.mjs` — **nuevo.** El observador, el margen y el control positivo.
- `scripts/meta-guard-mutaciones.mjs` — PUERTA 0, PUERTA 3, SUELO ③, `propias` por bytes, y el
  rechazo a medir con otra pasada viva.
- `scripts/_marca-de-arbol.mjs` — `procesoVivo`, y `restaurarDesdeMarca` que no toca una marca ajena
  en vuelo.
- `tests/scrum754-el-juez-que-oscila.test.mjs` — **nuevo.** 12 casos, 7 mutaciones declaradas.

---

## HUECOS DECLARADOS

- **La causa histórica del incidente de `scrum751` NO está registrada.** Lo reproducido es el
  MECANISMO, y produce exactamente la firma descrita (CIEGAS ×2 seguidas de VIVAS). Que aquel día
  lo que agitara el árbol fuera `npm test` en segundo plano es **compatible con lo medido, no
  probado**: nadie apuntó qué corría. Se dice así y no de otra forma.
- **`_claves-duplicadas.mjs` sigue sin adoptar `_barrido-estable.mjs` (SCRUM-740).** Aquí se arregla
  el JUEZ, no el barredor: sigue siendo frágil ante la misma carrera cuando lo corre `npm test`.
  Población de barredores del árbol que no lo han adoptado: **sin censar.** Es otro ticket.
- **Reutilización de pid.** Si el sistema reutiliza el pid de una pasada muerta, su marca dejará de
  repararse. No se silencia —sale como `enVuelo` con pid y hora— pero se quedaría así.
- **`censo-mudez.mjs` también llama a `restaurarDesdeMarca` y NO trata `enVuelo`**: ante una marca
  suya en vuelo se quedaría callado en vez de decirlo. Su marca es propia y dos pasadas suyas a la
  vez son improbables, pero el hueco existe y no se ha cerrado aquí.
- **La gracia de 200 ms y el margen de 25 ms son números medidos EN ESTA MÁQUINA**, no teoremas. El
  peor caso de retardo de `fs.watch` no está medido.
- **Un guard que escriba dentro del perímetro mientras se le mide saldrá CIEGO**, con su fichero
  delante. Es el comportamiento correcto y hoy no lo hace ninguno de los del censo, pero quien lo
  haga tiene que saber por qué.
- **CI corre en `ubuntu-latest` y la vigilancia sólo está medida en Windows.** Si allí
  `fs.watch({recursive:true})` no entregara, el job saldrá **CIEGO diciendo por qué** —la conducta
  que pide la casa— pero puede ser un rojo en el primer PR.
- **Los suelos `SUELO_GUARDS`/`SUELO_DECLARACIONES` no se tocan**: están muy por debajo del árbol
  real desde antes de este ticket, y subirlos toca a las cinco ramas vivas. El trinquete que sí
  muerde es el de SCRUM-810 contra `main`, y sólo penaliza pérdidas; aquí se añaden 7.

---

# SCRUM-754b · El hueco declarado se cumplió — y el arreglo no es quitar la puerta

**Fecha:** 07-sep-2026 · **Carril:** instrumento · **Gate:** ninguno — no toca producto

**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T18:56:51+02:00

## Lo que pasó, y por qué vale más que si no hubiera salido

La entrada anterior dejó escrito que en `ubuntu-latest` la vigilancia podía no entregar, que saldría
CIEGO diciendo por qué, y que si salía **«no se quita la puerta — se mira por qué esa plataforma no
puede vigilar»**. Salió con ese texto:

```
build+tests      → ✖ CONTROL POSITIVO: la vigilancia no vio un fichero que nació
                     y murió dentro de tests/ delante de ella.
meta:mutaciones  → 🔴 CIEGO · exit 2, mismo motivo.
```

**La consecuencia es la que manda:** con eso en `main`, `meta:mutaciones` saldría CIEGO en TODA rama
que pase por CI. Un CIEGO permanente se ignora igual que un rojo fijo, así que el instrumento habría
quedado apagado justo donde más falta hace.

## Lo que NO cambia: la pregunta

«¿Estuvo el árbol quieto mientras medía?» sigue siendo obligatoria y no se toca. Lo que cambia es el
**instrumento** con el que se contesta. Una vigilancia en vivo era UNA forma de contestarla, no la
pregunta.

## 🔴 La contradicción que había que resolver, dicha antes de resolverla

La dirección propuesta era «una huella del contenido comparada antes y después». Y a la vez se
exigía que **un fichero que nace y muere durante la medición sea DENUNCIADO**.

Una huella del **contenido** no puede hacer las dos cosas: el transitorio está AUSENTE en las dos
fotos — es literalmente lo que fabricó los tres verdes falsos de la entrada anterior. Aplicada sola,
habría apagado el control positivo que la misma orden prohibía quitar.

**Lo que lo resuelve, y está MEDIDO aquí antes de escribir una línea:** el fichero no deja rastro,
pero **su DIRECTORIO sí**. Crear o borrar una entrada actualiza el `mtime` del directorio que la
contiene — POSIX lo garantiza para `link`/`unlink`, y NTFS hace lo mismo. Medido: un fichero creado y
borrado en el mismo instante deja el directorio con `mtime` movido, con el fichero ya inexistente.

Así que la huella no es del contenido: es de **`mtime` de ficheros Y de directorios**, más las altas
y bajas de rutas. Y conserva la mitad que impide apagar el juez por el otro lado, incluso mejor que
`fs.watch`: **leer no mueve el `mtime`** (en Windows `fs.watch` sí emite `change` al leer, y por eso
necesitaba confirmar cada candidato contra el disco).

## El instrumento, en dos capas

| | |
|---|---|
| **② La huella (antes/después)** | **Obligatoria.** Puros `readdir` + `stat`: UNA implementación en todas las plataformas. Es la que contesta la pregunta. |
| **① `fs.watch`** | **Opcional, y sólo AÑADE**: donde entrega, pone el NOMBRE del transitorio que la huella sólo puede situar en su directorio. Donde no entrega, no resta nada. |

Que `fs.watch` no entregue ya **no** es motivo de CIEGO: es una nota del veredicto.

### Y una mejora que salió de probarlo

El corte por reloj (`mtime >= desde`, con `MARGEN_MS = 25`) existe porque la vigilancia en vivo **no
tiene foto previa**. La huella sí la tiene, así que compara contra **su propia línea base** y no
contra el reloj: sin ventana ciega y sin margen que ajustar.

No es teórico: al probarlo, el control positivo escribía su sonda **dentro** de esos 25 ms, y por
reloj el transitorio no salía. Con línea base, sale.

## 🔴 SU LÍMITE, ESCRITO Y NO CALLADO

1. **No ve un cambio cuyo autor restaure también los tiempos.** Quien escriba y después devuelva el
   `mtime` con `utimes` —del fichero y, si creó y borró, del directorio— es invisible. `utimesSync`
   está a una llamada. Lo que **no** puede es ocurrir por accidente.
2. **Dice DÓNDE, no siempre QUÉ.** De un transitorio queda el directorio, no el nombre: acusa
   `tests/`, no `tests/x.mjs`. Por eso `fs.watch` no se retira.
3. **Granularidad del sistema de ficheros.** Un cambio dentro del mismo tic de `mtime` que la línea
   base no se distingue de ella (medido aquí: salto mediano 1,0 ms, máximo 4,0 ms).

## Verificación

Se reproduce la condición EXACTA del CI —un `fs.watch` que se instala sin reventar y **no llama al
callback jamás**— y se exige que el instrumento siga discriminando:

* control positivo con `fs.watch` mudo → **pasa**;
* fichero que nace y muere → **denunciado** (`tests/ — algo nació o murió aquí dentro mientras medía`);
* fichero sólo leído → **no** sale como movimiento;
* suelo: huella que no ve nada → **lanza**, en vez de decir «no se movió»;
* fichero escrito durante → denunciado **con su nombre**.

**Probado EN ROJO en los dos sentidos.** Cegando la huella a los directorios caen exactamente los dos
casos del transitorio y **sólo** ésos; haciéndola gritar siempre cae exactamente el de la lectura.

### ⚠️ Lo que esta verificación NO es, y por qué

**No es una ejecución en `ubuntu-latest`.** En esta máquina no hay Linux —ni WSL (`wsl --status`: no
instalado), ni docker— y el CI sólo dispara con `pull_request`/`push` a `main`, que abre el fundador.

Lo que sí sostiene la prueba: el arreglo **no es otro `fs.watch`**. `fs.watch` tenía un backend por
plataforma (ReadDirectoryChangesW aquí, inotify allí), y por eso verlo funcionar en Windows no decía
nada de Linux. La huella es `readdir` + `stat`: **una sola implementación**, así que ejercitarla aquí
ejercita el mismo código que corre allí. Y se ejercita con la capa de plataforma APAGADA, que es
exactamente la condición que el CI reportó.

Queda dicho para que nadie lo lea de más: la prueba de que el backend de Linux se comporta como el
mudo la da el rojo del CI que originó esto; lo que aquí se prueba es que **con ese backend mudo el
instrumento sigue contestando**.

---

# SCRUM-754c · Tercer defecto del mismo instrumento: un test SALTADO contaba como aprobado

**Fecha:** 08-sep-2026 · **Carril:** instrumento · **Gate:** ninguno — no toca producto

**Medido contra:** `origin/main` = `15fb3b2f179cb03221377198227a65abf2659acd` · 2026-09-08T01:59:28+01:00

## El defecto, reproducido con sonda propia antes de tocar nada

`node:test` (Node 24, medido el 8-sep-2026):

| Declaración | Evento | `data.skip` |
|---|---|---|
| `test('…', { skip: 'sin QA_DB_TEST=1' }, …)` | **`test:pass`** | `"sin QA_DB_TEST=1"` |
| `test('…', () => {…})` que pasa | `test:pass` | `undefined` |

El bucle de eventos miraba **sólo `ev.type`**, así que un test que NO SE EJECUTÓ entraba en
`pasados`. Y los tests gateados por `QA_DB_TEST` **no corren en el job del meta-guard, que corre
sin base POR DISEÑO**: PUERTA 1 veía su test «en verde», abría, se mutaba, el test seguía sin
correr, seguía «pasando», y el veredicto salía **MUDO** donde tenía que salir **CIEGO**.

**«No pude mirar» y «miré y no cayó» son opuestos, y salían por la misma puerta.**

## Lo arreglado

1. **`test:pass` con `skip` deja de contar como aprobado**: va a un cubo propio, `saltados`, con su
   motivo. Mezclarlo con `pasados` era el defecto entero.
2. **PUERTA 1a**: si el test que la declaración nombra está saltado → **CIEGO**, nombrando el gate.
   Va **antes** del mensaje genérico de PUERTA 1, que acusa de tres cosas —«el fichero no llegó a
   ejecutarse, o ese test ya fallaba, o el nombre caducó»— y con un test saltado **ninguna es
   cierta**. Mandar a alguien a buscar un fichero que no cargó cuando lo que pasa es que su test
   está gateado es la falsa acusación de SCRUM-748/754 otra vez.

⚠️ **Lo que NO se toca, y es una decisión medida:** `t.skip()` **dentro** del cuerpo no detiene la
ejecución, así que si lo que sigue lanza sale `test:fail` (con `skip` puesto también). Un fallo es
un fallo y sigue contando como caída: tratar ahí el `skip` como ceguera se tragaría rojos de
verdad. Sólo se corrige el `test:pass`.

## El censo — `npm run censo:gateados`

**Ejecuta** los ficheros; no los lee. Un `{ skip: !ENABLED && … }` depende del entorno, y leerlo
del fuente diría lo que el código *podría* hacer, no lo que hace en el job del meta-guard.

**Medido el 8-sep-2026 sobre los 721 ficheros de `tests/`:**

| | |
|---|---|
| ① **GATEADOS** — todos sus tests saltados | **48** |
| ② **EXPUESTOS** — de ésos, los que además declaran mutaciones | **0** |

Los dos números importan y no son el mismo. ① es la **superficie**: dónde un veredicto hueco
*podría* emitirse. ② es dónde **se emite de verdad**.

**Que ② sea cero hoy no hace decorativo al censo, y conviene decirlo sin adornar: el veredicto
hueco no se estaba emitiendo sobre ningún guard.** Lo que había era la puerta abierta — bastaba
que alguien declarase una mutación en uno de esos 48. Es un trinquete que se abre solo (patrón de
SCRUM-537): el día que ② deje de ser cero, el censo se pone rojo sin que nadie tenga que acordarse.

**Suelo:** si ① sale cero, el censo está roto y sale CIEGO. El árbol tiene tests gateados por
`QA_DB_TEST`, `LIBRO_PG_URL`, `A55_DB_TEST` y `BOT_SUITE_TEST`; un cero ahí es «no he sabido ver
los saltos», que es exactamente el defecto vigilado.

## Verificación

- 🔴 **CONTROL POSITIVO**: un fichero con TODOS sus tests saltados sale **CIEGO**, y el CIEGO
  nombra el gate. **Probado en rojo con el código de antes**: revirtiendo la clasificación cae
  exactamente ese caso y **sólo** ése.
- ✅ **NEGATIVO**: un guard que corre de verdad y no cae **sigue saliendo MUDO**. Sin esto, «todo a
  CIEGO» habría apagado el instrumento por el otro lado — el riesgo que ya identificó 754b.
- 🔴 **SUELO y TRINQUETE del censo**, en la tanda normal (el recuento real cuesta como la suite).

### Una trampa que costó un rojo y queda escrita

La sonda del control positivo va en **subproceso** (`tests/_sonda-saltados.mjs`), y no por gusto:
un `run()` de `node:test` **anidado** dentro de un test que ya corre **no entrega los eventos por
test** — `saltados` y `pasados` llegan vacíos. Y hay un segundo escalón: `node --test` pone
`NODE_TEST_CONTEXT` en el entorno, **el subproceso lo hereda**, y con esa variable puesta vuelve a
no entregar. Se le limpia al hijo. Un caso que se hubiera conformado con ese vacío habría salido
verde midiendo nada — dentro del arreglo de un instrumento que existe para no medir nada en falso.
