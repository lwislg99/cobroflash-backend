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

# SCRUM-1536f · B′: el país se cambia en Ajustes, y con él se salta el flag y la exclusión (MEDIDO; nada construido)

**Medido contra:** `origin/main` = `8ad167195af03cf4153337ccc1bf1b80d04c10f8` · 2026-10-22T09:40:24Z (hora de GitHub)

A9: aviso → A10 «Un laboratorio que le presta su entorno al sujeto mide la suma de los dos.» — no se pudo comprobar: la base en memoria de 1522e numera desde 1, el id 1 es el DEMO (regla 8) y mi segunda pasada midió «demo» en vez de lo preguntado; lo que queda es que `sonda-1536f.mjs` ocupa el id 1 con una fila de relleno y se declara CIEGA si un comercio suyo nace con él. Arreglarlo en el doble compartido cambia lo que miden otros tests.

22-oct-2026 · sesión `jv-j3x`, puesto J3, por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier.] Es el **B′** del diseño 1536c (c.20223 §④) que c.20225 dejó
«pendiente, se encarga aparte». Leídos en Jira: el ticket entero, sus 16 comentarios (c.19355 a
c.20235), y los 8 de SCRUM-1102. El encargo traía `main` = `fe65a8b7f`; medido aquí, `8ad167195`
(después entró `f02e48be2`, que no toca `src/`, `public/` ni `prisma/`). Hook de arranque: «SIN
IDENTIDAD» (SCRUM-1498); se siguió. **Encargo: MEDIR y PROPONER.** Sólo se escribe en `docs/master/`:
este tramo, `evidencias/SCRUM-1536/sonda-1536f.mjs` y su salida. Ni `src/`, ni `public/`, ni
`tests/`, ni el esquema, ni ningún texto de usuario. Lo que toca emisión, sólo se nombra.

## ① Ejecutado: el país se cambia, y se guarda

`sonda-1536f.mjs`, corrida dos veces: sobre `main` y sobre una copia (fuera de git) de la rama de
1536d de jv-j3w (`scrum-1536d-exclusion-territorial` @ `441e3f0af395135a235971231b4c87aedff7a696`,
sólo local). Las dos con `tsc --noCheck`. El alta, por `registerMerchant` de `dist/` (la consola
`altaDeMerchant` lo llama: leída, no lanzada); el cambio, por la RUTA `PUT /admin/merchant` de
`dist/app.js` por HTTP, con su `requireAuth` y su `requireRole('admin')`, que es la que llaman
Configuración › Empresa (`settingsView.js:373`, `:1171`) y el paso 1 del asistente
(`onboardingView.js:162-168`), los dos con un selector de seis países. Base: la de memoria de 1522e.

| petición | `main` | rama 1536d |
| --- | --- | --- |
| comercio ES (Madrid) → `country: 'MX'` | **200, guardado** | **200, guardado** |
| → `country: 'ZZ'` (no está en ningún selector) | **200, guardado** | **200, guardado** |
| → `country: 'ES'` (vuelta) | 200 | 200 |
| comercio nacido en MX → `country: 'ES'` | **200, guardado** | **200, guardado** |
| **control** · `country: 'ESP'` | 400 `validation_error` | 400 |
| **control** · alta ES Bizkaia con domicilio foral «sí» | se crea | **`territorio_excluido`** |
| **control** · alta ES Las Palmas, «no»/«no» | se crea | **`territorio_excluido`** |
| `domicilioFiscalForal: true` con el país ya en MX | 200 | **409** `territorio_excluido` |

La única regla del país es la del esquema de la ruta: `z.string().length(2)` (`schemas.ts:478`).
`updateMerchantProfile` lo escribe tal cual (`merchantAdmin.ts`, sin ninguna comprobación de
`country`). En la base, `country String` sin default (`schema.prisma:93`).

## ② Qué cambia después — con la fila tal como quedó guardada

Funciones de `dist/` llamadas con esa fila (NIF puesto a mano para las dos últimas). Flag por entorno.

