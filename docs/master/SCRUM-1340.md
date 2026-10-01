# SCRUM-1340 · El guard de la skill pregunta al cambio si toca la interfaz, no al registro

**Medido contra:** `origin/main` = `761db44f2f18bc69e55047ebc2e26e55d6d1c89d` · 2026-10-01T07:15:05Z

A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`

Sesión J5e (relevo de J5d), por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`).
El censo (Ⓒ) y la lista (Ⓕ) se midieron sobre `eb3d3b367e62e95ca86c217a0a39a32764200075`, que era
`origin/main` al crear la rama (comentario 17804 de Jira, 06:49:34Z). El ancla de arriba es la de después
de mezclar `main` en la rama; lo que se volvió a correr sobre ella está en Ⓛ.

## Ⓐ Cruce de carril, y qué ficheros se tocan

El ticket lleva `area-j4`. La excepción, literal del orquestador en el encargo (1-oct-2026, también en el
comentario 17804):

> CRUCE DE CARRIL DECLARADO: el ticket lleva `area-j4` y te lo doy a ti. J4d está terminando SCRUM-1317
> con el turno de suite y no puede. Los ficheros no se solapan.

| fichero | qué se le hace | de quién era |
|---|---|---|
| `tests/scrum811c-skill-ui-declarada.test.mjs` | lo de SCRUM-811 queda intacto; se le AÑADE la vía del efecto | el test de SCRUM-811 (equipo de Luis, 22-sep) |
| `tests/_skill-ui-por-efecto.mjs` | nuevo: el motor | de este ticket |
| `tests/fixtures/scrum1340/SCRUM-1317-primera-version.md` | nuevo: el rojo real | de este ticket |
| `docs/master/README.md` | 4 líneas cambiadas EN SITIO (numstat 4/4) en «El campo `Skill UI`» | formato del registro, común |
| `docs/master/evidencias/scrum1340/` | nuevo: instrumentos y salidas | de este ticket |

**Lo que NO toco y queda desfasado, declarado:** `scripts/guards-entrada.mjs` (carril S0) dice de este
guard «sin git, sin DB: añade ~0,3 s», y desde este PR llama a git y tarda unos 4 s. Y `docs/equipo/
sesion-2.md` y `sesion-4.md` (de sus puestos) describen el criterio viejo en sus líneas 6-7. Reportado
al orquestador con el texto propuesto; no son míos.

No se toca `src/`, `public/`, el esquema, ningún workflow ni ningún registro ya mergeado.

## Ⓑ PASO 0 — el defecto ocurre hoy, CORRIENDO, y el rojo que ya existía

Antes de escribir nada: 0 ramas remotas y 0 PR de 1340 (control positivo: 106 ramas `scrum-` vivas), 0
commits en `main` que lo nombren.

**El rojo primero, con el fichero REAL** (`evidencias/scrum1340/rojo-1317.mjs` y su salida). La primera
versión de `docs/master/SCRUM-1317.md` es `git show 56792052:docs/master/SCRUM-1317.md`: 11.070 caracteres,
una entrada, sin campo de fecha y con `homeView.js` y `app.js` sin prefijo. Esa rama cambiaba cinco
ficheros bajo `public/dashboard/js/`. Pasada por el guard tal como estaba en `main`:

| texto | nombra ruta `public/` | fecha leída | «sin declarar» |
|---|---|---|---|
| la v1 real | no | ninguna | **0 — pasa** |
| la v1 + ruta con prefijo + campo de fecha | sí | 2026-10-01 | 1 — la acusa |
| la v1 + sólo la ruta con prefijo | sí | ninguna | 0 — pasa |
| la v1 + sólo el campo de fecha | no | 2026-10-01 | 0 — pasa |

**Cada mitad basta para eximir.** Ese fichero va como fixture, byte a byte (sha256 comprobado contra el
`git show`), y el guard lo lleva como caso permanente.

