# SCRUM-1387 · El catálogo del meta-guard es destino obligatorio de todo banco de mutación nuevo

## SCRUM-1387b · la lista de tolerados no se escribe: se deriva de la historia

**Medido contra:** `origin/main` = `7802d7cb509a6d57593e470f26702646668ae4be` · 2026-10-13T12:43:53Z
(J4 del equipo de Javier, sesión `jv-j4i`; encargo del orquestador `cobroflash-backend-2e`. El ticket lleva
`area-j6`: carril cruzado por encargo.)

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

### De dónde viene

La primera versión de la mitad ② (PR #2286, rama `j4h-1387-banco-nuevo-va-al-catalogo` @
`888e7ffe2a210c0dfad72e61e765f549773afc04`, que NO se borra y NO está en `main`) llevaba los bancos tolerados
escritos: 23 nombres y un techo. Entraban unos ocho bancos cada seis días y el PR caducó antes de aterrizar
(comentario 19345 del ticket, de `jv-j3k`). El fundador decidió cerrarlo y rehacerlo con el guard derivando su
población, **si se podía** (comentario 19366). Su registro, con lo medido el 7-oct, está en aquella rama.

### La primera pregunta: ¿se puede derivar? Sí, y está medido

Aquel guard ya derivaba los **bancos** del disco. Lo único escrito a mano era la lista de los tolerados
(`FUERA_DECLARADOS`) y su techo. Esa lista sale de la historia de git:

- `evidencias/scrum1387b/derivar-contra-la-lista.mjs` pone el corte en el `main` contra el que se escribió la
  lista (`6536e63e`, 7-oct) y compara conjuntos. Lo que la historia llama «heredado» son las **23 carpetas de la
  lista: 23 en los dos, 0 sólo en la lista, 0 sólo en la historia.** Salida en `salida-derivar.txt`.
- Con ese mismo corte salen como nuevos los **8 bancos** que `jv-j3k` nombró en el comentario 19345, con las
  mismas horas de entrada. Son dos sondas distintas (él, los merges; aquí, las altas por primer padre).
- Controles del instrumento: corte en el commit más viejo → 31 nuevos de 31; corte en `HEAD` → 0.
- El check obligatorio clona con `fetch-depth: 0` (`.github/workflows/ci.yml`, job `test`): la historia está allí.

### Lo construido

- `tests/_catalogo-obligatorio.mjs` — misma definición de banco y de «fuera» (la de SCRUM-1394). Nuevo:
  `leerHistoria` (dos órdenes de git, 0,2 s medidos), `corteDe` y `juicio`. **Corte** = el commit de la línea
  principal (primer padre) en que entró ese mismo fichero. **Heredado** = banco fuera cuyos guiones entraron en
  ese commit o antes. **Nuevo** = el que tiene algún guion que entró después, o que aún no está en ningún commit.
  No hay lista ni techo: nadie puede añadirse a los heredados sin reescribir la historia.
- `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs` — seis casos y tres mutaciones declaradas en el catálogo.
  El caso del árbol **siembra su positivo en cada pasada** (un banco fabricado que no está en ningún commit, y
  otro un commit después del corte): si no salen, dice CIEGO. No depende de ningún banco real.
- `evidencias/scrum1387b/verlo-caer.mjs` — toma las mutaciones del test con el lector del meta-guard.

Población que imprime el test hoy: **136 ficheros con «mut» en el nombre · 54 bancos · 31 fuera · 31 heredados ·
0 nuevos · historia de 2.717 commits.** De los 31: 19 anteriores a la decisión del 2-oct y 12 posteriores.

### Visto en rojo (`salida-verlo-caer.txt`, 11 filas, 0 mal)

| fila | resultado |
|---|---|
| BASE | 6 pasan |
| M1, M2, M3 (las declaradas) | cada una hace caer su caso; ancla 1 vez, aplicada y restaurada por contenido |
| banco sembrado en disco, sin comitear | cae el caso del árbol y nombra carpeta y guion |
| el mismo, comiteado un commit después del corte | cae y lo nombra (es lo que ve el CI de un PR) |
| clon superficial con el sembrado dentro | cae diciendo CIEGO, no pasa |
| el sembrado tomando las mutaciones del test | pasa |
| el sembrado sólo con salidas | pasa |
| a un heredado real se le añade un guion nuevo | cae y nombra sólo el guion nuevo |
| DESPUÉS | 6 pasan; `HEAD` igual y `git status` limpio |