| | ES (antes) | **ES → MX** (o `ZZ`) | **MX → ES** |
| --- | --- | --- | --- |
| `getEmissionMode`, flag OFF | `receipt` | **`fiscal`** | `receipt` |
| `getEmissionMode`, flag ON | `fiscal` | `fiscal` | `fiscal` |
| `getEmissionMode`, flag OFF **y** override del comercio `false` | `receipt` | **`fiscal`** | `receipt` |
| `isFlagEnabled('INVOICING_ES_ENABLED')`, flag ON | `true` | `false` | `true` |
| `modoDocumentoSuelto`, flag OFF | `no` | **`factura`** | `no` |
| `debeEstarEnLaCadena` (VeriFactu) | `true` | **`false`** | `true` |
| `estadoAlNacer` del sellado | `pendiente_de_sellado` | **`no_aplica`** | `pendiente_de_sellado` |
| `timezone` | `Europe/Madrid` | `Europe/Madrid` (no cambia) | **`null`** |
| `domicilioFiscalForal` (rama 1536d) | `false` | `false` | **sin escribir (NULL)** |
| idioma (`getLocale`) | EUR · IVA 21 % · Presupuesto | MXN · IVA 16 % · Cotización | EUR · IVA 21 % · Presupuesto |

Lo que eso significa, por separado (cicatriz ⑨ del prompt: declarado ≠ escrito ≠ alcanzable):

- **ES → otro país rompe la regla 24 y el «Done» de V0-0** (`YAQU_MASTER.md:1004`: «imposible
  emitir NINGÚN documento a un merchant ES real con el interruptor en OFF, e imposible cobrarle por
  YaQu»). `getEmissionMode` devuelve `fiscal` antes de mirar el flag (`emission.service.ts:37-38`),
  y es la puerta de documento **y** de cobro: la llaman 16 sitios, entre ellos el botón de pago
  (`quoteDecisionLanding.routes.ts:765`), los avisos de cobro (`lifecycle.service.ts:141, 164, 205`)
  y la numeración (`invoiceNumber.service.ts:448`). Ni el override por comercio lo para: el país se
  mira primero. **Y la factura que saldría no entra en la cadena VeriFactu** (`no_aplica`):
  numeración real, sin sello, para un negocio español. Alcanzable desde dos pantallas, con rol
  `admin`, y reversible (vuelve a ES y todo vuelve).
- **MX → ES se salta entera la exclusión de 1536d.** Fuera de España el alta no pregunta el
  domicilio (`territorioDeAlta.ts:64`, rama 1536d) ni la provincia; al pasar a ES en Ajustes queda un
  comercio español **sin las dos respuestas de Q1 y sin zona** (`timezone` NULL: el día contado en
  UTC, el defecto de SCRUM-1522e). Un domiciliado canario entra así: Canarias no tiene columna ni
  pregunta en Ajustes. El foral no puede marcar después el «Sí» (409, el B de 1536d sí vale con
  cualquier país), pero nunca se le preguntó.
- **Moneda: no cambia.** `defaultCurrency` es otra columna y el cambio de país no la escribe; el
  idioma sí (MXN, «Cotización»), así que un ES→MX queda con euros y vocabulario mexicano.
- **Plantillas de WhatsApp: no dependen del país.** De los 47 ficheros de `src/` que nombran
  `country` (`grep -rln`, comentarios incluidos), ninguno está en `src/integrations/` (0); el mismo
  barrido sí ve el bot, que sólo lo usa para el flag del perfil público (`botFlow.service.ts:259`).
  Leído, no ejecutado.

## ③ ¿Hay regla sobre cambiar el país? No. La que manda es la 24.

- **Máster:** ninguna línea dice si el país se puede cambiar. Barrido con `node` (no `grep`: con la
  tilde entre corchetes daba 0 líneas de «país», control incluido) sobre los 1.487 `.md` de `docs/`:
  278 líneas con «país» (control), 13 aciertos de las cuatro formas de «cambiar el país / país fijo
  / inmutable»; ninguno es una regla. Lo único que obliga es **V0-0 / regla 24**, arriba.
