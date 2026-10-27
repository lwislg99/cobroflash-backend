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
