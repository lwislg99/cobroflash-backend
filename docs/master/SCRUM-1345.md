# SCRUM-1345 · El plazo de `guards:entrada` no es su presupuesto: pasarse sale CIEGO, y el presupuesto se juzga en CI

**Medido contra:** `origin/main` = `8f5906bc51c1c17dfd4fd3d44c1bd028324b8f48` · 2026-10-01T07:40:31Z
(J6 del equipo de Javier, sesión `jv-j6h`, relevo de J6g; encargo del orquestador `cobroflash-backend-5b`.
La medición que motiva el ticket es de J6g y de J2f y está en `docs/master/SCRUM-1339.md` §⑦: aquí no se
repite, se construye sobre ella.)

A9: comprobación → `tests/scrum824-temporales-fuera-del-arbol.test.mjs`

## En corto

`npm run guards:entrada` tenía un techo de 90 s y pasarse salía **1**, el mismo código que «un guard
encontró algo». Cuánto tarda no lo decide la lista sino la máquina. Desde este cambio:

| lo que pasa | antes | ahora |
|---|---|---|
| se agota el plazo y ningún test había caído | salida 1, «se pasaron del TECHO» | **salida 2**, «no terminé; no sé nada de tus guards» |
| se agota el plazo y algún test YA había caído | salida 1, sin decir cuál | **salida 1**, con los caídos nombrados y «la lista NO es completa» |
| termina con un guard en rojo | salida 1 | salida 1 |
| termina limpio | salida 0 | salida 0 |

El número **no sube**: siguen siendo 90 s. La lista sigue siendo de 12. No se toca ningún workflow.
El presupuesto de tiempo se sigue juzgando, pero sólo donde la carga es constante: en CI, en el caso ④
de `tests/scrum976-guards-entrada-con-techo.test.mjs`, que allí es tan estricto como antes.

La línea que sale siempre, también en verde y también si no se lanzó nada: `12 guards · 9.3 s · plazo 90 s`.

## ① El rojo de hoy, visto antes de tocar nada

Instrumento: `evidencias/SCRUM-1345/pasada.ps1`. Lanza N copias del comando a la vez, todas atadas a los
mismos núcleos (la afinidad se pone al proceso que lanza y los hijos la heredan), y deja de cada una su
salida, su error, su código y sus segundos. Su primera línea es la población (HEAD, ficheros sucios,
memoria libre, procesos `node`, carga de CPU) y la última, el tiempo total. Las pasadas son de entre
las 07:32Z y las 07:45Z del 1-oct-2026; el guion no sella la hora de cada una.

Sobre `origin/main` sin tocar (HEAD `8f5906bc`, 0 ficheros sucios):

| pasada | copias | núcleos | salida | segundos |
|---|---|---|---|---|
| `antes-canario` (plazo bajado a 1 ms) | 1 | 12 | 1 | 0,1 |
| `antes-1nucleo` | 2 | 1 | **0 · 0** | 50,4 · 50,6 |
| `antes-1nucleo-x4` | 4 | 1 | **1 · 1 · 1 · 1** | 90,6 · 90,3 · 90,3 · 90,5 |

Cuatro de cuatro salen 1 a los 90 s sin que nadie haya tocado un guard, con este texto
(`antes-1nucleo-x4-1.err.txt`): «los guards de entrada se pasaron del TECHO […] Deja sitio a alguno de la
lista o sube el techo A PROPÓSITO». En lo que el runner llegó a escribir antes del corte había de 105 a
118 tests en verde de 122 y **ninguno caído** (`antes-1nucleo-x4-1.out.txt`): el rojo no era de ningún guard.

**Un dato que no cuadra con la serie de J6g, medido y no explicado.** Con UN núcleo ella midió 61,9 s,
77,0 s y más de 90 s lanzando una sola copia. Aquí, dos copias a la vez en un núcleo cupieron las dos en
50 s. La máquina estaba más tranquila (14 procesos `node` y 13 % de CPU al lanzar; ella midió con 24 y 46
procesos y la CPU al 100 %). No sé qué parte de la diferencia es eso. Lo que sí dice: si dos copias caben
donde una no cabía, lo que ese techo medía no era el trabajo sino el momento.

## ② Después, sobre el comando real

Mismo instrumento, con el árbol de esta rama (3 ficheros sucios: el comando, su test y este registro):