- **Jira:** seis formas de la frase («país se cambia», «se cambie el país», «cambiar de país»…) dan
  **2 tickets**, los dos ya leídos: SCRUM-1536 (este diseño) y **SCRUM-1102 c.17784**, donde J6f lo
  dejó como hallazgo el 1-oct: «el país se cambia desde Configuración […] y fuera de `ES` el modo es
  `fiscal` sin mirar el flag. […] No he encontrado ticket que lo nombre. Medido en el esquema; no
  ejecutado contra una base». **Lleva tres semanas sin dueño.** Control positivo: «forales y
  Canarias» da 4 tickets.

## ④ Propuesta, con su coste (decide un jefe)

| | qué | cierra ES→X | cierra MX→ES | coste |
| --- | --- | --- | --- | --- |
| **(a) recomendada** | el país **no se cambia después del alta** desde la app: la ruta rechaza un `country` distinto del guardado (error tipado antes del `update`, como `SerieError`), y las dos pantallas lo enseñan como texto | sí | sí | `merchantAdmin.ts` ~15 líneas · traducción a 409 en `app.ts` (bloque `// J3:`, como 1536d) · `settingsView.js` y `onboardingView.js` · 1 test por la ruta. **Sin esquema, sin emisión** |
| (b) | se puede cambiar, pero pasa por las comprobaciones del alta | **no**: el alta no comprueba nada fuera de ES; haría falta además «quien ya es ES no sale», que es (a) para ES | sí, si Ajustes pide provincia + Q1 al pasar a ES | (a) + una pantalla nueva con la provincia y las dos preguntas · textos nuevos |
| (c) | lista cerrada de países en la ruta | no | no | arregla sólo `ZZ`; `schemas.ts` es de S1 (equipo de Luis) |
| (d) | que la emisión no se fíe del país (p. ej. NIF español ⇒ ES) | sí | — | **camino de emisión: J1 + STOP (regla 40)**. No lo recomiendo: es el arreglo caro de lo que (a) impide en la puerta |

**Por qué (a):** es la única que cierra las dos direcciones sin tocar emisión ni esquema; el alta
pública está cerrada (SCRUM-1515), así que hoy el país lo pone el equipo con la consola y un error
se corrige por el mismo camino; y en producción no hay comercios reales que lo necesiten (c.20225:
0 forales/canarios; el recuento por país **no** está medido, abajo). **Lo que (a) NO decide:** cómo
se corrige un país mal puesto. Hoy no hay herramienta: sería una orden de consola nueva (J3) o un
cambio a mano en la base (STOP: datos de clientes).

**Texto (regla 39) — PROPUESTA, nada aplicado:**

- **Pantallas:** el país se enseña como texto con lo que ya dicen: la etiqueta «País» y el nombre
  del selector («España», «México»…). Sin texto nuevo, y sin un campo que parezca editable y no lo
  sea (A10: «Si parece un campo y no se puede escribir, la pantalla ha mentido.»).
- **La ruta, si alguien manda otro país** (sólo se alcanza saltándose la pantalla):
  **P1 (propuesta):** «El país no se puede cambiar una vez creada la cuenta. Escríbenos por WhatsApp
  y lo vemos contigo.» La segunda frase es la ya firmada de `MSG_SERIE_YA_EMITIDA`
  (`merchantAdmin.ts`, 5-ago); la primera es nueva y **necesita firma**. Alternativa sin texto: el
  409 con el código y la pantalla con su aviso genérico.

## ⑤ De quién es cada pieza (`node scripts/carriles.mjs de`, hoy)

| pieza | fichero | carril |
| --- | --- | --- |
| rechazar el cambio en la ruta | `src/modules/system/merchantAdmin.ts` | **J3** (contenedor) |
| traducir el error a 409 | `src/app.ts` | **S1** (contenedor) → bloque `// J3:` |
| el país como texto en Empresa | `public/dashboard/js/settingsView.js` | **J3** (contenedor; Empresa es lo general) |
| el país como texto en el asistente | `public/dashboard/js/onboardingView.js` | **J3** |
| (c) lista cerrada | `src/core/validation/schemas.ts` | **S1**, equipo de Luis |
| (d) la puerta del modo | `src/modules/invoicing/domain/emission.service.ts` | **J1**, camino de emisión (regla 40) |
| el país de la cuenta de Stripe Connect (`connect.routes.ts:49`) | `src/modules/payments/connect/` | **J2** — no medido qué pasa si cambia después de conectar |
| el flag por país (`flags.ts:72-75`) | `src/core/flags.ts` | **S1** — no hace falta tocarlo con (a) |