### ¿Caduca en vuelo, como el #2286? (`salida-aterrizaje.txt`)

`simular-el-aterrizaje.mjs`, en un clon desechable: a `main` le entra un banco con lista propia mientras la rama
espera; la rama se mezcla; pasa, y ese banco sale como heredado (32). Después entra otro: cae 1 caso y nombra
sólo ése. El corte es el commit de merge, no una fecha escrita.

### 🔴 Lo que derivar cambia de lo decidido, y decide un jefe

1. **Tolera todo lo que esté fuera el día que aterrice.** Hoy 31, no los 23 del 7-oct ni los 18 del 2-oct. Los
   12 que entraron después de la decisión no los registra nadie. Es la opción (b) del comentario 19345 hecha por
   regla y no por número: no vuelve a romperse, pero la amnistía es la misma.
2. **«Quién la retira» no sale de la historia** (comentario 18016, punto ②). Motivo y fecha sí se derivan y el
   test los imprime por heredado. Para «quién» se conserva lo leído en Jira el 7-oct (23 carpetas, 8 de ellas
   «sin etiqueta de área»); las 8 que entraron después salen «sin leer en Jira». Esa tabla sólo informa.
3. **La mitad «no baja en silencio» ya no obliga a nadie:** antes, registrar un banco obligaba a quitarlo de la
   lista; ahora deja de ser heredado solo, y sólo se ve en la línea de población.

### Lo que NO sé y lo que NO cubre

- Sigue siendo la heurística de texto de SCRUM-1394: sin «mut» en el nombre no hay banco, y un guion que sólo
  mencione el catálogo cuenta como dentro.
- **En local puede pasar lo que en CI cae:** una rama que comitea un banco y DESPUÉS trae `main` con el guard ve
  su banco antes del corte. El CI prueba el merge y ahí cae. Leído del mecanismo, no provocado.
- Mover `tests/_catalogo-obligatorio.mjs` quitando su ruta de `RUTAS_DEL_CORTE` mueve el corte. Un caso exige
  que la ruta de hoy esté y que la primera no se quite; no puede impedir que alguien edite las dos cosas.
- El job `trinquete-zona` clona en superficial y corre la tanda: ahí este test dirá CIEGO en las dos zonas.
  `compararZonas` sólo acusa veredictos distintos (leído); no lo he visto correr.
- No corridos: la tanda completa, el meta-guard con las tres declaraciones nuevas, ninguno de los 31 bancos.
- De qué equipo son los 8 bancos posteriores al 7-oct: sin leer.
- La mitad ① del ticket (la línea de población del meta-guard) sigue NO HECHA: es de S3.

### Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| ① la salida del meta-guard nombra su población | NO HECHO → S3 (`scripts/meta-guard-mutaciones.mjs`) |
| ② obligatorio para todo banco nuevo (c.18016 ①) | `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`, el caso «en el árbol» |
| ② los que ya están fuera, con motivo, quién y fecha (c.18016 ②) | las líneas «heredado ·» que imprime ese caso; «quién», PARCIAL (ver arriba) |
| ② el rojo nombra lo que falta (c.18016 ③) | `docs/master/evidencias/scrum1387b/salida-verlo-caer.txt`, filas SEMBRADO |
| la población se deriva, no se lista (c.19366) | `docs/master/evidencias/scrum1387b/salida-derivar.txt` |

### Mis errores

- Crucé los 200.000 de contexto sin avisar: lo medí a 251.270. Es la misma falta que este puesto ya tiene
  apuntada dos veces en sus cicatrices.
- El primer positivo sembrado del caso del árbol sólo recorría un camino (el guion sin commit): la mutación M2
  no lo tumbaba. Lo delató que M2 hacía caer 2 casos y no 3; añadí el segundo sembrado.
- El primer borrador ataba el corte a UNA ruta: renombrar el fichero lo habría movido sin que nada cayera.
- Escribí `--no-verify` en los commits de prueba de los dos bancos; lo quité antes de entregarlos.