| pasada | qué se le hace | salida | lo que dice |
|---|---|---|---|
| `despues-1ms` | plazo bajado a 1 ms | **2** | «CIEGO — no terminé; no sé nada de tus guards» · `0 hallazgos · 1 ciego` |
| `despues-1nucleo-x4` | 4 copias en 1 núcleo, plazo real de 90 s | **2 · 2 · 2 · 2** | lo mismo, a los 90,2-90,3 s |
| `despues-rojo-real` | un rojo de verdad, dentro de plazo | **1** | «Algún guard de entrada está en rojo» · `6 hallazgos · 0 ciegos` · 10,2 s |
| `despues-rojo-y-plazo` | el mismo rojo, y el plazo agotado de verdad | **1** | «HALLAZGO, y además no terminé», con los 3 caídos nombrados · `3 hallazgos · 1 ciego` |
| `despues-verde` | nada | **0** | «12 guards de entrada en verde (122 tests, 9.3 s de 90)» |

**El rojo de verdad no se fabricó rompiendo un guard.** Fue este mismo registro, escrito a propósito sin
su línea «Medido contra», que es justo lo que `scrum267` existe para cazar. Cayeron sus tres casos; salen
6 porque `scrum811c` importa `scrum267` y los registra otra vez.

**El caso que protege lo ganado es el cuarto.** Para agotar el plazo de verdad con un rojo dentro se ató
el comando a un núcleo y se le bajó el plazo a 25 s (bajar se puede desde el entorno; subir, no). El
runner fue cortado vivo a los 25,1 s, y los tres casos de `scrum267` que ya habían caído salieron con
nombre y con código 1. Un guard que encontró algo no pasa a ciego porque además se acabe el tiempo.

## ③ Cómo está hecho

En `scripts/guards-entrada.mjs`:

- `cuentasDeLaPasada({ agotado, status, salida })` cuenta las dos cosas —hallazgos y ciegos— y nada más.
  El código lo decide `veredictoDe` de `scripts/_hallazgos-y-ciegos.mjs` (SCRUM-1320), el mismo que usan
  los guards de navegador. No hay una tercera forma de decidir un veredicto.
- Plazo agotado = **un ciego siempre**, más tantos hallazgos como tests caídos hubiera ya en la salida.
- Al runner se le corta con `SIGKILL`: después del corte no escribe nada, así que lo que hay en la salida
  es lo que dijo estando vivo. Lo que sale de un proceso matado no se cuenta.
- `PRESUPUESTO_MS` se deriva de `TECHO_MS`. Es el mismo número; lo que cambia es dónde se juzga.

En `tests/scrum976-guards-entrada-con-techo.test.mjs`:

- ③ (plazo de 1 ms) exige ahora salida 2 y el mensaje literal. Antes exigía 1. Es el único aserto
  existente que cambia de valor, y es el cambio que pide el ticket.
- ④ lanza el comando de verdad. La sentencia es una función pura, `sentenciaDelPositivo`, para poder
  darle las dos mitades sin estar en los dos sitios: en CI cualquier salida distinta de 0 cae, y pasarse
  del presupuesto cae; en local sólo deja de tumbar el TIEMPO, y se dice con `diagnostic`.
- ④bis y ④ter prueban eso: la señal `CI` en sus cinco formas, la red de CI, y que un guard en rojo cae
  en los dos sitios.
- ⑤ prueba el caso mixto con la salida REAL del runner de node: dos cebos fuera del árbol corridos
  hasta el final, y su salida recortada antes del resumen. Sin reloj, así que sin sorteo.
- ⑥ la línea.

### Los casos nuevos, vistos caer

`evidencias/SCRUM-1345/mutar.mjs` (salida en `salida-mutar.txt`). Base sin mutar primero: 8 tests, 8
pasan. Cada mutación se aplica sobre el árbol commiteado (`61a71096`), enseña su `git diff --numstat`,
se restaura con `git restore --source=HEAD` y se comprueba que el árbol queda limpio.

| mutación | fichero | cae |
|---|---|---|
| M1 · el plazo agotado olvida los caídos ya vistos | el comando | ⑤ |
| M2 · el plazo agotado deja de contar como ciego (saldría 0) | el comando | ③ y ⑤ |
| M3 · la señal `CI` se lee por verdad y no por presencia | el test | ④bis |
| M4 · en CI el plazo agotado deja de ser rojo | el test | ④ter |
| M5 · un rojo dentro de plazo sale 0 | el comando | ⑤ |
| M6 · la línea de la pasada deja de salir en verde | el comando | ④ |