## Ⓒ El ① — el tamaño del agujero, que nadie había medido

**La pregunta no se le hace al registro.** Preguntarle al registro si toca interfaz es lo que hacía el
guard, y por eso eximía. Se le pregunta al MERGE: cada commit de la cadena de primer padre de `main`
posterior al corte, y lo que cambió contra su primer padre. Si cambió algún `public/**.{js,css,html}`
y algún `docs/master/SCRUM-<n>.md`, las entradas de hoy cuyo título añadió ese merge son suyas.

Población: 907 registros · 1.384 entradas · 361 merges de primer padre tras el corte (3 con un solo
padre) · **101 cambian interfaz** · los 101 traen registro · 0 sin atribuir.

| | PR de interfaz | lo mira el guard | exentos | exentos que declaran | exentos que NO declaran |
|---|---|---|---|---|---|
| por PR | 101 | **5** | **96** | 22 | **74** |

Por entrada (92 entradas de interfaz por efecto; 87 exentas): «sin ruta `public/` y sin fecha» 52 ·
«sin fecha» 30 · «sin ruta `public/`» 3 · «fecha escrita en o antes del corte» 2. De las 87, 72 nacen en
el merge y 15 sólo las toca: por eso la cuenta buena es la de PR.

Por día de merge, los que no declaran: 23-sep 1 · 24-sep 2 · 25-sep 3 · 26-sep 2 · 27-sep 3 · 28-sep 29 ·
29-sep 25 · 30-sep 5 · 1-oct 4, que suman 74 (sale de `evidencias/scrum1340/censo-exentas-salida.txt`, campo
`noDeclaranPorDia`).

**La sonda independiente, sin git** (lo que hacía el guard): 360 entradas nombran una ruta `public/` · 193
sin campo de fecha · 158 con fecha en o antes del corte · **9 las mira, y las 9 declaran** — por eso salía
verde. En todo el árbol exigía a 9 entradas de 1.384. Cruce de conjuntos: de esas 9, 4 no las ve la sonda
por efecto (tres apéndices de SCRUM-1016 «sin aplicar» y SCRUM-1196: nombran la ruta en prosa sin que su
PR la cambiara). Es el falso positivo que SCRUM-811 aceptó a propósito, y se conserva.

**Dos instrumentos, el mismo conjunto.** El censo (`censo-exentas.mjs`) y el motor del guard
(`_skill-ui-por-efecto.mjs`, vía `derivar.mjs`) son dos implementaciones distintas de la misma pregunta:
74 y 74, con 0 sólo en uno y 0 sólo en el otro.

**El instrumento, comprobado a mano** en cinco registros (1234, 1285, 1205, 1287, 1272: 0 líneas con el
campo de fecha, 0 con `Skill UI`, nombres sin prefijo) y un merge (`3700de42`: cambia `api.js`,
`parteOficinaView.js` y `quotesDetailView.js` bajo `public/dashboard/js/`, y su registro los nombra sin
prefijo).

## Ⓓ Lo que explica el tamaño: el campo de fecha se abandonó, y hay un día

El guard esperaba `**Fecha:** d-mmm-aaaa`. 445 de los 907 registros lo llevan (589 apariciones): existió.
Por día del ancla de cada entrada (`fecha-por-dia.mjs`; 1.326 entradas con ancla, 58 sin ella):

| día del ancla | entradas | con el campo |
|---|---|---|
| 22-sep | 63 | 27 (43 %) |
| 23-sep | 46 | 25 (54 %) |
| 25-sep | 24 | 7 (29 %) |
| 26-sep | 23 | 6 (26 %) |
| **27-sep** | 23 | **0** |
| 28-sep | 71 | 2 (3 %) |
| 29-sep | 31 | 1 (3 %) |
| 30-sep | 12 | 0 |
| 1-oct | 33 | 0 |

