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
# SCRUM-1536c · Excluir forales y Canarias: dónde, con qué dato y qué texto (DISEÑO; nada construido)

**Medido contra:** `origin/main` = `75884928b170ec0ec02e35921426e5bd711cbb0f` · 2026-10-22T09:09:16Z (hora de GitHub)

A9: aviso → A10 «Una red de seguridad que no caza tiene el mismo aspecto que una que no tuvo nada que cazar.» — no se pudo comprobar: escribí este tramo con `##`, `scrum267` no lo veía y seguía en verde sin ancla (abajo, «De paso»); que un tramo nuevo vaya con `#` no lo exige ningún guard, y exigirlo es tocar `scrum267` (regla 41, de otro puesto).

22-oct-2026 · sesión `jv-j5o`, puesto J5, por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier.] Lo desbloquea **SCRUM-1536 c.20218**: el fundador decide
que forales (Álava, Bizkaia, Gipuzkoa, Navarra) y Canarias **quedan excluidos de YaQu por ahora,
no sólo sin facturación**. Leídos en Jira: el ticket entero, sus 10 comentarios (c.19355 a c.20218).
El encargo traía `main` = `fe65a8b7f`; medido aquí, `75884928b`.

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la
ficha del día. Sólo se escribe en `docs/master/`. **No se ha construido nada**: ni `src/`, ni
`public/`, ni `tests/`, ni el esquema, ni ningún texto de usuario. Los textos de ⑤ son PROPUESTA
(regla 39) y no están en ningún fichero de producto. Ninguna base mirada (③).

### ① PASO 0: de la exclusión no hay nada construido

- `git log origin/main --grep=SCRUM-1536`: `1a6cf221f` (registro), `f9a50e547` y `a9b3273d4`
  (guiones de evidencia), más `d95bbac93` (SCRUM-997b, la cicatriz de J5). Ninguno toca `src/`.
  Sin rama `scrum-1536*` en el remoto (`ls-remote` anclado al nombre; control: el listado sí
  devuelve ramas de hoy).
- **`zonaDeAlta` vuelta a ejecutar hoy** (copia del fichero de `main` con
  `node --experimental-strip-types`, sin compilar `dist/`): Álava, Bizkaia, Gipuzkoa y Navarra →
  `Europe/Madrid`, **el mismo valor que Madrid**; Las Palmas y Santa Cruz de Tenerife →
  `Atlantic/Canary`. Controles: «Narnia» lanza `provincia_desconocida`; `MX` sin provincia → `null`.
  8 de 8 casos. Lo que medía c.19355 sigue igual.
- `getEmissionMode` (`src/modules/invoicing/domain/emission.service.ts:36`), leída hoy: sigue
  leyendo país, demo y flag, nada de territorio. El único freno sigue siendo el flag en OFF.

### ② Dónde se sabe hoy la provincia y el domicilio fiscal

| dato | dónde se pide | se guarda | obligatorio | se valida | quién lo lee después |
| --- | --- | --- | --- | --- | --- |
| provincia («dónde trabajas») | en el alta: `altaDeMerchant.ts --provincia`, **la única puerta hoy** (`POST /auth/register` contesta siempre 409, `auth.routes.ts:44`) | **no**: sólo produce `timezone` | sí, con país ES | sí, contra las 52; lanza **antes** del `create` | nadie |
| zona horaria | se deriva en el alta | `merchants.timezone` | — | — | el día del comercio; **no se puede cambiar después** (no está en `merchantProfileUpdateSchema`) |
| domicilio fiscal foral | Ajustes → Empresa: «¿Tienes el domicilio fiscal en el País Vasco o en Navarra?» (`settingsView.js:338`, firmado en SCRUM-1102 c.17709) | `merchants.domicilio_fiscal_foral`, `Boolean?` de tres estados | **no**, y **no se pregunta en el alta** | sí / no / no consta (`schemas.ts:422`) | **ninguna puerta** (`schema.prisma:55-58` lo dice) |
| domicilio fiscal canario | **no existe** | — | — | — | — |
| dirección | Ajustes, texto libre | `merchants.address` | no | `min(1)` | nadie para esto; no hay columna de código postal ni de provincia en `Merchant` |
| país | en el alta (`--country`, ES por defecto) y **en Ajustes** (`settingsView.js:373`) | `merchants.country` | — | dos letras | `getEmissionMode` |