Con (a), **todo es de J3** salvo el bloque en `app.ts`, que va marcado como hizo 1536d.

## Población — NO medida

Este árbol no tiene claves de base y no las he buscado. La consulta, de sólo lectura y sin datos
personales, para quien las tenga: `SELECT country, count(*) FROM merchants GROUP BY country ORDER BY
2 DESC;`. Si sale algún país distinto de `ES` con NIF español, es exactamente el caso de ②.

## Lo que NO se ha medido

Ninguna base · Postgres (el doble no sabe de tipos) · una factura emitida de verdad tras el cambio
(pide base: de la emisión sólo se llamaron sus puertas puras) · las pantallas en un navegador ni en
yaqu.app (lo de `settingsView.js` y `onboardingView.js` está leído) · Stripe Connect tras el cambio ·
la consola `altaDeMerchant` lanzada (se llamó la función que usa) · la tanda completa.

## Errores propios

- **Primera pasada, CIEGA:** la sonda tapaba toda la tabla `authSession` para dar la sesión, y el
  alta la usa para su enlace; ningún comercio se creó. Lo dijo la propia salida (`creado: false`).
- **Segunda pasada, midiendo otra cosa:** el comercio ES salió `demo` con el flag apagado. Era el id 1
  del doble (el DEMO, regla 8), no el país. Es el `A9:` de este tramo.
- **Un `grep` con `pa[ií]s` dio 0** sobre el máster, control incluido: la tilde entre corchetes, que
  A10 ya tiene escrita. Lo cazó el control a cero; se rehízo en `node`.
- Mi primera búsqueda en Jira usaba frases que **no casaban ni con c.20223**, que sé que habla de
  esto; con ese positivo delante cambié las frases.
# SCRUM-1536d · Forales y Canarias fuera del alta y del «Sí» foral en Ajustes, con los textos firmados (CONSTRUIDO)

**Medido contra:** `origin/main` = `595884b20b8baa3fad91151879214554b9f6e2e2` · 2026-10-22T09:39:30Z (hora de GitHub)

A9: aviso → cicatriz J3 «Medí al acabar el arranque (152.817) y no volví a medirme hasta 329.079, con el código ya hecho: el aviso de 200k no llegó.» — no se pudo comprobar: cuándo se mide una sesión no lo ve ningún test del árbol.

**Skill UI:** cargada (`yaqu-premium-ui`; el cambio de pantalla es sólo qué texto pinta el aviso de error que ya existía).

22-oct-2026 · sesión `jv-j3w`, puesto J3, por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier.] Lo desbloquean **SCRUM-1536 c.20218** (forales y Canarias
fuera de YaQu por ahora), **c.20223** (diseño, tramo 1536c de arriba) y **c.20225** (Canarias por
las dos vías, «Ok las 2»; Q1, T1a, su variante y T2a firmadas, «Ok firmo todas»). Entrega completa
en Jira, **c.20235**. Carril J3 a mano; el hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498).

### Lo construido

- **A · alta.** `src/modules/auth/domain/territorioDeAlta.ts`, llamada por `registerMerchant` justo
  después de `zonaDeAlta` y antes del `create`. Con España, las dos respuestas Q1 son obligatorias
  (`domicilio_fiscal_required`); foral o Canarias «sí» → `territorio_excluido` (motivo `domicilio`,
  T1a); zona `Atlantic/Canary` → `territorio_excluido` (motivo `trabajo`, su variante). Con «no» y
  «no» se guarda `domicilioFiscalForal = false` en la columna que ya existía: **sin ALTER**. Fuera de
  España no se pregunta. La consola gana `--domicilio-foral` y `--domicilio-canarias` (`si|no`).
