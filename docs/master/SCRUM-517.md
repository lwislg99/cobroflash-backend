# SCRUM-517 · El censo del disco enseñaba su fallo 55 veces más pequeño

**Fecha:** 19-ago-2026 · **Carril:** instrumentos de medición · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d` · 2026-08-19T07:32:08Z

**Paso 0:** el defecto seguía en pie tal cual. `tests/scrum480-fin-de-linea.test.mjs` en el ancla
llevaba el `.slice(0, 25)` dentro del `assert.deepEqual` del caso 4, y el caso reproducía en
`cobroflash-backend` la misma salida que describía el encargo: **1.386 de 1.480** (el encargo citaba
1.386 de 1.479; ese árbol ha ganado un fichero de texto desde entonces). `docs/master/SCRUM-517.md`
no existía. Se trabajó en un worktree nuevo, `cobroflash-b5`, materializado en el ancla.

## 1 · Qué estaba mal, y no era el titular

El titular **sí** daba la cifra buena. El problema es quién manda en la pantalla:

```
  AssertionError: 🔴 HAY 1386 FICHEROS DE TEXTO CON `\r` EN EL DISCO (de 1480 leídos):
     · .agents/skills/impeccable/SKILL.md
     · .agents/skills/impeccable/agents/openai.yaml
     ... 23 rutas más, todas de .agents/skills/impeccable/
     … y 1361 más
  [el porqué, 8 líneas]
  + actual - expected
  + [
  +   '.agents/skills/impeccable/SKILL.md',
     ... 25 rutas
```

El bloque `+ actual` es el que se lee, y era `ofensores.slice(0, 25)`: veinticinco rutas del mismo
directorio. Quien leía la salida se llevaba **«cuatro ficheros de una skill»**. Eran 1.386 — casi el
checkout entero. Un recuento que se presenta cortado sin decirlo tiene la forma correcta y la
magnitud equivocada, y eso es peor que no dar ninguna: se cree.

Segundo defecto, más pequeño y del mismo tipo: la coletilla `de N leídos` **etiquetaba mal la
población**. Enseñaba `r.textos`, que eran 1.480; los leídos eran 1.483. La cifra que se enseñaba no
era la que decía su rótulo.

## 2 · El número de HOY, y la explicación de por qué no cuadraban los del 17-ago

Las dos sesiones del 17-ago contaron 1.386 y 1.368 y dejaron la diferencia sin explicar. **No era
ruido: estaban midiendo árboles distintos.** Medido el 19-ago-2026, mismo commit, seis worktrees del
mismo repositorio en la misma máquina:

| árbol | ofensores / textos | qué es |
| --- | --- | --- |
| `cobroflash-b5` (este) | **0 de 1.479** | materializado hoy, con `eol=lf` ya en vigor |
| `cobroflash-b4` | 0 de 1.479 | ídem |
| `cobroflash-backend` | **1.386 de 1.480** | veterano |
| `cobroflash-b2` | **1.368 de 1.479** | veterano |
| `cobroflash-b1` | — | **ciego**: lee 2 ficheros de 1.714 |
| `cobroflash-b3` | — | **ciego**: lee 2 ficheros de 1.714 |

1.386 y 1.368 son exactamente los dos números del 17-ago: son `cobroflash-backend` y
`cobroflash-b2`. La diferencia no tenía misterio, tenía dos direcciones distintas.

Y los blobs, medidos con `git cat-file`: **0 ofensores sobre 1.500 blobs de texto**. Lo que se sube
está limpio. Lo que está sucio es el disco de dos de los seis árboles, y los guards que se corran
ahí están cegados ahora mismo.

**b1 y b3 son el hallazgo que no se buscaba.** Están en ramas cuyo `.gitattributes` es anterior a
`eol=lf`, así que el derivador saca **una** extensión y el censo lee 2 ficheros de 1.714. Con el
código del ancla, el caso 4 **daba verde ahí** — verificado abajo. Un cero que significa «no supe
mirar» presentado como «todo limpio».

## 3 · Qué vigila este caso. Decidido: EL DISCO

Se eligió una de las dos y el motivo está escrito en el propio test, no sólo aquí.

**Vigila el disco del desarrollador, no el blob.** «¿Está limpio lo que se sube?» ya la contesta el
caso de arriba del mismo fichero con `git cat-file`; duplicarla dejaría dos tests que caen a la vez
y no distinguen nada. El disco merece un caso propio por un motivo que no es de higiene: **un guard
no abre el repositorio, hace `readFileSync` del disco**, y con un `\r` en la línea
`linea.replace(/\/\/.*$/, '')` no hace nada — sin `m`, `$` exige fin de cadena y el `\r` está en
medio. Le pasó al de SCRUM-409 durante semanas y sólo en Windows, porque el CI es Linux
(`docs/master/SCRUM-409.md`). Las dos cosas son independientes: los blobs pueden estar impecables
mientras el árbol que ejecuta los guards está podrido, y este caso es lo único que separa esas dos
frases.

Consecuencia asumida, y ahora dicha en voz alta dentro del mensaje de fallo: **mientras el caso esté
rojo, ningún «0 fallos» de ese árbol vale como evidencia** — no porque falle este test, sino porque
los guards que dieron ese verde estaban ciegos. El mensaje trae también el remedio, que no toca el
repositorio: un worktree nuevo nace en LF (medido: 0 de 1.479), o `git rm --cached -r .` seguido de
`git reset --hard` con todo commiteado o guardado en `git stash`.

## 4 · Los cambios

`tests/scrum480-fin-de-linea.test.mjs`, caso 4:

- **El assert es sobre EL NÚMERO**, no sobre una lista. Así el diff automático de `node:test` enseña
  `1386` frente a `0` —la magnitud— y la lista baja al mensaje con su corte **declarado en
  palabras**: `mostrando 25 de 30 … y 5 MÁS SIN NOMBRAR. La cifra es 30, no 25`.
- **El suelo entra dentro del caso.** Antes vivía en un test aparte, así que este caso podía dar
  verde sobre la nada y el rojo del otro no decía cuál era el ciego. Ahora, si no hay nada que leer,
  este caso falla **declarándose ciego** y nombrando la causa.
- **La población se rotula bien**: textos, leídos y rastreados, cada uno con su nombre.

`tests/_censo-eol.mjs`, en `censoArbolDeTrabajo`:

- `binarios` y `sinCR` pasan a **contarse en su rama del bucle** en vez de derivarse restando.
  Derivados, la comprobación de cuadratura habría sido una identidad algebraica disfrazada de
  assert: verde pasara lo que pasara.

## 5 · Verificación

**Control positivo.** Un fichero con CRLF de verdad en el ámbito vigilado
(`tests/_scrum517-control-positivo.mjs`, 3 CR en disco medidos con node): cazado y **nombrado** en
la salida, con `CRLF 3, CR sueltos 0`. Su blob salió con **0 CR** — el mismo fichero, limpio en el
repositorio y sucio en el disco, que es exactamente la independencia que este caso vigila. Retirado
después.

**Truncado declarado.** 30 ficheros con CRLF en `tests/_scrum517-rojo/`: la salida dijo
`mostrando 25 de 30`, luego `… y 5 MÁS SIN NOMBRAR. La cifra es 30, no 25`, y el diff automático fue
`30 !== 0`. Retirados después.

**Suelo, con contraste.** Quitando del `.gitattributes` las reglas `eol=lf` por extensión —o sea
reproduciendo el estado de b1 y b3— el censo pasa a leer 0 ficheros:

| versión | veredicto |
| --- | --- |
| la del ancla (`origin/main`) | **✔ VERDE**, habiendo leído 0 ficheros |
| la de esta rama | **✖ CIEGO, QUE NO ES LIMPIO: solo he podido leer 0 ficheros del disco (de 1714 rastreados)** |

**Rojo por el mecanismo.** Inyectado en `censoArbolDeTrabajo` un camino que lee los `.ts` y no los
clasifica en ninguna categoría. El caso cayó por la cuadratura:
`0 con CR + 1234 sin CR + 3 binarios = 1237, y se han leído 1482`. Con el cálculo derivado por
resta que había antes, ese mismo descuadre habría pasado en verde.

**Commit previo a las inyecciones:** `f3c0f37247bcfc8a33c2a158777c815b5649908a`. Todos los rojos se
inyectaron después de él y se retiraron; el árbol quedó limpio entre uno y otro.

## 6 · El instrumento, con una corrección al encargo

El encargo traía dos avisos del 17-ago. **Uno se confirma y el otro no se ha podido reproducir**, y
queda escrito así en vez de repetirlo como cierto:

| instrumento | lo reportado el 17-ago | medido el 19-ago (git 2.55.0.windows.2) |
| --- | --- | --- |
| `grep` de Git Bash | normaliza CRLF, falso negativo | **CONFIRMADO**: fichero con 3 CR en disco, `grep -c` dice **0**, node dice **3** |
| `git show <rev>:<ruta>` | aplica el filtro de salida | **NO REPRODUCIDO**: sobre un blob anterior a la renormalización dio los mismos **223 CR** que `git cat-file` |

No se borra el segundo aviso —el modo de invocación importa, y `git show` en modo *diff* sí reescribe
lo que enseña— pero deja de afirmarse como universal. La regla que sobrevive a las dos mediciones, y
la única que hay que recordar, sí queda escrita en el test: **el blob se lee con `git cat-file`, y
los CR se cuentan en BYTES con node**. Nunca con grep.

## 7 · Fuera de carril · se reporta, no se arregla (regla 37)

Los tres tienen destino asignado por el fundador el 19-ago-2026. **Ninguno se arregla aquí**, y
queda escrito para que la próxima sesión no los vuelva a descubrir desde cero.

1. **El título del caso promete más de lo que mide.** Dice «el ÁRBOL DE TRABAJO no tiene ni un
   `\r`», pero la población es sólo la que `.gitattributes` promete en LF. Medido: `.gitattributes`
   tiene **61 CR en disco** en los tres worktrees comprobados —incluido uno materializado hoy—
   porque cae bajo `* text=auto` sin `eol=lf` y no lo mira nadie. No es un defecto del árbol: es que
   el título dice «el árbol» donde el test dice «lo prometido».
   → **Se queda en esta línea. No se arregla.**
2. **`cobroflash-b1` y `cobroflash-b3` están ciegos hoy.** Cualquier medición que salga de esos dos
   worktrees sobre finales de línea no vale, y nada se lo dice a quien trabaje ahí salvo el suelo de
   `tests/scrum480-fin-de-linea.test.mjs` — que ahora, al menos, nombra la causa.
   → **Operativo. Lo lleva el fundador.**
3. **`npm ci` no ejecutó los `postinstall`** en el worktree nuevo (`npm warn allow-scripts`), así que
   el cliente de Prisma no se generó solo pese al `postinstall` declarado en `package.json`. Hubo que
   lanzar `npm run prisma:generate` a mano. Si eso mismo pasara en Railway, el motivo por el que ese
   `postinstall` existe (SCRUM-238) dejaría de cumplirse sin avisar.
   → **Abierto como SCRUM-518.** No se toca desde aquí.

## 7b · Una corrección al encargo, y a favor del encargo

El encargo daba por víctima que «`npm test` no puede estar en verde en un worktree local». **No es
universal:** en este árbol, hoy, la tanda entera salió en verde (3.674 tests, 0 fallos, 77 gateados
en skip). Lo que no puede estar en verde es un worktree *veterano*. Es la misma conclusión del
ticket vista desde el otro lado: el caso 4 medía **la edad del árbol**, no la salud del repositorio.

Y el hallazgo que no venía en el encargo, que salió al escribir su propia comprobación: la
cuadratura del censo, tal como la escribí primero, **era una identidad algebraica**. Con `sinCR` y
`binarios` derivados por resta de `leidos` y `textos`, la suma cierra siempre y el assert no puede
fallar jamás. Un assert que no puede fallar es un adorno con forma de prueba, y habría entrado en
este mismo commit como si fuera una verificación. Por eso los dos contadores se cuentan ahora en su
rama del bucle: sin eso, la sección 5 de esta entrada estaría citando un rojo imposible.

## 8 · Lo que no se ha tocado

El camino de emisión y el sellado (regla 38), `prisma/schema.prisma`, los cuatro guards de entrada,
y los otros siete casos de `tests/scrum480-fin-de-linea.test.mjs` — se comprobó que ninguno estaba
roto por lo mismo. El único cambio en `tests/_censo-eol.mjs` es aditivo: dos contadores nuevos en el
objeto que devuelve `censoArbolDeTrabajo`, sin tocar los campos que leen los demás casos.