**El punto del alta donde se puede excluir sin dejar un comercio a medias** es el que ya usa la
provincia: `registerMerchant` (`src/modules/auth/domain/auth.service.ts:343-344`) resuelve la zona
**antes** del referido, del `merchant.create`, del correo de bienvenida y del enlace de acceso, y si
lanza no queda nada. Un rechazo puesto al lado de `zonaDeAlta` hereda esa propiedad, y la CLI de
hoy y la ruta pública de mañana pasan las dos por ahí.

### ③ Población: NO medida. Se deja la consulta

El árbol no tiene claves de base: `node scripts/comprobar-claves-bd.mjs` (hoy, ~09:05Z) dice
`DATABASE_URL_STAGING`, `_DEV` y `_TESTS` **AUSENTES** y «SUELO: no se leyó ni una sola cadena de
conexión». No las he buscado en ningún otro sitio. **No sé si hay hoy un comercio foral o canario
en ninguna de las tres bases.**

Consulta para quien tenga acceso, **sólo lectura**, la misma en las tres bases. No saca ni nombre,
ni correo, ni dirección:

```sql
-- 1) Población. Tiene que salir total > 0 (la demo, id = 1, está en las tres).
SELECT count(*) AS total,
       count(*) FILTER (WHERE country = 'ES') AS es,
       count(domicilio_fiscal_foral) AS foral_contestado
FROM merchants;

-- 2) Positivo SEMBRADO del patrón de dirección. Tiene que devolver 2 filas (Bilbao y Álava), no 3.
SELECT v.a FROM (VALUES ('C/ Gran Via 1, 48001 Bilbao'),
                        ('Vitoria-Gasteiz (Álava)'),
                        ('Calle Alcala 1, 28001 Madrid')) AS v(a)
WHERE v.a ~ '(^|[^0-9])(01|20|31|35|38|48)[0-9]{3}([^0-9]|$)'
   OR translate(lower(v.a), 'áéíóúü', 'aeiouu')
      ~ '(alava|araba|bizkaia|vizcaya|gipuzkoa|guipuzcoa|navarra|nafarroa|canarias|las palmas|tenerife|gran canaria|lanzarote|fuerteventura|la gomera|el hierro)';

-- 3) Candidatos, y por qué sale cada uno.
SELECT id, country, timezone, domicilio_fiscal_foral, status, plan, created_at,
       (domicilio_fiscal_foral IS TRUE)  AS por_respuesta_foral,
       (timezone = 'Atlantic/Canary')    AS por_zona_canaria,
       (coalesce(address, '') ~ '(^|[^0-9])(01|20|31|35|38|48)[0-9]{3}([^0-9]|$)'
        OR translate(lower(coalesce(address, '')), 'áéíóúü', 'aeiouu')
           ~ '(alava|araba|bizkaia|vizcaya|gipuzkoa|guipuzcoa|navarra|nafarroa|canarias|las palmas|tenerife|gran canaria|lanzarote|fuerteventura|la gomera|el hierro)')
                                         AS por_direccion
FROM merchants
WHERE id <> 1
  AND (domicilio_fiscal_foral IS TRUE
       OR timezone = 'Atlantic/Canary'
       OR coalesce(address, '') ~ '(^|[^0-9])(01|20|31|35|38|48)[0-9]{3}([^0-9]|$)'
       OR translate(lower(coalesce(address, '')), 'áéíóúü', 'aeiouu')
          ~ '(alava|araba|bizkaia|vizcaya|gipuzkoa|guipuzcoa|navarra|nafarroa|canarias|las palmas|tenerife|gran canaria|lanzarote|fuerteventura|la gomera|el hierro)')
ORDER BY id;
```

