# SCRUM-1335 · Los «ausentes» del trinquete de zona no son de la zona: son casos que no llegan

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:02:22Z
(J6 del equipo de Javier, sesión `jv-j6f`; encargo del orquestador `cobroflash-backend-5b`. Sólo lectura
de logs de CI: ni un test, guard, script ni workflow tocado.)

A9: sin fallo que generalice — entrega de sólo lectura; mis dos tropiezos (un log vacío y una extracción que dio 0) los delató el recuento al lado, y van contados en «Mis errores»

## En corto

1. **El job que pedía el ticket pasó.** Run nuevo, job `110207211633`, rama ya arreglada
   (`72e790ac`): verde, **9.402 pruebas en Kiritimati y 9.402 en Midway**, ninguna en repesca.
2. **Pero no es «un intermitente de un fichero».** En **114** jobs de zona medidos, **53 (46 %)**
   perdieron casos de algún fichero en alguna de las dos pasadas. Casi siempre el job sale verde
   igual, porque la repesca no lo confirma; sale **rojo** cuando la pérdida se repite también a solas.
   Los **7 rojos de hoy** de ese job son todos de esta forma, y **dos son de `main`**.
3. **No es la zona.** En los 7 rojos el cambio es siempre `pass ↔ ausente`, nunca `pass ↔ fail`, y va
   en las dos direcciones: 4 veces falta en Midway y 3 en Kiritimati.
4. **«19 en la tanda, 30 a solas» no son la misma magnitud.** 19 son los casos que faltaron en la
   pasada de Midway de la tanda. 30 son las claves que cambiaron entre las dos pasadas del fichero a
   solas, en cualquier dirección. El guion los imprime juntos («confirma 30 de 19»).
5. **Causa: NO demostrada.** No reproducido en local (0 de 120). La hipótesis y el experimento que la
   separaría están en §⑤; ninguno de los dos está hecho.

## ① El job del run nuevo

| | run viejo `36807859456` | run nuevo `36811462260` |
|---|---|---|
| job | `110196119194` | `110207211633` |
| cabeza | `ba86ead0` | `72e790ac` |
| resultado | rojo | **verde** |
| pruebas Kiritimati / Midway | 9.321 / 9.302 | 9.402 / 9.402 |
| ficheros en repesca (sin canarios ni la censada) | `vigia-atascados` «confirma 30 de 19» | ninguno |

9.321 − 9.302 = 19: los 19 «ausentes» son exactamente la diferencia de recuento entre las dos
pasadas. No hubo ninguna clave de más en Midway.

## ② La población: no es un fichero ni un día

Instrumento: `evidencias/SCRUM-1335/tabla.mjs` y `resumen.mjs`, sobre el log de cada job
«trinquete · ningún test nuevo mide la zona de la máquina».

Dos muestras: los **últimos 100 runs** de `ci.yml` al medir (30-sep 22:36Z → 1-oct 04:01Z) y **100
runs más antiguos** en cuatro páginas salteadas (22, 28 y 29-sep). Entre las dos, 137 jobs de zona:
21 cancelados, **116 no cancelados**, de los que **114** traen las dos pasadas medidas (los otros 2:
un log vacío y un job que cayó antes de medir).

| día | jobs medidos | con casos perdidos | rojos | Node |
|---|---|---|---|---|
| 22-sep | 18 | 9 | 1 | 24.20.0 y 24.21.0 |
| 28-sep | 16 | 4 | 0 | 24.21.0 |
| 29-sep | 11 | 5 | 0 | 24.21.0 |
| 30-sep | 11 | 5 | 0 | 24.21.0 |
| 1-oct | 58 | 30 | 7 | 24.21.0 |
| **total** | **114** | **53 (46 %)** | **8** | |

«Con casos perdidos» = algún fichero que no es canario ni censada entró en la repesca. El rojo del
22-sep (`a41c59f9`) lleva además un caso de `scrum980` confirmado 1 de 1, que puede ser otra cosa: no
lo cuento como de esta forma. Los 7 del 1-oct sí lo son (`direcciones.txt`).

**Ya pasaba el 22-sep y con Node 24.20.0**: no lo trajo la imagen del runner de esta semana ni un
commit de anoche.