Nunca fue universal (entre el 26 % y el 55 % la mayoría de los días), y **desde el 27-sep son 3 de 170**.
Ese día es un segundo corte que nadie declaró: la cobertura del guard se desplomó sin que nada se
pusiera rojo.

**Lo que hay al lado, y lo que NO he demostrado.** El 26-sep a las 12:49Z entró #1809 (SCRUM-1152), el
generador `scripts/equipo/ancla.mjs`, que imprime la línea del ancla lista para pegar — sola, sin el
campo de fecha que el README pone en la línea de encima. Coincide en el día. **No he comprobado que sea
la causa**: no he medido qué registros usaron el generador, y el descenso ya venía de antes (29 % y 26 %
el 25 y el 26). Lo que sí está medido es que el README sigue pidiendo el campo (línea 48) y ningún guard
lo exige.

## Ⓔ Lo que cambia

`tests/_skill-ui-por-efecto.mjs` (el motor) y la segunda mitad de `tests/scrum811c-…test.mjs` (el guard).

- **Unidad = un PR.** En `main`, cada commit de primer padre posterior al corte. En una rama, y en CI
  (donde HEAD es el commit de mezcla), lo que va de la base de la rama al disco, incluido lo que aún no
  está rastreado. La base la da `baseDeLaRama`, el motor que ya existía (SCRUM-533/723): no hay un
  segundo `merge-base`.
- **Aplicabilidad por efecto.** La unidad cambió un `public/**.{js,css,html}` → es de interfaz. No hay
  lista de nombres de ficheros, ni se lee ninguna fecha del registro: la fecha es la del commit.
- **A quién se le pide.** A las entradas que la unidad ESCRIBIÓ: las de hoy cuyo título añadió (nacidas);
  si no estrenó ninguna, las que conservan alguna línea larga (≥ 30) de las que añadió (tocadas). Basta
  con que declare una: la unidad es el PR.
- **Cuatro veredictos**, y ninguno es «no la miré»: `NO_ES_INTERFAZ`, `DECLARA`, `SIN_DECLARAR`, `NO_SE`.
  Los dos últimos caen. `NO_SE` es interfaz cambiada sin registro, o con registro del que no queda ninguna
  línea en una entrada de hoy.
- **Lo de SCRUM-811 se conserva, literal y en unión**: sus funciones y sus tres tests no se han tocado, así
  que lo que se medía se sigue midiendo (las 9).
- **La línea que sale siempre**, también con cero:
  `[SCRUM-1340] exigí la skill a N de M registros de interfaz … · declaran D · heredados sin declarar K
  (lista cerrada: nació con 74, sólo encoge) · sin declarar y fuera de la lista X · no sé clasificar Y ·
  lo de esta rama: …`. Y una segunda con lo que la vía del texto mira y lo que no. Hoy:
  «exigí la skill a 101 de 101 · declaran 27 · heredados sin declarar 74 · … 0 · … 0».

## Ⓕ Los 74, y por qué no es una escapatoria

Arreglado el criterio, 74 PR ya mergeados —de los dos equipos— quedan sin declarar. El ticket prohíbe
reescribirlos y prohíbe sacarlos del conjunto. Van en `HEREDADAS`, uno por línea, por el sha de su merge
(identidad que no se mueve), y **siguen contando en la M**.

Decisión del orquestador (1-oct-2026): lista cerrada aprobada, **como cicatriz permanente**; si los 74 se
declaran a posteriori lo decide el fundador, y entonces la lista encoge sola. Un segundo corte por fecha
quedó rechazado: perdona sin nombrar.

**La lista sólo puede encoger, y lo hace cumplir el código:**

- un sha POSTERIOR al techo (`eb3d3b36…`, por posición en la cadena de primer padre) no puede entrar;
- no puede tener más de las 74 entradas con las que nació;
- una heredada que pasa a declarar hace CAER el guard hasta que se quite de la lista;
- un sha que no está en la cadena, o repetido, también cae.

