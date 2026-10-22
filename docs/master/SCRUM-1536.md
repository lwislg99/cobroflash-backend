# SCRUM-1536 · Forales y Canarias en la lista de provincias: ya estaba decidido, y qué pasa hoy

**Medido contra:** `origin/main` = `254a697924c99bdf85eb06c95ee439a4a013aa67` · 2026-10-13T12:09:48Z (hora de GitHub)

A9: sin fallo que generalice — mis cuatro tropiezos (abajo, «Lo que me salió mal») son casos de frases que A10 ya tiene: «Contar texto no es contar cosas» en su forma «Un prefijo no es un nombre, y una subcadena tampoco», y «Un instrumento declara su población, no sólo su resultado»; ninguno llegó a una cifra entregada.

13-oct-2026 · sesión `jv-j5j` (equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier. Leídos en Jira: SCRUM-1536 entero (sin comentarios al empezar);
SCRUM-1522 `c.19294` y `c.19338`; SCRUM-997, SCRUM-998 y SCRUM-1497 enteros, con sus comentarios.]
La entrega completa está en Jira, **SCRUM-1536 `c.19355`**. Este registro es su resumen y el sitio de
las evidencias.

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
del día. Sólo se escribe en `docs/master/`. No se ha tocado `src/`, `public/`, `tests/`, el esquema ni
ningún texto de usuario. Ninguna base mirada.

Al escribir esto `main` era ya `eebc104d9e955cdd67b31ad2d24a50cc9b849a7b`: lo entrado en medio son 11
ficheros de SCRUM-1339 en `docs/master/`, ninguno de los medidos aquí.

## ① Estaba decidido

El ticket pedía medir primero si el alcance territorial ya estaba fijado. Lo estaba:

| dónde | qué fija |
|---|---|
| `docs/YAQU_MASTER.md:248`, Parte I, regla 33 | «Onboarding bloquea facturación ES a domicilios forales (PV/Navarra) con aviso digno; TicketBAI = cajón F3.» |
| `docs/YAQU_MASTER.md:105`, B2.6 | «Gate foral: domicilio fiscal en País Vasco/Navarra → facturación ES off + aviso TicketBAI (regla 33).» |
| `docs/YAQU_MASTER.md:416`, Parte M | «Foral (PV/Navarra) → facturación off + aviso TicketBAI (regla 33).» |
| `docs/YAQU_MASTER.md:1735`, Parte Z | «TicketBAI foral · Cajón F3 · ≥25 solicitudes forales» |
| `docs/YAQU_MASTER.md:1104`, U3 | TicketBAI en la lista de F3 |
| SCRUM-997 | Javier, 21-sep-2026: «Sí, de momento no vendemos para estas regiones, déjalo por escrito» (País Vasco y Navarra) |
| SCRUM-998 `c.16609` | Javier, 23-sep-2026: «NO se hace nada hoy». No se bloquea el alta a los forales |
| SCRUM-1497 | Fundador, 7-oct-2026: «No de momento dejamos Canarias sin hacer, ya lo haremos déjalo reflejado en JIRA junto con las forales» |

Barrido del máster: 14 familias de palabras, 1 fichero, 499.475 caracteres; positivo sembrado 14 de 14
y control de cero a 0 (`barrido.mjs`). **De Canarias el máster no dice nada**: «IGIC» 0 veces; la única
línea que casa con «Canarias» (`:1362`) es la palabra «canario» de un test. Búsqueda en Jira por las
diez palabras del encargo: 26 tickets; con una palabra inventada, 0.

SCRUM-997 pedía escribir la decisión en `docs/equipo/limites-del-fundador.md` y **no se ha hecho**: el
fichero (11.753 B) tiene 0 menciones de vasco, navarra, foral, canari o «regiones», y 13 de «fundador».

Lo único sin decidir es qué hace con esas seis la pantalla de provincia, que el 23-sep no existía. Eso
es del fundador y aquí no se elige.

## ② Qué pasa hoy con un comercio de las seis