Ficheros que salen, por número de jobs (de 53): `vigia-atascados` 21 · `scrum834` 13 · `scrum524b` 13 ·
`scrum237` 6 · `scrum853`, `scrum931`, `scrum649` y `scrum454` 4 cada uno · `scrum312` 3 · y ocho más
con 1 o 2. Son 17 ficheros distintos. La lista entera, con sus casos, en `resumen.txt`.

## ③ Dónde cae el hueco dentro del fichero

`orden.mjs` casa los nombres «ausentes» del log con el orden de los casos en el fuente.

| job | fichero | casos | ausentes | posición |
|---|---|---|---|---|
| `110196119194` | `vigia-atascados` | 64 | 19 | **36 a 54**: bloque seguido, en medio |
| `110185005492` | `vigia-atascados` | 64 | 22 | 43 a 64: la cola |
| `110186137556` | `vigia-atascados` | 64 | 6 | 59 a 64: la cola |
| `110186236745` | `scrum834` | 53 | 9 | 45 a 53: la cola |
| `110213649929` | `scrum834` | 53 | 11 | 43 a 53: la cola |
| `110195238163` | `scrum1262` | 6 por regex | 10 nombres | 5 de los 6 casados: casi el fichero entero |

Siempre un **bloque seguido**, nunca casos salteados. En 4 de 6 es la cola del fichero; en el del
ticket es un bloque intermedio, con los diez últimos casos presentes. `tests/vigia-atascados.test.mjs`
no lee reloj ni entorno y sus casos son síncronos: un caso que no se ejecuta en una zona y sí en la
otra no encaja con lo que hace el fichero. Lo que encaja es que el caso corrió y **su resultado no
llegó** a quien cuenta.

⚠️ Límite: la lista que imprime el job son sólo las claves **confirmadas** (las de la tanda que además
cambiaron a solas). En el job del ticket coinciden con las 19 de la tanda; en los demás puede haber
habido más ausentes en la tanda de los que salen aquí.

## ④ Por qué a veces es rojo, y qué dice «30 de 19»

Leído en `scripts/trinquete-de-zona.mjs` y `scripts/_trinquete-de-zona-hijo.mjs`:

- El hijo corre la tanda con `run({ files, forceExit: true, concurrency })` y guarda un veredicto por
  clave `fichero::nombre`. Una clave que está en una pasada y no en la otra vale `ausente`, y
  `cambianDeVeredicto` la trata como un cambio más.
- La repesca vuelve a medir cada fichero candidato **a solas** en las dos zonas y da por confirmada
  toda clave que **vuelva a cambiar**, sin mirar en qué dirección ni con qué veredicto.
- La línea que imprime es `confirma <cambios a solas> de <candidatos de la tanda>`: dos conjuntos
  distintos, sin cruzar. Por eso puede decir «30 de 19» o «37 de 22».

Así que el job sale rojo cuando el mismo fichero pierde casos **dos veces** —en la tanda y a solas— y
los huecos se solapan. Con `vigia-atascados` la pérdida se repitió a solas en 4 de los 21 jobs en que
salió.

**El trinquete entonces anuncia «hay pruebas que dependen de la zona» sobre algo que no lo es**, y
manda fijar la zona del test. No hay nada que fijar.

## ⑤ La causa: lo que NO sé

- **No reproducido en local.** `bucle.mjs`: el mismo hijo, el mismo fichero a solas, 60 pasadas por
  zona → 64 claves en las 120. Windows, Node 24.18.0. El CI es Linux con 24.20/24.21: este cero no
  descarta nada.
- 🔴 **Hipótesis mía, de IA, sin demostrar:** el resultado de cada caso viaja del proceso del
  fichero al de `run()` por una tubería, y con `forceExit: true` el proceso sale sin esperar a que
  se vacíe. Encaja con que casi siempre falte **la cola**. **No encaja** con el bloque intermedio del
  job del ticket. No he leído el código de Node que lo haría: es un recuerdo, no una medición.
- **El experimento que la separa** (no hecho; toca un workflow, así que pide GO y afecta a los dos
  equipos): rama desechable que corra `bucle.mjs` en el runner, unas 200 pasadas del fichero a solas,
  con `forceExit` puesto y quitado. Es la forma del experimento de SCRUM-1281.
