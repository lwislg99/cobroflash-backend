# SCRUM-873 · NO lo he reproducido, y el ticket NO se cierra — esto es lo descartado, con su número

**Medido contra:** `origin/main` = `e778e7b232c99b5b46ce44b6c4c90d526b67b175` · 2026-09-16T09:32:02Z
**Rama:** `scrum-873-el-intermitente-de-206b` · **Carril:** instrumentos · proceso
**Gate:** sin gate — esta tarea **sólo mide**: no toca `src/`, ni `tests/scrum206b`, ni la tanda.

> 🔴 **EL TICKET NO SE CIERRA.** No he conseguido reproducir el intermitente. Un «a mí no me pasa»
> no es una medición, así que lo que sigue es la caracterización que sí tengo y la lista de lo
> descartado, cada cosa con su cifra.

---

## 0 · Obligación 0

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-873(-|$)"  ->  NINGUNA
git log origin/main --oneline -i --grep="scrum-873"                 ->  vacío
docs/master/SCRUM-873.md                                            ->  no existía
```

**Caso (a): nunca se empujó.**

⚠️ **Y el encargo llegó CORTADO a media palabra** en su último aviso —«SCRUM-804 dio 2 rojos
(«149 ramas contra 150»), aislado p»— aunque traía el marcador de fin. No he adivinado lo que
faltaba: era un aviso sobre OTRO intermitente, ajeno a ①②③, así que se siguió y se pidió la línea
entera. Queda dicho porque un encargo cortado es un encargo sin sus últimas condiciones.

## 1 · ① La caracterización: **NO falla solo**

| escenario | pasadas | rojos |
|---|---|---|
| `scrum206b` solo, en mi árbol | **40** | **0** |
| `scrum206b` solo, en árbol aislado en `origin/main` | 10 | 0 |
| con **6 obreros** parseando `src/` y `tests/` a la vez | 20 | **0** |

**N = 40 y está justificado:** si el fallo tuviera una tasa del 10 % corriendo solo, la
probabilidad de no verlo en 40 pasadas es `0,9^40 ≈ 1,5 %`. Con 0 de 40 se puede afirmar que
**no falla por sí mismo**: necesita algo más que no está en la tanda de un solo fichero.

Una pasada cuesta **1,3 s**, así que 40 son 52 segundos: no había motivo para quedarse en dos.

## 2 · ② La hipótesis del barredor: **NO confirmada, y tampoco tumbada** — y el motivo importa

El fichero **sí es un barredor del árbol**, como decía la hipótesis: `fuentesTs` hace
`readdirSync` recursivo sobre `src/` y luego lee y parsea cada `.ts`. Y hay una fragilidad a la
vista, que **se anota aunque no sea la causa observada**:

```js
readdirSync(...)          // recoge TODAS las rutas
...
readFileSync(ruta, 'utf8')  // SIN try/catch: si el fichero ya no está, ENOENT
```

**Intenté reproducirlo por ahí y no pude — pero el 0/20 NO vale**, y eso es lo que hay que decir:

> 🔴 **MI EXPERIMENTO NO PODÍA GANAR.** Puse un `.ts` transitorio bajo `src/` que aparecía y
> desaparecía mientras el test barría, y salieron **0 rojos de 20**. Antes de apuntarme el
> descarte, medí el **suelo del propio experimento**: en **71 barridos durante 8 s**, la carrera
> «listado y luego ausente» ocurrió **0 veces**. O sea que el 0/20 no distingue «la hipótesis es
> falsa» de «mi banco no sabe provocarla». **Un negativo sobre un experimento imposible no es un
> descarte: es un cero sin población.**

Por qué no ocurre: entre listar una ruta y leerla pasan microsegundos, y mi escritor alternaba
cada 15 ms — el fichero estaba presente para las dos operaciones o ausente para las dos.

**Lo que queda por probar de esta hipótesis**, y es lo siguiente que haría: no el fichero que
DESAPARECE, sino el que se está **reescribiendo** — `writeFileSync` no es atómico, así que un
lector puede ver contenido truncado y el AST sacar otro veredicto sin que nada reviente. Eso sí
encaja con un rojo intermitente que no es un crash.

## 3 · Lo descartado, cada cosa con su número

| candidato | medición | veredicto |
|---|---|---|
| que falle solo | 40 pasadas | **0 rojos** — no es |
| que dependa de carga de CPU/E-S | 20 pasadas con 6 obreros | **0 rojos** — no es |
| fichero que aparece y desaparece bajo `src/` | 20 pasadas + **suelo del experimento** | **inconcluso**: la carrera no llegó a ocurrir (0 de 71 barridos) |
| que sea el árbol aislado | 10 pasadas en worktree limpio | 0 rojos |

## 4 · Límites declarados

1. **No lo he reproducido, y por eso el ticket sigue abierto.** Lo que hay descarta dos causas y
   deja una tercera a medio probar.
2. **No he corrido la tanda ENTERA en bucle**, que es donde se vio. Con 40 minutos por pasada y
   seis sesiones compartiendo máquina, eso es una tarde y no cabía aquí — pero es lo que
   contestaría «¿cae siempre en el mismo punto?», que sigue **sin contestar**.
3. **El censo de escritores es grueso:** 35 ficheros de `tests/` escriben Y nombran una ruta de
   `src/`, pero mi detector no distingue «escribe EN `src/`» de «escribe en un temporal y además
   menciona una ruta de `src/`». El sospechoso real está ahí dentro y hay que afinarlo.
4. **Todo el experimento se hizo en un worktree aislado**, y a propósito: un fichero transitorio
   dentro del `src/` del árbol compartido le habría inventado un rojo a las otras cinco sesiones
   — que es exactamente el defecto que este ticket persigue.

## 5 · Lo que NO se ha tocado

`src/` · `tests/scrum206b` · ningún test · la tanda · ningún proceso ajeno · el árbol compartido.
Esta tarea sólo mide.

---

# APÉNDICE · 16-sep-2026 · SCRUM-873b · La hipótesis se cae por ③, y el mecanismo de ② existe pero no tiene disparador

**Medido contra:** `origin/main` = `94e9a6b4e928e611f7585c941e09db21d73e2006` · 2026-09-16T09:54:47Z
**Rama:** `scrum-873-el-intermitente-de-206b` · **Sigue sin reproducirse: el ticket NO se cierra.**

## ③ · El censo afinado — y ahí se cae la hipótesis

Mi censo de ayer era grueso y lo dije: *«35 ficheros escriben y nombran rutas de `src/`»*. Afinado
**reusando el instrumento de la casa** (`scripts/_temporales-en-el-arbol.mjs`, SCRUM-824), que ya
clasifica cada escritura en `ARBOL` / `TMP` / `FUERA` / `DESCONOCIDO`:

```
POBLACIÓN: 956 ficheros · 403 sitios de escritura
  TMP 345 · FUERA 3 · ARBOL 0 · DESCONOCIDO 55