El patrón de dirección es un **candidato, no una prueba**: los prefijos postales 01, 20, 31, 35, 38
y 48 son los de las seis provincias, y la dirección es texto libre. Calibrado en `node` con
casos sembrados: 6 de 6 positivos (Bilbao, Las Palmas, Pamplona, «Álava», Tenerife, Donostia) y 0
de 5 negativos (Madrid, un teléfono `600120345`, «Calle 20 n 31», Barcelona, «piso 48»). «La
Palma» se deja fuera a propósito: casa con calles de otras provincias. **Que el dialecto de
expresiones de Postgres se comporte igual que el de `node` no está medido**; por eso la consulta 2
lleva el positivo sembrado y se corre antes que la 3.

**Qué les pasaría a los que salgan: lo decide el fundador, no este tramo.** Con el flag en OFF no
emiten documentos, igual que Madrid. Lo que haya que hacer con ellos (avisarles, dejarlos o darlos
de baja) toca datos de clientes y estados cerrados de la Parte L: es STOP.

### ④ Diseño propuesto

**La idea: excluir en la PUERTA, con un dato declarado, antes de crear nada, y no tocar el camino
de emisión.** Cinco piezas:

**A · El alta (J3).** `registerMerchant` pide, para país ES, una respuesta **obligatoria** sobre el
domicilio fiscal, de valores cerrados: `comun` · `foral` · `canarias`. Con `foral` o `canarias`
lanza `territorio_excluido` en el mismo punto que `provincia_required` (②), así que no se crea
nada. Con `comun` crea el comercio y escribe `domicilioFiscalForal = false` en la columna que ya
existe: **sin ALTER**. La CLI gana `--domicilio-fiscal`. Coste: del tamaño de SCRUM-1522e, una
función de dominio más sus tests. Ahí se dobla una pregunta para el fundador:

- **Forales: por domicilio fiscal, no por provincia** (c.19355 §4 ②, art. 1.3 del RD 1007/2023).
  Uno que trabaja en Bilbao con domicilio en Burgos entra; uno con domicilio en Bilbao que trabaja
  en Burgos, no.
- **Canarias: el motivo es otro.** Canarias está DENTRO del Reglamento (c.19355 §4 ①); se la
  excluye porque YaQu no sabe hacer IGIC. Y el IGIC podría depender de **dónde se trabaja**, no de
  dónde se tiene el domicilio. **No está medido**: va a la lista del asesor (SCRUM-1264).
  **Propuesta:** excluir a Canarias **por las dos vías** (domicilio declarado canario **o**
  provincia de trabajo canaria, que ya se conoce en el alta). Para los forales, sólo por el
  domicilio.
- **Guardar el «no» de Canarias** pediría una columna nueva (ALTER aditivo, orden A5, decisión de un
  jefe). Propuesta: no guardarlo. Los excluidos no llegan a tener fila, y la vía de la provincia ya
  queda en `timezone`.

**B · Ajustes, después del alta (J3).** Hoy se puede pasar «¿Tienes el domicilio fiscal en el País
Vasco o en Navarra?» a «Sí». Propuesta: `updateMerchantProfile` rechaza el `true` con el mismo
`territorio_excluido` y la pantalla enseña el texto T2. **No cambia nada más**: ningún estado
nuevo (regla 5) y nada se borra. La provincia y la zona no se pueden cambiar después del alta, así
que no hay nada que vigilar ahí.

🔴 **El país sí se cambia en Ajustes, y eso se lleva por delante esta exclusión y también el flag.**
El esquema acepta `country: "MX"`, medido en SCRUM-1102 (`docs/master/evidencias/SCRUM-1102/hoy.txt:16`).
`updateMerchantProfile` lo escribe tal cual (`...rest`, `merchantAdmin.ts:253-256`, leído). Y
`getEmissionMode` da `fiscal` a todo país que no sea ES (`emission.service.ts:38`, leído). Así que un
comercio de España que se cambie el país a México deja de pasar por el flag. **Leído, no ejecutado
de punta a punta** (pide base). No es de este ticket: toca la emisión (J1) y Ajustes (J3), y lo
decide un jefe.