- **Sin medir, y es lo que más importa:** si la tanda **obligatoria** (`build + tests`, que también
  fuerza la salida) pierde casos igual. Ahí un `pass` perdido sólo baja el recuento, y nadie compara
  el recuento entre runs.

## ⑥ Lo que propongo, sin construir

El guion y los workflows no son de este puesto; va al dueño por el orquestador.

1. **Que `ausente` deje de valer como veredicto de zona.** Un caso que pasa en una zona y no aparece
   en la otra, sin ningún `fail`, es una **medida incompleta**, no un hallazgo. Hoy se confirma con
   que vuelva a cambiar; debería exigir, al menos, el mismo veredicto en la misma zona.
2. **Que el job diga cuándo perdió casos**, aunque salga verde: hoy 45 de 53 jobs con pérdida
   salieron verdes y nadie lo vio.
3. **No** sacar ningún fichero de la tanda ni censar estos casos como dependientes de la zona
   (regla 41): no lo son.

## Mis errores

- La primera descarga de logs salió **vacía con salida 1** (`gh` se niega a escribir secuencias de
  escape sin `--allow-escape-sequences`). Lo dijo el recuento de bytes impreso al lado.
- Una extracción de nombres dio **«ausentes: 0»** en cinco jobs que tenían entre 6 y 22: el patrón
  miraba la línea equivocada. Lo delató que el cero contradecía al log.
- El `resumen.mjs` cuenta «8 rojos» de esta forma; uno (22-sep) no lo puedo afirmar y lo aparto en §②.

## Reproducir

    # ids y logs: gh api repos/<repo>/actions/workflows/ci.yml/runs → /runs/<id>/jobs → /jobs/<id>/logs
    node docs/master/evidencias/SCRUM-1335/tabla.mjs   <jobs.tsv> <carpeta de logs>
    node docs/master/evidencias/SCRUM-1335/resumen.mjs <jobs.tsv> <logs> <jobs2.tsv> <logs2>
    node docs/master/evidencias/SCRUM-1335/orden.mjs   tests/vigia-atascados.test.mjs <lista de ausentes>
    node docs/master/evidencias/SCRUM-1335/bucle.mjs   <raíz> tests/vigia-atascados.test.mjs 60 <carpeta temporal>

Los ids de los 137 jobs están en `jobs-ultimos-100-runs.tsv` y `jobs-muestra-antigua.tsv`. Los logs
(unos 6 MB) no se suben: GitHub los conserva y se bajan por id.

---

# SCRUM-1335b · «Ausente» deja de valer como veredicto de zona

**Medido contra:** `origin/main` = `5e3211dc4ca3decda4f50b976c5272ed53d82c99` · 2026-10-06T13:38:00Z

A9: sin fallo que generalice — los dos tropiezos del diseño (una caída sin nombre que confirmaba a cualquier prueba del fichero, y una censada perdida que salía como «nueva») se cazaron antes de empujar y quedaron como casos con su mutación en `tests/scrum813-trinquete-de-zona.test.mjs`

Sesión 3 del equipo de Luis (tests · bancos · instrumentación). El ticket es del equipo de Javier
(`area-j6`); lo trabaja S3 por la asignación escrita del orquestador de Luis en el comentario 18387
de Jira, que es también donde está la decisión y sus tres condiciones. Cogido en el 18415.

**No se toca ningún workflow, ni `forceExit`, ni ningún test del árbol.** La causa de que los
resultados no lleguen sigue sin demostrar y sigue siendo de SCRUM-1405.

## Qué cambia

| fichero | cambio |
|---|---|
| `scripts/_trinquete-de-zona.mjs` | `compararZonas` separa `cambian` (dos veredictos reales y distintos) de `sinComparar` (en alguna zona no hay resultado). `repescar` y `resolverRepesca` (la repesca, que vivía en el guion). `veredicto` y `juzgarCanarios` reciben lo que no se pudo comparar |
| `scripts/trinquete-de-zona.mjs` | usa lo anterior e imprime siempre la línea `NO PUDE COMPARAR · en la tanda N · comparadas a solas… N · SIGUEN SIN COMPARAR N`, con el fichero y la zona de cada una |
| `tests/scrum813-trinquete-de-zona.test.mjs` | de 28 a 43 casos (15 nuevos) y de 11 a 22 mutaciones; un caso reescrito y una mutación reapuntada, las dos cosas dichas abajo |

