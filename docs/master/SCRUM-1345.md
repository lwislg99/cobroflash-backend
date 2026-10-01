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

# SCRUM-1391 · Las puertas de §⑤, EJECUTADAS: dos certifican como VIVO a un guard mudo, una borra un hallazgo, y los «8 tests con plazo» son 2

**Medido contra:** `origin/main` = `cadf00bcee699dc200ff142050986a62b692b3c4` · 2026-10-01T16:14:23Z
(J6 del equipo de Javier, sesión `jv-j6j`, relevo de J6i; encargo del orquestador `cobroflash-backend-5b`. Esta
sección EJECUTA lo que la tabla de §⑤, más arriba, sólo había leído, y la corrige donde la ejecución dice otra cosa.)

A9: aviso → cicatriz J6 «Enlacé el `node_modules` de verdad dentro de una carpeta temporal que se borra sola: borrar ese temporal de golpe habría seguido el enlace hasta lo enlazado.» — no se pudo comprobar: el banco de este ticket quita primero el enlace y comprueba que lo de verdad sigue entero antes de borrar, pero el siguiente banco que enlace algo no lo hereda

## En corto

Es medir, no arreglar: no se toca ningún guard, techo, plazo ni workflow. La pregunta de cada puerta es la de §⑤
—¿agotar el plazo sale por la misma puerta que un hallazgo?— y la respuesta ejecutada es peor que la pregunta en
dos de ellas: **agotar el plazo sale por la puerta del VERDE.**

| puerta | su plazo | qué pasa al agotarlo (ejecutado) | ¿la forma? | distancia medida |
|---|---|---|---|---|
| `meta-guard-mutaciones.mjs` | 300 s **por test**, no por fichero | un guard MUDO por construcción, cuya mutación sólo lo hace tardar, sale **VIVA** a los 300 s | **sí**, y certifica al guard | la pasada más lenta en CI, 30,7 s (10 %, ×9,8) |
| `censo-mudez.mjs` | 180 s por fichero | en la pasada limpia → CIEGO (bien); en la mutada → el guard mudo cuenta como **VIVO** | **sí**, y certifica al guard | el fichero más lento, 22,4 s (12,4 %, ×8,0) |
| tests con `{ timeout }` | 2 tests (8 s y 120 s) | `not ok`, salida 1; el resumen lo cuenta como `cancelled`, no como `fail` | **sí** | 0,2 s de 8 (×40) y 17,0 s de 120 (×7,1) |
| `censo-guards-gateados.mjs` | 300 s por test | un guard gateado con un `before` lento **desaparece** de «gateados» y de «expuestos» | **la inversa**: el plazo borra un hallazgo | el test más lento de la tanda, 82,5 s (27 %, ×3,6) |
| `puerta-claude-empuje.mjs` | 10 min por fichero | el test nombrado no llega a salir → `SIN-CORRER` → `NO-EMPUJA-CIEGO` | **no** | sin medir |
| `staging-gated.mjs` | 5 o 45 min por hijo | NO SE PUDO LANZAR (pide base). Sus dos mitades puras: el plazo se reconoce, y el recibo lo separa del rojo | sin juzgar entera | **el último recibo está al 100 %: ya se agotó** |

La línea que sale siempre, también con cero, y que escribe el propio banco (`salida-todas.txt`):

    5 puertas ejercitadas · 3 con la forma · 1 que no se pudieron ejercitar   (de 6 · 1 con la forma inversa · pasadas que no terminaron: ninguna)

Tres cosas que cambian lo que decía §⑤:

1. **`censo-mudez` SÍ se puede ejercitar sin correrlo entero y sin tocar el árbol**: sobre una copia de `scripts/`
   fuera del árbol, con una carpeta `tests/` fabricada.
2. **`censo-guards-gateados` no tiene «la misma forma»: tiene la contraria.** Un plazo ahí no fabrica un hallazgo: quita uno.
3. **Los «8 ficheros, 10 plazos» de la fila «tests con `{ timeout: N }`» son 2 tests en 2 ficheros.** Ver ⑤.

