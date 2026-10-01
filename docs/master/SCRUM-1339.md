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