Ejecutado con los módulos reales compilados (`tsc --noCheck` a una carpeta temporal) y comercios
fabricados: `sonda.cjs`, salida en `salida-sonda.txt`.

- **Alta.** Las seis están en la tabla (52 de 52). `zonaDeAlta` devuelve `Europe/Madrid` para Álava,
  Bizkaia, Gipuzkoa y Navarra —el mismo valor que para Madrid— y `Atlantic/Canary` para las dos
  canarias. **La provincia no se guarda**: `Merchant` no tiene esa columna (las dos del esquema son de
  `Customer` y `CustomerSite`). Después del alta, un comercio de Bizkaia es indistinguible de uno de
  Madrid.
- **Emisión.** `getEmissionMode`, 14 llamadas (7 comercios × flag OFF y ON) con un espía que apunta
  cada propiedad leída. Con el flag en OFF, los 7 dan `receipt`; con el flag en ON, los 7 dan `fiscal`,
  incluidos los tres que habían contestado «Sí» al domicilio foral y los dos canarios. Propiedades
  leídas: `country`, `email`, `flags`, `id`. No lee `timezone`, `domicilioFiscalForal`, `address` ni
  `nif`. Controles: país MX → `fiscal`; id de la demo → `demo`; el espía sí apunta `timezone` cuando
  algo la lee.
- **Tipos.** `invalidTipoIva` rechaza los cinco tipos propios del IGIC (3, 7, 9,5, 15 y 20 %) y acepta
  21, 10 y 4 % (3 de 3). El registro lleva el impuesto fijo a `01` en
  `src/modules/fiscal/verifactu/registro.builder.ts:358`, única aparición.
- **Pantalla.** El alta pública está cerrada (SCRUM-1515, 409 siempre). La provincia sólo la teclea el
  equipo en su consola: nadie de fuera puede elegir hoy ninguna de las seis.

**El único freno de hoy es `INVOICING_ES_ENABLED` en OFF, y no es territorial.** El día que se encienda,
las seis emiten como Madrid. La regla 33 sigue declarada sin mecanismo: la respuesta al domicilio foral
se guarda y ninguna puerta la lee.

## ③ Dos hechos del ticket que la medición corrige

Texto consolidado del RD 1007/2023 leído hoy de la API del BOE (`BOE-A-2023-24840`, 88.577 B, 36
bloques, 233 párrafos, sha256 `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38`):
`boe.mjs`, salida en `salida-boe.txt`. Los tres párrafos de territorio del articulado están en el
art. 1.3 del Reglamento.

1. **Canarias está dentro del Reglamento.** «El Reglamento es aplicable en todo el territorio español,
   sin perjuicio de los regímenes tributarios forales […] y teniendo en cuenta las especialidades
   previstas en su normativa específica para Canarias, Ceuta y Melilla», y las referencias al IVA «se
   considerarán también efectuadas a la normativa del Impuesto General Indirecto Canario». El XSD de
   casa admite `03` = IGIC. El ticket la ponía bajo «por qué no es VeriFactu»: no es eso. Es el mismo
   sistema, y es nuestro producto el que no sabe hacer IGIC.
2. **Lo foral va por domicilio fiscal**, no por la provincia donde se trabaja: el Reglamento se aplica
   «cuando tengan su domicilio fiscal en territorio común». La pantalla pregunta «¿Dónde trabajas?»
   para la hora; el dato que la norma mira es otro y ya tiene su pregunta firmada (SCRUM-1102).

## Lo que NO se ha medido

- Ninguna base: no se sabe si hay hoy algún comercio canario o con «Sí» en el domicilio foral.
- Nada en yaqu.app ni en un navegador; ningún alta ejecutada (`registerMerchant` está leído).
- El rechazo `invoicing_es_disabled` con el flag en OFF: leído en `invoiceNumber.service.ts:448`.
- La normativa foral (TicketBAI, Batuz, Navarra), el Concierto y el Convenio. «Batuz» no aparece en
  ningún fichero del repositorio.
- Si la búsqueda de Jira ve las tildes: se buscó «Alava».
- La tanda de tests: no hay código tocado.

## Lo que me salió mal

