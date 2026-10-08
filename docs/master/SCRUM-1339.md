# SCRUM-1339 · El check obligatorio SÍ pierde casos, sale verde, y lo que hoy lo vigila no puede verlo

**Medido contra:** `origin/main` = `761db44f2f18bc69e55047ebc2e26e55d6d1c89d` · 2026-10-01T07:07:44Z
(J6 del equipo de Javier, sesión `jv-j6g`, relevo de J6f; encargo del orquestador `cobroflash-backend-5b`.
Sólo lectura de artefactos y logs de CI de runs que YA existían: ni un test, guard, script de la casa ni
workflow tocado. Lo único que se escribe es este registro, sus evidencias y una línea de cicatriz.)

A9: aviso → cicatriz J6 «Lancé un lote de 622 bajadas sin probar antes UNA, y la trampa estaba escrita en el registro que acababa de leer.» — no se pudo comprobar: es un hábito al lanzar cualquier lote; el guion de este ticket ya lleva su canario, pero el siguiente lote no lo hereda

## En corto

1. **Sí: «build + tests» pierde casos, y sale verde.** Con el MISMO árbol, a **47 de 141 jobs (33 %)**
   les faltan casos que otro job de ese mismo árbol sí trae. **38 de esos 47 salieron VERDES.** 14 son
   de push a `main`, y los 14 verdes.
2. **En la línea de `main`, 45 de 123 commits (37 %)** tienen un «build + tests» al que le falta algún
   test que su propio commit declara. **42 de esos 45, verdes.** El último medido es `258fc29b`.
3. **Es la misma forma que en el job de zona** (SCRUM-1335): 715 casos perdidos y los 715 eran `pass`
   en el hermano; siempre un bloque seguido; donde se puede situar, la **cola** del fichero (45
   bloques) y nunca el medio (0). Mismos ficheros.
4. **Lo que se pierde no es relleno.** Los de `tests/scrum524b-trinquete-de-la-tabla.test.mjs` son
   «EL QUE DECIDE · 1223 · el emisor deja de exigir el NIF del productor → cae 1223» y hermanos: guards
   del camino de emisión, ausentes en verdes de `main`.
5. **El enunciado decía «nadie compara su recuento con nada», y no es exacto.** Sí hay una comparación:
   `scripts/suelo-de-la-tanda.mjs` corre en cada job y exige el 97 % de lo que el árbol declara. Dijo
   ✅ en **594 de 594**. Su margen medido va de **448 a 660 casos** (mediana 566); la mayor pérdida es
   de **65**. Hay vigilancia, y no puede ver esto.
6. **Causa: NO demostrada.** No he construido nada sobre la hipótesis de J6f. Una mía la descarté
   leyendo el fuente (§⑥).
7. **La señal que propongo está medida y NO construida** (§⑤): comparar conjuntos de nombres en vez
   de un recuento. Sobre 85 jobs sin pérdida conocida, 0 avisos falsos; habría saltado en 37 de 38
   jobs con pérdida. Depende de que el TAP llegue entero, y hoy llega pisado (PR #1990 y #2000, abiertos
   y de otro carril).
8. **El techo de `guards:entrada`** (§⑦): el mismo árbol y los mismos 122 tests tardan de 10,0 s a
   más de 90 s en esta máquina según los núcleos que le queden; en CI, 597 pasadas, el máximo es 15,4 s.

## ⓪ La población y los instrumentos

Todo sale de lo que GitHub guardaba al medir. El paso «Guardar el TAP completo» de `ci.yml` sube el
artefacto `tanda-tap` en cada job de «build + tests (con banco desechable)», con 7 días de retención.

| qué | cuánto |
|---|---|
| artefactos `tanda-tap` listados y bajados | 627 de 627 (0 caducados, 0 fallidos) |
| runs distintos | 622 |
| jobs «build + tests» de esos runs, con todos sus intentos | 630 |
| logs bajados | 630 de 630 |
| ventana | 2026-09-24T13:30:22Z → 2026-10-01T06:18:23Z |
| jobs con resumen de tanda (`ℹ tests N`) | 594 (los otros 36: tanda cortada o cancelada) |
| de los 594: con `fail 0` / con algún fallo | 435 / 159 |
| Node | 24.21.0 en los 630 |

**Control del instrumento:** las líneas de resultado que mi lector saca del log (`✔` / `✖` / `﹣` del
paso `npm test`) son **iguales al `ℹ tests` del corredor en 594 de 594**. Y el «total actual» que
imprime el suelo coincide con ese `ℹ tests` en 594 de 594.