## ① Cómo se ejercitó sin tocar nada

`docs/master/evidencias/SCRUM-1391/banco.mjs` copia `scripts/`, `tsconfig.json`, `package.json` y
`tests/_guard-texto.mjs` a una carpeta temporal fuera del árbol (comprueba antes que esos ficheros no tienen cambios
y dice el sha256 de la puerta copiada y el del árbol), fabrica allí tests de mentira que agotan el plazo, y corre
contra ellos el código real de cada puerta, sin modificarlo: `correr()` y `aplicarUna()` del meta-guard,
`medirGateados()` y `veredictoDelCenso()`, `pasadaLocal()` → `veredictoLocal()` → `decidirEmpuje()`, y
`scripts/censo-mudez.mjs` lanzado entero. Los tests de mentira viven en cadenas dentro del banco, no en ficheros
del repo: aquí no entra ningún test con plazo, que sería meter la forma que se mide.

Cada pasada lleva sus controles, y sin ellos la puerta sale «no ejercitada»: en el meta-guard, la misma cobaya con
una mutación inofensiva tiene que salir MUDA; en el censo de mudez, el mudo de control, el que sólo nombra el filtro
y el lento-siempre tienen que salir MUDO, NO APLICA y CIEGO; en gateados hay una pasada previa con esperas de 2 s.
Nueve pasadas, las nueve terminaron con su `EXIT=0`; ninguna matada.

## ② Lo que hay debajo: el plazo de `run()` no es un techo del fichero

`run({ timeout: 300000 })` de `node:test` no vigila al proceso hijo: le pasa el número como plazo **de cada test**.
Medido con un plazo de 4 s (`salida-sonda.txt`):

| el fichero de mentira | qué entrega `run()` |
|---|---|
| un test que espera en asíncrono | `test:fail` **con el nombre del test**, `failureType=testTimeoutFailure`; el resumen dice `cancelled: 1, failed: 0` |
| un test que se bloquea 12 s en síncrono | no lo corta nadie: a los 12 s **pasa**, los tres tests en verde |
| todos los tests saltados y un `before` que tarda | los saltados salen como `test:fail` con `skip` puesto y `failureType=hookFailed`; el resumen dice `skipped: 2` y `success=true` |
| todos saltados y el proceso muere al cargar | un `test:fail` cuyo nombre es la ruta del fichero |

De ahí salen las dos puertas que usan `run()`. Y un dato que no es de ninguna puerta: **en síncrono no hay techo**.
La misma cobaya del meta-guard bloqueada 330 s volvió a los 330 s y salió MUDA (`salida-meta-sync.txt`); en la
exploración previa, un bloqueo sin fin con plazo de 4 s seguía vivo a los 196 s, cuando lo paré a mano (esa salida
no se cuenta ni está en git). Lo único que corta eso es el techo del job, 30 min, que GitHub da por `cancelled`.

## ③ El hallazgo: en dos puertas, agotar el plazo certifica al guard

**meta-guard** (`salida-meta-async.txt`). La cobaya es un guard mudo a propósito: su test declarado afirma
`1 === 1`, no mira el sujeto. Con la mutación de control sale MUDA en 0,3 s («PASÓ (corrió y no falló)»). Con una
mutación que **sólo lo hace esperar 330 s** sale **VIVA** a los 300,3 s: `correr()` mete en `caidos` todo
`test:fail`, el de plazo trae el nombre del test, y `cayo()` lo encuentra. El error estaba capturado y decía
`test timed out after 300000ms`, pero ningún veredicto lo lee. El testigo de la cobaya dice «entra» y nunca «sale»:
el aserto no llegó a ejecutarse. Es la fila de §⑤, confirmada, y con el matiz de ②: sólo en asíncrono.