6 de 6 vivas. ⚠️ M3 y M4 mutan funciones que viven en el propio test (`seJuzgaElPresupuesto` y
`sentenciaDelPositivo`): prueban que los casos ④bis y ④ter miran esas funciones, no que CI las ejercite.
Lo más cerca que se puede estar de CI desde aquí: el fichero entero con `CI=true` puesto a mano → 8 de 8,
y su línea dice «presupuesto de 90 s juzgado: SÍ (CI) · tardó 14.5 s»; sin la variable dice «NO (local:
el tiempo lo decide la máquina) · tardó 9.6 s».

### Lo que se corrió alrededor

Con turno del orquestador, concurrencia 3 y el TAP fuera del árbol, sobre el árbol final (`61a71096`, 0
ficheros sucios): **100 ficheros distintos · 1.018 tests · 1.016 pasan · 0 caen · 2 saltos · 0 cancelados
· 93 s**. Los dos saltos son los GATEADOS por `QA_DB_TEST`. La lista, en
`evidencias/SCRUM-1345/ficheros-de-la-pasada-final.txt`: los 91 de `tests/` que barren el árbol y nombran
`scripts/`, más los que nombran lo tocado y los doce de `guards:entrada`. ⚠️ Al runner le llegaron 110
argumentos y no 100: el `sort -u` que quitaba los repetidos murió por falta de memoria de la máquina
(`fork: Resource temporarily unavailable`) y diez ficheros iban dos veces. No sé si node los corrió una
vez o dos; el veredicto no cambia, el recuento de tests puede.

La primera pasada de esos 91, antes de los arreglos, dio 2 caídos, y los dos eran míos: están en «Mis
errores».

## ④ El trinquete que saltó, y la decisión

`tests/scrum702-suelo-misma-poblacion.test.mjs` cuenta los ficheros que leen una señal del entorno. Tope
19; con este cambio, 20: el caso ④ lee `process.env.CI`. Se paró y se subió al orquestador con dos
caminos. Eligió subir el tope **19 → 20 en este mismo commit**, con su párrafo, porque la alternativa
—no leer el entorno— dejaba vivo el rojo por carga dentro de `npm test` en local, que es el defecto.
Condiciones suyas, y cómo quedan:

1. Una señal, no dos: sólo `CI`.
2. **Se lee por presencia, no por verdad.** Si la variable existe —valga `true`, `1`, `0`, `false` o la
   cadena vacía— se juzga. Sólo su ausencia es «local». La duda cae del lado estricto. Caso ④bis.
3. En CI el caso ④ es tan estricto como antes. Caso ④ter.
4. La línea «presupuesto juzgado: SÍ (CI) / NO (local)» sale siempre, también cuando juzga.

## ⑤ Lo que el ticket dejaba sin medir: ¿tienen otras puertas con techo la misma forma?

Medido, no arreglado. Población: los 266 `.mjs` de `scripts/`, los 8 workflows y los 1.161 ficheros de
`tests/`. «La misma forma» = agotar el tiempo sale por la misma puerta que un hallazgo.

| puerta | su techo | qué pasa al agotarlo | ¿misma forma? | cómo lo sé |
|---|---|---|---|---|
| `guards-entrada.mjs` | 90 s, el comando entero | salía 1 | **sí** (arreglado aquí) | corrido |
| `staging-gated.mjs` | por hijo, ligero o pesado | lo llama «ABORTADO POR TIEMPO» y no agrega sus contadores, pero lo mete en `fallaron` y sale 1 | **sí en el código, no en el texto** | leído |
| `meta-guard-mutaciones.mjs` | 300 s por test | el test da `test:fail` → entra en `caidos` → en la pasada mutada cuenta como que el guard cae | **sí**, y del lado que halaga al guard | leído |
| `censo-guards-gateados.mjs` | 300 s por test | mismo mecanismo que el anterior | **sí** | leído a medias |
| `censo-mudez.mjs` | 180 s por fichero | `status` nulo → `verde = false` → en la pasada mutada sale VIVO | **sí**, del lado que halaga | leído |
| tests con `{ timeout: N }` | 8 ficheros, 10 plazos (de 0,7 s a 120 s) | `node:test` lo da por caído | **sí**, por construcción | contado con un patrón estrecho |
| `guards-visuales.mjs` | 240 s por guard | estado «TOPE», cuenta como ciego; sale 2 si nadie encontró nada y 1 si alguien sí | **no** (separado desde SCRUM-639) | leído |
| techos de job en los workflows | 25 · 20 · 30 · 45 · 5 · 5 · 5 min | GitHub lo da por `cancelled`, no por `failure` | **no**, pero el obligatorio se queda sin puerta | leído |
| `puerta-claude-empuje.mjs` | 10 min por fichero | el TAP queda a medias o no existe | **no lo sé** | no leí aguas abajo |
| `tanda-con-veredicto.mjs` | no tiene | — | — | 0 apariciones de `timeout` |