## Qué cuenta ahora como «cambia de veredicto», y qué no

- **Sí:** dos resultados reales distintos (pasa/cae, pasa/salta). Igual que antes.
- **Sí:** un `fail` frente a un resultado que falta, **cuando en la zona donde falta ese fichero no
  tiene ninguna caída**. El fichero cae en una zona y en la otra no. Cubre el fichero que muere al
  cargar en una zona sola y la prueba que cae sólo en una zona y cuyo resultado se pierde justo ahí.
- **No:** un `pass` (o un `skip`) frente a un resultado que falta. Es la forma de las 289. Pasa a
  «no pude comparar», contado.
- **No:** un `fail` frente a un resultado que falta cuando el fichero cae también en la otra zona. No
  se sabe si es la misma prueba.

Lo segundo se apoya en una medida, no en una suposición: **el código de salida del fichero no viaja
por la tubería que pierde resultados.** Con un fichero sembrado que deja de escribir su salida a
mitad, `run()` sigue entregando un `fail` con la ruta del fichero por nombre.

## Las tres condiciones

**① Una diferencia real pasa/cae sigue en rojo.** Banco sembrado por el guion real
(`docs/master/evidencias/SCRUM-1335b/banco-sembrado.mjs`, salida en `salida-banco.txt`): lanza
`scripts/trinquete-de-zona.mjs` entero sobre un árbol en miniatura fuera del repo, con el
instrumento de antes (`8dcc6d2a…`) y con el de ahora. 14 de 14 corridas dan la salida esperada.

| escenario sembrado | antes | ahora |
|---|---|---|
| A · sin sembrar | salida 0 | salida 0 · sin comparar 0 |
| B · todo pasa, en una zona faltan resultados | **salida 1 · acusa 5** | **salida 0 · acusa 0 · sin comparar 5** |
| C · una prueba cae sólo en Midway, vista en las dos | salida 1 · acusa 1 | salida 1 · acusa 1 |
| D · cae sólo en Midway y su resultado se pierde allí | salida 1 · acusa 2 | salida 1 · acusa 1 (por el fichero) · sin comparar 1 |
| E · el fichero muere al cargar en una zona | salida 1 · acusa 2 | salida 1 · acusa 1 (por el fichero) · sin comparar 1 |
| F · cae en las dos zonas y en una se pierde | salida 1 · acusa 2 | salida 0 · acusa 0 · sin comparar 2 |
| G · retirado el sembrado real, queda la pérdida | salida 1 · acusa 2 | salida 0 · acusa 0 · sin comparar 2 |

El sembrado no vive en `tests/`: se fabrica en un temporal y se borra. Tres de esas formas corren
además en cada tanda, por el camino real, dentro de `tests/scrum813-…` («SEMBRADO»).

**② «Ausente» se dice.** La línea de cifras sale siempre, también con ceros. En verde, el cierre
añade cuántas no se pudieron comparar y que de ésas el verde no dice nada.

**③ Cifras antes y después.**

| | antes | después |
|---|---|---|
| medido en CI, 177 corridas del 1 al 6-oct | 34 rojos · 289 acusaciones · las 289 pasa/ausente | **sin medir todavía**: hace falta que el job corra con este código |
| banco sembrado, escenario B | acusa 5 | acusa 0 · sin comparar 5 |

Lo que **no** se puede afirmar con los logs viejos: que las 289 quedarían todas en «siguen sin
comparar». El log viejo imprime el veredicto de la tanda (pasa/ausente) pero no el de la repesca a
solas, así que no dice si a solas faltó el resultado otra vez o hubo otra cosa. Lo esperable es 0
acusaciones y hasta 289 avisos; la cifra real sale de leer el job en los PR siguientes.

## Lo que se vuelve más estricto, y conviene saberlo

- **Una censada que no se pudo comparar es CIEGO**, no «sigue viva». Antes, que le faltara el
  resultado en una zona contaba como que seguía cambiando.