- El barrido contó 95 líneas de «Canarias» en el código y la mayoría eran «canario», el nombre de los
  tests de control. Se vio leyendo las 144 líneas, no por el recuento. Ninguna cifra entregada sale de él.
- `salida-sonda.txt` dice «IGIC aceptados 1 de 6»: el 0 % estaba en la lista del IGIC y es un tipo
  compartido con el IVA. Lo correcto es «rechaza los 5 propios». La salida se deja como salió.
- Crucé 200k sin avisar: 129.490 al acabar la lectura, 240.965 en la siguiente medida.
- `arbol:mio` se pasó antes de la primera escritura, no antes de empezar; dio `MIO`.

## Evidencias

`docs/master/evidencias/SCRUM-1536/`: `barrido.mjs`, `sonda.cjs`, `boe.mjs`, `salida-barrido-master.txt`,
`salida-sonda.txt`, `salida-boe.txt`. El XML del BOE no se sube; va su sha256.

| lo pedido | dónde se ve |
|---|---|
| qué dice el máster sobre territorio | ① · `docs/YAQU_MASTER.md` |
| si había ticket previo | ① · SCRUM-997, SCRUM-998, SCRUM-1497 |
| qué pasa hoy con las seis | ② · `docs/master/evidencias/SCRUM-1536/sonda.cjs` |
| si el régimen no es el del ticket | ③ · `docs/master/evidencias/SCRUM-1536/salida-boe.txt` |
| visto en yaqu.app | NO HECHO → no hay pantalla que ver |

## SCRUM-1536b · El obligatorio de la rama anterior cayó por tres controles de sus propios guiones que sólo sabían decir dos cosas: ahora dicen tres

**Medido contra:** `origin/main` = `cb30885dd69c4df7f33d3a0066fed93698926857` · 2026-10-14T02:15:00Z (hora de GitHub)

A9: comprobación → `tests/scrum622-desconocido-no-es-verde.test.mjs`