**Por qué los logs y no el TAP.** El TAP del artefacto llega pisado: **594 de 627** llevan entre 1,9 y
2,2 MB de bytes NUL y su numeración salta de un caso ~112 a uno ~8.000-9.187 (`taps.tsv`). Sólo 4 están
sanos. No es hallazgo mío: es SCRUM-1289 (PR #1990) y 1289b (PR #2000), los dos abiertos al medir. No
lo toco. Lo que sí importa aquí: el recuento `# tests N` sobrevive porque el corredor lo escribe al
final, pero **los nombres de los casos no están en el artefacto**, así que los leo de la salida `spec`
del log, que está entera.

**El árbol, no la cabeza.** Un PR prueba el commit de la FUSIÓN con `main`. El «mismo commit» del
enunciado se mide como el mismo ÁRBOL: el commit que imprime el checkout (`git log -1 --format=%H`) y,
de él, su árbol (`arboles.tsv`). 630 de 630 resueltos. Así un PR y el push a `main` que lo mergea, si
`main` no se movió entre medias, son el mismo árbol probado dos veces.

Instrumentos, en `docs/master/evidencias/SCRUM-1339/`: `bajar-taps.mjs`, `analizar-taps.mjs`,
`bajar-logs.mjs`, `analizar-logs.mjs`, `comparar-mismo-arbol.mjs`, `perdidas.mjs`,
`propuesta-nombres.mjs`, `techo-en-ci.mjs`. Sus salidas, al lado (`salida-*.txt`) con las tablas
(`*.tsv`).

## ① Mismo árbol: no da siempre los mismos casos

`comparar-mismo-arbol.mjs` agrupa por árbol y compara CONJUNTOS de nombres (con multiplicidad), no
recuentos.

| | |
|---|---|
| árboles distintos entre los 594 jobs con resumen | 523 |
| árboles probados más de una vez | **70**, que suman **141** jobs |
| de esos 141: verdes / de push a `main` | 126 / 61 |
| **jobs a los que les faltan casos que su hermano trae** | **47 de 141 (33 %)** |
| de ellos, verdes | **38** (de 126 verdes: 30 %) |
| de ellos, de push a `main` | 14, **los 14 verdes** (de 61: 23 %) |
| árboles en los que algún job no trae lo que trae otro | 39 de 70 |
| casos perdidos por job | mín 1 · mediana 9 · máx 65 · **715 en total** |

Los cinco runs que se relanzaron (mismo run, dos intentos: la fusión probada es literalmente la misma):

| run | intento 1 | intento 2 | diferencia |
|---|---|---|---|
| `36152039414` | 8.297 | 8.318 | 21, todos de `tests/vigia-atascados.test.mjs` |
| `36152176419` | 8.322 | 8.314 | cada intento perdió un bloque distinto (4 y 12) |
| `36797938424` | 9.338 | 9.327 | 11 |
| `36797941392` | 9.343 | 9.342 | 1 |
| `36466769679` | 8.879 | 8.879 | 0 |

⚠️ Cuatro de esos cinco runs llevaban además algún fallo propio en los dos intentos, así que el número que decide no
es el suyo: son los **38 verdes**.

⚠️ **Es una cota por debajo.** Sólo veo lo que le falta a un job respecto a su hermano: si los dos
perdieron el mismo caso, este instrumento no lo ve. Pasa de verdad: la sonda de §⑤ encontró 3 jobs
que aquí salían «sin pérdida» y a los que les faltaban entre 1 y 18 tests declarados.

## ② La línea de `main`, por dos caminos que no comparten método

Para no depender de que un árbol se haya probado dos veces:

**Camino B — los vecinos** (`perdidas.mjs`). Para cada commit de `main` con su job de push, los casos
que traen los 2 commits de antes Y los 2 de después, y él no. **42 de 119 commits (35 %)**, 39 verdes.

**Camino ③ — lo que declara su propio commit** (`propuesta-nombres.mjs`). Para cada job de push, los
tests que SU commit declara con nombre literal (por AST) y que no aparecen en su registro. No compara
con ningún otro run. **45 de 123 commits (37 %)**, **42 verdes**; de 1 a 48 nombres por job, mediana 14.

Los dos caminos dan lo mismo por métodos distintos. Por día, con el camino ③ (commits de `main` con
pérdida / commits de `main` medidos): 24-sep 1/6 · 25-sep 11/26 · 26-sep 2/11 · 27-sep 7/11 ·
28-sep 10/26 · 29-sep 7/21 · 30-sep 4/13 · 1-oct 3/9. La tabla entera, con commit y fichero, en
`declarados-que-faltan-en-main.tsv`. Los tres últimos: `258fc29b` (verde, 9.483 tests, le faltan 23 de
`vigia-atascados`), `ce567ed4` (verde, 35) y `e9e71cab` (rojo, 7).

`258fc29b` es uno de los dos `main` cuyo job de ZONA salió rojo en SCRUM-1335. Su «build + tests»
(job `110213649853`) perdió 23 casos de `vigia-atascados` **y salió verde**.

## ③ La forma de la pérdida

Sobre las 47 pérdidas de §① (`perdidas-mismo-arbol.tsv`):

- **Veredicto en el hermano de los 715 casos perdidos: `pass` los 715.** Ningún `fail`, ningún `skip`.
- **Siempre bloques seguidos: 65.** De ellos **45 son la cola del fichero** y **0 están en medio**.
  De los 20 restantes, en 14 no sé situar el borde (el caso vecino tiene un nombre generado en un bucle
  y no se localiza en el fuente; son casi todos de `scrum524b`), 4 no se atribuyen a ningún fichero y 2
  salen «fichero entero» en dos jobs ROJOS de `scrum237`, que pueden ser otra cosa y aparto.
- **En el log del job que pierde no hay nada en ese punto.** Ni `✖`, ni aviso, ni entrada con el nombre
  del fichero. Pasa del último caso presente al primer caso del fichero siguiente.
- **Ficheros** (jobs · de ellos verdes · casos): `scrum524b-trinquete-de-la-tabla` 17 · 16 · 127 ·
  `vigia-atascados` 14 · 12 · 289 · `scrum834-puerta-avisador-rojo` 9 · 7 · 119 ·
  `scrum286-bloques-orden` 6 · 4 · 20 · `scrum454-destructivo-sin-comprobacion` 4 · 4 · 78 · y nueve más
  con 1 o 2 jobs (`salida-perdidas.txt`). En la línea de `main` salen 17 ficheros distintos.
- Un mismo job puede perder la cola de **varios** ficheros a la vez (el de 65: `scrum524b` y
  `vigia-atascados`).

**Diferencia con SCRUM-1335:** allí el caso del ticket era un bloque intermedio (36 a 54 de 64). En
«build + tests», sobre 45 bloques situados, **ninguno** está en medio.

## ④ Lo que hoy compara el recuento, y por qué no lo ve

El paso «¿Ha perdido tests la tanda?» corre `scripts/suelo-de-la-tanda.mjs` con `if: always()`. Lee el
`# tests N` del TAP y exige que no baje del 97 % de los tests que el árbol declara por AST
(`CUENTA_DEL_ARBOL_MINIMA = 0.97` en `scripts/_suelo-de-la-tanda.mjs`, SCRUM-672/736).

| | |
|---|---|
| jobs en los que el suelo dio su veredicto | 594 |
| veces que dijo ✅ | **594** |
| margen que imprimió (total − suelo) | mín **448** · mediana **566** · máx **660** |
| mayor pérdida medida en un job | **65** |

El suelo se diseñó para otra avería —media suite fuera, un TAP a medias— y para ésa sirve. Para ésta,
su holgura es siete veces la pérdida más grande. No falló: no puede.

Y su otra mitad, los «ficheros mudos» (un fichero que no registra ningún test), tampoco salta: aquí el
fichero registra la primera parte de sus casos.

## ⑤ La señal que propongo — MEDIDA, NO CONSTRUIDA

**«Todo test que el árbol declara con nombre literal aparece en lo que la tanda registró.»** Conjuntos
de nombres, sin holgura; nombra el caso y el fichero; no necesita otro run ni guardar nada entre runs.

`propuesta-nombres.mjs` la mide sobre los árboles de §① que se pueden leer en local (61 de 70; de los
otros 9 ningún commit está en este repositorio local). Los nombres salen por AST con el compilador de
TypeScript, el mismo motor del censo de la casa (`tests/_poblacion-de-tests.mjs`, SCRUM-708): en el
último árbol leído, 1.153 ficheros, 9.154 llamadas `test()`/`it()` y 9.048 nombres literales distintos.

| pregunta | medida |
|---|---|
| **avisos falsos** — en los 85 jobs a los que no les falta nada respecto a su hermano, ¿cuántos declarados no aparecen? | mediana **0**; 82 de 85 con **0**. Los otros 3 (1, 3 y 18 nombres) son colas de `scrum524b` y `vigia-atascados`: **pérdidas reales** que perdieron los dos hermanos, no avisos falsos |
| **poder** — de los 38 jobs con pérdida en esos árboles, ¿en cuántos habría saltado? | **37 de 38** |
| casos perdidos que habría nombrado | 475 de 638 |
| el que no caza | job `107672560751`: sus 9 casos perdidos tienen todos nombre generado en un bucle |

Lo que no cubre, dicho: los casos cuyo nombre se construye (plantilla con variables, bucle). Son los
163 de 638 que no nombra. Como la pérdida es la cola del fichero, basta un caso literal en esa cola
para que salte; con uno solo generado al final, no.

**Dos dependencias, y ninguna es mía:**

1. Necesita los nombres de la tanda, que hoy no están en el TAP (§⓪). Hasta que entre el arreglo de
   #2000, o se lee del log —que el paso no tiene— o no hay de dónde.
2. El sitio natural es el paso que ya corre, y su fichero es el que #2000 está cambiando. El
   orquestador lo ha dicho por escrito: el criterio sí, **ahí no y todavía no**; lo coordina él con
   quien lleve #2000.

No está en la norma ni la ha pedido un jefe con estas palabras: es una propuesta de IA, con su
medición al lado, y como tal se trata.

## ⑥ La causa: lo que NO sé

- **No demostrada.** Nada de lo de arriba dice por qué.
- **No distingo si el caso se ejecutó y su resultado no llegó, o si no se ejecutó.** Ningún log lo
  separa. Importa: en el primer caso el test corrió y no se contó; en el segundo, el guard no vigiló.
- **La hipótesis de J6f** (`forceExit` + la tubería entre el proceso del fichero y `run()`) sigue
  **marcada como IA y sin probar**. No he construido nada sobre ella. Lo único nuevo que la toca: en
  «build + tests» el hueco es siempre la cola (45 de 45 situados), sin el bloque intermedio que la
  contradecía en el job de zona. Eso no la demuestra.
- 🔴 **Una hipótesis mía, de IA, DESCARTADA por lectura:** «un `await` de nivel superior en el fichero
  de test, más la salida forzada, deja sin registrar los casos que van detrás». Fui al fuente:
  `tests/vigia-atascados.test.mjs` —el segundo que más pierde— **no tiene ningún `await` de nivel
  superior**. No se sostiene.
- **Sin medir:** si un caso perdido que hubiera FALLADO habría dado rojo por otro camino (el código de
  salida del proceso del fichero). Lo creo, no lo he medido, y no lo afirmo.
- El experimento que separa la causa toca el runner (GO del fundador): es el de SCRUM-1335, no éste.

## ⑦ El techo de `guards:entrada` (encargo ②: medir y proponer, sin cambiar nada)

`scripts/guards-entrada.mjs` lanza sus 12 ficheros con `node --test` y un plazo de reloj de 90 s
(`TECHO_MS`). `tests/scrum976-guards-entrada-con-techo.test.mjs` lo lanza de verdad en su caso ④.

**En CI** (`techo-en-ci.mjs`, la duración de ese caso ④ en los logs ya bajados): 597 pasadas ·
mín 6,7 s · mediana 13,1 s · p95 14,4 s · **máx 15,4 s** · por encima de 45 s: **0**. El caso cayó 41 veces y
ninguna por tiempo: todas duraron menos de esos 15,4 s.

**En esta máquina**, mismo árbol, mismos 122 tests (`techo-serie-local.tsv`). Para quitarle núcleos al
comando sin cargar la máquina de las demás sesiones lo lancé con afinidad de CPU (`start /affinity`):

| núcleos que se le dejan | pasadas (s) |
|---|---|
| 12 (todos) | 10,0 · 11,4 · 23,9 |
| 4 | 14,9 · 24,6 · 33,0 |
| 2 | 44,2 · **>90** · **>90** |
| 1 | 61,9 · 77,0 · **>90** |

**3 de 12 pasadas se pasaron del techo sin que cambiara ni un guard.** En las dos de la segunda serie,
la carga de CPU medida justo antes era del 100 % (24 y 46 procesos `node`: otra sesión corría algo
grande). Con 12 núcleos y la máquina tranquila, 10 s.

Lo que mide el techo hoy es reloj, y el reloj es instrumento × máquina. J2f lo vio con 42 procesos
`node` y `scrum514` tardando lo mismo que en `main`; esto lo reproduce en una dirección controlable.

⚠️ Límites: la afinidad simula «me quedan N núcleos», no «tengo vecinos»; la carga de CPU es una
muestra de antes de lanzar, no del tramo; y no reproduje las condiciones exactas de J2f.

**Propuesta, sin construir** (el comando y su test no los cambio sin ticket):

1. **Separar los dos trabajos que hoy hace un solo número.** El *plazo* (matar a un runner colgado) y el
   *presupuesto* («que quepa en segundos») no son lo mismo. Pasarse del plazo en local debería salir
   como **CIEGO** —«no terminé en 90 s; no sé nada de tus guards»—, con código distinto del rojo, y no
   como «se pasaron del TECHO: deja sitio a alguno o sube el techo».
2. **El presupuesto se juzga donde la carga es constante: en CI.** Ahí el máximo de 597 pasadas es
   15,4 s; un presupuesto de, por ejemplo, 30 s en CI vigilaría que la lista no engorde con seis veces
   menos holgura que hoy, y sin sorteos.
3. Lo que NO propongo: subir los 90 s. Con 1-2 núcleos libres no hay número razonable que aguante, y
   un techo más alto vigila menos.

## Mis errores

- **Lancé 622 bajadas de logs sin probar una.** Salió vacía por el `--allow-escape-sequences` que J6f
  dejó escrito en `docs/master/SCRUM-1335.md` y que yo había leído media hora antes. Lo delató el
  recuento (0 ficheros). Coste: 8 minutos. `bajar-logs.mjs` lleva ahora un canario (baja UNO y, si no
  queda en disco, no lanza el resto); lo vi en rojo con un run que no existe (salida 3, 0 logs).
- **En el avance al orquestador di «45 colas, 0 en medio» y callé que otros 16 bloques salían «fichero
  entero».** Supuse que era un artefacto de mi atribución y no lo había comprobado. Lo comprobé
  después: 14 eran bordes que no sé situar (vecino con nombre generado) y 2 son de dos jobs rojos.
  El dato que di era cierto; lo que hice mal fue quitar de la frase la parte que no me cuadraba.
- **Parcheé `propuesta-nombres.mjs` con un guion intermedio que metió tabuladores y saltos de línea
  literales**, y lo comiteé sin ejecutarlo: no parseaba. Lo dijo `node` en la primera ejecución.
- La primera línea de mi control de sufijo salió vacía con las dos ramas que usé de testigo (1335 y
  1102g): estaban ya mergeadas y borradas. Un control positivo sobre el vacío. Repetido con una rama
  viva antes de empujar.

## Lo que no está en git

Los 630 logs (243 MB comprimidos) y las listas de casos por job: no caben. Se rebajan por id con
`bajar-logs.mjs` mientras GitHub conserve los logs. **Los artefactos `tanda-tap` caducan a los 7 días:**
los del 24-sep se van hoy. Las tablas derivadas (`medidos.tsv`, `mismo-arbol.tsv`, `perdidas-*.tsv`,
`declarados-que-faltan-en-main.tsv`) sí están, con el id de cada job.

## Reproducir

    D=<carpeta fuera del árbol>
    node docs/master/evidencias/SCRUM-1339/bajar-taps.mjs    $D     # artefactos → $D/*.tap, artefactos.tsv
    node docs/master/evidencias/SCRUM-1339/analizar-taps.mjs $D     # taps.tsv (NUL, huecos, resumen)
    node docs/master/evidencias/SCRUM-1339/bajar-logs.mjs    $D     # logs y jobs.tsv
    node docs/master/evidencias/SCRUM-1339/analizar-logs.mjs $D     # medidos.tsv, casos/, arboles.tsv
    node docs/master/evidencias/SCRUM-1339/comparar-mismo-arbol.mjs $D
    node docs/master/evidencias/SCRUM-1339/perdidas.mjs      $D .   # desde la raíz del repo
    node docs/master/evidencias/SCRUM-1339/propuesta-nombres.mjs $D .
    node docs/master/evidencias/SCRUM-1339/techo-en-ci.mjs   $D

# SCRUM-1339b · Con el TAP ya entero, la señal por nombres se puede leer DENTRO del job — y la mitad de SCRUM-1366 es esto

**Medido contra:** `origin/main` = `5fb7630ad564740f0fe4ba115e7dc141d18da775` · 2026-10-01T14:50Z (medición de J3g; la sube J3h, su relevo, sin re-ejecutarla)

A9: aviso → cicatriz J3 «Un control que compara una cifra que el otro instrumento sólo imprime cuando sale verde se salta los rojos sin decirlo: el control cuenta también a cuántos no pudo comparar.» — no se pudo comprobar: es un control de una medición puntual sobre logs ya bajados, fuera de la tanda; lo que queda es el denominador impreso en `b-salida-controles.txt`

**Quién midió y quién escribe.** La medición es de **J3g** (sólo lectura, entregada por mensaje al
orquestador; consta en SCRUM-1339 c.17934). Esta sección la escribe **J3h** copiando las cifras de
`b-salida-analizar.txt` y `b-salida-controles.txt`, que son del 1-oct-2026. **No he vuelto a correr
nada**: los 99 TAP y los 95 logs no se guardaron, y los guiones `b-*.mjs` son copia byte a byte
(sha256 comparado, 12 ficheros de 12) de los que produjeron esas salidas.

## Lo medido (99 artefactos `tanda-tap`, 1-oct-2026 de 10:27Z a 14:41Z)

| Qué | Cuánto |
| --- | --- |
| Artefactos bajados | 99 de 99 (97 runs) |
| TAP enteros (0 NUL, un resumen, líneas `ok` = `# tests`) | 81 de 99 |
| No enteros | 18: 14 con NUL (el último, 10:59:02Z) y 4 de tandas canceladas |
| Enteros desde que #1990 entró en `main` (artefacto de las 11:44:39Z) | 62 de 63; el otro, cancelado |
| Enteros con el árbol PROBADO resuelto | 79 de 81 (los otros 2, sin log) |
| **Con nombres declarados ausentes** | **36 de 79 (46 %) · 493 nombres** |
| De los 54 jobs verdes | 23 con pérdida |
| De los 9 pushes a `main` | 4 con pérdida, los 4 verdes |
| Bloques (fichero × job) | 53: 49 cola, 4 «fichero entero», 0 en medio |
| Lo que ve el suelo de hoy (SCRUM-702 + 1380) | 4 de los 36: los que traen entrada de fichero |

Los cuatro «fichero entero» son `scrum237-negacion-respaldada`, y son los únicos con entrada de
fichero en el TAP. Los ficheros que más pierden: `scrum524b` (10 jobs), `scrum834` (9),
`vigia-atascados` (8), `scrum1262` (5).

**El árbol es el que el job probó, no el de `main`.** Se reconstruye sin red con
`git merge-tree --write-tree <base> <cabeza>`, sacando los dos sha de la línea «Merge X into Y» del log.

## Los controles del instrumento

- «declara N» que imprime el suelo dentro del job == llamadas contadas en el árbol reconstruido:
  **75 de 77**, sin ninguno distinto. Según el traspaso de J3g, los 2 que faltan son los dos jobs
  cuyo suelo salió en rojo: el mensaje rojo no imprime esa cifra, así que el control no los pudo
  comparar (es la cicatriz de arriba). Yo no lo he vuelto a medir.
- `ℹ tests N` del log `spec` == `# tests N` del TAP: 76 de 77.
- Contra la comparación a mano del equipo de Luis en #2090 (su c.17922 de SCRUM-1366): nombra 12 de
  sus 15. Los otros 3 son de nombre construido en un bucle.

## Lo que une los dos tickets

`scrum237` tiene las DOS formas. El 27-sep perdió su cola (job 108673143125,
`b-log-27sep-job-108673143125-scrum237.txt`); el 29-sep, el fichero entero con entrada de fichero, en
un push a `main` verde (job 109481810520, `b-log-29sep-job-109481810520-scrum237.txt`), con el suelo
diciendo ✅ porque el TAP llegaba pisado. O sea: **SCRUM-1366 no es un intermitente nuevo del 1-oct;
se hizo visible cuando el TAP dejó de llegar pisado** (#2000 a las 10:47Z, #1990 a las 11:33Z).

**Decidido por el fundador:** cada equipo sigue con su ticket. Esta sección no toca
`scripts/suelo-de-la-tanda.mjs` ni nada de `area-s5`.

## Lo que este instrumento NO ve

Nombres construidos en un bucle · un nombre repetido en dos ficheros · no comprueba que lo ausente
fuera `pass` en otro run · sólo 2 de los 79 tienen un hermano del mismo árbol. **Causa: no demostrada.**
La hipótesis de J3g («la salida forzada gana a la escritura de los últimos informes del hijo») es de
IA y está sin probar; no se ha construido nada sobre ella.

## Lo que no está en git, y reproducir

Los 99 TAP y los 95 logs (430 MB). GitHub conserva los artefactos 7 días: **caducan el 8-oct-2026**.

    D=<carpeta fuera del árbol>
    cp docs/master/evidencias/SCRUM-1339/b-arts-hoy.tsv $D/arts-hoy.tsv
    node docs/master/evidencias/SCRUM-1339/b-bajar.mjs     $D      # taps/, logs/, bajados.tsv
    node docs/master/evidencias/SCRUM-1339/b-analizar.mjs  $D .    # analisis.tsv, faltan-por-fichero.tsv
    node docs/master/evidencias/SCRUM-1339/b-controles.mjs $D

# SCRUM-1339c · Los avistamientos del trinquete de zona: cola contigua, también con el fichero A SOLAS

**Medido contra:** `origin/main` = `8c0bf72850988e5f06266f330ab4c6c869f42a36` · 2026-10-01T15:28:36Z

A9: aviso → cicatriz J3 «Rotulé como «lo que cambió a solas» la lista que imprime el trinquete de zona, que es una intersección: antes de ponerle nombre a la cifra de otro instrumento se lee cómo la filtra.» — no se pudo comprobar: el rótulo era de un instrumento de evidencias, no de la tanda; lo cazó que la cifra del log (34) no cabía en la lista (3), y el instrumento ahora imprime esa diferencia

**El encargo** (orquestador, c.17938 y c.17943): ordenar por posición en el FICHERO los casos
`pass ↔ ausente` que el trinquete de zona denunció en los PR #2072 y #2071, para saber si son
contiguos o están salpicados. Sólo lectura de logs que ya existen. **No se ha tocado
`tests/vigia-atascados.test.mjs`, ni `scrum524b`, ni el trinquete, ni ningún workflow.**

## Lo medido

Jobs de zona: `110425624435` (run `36878986636`, #2072) y `110428904670` (run `36879667635`, #2071).
El orden sale del fuente por AST. El blob de `tests/vigia-atascados.test.mjs` es `741e399b` en la
cabeza y la base de los dos PR y en `main`; el de `scrum524b`, `4714abda`.

| run | fichero (casos) | en la pasada ENTERA | con el fichero A SOLAS (repesca) |
| --- | --- | --- | --- |
| #2072 | `vigia-atascados` (64) | faltan 31 en Midway: posiciones **34 a 64** | cambian 22: posiciones **43 a 64** |
| #2071 | `vigia-atascados` (64) | faltan 3 en Midway: **62 a 64** | cambian 34; el log sólo nombra 3 (62 a 64) |
| #2071 | `scrum524b` (41) | faltan 8 en Kiritimati: **34 a 41** | cambian 2: 38 y 39 |

Las tres pérdidas de la pasada entera son **contiguas y llegan hasta el final**. En `scrum524b` el
censo por AST sale CIEGO (sus nombres se construyen en un bucle: el punto ciego declarado, visto
actuar), y el orden se saca del informe del job obligatorio del mismo run, donde el fichero está
entero (`c-scrum524b-orden-de-informe-2071.txt`).

## Por qué «contiguo y hasta el final» NO dice que la pasada abortara

El encargo proponía: contiguos y hasta el final → abortó, no es este ticket; salpicados → sí lo es.
**Ese criterio no separa las dos cosas**, porque la cola contigua es la firma medida de este ticket
(§③: 45 de 45 bloques situables; SCRUM-1339b: 49 de 53). El orquestador lo retiró en c.17950.

Lo que sí habla contra un aborto por contenido, medido:

1. **Mismo blob, puntos de corte distintos.** En #2072, el mismo job cortó tras el caso 33 en la
   pasada entera y tras el 42 con el fichero a solas. En #2071, tras el 61. En `main` sobre
   `01d99084`, tras el 41 (c.17803). Un aborto por contenido cortaría siempre en el mismo sitio.
2. **Ninguna entrada de fichero.** Entre los candidatos de los dos logs hay 0 claves cuyo nombre sea
   una ruta. ⚠️ Sin control positivo en estos logs: ninguno trae un caso así con el que comparar.
3. **El obligatorio de esos mismos runs trae el fichero entero, por nombre:** `vigia-atascados`
   64 de 64 y en el orden del fichero, en los jobs `110425624016` y `110428904637`
   (`c-salida-presentes.txt`). Control negativo del lector: 0 de 64 sobre el log del job de zona.
   `scrum524b`: 41 líneas `✔` en cada uno de los dos, contadas por texto y no por AST (sus
   nombres se construyen en un bucle).

## Lo nuevo: se pierde también con UN fichero y sin carga

La repesca del trinquete vuelve a medir cada fichero candidato **a solas**, en las dos zonas. En los
dos jobs `vigia-atascados` volvió a cambiar de veredicto a solas (22 y 34 casos), y `scrum524b`
también (2). Hasta hoy lo medido en local era 0 de 120 (J6f, Windows). **No construyo nada con esto:**
un reproductor de un fichero × N con y sin `forceExit` toca el runner o un workflow.

Y explica cuándo el job sale rojo: sólo cuando la pérdida de la pasada entera se REPITE a solas
sobre los mismos nombres. Si no coincide, el job sale verde habiendo perdido casos.

## Dos datos de c.17938 que la medición corrige

- «Otros 9 casos del mismo fichero sí están en las dos»: no. Son las «NO CONFIRMADAS a solas»:
  faltaron también en la pasada entera (posiciones 34 a 42). La entera perdió 31, no 22.
- Los 22 no son lo que faltó: son lo que la repesca confirmó.
- (Menor) El último commit que toca el fichero en `main` es `e91a3741`, del 15-sep-2026.

## Lo que el trinquete no imprime (reportado, no tocado)

Sus «CAMBIAN DE VEREDICTO» son la **intersección** de lo que cambió en la pasada entera y lo que
cambió a solas. Lo que se pierde sólo a solas no sale en ningún sitio: en #2071 la línea dice
«confirma 34 de 3», y 31 de esos 34 no se pueden situar.

## Lo que NO sé

- Si los casos ausentes se ejecutaron y su informe no llegó, o no se ejecutaron. Lo separaría un
  testigo de ejecución dentro del test, y eso es tocar tests o runner.
- En qué zona faltaron a solas: el trinquete no lo imprime.
- Si los 2 de `scrum524b` a solas (38 y 39) son un bloque en medio o la diferencia entre dos colas
  de distinto largo (38 a 41 y 40 a 41). El log no lo distingue.
- **La causa. No demostrada.**

## Mis errores

- Mi lector por nombre importaba el otro guion, y éste ejecutaba su línea de órdenes al cargarse:
  salió «uso:» con código 2 en vez de medir. Lo delató el código de salida. Ahora lleva la puerta
  del principal.
- Mi primera salida decía «REPESCA A SOLAS · cambiaron 3» donde el log decía 34: rotulé la
  intersección como si fuera la repesca. Es la cicatriz de arriba.
- El mismo lector decía «el orden ES el del fichero» con 0 presentes (`[].every()` es verdadero).
  Lo vi en mi propio control negativo. Ahora dice que no puede juzgarlo.

## Reproducir (desde la raíz del repo)

    E=docs/master/evidencias/SCRUM-1339
    node $E/c-ordenar-por-fichero.mjs --autocontrol
    node $E/c-ordenar-por-fichero.mjs $E/c-zona-2072.txt tests/vigia-atascados.test.mjs tests/vigia-atascados.test.mjs
    node $E/c-ordenar-por-fichero.mjs $E/c-zona-2071.txt tests/vigia-atascados.test.mjs tests/vigia-atascados.test.mjs
    gh run view 36878986636 --job 110425624016 --log > <fuera del árbol>/build-2072.log
    node $E/c-presentes-en-el-obligatorio.mjs <fuera del árbol>/build-2072.log tests/vigia-atascados.test.mjs

Las posiciones valen mientras el blob del fichero siga siendo `741e399b`. Los logs de los jobs no
están en git (2,6 MB cada uno); los recortes del job de zona, sí (`c-zona-2072.txt`, `c-zona-2071.txt`).

# SCRUM-1339d · La señal por nombres, construida: avisa con fichero y líneas, y cuenta lo que no ve

**Medido contra:** `origin/main` = `cadf00bcee699dc200ff142050986a62b692b3c4` · 2026-10-01T16:51:01Z

A9: comprobación → `tests/scrum1339d-senal-de-nombres.test.mjs`

**El encargo** (orquestador del equipo de Javier; decisión en c.17935, autorizaciones del fundador
en c.17951 y c.17954, enmienda en c.17961, cruce de carril y contradicción resuelta en c.17966):
construir la cuenta de la señal como módulo puro + guion + test, y un paso NUEVO en `ci.yml` que
sólo anota su propio run. **Cruces declarados:** el ticket es `area-j6` y lo trabaja J3 por decisión
del orquestador; `ci.yml` es de S5 y corre en los PR de los dos equipos (autorización: c.17954).

## En corto

- **Construido:** `scripts/_senal-de-nombres.mjs` (puro), `scripts/senal-de-nombres.mjs` (guion,
  sale 0 siempre) y `tests/scrum1339d-senal-de-nombres.test.mjs` (17 casos, 5 mutaciones vistas caer).
- **Un paso nuevo en `ci.yml`**, tras «Guardar el TAP completo»: `if: always()`,
  `continue-on-error: true`, sin `env`, sin token. No es requerido y no puede bloquear.
- **Medido sobre 114 artefactos `tanda-tap` del 1-oct** (10:27Z a 16:12Z), cada uno contra el árbol
  que probó su job: 91 medibles, **41 con casos ausentes (28 en `success`)** y 50 limpios.
- **El punto ciego es mayor de lo que el diseño suponía, y va dicho en cada aviso:** lo que la
  señal nombra es un SUELO. En un job a `scrum524b` le faltaban 26 casos y nombró 3.
- **La punta de `main` (`cadf00bc`) perdió 6 casos de `scrum411` en su obligatorio y salió verde.**
- **`scrum859` (lo que J3h dejó sin medir):** el contenido del registro NO hace desaparecer sus
  cuatro casos. Salía CIEGO en el 22 % de los runs ANTES de que existiera #2114.

## ⓪ Antes de construir: el paso que «ya existe»

c.17935 decía «el paso ya existe y corre con `if: always()`» y c.17954 autorizaba uno nuevo. Las
dos frases no podían sostener la misma conclusión. Medido en `ci.yml` (job `test`, líneas de
`origin/main` en `cadf00bc`, antes de mi paso): hay cuatro pasos con `if: always()` y ninguno se
puede usar sin editar un guion ajeno.

| línea | paso | por qué no sirve |
|---|---|---|
| 301 | «¿Se puede leer el TAP de la tanda?» | corre `scripts/equipo/por-que-cayo.mjs` (S5) |
| 324 | «¿Ha perdido tests la tanda?» | corre `scripts/suelo-de-la-tanda.mjs`, con PR ajenos abiertos (#1990, #2000), y **no lleva `continue-on-error`**: un fallo mío ahí pondría rojo el obligatorio |
| 342 | «Guardar el TAP completo» | es un `uses:`, no ejecuta guion |
| 365 | «¿Cuánto ha tardado la puerta?» | shell dentro del propio `ci.yml` |

El paso nuevo es el cambio más pequeño y el único autorizado.

## ① Qué compara, y con qué criterio

«Todo test que el árbol declara con nombre LITERAL aparece en el TAP, tantas veces como se
declara.» Quién declara tests lo decide el censo de SCRUM-708 (`tests/_poblacion-de-tests.mjs`),
que se IMPORTA: da cuántas llamadas hay y no cómo se llaman, así que el módulo saca los nombres
con su propio recorrido y **ata su recuento al del censo** — fichero a fichero con
`testsDeclarados`, y el árbol entero con `testsDeclaradosEn(raiz)`. Si discrepan, no mide y lo dice.

Tres cosas medidas antes de escribirlo (banco `d-banco-de-nombres.txt`, node 24.18):

- **El escape no es invertible.** El reporter cambia primero los caracteres de control y después
  dobla la barra: un tabulador real sale como barra-barra-t, igual que una barra seguida de «t».
  Por eso se escapa lo DECLARADO y no se des-escapa lo registrado.
- **El TAP dice si una línea es suite o test** (`type:` en su bloque). Sin eso, un `describe('x')`
  taparía la pérdida de un `test('x')`.
- **El TAP no dice de qué fichero viene cada línea.** De ahí los «dudosos» de abajo.

**Multiplicidad** (la mejora de J3h): un nombre declarado dos veces tiene que llegar dos. Si no
llega ninguna, faltan las dos y cada fichero lleva la suya. Si llega una, falta una y no se sabe
cuál: sale como DUDOSO, contado aparte, y no se le cuelga a ningún fichero. En el árbol de hoy
hay 1 nombre repetido entre dos ficheros, y 0 dudosos en los 91 jobs.

## ② Lo medido sobre los TAP de verdad

Dos bancos: los 99 artefactos que bajó J3h (10:27Z–14:41Z) y 15 posteriores (14:52Z–16:12Z).
Instrumento: `d-contra-los-tap.mjs`. Salidas: `d-salida-contra-los-tap-*.txt`.

| | banco de J3h | los 15 nuevos | suma |
|---|---|---|---|
| artefactos con TAP | 99 | 15 | 114 |
| TAP no entero (NUL, o sin resumen) | 18 | 3 | 21 |
| sin árbol probado (falta el log) | 1 | 1 | 2 |
| **medibles** | 80 | 11 | **91** |
| con casos ausentes | 36 | 5 | **41** |
| … de ellos `success` | 23 | 5 | **28** |
| limpios (0 ausentes, 0 dudosos) | 44 | 6 | **50** |

- **Cruce con la sonda de J3h** (`b-analisis.tsv`, otro instrumento, mismas entradas): 79
  comparables de 80, **mismo veredicto en 79 y misma cifra en 79**. El que falta es un push que
  su sonda no resolvió por no tener log y la mía resuelve por el sha.
- **El guion sobre el disco y el módulo sobre objetos de git coinciden**: el TAP del obligatorio
  de `cadf00bc`, por los dos caminos, da 6 ausentes en `scrum411` (`d-salida-cli-arbol-real.txt`;
  los otros 17 de esa salida son los de mi propio test, que ese TAP no podía traer).
- **Coste:** 4,2 s sobre el árbol entero (1.193 ficheros, 9.547 llamadas), en esta máquina.

## ③ 🔴 El control positivo, con una segunda sonda que no mira ningún fuente

«Un run completo no anota nada» no se puede comprobar con la propia señal: si dice 0, dice 0.
`d-hermanos.mjs` compara los TAP de dos jobs que probaron el MISMO árbol, línea a línea, sin
leer un solo fuente. Lo que un hermano trae y el otro no es lo que se perdió de verdad.

| | jobs |
|---|---|
| árboles con más de un job | 7 |
| jobs en esos árboles | 14 |
| la señal nombra exactamente lo perdido (incluidos 7 limpios con 0 y 0) | 12 |
| la señal nombra MENOS de lo perdido | 2 (12 de 15, y 8 de 32) |
| **la señal nombra MÁS de lo perdido (falso positivo)** | **0** |
| hay pérdida y la señal calla | 0 |

**Lo que este control NO alcanza, dicho:** el encargo pedía cero falsos positivos «sobre los 85
jobs limpios medidos». Esos 85 son de la medición de J3g, hecha sobre nombres sacados de los LOGS
porque entonces el TAP llegaba roto; no existen como TAP y no se pueden pasar por un lector de
TAP. Lo que hay es: 50 jobs que la señal da por limpios, de los cuales **7 tienen un hermano que
lo confirma** y 43 no tienen con quién compararse. Cero falsos positivos está medido sobre 14
jobs, no sobre 85.

## ④ 🔴 El punto ciego, medido: lo que se nombra es un suelo

En el árbol de hoy **115 llamadas de 9.547 (1,2 %) llevan el nombre construido**, en 64
ficheros. Parecía poco. No lo es, porque UNA llamada dentro de un bucle registra muchos casos:

- job `11174308618` (push a `main`, `204d117b`, verde): le faltan **32** casos frente a su
  hermano. La señal nombró **8**. Los otros 24 son de `scrum524b` (23, de una sola llamada en un
  bucle) y de `scrum1262` (1).
- job `11164124022`: faltan 15, nombró 12.

La señal SÍ saltó en los dos (el fichero sale nombrado), pero la cifra se queda corta. Por eso:

- el aviso dice **«faltan AL MENOS N»** cuando en el mismo hueco hay llamadas de nombre
  construido, y dice cuántas;
- la línea de registro de cada run lleva `no_comparables=`;
- y queda un caso que esta señal NO ve y que el test deja escrito como tal: si se pierden SÓLO
  casos de un bucle, da 0. No se ha visto en los 14 jobs con hermano. No está descartado.

## ⑤ Los controles del encargo

| control | dónde se ve |
|---|---|
| ① el rojo: un run con ausentes sale anotado con fichero y rango | test «① EL ROJO…»; sobre TAP reales, las 41 filas de `d-salida-contra-los-tap-*.txt` |
| ② el positivo: un run completo no anota nada | test «② 🔴 EL POSITIVO…»; sobre TAP reales, la sección ③ de arriba |
| ③ la línea sale siempre, con su población | test «③ la línea de registro…» y «LA TASA…» (también con 0 y con 0 medidos) |
| ④ el guion roto sale 0 y lo dice | test «④ 🔴 EL GUION ROTO A PROPÓSITO…»: 9 roturas, entre ellas el guion sin su módulo |
| el punto ciego, contado e impreso | test «EL PUNTO CIEGO…»; línea `PUNTO CIEGO:` de cada salida |
| «declarados N» atado al censo | test ««declarados N» está ATADO…» |

Las cinco mutaciones declaradas, vistas caer una a una (`d-salida-mutaciones.txt`): 5 vivas, 0
mudas, 0 ciegas, sobre una base de 17 en verde.

**El control ④ sobre el PASO (no sobre el guion) sólo se puede enseñar en un run de verdad:** va
en el comentario de entrega del ticket, con el número del run.

## ⑥ `scrum859`, lo que J3h declaró sin medir

Su PR añadió dos secciones a este registro y el meta-guard salió rojo por `scrum859` CIEGO
(faltan 4 de 20 en la pasada mutada). Ese test trocea `docs/master`. ¿Contribuye el contenido?

- **La parte determinista, NO** (`d-salida-scrum859-local.txt`): 60 pasadas en esta máquina, con
  el registro de antes de #2114, con el de `main` y con el de esta rama (que añade esta sección),
  limpias y con la mutación que el propio `scrum859` declara. Las 60: 20 tests, los cuatro
  presentes. Mutada: 12 pasan y 8 caen, y el que tiene que caer, cae. En CI la mutada dio 9 y 7:
  son exactamente los cuatro últimos que faltan.
- **Ya pasaba antes** (`d-salida-meta-scrum859.txt`, 150 runs del CI de hoy, 83 juzgables):
  CIEGO en **18 de 81 runs (22 %) creados antes de que #2114 entrara en `main`**, el primero a
  las 10:32Z. Siempre «faltan 4 de 20», siempre los mismos cuatro, que son la COLA del fichero.
- **Después de #2114: 1 de 2.** Con dos runs no se puede decir si la frecuencia cambió.

Es la forma de SCRUM-1339 (cola contigua, un solo fichero, sin carga) dentro del meta-guard. **Y
es un candidato a reproductor que ya existe**: un fichero, una mutación, y pierde su cola una de
cada cinco veces en Linux. No lo he construido ni tocado: es del workflow de c.17951.

## Lo que NO sé

- Si el contenido de `docs/master` cambia la PROBABILIDAD de esa pérdida. Lo medido descarta que
  la cause; no que la empuje.
- Si `file=`/`line=` cuelga la anotación del fichero. No lo uso (c.17961) y no lo he medido.
- Cuántos casos faltan de verdad en los 34 jobs con ausentes que no tienen hermano.
- La causa. No demostrada.

## Mis errores

- Di «ausentes» como si fuera la cuenta de lo perdido. Lo desmintió la segunda sonda: 8 nombrados
  de 32. Ahora el aviso dice «al menos» y un test lo sujeta (es la línea A9 de arriba).
- Mi primer cruce buscaba el log por artefacto y no por run: dejó dos jobs «sin árbol» que J3h sí
  había resuelto. Lo delató que mi población medible (78) no casaba con la suya (79).
- Mi primera comparación de hermanos tomaba el máximo de `# tests` como «el completo» y contaba
  la línea de fichero entero como un caso: marcó «no cuadra» en cuatro jobs que cuadraban.
- Comprobé `ci.yml` con una librería que no está instalada, pasando el código a node por la
  línea de órdenes. No comprobó nada, y lo dijo con un error en vez de con un cero.

## Lo que no está en git, y reproducir

Los TAP no están en git (114, de 0,16 a 2,4 MB): son artefactos del CI y caducan a los 7 días.
Sí están las listas para volver a bajarlos (`b-arts-hoy.tsv`, `d-arts-banco2.tsv`) y lo que salió.

    E=docs/master/evidencias/SCRUM-1339
    node --test tests/scrum1339d-senal-de-nombres.test.mjs
    node $E/d-mutaciones.mjs . tests/scrum1339d-senal-de-nombres.test.mjs      # con el árbol commiteado
    node $E/b-bajar.mjs <fuera del árbol>/banco                                  # pide arts-hoy.tsv dentro
    node $E/d-contra-los-tap.mjs <fuera del árbol>/banco .
    node $E/d-hermanos.mjs <fuera del árbol>/banco/d-contra-los-tap.tsv <fuera del árbol>/banco/taps .
    node $E/d-scrum859-local.mjs . 10 antes=8c0bf72850988e5f06266f330ab4c6c869f42a36 main=cadf00bcee699dc200ff142050986a62b692b3c4 rama=ARBOL
    node $E/d-meta-scrum859.mjs <fuera del árbol>/meta 150
    node scripts/senal-de-nombres.mjs <un tanda.tap>                             # sobre el árbol del disco

## ⑦ El control ④ sobre el PASO, en un run de verdad (J3j, relevo de J3i)

Run `36901626137` (`pull_request`, head `601185c091d49391e4d78a4124c9c32a0e0c87f7`, creado
2026-10-01T17:44:37Z), con tres pasos temporales rotos a propósito detrás del bueno. El job «build
+ tests (con banco desechable)» salió `success`. Leído del log del job (2.700.194 bytes):

| paso | salida | qué dejó |
|---|---|---|
| el bueno | 0 | `::notice` «FALTAN al menos 5 en 2 fichero(s)» y 2 `::warning` con fichero y líneas |
| el TAP no existe | 0 | «NO PUDE MEDIR: no pude leer el TAP…» y su `::warning` |
| el TAP es basura | 0 | «NO PUDE MEDIR: el TAP no tiene resumen», `::notice` con `medible=no` y su `::warning` |
| el guion no existe | **1** | **nada propio**: node dice «Cannot find module» y GitHub deja una anotación `failure` |

- **Lo dicen dos, no tres.** «Incapaz de tumbar el job» descansa en dos construcciones: el guion,
  que sale 0 hablando, y `continue-on-error`, que calla. Si el guion desaparece, el paso sale con
  una ✗ roja en un job verde y sin la frase. Queda escrito en `ci.yml`, junto a esa línea.
- **Las anotaciones no cuelgan de ningún fichero del repositorio:** `path` = `.github` y la línea
  es la del log del paso (API de anotaciones del check-run `110501932336`). Era lo no medido de
  c.17961.
- **La señal cazó en su primer run:** ese obligatorio salió verde con 5 casos perdidos —
  `scrum286-bloques-orden` (4 de 24, la cola) y `scrum524b-trinquete-de-la-tabla` (1 de 12, el
  último). Comprobado aparte, buscando en el log los nombres declarados: los cuatro de `scrum286`
  no aparecen; el de `scrum524b` aparece empezado (`▶`) y sin resultado. No se tocó ninguno.
- Los 17 casos de `tests/scrum1339d-…`, 17 de 17 por nombre en ese log. Control del buscador:
  «SCRUM-267» 50 líneas, «scrum267» 0.
- Los tres pasos temporales se quitaron con un revert (`83a6af55`): el `ci.yml` volvió al blob del
  commit bueno (`34e473b9`). Después se añadió la frase de la segunda red y se mezcló `main`
  (`b3b40554`); `scrum812` chocó otra vez y su test dio 31 sobre el árbol fusionado.
- **El trinquete de `scrum812` exige que el ancla de su mutación ④ se mueva con la constante, y
  lo comprueba él mismo.** Subí sólo la constante (30 → 31) y cayó «mi ancla ④ muta la
  CONSTANTE»: la mutación declarada seguía diciendo «de 30 a 29» y habría salido ciega. Van
  juntas: la constante y las líneas `de:`/`a:` de su mutación.

**Mi error (J3j):** un recuento de «restos de los temporales» dio 0 porque la orden no llegó a
correr (Git Bash convirtió `origin/rama:ruta` en una ruta de Windows y git salió con `fatal`).
Lo delató el error impreso al lado del cero. Repetido por sha y con control positivo (9 sobre
`601185c0`), el número es 1, y es una línea de SCRUM-617 que ya estaba en `main`.

---

# SCRUM-1339e · La tasa, medida desde fuera: 1 de 4 con el paso, 11 de 21 por commit, y los que pierden son siempre los mismos 18 ficheros

**Medido contra:** `origin/main` = `d2ed6c8a2c4d2b3487c4557094d12915e9dfb83c` · 2026-10-02T02:29:55Z

A9: aviso → cicatriz J3 «Pasé por 229 árboles un instrumento que había nacido sobre 15 sin mirar qué guardaba en memoria: lo que cabe en la muestra no dice nada del lote.» — no se pudo comprobar: es un guion de evidencias que se lanza a mano fuera de la tanda; lo que queda es el arreglo en el propio guion, que ya sólo guarda el último árbol

**El encargo** (orquestador del equipo de Javier, `cobroflash-backend-5b`, 2-oct): volver a medir
la tasa de c.17935 sobre lo que hay HOY, desde fuera y con `gh` (c.17954 ②), y dejar la evidencia
en git. Lo hace J3a. Sólo lectura: ni `ci.yml`, ni código de la tanda, ni Jira hasta la entrega.

## En corto

- **La cifra que nombra la decisión (c.17935), leída de las anotaciones del paso: 1 de 4 runs del
  obligatorio en `main` con casos ausentes (25,0 %).** La población son los 4 commits de `main`
  cuyo árbol ya tiene el paso (`7080ba94` → `d2ed6c8a`). Los 4 dejaron su línea. **Contra el 5 %
  no se puede decir nada: la ventana es de 50 y hay 4.**
- **Por commit de `main`, recalculando con el TAP del artefacto** (sirve también para antes del
  paso): **11 de 21 medidos con ausentes (52,4 %)**, los 11 con el job en `success`. De 95 commits
  desde el 1-oct 00:00Z, 56 no tienen artefacto y 18 traen el TAP con bytes NUL.
- **Todos los jobs, de PR y de `main`: 48 de 110 medibles con ausentes (43,6 %)**; en `success`,
  35 de 80 (43,8 %). 229 artefactos, 119 no medibles.
- **No es una medición independiente de las del 1-oct.** 94 de los 110 medibles caen en la ventana
  que ya cubrían 1339b y 1339d. Lo nuevo son 16 jobs, 6 con ausentes. Con 16 no se afirma tendencia.
- **Los que pierden son siempre los mismos.** Los 72 bloques perdidos salen de 18 ficheros, y
  68 de 72 son la cola. Es una propiedad de esos ficheros, no un parpadeo repartido.
- **El paso ya avisó de una pérdida en `main`:** `16358193` (#2119) entró en verde sin 35 casos
  (30 de 64 de `vigia-atascados`, 5 de `scrum1262`), y su run lleva los dos `::warning`.
- **Un experimento del otro equipo, leído aquí (⑦):** doce tandas enteras del mismo árbol en
  Linux. Con `--test-force-exit` pierden casos 4 de 6; sin él, 0 de 6, y las seis dan 9.838.

## ⓪ La población y los instrumentos

229 artefactos `tanda-tap` creados entre el 2026-10-01T00:28:24Z y el 2026-10-02T02:05:33Z
(40 de push a `main`, 189 de PR; 225 runs). La lista sale de la API de artefactos, y su control
vio uno anterior a la hora pedida (`e-salida-listar.txt`). Bajados 229 de 229; 224 logs, y el
que falta es el del run de `d2ed6c8a`, que seguía en marcha (es un push: su árbol sale del sha).

Dos instrumentos sobre los mismos jobs:

- **(A) La anotación del paso.** `e-tasa-de-main.mjs` y `e-anotaciones.mjs` leen la `::notice`
  del check-run y la pasan por `registroDesdeLinea` y `tasaDeRegistros`, las del módulo de 1339d.
- **(B) El recálculo.** `d-contra-los-tap.mjs` (el de 1339d) pasa el TAP del artefacto por la
  señal contra el árbol que el job probó. No necesita que el paso existiera.

No uso el listado `actions/runs?branch=main&event=push`: devolvió como últimos runs del 17 y
18 de septiembre. Los runs de `main` se piden por el sha de cada commit del primer padre.

## ① La tasa de c.17935, por las anotaciones (A)

    [señal de nombres · tasa] 1 de 4 runs medidos con nombres ausentes (25.0 %) · población 4 runs
    · sin medir 0 · NO SE PUEDE DECIR si está por debajo del 5 %: hacen falta 50 runs medidos y hay 4

Sale igual por `e-tasa-de-main.mjs` y por `node scripts/senal-de-nombres.mjs --tasa` sobre
`e-registros-de-main.json` (`e-salida-tasa-cli.txt`). El job obligatorio corrió en los 4 commits.
Hacia atrás, `b3b40554` es el primero sin el paso en su árbol: de ahí no hay anotación que leer.

El 1-oct hubo 21 runs medibles de `main` en un día. A ese ritmo la ventana de 50 se llena antes
del 15-oct; es una cuenta sobre un día, no una medición.

## ② Por commit de `main`, con el recálculo (B)

| Commits de `main` desde el 1-oct 00:00Z (primer padre de `d2ed6c8a`) | 95 |
|---|---|
| sin artefacto `tanda-tap` | 56 |
| con artefacto y TAP no medible (bytes NUL) | 18 |
| medidos | 21 |
| **con ausentes** | **11 (52,4 % de los medidos)** |
| · anteriores al paso | 10 de 17 |
| · con el paso en el árbol | 1 de 4 |

Los 11, uno por uno, en `e-salida-anotaciones.txt` (④) y en `e-commits-de-main.tsv`. No he
separado por qué 56 commits no tienen artefacto (job que no corrió, o run cancelado por el
siguiente push antes de guardar el TAP). No cuentan como limpios ni como perdidos.

## ③ Todos los jobs, y lo que es nuevo

| | con ausentes | medibles |
|---|---|---|
| todos | 48 (43,6 %) | 110 |
| en `success` | 35 (43,8 %) | 80 |
| push | 11 | 21 |
| pull_request | 37 | 89 |
| hasta el 1-oct 16:24:08Z (ya cubierto por 1339b y 1339d) | 42 | 94 |
| después (nuevo) | 6 | 16 |

Los 119 no medibles: 109 con bytes NUL y 10 sin resumen (la tanda no llegó al final).

## ④ Los controles

- **El lector de anotaciones ve una que existe:** el check-run `110514502040` (la punta de #2118)
  da 3 anotaciones, una con línea de registro. Sin eso el guion no mide y sale 3.
- **Negativo:** de 220 jobs cuyo árbol NO tiene el paso, 0 traen línea de registro.
- **¿Habla siempre el paso?** De 9 jobs con el paso en el árbol, 8 dejaron UNA línea y ninguno
  calló. El noveno deja dos: es el run `36901626137`, el del control ④ de 1339d, con sus tres
  pasos rotos a propósito. Si el árbol tiene el paso se mira en el árbol, no por la hora.
- **(A) contra (B):** misma cifra de ausentes y de dudosos en 8 de 8 comparables.
- **Avisar, no sólo contar:** con ausentes y sin `::warning`, 0 de 2. Completos con `::warning`, 0 de 6.

## ⑤ Quién pierde: 18 ficheros, y casi siempre la cola

`e-por-fichero.tsv`. 72 bloques en 48 jobs, de 18 ficheros distintos sobre unos 1.190 de `tests/`:

| fichero | veces | declara | faltan |
|---|---|---|---|
| `scrum524b-trinquete-de-la-tabla` | 16 | 12 | 1 a 3 (al menos) |
| `scrum834-puerta-avisador-rojo` | 11 | 53 | 2 a 35 |
| `vigia-atascados` | 11 | 64 | 4 a 42 |
| `scrum1262-la-baja-corta-todas-las-vias` | 8 | 10 | 1 a 5 (al menos) |
| `scrum237-negacion-respaldada` | 4 | 8 | 8 (entero) |
| otros 13 | 1 a 3 cada uno | 10 a 32 | 1 a 10 |

68 de los 72 bloques son de ficheros que sólo pierden la cola; los otros 4 son `scrum237`, que
pierde el fichero entero. Buscando por texto no comparten nada evidente: casi todos son tests
síncronos, sin procesos hijos ni temporizadores. **No sé qué los distingue.** Es la pregunta que
le toca al reproductor (1339f): si la pérdida fuera azar repartido, no repetirían 18 de 1.190.

## ⑥ Cómo se vuelve a medir (el 15-oct, o antes)

    node docs/master/evidencias/SCRUM-1339/e-tasa-de-main.mjs origin/main <carpeta fuera del árbol>

Tarda segundos y no baja ningún TAP: tres llamadas a `gh` por commit. Para cuando junta 50 runs
medidos, y entonces la línea dice «por DEBAJO» o «por ENCIMA» del 5 %. Lo que no es un run medido
(sin run de CI, job saltado, job que corrió y no dejó línea, «medible=no») va contado aparte.

## ⑦ Lo que dicen los doce TAP del experimento del otro equipo (leído, no concluido)

El equipo de Luis corrió el 1-oct a las 14:00:51Z un experimento para SCRUM-1384: rama
`exp-1384-informe-truncado` (no está en `main`), workflow propio, run `36873018664`. Doce tandas
ENTERAS del mismo árbol (`1da4852f`, sobre `3017ae0c`) en Linux: seis con `--test-force-exit` y
seis sin. Su ticket no tiene comentarios y los doce TAP caducan a los tres días. Los pasé por la
señal de nombres contra el árbol de su commit (`e-exp1384.mjs`). Sólo lectura: ni su rama, ni su
workflow, ni su ticket.

| brazo | tandas medibles | con ausentes | `# tests` de cada tanda |
|---|---|---|---|
| con `--test-force-exit` | 6 de 6 | **4** | 9.838 · 9.820 · 9.837 · 9.812 · 9.838 · 9.828 |
| sin `--test-force-exit` | 6 de 6 | **0** | 9.838 las seis |

- **Las seis sin el flag dan el mismo recuento, 9.838, que es el máximo de las seis con el flag.**
  Con el flag faltan 18, 1, 26 y 10 casos por recuento (55); la señal nombra 39. Es un suelo.
- **Pierden los mismos:** `scrum834` (20 y 10 de 53), `scrum1262`, `scrum524b` y `scrum888g`.
  Los cuatro están entre los 18 de ⑤, y siempre es la cola.
- Ninguna de las doce tiene fallos. Las seis sin el flag llegaron a su resumen y tardaron lo
  mismo que las otras (371 a 544 s frente a 318 a 518 s): ninguna se quedó colgada.

**Lo que esto NO dice.** Son seis tandas por brazo, de un solo árbol y de una sola tarde: si el
flag no influyera, que las cuatro pérdidas cayeran todas en el mismo brazo pasaría 3 veces de
cada 100. No es una demostración de la causa, y la conclusión del experimento es de quien lo
diseñó. Tampoco dice qué costaría quitar el flag: no lo he medido, y no es una decisión de aquí.

**Lo que cambia para el reproductor (1339f, sin empezar).** c.17951 pedía «con y sin
`--test-force-exit`» sobre un fichero. Ese contraste ya existe sobre la tanda entera. Lo que sigue
sin saberse, y es lo que un reproductor puede contestar, es qué tienen esos 18 ficheros y si los
casos que faltan se ejecutaron.

## El hueco declarado

Dirigida local NO corrida — decisión del orquestador; `guards:entrada` sí: 12 guards, 132
tests, 0 caen, 17 s; el obligatorio del CI es la primera pasada entera sobre esta rama. La rama
sólo toca `docs/`.

## Lo que NO sé

- La tasa sobre la ventana de 50. Hay 4 runs con el paso y 21 con el recálculo.
- Si la tasa ha cambiado desde el 1-oct. Lo nuevo son 16 jobs.
- Por qué 56 de 95 commits de `main` no tienen artefacto.
- Cuántos casos faltan de verdad: lo que se nombra es un suelo (1339d, ④).
- Qué tienen en común los 18 ficheros. Y la causa, que sigue sin demostrar.

## Mis errores

- Pasé `d-contra-los-tap.mjs` por 229 árboles sin mirar que guardaba todos en memoria. Murió a
  los cinco minutos con 4 GB ocupados, en una máquina que comparten seis sesiones. De esa pasada
  no usé nada. El guion ya sólo guarda el último árbol, y la pasada se repitió entera.
- Mi primera salida rotulaba «CALLADO» al job que dejó DOS líneas de registro. No calla: es el
  run de los pasos rotos a propósito. El rótulo se separó en «callados» y «otra cosa».
- Un parche pasado a `node` por un heredoc de bash no aplicó (las barras se doblan). Avisó con
  un error y no escribió nada; los cambios se hicieron editando el fichero.

## Lo que no está en git, y reproducir

Los 229 TAP (115 MB) y los 224 logs no están en git: son artefactos del CI y caducan a los 7
días. Sí está la lista para volver a bajarlos (`e-arts.tsv`) y todo lo que salió (`e-*.tsv`,
`e-salida-*.txt`).

    E=docs/master/evidencias/SCRUM-1339
    node $E/e-listar.mjs <fuera del árbol>/banco 2026-10-01T00:00:00Z            # escribe arts-hoy.tsv
    node $E/b-bajar.mjs <fuera del árbol>/banco
    node $E/d-contra-los-tap.mjs <fuera del árbol>/banco . <fuera del árbol>/banco
    node $E/e-anotaciones.mjs <fuera del árbol>/banco . <fuera del árbol>/banco 2026-10-01T00:00:00Z d2ed6c8a2c4d2b3487c4557094d12915e9dfb83c 2026-10-01T16:24:08Z
    node $E/e-tasa-de-main.mjs origin/main <fuera del árbol>/banco
    node scripts/senal-de-nombres.mjs --tasa <fuera del árbol>/banco/e-registros-de-main.json
    git fetch origin exp-1384-informe-truncado                                   # mientras exista la rama
    node $E/e-exp1384.mjs <fuera del árbol>/banco . $E/e-por-fichero.tsv         # los TAP caducan el 4-oct


# SCRUM-1339g · La tasa sobre la ventana de 50 runs: 28 de 50 (56 %). No baja, y el obligatorio sólo corre en 50 de 138 commits de `main`

**Medido contra:** `origin/main` = `12ecc7bb3bad377e729a01b09fd755f978e125b9` · 2026-10-07T15:51:42Z

A9: sin fallo que generalice — el tropiezo de la tanda (leer un contador en cero como «la medición está colgada») se deshizo mirando el proceso antes de actuar y no cambió ninguna cifra; va contado en «Mis errores»

**El encargo** (orquestador del equipo de Javier, `cobroflash-backend-90`, 7-oct): dejar la decisión
de c.17935 lista para tomarse, con el número de la ventana delante. Lo hace J6 (sesión `jv-j6`).
Sólo lectura: ni `ci.yml`, ni `scripts/`, ni tests. Se usa el instrumento de 1339e sin tocarlo.

## En corto

- **La tasa de c.17935, por primera vez con la ventana completa: 28 de 50 runs del obligatorio en
  `main` tienen nombres ausentes (56,0 %).** Está por ENCIMA del 5 %: según c.17935, la señal no
  pasa a bloquear.
- **Si se activara hoy, pondría en rojo 24 de los 46 jobs verdes de la ventana (52 %).** Los otros
  4 con ausentes ya eran rojos.
- **No ha bajado.** El 1-oct eran 23 de 54 jobs verdes (43 %, c.17934) y 11 de 21 commits de
  `main` (52 %, 1339e). Son poblaciones distintas a la de hoy y no se restan; ninguna está cerca
  del 5 %.
- **Lo que se pierde es el final del informe, no nombres sueltos.** 587 casos en los 28 runs: de 1
  a 59 por run, mediana 18. En 18 ficheros, y siempre la cola, salvo `scrum237`, que sale entero.
- **🔴 La población, que nadie había pedido: para juntar 50 runs medidos hubo que recorrer 138
  commits de `main`.** El obligatorio corrió en 50 (36 %). En 80 el run de CI salió `cancelled`
  con 0 jobs, 7 no tienen run de CI y 1 estaba en cola. La tasa es de los que corrieron.
- **El 15-oct sigue valiendo como fecha de revisión, pero el número no va a cambiar para
  entonces** (lectura de J6, abajo). La causa está medida en SCRUM-1405 y el flag sigue puesto.

## ⓪ La población y el instrumento

`e-tasa-de-main.mjs` (de 1339e, sin cambios) recorre la línea principal de más nuevo a más viejo y
lee, de cada commit, la `::notice` que el paso de la señal dejó en el job obligatorio de su run de
push. Para cuando junta `VENTANA_DE_RUNS` = 50 runs medidos. No baja ningún TAP.

| qué | cuánto |
|---|---|
| commits recorridos desde `12ecc7bb` | 138 (2-oct 01:54:30Z → 7-oct 15:43:04Z) |
| el job obligatorio corrió y dejó registro medible | **50** |
| run de CI `completed/cancelled` con 0 jobs | 80 |
| sin run de CI | 7 |
| run en cola al medir | 1 |
| no pude preguntar | 0 |

Los 80 se preguntaron uno a uno (`g-desglose.mjs`, dos llamadas por run): los 80 dicen lo mismo.
No he medido QUIÉN los cancela; lo que se ve es que el run de un commit de `main` deja de existir
como medición cuando entra el siguiente. **Dos de cada tres commits de `main` no tienen veredicto
propio del obligatorio**, y eso es anterior a la señal y no depende de ella.

Control positivo del lector, dentro del instrumento: el check-run `110514502040` trae su línea de
registro. Si no la viera, el guion sale 3 sin medir.

## ① La tasa

    [señal de nombres · tasa] 28 de 50 runs medidos con nombres ausentes (56.0 %) · población 50 runs · sin medir 0 · por ENCIMA del 5 % sobre 50 runs medidos · tope 2026-10-15 (SCRUM-1339 c.17935)

La línea la imprimen los dos caminos: el instrumento (`g-salida-tasa-de-main.txt`) y el guion de la
casa con `--tasa` sobre el json de registros (`g-salida-tasa-cli.txt`, salida 0). No son dos
mediciones: es la misma función (`tasaDeRegistros`) sobre los mismos 50 registros.

| | completos | con ausentes |
|---|---|---|
| job `success` | 22 | **24** |
| job `failure` | 0 | 4 |

| día (UTC) | con ausentes | de |
|---|---|---|
| 2-oct | 14 | 25 |
| 6-oct | 11 | 19 |
| 7-oct | 3 | 6 |

Entre el 2-oct a las 18:00Z y el 6-oct a las 11:08Z no hay ningún run medido en la ventana.

**Coherencia interna de lo leído:** con ausentes y SIN `::warning` de la señal, 0 de 28; completos y
CON `::warning`, 0 de 22. El registro y los avisos de cada run dicen lo mismo.

## ② La forma

- 587 casos ausentes en 28 runs. Por run: mínimo 1, mediana 18, máximo 59.
- 18 ficheros distintos (un fichero cuenta una vez por run): `vigia-atascados` en 9 runs,
  `scrum834` en 6, `scrum1379b` en 5, `scrum853` y `scrum524b` en 4, `scrum1262` y `scrum1344` en
  3; siete ficheros en 2 y cuatro en 1. La lista entera, en `g-salida-desglose.txt`.
- Todos los bloques son «(cola)», menos los dos de `scrum237`, que son «(entero)»: el fichero sale
  en el TAP como una línea.
- Son 18 ficheros, como en 1339e, pero no los mismos 18: cruzados por nombre con
  `e-por-fichero.tsv`, 13 repiten y 5 son nuevos (`scrum1379b`, `scrum853`, `scrum1344`,
  `scrum811c` y `scrum514`). No he mirado si los 5 existían el 2-oct.

Esto es lo que SCRUM-1405 predice: pierden los que más escriben, y pierden el final. Lo que falta
son informes de casos que sí corrieron (allí, 53.433 de 53.433 con su testigo de ejecución).

## ③ Qué pasa el 15-oct — LECTURA DE J6, no medición

1. Con el 56 %, c.17935 dice que no se bloquea. La revisión del 15-oct no es «¿bloqueamos ya?».
2. La causa está demostrada y en `main` (SCRUM-1405): `--test-force-exit`. El flag sigue en el
   script `test` de `package.json` (línea 11, leída sobre `12ecc7bb`). Mientras siga, no hay motivo
   para que la tasa baje: lo que se lea el 15 será parecido a esto.
3. La decisión que mueve el número es cuál de las tres salidas de SCRUM-1405 §⑤ se toma. Las tres
   cambian lo que ejecuta el obligatorio y son del fundador. La señal puede bloquear después.
4. Si nadie decide nada: el 15-oct no ocurre nada. El guion sale 0 siempre, por decisión firmada
   (c.17935, c.17954), y sigue avisando. Y siguen entrando en `main` verdes sin entre 1 y 59
   nombres, la mitad de las veces.

No propongo mover la fecha.

## ④ Lo que se consideró y NO se hizo

**Una línea fija en la salida de cada run** que dijera el plan: «AVISA y NO BLOQUEA · umbral 5 % ·
ventana 50 · se revisa como tarde el 2026-10-15». Habría sido una función pura en
`scripts/_senal-de-nombres.mjs` y una llamada en el CLI, fuera de la `::notice` y de la línea de
registro (que es lo que parsea el lector de la tasa).

No se escribe, por decisión del orquestador sobre estos dos platos:

- **Valor pequeño.** El nombre del paso de `ci.yml` ya dice «avisa, no bloquea», y `--tasa` ya
  imprime umbral, ventana y tope. Las tres constantes NO están sin usar: `tasaDeRegistros` y
  `lineaDeTasa` las aplican. Lo único que no hacen es cambiar un código de salida, y eso es lo
  firmado.
- **Coste.** Tocar dos ficheros sin fila propia en `dos-equipos.md` §3.3, que corren dentro del
  obligatorio de los dos equipos.

**Tampoco se fabricó «una tanda con más del 5 % de casos ausentes que sale 0».** El 5 % de c.17935
es de RUNS con algún ausente sobre 50, no de casos dentro de una tanda. Esa tanda saliendo 0
enseñaría la decisión, no un defecto.

## ⑤ De quién son los dos guiones (leído, no decidido)

`node scripts/carriles.mjs de scripts/senal-de-nombres.mjs` y lo mismo para
`scripts/_senal-de-nombres.mjs`: «SIN CERRADURA», por la fila general de `scripts/`
(`dos-equipos.md` línea 171 en `12ecc7bb`), que dice de sí misma que no recoge lo que nadie
clasificó. La fila de S3 (línea 175) los deja fuera a propósito, porque «tienen ticket vivo del
equipo de Javier». `tests/scrum1339d-senal-de-nombres.test.mjs`: «sin fila en §3: nadie lo
reclama». Es un hueco declarado. La tabla es de la S0 y no se ha tocado; la propuesta la lleva el
orquestador por Jira.

## Lo que NO sé

- **La tasa en los runs de PR**, que es donde un bloqueo mordería. El instrumento sólo recorre
  `main`, que es la ventana de c.17935.
- Si los 88 commits sin medir habrían perdido más o menos que los 50 medidos.
- Quién cancela los 80 runs, y si es a propósito.
- No he vuelto a bajar ningún TAP: las cifras son las que dejó el paso en cada run. El control de
  1339e (anotación contra recálculo, 8 de 8) no se ha repetido hoy.

## Mis errores

- Creí que la medición llevaba ocho minutos colgada. Llevaba uno. Leí un «used 0» del límite de
  la API como «no está llamando». Miré el proceso antes de matarlo y estaba vivo.
- El reloj de la máquina va una hora por detrás de Madrid. Las horas de esta sección son de GitHub.
- Mi primer desglose contaba un fichero dos veces si el aviso de un run lo nombraba dos veces. No
  cambió ninguna cifra (ningún run lo hace hoy); `g-desglose.mjs` cuenta una vez por run.

## Lo que no está en git, y reproducir

Todo lo que salió está en git (`g-*`). Las anotaciones viven en GitHub mientras conserve los runs.

    E=docs/master/evidencias/SCRUM-1339
    node $E/e-tasa-de-main.mjs origin/main <fuera del árbol>/banco
    node $E/g-desglose.mjs <fuera del árbol>/banco/e-tasa-de-main.tsv
    node scripts/senal-de-nombres.mjs --tasa <fuera del árbol>/banco/e-registros-de-main.json


# SCRUM-1339h · ¿Está inflada la tasa por ficheros que no arrancaron o murieron? El mecanismo existe; en la ventana de 50 runs suma 0 de 587. La tasa sigue en 28 de 50

**Medido contra:** `origin/main` = `6536e63e038ef36be9d61fc8057a649ff2af3149` · 2026-10-07T17:16:32Z

A9: comprobación → `tests/scrum622-desconocido-no-es-verde.test.mjs`

**El encargo** (orquestador del equipo de Javier, `cobroflash-backend-90`, 7-oct): J4, construyendo
SCRUM-1389, midió que la señal de nombres cuenta los casos de un fichero no arrancado como
«ausentes». Si eso pasa en la ventana, la tasa de 1339g (28 de 50) está inflada. Tres preguntas:
confirmar el mecanismo, cuantificarlo sobre los 587 casos, y dar la tasa corregida. Lo hace J6
(sesión `jv-j6`, relevo de J6n). **Sólo lectura: no se toca la señal, ni `scripts/`, ni tests, ni
`ci.yml`.** Entran esta sección y nueve ficheros `h-*` en evidencias.

## En corto

- **El mecanismo que midió J4 es cierto, y está confirmado por efecto.** Un fichero que muere al
  cargar, o a medias, mete todos sus casos en «ausentes» (también el que había pasado), el run
  cuenta en la tasa, y el aviso dice de él «corrió y no informó de sus casos», que es falso. El
  TAP trae la entrada como caída y con su `exitCode`; la señal lee que cayó y no lo usa.
- **En la ventana de 50 runs no ha ocurrido ni una vez: 0 de los 587 casos ausentes vienen de un
  fichero que no arrancó o que murió.** Leídos los 50 TAP de la ventana, no sólo los avisos.
- **La tasa corregida es la misma: 28 de 50 (56,0 %).** Y 24 de los 46 verdes. La cifra que vale
  para el 15-oct no cambia.
- **Por qué no podía moverse en los verdes, y esto no depende de mi lector:** un fichero caído
  cuenta como `fail`, y un run con `fail > 0` no sale verde. Los 24 verdes con ausentes llevan
  `# fail 0`. La inflación sólo cabía en los 4 runs rojos, y en los 4 está mirado caso a caso.
- **Lo que sí hay, y no es lo que describió J4:** 16 de los 587 (dos bloques de `scrum237`, en
  dos runs rojos) son de un fichero que corrió 3,8 s, salió con 0, y no dejó ninguno de sus 8
  casos. Su entrada en el TAP es `ok`. Es la pérdida de SCRUM-1405 a tamaño de fichero entero, no
  un fichero muerto. Si alguien quisiera apartarlos, la tasa sería 27 de 50 (54,0 %); no lo propongo.

## ① El mecanismo: leído y por efecto

Leído en `scripts/_senal-de-nombres.mjs` sobre `6536e63e`:

- `leerTap` guarda, de cada línea de nivel 0 cuyo nombre acaba en `.test.mjs`,
  `{ fichero, caida }` (línea 159). `caida` es el `not ok`.
- `senalDeNombres` usa esa lista en un solo sitio (línea 297):
  `conEntradaDeFichero: t.entradasDeFichero.some((e) => e.fichero === …)`. Mira si la entrada
  EXISTE. `caida` no lo lee nadie en todo el módulo. `exitCode`, `signal` y `spawn` no se leen.
- `describirBloque` (línea 313) le pone a todo bloque con entrada la misma frase: «corrió y no
  informó de sus casos».
- `tasaDeRegistros` cuenta el run si `ausentes > 0`, venga de donde venga.

Por efecto (`h-efecto.mjs`, salida en `h-salida-efecto.txt`): un árbol de mentira fuera del repo,
corrido con `node --test` de verdad (node v24.18.0, win32) y su TAP pasado a la señal de la casa
sin tocarla.

| caso | `node --test` | lo que trae el TAP | lo que dice la señal |
|---|---|---|---|
| control: un fichero limpio | sale 0 · tests 2 · fail 0 | ninguna entrada de fichero | ausentes 0 · no cuenta en la tasa |
| muere al cargar (import que no resuelve), 3 casos | sale 1 · tests 3 · fail 1 | entrada caída · `exitCode: 1` · `error: 'test failed'` | **ausentes 3** · «corrió y no informó de sus casos» · cuenta en la tasa |
| muere a medias (pasa uno y `process.exit(1)`), 3 casos | sale 1 · tests 3 · fail 1 | lo mismo | **ausentes 3**, el que pasó incluido · la misma frase · cuenta en la tasa |

El proceso que no llega a crearse (`spawn … ENOENT`) no lo he fabricado: lo midió J4 en SCRUM-1389,
caso 9 (entrada caída, sin `exitCode`). Por lectura cae en la misma rama.

## ② La cuantificación, por dos caminos

**Población:** los 50 runs medidos de la ventana de 1339g (`g-tasa-de-main.tsv`, 2-oct 01:54:30Z →
7-oct 15:43:04Z), 28 con ausentes, 52 bloques, 587 casos. No he vuelto a medir la ventana: es la
misma, para que la cifra corregida se pueda poner al lado de la de 1339g.

**Camino A, lo que dicen los avisos** (`h-separar.mjs`, sin bajar nada). Los 52 bloques suman 587,
que es lo que suma el registro; 0 avisos sin parsear.

| forma · entrada de fichero · job | bloques | casos | runs |
|---|---|---|---|
| cola · sin entrada · `success` · `fail 0` | 46 | 519 | 24 |
| cola · sin entrada · `failure` · `fail 1` | 3 | 36 | 2 |
| cola · sin entrada · `failure` · `fail 0` | 1 | 16 | 1 |
| entero · CON entrada · `failure` · `fail 0` | 2 | 16 | 2 |

**Camino B, los TAP** (`h-bajar-taps.mjs` y `h-entradas.mjs`). Bajado el artefacto `tanda-tap` de
los 50 runs (`h-bajados.tsv`: 50 de 50) y leído con el `leerTap` de la casa.

- Los 50 TAP están enteros y sin bytes NUL, y cada uno trae el mismo `# tests` y `# fail` que la
  línea de registro de su run: es el TAP que midió el paso. Descuadres: 0.
- **Entradas de fichero en los 50 TAP: 2. Caídas: 0. Con `exitCode`, señal o `spawn`: 0.**
- Las 2 son de `tests/scrum237-negacion-respaldada.test.mjs`, en `f30b1a40` y `7779b0cb`, y son
  `ok`, sin `exitCode`. En el TAP de `f30b1a40` el fichero dura 3.806 ms y sus líneas de
  diagnóstico están justo encima: corrió.
- Cruce bloque a bloque: 50 bloques (571 casos, 27 runs, 17 ficheros) no tienen entrada de
  fichero: el fichero informó de su cabeza y perdió la cola. 2 bloques (16 casos) tienen la
  entrada `ok`.

**El camino que no depende de cómo se escriba la entrada.** Un fichero caído cuenta como `fail`
(SCRUM-1389 ①). 48 de los 50 TAP llevan `# fail 0`: ahí no hay ninguno, lo lea como lo lea. En
los otros 2, la única línea `not ok` de nivel 0 es un caso con nombre, no un fichero: «SCRUM-1378
· `leerTrabajos`…» en `28222517` y «SCRUM-1415 · 🔴 EL ÁRBOL…» en `643e9a65`.

Los dos runs rojos con `fail 0` (`f30b1a40`, `7779b0cb`) cayeron en el paso 15, «¿Ha perdido tests
la tanda?» (el suelo), no en la tanda. Preguntado a la API por sus jobs `110932298624` y
`110720546826`.

| de los 587 casos ausentes | casos | bloques | runs |
|---|---|---|---|
| de un fichero que NO ARRANCÓ o MURIÓ | **0** | 0 | 0 |
| de un fichero que corrió, salió con 0 y no dejó ningún caso | 16 | 2 | 2 |
| de un fichero que informó de su cabeza y perdió la cola | 571 | 50 | 27 |

(Un run, `7779b0cb`, está en las dos últimas filas.)

## ③ La tasa corregida

| | 1339g | quitando lo de ficheros no arrancados o muertos |
|---|---|---|
| runs con ausentes, de 50 | 28 (56,0 %) | **28 (56,0 %)** |
| verdes con ausentes, de 46 | 24 | **24** |
| casos ausentes | 587 | **587** |

No hay nada que quitar. La otra lectura posible, apartar también los dos bloques «entero» de
`scrum237`, daría 27 de 50 (54,0 %), 24 de 46 verdes y 571 casos: `f30b1a40` sale de la cuenta y
`7779b0cb` se queda por su cola de `scrum834`. No la doy como corregida, porque esos 16 casos se
ejecutaron y se perdió su informe, que es lo que la tasa quiere contar.

## ④ Los controles

- **De cero:** una marca inventada en los avisos («el fichero NO SALE en el TAP») → 0 bloques. Una
  entrada de un fichero que no existe (`scrum9999-no-existe.test.mjs`) → 0. El árbol limpio del
  banco → 0 ausentes y 0 entradas.
- **Positivo del lector de entradas:** un TAP fabricado con un fichero caído → 1 entrada, caída,
  `exitCode` 1; el lector de la casa ve la misma. Y el banco de ① da una entrada caída por cada
  fichero muerto.
- **Dos lectores:** mi lector de bloques y `leerTap` ven las mismas entradas en los 50 TAP.
- **Las sumas:** 52 bloques y 587 casos por los dos caminos; 519 + 36 + 16 + 16 = 587.

## ⑤ Una variante que no estaba descrita: el fichero que termina bien y no informa de nada

Los dos bloques con entrada de fichero no son ficheros muertos. `scrum237-negacion-respaldada`
corrió 3,8 s, salió con 0 y no dejó ninguno de sus 8 casos. Su entrada en el TAP es `ok`, sin
`exitCode`. Pasó dos veces en la ventana, en `f30b1a40` y en `7779b0cb`.

Es la pérdida de SCRUM-1405 a tamaño de FICHERO ENTERO, no a tamaño de caso. Lo descrito hasta
ahora era un fichero que informa de su cabeza y pierde la cola.

Lo que la distingue de un fichero caído, todo leído del TAP:

| | fichero caído (banco de ①) | `scrum237` en la ventana |
|---|---|---|
| línea del fichero | `not ok` | `ok` |
| `exitCode` | sí (1) | no hay |
| `# fail` del TAP | sube en 1 | 0 |
| el job | rojo por la tanda | la tanda pasa; rojo por el suelo (paso 15) |

La señal les pone a los dos la misma frase. Para `scrum237` es cierta. Para un fichero caído, no.

Los dos runs salieron rojos porque el suelo vio que faltaban tests. No he mirado qué margen tenía
el suelo esos dos días, ni si un fichero más pequeño que se pierda entero cabría dentro y saldría
verde.

## Lo que NO sé y lo que NO he hecho

- **No he arreglado la señal.** Era el encargo: primero el número. El defecto de ① sigue en
  `main`: el día que un fichero muera en un run, sus casos subirán la tasa y el aviso dirá de él
  una frase falsa. Es la salida B de SCRUM-1389 y está sin decidir.
- **Que no haya pasado en 50 runs no dice cada cuánto pasa.** J4 leyó 124 corridas con el rojo
  del obligatorio a la vista y encontró 1 fichero caído (`scrum804b`, run `36806690822`).
- **El testigo real en Linux no lo tengo.** Bajé el TAP de ese run para ver una entrada caída de
  verdad escrita por el CI: llega con 2.198.683 bytes NUL de 2.346.221 (el 93,7 %) y dos
  resúmenes `# tests`, y no se puede leer. Es el TAP pisado de SCRUM-1328 (allí, «el 94 % de bytes
  NUL»), visto en un artefacto del 1-oct. Los 50 de la ventana, del 2-oct en adelante, llegan con
  0. La forma de la entrada caída está medida en Windows (aquí y en SCRUM-1389). Por eso va el
  camino del `# fail`, que no depende de ella.
- **Los runs de PR siguen sin medir.** Ahí un fichero que muere por el cambio que se prueba es más
  probable que en `main`, y ahí sí inflaría. La ventana de c.17935 es de `main`.
- Los 88 commits de `main` sin run medido no entran, como en 1339g.
- Por qué `scrum237` es el único que se pierde entero. No lo he mirado.
- No he corrido la tanda completa. Este PR no añade ni cambia ningún test.

## Mis errores

- **Empujé con el obligatorio en rojo por un guion mío.** `h-entradas.mjs` imprimía el estado de
  una entrada con `caida ? 'not ok' : 'ok'`, y `scrum622` censa en todo el árbol, evidencias
  incluidas, cualquier expresión que acabe en «ok» por descarte. Cayó «SCRUM-622 · 🔴 EL CENSO» en
  el run `37659284278` (job `112923098127`, 11.010 tests, 1 cae). Arreglado en el guion, sin tocar
  el guard: ahora imprime el texto leído de la línea del TAP. Las cifras no cambian; las salidas
  regeneradas son idénticas byte a byte.
- Mi muestra local de guards (12 ficheros) no incluía `scrum622`. La herramienta de la casa
  tampoco lo habría seleccionado: `tests-que-cubren.mjs` da 222 de 1.286 para esta rama y
  `scrum622` no está entre ellos. Lo corrí después a mano; este árbol no tiene `dist/`, así que
  de la dirigida sólo vale lo que no nombra `dist/`.
- Escribí los guiones sobre una copia del TSV sacada con `git show`, y al correrlos sobre el
  fichero del árbol reventaron: allí llega con CRLF y la última columna se llamaba `avisos\r`.
  Salieron con 1 y sin cifras. Ahora parten por `\r?\n`.
- Conté los bytes NUL del TAP testigo con `grep` y dio un número imposible. Contados por bytes con
  node, son los de arriba.
- La primera versión del banco creaba su temporal con `mkdtemp` a mano; antes de comitear pasó a
  `temporal()`, que es lo que la casa exige.

## Lo que no está en git, y reproducir

Los 50 TAP (127 MB) no entran. Se rebajan mientras GitHub conserve los artefactos: los del
2-oct caducan el 9-oct y los del 7-oct, el 14-oct. Después sólo queda el camino A.

    E=docs/master/evidencias/SCRUM-1339
    node $E/h-separar.mjs $E/g-tasa-de-main.tsv
    node $E/h-bajar-taps.mjs $E/g-tasa-de-main.tsv <fuera del árbol>/taps --solo 1     # el canario
    node $E/h-bajar-taps.mjs $E/g-tasa-de-main.tsv <fuera del árbol>/taps
    node $E/h-entradas.mjs scripts/_senal-de-nombres.mjs $E/g-tasa-de-main.tsv <fuera del árbol>/taps
    node $E/h-efecto.mjs

# SCRUM-1339j · Por qué sale CIEGA `scrum859`: una sola causa en las 8, y es la cola que no llega cuando su segunda mutación escribe 1,1 MB

**Medido contra:** `origin/main` = `fae0553295d655d5579e3a1fc1c93b6f468c0149` · 2026-10-08T02:03:21Z

A9: aviso → cicatriz J3 «Di por hecho que las líneas de un mismo caso van pegadas en el log: stderr y stdout se intercalan, y conté dos firmas donde había una.» — no se pudo comprobar: es un guion de evidencias que corre a mano fuera de la tanda; lo que queda es el caso intercalado que ahora lleva el control fabricado de `j-logs.mjs`

**El encargo** (orquestador del equipo de Javier, `cobroflash-backend-90`, 8-oct; sesión `jv-j3`,
relevo). El barrido de SCRUM-1393b contó 15 checks ciegos en los 53 PR del 7 y el 8 de octubre, y 8
eran `scrum859` en el job de mutación. Tres preguntas: qué le falta para poder juzgar, si las 8 son
la misma causa, y si se arregla sin tocar `scrum859` ni el instrumento. **Es medición: no se ha
arreglado nada, no se ha tocado ningún workflow ni ningún instrumento, y el ticket no se transiciona.**

## En corto

- **Lo que le falta es la cola de su propio informe.** `scrum859` declara dos mutaciones. Con la
  segunda, el proceso del fichero manda al padre **1.104.695 B** (limpio manda 42.535), y el test
  que tiene que caer es el 17.º de 20: su veredicto acaba a 7.606 B del final. Si esos últimos bytes
  no llegan, el instrumento no puede juzgar y lo dice: CIEGO.
- **Las 8 son la misma, medida por contenido y no por el nombre del fichero.** Una sola firma en los
  8 logs: la misma mutación (la segunda), la misma causa escrita («NO APARECE en la pasada mutada»),
  el mismo recuento (9 pasados, 7 caídos), los mismos 4 ausentes de 20, con la limpia en 20 de 20.
- **Reproducido aquí con el instrumento de la casa:** quitándole al canal los últimos N bytes,
  `aplicarUna` dicta exactamente lo que dicen los 8 logs cuando N está entre 8.000 y 60.000; con
  7.000 dicta VIVA y con 67.000 el recuento ya es otro (9 y 6). La pérdida de CI cabe en esa ventana.
- **No es la posición del test.** La primera mutación tiene su test más expuesto (a 4.332 B del
  final) y no cegó en ninguno de los 53 logs. Lo que cambia entre las dos es cuánto se escribe.
- **No se arregla sin tocar algo que tiene dueño o decisión:** el instrumento (S3), el workflow (S5
  y fundador) o los dos tests (`scrum859` y `scrum267`, que según `carriles.mjs` no reclama nadie).
  Abajo van las vías con lo medido de cada una. No elijo.
- **No he ejecutado nada en Linux.** Lo de Linux sale de los 53 logs y de SCRUM-1405; mi intento de
  reproducir la pérdida en Windows poniendo la tubería no bloqueante no perdió nada.

## Lo que ya estaba medido, y no repito

El mecanismo no es nuevo: SCRUM-1405 midió que con `--test-force-exit` el proceso de cada fichero
sale con parte de su informe sin escribir, que en Linux la tubería no es bloqueante y que con la
tubería bloqueante no se pierde (0 de 12 tandas). SCRUM-1100 (tramo 1100d) midió que `correr()` le
pasa ese flag al hijo y que lo que llega en CI es un prefijo de lo que sale en local. SCRUM-1321
quitó el mensaje falso del «título cambiado». Lo que faltaba era `scrum859` por dentro: qué
mutación, cuántos bytes, dónde cae el corte y si las 8 son una.

## ① Qué le falta: el instrumento ejecutado, y el canal byte a byte

`j-medir.mjs` llama a `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (sin copiar su
lógica) y, al lado, lanza el mismo hijo y trocea lo que manda al padre mensaje a mensaje. Windows,
node v24.18.0. Salida entera en `evidencias/SCRUM-1339/j-salida-medir.txt`.

| | bytes hacia el padre | veredictos | de ellos caen | el test declarado | bytes detrás de su veredicto | aquí |
|---|---|---|---|---|---|---|
| limpia | 42.535 | 20 | 0 | — | — | 20 pasan |
| mutación 1 (`TOPE… = 99`) | 323.495 | 20 | 2 | el 19.º, 136.272 B | 4.332 | VIVA |
| mutación 2 (clave posicional) | 1.104.695 | 20 | 8 | el 17.º, 28.908 B | 7.606 | VIVA |

- **De dónde sale el megabyte.** Cada test que cae viaja dos veces (`test:complete` y `test:fail`,
  539.864 y 534.428 B) con el mensaje del aserto entero dentro, y los mensajes listan claves y
  entradas de `docs/master`. El mayor son 186.855 B; el 16.º, justo antes del declarado, 169.101 B.
- **14 de los 20 tests no son de `scrum859`.** Importa funciones de `scrum267`, y al importarlo
  ejecuta sus 14 tests dentro del mismo proceso. Con la mutación 2 caen 6 de esos 14 y suman
  336.419 de los 534.428 B de `test:fail`.
- **Detrás del 16.º quedan unos 66.200 B**, que es lo que viaja con los cuatro últimos tests.
- Control positivo del troceo: 110 mensajes enteros, 0 B de resto y 20 veredictos en las tres
  pasadas. La primera versión los daba todos por ilegibles (§Mis errores).

### El corte, fabricado: cuánta cola tiene que faltar para que dicte lo que dictó CI

`j-corte.mjs` corre el mismo instrumento con `j-sonda-tuberia.mjs` cargada en el hijo: los últimos N
bytes que el hijo escribe no se entregan. **No imita cómo se pierde la cola en Linux; fija cuánta se
pierde.** N=0 es el control. Salida en `j-salida-corte.txt`; dos pasadas, los mismos 20 veredictos.

| cola que no llega | mutación 1 | mutación 2 |
|---|---|---|
| 0, 2.000 y 4.000 B | VIVA | VIVA |
| 5.000 y 7.000 B | CIEGO · 17 pasados, 1 caído, faltan 2 de 20 | VIVA |
| 8.000, 36.000 y 60.000 B | CIEGO · lo mismo | **CIEGO · 9 pasados, 7 caídos, faltan 4 de 20** |
| 67.000 y 240.000 B | CIEGO · lo mismo | CIEGO · 9 pasados, 6 caídos, faltan 5 de 20 |

La fila en negrita es, palabra por palabra, lo que traen los 8 logs. Dos cosas salen de aquí:

1. En las 8 pasadas ciegas de CI se perdieron entre unos 7.600 y unos 66.200 B de la mutación 2.
2. En los 53 logs la mutación 1 salió VIVA, y con 5.000 B de cola perdida ya sale CIEGA con un
   recuento (17 y 1) que no aparece en ningún log. Así que con la mutación 1 se perdieron menos de
   unos 5.000 B las 53 veces. **El mismo fichero, en el mismo runner, pierde más cola cuando escribe
   1,1 MB que cuando escribe 323 KB.** Por qué, no lo he medido (§Lo que NO sé).

### Lo que NO reprodujo

Puse no bloqueante la salida del hijo en Windows (`setBlocking(false)` devuelve 0) para imitar a
Linux: 5 pasadas de cada mutación, 10 de 10 VIVAS, 0 B pendientes al salir en los tres testigos
(`j-salida-medir-no-bloqueante.txt`). O en Windows ese ajuste no cambia cómo escribe la tubería, o
el padre vacía a tiempo. No distingo cuál. La pérdida real no la he visto en esta máquina.

## ② ¿Una causa o varias? Los 53 logs, leídos

`j-logs.mjs` baja el log del job de mutación de la punta de cada uno de los 53 PR del barrido
(`evidencias/SCRUM-1393/checks-sin-leer/datos-pr.json`) y lee lo que dice de `scrum859`. Salida en
`j-salida-logs.txt`.

| | logs |
|---|---|
| población | 53 jobs en 53 PR; el menor de 121.880 B, ninguno vacío |
| VERDE (resumen con mudas 0, ciegas 0, muertos 0) | 43 |
| CIEGO (alguna ciega o fichero muerto, mudas 0) | 10 |
| ROJO (alguna muda) | 0 |
| sin veredicto (sin línea de resumen) | 0 |
| `scrum859`: mutación 1 viva, mutación 2 viva | 45 |
| `scrum859`: mutación 1 viva, mutación 2 ciega | **8** |
| `scrum859`: mutación 1 ciega | 0 |

- **Firmas distintas entre las 8: una.** La firma junta el test declarado, la causa que escribe el
  instrumento, el recuento de la mutada, el de la limpia, cuántos faltan y sus cuatro nombres. PR
  #2240, #2247, #2251, #2259, #2261, #2277, #2281 y #2290.
- Los otros 2 CIEGO de los 10 no son de `scrum859` (#2282 por `scrum834`, #2284 por
  `vigia-atascados`); en esos dos logs `scrum859` sale con sus dos mutaciones vivas.
- **En qué NO se diferencian las que ciegan de las que no, leído en el log:** el node es el mismo en
  las 53 (v24.21.0); por imagen del runner, 4 de 31 y 4 de 22; el tiempo entre las dos marcas de
  `scrum859`, 1,06–1,34–1,61 s las que ciegan y 1,06–1,46–1,63 s las que no. Ni `scrum859`, ni
  `scrum267`, ni el instrumento tienen commits en la ventana (los dos tests, desde el 26-sep).
  Con el mismo árbol y el mismo runner, ciega 8 de 53: es una carrera, no una entrada distinta.
- **Controles, corridos antes del número.** De cero, derivado: el guard de número más alto que
  nombran los logs (`scrum1486-…`) sale en 53; con el número más uno, en 0. Positivos: `scrum859`
  nombrado en 53 de 53; las ✔ contadas coinciden con las «vivas» del resumen en 53 de 53; 139
  guards distintos. Y la función, sobre cinco logs fabricados (verde, ciego, rojo, vacío y cortado
  sin resumen): los cinco en su estado; el vacío y el cortado salen «sin veredicto», no verdes.

## ③ ¿Se arregla sin tocar `scrum859` ni el instrumento?

No he encontrado ninguna vía que no toque una de estas tres cosas. De quién es cada una lo dice
`node scripts/carriles.mjs de <ruta>`, no yo:

| vía | qué toca | de quién | qué hay medido | qué no |
|---|---|---|---|---|
| A · que la cola llegue, desde el instrumento: `correr()` sin `forceExit`, o con la salida del hijo bloqueante | `scripts/meta-guard-mutaciones.mjs` | **S3** | SCRUM-1405, en la tanda: sin el flag 0 de 16 pierden; bloqueante 0 de 12 | nada dentro del job de mutación; sin el flag, un hijo que deja algo abierto no termina (aquí cada pasada tiene un tope de 300 s) |
| B · lo mismo por entorno: un `--import` en el paso del job | `.github/workflows/ci.yml` | **S5** y fundador | lo mismo; se apoya en una pieza interna de node | si afecta a los otros 138 guards del job |
| C · que el declarado no viaje en la cola, o que la mutada escriba menos: mover el test, acortar los mensajes de los asertos, o que `scrum859` no ejecute los 14 tests de `scrum267` | `tests/scrum859-…` y `tests/scrum267-…` | sin fila en §3: nadie los reclama | con el corte fabricado el declarado aguanta 7.000 B perdidos; 336.419 B de los `test:fail` son de los 14 tests ajenos | cuánto se pierde como máximo en Linux, así que no sé qué margen basta; cambia un test, y eso pide decisión |
| D · esperar al arreglo de node (`nodejs/node#64833`) | la versión de node del workflow | S5 | — | no la he vuelto a leer; sin fecha |
| E · no tocar nada | — | — | es lo de hoy: 8 de 53, y 27 de 180 en la medición del 6-oct (1100d) | — |

Una cosa que no es una vía y conviene tener delante: la pérdida sólo quita eventos. En 53 logs no
hay ninguna muda, y las 8 ciegas tienen la limpia en 20 de 20. Lo que no vale de esos 8 jobs es el
rojo, no las 509 a 519 vivas que traen.

## Hipótesis, de IA y SIN PROBAR

Los cuatro últimos tests de la mutación 2 viajan en unos 66.200 B, y una tubería de Linux admite
65.536. Si el hijo entrega ese último tramo de una vez cuando el padre aún no ha vaciado lo anterior,
lo que no cabe se queda encolado y `process.exit()` lo tira; con la mutación 1 el tramo final son
4.332 B y cabe siempre. Encaja con que ciegue sólo la 2 y con la ventana de 7.600 a 66.200 B. No
explica por qué son 8 de 53 y no más, y no la he puesto a prueba: haría falta el testigo de bytes
pendientes dentro del job de Linux, que es un workflow. No se construye nada sobre ella.

## Lo que NO sé

- Cuántos bytes se pierden en Linux en cada pasada: sólo la ventana que deja el recuento.
- Por qué la mutación 2 pierde más cola que la 1. La diferencia medida es el volumen; el mecanismo
  fino, no.
- Si alguna de las vías A, B o C quita la ceguera dentro del job de mutación: ninguna está probada ahí.
- Los 8 logs son de la punta de cada PR; las puntas anteriores y los runs de `main` no los he leído.
- El árbol de cada run no es el mío: mis bytes son de `fae05532`; los de cada PR pueden variar algo
  porque los mensajes listan `docs/master`.

## Mis errores

- **Los 110 mensajes me salieron «ilegibles» en la primera pasada.** Supuse que el valor iba sin su
  cabecera v8 y la lleva. Lo cazó el positivo: «veredictos de primer nivel 0» con 42.535 B delante.
- **Conté dos firmas donde había una.** El lector quería la línea de los ausentes pegada a la del
  caso; en el log de #2247 el runner intercaló cinco líneas de stdout. Lo cazó que una de las 8
  saliera sin nombres con el mismo recuento. Va a las cicatrices de J3 y al control fabricado.
- El intento de reproducir la pérdida en Windows no reprodujo nada; está contado arriba como lo que es.
- **Mi lector daba VERDE por descarte.** `j-logs.mjs` clasificaba un log con `… ? 'CIEGO' : 'VERDE'`.
  Lo cazó `scrum622` en local, antes de empujar. Ahora el verde se afirma con sus tres ceros y lo
  que no encaja sale «sin veredicto»; la salida regenerada es idéntica byte a byte.
- Guards corridos aquí antes de empujar: 13 ficheros, 127 casos, 125 pasan. Los 2 que caen son de
  `scrum622` y piden `dist/`, que este árbol no tiene (`ERR_MODULE_NOT_FOUND`); no los he visto en
  verde en local.

## Reproducir

    E=docs/master/evidencias/SCRUM-1339
    node $E/j-medir.mjs . <carpeta de fuera del árbol> scrum859-identidad-y-motivo-cerrado.test.mjs 1
    node $E/j-logs.mjs docs/master/evidencias/SCRUM-1393/checks-sin-leer/datos-pr.json <carpeta de fuera>/logs
    NODE_OPTIONS='--import file:///<ruta absoluta>/j-sonda-tuberia.mjs' \
      node $E/j-corte.mjs . scrum859-identidad-y-motivo-cerrado.test.mjs 0,2000,4000,5000,7000,8000,36000,60000,67000,240000

`j-medir.mjs` y `j-corte.mjs` mutan `tests/scrum267-ancla-de-medicion.test.mjs` mientras corren (lo
hace `aplicarUna`, que lo restaura) y comprueban su sha256 al acabar: no los lances con otra cosa
corriendo en el mismo árbol.

# SCRUM-1339k · La hipótesis de los 664 bytes: la cifra era de otra máquina, el 65.536 no es la tubería, y cruzarlo no ciega: protege (en un modelo)

**Medido contra:** `origin/main` = `8518dc7a16164530863d657cb0f2f817a4691d78` · 2026-10-08T02:50:35Z

A9: comprobación → `docs/master/evidencias/SCRUM-1339/k-replica.mjs`

**El encargo** (orquestador del equipo de Javier, `cobroflash-backend-90`, 8-oct; sesión `jv-j3`,
relevo de la que escribió el tramo 1339j). Matar o probar la hipótesis que aquel tramo dejó sin
probar: «los cuatro últimos tests viajan en unos 66.200 B y la tubería admite 65.536; sobran 664».
Tres cosas: medir esos bytes, decir de dónde sale 65.536, y el par que decide (por debajo del límite
desaparece la ceguera, por encima vuelve). **Es medición: no se ha arreglado nada; no se ha tocado
el instrumento, ni los dos tests, ni ningún workflow; el ticket no se transiciona; no elijo entre A y E.**
El hook de arranque dijo «SIN IDENTIDAD» (no reconoce `jv-j3`; es SCRUM-1498, de S5): seguí, como
manda la ficha común.

## En corto

- **La hipótesis, tal como estaba escrita, no se sostiene.** En CI la cola no pasa de 65.536 por
  664 B: se queda por debajo. 66.201 era un dato, pero de la máquina de quien lo midió.
- **65.536 es real, y hay dos, ninguno la tubería del sistema.** Uno es la marca de agua de los
  flujos de node fuera de Windows. El otro, el tamaño que libuv le pide al núcleo para el canal del
  hijo, que en Linux es un par de sockets y no una tubería.
- **El par sale, pero sólo en un modelo y en sentido contrario al de la hipótesis.** Con un núcleo
  fabricado en Windows y todo lo demás node de verdad: cola 21 B por debajo de la marca, CIEGO con
  la firma exacta de los 8 logs; cola 9 B por encima, VIVA con 0 B perdidos. Pasar la marca obliga
  al hijo a esperar antes de salir.
- **No hay umbral limpio.** Con la cola por encima de la marca también ciega si el núcleo deja de
  admitir a mitad de cola (30.000 B dentro: CIEGO, 36.111 B perdidos). Lo que decide no es un
  tamaño: es en qué mensaje deja de caber, y eso en Linux no lo he medido.
- **Lo que sí queda explicado por construcción** (código de node leído del binario, y el modelo):
  por qué la mutación 1 no ciega nunca, por qué las 8 ciegas traen el mismo recuento, y por qué en
  SCRUM-1405 lo pendiente nunca pasó de 65.536.
- **En Linux no he ejecutado nada.** Abajo va qué haría falta.

## ① Cuánto ocupan los cuatro últimos tests

`k-medir.mjs bytes` trocea el canal de la mutación 2 mensaje a mensaje (`k-salida-bytes.txt`).
Detrás del veredicto del 16.º viajan 26 mensajes: los cuatro tests que faltan en los 8 logs, el
plan, ocho diagnósticos y el resumen.

| dónde se mide | ruta del árbol | color | la cola | respecto a 65.536 |
|---|---|---|---|---|
| tramo 1339j (su árbol) | 95 caracteres | forzado | 66.201 B | +665 |
| mi árbol | 92 | forzado | 66.111 B | +575 |
| réplica, 92 caracteres | 92 | forzado | 66.111 B | +575 |
| réplica, como el runner | 55 | forzado | 64.975 B | −561 |
| réplica, como el runner | 55 | sin forzar | **61.295 B** | **−4.241** |

- **66.200 era un dato redondeado (66.201), no una estimación; pero no es el de CI.** Los 26
  mensajes llevan dentro la ruta del árbol, y dos la llevan además como URL. Cada carácter de ruta
  son unos 30 B de cola.
- **El color mueve 3.680 B.** Este arnés pone `FORCE_COLOR=3` y el aserto pinta su diferencia con
  códigos de color, que viajan en el mensaje. `ci.yml` no nombra `FORCE_COLOR` ni `NO_COLOR` (0
  líneas; positivo: `node-version` y el nombre del job, 7). Que el runner no lo ponga por su cuenta
  no lo he leído del runner: es lo habitual, no un dato.
- **La ruta del runner sí está leída:** `/home/runner/work/cobroflash-backend/cobroflash-backend`,
  5 veces en el log del job de mutación de #2240.
- **Igual en los 53 PR** (`k-replica.mjs`, `k-salida-replica.txt`): sacados de git los dos tests y
  `docs/master/*.md` del commit de merge de cada uno, en una carpeta de 55 caracteres y sin color,
  la cola mide 61.295 o 61.294 B en los 53, 8 ciegos y 45 vivos. La cola no depende del árbol.
- Controles. Del método: la réplica a 92 caracteres da 66.111 B, lo mismo que mi árbol; así que
  no tener `.git` (cae un test más de `scrum267`, 9 en vez de 8) no toca la cola. Positivo: 20
  veredictos y el declarado caído en 53 de 53; una escritura por mensaje, 110 de 110. De cero: la
  ruta con «-no-existe» detrás, 0 veces.
- La cifra de la réplica lleva 6 B que en Linux no estarían (la URL de Windows lleva «C:/» y «%20»),
  y el node de aquí es v24.18.0, no el v24.21.0 del runner: las trazas pueden variar en decenas de
  bytes. El margen es de miles.

## ② De dónde sale 65.536

| | qué es | dónde está | visto cómo |
|---|---|---|---|
| a | lo que cabe en una tubería de Linux | — | **no aplica**: el canal del hijo no es una tubería |
| b | el tamaño que libuv pide para el par de sockets del hijo | `deps/uv/src/unix/process.c`, líneas 196 y 207–212 | leído en los tags v24.21.0 y v24.18.0 de nodejs/node: el mismo fichero, mismo sha256 |
| c | la marca de agua de un flujo de bytes de node | `lib/internal/streams/state.js`, línea 12 | leído del binario que corre, y ejecutado |

- **(b)** `uv_socketpair(SOCK_STREAM, …)` y, en los dos extremos, `SO_SNDBUF` y `SO_RCVBUF` a
  `64 * 1024`. Es una petición: cuánto admite de verdad ese socket antes de decir que no cabe, no lo
  he medido (`k-salida-libuv.txt`).
- **(c)** `process.platform === 'win32' ? 16 * 1024 : 64 * 1024`. Aquí, ejecutado, 16.384; fuera
  de Windows, 65.536 por esa línea (`k-salida-codigo-de-node.txt`).
- **Lo que midió SCRUM-1405 era (c).** Su sonda apuntaba `writableLength`, que es la cuenta del
  flujo de node. Releído (`k-pendientes-1405.mjs`): 1.600 pasadas con sonda en Linux, 967 con
  bytes pendientes al salir en cinco celdas que escriben de 98 KB a 337 KB por fichero; el máximo,
  65.506 B; por encima de 65.536, 0; entre 60.000 y 65.536, 170. El tope no se mueve con lo que se
  escribe. La frase «que es lo que cabe en una tubería de Linux» de aquel registro era una
  suposición, y la del tramo 1339j la heredó.
- **Por qué el tope, leído en el código:** la rama de `forceExit` espera a que el informe se haya
  ENTREGADO a la salida, no a que la salida lo haya escrito; y la entrega se para cuando lo
  pendiente llega a la marca. Así que al salir nunca hay 65.536 B o más pendientes.
- **Y por qué Windows no reprodujo en el tramo 1339j:** en Windows node cambia la escritura de la
  salida por una síncrona (`lib/net.js`, `this._write = makeSyncWrite(fd)`). Quitarle el modo
  bloqueante al descriptor no deshace eso.

## ③ El par que decide — EN UN MODELO, no en Linux

`k-sonda-nucleo.mjs` se carga en el hijo y le devuelve las dos cosas que en Windows no tiene: la
marca de 65.536 y una escritura que puede no caber. **El «núcleo» es fabricado:** el caso que pongo
es el peor, que deje de admitir justo tras entregar cada mensaje de 65.536 B o más, durante 150 ms.
El corredor, el flujo, la pausa y `process.exit()` son los de node.

**El par, variando el tamaño del informe y con la marca real** (`k-salida-par.txt`; réplica del
mismo commit en carpetas de distinta longitud):

| ruta | color | cola | respecto a 65.536 | llegan | el declarado | perdidos |
|---|---|---|---|---|---|---|
| 55 (runner) | sin forzar | 61.295 | −4.241 | 16 de 20 | NO LLEGA | 61.295 B |
| 55 | forzado | 64.975 | −561 | 16 de 20 | NO LLEGA | 64.975 B |
| 73 | forzado | 65.515 | **−21** | 16 de 20 | **NO LLEGA** | 65.514 B |
| 74 | forzado | 65.545 | **+9** | 20 de 20 | **LLEGA** | 0 B |
| 92 | forzado | 66.111 | +575 | 20 de 20 | LLEGA | 0 B |

**Con el instrumento de la casa en mi árbol** (`aplicarUna`; cola de 66.111 B; `k-salida-mapa.txt`):

| marca | el núcleo deja de admitir | mutación 1 | mutación 2 |
|---|---|---|---|
| sin modelo (control) | — | VIVA | VIVA |
| 65.536, núcleo sin límite (control) | nunca | VIVA, 0 perdidos | VIVA, 0 perdidos |
| 65.536 (cola 575 por encima) | al empezar la cola | VIVA | VIVA, 0 perdidos |
| 66.111 (igual que la cola) | al empezar la cola | VIVA | VIVA, 0 perdidos |
| 66.112 (cola 1 por debajo) | al empezar la cola | VIVA | **CIEGO · 9 pasados · 7 caídos · faltan 4 de 20** · 66.110 perdidos |
| 66.678 (567 por debajo) | al empezar la cola | VIVA | CIEGO · lo mismo · 66.111 perdidos |
| 66.678 | 58.000 B dentro de la cola | VIVA | CIEGO · lo mismo · 8.111 perdidos |
| 66.678 | 58.600 B dentro | VIVA | VIVA · 7.511 perdidos |
| 65.536 (cola por encima) | 500 y 600 B dentro | VIVA | VIVA, 0 perdidos |
| 65.536 (cola por encima) | 30.000 B dentro | VIVA | **CIEGO · lo mismo** · 36.111 perdidos |

Lo que sale de las dos tablas:

1. **El sentido es el contrario al de la hipótesis.** Por debajo de la marca el hijo entrega toda
   la cola sin que nada le pare, sale, y lo que no cupo se pierde. Por encima, la entrega se para,
   espera a que se vacíe y sólo entonces sale.
2. **Pero pasar la marca no es un arreglo.** La última fila: con la cola por encima, si deja de
   caber a mitad, lo que queda detrás ya no llega a la marca y se pierde igual.
3. **La mutación 1 no ciega en ninguna fila.** Su veredicto viaja en un mensaje de 136 KB, mayor
   que la marca: o cabe entero, o para la entrega hasta que cabe. Pierde hasta 4.290 B de detrás,
   nunca el veredicto. Encaja con 53 de 53 vivas en CI.
4. **El recuento de las 8 ciegas no puede ser otro.** Para perder también el 16.º harían falta más
   de 61.295 B pendientes al salir, y el 16.º viaja en un mensaje de 169 KB.
5. **La firma de CI aparece en el modelo palabra por palabra**, y el corte entre VIVA y CIEGO cae
   donde acaba el veredicto del declarado (7.540 B del final aquí).

## Qué NO está probado, y qué haría falta en Linux

- **Que en el runner pase esto.** El modelo demuestra qué hace node cuando una escritura no cabe;
  no demuestra cuándo no cabe en Linux. Por qué 8 de 53 y no más, sigue sin medir.
- **El par en Linux, sin tocar node:** el mismo job con el repositorio en una ruta más larga y con
  el color forzado o no. Si el modelo vale, la tasa de ciegas tiene que cambiar al cruzar la cola
  los 65.536 B (sin color hacen falta unos 142 caracteres más de ruta; con `FORCE_COLOR`, 19).
  Es un workflow: S5 y fundador. La rama `exp-1405-force-exit` tiene ya el andamio.
- **El testigo directo:** la sonda de SCRUM-1405 dentro del job de mutación, apuntando lo pendiente
  al salir en la mutación 2. La predicción que la puede tumbar: en las ciegas, entre 6.704 y
  61.295 B pendientes; nunca 65.536 o más.
- Cuánto admite el par de sockets con 64 KiB pedidos. El número de la vía C del tramo 1339j
  («el declarado aguanta 7.000 B perdidos») es de aquel árbol: con la ruta del runner son 6.704.
- No he vuelto a leer los 53 logs: las 8 ciegas son las de `j-salida-logs.txt`.

## Mis errores

- **Lancé dos pasadas de `k-replica.mjs` a la vez sobre la misma carpeta.** La segunda le borró la
  réplica a la primera: 27 PR con `EPERM` y uno con `ENOENT`. Lo dijo el propio recuento («con
  error 28»), no pasó por bueno. Ahora el guion se niega a arrancar si la réplica existe.
- **Retomé desde el PR equivocado** por leer el final recortado de la salida: #2272 donde era #2264.
- **Todas las cifras de la primera pasada llevaban el color del arnés** y no lo sabía. Lo cazó que
  la pasada repetida, lanzada con `FORCE_COLOR=0` por otro motivo, diera 61.295 donde antes 64.975.
- **Le adelanté al orquestador «65.536 no es la tubería, es node»** antes de leer las líneas
  208–212 de libuv, que piden 64 KiB para ese socket. Corregido en la entrega: son dos.
- Predije que con la cola por encima de la marca cegaría si el núcleo fallaba 600 B dentro, y no
  ciega: el flujo cuenta entero el mensaje que está a medio escribir. La fila de 30.000 B es la buena.
- Un `grep` de bash sobre `.github/workflows/ci.yml` me dio 0 en todo, también en el positivo.
  Repetido con la herramienta de búsqueda.
- Pasé de 200.000 de contexto sin avisar: medí a 235.636.
- Un escape roto por pasar texto a node desde bash; lo cazó `node --check` antes de correr.
- Guards corridos antes de empujar: van en el comentario de entrega de Jira, con su recuento.

## Reproducir

    E=docs/master/evidencias/SCRUM-1339
    node --no-deprecation $E/k-codigo-de-node.mjs
    node $E/k-pendientes-1405.mjs docs/master/evidencias/SCRUM-1405
    node $E/k-medir.mjs bytes . <carpeta de fuera> scrum859-identidad-y-motivo-cerrado.test.mjs 2
    FORCE_COLOR=0 node $E/k-replica.mjs . <carpeta de fuera, de menos de 54 caracteres> docs/master/evidencias/SCRUM-1393/checks-sin-leer/datos-pr.json
    K_LARGO=74 K_MODELO=1 K_TRAS_GORDO=0 K_SUELTA=150 node $E/k-replica.mjs . <carpeta de fuera> - <commit>
    node $E/k-medir.mjs mapa . <carpeta de fuera> scrum859-identidad-y-motivo-cerrado.test.mjs "SIN;K_TRAS_GORDO=0,K_SUELTA=150,K_MARCA=66112"

`k-medir.mjs` muta `tests/scrum267-ancla-de-medicion.test.mjs` mientras corre y comprueba su sha256
al acabar. `k-replica.mjs` no toca el árbol.