**censo-mudez** (`salida-mudez.txt`). Veinte guards de mentira: 16 vivos, un mudo de control, uno que sólo nombra
el filtro, un mudo que tarda 200 s **sólo cuando el filtro devuelve vacío**, y uno que tarda 200 s siempre. El censo
dijo `VIVO 17 · MUDO 1 · CIEGO 1 · NO APLICA 1`: el lento-siempre sale CIEGO, que es lo correcto; el mudo lento
**cuenta entre los vivos** (17 con 16 de verdad) y no aparece en la lista de mudos. Sale de
`correr(f).verde ? 'MUDO' : 'VIVO'`: un `status` nulo no es verde. Igual lo haría un proceso matado desde fuera.

Las dos tienen la misma consecuencia y es la contraria a la de `guards:entrada`: allí el plazo fabricaba un rojo que
alguien iba a mirar; aquí fabrica un «vivas N · mudas 0» que no mira nadie.

Aplicado el criterio de SCRUM-1336 (c.17965): «el guard cae» es un juicio deducido de algo que **se vio** —un
`test:fail`—, pero lo que se vio no es que el aserto cazara la mutación, sino que el reloj venció. El dato que los
separa ya llega: `failureType=testTimeoutFailure` en un caso, `status === null` en el otro. No se ha tocado nada.

## ④ `censo-guards-gateados`: la forma inversa

`salida-gateados.txt`. Seis ficheros de mentira; tres son gateados de verdad (`g1` de control, `g4` con un `before`
lento, `g5` que muere al cargar) y a los tres se les supone declaración, así que la verdad son 3 gateados y 3 expuestos.

| pasada | lo que dice el censo |
|---|---|
| esperas de 2 s (bajo el plazo) | gateados `g1, g4` · expuestos `g1, g4` |
| esperas de 330 s (plazo vencido) | gateados `g1` · expuestos `g1` |

Con el plazo vencido, los tests saltados de `g4` llegan como `test:fail`, `clasificarEvento` los da por `caido`, y
la rama `else` de `medirGateados` los suma a `reales`: el fichero deja de ser «todos sus tests saltados». La lectura
de J6i —«un plazo ahí cuenta como test real, no como hallazgo»— es literalmente cierta; lo que no se seguía de ella
es «no tiene la forma»: en un censo, contar de menos es el fallo. «② EXPUESTOS: ninguno. El meta-guard no está
emitiendo ningún veredicto hueco» es un juicio deducido de **no haber visto**, y con un plazo vencido de por medio
queda sin juzgar.

`g5` no aparece en ninguna de las dos pasadas: un gateado cuyo proceso muere cuenta como «real» sin plazo ninguno.
No es de este ticket —es la forma de SCRUM-1386, en otra puerta— y se deja dicho. Un test real que tarda (`g3`) o
se bloquea (`g6`) no cambia nada: ya contaba como real.

## ⑤ El 8, el 5 y el 2

§⑤ dice «8 ficheros, 10 plazos (de 0,7 s a 120 s) · contado con un patrón estrecho». J6i encontró 5 ficheros.
Ninguno de los dos números es el de los tests con plazo propio, y los dos se reproducen:

| quién | patrón de TEXTO | sobre | da |
|---|---|---|---|
| J6h | `{ timeout: <número>` | `8f5906bc` | **8 ficheros, 10 plazos** |
| J6i | `{ timeout: <número> }` (con la llave de cierre) | `cadf00bc` | **5 ficheros, 6 plazos** |

Por AST (`censo-plazos.mjs`: cada `timeout:` de un objeto literal, clasificado por **la llamada que recibe ese
objeto**), sobre 1.328 `.mjs` de `tests/` en `cadf00bc`, con el plazo de `scrum976` como control positivo:

- 42 apariciones en 26 ficheros;
- **4 son argumento de `test()`**, en 3 ficheros (`scrum1007` ×2, `scrum358`, `scrum976`);
- 30 van a `spawnSync`, 5 a `prisma.$transaction`, 2 a `execFileSync`, 1 a `execFile`.