- **B · Ajustes.** `updateMerchantProfile` lanza `TerritorioError` con el «Sí» foral antes de leer o
  escribir nada; `PUT /admin/merchant` da 409 con T2a (bloque `// J3:` en `src/app.ts`, contenedor de
  S1: sin él salía un 500); `settingsView.js` pinta el texto sin «Error al guardar:».
- **C · `register.html`: no aplica hoy** (la ruta da 409). Q1b, firmada, queda en `APARCADOS` de
  `tests/scrum514-aprobado-y-aplicado.test.mjs`. **E, B′ y `schemas.ts`: sin tocar.**
- Ficha: `docs/microcopy/2026-10-22-SCRUM-1536-exclusion-territorial.md`.

### Medido

- `tests/scrum1536d-forales-y-canarias-fuera.test.mjs`: **4 de 4**, por la consola real y por la
  ruta real (detalle en c.20235). Tres mutaciones declaradas en `MUTACIONES_QUE_ME_TUMBAN` (el
  meta-guard las lee, visto con `--solo-censo`): **3 de 3 VIVAS**, árbol restaurado idéntico.
- Mini-tanda de los 248 ficheros que leen lo tocado: **2.058 = 1.979 + 9 + 70**. Arreglados los 4
  míos (1102f, 411, 514, 709); los 6 ficheros afectados, después: **88 de 88**. Dos de `scrum1199`
  caen por entorno (`express` no está en este árbol); no medido sobre `main`.
- Tests que la decisión invierte, cambiados y dicho por qué: `scrum1522e`, `scrum1515`, `scrum1102f`.

### No medido

`scrum1515` (pide `LIBRO_PG_URL`; lo corre el CI) · la tanda completa · el obligatorio · yaqu.app ·
`tsc` con tipos: 17 errores del cliente de Prisma compartido, ninguno en lo tocado.

### Errores propios

- Crucé 200k sin avisar (la línea `A9:`).
- La ficha nombraba otra ficha por su fichero y `scrum709` lo cazó.
- Declaré las mutaciones con campos que el meta-guard no lee; lo vi en su contrato antes del commit.
# SCRUM-1536e · La línea firmada de la regla 44 entra al final de la regla 33 del máster

**Medido contra:** `origin/main` = `595884b20b8baa3fad91151879214554b9f6e2e2` · 2026-10-22T09:33:37Z (hora de GitHub)

A9: sin fallo que generalice — el texto se copió del ADF de c.20229 y se comparó por bytes con lo escrito (422 = 422, con un control mutado que sí difiere); el único tropiezo, el orden de la medición de contexto (abajo), ya lo cubre la ficha del orquestador, que dice «en ese punto exacto».

