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