- **Un canario que no se pudo comparar es CIEGO.** Antes, a un canario dependiente le bastaba faltar
  en una zona para darse por denunciado.
- **Una diferencia vista en la tanda con los dos resultados** ya no la borra una repesca a la que le
  falte un resultado o que no llegue a medir: queda en pie y lo dice.

En las 177 corridas medidas ni la censada ni los canarios perdieron nunca un resultado (los
ficheros acusados fueron ocho, y ninguno es de ésos), así que estos tres no añaden rojos conocidos.

## Dos cosas tocadas en el test que ya existía

- El caso «una prueba que EXISTE en una zona y no en la otra también cambia de veredicto» probaba
  `pass` contra nada. Era exactamente la afirmación retirada. Se reescribe con la forma real de lo
  que quería proteger (el fichero que muere al cargar), y sigue en rojo si eso deja de verse.
- La mutación ④ se reapunta: su línea ganó `&& !sinVeredicto.has(c.clave)`. Hace lo mismo.

Las 22 mutaciones tumban su caso en local, con base verde antes y después y el árbol restaurado
(`mutar-813.mjs` y `salida-mutar-813.txt`, réplica acotada a este fichero; la oficial es el job
`meta-guard` del PR).

## Límites

- La pérdida se **imita** (el fichero sembrado deja de escribir). La real sólo se ha visto en el
  runner de Linux. Medido en Windows con Node 24.8.0; el CI corre 24.20 y 24.21.
- Un fichero cuya salida se pierde entera deja una entrada de más en la cuenta: `run()` informa del
  fichero mismo como una prueba que pasa.
- El trinquete nunca ha juzgado una prueba que cae en las dos zonas, y sigue sin hacerlo (escenario
  F): eso es del check obligatorio.

## Reproducir

    node docs/master/evidencias/SCRUM-1335b/banco-sembrado.mjs
    node docs/master/evidencias/SCRUM-1335b/mutar-813.mjs .
    node --test tests/scrum813-trinquete-de-zona.test.mjs

# SCRUM-1335c · La serie del «después» y el ciego de la pérdida en las DOS zonas

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T19:37:12Z

A9: sin fallo que generalice — entrega de sólo medida; el ancla que olvidé al empujar la cazó `scrum267` en el CI de su PR, que es justo el guard que existe para eso

S3 · 2-nov-2026 · hora de GitHub 19:37:12Z al arrancar · medido sobre `origin/main`
`70eefc40cba2eb9636992b733223bf1555c1755f`. **Sólo medida: no cambia ningún guion, test, guard
ni workflow.** Jira c.21309 (lo coge).

## ① La serie, desde 1335b hasta hoy

1.880 corridas de `CI` creadas desde el 6-oct 17:30Z (la más antigua vista, 17:33:44Z: la ventana
está entera), 1.403 jobs del trinquete de zona. Tramo por la hora de creación de la corrida (CI
prueba el merge con `main` de ese momento: es una aproximación, y se dice).