22-oct-2026 · **J5** (sesión `jv-j5p`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier. Leído en Jira: SCRUM-1536 entero, 14 comentarios, hasta c.20229.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
del día. Etiquetas leídas en SCRUM-1536: `area-fiscal`, `equipo-javier`; estado En curso.
`docs/YAQU_MASTER.md` es carril de un jefe (`dos-equipos.md:195`): el jefe firmó y esta sesión lo aplica,
como se aplicaron las reglas 43 y 44 (SCRUM-1552, `165f116f0`).

## Qué es esto

Rama puesta al día con `git merge origin/main` tras entrar #2658 (1536c), que va justo encima. Encabezado con `#` y no con `##`, porque el tramo 1536c midió que `scrum267` no ve los de `##`.

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

## Cómo se copió el texto

Del cuerpo ADF de c.20229 (no del markdown, ni de la ficha del orquestador): el único `blockquote` del
comentario, con sus dos negritas. Se escribe sin el `>` de cita, porque va dentro del párrafo de la
regla. Comparación: lo escrito, quitándole los `**`, es igual al texto del ADF (422 B = 422 B); el mismo
comparador con una tilde quitada («tambien») da distinto. Las negritas, en los mismos dos tramos que en
el ADF.

## Lo que NO se ha medido

- No se ha mirado si algún texto de usuario, guard o documento fuera de `tests/` repite el «facturación
  ES off + aviso TicketBAI» de la regla 33: el encargo era sólo la línea.
- El obligatorio de esta rama: se lee después del empujón y va en la entrega, no aquí.
- Visto en yaqu.app: NO HECHO → no hay pantalla; es el máster.

## Errores propios

- La ficha pedía medir el contexto al acabar la lectura de arranque y otra vez al acabar Jira. Leí Jira
  primero y el arranque después, así que sólo hay un punto: **130.145** al terminar las dos.
# SCRUM-1536g · B′ (a): el país no se cambia después del alta (CONSTRUIDO)

**Medido contra:** `origin/main` = `0077bd1d51a7cb64b1c18d85781117b71936fd38` · 2026-10-22T09:56:47Z (hora de GitHub)

A9: aviso → cicatriz J3 «Medí al acabar el arranque (152.817) y no volví a medirme hasta 329.079, con el código ya hecho: el aviso de 200k no llegó.» — no se pudo comprobar: me pasó otra vez (102.598 → 239.064), y cuándo se mide una sesión no lo ve ningún test del árbol; el defecto del producto sí queda atado por `tests/scrum1536g-el-pais-no-se-cambia.test.mjs`.

**Skill UI:** cargada (`yaqu-premium-ui`; el cambio de pantalla es quitar dos selectores y enseñar el país como texto, sin texto nuevo).

22-oct-2026 · sesión `jv-j3z`, puesto J3, por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier.] Lo desbloquea **SCRUM-1536 c.20245** (opción (a), «Sí de
momento la A»; texto firmado, «Ok me parece bien»), sobre la medición de 1536f (tramo de arriba,
c.20242). Entrega en Jira, **c.20279**. Carril J3 a mano, con el bloque `// J3:` en `src/app.ts`
(contenedor de S1). El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498). Medido sobre ese `main`
MÁS la rama de 1536d (`bc62de1f8e73aaa47617df6242eed5ea3b7766e7`), mergeada en local porque #2674
seguía abierto: la exclusión de 1536d y este cambio tocan los mismos tres ficheros.

### Lo construido

- **Regla.** `src/modules/system/merchantAdmin.ts`: `PaisError` y `MSG_PAIS_NO_CAMBIABLE`.
  `updateMerchantProfile` lee el país guardado y, si el cuerpo trae otro, lanza ANTES de escribir
  nada. El mismo país pasa (Empresa lo mandaba en cada guardado). Una fila sin país pasa: la columna
  es NOT NULL (`prisma/schema.prisma:102`) y no ocurre en la base; ocurre en los bancos de ida y
  vuelta de `scrum1227` y `scrum1269`, que caían con la primera versión.
- **Ruta.** `src/app.ts`, bloque `// J3: SCRUM-1536g`: `PaisError` → 409
  `{ error: 'pais_no_cambiable', message }`. Sin él, 500.
- **Pantallas.** Empresa (`settingsView.js`) y el paso 1 del asistente (`onboardingView.js`): el
  selector pasa a `<output>` con el nombre del país (o su código si no está en la lista) y ninguna
  manda ya `country`. El `.name = "country"` se queda en el `<output>` para el censo de SCRUM-284. Se
  quita la nota «Cambia el idioma de los documentos…», que describía un cambio que ya no existe.
- **Texto.** Copiado de c.20242 y comparado por bytes con c.20242 y c.20245 (99 B; el control sin
  tilde no casa en ninguno). Ficha: `docs/microcopy/2026-10-22-SCRUM-1536-pais-no-se-cambia.md`.
- **Ni emisión ni esquema.** Un comercio nacido fuera de España sigue en su país y con su modo de
  emisión de siempre: esto sólo impide CAMBIARLO.
- **De paso:** el comentario de `SerieError` había quedado separado de su clase al entrar
  `TerritorioError` (1536d); vuelve a estar encima de ella.

### Medido

- Sonda de jv-j3x (`sonda-1536f.mjs`) sobre el `dist/` de antes y de después:
  `salida-sonda-1536g-antes.txt` y `salida-sonda-1536g-despues.txt` (resumen con
  `resumen-sonda-1536g.cjs`). ES→`MX`, ES→`ZZ` y MX→`ES`: **200 → 409**; el comercio español sigue
  ES y en `receipt` con el flag apagado. Controles: el mismo país, 200; `ESP`, 400.