Los 10 de J6h son esos 4, más 4 opciones de transacción de Prisma (`scrum234` ×2, `scrum592`, `scrum1333`), un
`spawnSync` de 700 ms (`tests/scrum554-el-censo-no-confunde-el-numero.test.mjs`: el «0,7 s») y un `{ timeout: 20000 }`
que ni siquiera es código: vive **dentro de una cadena**, en el fuente de cebo de
`tests/scrum728-seccion-critica-de-la-serie.test.mjs`. Los 6 de J6i, los 4 más el de `tests/scrum592-concurrencia-serie.test.mjs`
y el de esa cadena. Contar texto no es contar cosas.

**Y de los 4, sólo 2 están en vigor.** En `tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs` las opciones van
**después** de la función —`test(nombre, fn, { timeout: 20_000 })`— y `node:test` las ignora. Ejecutado
(`salida-plazo-test.txt`): un test de 2 s con `{ timeout: 500 }` detrás de la función **pasa**; con las opciones
delante, cae a los 0,5 s. Esos dos tests llevan escrito un plazo de 20 s que no existe. Uno de ellos tarda 8,6 s en
CI. No se toca: es de otro carril, y arreglarlo sería meter dos plazos de verdad.

Quedan `tests/scrum358-drenado.test.mjs` (8 s) y el caso ④ de `tests/scrum976-guards-entrada-con-techo.test.mjs`
(120 s). Al vencer salen `not ok` con salida 1 —la forma—, y el resumen los cuenta como `cancelled`, no como `fail`:
quien lea «fail 0» lee un cero que no dice «no cayó nada».

## ⑥ `staging-gated`: no se pudo lanzar, y no vive lejos

No se lanzó: toma el turno contra la base de pruebas antes del primer hijo, también en autotest, y este encargo no
toca ninguna base. Ejecutadas sus dos mitades puras (`salida-staging.txt`):

- un hijo real con el plazo vencido devuelve `status=null`, `signal=SIGTERM`, `ETIMEDOUT`, y `esAbortadoPorTiempo` dice `true`; un rojo que termina, `false`;
- el recibo que deja cada caso: plazo vencido → clave `[hijo]` → «TANDA NO VÁLIDA, vuelve a lanzarla»; rojo → clave `[rojo]` → «ticket y cuarentena».

Que los dos acaben en `fallaron` y `salir(1)` queda **leído**, como en §⑤. Lo ejecutado añade que la tabla de §⑤
se quedaba corta al decir «sí en el código, no en el texto»: tampoco en el recibo, que es lo que lee el guard de cierre.

Y la distancia. `recibos.mjs` lee los recibos que hay en esta máquina (4 en 55 árboles):

| recibo | bloque `qa` contra sus 45 min |
|---|---|
| 2026-09-02 | 72 % |
| 2026-09-04 | **100 %, y el hijo `qa` en `null`**: agotó el plazo |

No es deuda: **ya pasó**. Son cuatro recibos, el último de hace 27 días y de una sola máquina: no dicen cómo está
hoy. Dicen que el único dato que existe contradice «viven muy lejos de su techo».

## ⑦ `puerta-claude-empuje`: no tiene la forma

Era el «no lo sé» de §⑤. `salida-empuje.txt`, con `timeoutMs` pasado como parámetro (3 s; la puerta no se toca):
si el test que cayó en CI no llega a salir antes del corte, el TAP queda sin su línea, `veredictoLocal` dice
`SIN-CORRER` y `decidirEmpuje` dice `NO-EMPUJA-CIEGO`. Un caso que conviene saber: si el test nombrado ya salió
`ok` y el que cuelga es **otro** del mismo fichero, dice `EMPUJA-GUARD-VERDE` con un TAP sin resumen. Es un juicio
sobre algo que sí se vio, y es lo que la puerta promete (mira el test que cayó, no el fichero).