21 de los 74 son PR que no estrenaron entrada y se atribuyen por líneas tocadas; van marcados en la lista.

## Ⓖ Los límites, dichos

1. **El guard llama a git**: dos `git log` sobre la cadena de primer padre y un `git diff`. Medido aquí:
   0,13 s (nombres de 361 merges) + 1,12 s (parches de `docs/master`, 5,0 MB). **Crece con cada merge desde
   el corte y no tiene techo.** Más un repositorio temporal para la prueba de punta a punta (~2,8 s).
2. **En un clon somero no puede medir, y CAE diciendo CIEGO.** El job obligatorio («build + tests») trae
   `fetch-depth: 0` y la referencia de main (`ci.yml` 147 y 158), igual que navegador, meta-guard y vigía.
   El «trinquete de zona» (`ci.yml` 870) clona desnudo: ahí este guard caerá, en las dos zonas por igual,
   como ya cae `scrum723`. **Es un rojo que existirá en un job que nadie lee.** No toco el workflow.
3. **PR en vuelo al entrar esto.** Un PR de interfaz sin declarar cuyo CI corrió antes de que este guard
   esté en `main`, y que mergee después, dejará `main` en rojo nombrando ese merge. No puede entrar en la
   lista. Se arregla declarando en su registro.
4. **Editar después un registro mergeado** hasta que no quede ninguna línea de su PR lo convierte en
   `NO_SE`, y cae. Es deliberado.
5. **La vía del texto sigue sin exigir a quien no escribe fecha**: 16 entradas nacidas tras el corte
   nombran una ruta `public/` en prosa, su PR no cambió `public/`, y no declaran (lista en
   `derivar-salida.txt`, líneas `TEXTO`). No se les exige porque el efecto dice que no tocaron interfaz —
   una exención con motivo medido, no por falta de datos. Si se quiere lo contrario, son 16 heredadas más.
6. **«Interfaz» es la extensión, no lo visual**: un `.js` de `public/` sin nada que se vea cuenta igual.
   Para eso existe `no cargada · <motivo>`.
7. **Que la línea de la cuenta se IMPRIME** no lo fija ningún test: los tests fijan lo que dice
   `lineaDeCuenta`, no que el guard la llame (sin proceso hijo: SCRUM-1308).
8. No medido: el reparto de los 74 por equipo; las 15 entradas «sólo tocadas» una a una; la causa de Ⓓ.

## Ⓗ Mutación

`evidencias/scrum1340/mutar.mjs` (traza y JSON al lado). Base 27/27 antes y después; árbol intacto por
sha256 tras cada fila y `git status --porcelain` vacío al final.

| id | la mutación | cae |
|---|---|---|
| M1 | un `.html` deja de contar como interfaz | de punta a punta |
| M2 | cambiar interfaz ya no obliga a nada (el defecto, entero) | el caso de 1317 |
| M3 | un clon somero se mide como si trajera la cadena | de punta a punta |
| M4 | la declaración de una entrada ajena que el PR sólo rozó lo salva | «lo salvan SUS entradas» |
| M5 | una línea en blanco basta para atribuir una entrada | «lo que no sé clasificar» |
| M6 | el corte deja de aplicarse | de punta a punta |
| M7 | lo no rastreado no cuenta como cambio de la rama | de punta a punta |
| M8 | el lector de parches no lee ninguna línea | autoprueba de lectores |
| M9 | tienen que declarar todas las entradas, no una | «lo salvan SUS entradas» |
| M10 | sin base se sigue adelante | suelo |
| J1 | la lista admite altas posteriores al techo | la lista |
| J2 | la lista pasa de su tope | la lista |
| J3 | una heredada que ya declara se queda en la lista | la lista |
| J4 | lo que no declara y está fuera de la lista no se acusa | la lista |
| J5 | lo de la rama deja de juzgarse | la lista |
| J6 | la línea cambia N por M | la línea |
| A1 | **árbol real**: se quita de la lista un PR que no declara | el que decide |
| A2 | **árbol real**: un registro de la lista pasa a declarar | el que decide |