- `tests/scrum1536g-el-pais-no-se-cambia.test.mjs`: **3 de 3**, por la ruta real con su sesión.
  Contra el `dist/` de antes salía CIEGO (no existía la constante), no rojo: el rojo de comportamiento
  lo dan la sonda y las mutaciones.
- Mutaciones (`mutar-1536g.mjs`, lee las declaradas con el lector del meta-guard; salida en
  `salida-mutar-1536g.txt`): base 3/3, **2 de 2 VIVAS**, árbol restaurado con 3/3.
- Mini-tanda de 205 ficheros (los que leen las dos pantallas, `merchantAdmin`, `app.ts`, la
  microcopia o el mapa de submenús, más los guards de registro): **1.846 = 1.838 + 2 + 6**. Los 2 son
  `scrum1199`, que pide `express` en `node_modules` de este árbol (no lo tiene); no medido sobre `main`.
- Con el registro escrito, los 312 ficheros que leen `docs/master`, evidencias, microcopia o
  cicatrices: **2.937 = 2.900 + 8 + 29**. De entorno (este árbol no tiene `node_modules` propio):
  `scrum1199` ×2, `scrum475` ×3, `scrum476`. Míos: `scrum553` (un extractor de mi test con el `>`
  pegado; arreglado en el test) y `scrum713c`, el trinquete de estilos en JS, que BAJA de 335 a 334
  porque la nota quitada se pintaba con `style.cssText`: el techo se aprieta a 334, como pide el
  propio guard, con su línea de historia. Después, los 8 afectados (553, 713c, 1363, 1536g, 267,
  1294, 514 ×2): **86 de 86**.

### No medido