## ⑧ La distancia al techo

| puerta | qué se midió | el peor | margen |
|---|---|---|---|
| meta-guard | intervalo entre veredictos en 6 logs de CI de `main` (385 a 405 veredictos cada uno); es cota superior de cada pasada | 30,7 s de 300 | ×9,8 |
| censo-mudez, pasada limpia | los 119 ficheros de su población, uno a uno, en el árbol real | 22,4 s de 180 | ×8,0 |
| censo-mudez, pasada mutada | los mismos 119, sobre una copia entera del commit | 22,1 s de 180 | ×8,2 |
| `scrum976` ④ | su duración en 6 corridas del obligatorio | 17,0 s de 120 | ×7,1 |
| `scrum358` | ídem | 0,2 s de 8 | ×40 |
| gateados | el test más lento de toda la tanda en esas 6 corridas («SCRUM-814 · los dos caminos…») | 82,5 s de 300 | ×3,6 |

Cada cifra es **una muestra**, y un máximo observado es un suelo del máximo real, no un techo. Tres cosas que hay
que leer junto a la tabla:

- **El margen de `censo-mudez` (×8) es menor que la única varianza medida en esta casa (×9).** En SCRUM-1339 §⑦,
  `guards:entrada` pasó de 10 s a más de 90 s en la misma máquina según los núcleos libres. Es otra puerta y otra
  población, así que no dice que los 180 s se crucen; dice que el margen cabe dentro de un rango que ya se ha visto
  moverse. El fichero que lo cruzaría primero es `tests/scrum775-suelo-que-no-dispara.test.mjs`.
- **La pasada mutada no tarda más que la limpia** (105 s contra 107 s sobre la copia, y el mismo fichero el más
  lento): con el filtro vacío los guards caen pronto.
- **Las de CI son de Linux y de un runner sin vecinos.** `scrum976` ④ lanza `guards:entrada`, cuyo plazo son 90 s:
  en una máquina cargada le quedan 30 s hasta sus 120 (leído, no medido aquí).

Estado de la máquina al medir `censo-mudez`: 5.251 MB libres a las 16:34:22Z (limpia) y 5.212 MB, 8 procesos node y
la CPU al 9 % a las 16:41:48Z (copia). Con turno del orquestador las dos veces.

Lo que **no** se midió: cuánto tardan los `before` de los ficheros gateados de verdad, que es lo que dispararía ④
(`censo:gateados` corre la carpeta entera y no se lanzó); y `puerta-claude-empuje`.

## ⑨ Lo que salió de paso y no es de este ticket

- **El censo de mudez de verdad, entero y sin tocar, sobre una copia de `cadf00bc`** (`salida-mudez-censo-de-verdad-copia.txt`):
  salida 1 · `VIVO 104 · MUDO 1 · CIEGO 0 · NO APLICA 10 · YA ROJO 4`. El mudo es
  `tests/scrum589-nombre-por-documento.test.mjs`. No se ha mirado por qué ni desde cuándo: es SCRUM-1395. Los 4
  «YA ROJO» son del envase —la copia no tiene `.git` y 5 de los 119 dependen de él; en el árbol real los 119 salen
  verdes—, así que esos 4 quedan **sin juzgar**, no «no mudos».
- **Con `FORCE_COLOR` puesto, `censo-mudez` no ve nada y sale 0** (`salida-mudez-con-color.txt`): los 20 de mentira,
  mudo de control incluido, salen CIEGO, y la salida es 0. Su expresión del resumen (`^\D*tests (\d+)`) no pasa por
  encima de los dígitos del código de color. Las sesiones heredan `FORCE_COLOR=3`.
- **Las 6 mutaciones del banco de este mismo registro** (`evidencias/SCRUM-1345/mutar.mjs`): 3 de sus anclas (M1,
  M2, M5) ya no existen, porque SCRUM-1386 reescribió esas líneas. Hoy las daría ciegas. No se tocan aquí.