**18 de 18 cazadas.** El rojo de A1, leído además a mano: «1 cambio(s) de interfaz cuyo registro NO declara
`**Skill UI:**`: el merge 610adb8d… → SCRUM-1275.md#SCRUM-1275 · Facturas: pulsar una fila no abre la
factura», y la línea de la cuenta decía «heredados 73 · sin declarar y fuera de la lista 1».

Tres casos nacieron de preparar la mutación, porque sin ellos habría salido muda: la precedencia de las
nacidas sobre las tocadas (M4), la línea corta que no atribuye (M5) y N distinto de M (J6). Y un filtro
por fecha en JS, redundante con el de git, se quitó: con dos guardas, M6 no se podía cazar.

## Ⓘ ¿Hay otro guard con la misma forma?

- **Sobre el campo de fecha: ninguno más.** 1.608 ficheros rastreados de `tests/` y `scripts/`, cadena fija:
  9 lo contienen; sólo `scrum811c` lo lee del registro (`scrum1152` lo usa como cebo, `scrum267` en dos
  comentarios, y seis son etiquetas de pantalla o nombres de variable). No mirado: `src/`, `.github/`.
- **Con la misma FORMA, sí: `tests/scrum1294-a9-leccion-en-a10.test.mjs`.** Exige la línea «A9:» a los
  tramos cuya ancla lleva fecha desde el 30-sep, y esa fecha la escribe el registro. Medido con el mismo
  motor (`misma-forma-a9.mjs`): 55 merges desde el 30-sep, 47 entradas nacidas en ellos, **1** con ancla
  anterior al corte (SCRUM-1296, ancla del 29-sep, mergeado el 30) — y lleva su A9 igualmente. **Hoy no
  tiene víctima.** No se arregla aquí ni pide ticket por sí solo; queda reportado.

## Ⓙ Lo que me salió mal

1. **Una hora a ojo.** En el mensaje del recuento puse «~06:58Z»; GitHub decía 06:54:31Z al mandarlo. Es
   el mismo fallo que J5d dejó escrito en su Ⓘ.
2. **Un grep ciego a lo que buscaba.** Mi primera búsqueda de otros guards sobre el campo de fecha, con
   regex, no vio la línea 62 de `scrum811c` — la regex del campo. Lo cazó exigirle que esa línea saliera.
   El primer recuento no valía.
3. **Un `\u` en un fichero** (el separador del `git log`), que A22 dice que aterriza como el carácter
   literal. Lo cambié por `String.fromCharCode(1)` antes de correr nada y conté los bytes de control: 0.
4. **Conté CR con `grep '\\r'` sobre `od`** y salieron 403 «líneas con CR» en un fichero de 183: contaba
   la letra. La memoria del puesto ya lo decía. Repetido con `tr -cd '\r' | wc -c`: 0.

5. **Dos cifras escritas de memoria en este mismo registro.** En el reparto por día de Ⓒ puse «23-sep 2 ·
   24-sep 3» sin haber leído esos dos días (la salida que tenía delante se cortaba en el 25). Sumaban 76
   y el total es 74: lo vi al comprobar la suma. Leídas del fichero: 1 y 2.

Ninguno cambió una cifra entregada, salvo la hora del punto 1, corregida en el mensaje siguiente.

## Ⓚ Lo que este ticket NO cierra

- Si los 74 se declaran a posteriori: decisión del fundador (subida por el orquestador).
- El comentario de `scripts/guards-entrada.mjs` y las fichas `sesion-2.md` / `sesion-4.md`: de sus dueños.
- El rojo del trinquete de zona en clon somero: familia de SCRUM-1324.
- La forma de `scrum1294`: sin víctima hoy.

## Ⓛ Verificación