**Recuento: de 10 puertas, 6 tienen la misma forma (1 corrida y arreglada, 5 leídas), 2 no, 1 no la tiene
y 1 no lo sé.** Dos límites de este recuento: salvo la primera fila, es lectura de código y no ejecución;
y de los 34 ficheros de `scripts/` con algún `timeout:`, los 17 `guard-*.mjs` (plazos de navegador por
acción) quedan fuera porque no son puertas: cada uno ya sale por `guards-visuales.mjs`. De los otros 10
que no están en la tabla, 9 son plazos de transacción de base, de página o de arranque de navegador, y
`censo-guards-navegador.mjs` ya nombra el corte aparte («TOPE», por `_salida-de-guard.mjs`) y no gatea nada.

Lo que distingue a las cinco leídas de la de este ticket es la distancia: `guards:entrada` vivía a 6
veces de su techo en CI y a menos de 1 en una máquina cargada; el meta-guard corta a 300 s tests que
tardan segundos. Que tengan la forma no dice que hoy muerdan.

## Lo que NO sé y lo que NO cubre

- **Un runner matado desde fuera no es el plazo.** Si el arnés mata al runner por memoria, en Windows
  llega como estado 1 sin señal (medido por otros en `scripts/_salida-de-guard.mjs`), sin resumen, y este
  comando lo sigue diciendo en rojo por el suelo nº2 («solo se ejecutaron 0 tests»). Es la misma
  enfermedad y este cambio no la toca: no hay forma de distinguirlo de un fallo en esta plataforma.
- **El caso mixto depende de que el caído se haya escrito antes del corte.** Un guard que fuera a caer
  y no llegó a terminar sale ciego. Es lo correcto —no se sabe— pero conviene saberlo.
- **`fallosVistos` lee texto.** Un guard que imprimiera una línea que empiece por `✖` contaría como
  caído. Por eso el comando enseña las líneas que contó. En cinco salidas reales en verde: 0.
- **En Linux no lo he corrido.** El `SIGKILL` está por eso: quita la pregunta de qué escribe el runner
  de node al recibir la señal por defecto. El CI de este PR es la primera pasada en Linux.
- **La afinidad simula «me quedan N núcleos», no vecinos reales**, igual que en la medición de J6g.
- **No se ha corrido la tanda completa en local.** Se corrieron 91 ficheros (los que barren el árbol y
  nombran `scripts/`) con turno del orquestador, y los 14 que nombran lo tocado.

## Mis errores

- El primer canario del guion de pasadas salió con el código de salida VACÍO: PowerShell 5.1 lo pierde
  si no se toca `.Handle` antes de que el proceso salga. Lo cazó el canario, antes de la pasada de 90 s.
- El test nuevo hizo saltar dos censos que no había mirado antes de escribirlo: `scrum824` (el temporal
  del caso ⑤ colgaba de un parámetro y el censo no podía probar de dónde) y `scrum702` (la señal del
  entorno). El primero se arregló en mi código; el segundo era una decisión y subió. Los encontró la
  pasada de 91 ficheros, no yo.
- Al pasar el caso ④ a una función pura quité el único `assert.match` que respaldaba la negación del
  caso ③, y `scrum237` cayó. Lo cazó correr la BASE antes de mutar; el aserto ha vuelto.
- La primera versión del caso ④ leía dos señales y por verdad a secas. Con `CI=""` habría dejado de
  juzgar sin decirlo. Lo vio el orquestador.

## Reproducir

    powershell -File docs/master/evidencias/SCRUM-1345/pasada.ps1 -Etiqueta x -Copias 4 -Mascara 1
    node --test tests/scrum976-guards-entrada-con-techo.test.mjs

El guion lleva escritas las rutas de la máquina donde se midió: hay que cambiarlas arriba.