## Lo que NO sé y lo que NO cubre

- **Todo el banco corrió en Windows** (node 24.18.0). El CI es Linux con node 24: que `run()` pase el plazo por test
  y que `spawnSync` devuelva `status` nulo al cortar no se ha ejecutado allí.
- **`staging-gated` entera no se ejecutó**, ni el `censo:gateados` de verdad.
- **Los 33 plazos de `spawnSync`, `execFileSync` y `execFile` dentro de tests** no son «tests con
  plazo propio» y no se ejercitaron: cada uno hace lo que diga su aserto cuando el hijo vuelve cortado.
- **Si en el árbol real hay hoy algún guard que sólo tarde al mutar**, no se sabe: el banco demuestra que la puerta
  lo certificaría, no que lo esté haciendo.
- **En síncrono**, «no lo corta nadie» está medido hasta 330 s; que el job lo corte a los 30 min está leído.

## Mis errores

- **Enlacé el `node_modules` de verdad dentro de carpetas temporales del trabajo, que se borran solas.** Lo vi
  antes de acabar y quité los enlaces a mano; el banco comiteado quita el enlace primero y comprueba. Es la cicatriz.
- **Mi instrumento de distancia dio «375 % del plazo» sobre cero veredictos.** El patrón pedía un espacio que yo
  mismo había recortado. Lo paró su propia línea de población («0 veredictos»), no yo.
- **Bajé 12 logs de CI de 0 bytes.** `gh api` se niega a escribir secuencias de escape sin su bandera y sale 1. Lo
  cazó imprimir los bytes de cada bajada.
- **El primer montaje de la copia quedó vacío** (una ruta de Windows con barras invertidas pasada a `tar`), y el
  segundo sin `tsconfig.json`. Los dos los cazó el canario de 3 s, antes de las pasadas de 300 s.
- **Arreglé el patrón con un `sed` que no cambió nada** y volví a leer el mismo número malo. Las barras invertidas
  no sobreviven a esa vía en esta máquina; estaba escrito en la memoria del puesto.
- **Di por hecho que `censo-mudez` pediría correrlo entero sobre el árbol**, y así se lo dije al orquestador en el
  primer mensaje. No hacía falta.

## Lo que no está en git, y reproducir

Los 12 logs de CI (10 MB) se rebajan por id con `bajar-logs.mjs`. La copia entera del commit no se guarda: sale de
`git archive`. La pasada limpia sobre el árbol real (`salida-mudez-limpia-arbol-real.txt`) se corrió con la versión
del guion anterior a comitearlo —misma orden, mismo plazo—; las demás, con los ficheros de esta carpeta.

Desde la raíz del árbol, con todo commiteado:

    node docs/master/evidencias/SCRUM-1391/banco.mjs todas --node-modules <carpeta node_modules>
    node docs/master/evidencias/SCRUM-1391/censo-plazos.mjs <raíz con node_modules> tests
    node docs/master/evidencias/SCRUM-1391/bajar-logs.mjs <carpeta fuera del árbol>
    node docs/master/evidencias/SCRUM-1391/distancia-meta.mjs <los logs meta-*.log>
    node docs/master/evidencias/SCRUM-1391/distancia-tests.mjs <los logs bt-*.log>
    node docs/master/evidencias/SCRUM-1391/recibos.mjs <carpeta que contiene los árboles>
    node docs/master/evidencias/SCRUM-1391/distancia-mudez.mjs limpia <raíz> <salida.jsonl>
    node docs/master/evidencias/SCRUM-1391/distancia-mudez.mjs mutada <copia fuera de git> <salida.jsonl>

`banco.mjs todas` tarda unos seis minutos: casi todo es esperar a que venzan los plazos de verdad. Los modos
`mutada` y `censo` de `distancia-mudez.mjs` se niegan a correr sobre una carpeta que cuelgue de un repositorio.

## Después de empujar: el banco no borraba sus temporales si reventaba