**C · La pantalla pública de alta (J3), cuando se reabra.** `public/register.html` lleva hoy el
409 firmado y ninguna provincia. El día que vuelva a dar altas, le hacen falta la pregunta de A y
el texto T1. Hasta entonces, a quien se excluye se lo dice por su cuenta el miembro del equipo que
lanza la CLI, y le dice T1.

**D · El máster (un jefe; `docs/YAQU_MASTER.md` no tiene cerradura).** Hoy dice lo contrario que
c.20218 en tres sitios: la **regla 33** (`:248`, «Onboarding bloquea facturación ES a domicilios
forales (PV/Navarra) con aviso digno»), **B2 punto 6** (`:105`) y la **Parte M** (`:422`). Los tres
dicen «facturación off + aviso TicketBAI»; la decisión dice «no entran». Canarias no sale en el
máster. Y la **regla 44** (`:276`) pide que una decisión del fundador que condiciona trabajo futuro
deje UNA línea en el máster con el enlace a su comentario. **Mientras eso no cambie, quien lea el
máster construye la versión vieja.**

**E · El camino de emisión: no se toca** (reglas 38 y 40). Con la puerta en el alta no hace falta.
Lo que sí queda: un comercio creado **antes** de la exclusión sigue teniendo como único freno el
flag (cicatriz de J5 del 13-oct). Por eso ③ va antes que encender nada.

| pieza | qué | carril (`node scripts/carriles.mjs de`, hoy) | coste | firma o decisión |
| --- | --- | --- | --- | --- |
| A | rechazo en `registerMerchant` + `--domicilio-fiscal` en la CLI | **J3** (`src/modules/auth/**`, `dos-equipos.md:126`) | pequeño, sin ALTER | fundador: Canarias por las dos vías o sólo por domicilio |
| B | rechazo del «Sí» foral en Ajustes | **J3** (contenedor `merchantAdmin.ts`, `:127`; `settingsView.js`, `:146`) | pequeño | firma de T2 |
| B′ | el país que se cambia en Ajustes | **J1** (`emission.service.ts`, `:117`) + **J3** | sin estimar | un jefe; es emisión (regla 40) |
| C | pregunta y T1 en `register.html` | **J3** (`:147`) | cuando se reabra el alta | firma de Q y T1 |
| D | regla 33, B2.6, Parte M + la línea de la regla 44 | **un jefe** (`:195`) | una línea por sitio | jefe |
| — | `schemas.ts`, por si B se hiciera en el esquema | **S1, equipo de Luis** (`src/core/**`, `:136`) | — | **evitarlo**: B cabe en `merchantAdmin.ts` |

### ⑤ Texto propuesto: PROPUESTA, sin aplicar (regla 39)

Condiciones que cumplen todas: **ningún claim fiscal** (ni «VeriFactu», ni «TicketBAI», ni
«factura»: regla 7, cero claims hasta SIF-1, aunque el máster viejo dijera «aviso TicketBAI»).
**Ninguna fecha ni promesa** («pronto», «en 2027»). Y **nada de «tu territorio no usa VeriFactu»**,
que en Canarias es falso (c.19355 §4 ①). «De momento» sale del literal del fundador: «por el
momento».

**Q · La pregunta del alta**
- **Q1 (recomendada):** la ya firmada «¿Tienes el domicilio fiscal en el País Vasco o en Navarra?»
  (SCRUM-1102 c.17709) más una nueva, «¿Tienes el domicilio fiscal en Canarias?». Dos sí/no, y
  sólo una pide firma.
- **Q2:** «¿Dónde tienes el domicilio fiscal?», con «En el País Vasco o en Navarra» · «En Canarias»
  · «En el resto de España». Una sola pregunta, pero los cuatro textos son nuevos.