yaqu.app · las pantallas en un navegador · Postgres · la tanda completa · el obligatorio (el empujón
lo hace el orquestador cuando entre #2674) · `tsc` con tipos · el 335 de `scrum713c` sin este
cambio (no recontado: es el techo que había).

### Errores propios

- Crucé 200k sin avisar en el momento: 102.598 al acabar Jira y arranque, 239.064 al avisar.
- Mi primer instrumento de mutación salió CIEGO: importaba el test en el proceso padre y el hijo
  heredaba `NODE_TEST_CONTEXT` (0 verdes en la base). Lo cazó la fila BASE, antes de creer nada.
- Mi test cargaba `merchantAdmin.js` antes que el doble de base y se quedaba con el Prisma real.

# SCRUM-1536h · Qué queda del ticket el 24-oct: la pieza C y el «visto en yaqu.app» (MEDIDO; nada construido)

**Medido contra:** `origin/main` = `9eb740a4286ee02faedd071dddfab55ddae0d515` · 2026-10-24T15:59:44Z (hora de GitHub)

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: `gh pr list --search 1536` me devolvió 4 PR del ticket y no #2658, #2661 ni #2674, que están mergeados (lo vio `git log origin/main --grep`); si me hubiera fiado de `gh`, habría dado la exclusión por no mergeada. Qué indexa la búsqueda de GitHub no lo ve ningún test del árbol.

Sesión `jv-j3bh` (J3), equipo de Javier. Encargo del orquestador (`cobroflash-backend-95`): **SOLO
MEDIR Y PREGUNTAR.** Nada en `src/`, `public/`, `tests/` ni esquema; ningún texto aplicado.

### ① Hecho y en `main` (cruce de `git log origin/main --grep=SCRUM-1536`, `ls-remote` y `gh`)

| pieza | PR · merge | qué |
|---|---|---|
| medición + guiones | #2377 `1a6cf221f` · #2410 `f9f5810ef` | ya estaba decidido; Canarias dentro del RD 1007/2023 |
| 1536c diseño | #2658 `595884b20` | dónde, con qué dato, textos propuestos |
| 1536e máster | #2661 `63ad68347` | línea firmada c.20229 al final de la regla 33 |
| 1536d A + B | #2674 `334a10c74` | `territorioDeAlta.ts`, llamada en `auth.service.ts:350`; «Sí» foral en Ajustes → 409 T2a |
| 1536f/g B′ (a) | #2686 `6d8399f54` | el país no se cambia después del alta |

`git ls-remote origin 'refs/heads/scrum-1536*'`: vacío (ninguna rama viva). Producción:
`https://yaqu.app/health` → `version` = `9eb740a4286ee02faedd071dddfab55ddae0d515` (cabecera `Date:`
15:58:28Z), el mismo sha que `main`: lo de arriba está desplegado.

### ② Lo que sigue vivo

**C · `public/register.html` (carril J3, `carriles.mjs de`).** No aplica mientras el alta esté
cerrada: `auth.routes.ts:31-50` contesta siempre 409 `registration_closed` (SCRUM-1515, Finalizada) y
no lee el cuerpo. La pregunta «¿Tienes el domicilio fiscal en Canarias?» está aparcada con su motivo
en `tests/scrum514-aprobado-y-aplicado.test.mjs:342-349`. **Ticket propio: no tiene.** Ni hay ticket
abierto que reabra el alta: la búsqueda JQL (`register.html`, «reabrir el alta», «alta pública»)
dio 13 abiertos, ninguno lo es; control positivo: SCRUM-1536 sale en la misma búsqueda.

**Qué ata hoy la pieza C a quien reabra el alta, leído en el código (no ejecutado):**
`territorioDeAlta('ES', zona, {})` lanza `domicilio_fiscal_required` (`territorioDeAlta.ts:68`) y
`registerMerchant` la llama siempre antes del `create` (`auth.service.ts:350`). Reabrir la ruta sin
la pregunta deja a todo comercio de España sin alta, en ruidoso, no en silencio. Lo que NO ata: que
quien la reabra mande las dos respuestas fijas en `false` desde la ruta; eso no lo para nada.

**Visto en yaqu.app.** Las dos pantallas tocadas se sirven idénticas a `main`, byte a byte:
`/dashboard/js/settingsView.js` (107.223 B) y `/dashboard/js/onboardingView.js` (28.118 B), `cmp`
igual; dentro, `territorio_excluido` / `pais_no_cambiable` / `<output` aparecen 2 y 1 veces;
control a cero con una cadena inventada: 0. **El comportamiento en pantalla no lo he intentado**:
pide una sesión de administrador y esta sesión no tiene credenciales ni las busca.

### ③ Lo que el ticket da por cierto y ya no lo es

- El título y el enunciado («seis de las 52 provincias que ofrece el alta… y uno de los literales les
  da la bienvenida»; la opción (c) «lo que hace el código de `main` ahora mismo»): **ya no.** La
  provincia canaria rechaza con `territorio_excluido`, motivo `trabajo`, y lo foral va por domicilio.
- El literal 4 de SCRUM-1522 («Usaremos la hora de Canarias, una menos que en la Península.») vive
  sólo en `docs/master/SCRUM-1522.md:533` y en Jira; en `src/`, `public/` y `docs/microcopy/`: 0. Con
  la exclusión ya **no tiene a quién decírselo**: al elegir Las Palmas o Santa Cruz de Tenerife lo
  que toca es «De momento YaQu no está disponible para trabajos en Canarias.» (c.20225).
- SCRUM-998 (`area-j3`, En curso) guarda «NO se hace nada hoy» (c.16609, 23-sep): lo supera c.20218.

### ④ Preguntas para el fundador (✅/❌), en el comentario de Jira de esta tanda

P1 cerrar 1536 sin C · P2 ticket propio para C · P3 retirar el literal 4 de 1522 · P4 dar 998 por
superado. Recomendación y quién lo haría, en el comentario.

### No medido

Ninguna base · ninguna pantalla con sesión · la ruta reabierta (es lectura de código) · la tanda
(no hay código tocado) · el obligatorio de este empujón al escribir esto.

### Errores propios

- El de la línea A9: la búsqueda de `gh` por número no devolvió tres PR mergeados del ticket.
- Hook de arranque: «SIN IDENTIDAD» (SCRUM-1498); seguí con el puesto del encargo.