| | A · tras 1335b | B · tras 1494c (574e53806, 16-oct 11:18Z) | C · tras la tubería bloqueante (#2964, 29-oct 10:12Z) |
|---|---|---|---|
| jobs | 531 | 793 | 79 |
| cancelados por sustitución / por techo / ilegibles | 67 / 20 / 0 | 89 / 1 / 1 | 8 / 0 / 0 |
| **leídos** | 464 | 703 | 71 |
| rojos | 16 (todos «EL TRINQUETE HABLA») | 31 + 1 sin veredicto (cayó a los 52 s) | **0** |
| **jobs con resultados perdidos en la tanda (P>0)** | 266 (57 %) | 472 (67 %) | **0** |
| suma de P · suma de «siguen sin comparar» | 6.938 · 1.311 | 15.836 · 3.933 | 0 · 0 |
| totales distintos entre las dos pasadas | 265 | 468 | 0 |
| pasada mediana | 506 s | 591 s | 693 s |

**Control positivo del lector, ANTES de las cifras, los dos exactos:** job `112403767133`
(10.656 · 10.606 · 367 s · en la tanda 52 · comparadas 52 · siguen 0 · cambian 1) y el de la
corrida `37511945736` (siguen sin comparar 6). Y una fila del tramo C cotejada a mano contra su
log (job `125508870065`, #3003, 2-nov 20:21Z): 12.947 y 12.947 pruebas, «en la tanda 0», verde.

**Las filas que buscan la causa donde NO está:**
- Con la tubería bloqueante y resultados perdidos: **0 de 71.** Con la tasa de B (67 %), 0 de 71 por
  azar sale con probabilidad 0,33^71 ≈ 10^-34. **No es el «0 en 119» de SCRUM-1527: aquí la tasa
  de antes es alta y la muestra basta.**
- Sin ella y sin pérdida: 198 de 464 en A y 231 de 703 en B. La pérdida era intermitente; esa fila
  no contradice: la causa candidata no producía la pérdida SIEMPRE, la permitía.
- 5 de los 79 jobs de C son de ramas SIN `f962943af`; CI corre el merge con `main`, que ya lo
  llevaba, así que **no son un contraejemplo: son la misma población.** Se dice para que nadie los
  lea como «sin el arreglo».

**Lectura (MÍA, S3):** la pérdida de resultados que daba el «recuento inestable» de este ticket
cesó con `--import=tuberia-bloqueante.mjs` en el hijo de zona (SCRUM-1621 pieza 1, salida C de
SCRUM-1405). Es la causa con más evidencia que ha tenido el ticket; **no está demostrada por
experimento** (nadie ha quitado la tubería en una rama para ver volver la pérdida).

## ② El control que faltaba: «faltan 19» frente a «faltan 19 y otros 11 que no vio»

**El instrumento NO lo distingue, y el tramo C hereda ese límite.** Sonda sobre el guion real de
`main` (`evidencias/SCRUM-1335c/sonda.mjs`, ficheros sembrados FUERA del árbol, Windows, Node
24.8.0; salida literal en `salida.txt`):

| fichero sembrado | pruebas en el fuente | vistas Kiritimati / Midway | en alguna lista del instrumento |
|---|---|---|---|
| normal | 3 | 3 / 3 | 0 (correcto) |
| enmudece en Midway | 3 | 3 / 0 | 4 — **lo ve** (control positivo) |
| enmudece en las DOS | 3 | 0 / 0 | **0** |
| enmudece a mitad, en las DOS | 5 | 0 / 0 | **0** |

Y es peor que «no lo ve»: cuando un fichero no entrega su informe, `run()` pone en su lugar UNA
entrada con la ruta del fichero por nombre y veredicto `pass`. En las dos zonas sale `pass` y
`pass`: **el instrumento lo cuenta como comparada e igual.** «En la tanda 0 · siguen 0» se imprime
igual sobre un fichero cuyas pruebas no ha visto.

**La señal para cerrarlo existe** (`eventos.txt`): `run()` emite un `test:summary` con `file`
por cada fichero cuyo informe llega entero, y ninguno para los enmudecidos. Un fichero sin su
`test:summary` en una zona es un informe incompleto, se vea o no la diferencia entre zonas.

⚠️ **Límite declarado del tramo C:** sus «0 perdidos» son 0 pérdidas en UNA zona. Una pérdida en
las dos a la vez no habría salido en ninguna cifra. Que sea rara si la de una zona es 0 es
razonable, no está medido.

## Lo que queda, sin construir

- Contar los ficheros sin `test:summary` por zona y sacarlos de «comparada e igual» (carril S3 por
  c.18387). Es una línea más de informe y **no cambia cuándo sale rojo**; que un informe incompleto
  ponga el job en CIEGO sí lo cambia, y eso lo decide el fundador (como en c.18387).
- El experimento que demostraría la causa: rama desechable con el hijo SIN la tubería. Toca CI:
  pide GO.

## Reproducir

    node docs/master/evidencias/SCRUM-1335c/sonda.mjs scripts/_trinquete-de-zona.mjs <dir temporal FUERA del árbol>
    node docs/master/evidencias/SCRUM-1335c/eventos.mjs <ficheros sembrados>
    # la serie: parse-log.mjs + aggregate.mjs sobre los logs de los jobs (los logs no van al repo)