**T1 · Quien queda fuera en el alta**
- **T1a (recomendada):** «De momento YaQu no está disponible si tienes el domicilio fiscal en el
  País Vasco, Navarra o Canarias.»
- **T1b:** «Lo sentimos: de momento YaQu no está disponible en el País Vasco, Navarra ni
  Canarias.» Más corta, pero habla de territorio y no de domicilio: el de Bilbao con domicilio en
  Burgos leería que no puede, y sí puede.
- **T1c:** T1a + «Si quieres que te avisemos cuando lo esté, escríbenos.» Es la opción (b) del
  enunciado (recoger el contacto). Promete un aviso y da por hecho que «lo estará». Sólo si el
  fundador quiere recoger contactos y dice adónde van.
- Si Canarias se excluye también por provincia (pieza A), T1a no basta para quien trabaja en
  Canarias con el domicilio fuera. Variante: «De momento YaQu no está disponible para trabajos en
  Canarias.»

**T2 · En Ajustes, al marcar «Sí» en la pregunta foral**
- **T2a (recomendada):** «De momento YaQu no está disponible con el domicilio fiscal en el País
  Vasco o en Navarra. No hemos guardado este cambio.»
- **T2b:** T2a + «Si de verdad lo tienes allí, escríbenos.» Sirve para enterarse de un comercio que
  ya está dentro, pero pide saber quién lee ese correo.

### Lo que NO se ha medido

- **Ninguna base** (③): ni dev, ni staging, ni producción.
- **Que las expresiones de Postgres casen como las de `node`**: lo cubre el positivo sembrado de la
  consulta 2, que no se ha corrido.
- **Qué dato decide en Canarias** (domicilio o lugar de los trabajos): asesor, SCRUM-1264.
- **La normativa foral** (TicketBAI, Batuz, Navarra), el Concierto y el Convenio: sigue sin medir
  por nadie, como decía c.19355.
- **Cambiar el país en Ajustes de punta a punta** (B′): esquema medido en SCRUM-1102, escritura y
  puerta leídas, nada ejecutado.
- **Nada en yaqu.app**: no hay pantalla de alta que ver (409) y Ajustes no se ha abierto.
- **Tests:** sólo se ha tocado este registro. Corridos 15 ficheros: los diez de registro
  (`scrum1294`, `267`, `273`, `237`, `976`, `921c`, `864c`, `1387`, `622`, `1536b`) y los cinco de
  árbol entero que nombra `guards:entrada` (`195`, `414`, `694`, `710b`, `737`): **125 = 125 pasan
  + 0 caen + 0 saltan**. `guards:entrada`: 15 de 15. La tanda completa, no. `dist/` construido con
  `tsc --noCheck` (sin él, `scrum622` daba dos `ERR_MODULE_NOT_FOUND`, que no son rojos).
- **Vistos en rojo antes de fiarse:** sin la línea `A9:`, `scrum1294` cae sobre este tramo
  (`:288`); sin el ancla, `scrum267` cae sobre él (3 casos). Fichero restaurado byte a byte las dos
  veces (`cmp`).

### De paso

- Este tramo empezó con `##`, como los dos de SCRUM-1536b, y así **`scrum267` no lo veía**: sólo
  corta entradas por `# SCRUM-<n>` o `# …APÉNDICE…` (`esEncabezadoDeEntrada`), y quitarle el ancla
  daba 14 de 14 en verde. Ahora va con `#`. Los dos tramos de 1536b siguen con `##`: llevan su ancla,
  pero el guard no la mira. No se han tocado porque son mediciones de otra sesión.

### Errores propios

- La primera llamada a Jira fue con el `cloudId` del nombre del repositorio, no con el del sitio.
  Falló con error y la repetí con el bueno; no dejó ningún dato.
- `arbol:mio` dio «CIEGO» la primera vez porque lo pasé con la HEAD desacoplada, antes de crear la
  rama. Lo repetí después de crearla y dio `MIO`, antes de la primera escritura.