Sesión `jv-j6c`, puesto J6. Rama `scrum-1536b-los-tres-ternarios`, que lleva dentro, por merge, la
rama `scrum-1536-forales-y-canarias` @ `1a6cf221fd2d545be9f90af73c0ac93936c2ae23` entera (PR #2377)
y la sustituye. Carril: el ticket lleva `equipo-javier` y `area-fiscal` y está En curso; los
ficheros que se tocan salen «sin fila en §3: nadie lo reclama» (los guiones de evidencia) y «quien
trabaja el ticket» (este registro) en `node scripts/carriles.mjs de`, una ruta por llamada.

### Qué caía

`tests/scrum622-desconocido-no-es-verde.test.mjs`, el caso «EL CENSO», en su aserto de lista
vacía. Visto en rojo en local antes de tocar nada, con la rama anterior mergeada: el censo nombra
tres expresiones, las tres en guiones de evidencia que añadió la rama anterior.

| dónde | la expresión |
|---|---|
| `barrido.mjs`, control positivo sembrado | `faltan.length ? 'FALTAN ' + faltan : 'OK'` |
| `barrido.mjs`, control de cero | `vistas.has('ZZ_CERO') ? 'ROTO' : 'OK'` |
| `boe.mjs`, control de cero | `c0 ? 'ROTO' : 'OK'` |

### Por qué caía, y por qué el guard tenía razón

No es una cuestión de forma. Los tres controles decían OK por descarte, y eso se ve corriendo los
guiones VIEJOS sobre una entrada que no deja mirar:

- `barrido.mjs` con el catálogo reducido al centinela: «0 de 0 OK · cero en la siembra: OK», sin la
  línea CIEGO y con código 0. No faltaba ninguna palabra porque no se esperaba ninguna.
- `boe.mjs` sobre un fichero vacío: positivo `false`, «control de cero: OK» y código 0. No encontró
  el centinela en un texto donde no podía encontrar nada.

### El arreglo, y por qué no es un esquive

`veredicto.mjs`, nuevo, en la misma carpeta: una función con tres salidas. ROTO si se vio lo que
no tenía que verse o falta lo que tenía que verse; OK sólo si además hay prueba de que se pudo
mirar; y lo que no es ninguna de las dos, NO SE PUDO SABER. El resultado por defecto es el que
no afirma nada. Qué cuenta como «pudo mirar» en cada control:

- Positivo de `barrido.mjs`: había alguna palabra que esperar.
- Cero de `barrido.mjs`: el centinela está en el catálogo como expresión regular y la misma pasada
  sobre la siembra vio alguna otra palabra.
- Cero de `boe.mjs`: la misma búsqueda, sobre el mismo texto, encuentra la frase del positivo.

En `barrido.mjs` un control que no sale OK corta con CIEGO y código 2, como ya hacía con ROTO.

No es la versión equivalente del esquive del 13-oct porque el tercer resultado OCURRE y se ve. Los
tres estados de cada guion están corridos en `salida-tres-estados.txt`, con las copias mutadas
fabricadas por `mutar-vaciar.mjs` y `mutar-sembrar.mjs` (los dos abortan si su parche no casa). No
se ha tocado `tests/scrum622-…` ni `tests/_censo-redes-benignas.mjs`, y los guiones siguen dentro
de la población del censo: son `.mjs` bajo `docs/`, que el censo recorre.

### Lo que miden los guiones no ha cambiado

Medido con el guion de antes y el de después sobre la misma entrada:

- `barrido.mjs` sobre `docs/YAQU_MASTER.md` (sin cambios entre `254a69792` y este árbol, `git diff`
  vacío): la salida es idéntica a `salida-barrido-master.txt` con los dos guiones, y el fichero de
  líneas halladas es idéntico byte a byte entre los dos (16 líneas).
- `boe.mjs` sobre el texto consolidado bajado de nuevo de la API del BOE: mismo tamaño y mismo
  sha256 que el de la medición original, y la salida es idéntica a `salida-boe.txt` con los dos.

Las tres salidas guardadas de la rama anterior no se han tocado.

### De paso

- `boe.mjs` acababa siempre con «EXIT=0», también con el positivo en `false`. Ahora, si su control
  de cero no sale OK, acaba con código 2 y lo escribe. Con el Reglamento de verdad sigue en 0.
- `barrido.mjs` cuenta el centinela entre las «vistas» cuando aparece, así que el caso ROTO de cero
  imprime «15 de 14». Ya era así; no se ha tocado, y el veredicto de esa línea es ROTO igual.

### Lo que NO se ha medido

- `sonda.cjs`: no se ha corrido ni tocado. El censo no la nombra.
- La tanda completa: este árbol no tenía `dist`; se compiló con `tsc --noCheck` para los guards
  que se nombran en la entrega.
- El obligatorio de esta rama, al escribir esto.
- Que el texto del BOE siga siendo el mismo mañana: el sha256 coincide hoy.

### Errores propios

- El carril de `veredicto.mjs` lo miré después de escribirlo, no antes. Salió «sin fila en §3»,
  como sus vecinos de carpeta.
- El hook de arranque dijo «SIN IDENTIDAD» y seguí con el puesto que da el encargo, como hizo la
  sesión anterior de este ticket. Se dice aquí; no lo he resuelto.

## SCRUM-1536b (segundo empujón) · Los dos mutadores de los tres estados entran en el catálogo del meta-guard

**Medido contra:** `origin/main` = `82a61cd7c05c0f3ab4cbdf4aff55076d3b337822` · 2026-10-14T02:58:01Z (hora de GitHub)

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

Sesión `jv-j6d`, puesto J6, relevo de `jv-j6c`. Misma rama, `scrum-1536b-los-tres-ternarios`, sobre
`f9a50e547`. Carril: etiquetas del ticket leídas en Jira al arrancar (`area-fiscal`, `equipo-javier`,
En curso); las rutas que se tocan salen «sin fila en §3: nadie lo reclama» en
`node scripts/carriles.mjs de`, mirado ANTES de escribir el test.

### Qué caía

El obligatorio del PR #2410 (comentario 19522 del ticket): `scrum622` ya no caía, y caía
`tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`, que nombraba `mutar-sembrar.mjs` y
`mutar-vaciar.mjs` de `docs/master/evidencias/SCRUM-1536/`: dos guiones con «mut» en el nombre,
cada uno con su parche escrito dentro, que entraron después que la regla.

Visto en rojo en local antes de tocar nada: 6 casos, 5 pasan y 1 cae; población «148 ficheros con
«mut» en el nombre · 60 bancos · 36 fuera · 34 heredados · 2 nuevos · historia de 2743 commits ·
corte bc5fa21ee (2026-10-14T02:04:37Z)». El corte es el merge de #2406 en `main`, no un merge de
esta rama: la línea de primer padre de la rama pasa por `main` (`cb30885dd`). El segundo «nuevo»
era `SCRUM-1544/mutaciones.mjs`, que no es de este PR y que `main` ya arregló con #2413.

### El arreglo

No se ha tocado el guard, ni `tests/_catalogo-obligatorio.mjs`, ni ningún nombre de fichero.

- `tests/scrum1536b-los-tres-estados-de-los-guiones.test.mjs`, nuevo, sin gate. Ejecuta
  `barrido.mjs` en sus tres estados (tal cual, y sobre las copias que fabrican los dos mutadores)
  y lee su línea de CONTROL y su código de salida. Siete casos. Exporta cinco
  `MUTACIONES_QUE_ME_TUMBAN`: tres sobre `barrido.mjs` (las que aplicaban los mutadores, ahora con
  un campo `modo`) y dos sobre `veredicto.mjs`, que ningún mutador aplica: son el defecto de
  origen —lo que no se pudo mirar sale OK, lo roto sale OK— puesto a mano.
- `mutar-sembrar.mjs` y `mutar-vaciar.mjs` ya no llevan su parche: leen del test la declaración de
  su `modo` con `mutacionesDeclaradas` (el lector del meta-guard) y la aplican a una copia. Con un
  modo que el test no declara, o con cero o dos declaraciones de ese modo, dicen CIEGO y salen
  con 2 sin escribir nada.
- «Vaciar» era un corte por índices del catálogo; como declaración de un solo `de`/`a` es otra
  forma de lo mismo: el catálogo se queda con el centinela y las catorce palabras pasan a un
  objeto que nadie lee. La línea de CONTROL y el código de la copia son los de antes; cambia la
  línea «MUTADO», que contaba líneas y ahora cuenta caracteres. Es la única línea cambiada de
  `salida-tres-estados.txt`, y lleva su nota.

### Medido

- El test nuevo: 7 de 7, 0 saltos.
- Las cinco declaraciones, aplicadas con las piezas de la casa (`correr` + `aplicarUna`, vía
  `docs/master/evidencias/scrum1321/aplicar-las-de-un-guard.mjs`): la pasada limpia da 7 pasados,
  y las cinco salen VIVA, cada una tumbando el caso que nombra. Después, `git status` sólo
  enseñaba los ficheros de este empujón: `barrido.mjs` y `veredicto.mjs`, sin diff.
- `scrum1387` tras el arreglo, en este árbol: «35 fuera · 34 heredados · 1 nuevos», mismo corte.
  El que queda es el de `SCRUM-1544`. Lo que ve el CI (el merge con `main`) va en la entrega de
  Jira, no aquí: se mide después de comitear.

### Lo que NO se ha medido

- `npm run meta:mutaciones` entero. Sólo las cinco de este test.
- La tanda completa en local.
- `boe.mjs`: el test no lo cubre (pide el texto del BOE, que no vive en el árbol). Sus tres
  estados siguen siendo los de `salida-tres-estados.txt`, corridos a mano por `jv-j6c`.
- Los tres barridos mutados de `salida-tres-estados.txt` se han vuelto a correr sobre
  `docs/YAQU_MASTER.md` y dan las mismas líneas de CONTROL y los mismos códigos; los cuatro de
  `boe.mjs` no se han vuelto a correr.

### Errores propios

- De `jv-j6c`, que lo dejó pedido en el comentario 19523: `scrum1387` salió en su lista de tests
  que leen `evidencias` y corrió diez guards menos ése. La cicatriz de J6 del 8-oct ya decía que
  los censos se miran antes de escribir el fichero, y la nota no lo corrigió. Lo que lo paró fue
  el obligatorio. `npm run guards:entrada` no lleva `scrum1387`.
- De esta sesión: el contexto se midió por primera vez con el arreglo ya escrito (169.123), no al
  acabar el arranque como pedía el encargo.
- El hook de arranque dijo «SIN IDENTIDAD». Se construyó con la orden del orquestador, que dice
  haber medido que la puerta instalada (`sesion.mjs`) contesta «ALTERADO»; esta sesión no lo ha
  reproducido.

## SCRUM-1536e · La línea firmada de la regla 44 entra al final de la regla 33 del máster

**Medido contra:** `origin/main` = `9839aa6c2baee741f6a38de4e99c7fc29a3fe807` · 2026-10-22T09:28:20Z (hora de GitHub)

A9: sin fallo que generalice — el texto se copió del ADF de c.20229 y se comparó por bytes con lo escrito (422 = 422, con un control mutado que sí difiere); el único tropiezo, el orden de la medición de contexto (abajo), ya lo cubre la ficha del orquestador, que dice «en ese punto exacto».

22-oct-2026 · **J5** (sesión `jv-j5p`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier. Leído en Jira: SCRUM-1536 entero, 14 comentarios, hasta c.20229.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
del día. Etiquetas leídas en SCRUM-1536: `area-fiscal`, `equipo-javier`; estado En curso.
`docs/YAQU_MASTER.md` es carril de un jefe (`dos-equipos.md:195`): el jefe firmó y esta sesión lo aplica,
como se aplicaron las reglas 43 y 44 (SCRUM-1552, `165f116f0`).

### Qué es esto

**Un cambio de máster, no un registro.** Lo firma el fundador en SCRUM-1536 **c.20229** («FIrmo la linea»),
y la regla 44 lo pide: una decisión que condiciona trabajo deja UNA línea en el máster con el enlace al
comentario. La decisión está en c.20218 (forales y Canarias excluidos de YaQu por ahora) y c.20225.

Toca SOLO `docs/YAQU_MASTER.md:248`, la línea del bloque «**v5.3:**»: la línea firmada se añade al final de
la regla 33, detrás de «TicketBAI = cajón F3.» y delante de «34)». Va **dentro de la misma línea física**,
así que **no se mueve ninguna línea** del máster (1.911 antes y después; `git diff` da un solo tramo,
`@@ -248 +248 @@`) y nadie que cite el máster por número de línea queda desplazado.

**B2.6 (`:105`) y la Parte M (`:422`) no se tocan.** Lo dice el fundador en c.20229: «Ok basta con el
aviiiso». El aviso de la regla 33 es el único sitio que cambia; la propia línea firmada dice que deja
sin efecto lo de B2.6 y la Parte M.

### Cómo se copió el texto

Del cuerpo ADF de c.20229 (no del markdown, ni de la ficha del orquestador): el único `blockquote` del
comentario, con sus dos negritas. Se escribe sin el `>` de cita, porque va dentro del párrafo de la
regla. Comparación: lo escrito, quitándole los `**`, es igual al texto del ADF (422 B = 422 B); el mismo
comparador con una tilde quitada («tambien») da distinto. Las negritas, en los mismos dos tramos que en
el ADF.

### Lo que NO se ha medido

- No se ha mirado si algún texto de usuario, guard o documento fuera de `tests/` repite el «facturación
  ES off + aviso TicketBAI» de la regla 33: el encargo era sólo la línea.
- El obligatorio de esta rama: se lee después del empujón y va en la entrega, no aquí.
- Visto en yaqu.app: NO HECHO → no hay pantalla; es el máster.

### Errores propios

- La ficha pedía medir el contexto al acabar la lectura de arranque y otra vez al acabar Jira. Leí Jira
  primero y el arranque después, así que sólo hay un punto: **130.145** al terminar las dos.