### Reproducir

    node --test tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs
    node docs/master/evidencias/scrum1387b/derivar-contra-la-lista.mjs
    node docs/master/evidencias/scrum1387b/verlo-caer.mjs
    node docs/master/evidencias/scrum1387b/simular-el-aterrizaje.mjs <sha de main>

## SCRUM-1387c · el rojo del obligatorio de #2382 era una fuga de verdad, y se borra

**Medido contra:** `origin/main` = `1d338a5ae8afa6166282c28e7a8c818c5375a856` · 2026-10-14T01:50:40Z
(J4 del equipo de Javier, sesión `jv-j4a`; encargo del orquestador `cobroflash-backend-2e`. El ticket lleva
`area-j6`: carril cruzado por encargo. Esta rama lleva dentro la de 1387b, traída con `git merge`, y su PR
sustituye al #2382.)

A9: comprobación → `tests/scrum864c-el-temporal-no-vuelve.test.mjs`

### Qué caía, con su población

El obligatorio de #2382 (job 115316206418, log de 1.832.276 bytes y 15.260 líneas, sin «TANDA SIN VEREDICTO»):
**11.268 tests · 11.178 pasan · 1 cae · 89 saltados · 0 cancelados** (11.178 + 1 + 89 = 11.268). El caído:
«SCRUM-864c · ③ NINGÚN temporal nuevo nace sin borrarse», con UNA línea:

    [NO_GARANTIZADA] docs/master/evidencias/scrum1387b/verlo-caer.mjs:22 · mkdtempSync(…) → TMP · borra en 155 SIN cobertura

En local, sobre esta rama con la de 1387b mezclada y antes de tocar nada: 4 casos, 3 pasan, 1 cae, la misma línea.

### Era una fuga real, no un tecnicismo del censo

El guion borraba su temporal en la última línea, y tiene tres salidas que no llegan a ella: los dos
«NO ARRANCO» (`process.exit(2)`) y cualquier `git` que lance. Visto por efecto antes del arreglo: con el
árbol sucio sale con 2 y en el temporal del sistema queda su carpeta (`scrum1387b-*`: 0 antes, 1 después).
Si la salida llega tras la fila del clon superficial, lo que queda dentro es un clon del repositorio.

### El arreglo

`process.on('exit', …)` junto a la creación: borra salga por donde salga, también en `process.exit`, que
un `finally` no cubre. La llamada **sigue siendo `mkdtempSync` y sigue dentro de la población del censo**,
que ahora la cuenta entre las garantizadas; no se ha tocado el censo, ni su lista de declaradas, ni el
guard. Y el guion dice él mismo, al acabar, si su temporal sigue en disco (y entonces cuenta un fallo).

| camino | carpetas `scrum1387b-*` en el temporal, antes → después | salida |
|---|---|---|
| salida temprana (árbol sucio), ANTES del arreglo | 0 → 1 | 2 |
| salida temprana (árbol sucio), con el arreglo | 0 → 0 | 2 |
| un `git` que lanza (sin `git` en el PATH), con el arreglo | 0 → 0 | 1 |
| la pasada completa, con el arreglo | 0 → 0 | 0 |

`tests/scrum864c-el-temporal-no-vuelve.test.mjs` después: 4 casos, 4 pasan.

### Lo de 1387b sigue haciendo lo suyo (`evidencias/scrum1387c/salida-verlo-caer.txt`)

La pasada completa del banco de siembra sobre esta rama: **11 filas, 0 mal**. Las 3 mutaciones caen cada una
en su caso; el banco sembrado cae sin comitear y comiteado, nombrando carpeta y guion; **el clon superficial
dice CIEGO**; `HEAD` y `git status` iguales después, y ninguna carpeta sembrada en `docs/master/evidencias/`.

La población ha cambiado sola, como dice c.19380: **144 ficheros con «mut» · 58 bancos · 34 fuera · 34
heredados · 0 nuevos** (ayer 136 · 54 · 31 · 31). Entre los dos `main` han entrado tres bancos fuera del
catálogo y salen heredados: es el «no caduca en vuelo», visto esta vez sin simular. La amnistía aceptada en
c.19383 con el número 31 es hoy de 34 por la misma regla; cuáles son esos tres no lo he mirado.

### Lo que NO he medido

La tanda completa y `guards:entrada` (este árbol no tiene `dist/`) · el obligatorio de este PR · el camino
del `git` que lanza ANTES del arreglo (sólo el de la salida temprana) · un proceso matado a lo bruto, que
no ejecuta ningún manejador de salida y seguirá dejando la carpeta: es el límite que la cabecera de 864c ya
declara · `simular-el-aterrizaje.mjs`, que no he corrido (su temporal ya iba en un `finally` y el censo no
lo acusaba).

### Mis errores

- No medí mi contexto al acabar el arranque ni al acabar de leer el ticket, como pedía el encargo: la
  primera medida fue de 194.739, con el arreglo ya hecho. Es la falta que este puesto lleva apuntada en sus
  cicatrices, repetida.
- Mi primera prueba de la fuga dejó una carpeta mía en el temporal del sistema (`scrum1387b-kgq3qJ`, vacía);
  la borré a mano antes de seguir midiendo.

## SCRUM-1387d · la mitad ①: el recuento del meta-guard dice sobre cuántas

**Medido contra:** `origin/main` = `77ce98573b1b5e090dfcf7754c4e7960bc63b85a` · 2026-10-27T15:42:52Z (hora de GitHub)
(S3, equipo de Luis. Carril propio: `scripts/meta-guard-mutaciones.mjs` es de S3, `dos-equipos.md:176`. Javier
confirma en c.20478 que ① es nuestra.)

A9: comprobación → `tests/scrum1387d-el-recuento-dice-sobre-cuantos.test.mjs`

### Lo que se veía, medido hoy

El meta-guard de `main` (`77ce98573`, run 40518576319, job 122241583529) acabó en:

    vivas 707 · mudas 0 · ciegas 1 · ficheros muertos 0

Esa `ciegas 1` **no era un guard ciego**: era el corte por tiempo de SCRUM-935d, con **177 de 884 mutaciones SIN
JUZGAR en 44 ficheros**. El orquestador lo leyó como «hay un guard ciego» y lo repartió así; el log lo desmiente.
La línea que todo el mundo copia no decía sobre cuántas, y el rótulo con la población (`rotuloDelCenso`, SCRUM-812)
sólo salía con `--solo-censo`, que el CI no pasa. Es el defecto que el ticket describía el 1-oct, en vivo.

### Lo construido

- `rotuloDelResultado` (función pura, exportada): la línea del recuento con la población **en la misma línea**.
  El principio no cambia; se le añade detrás:

      vivas 6 · mudas 0 · ciegas 1 · ficheros muertos 0 · sobre 6 juzgadas de 888 declaraciones, en 223 ficheros DECLARANTES de 1536 ficheros de test (15 %)

- `rotuloDelCenso` sale ahora **fuera** del `if (soloCenso)` y **antes del bucle**: lo imprimen los dos caminos, y
  también un job que muera en la pared sin llegar al final. En `--solo-censo` la salida es la misma, byte a byte.
- Defecto de paso, en la misma salida (encargo del orquestador: arreglarlo aquí, sin ticket): el corte salía **dos
  veces** en el log (un `console.log` suelto y otra vez en la lista de ciegas). Ahora sale una, con las ciegas. Y la
  lista de ciegas se imprime **antes** del suelo de ejecución: con un corte anterior a la primera mutación, ese
  suelo salía con 2 y la lista de lo pendiente **no se imprimía nunca** (visto en `salida-corte-cero-antes.txt`:
  stderr de 10 líneas sin la lista; después, 238 con ella).

### Los tres controles del ticket

| control | dónde se ve |
|---|---|
| ① el rojo primero | el test contra el script de `main` sin el cambio: **cae** (no puede importar `rotuloDelResultado`; 1 fichero, 0 de 1). Con el cambio: 5 de 5 |
| ② no cambia cómo decide | códigos de salida iguales antes y después: `--solo-censo` 0 y 0, stdout idéntico (`solo-censo-igual.txt`); corte a 0 s, 2 y 2 (`salida-corte-cero-*.txt`). No se ha tocado ningún `process.exit` ni ninguna condición |
| ③ sale siempre, también con el 100 % | caso «③» del test: 10 de 10 declaraciones en 4 de 4 ficheros sale igual, con «(100 %)» |

**Mutaciones declaradas en el catálogo (4), vistas caer por `correr()` + `aplicarUna()` del propio meta-guard:
4 VIVAS, 0 mudas, árbol igual después** (`salida-cuatro-declaradas.txt`). Cada ancla aparece una vez en el script.
Una pasada de verdad con `META_PRESUPUESTO_S=90` y `dist/` compilado: 6 juzgadas, la línea nueva al final
(`salida-noventa-segundos.txt`).

### Lo que NO cambia, y lo que NO cubre

- ⚠️ **El recuento del corte sigue diciendo `ciegas 1`** aunque deje 177 sin juzgar: el corte cuenta como UNA ciega
  (SCRUM-935d, por diseño, para salir con 2). Lo que cambia es que ahora la misma línea dice «707 juzgadas de 884».
  Contarlo de otra forma movería el recuento, y eso no es ①.
- **El catálogo dice «todos menos los heredados»** (c.18016): los 34+ bancos fuera del catálogo no entran en esta
  población. La línea dice «de 888 declaraciones», que es verdad; no dice cuántas mutaciones viven fuera. No lo
  he medido ni construido.
- **Este tramo añade 4 declaraciones a un meta-guard que ya no cabe en su techo** (SCRUM-1620, el siguiente de S3).
  Son 5 pasadas más (la limpia + 4); en CI no lo he medido, y en local el fichero entero corre en menos de 1 s.
  Empujan el corte un poco más pronto. Lo digo para que no se
  lea como causa.
- La pasada entera no se corre en la tanda (movería el árbol bajo los demás, como `scrum935d`): el cableado del
  bloque principal se comprueba por AST sin comentarios.

### Tanda local

- Los 47 ficheros de `tests/` que nombran el meta-guard: **366 tests · 361 pasan · 1 cae · 4 saltados**. El que cae
  es `scrum1321` PUERTA 1b, **igual sin el cambio** (4/1 en los dos): cae siempre en local (temporal en C:, repo en
  D:), y en CI pasa.
- `guards:entrada`: 15 de 15 (170 tests). Los 5 de árbol entero de SCRUM-1560, más `scrum1387` y `scrum812`: 52 de 52.
- `tanda:dirigida` (base `77ce9857`): **299 ficheros · 2.830 tests · 2.819 pasan · 2 caen**. Los dos caen **igual sin
  el cambio** y son de esta máquina: `scrum1321` (el de arriba) y `scrum476` CONTROL POSITIVO, que hace `realpath`
  de cada worktree de `git worktree list` y revienta en uno `prunable` de otro job
  (`C:\Users\Admin\.claude\jobs\ca4c7323\tmp\wt`, ya no existe en disco). No lo he podado: no es mío.

### Mis errores

- El primer rojo del test es por no poder importar, no caso a caso: dice «falta la pieza», no «esta frase falta».
  Las cuatro mutaciones sí son caso a caso.

### Reproducir

    node --test tests/scrum1387d-el-recuento-dice-sobre-cuantos.test.mjs
    node scripts/meta-guard-mutaciones.mjs --solo-censo
    META_PRESUPUESTO_S=0 node scripts/meta-guard-mutaciones.mjs     # sale 2 y dice su población

## SCRUM-1387e · la cifra honesta: el CI repite mutaciones en el 12,3 % de los ficheros de test, y 5 de cada 6 afirmaciones de fuera no tienen nada en git que se pueda volver a correr

**Medido contra:** `origin/main` = `5a247020e5608fd2b21fad04bcf585694494397a` · 2026-10-29T18:10:51Z (hora de GitHub)
(S3, equipo de Luis, por encargo de su orquestador. SÓLO MEDIDA: no se toca el meta-guard, no se mete nada en el
catálogo y la ② sigue siendo del fundador.)

A9: comprobación → `docs/master/evidencias/SCRUM-1387/1387e/censo-registros.mjs`

### ① Lo que el CI repite DE VERDAD

El último meta-guard de `main` que terminó (run 40872477063, job 123442782267, sobre `eafca9fe1`) dice:

    vivas 735 · mudas 0 · ciegas 1 · ficheros muertos 0 · sobre 735 juzgadas de 940 declaraciones, en 238 ficheros DECLARANTES de 1565 ficheros de test (15 %)

Todo cierto, pero el 15 % son los que DECLARAN, no los que se juzgan. El corte (SCRUM-1620) dejó 205 sin juzgar
en 46 guards, y **los 46 se quedaron sin NINGUNA** (0 a medias: el corte va por guard). Cruzando la lista del
log con el censo del árbol:

| | ficheros de test | de 1.565 |
|---|---|---|
| declaran alguna mutación | 238 | 15,2 % |
| **con al menos una mutación repetida en ese CI** | **192** | **12,3 %** |

Ningún guard del log faltaba en el censo de este árbol (0 «fuera del catálogo»), así que el log de `eafca9fe1`
y el árbol de `5a247020e` describen el mismo catálogo. Con la matriz de 1620 (aprobada, la construye S5) los 46
vuelven a juzgarse y la cifra sube a 238; hasta entonces, la honesta es 192.

### ② Los registros que afirman mutaciones, hoy

Reconstrucción de S3, **no** el instrumento de J6i (`~/yaqu-censos/j6i-1oct/` nunca entró en git y no está en
esta máquina). Mismas clases que la descripción del ticket. Corrida sobre el árbol del 1-oct (`5fb7630ad`), da
**la misma población que J6i: 947 registros, 1.189 tests, 118 declarantes, 385 declaraciones**. Lo que no
reproduce es «afirman»: J6i dio 299 y ningún criterio mío da 299 (nombrarlas → 409; con veredicto →
185). Por eso se dan dos criterios y **lo que se compara es la proporción**, no la cuenta:

| árbol | criterio | afirman | A | B | C1 | C2 | C3 | fuera (B+C2+C3) |
|---|---|---|---|---|---|---|---|---|
| 1-oct, J6i | el suyo | 299 | 80 | 184 | 11 | 17 | 7 | **208 (70 %)** |
| 1-oct, S3 | las nombra | 409 | 93 | 260 | 14 | 30 | 12 | 302 (74 %) |
| 1-oct, S3 | con veredicto | 185 | 59 | 104 | 8 | 10 | 4 | 118 (64 %) |
| **hoy, S3** | las nombra | 631 | 176 | 364 | 24 | 48 | 19 | **431 (68 %)** |
| **hoy, S3** | con veredicto | 274 | 112 | 133 | 11 | 14 | 4 | **151 (55 %)** |

Los «208» de hoy son **151 a 431** según lo que se cuente como afirmar. La proporción baja (de 64-74 % a
55-68 %) porque la clase A crece más deprisa, no porque B se vacíe: B pasa de 104-260 a 133-364.

### ③ Qué se puede comprobar de lo que está fuera

Para cada registro de fuera, qué hay en git (`docs/master/evidencias/` y `docs/evidencias/`) con el número del
ticket:

| | las nombra (431) | con veredicto (151) |
|---|---|---|
| un guion que muta (`.mjs` que nombra mutaciones y reescribe fuente) | 36 | 15 |
| sólo salidas guardadas (`.txt`/`.json`/`.md`) que hablan de mutaciones | 19 | 10 |
| **nada: la afirmación vive sólo en el párrafo** | **376 (87 %)** | **126 (83 %)** |

Muestra a mano: 8 de los 132 «sólo texto» con veredicto (semilla 1387). **7 son afirmaciones de verdad**
(«Mutación \| Cae diciendo», «las cuatro muertas… (caen 2)»…) **sin ningún guion en git**. La octava (1388) tenía
sus evidencias en `docs/evidencias/`, que el instrumento no miraba: arreglado, ahora sale «salida». **Ningún
falso en la muestra; los otros 124 no se han leído.**

Y hay que leerlo así: `.replace(`/`writeFileSync`/`aplicarUna` es un indicio de que el guion muta,
no la prueba de que hoy funcione. **«guion» quiere decir «se podría volver a correr a mano», no «se repite».**

### Controles del instrumento

- **Positivo:** SCRUM-1387 tiene su test en el catálogo y sale A. Mutado para buscar 1386 (que es C1): **sale 2,
  «CIEGO · control positivo»**. Sin mutar, 0.
- **Log sin la lista del corte:** sale 2, CIEGO, en vez de dar 238 como si no hubiera corte.
- **Población:** sobre el árbol del 1-oct reproduce los 947 / 1.189 / 118 / 385 de J6i (salidas `salida-1oct-*.txt`).

### Lo que propongo (el camino; nada de esto está construido)

1. **S3, barato y sin decidir nada:** el rótulo del meta-guard dice también los ficheros con alguna juzgada
   («…en 192 juzgados de 238 declarantes de 1565»). Hoy se lee 15 donde el CI repite 12. Va en la familia de
   1387d y no cambia cómo decide. Si se quiere, con su rojo primero.
2. **S5, ya aprobado:** la matriz de 1620. Devuelve los 46 guards y lleva 192 → 238.
3. **Fundador, la ②, con los números delante:**
   - «catálogo obligatorio para toda mutación de ticket» son **151 a 431 registros en falta hoy**, y 5 de cada 6
     ni siquiera tienen el guion en git: no se pueden pasar al catálogo, hay que **reescribirlas**. Y el
     meta-guard ya no cabe: 735 juzgadas tardan 1.695 s (≈ 2,3 s por mutación, del mismo log). Cada 100
     mutaciones nuevas son ≈ 4 min más de CI repartidos entre las partes.
   - «sólo las que vigilan un guard» deja escrito que lo demás es verificación de UNA vez. Es honesto, pero hoy
     **ni la verificación de una vez se puede repetir** en el 83-87 % de los casos.
   - **El punto medio que medí que falta:** que un registro que AFIRMA mutaciones lleve su guion en git (A8 ya
     dice «el banco SE SUBE»). No mete nada en el CI, no cuesta minutos y convierte el párrafo en algo que otro
     puede volver a correr. Hoy lo cumplen 36 de 431. Es una norma (S0 la propone, el fundador la firma), y
     un instrumento la podría comprobar con este mismo censo.

⛔ **No se arreglan los 431 a ciegas.** Reescribir mutaciones de tickets cerrados sin su contexto es fabricar
verdes.

### Lo que NO he medido

- **Si las mutaciones de fuera seguirían cayendo hoy.** Este censo mira si hay algo que correr, no lo corre.
- **La clase A no es «cubierto»** (lo dijo J6i y sigue valiendo): sólo que ALGÚN test del ticket declara algo.
  De los 176 A (o 112 con veredicto), 150 (100) tienen alguno juzgado en ese CI.
- Las mutaciones que viven fuera de `docs/master/evidencias/` y `docs/evidencias/` con otro nombre de carpeta
  (p. ej. `tests/_banco-*` sin número de ticket): no las atribuyo a ningún registro, así que pueden inflar
  «sólo texto». La muestra de 8 no encontró ninguna.

### Mis errores

- El instrumento miraba una raíz de evidencias y en el árbol hay dos. No lo vio ningún control: lo vio la muestra
  a mano. Arreglado antes de publicar, y la nota queda en el propio guion.

### Reproducir

    git archive --format=tar -o a1oct.tar 5fb7630ad564740f0fe4ba115e7dc141d18da775 docs/master tests   # y extraerlo en <dir>
    gh api repos/lwislg99/cobroflash-backend/actions/jobs/123442782267/logs --allow-escape-sequences > meta.log
    node docs/master/evidencias/SCRUM-1387/1387e/censo-registros.mjs --log meta.log [--estricto] [--lista <tsv>]
    node docs/master/evidencias/SCRUM-1387/1387e/censo-registros.mjs --raiz <dir> [--estricto]
    # sale 2 (CIEGO) si la población está vacía, si la lista del corte no cuadra con su rótulo,
    # o si SCRUM-1387 (control positivo, con su test en el catálogo) no sale como A

## SCRUM-1387f · el rótulo del meta-guard dice también los ficheros con alguna juzgada

**Medido contra:** `origin/main` = `53d9834d91b5eea3ec35a22449b72a62e9160739` · 2026-10-29T18:32:43Z
(S3, equipo de Luis. Es el punto ① del camino que propuso 1387e, y lo aprobó el orquestador el 29-oct: «es barato,
no decide nada, y hace visible el corte en vez de dejarlo en el log». Los puntos ② (la matriz de 1620, S5) y ③ (la
decisión del fundador) NO se tocan aquí.)

A9: comprobación → `tests/scrum1387f-el-rotulo-dice-los-juzgados.test.mjs`

### Qué cambia

La línea final del meta-guard decía «…en 238 ficheros DECLARANTES de 1565 ficheros de test (15 %)», y el CI repetía
mutaciones en 192 (1387e ①): el corte de 1620 dejó 46 guards sin ninguna. Ahora la misma línea sigue con:

    · 192 juzgados de 238 declarantes (12 % de los 1565 ficheros de test)

- **Se cuenta donde se juzga:** `guardsJuzgados.add(guard)` va justo después de `juzgadas += 1`, dentro del bucle.
  Un guard que el corte deja a cero no entra.
- **Sin el dato, la línea es la de 1387d byte a byte** (`ficherosJuzgados = null`). Lo que ya buscaba «vivas N ·
  mudas N» o «(N %)» lo sigue encontrando, y los tests de 1387d, 1620 y 812 no se han tocado.
- **No decide nada:** sólo imprime. Los veredictos y los códigos de salida no cambian.
- Con parte (1620), los juzgados van antes de «PARTE i de k» y son los de esa parte.

### Controles

- **Rojo primero:** el test se comiteó solo (`5867d60f50f8bd0373144174fe32b697e0db38b0`) y daba **0 de 3** contra
  el código de `main`. Con el arreglo (`904b483c3273ffad6d98556c5f9d06df03283c15`), 3 de 3. Junto a 1387d, 1620,
  812, 935d y 765: **36 de 36**, con el trinquete de 812 sin moverse (el fichero nuevo no se titula guard).
- **Sus dos mutaciones, VIVAS** con la maquinaria del propio meta-guard
  (`docs/master/evidencias/SCRUM-1620/juzgar-guards.mjs`): quitar los juzgados del rótulo, y no contarlos en el
  bucle. Las cuatro de 1387d, también VIVAS. Árbol limpio después.
- **La pasada de verdad, con el corte provocado** (`META_PRESUPUESTO_S=120`, `1387f/pasada-corte-120s.txt`):

      vivas 23 · mudas 0 · ciegas 1 · ficheros muertos 0 · sobre 23 juzgadas de 942 declaraciones, en 239 ficheros DECLARANTES de 1566 ficheros de test (15 %) · 7 juzgados de 239 declarantes (0 % de los 1566 ficheros de test)

  Sale 2, como debe con un corte. **Cómo se lee:** 7 juzgados y «SIN JUZGAR 919, en 233 guard(s)» suman 240,
  uno más que los 239 declarantes. No es un descuadre: el guard que el corte pilla A MEDIAS tiene alguna juzgada
  (cuenta aquí) y le quedan pendientes (cuenta allí). El 29-oct en CI no había ninguno a medias (1387e); con el
  corte a 120 s, uno. El 0 % es 7 de 1.566 redondeado al entero, igual que el resto del rótulo.

### Lo que no hace

- **`--juntar` (las K partes de 1620) no lleva los juzgados:** su recuento sale de `veredictoDeLasPartes` y el
  resumen de cada parte no los guarda. Cuando entre la matriz de S5, cada parte dirá los suyos en su línea; el
  total juntado no. Es añadir el número al resumen de la parte, y no lo he hecho porque la matriz no está
  construida y no sé con qué forma entra.
- No cambia la cifra: con la matriz (S5) los 46 vuelven a juzgarse, y la línea pasará a decir 238 de 238 sola.

### Reproducir

    node --test tests/scrum1387f-el-rotulo-dice-los-juzgados.test.mjs
    node docs/master/evidencias/SCRUM-1620/juzgar-guards.mjs scrum1387f-el-rotulo-dice-los-juzgados.test.mjs
    npm run build && META_PRESUPUESTO_S=120 node scripts/meta-guard-mutaciones.mjs   # sale 2 por el corte; mirar la línea «vivas …»