A9: comprobación → `tests/scrum864c-el-temporal-no-vuelve.test.mjs`

(Sesión `jv-j6k`, relevo de J6j. Lo de este apartado está medido sobre la rama con `origin/main` =
`b3b40554ed5441c285c780590a98d1665636e778` mezclado.)

El obligatorio del PR #2117 cayó sobre `e08d41e9` por un caso, «SCRUM-864c · 🔴 ③ NINGÚN temporal nuevo nace sin
borrarse», que señalaba las cuatro llamadas a `mkdtempSync` de `banco.mjs` (líneas 63, 100, 133 y 206 de aquel
commit): se borraban, pero fuera de un `finally`, así que un fallo a mitad dejaba la carpeta. El guard tenía razón
y no se ha tocado. Visto en rojo antes de arreglar (4 casos: 3 pasan y cae el ③ con esas cuatro líneas) y en verde
después (4 de 4).

Y medido por efecto, no sólo por forma. Reventando a propósito cada sitio justo después de crear su carpeta, con
un `node_modules` de mentira:

| versión de `banco.mjs` | sitios que dejan su carpeta en el temporal del sistema |
|---|---|
| la de `e08d41e9` | 4 de 4 |
| la arreglada | 0 de 4 |

Tres sitios (`sonda`, `plazo-test`, `empuje`) usan ahora `temporal()` de `tests/_temporal.mjs`. **El cuarto,
`montar()`, no, y a propósito:** dentro de esa carpeta cuelga el enlace al `node_modules` de verdad, y `temporal()`
la borraría al salir sin quitar antes el enlace, que es la cicatriz de este mismo ticket. `montar()` registra su
propio `process.on('exit')`, que hace lo mismo que `desmontar()`: quita el enlace, comprueba que lo enlazado sigue
entero, y sólo entonces borra. Si el enlace no se deja quitar, la copia se queda.

Medido aparte, con un destino de mentira: en node 24.18.0 sobre Windows, `fs.rmSync` recursivo NO atraviesa un
enlace de directorio (borra la copia y deja el destino). Es una muestra en una versión; no dice nada de lo que
borra la carpeta de un trabajo cuando el trabajo se elimina, que es de lo que habla la cicatriz.

**Las salidas de esta carpeta (`salida-*.txt`) son de `banco.mjs` tal como estaba en `e08d41e9`.** Con el
arreglado se volvieron a correr cuatro de los nueve modos: `plazo-test`, `empuje` y `gateados` dan la misma línea
de veredicto, byte a byte, y `sonda` (que no da veredicto) las mismas 19 líneas salvo tiempos, ruta y commit.
`staging` no usa carpeta temporal. **`meta-async`, `meta-sync`, `mudez` y `mudez-con-color` NO se volvieron a
correr:** pasan por el mismo `montar()` y `desmontar()` que `gateados`, y eso está leído, no ejecutado.

Lo que salió de paso y no es de este ticket: el censo de `scripts/_censo-mkdtemp.mjs` empareja la creación con su
borrado por el NOMBRE de la variable en todo el fichero, sin mirar la función. Preguntado a `clasificaFuente` con
fuentes fabricadas: una función que no borra su `dir` sale SIN_LIMPIEZA sola, y GARANTIZADA si otra función del
mismo fichero borra en un `finally` un `dir` suyo (control: con otro nombre sigue SIN_LIMPIEZA). En este banco
las cuatro carpetas se llamaban `dir`: arreglar sólo una habría puesto el guard en verde con tres fugas dentro.
No se toca aquí; va al orquestador.

La ruta del `import` desde esta carpeta son cuatro `../`, no los tres del ejemplo de la orden, que ya avisaba de
comprobarla: se comprobó corriéndolo.

Mi error: medí los retornos de carro de este registro con `grep` sobre la salida de `od` y me dio 12 en 200
bytes; contados por bytes son 0. La trampa estaba escrita en la memoria del puesto.