escriben DENTRO del árbol ......... 0
con "src/" en la ruta escrita ..... 0
```

**Y el cero no se entrega solo:** los **55 DESCONOCIDO** se revisaron uno a uno, agrupados en 13
ficheros. **Doce** escriben en bancos propios de `mkdtempSync`; el decimotercero
(`scrum778-la-lista-cableada`) es el único que compone rutas desde la raíz real hacia `src/` —
y **sólo para LEER** (`analizarArbol(path.join(RAIZ, 'src'))`); lo que escribe va a su
`mkdtempSync`. Comprobado línea a línea.

> 🔴 **NADIE ESCRIBE EN `src/` DURANTE LA TANDA.** La hipótesis del barredor que lee mientras otro
> escribe **se cae por falta de escritor**, que es exactamente la salida que el encargo anticipaba.
> Mi 35 de ayer no era un dato: era el número de ficheros que escriben *en algún sitio* **y además**
> mencionan una ruta de `src/`. El número bueno es **0**.

## ② · El mecanismo de la lectura truncada: **existe, y es facilísimo de alcanzar**

Aunque ③ deja la hipótesis sin disparador, el suelo que pedía el encargo se midió igual, porque el
dato sirve el día que alguien SÍ escriba ahí. Escritor y lector en **procesos distintos**,
alternando un fichero de 508 KB con uno de 20 bytes:

```
lecturas 7.652 · completas-grande 1 · completas-pequeño 2.243 · ENOENT 0
LECTURAS TRUNCADAS: 5.408  (70,7 %)
```

**Suelo del escritor confirmado** (se vieron las dos versiones completas, así que alternaba de
verdad). O sea: **`writeFileSync` no es atómico y un lector ve contenido truncado el 70 % de las
veces**. Queda anotado junto a la fragilidad de `fuentesTs` —`readFileSync` sin `try/catch`— como
lo que pasaría **si** algún día un test escribe bajo `src/`. Hoy no lo hace ninguno.

## ④ · La tanda parcial con los escritores: tampoco cae

`scrum206b` + `scrum205` (su hermano) + `scrum778` + `restauracion-del-arbol-ejecutable` +
`scrum808` + `scrum476` + `scrum766` + `scrum716c` — los ocho que más escriben, aunque sea a
temporal — **8 ficheros × 15 pasadas → 0 rojos.**

## 🔴 Y tres arneses míos rotos, los tres cazados por imprimir la población

Esto es lo que más vale de la tanda de hoy, y va entero:

| intento | lo que decía | por qué no valía |
|---|---|---|
| fichero transitorio bajo `src/` (ayer) | 0 rojos de 20 | la carrera «listado y luego ausente» ocurrió **0 veces en 71 barridos** |
| suelo de la lectura truncada, 1ª | 0 truncadas de 2.478 | **`escrituras: 0`** — un `setInterval` dentro de un `while` síncrono no corre NUNCA |
| suelo de la lectura truncada, 2ª | 0 truncadas de 6.382 | el hijo no llegó a arrancar; `stdio:"ignore"` se tragó su error, y el lector veía siempre el fichero original |

Los tres habrían pasado por «descarte» si hubiera leído sólo el resultado. Los tres los cazó la
misma pregunta: **¿cuántas veces ocurrió lo que tenía que ocurrir?** A la cuarta, con el escritor
en otro proceso y su error a la vista, el suelo salió **70,7 %**.

> 🔒 **Un cero no se apunta hasta que el banco demuestra que sabe producir un uno.**

## Lo que queda, y por qué el ticket sigue abierto

1. **No se ha reproducido.** Ni solo (0/40), ni con carga (0/20), ni en tanda parcial (0/15).
2. **La hipótesis del encargo queda TUMBADA** por ③: no hay escritor en `src/`.
3. **Sigue sin contestar** «¿cae siempre en el mismo punto?»: eso pide la tanda ENTERA en bucle, y
   son 40 min por pasada con seis sesiones compartiendo máquina.
4. **Y una pista que NO he perseguido:** `scrum206b` escribe dos ficheros en `os.tmpdir()` con su
   `process.pid` en el nombre. Los PID se reciclan. Con ~26 worktrees lanzando tandas todo el día,
   dos procesos con el mismo PID en el mismo `tmpdir` es una colisión posible — y encaja con
   «aislado pasa, en tanda no». **No lo he medido**, y por eso va como pista y no como hallazgo.

## Sobre el segundo intermitente (SCRUM-804), que me avisaste de no confundir

**No lo he tocado.** Y con lo medido hoy **no puedo decir que sean el mismo mecanismo**: el suyo es
una carrera entre sus dos lecturas con ~26 worktrees empujando —o sea, estado COMPARTIDO de git—,
y el mío, hasta donde llega esta medición, no tiene escritor concurrente ninguno. Lo único que
comparten es el síntoma. Si mi pista del `tmpdir` se confirmara, entonces sí serían familia
—los dos serían estado compartido entre worktrees— y ése sería el hallazgo. **Hoy no está medido.**
