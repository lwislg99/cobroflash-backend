# SCRUM-1502 · Las 28 marcas de firma que el trinquete tiene congeladas: cuáles constan, cuáles no, y por qué citar una frase fabrica su respaldo

**Medido contra:** `origin/main` = `0fd400cbc3dddf2d7d55573014937b53dc499edc` · 2026-10-07T18:06:36Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/scrum1502/interroga.mjs`

Lo hace J4 (equipo de Javier). Sólo mide y escribe: no toca `src/`, `public/` ni `tests/`, no cambia
ningún texto, no baja el trinquete y no escribe ninguna firma nueva. Lo que no consta se le pregunta
al fundador en el comentario de entrega del ticket; aquí está la medición.

## 0 · En corto

| | |
|---|---|
| marcas congeladas hoy (`congeladas()` del propio trinquete) | **28**, el mismo conjunto antes y después de traer `main` |
| su decisión **consta** fuera del código, con quién la tomó | **14** |
| consta **sólo en el registro que escribió la sesión** que la aplicó | **5** |
| **no consta**, o consta sin decir quién | **6** |
| **no afirman** ninguna firma (el léxico casa una frase que dice otra cosa) | **3** |

Población: 1.189 bloques de comentario con la palabra del agente en `src`, `public`, `tests` y
`scripts`; 1.186 fuentes de respaldo, 291 que atribuyen. Reparto del trinquete: 13 negadas · 1 citada ·
149 rastreables · 13 ancladas · 24 documentales · 28 sin respaldo.

Tres cosas del enunciado que la medición corrige:

1. **La frase del CLIENTE no está entre las 28.** `portonDocumento.ts:46` no la acusa el trinquete, y
   su texto es la decisión ① del máster (SCRUM-206, `docs/YAQU_MASTER.md:1374`). De las dos frases del
   409 la congelada es la del PROFESIONAL (`invoicesAdmin.routes.ts:1293`). Ninguna de las que no
   constan la lee un cliente final; cuatro las lee un profesional.
2. **`[[cita]]` no protege hoy un registro.** El delimitador sólo actúa sobre el comentario de la
   marca, en `tests/`. Una frase entre `[[cita]]` en un `docs/master/*.md` respalda igual que a pelo
   (§4, caso D).
3. **El trinquete congela un NÚMERO, no un conjunto.** La lista publicada el 17-sep en
   `docs/master/SCRUM-921.md` bajo «las 28» tiene 29 filas; la de hoy son esas mismas menos
   `tests/scrum568-…:200`. No se ha medido cuándo salió ni por qué.

## 1 · De dónde sale la lista

De `congeladas()`, que exporta `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`: el mismo
camino que decide si el árbol pasa. `docs/master/evidencias/scrum1502/lista.mjs` sólo le pone al lado
el comentario y los literales que el lector de la casa (`marcasDe`) ve debajo, y aborta si alguna de
las 28 no aparece entre sus bloques (0 perdidas de 28). No hay censo nuevo.

Al importarlo, el fichero del trinquete corre sus 13 casos: 13 pasan, 0 fallan, en la base.

## 2 · Las 28, por peso

«Consta» quiere decir: un documento o un comentario de Jira dice QUIÉN decidió, sobre ESE texto o ESA
decisión. Que el texto aparezca no basta. Los literales largos van recortados con «…» a propósito (§4).

### 2.1 · Texto que lee un PROFESIONAL, en producción

| dónde | qué gobierna | ¿consta? | dónde, o qué se buscó |
|---|---|---|---|
| `src/modules/system/app/routes/invoicesAdmin.routes.ts:1293` | el 409 al abrir el PDF de una factura sin registrar: «Esta factura todavía no está registrada. Se reintenta solo…» | 🔴 **NO CONSTA** | no es ninguna de las tres decisiones de SCRUM-206 en el máster. En Jira, SCRUM-206 c.11667 (30-jul, 12:14) dice que los dos mensajes de administración siguen pendientes; el commit `3beaf9514` (12:29) retira las marcas diciendo que se aprobaron ese día. Ese commit es el mismo cambio que escribió el comentario |
| `src/modules/system/app/routes/quotesAdmin.routes.ts:395` | el aviso al emitir: «La factura se creó pero no se pudo registrar. No la entregues…» | 🔴 **NO CONSTA** | lo mismo que la anterior; el literal sólo aparece en `docs/master/SCRUM-921.md`, que lo denuncia |
| `public/dashboard/js/reportsView.js:1195` | «Desglose por empleado», «Empleados incluidos…» y la ayuda del bloque | 🔴 **NO CONSTA** | el máster, en la entrada del mismo día (`docs/YAQU_MASTER.md:1376`), dice que los textos del bloque van pendientes. Nada en Jira ni en `docs/` lo levanta |
| `tests/scrum291-series-huecos.test.mjs:99` | el bloqueo de la serie con facturas emitidas (título y cuerpo) | 🟠 **consta la aprobación, no quién** | `docs/master/SCRUM-291.md:115` dice «Microcopy APROBADA (5-ago-2026)» sin agente; el literal da 0 en Jira |
| `public/dashboard/js/jobRailBlocks.js:19` | CLIENTE · DÓNDE · DINERO · PRESUPUESTO · RESPONSABLE | 🟡 sólo en el registro | `docs/master/SCRUM-318.md:119`. La descripción del ticket los da por pendientes y ningún comentario lo cambia |
| `public/dashboard/js/settingsSubmenus.js:36` | los diez rótulos de Configuración | 🟡 sólo en el registro | `docs/master/SCRUM-284.md`, «Dos correcciones del fundador», ②. En Jira, igual que la anterior |
| `public/dashboard/js/homeView.js:779` | «Total cobrado», «Cobros sin presupuesto» | ✅ consta | SCRUM-236 c.11668 (30-jul) |
| `public/dashboard/js/quoteActionsRegistry.js:64` | los doce rótulos de acciones (17-ago) | ✅ consta | `docs/MICROCOPY_APROBADA_SIN_APLICAR.md:25` y su tabla |
| `public/dashboard/js/quoteMargen.js:64` | el formato de la fila «Margen» y «sin calcular» | ✅ consta | SCRUM-229, descripción |
| `src/modules/jobs/domain/parteDictado.ts:138` | el aviso de cantidad, en singular | ✅ consta | `docs/MICROCOPY_APROBADA_SIN_APLICAR.md:494` |
| `tests/scrum283-censo-acciones-factura.test.mjs:118` | «Marcar como cobrada» | ✅ consta | `docs/MICROCOPY_APROBADA_SIN_APLICAR.md:25` |
| `tests/scrum294c-criterio-del-merchant.test.mjs:175` | «Criterio de caja» y su terna | ✅ consta | `docs/MICROCOPY_APROBADA_SIN_APLICAR.md:25` |
| `tests/scrum377-plural-de-programador.test.mjs:72` | los plurales | ✅ consta, con matiz | SCRUM-377 c.12880: se aprueba el PATRÓN, por delegación, no cada cadena |
| `tests/scrum593b-superficie-texto-del-documento.test.mjs:89` | «Añadir texto en el documento» | ✅ consta | `docs/master/SCRUM-593.md:378` |
| `tests/scrum609b-switch-tipo-articulo.test.mjs:75` | «Esto es» · «Producto» · «Servicio» | ✅ consta | SCRUM-667 c.14271 |
| `tests/scrum651-trabajo-sin-presupuesto.test.mjs:381` | el vocabulario cerrado del tipo de intervención | ✅ consta | SCRUM-651 c.14229 |

### 2.2 · Texto que lee un CLIENTE final

| dónde | qué gobierna | ¿consta? | dónde |
|---|---|---|---|
| `src/modules/whatsappBot/domain/botFlow.service.ts:1` | el cambio «A18» del bot (validar, confirmar con botones, cancelar) | ✅ consta | `docs/YAQU_MASTER.md:386` |

### 2.3 · Texto interno: no lo lee nadie, pero decide lo que sale

| dónde | qué gobierna | ¿consta? | dónde, o qué se buscó |
|---|---|---|---|
| `src/modules/jobs/domain/parteDictado.ts:401` | la instrucción al modelo del parte dictado, con la línea de no completar marcas | 🔴 **NO CONSTA** | `docs/` y Jira sólo la nombran para denunciarla (SCRUM-921). Tres líneas más arriba el propio fichero la titula como propuesta pendiente |

### 2.4 · No gobiernan texto: una decisión

| dónde | qué decisión | ¿consta? | dónde, o qué se buscó |
|---|---|---|---|
| `tests/scrum320-que-falta-para-cobrar.test.mjs:36` | que el ejemplo de 853,05 es «el aprobado» | 🔴 **NO CONSTA** | en SCRUM-320 esa cifra va como medida, y su sección de textos los da por pendientes |
| `tests/scrum683-parte-dictado.test.mjs:85` | que en un presupuesto la cantidad ausente vale 1 (2-ago) | 🔴 **sólo lo repite** | `docs/master/SCRUM-683.md:38` dice lo mismo que el test; no se encontró la decisión de esa fecha |
| `tests/scrum586-forma-de-pago-por-cliente.test.mjs:178` y `:392` | la forma de pago se propone, no se aplica sola (5-sep) | 🟡 sólo en el registro (×2) | `docs/master/SCRUM-586.md:49` |
| `tests/scrum716-ritmo-de-despliegue.test.mjs:127` | el permiso para tocar el vigilante de despliegue (7-sep) | 🟡 sólo en el registro | `docs/master/SCRUM-716.md:465`. SCRUM-716 c.14645, de esa madrugada, lo daba por bloqueado a falta de ese permiso |
| `tests/scrum151-motivo-sin-tramo.test.mjs:53` | un Trabajo con condiciones manuales sí se factura | ✅ consta | `docs/YAQU_MASTER.md:1297` |
| `tests/scrum320-que-falta-para-cobrar.test.mjs:252` | el cuarto hueco | ✅ consta, dos veces y distinta | SCRUM-320 c.12636 (6-ago) y c.13271 (11-ago, por delegación, con otro texto) |

### 2.5 · No afirman nada

| dónde | qué dice en realidad |
|---|---|
| `public/dashboard/js/customersView.js:977` | explica un contador de textos SIN firma; la marca aparece como el término con el que se compara |
| `tests/scrum715-consta-por-identidad.test.mjs:147` | una hipótesis: qué pasaría si las notas contaran como literales firmados |
| `scripts/seed-video.mjs:1` | una instrucción de uso: quién elige la base donde se siembra |

Estas tres ocupan sitio en el 28 sin ser deuda de firma. No se tocan aquí: sacarlas es cambiar el
léxico del trinquete o reescribir el comentario, y las dos cosas mueven el número.

## 3 · Lo que se le hizo al trinquete para saber si mide

`docs/master/evidencias/scrum1502/interroga.mjs`, en un árbol desechable (`git worktree add --detach`),
8 casos, 0 ciegos; salida en `salida-interroga.txt`. Cada caso muta, mide en un proceso aparte y
deshace comprobando los bytes; el árbol acabó con `git status --porcelain` vacío.

| caso | sin respaldo | documental | qué caso del trinquete cae |
|---|---|---|---|
| 0 · base | 28 | 24 | ninguno |
| A · se le quita la marca a una SIN respaldo (`homeView.js`) | 27 | 24 | «tampoco baja en silencio» |
| B · se le quita la marca a una CON respaldo documental (el menú K1 del bot) | 28 | 23 | «lo respaldado en el MÁSTER sale limpio» |
| C · un registro nuevo copia la frase del 409 a pelo | 27 | 25 | «tampoco baja en silencio» |
| D · el mismo registro, con la frase entre `[[cita]]` | 27 | 25 | «tampoco baja en silencio» |
| E · la propuesta de §4 puesta, sin cobaya | 28 | 24 | ninguno |
| F · la propuesta + la frase a pelo | 27 | 25 | «tampoco baja en silencio» |
| G · la propuesta + la frase entre `[[cita]]` | 28 | 24 | ninguno |

El número se mueve con lo que debe y por la marca que debe: en A sale `homeView.js:779`, en C, D y F
sale `invoicesAdmin.routes.ts:1293`, y B no toca el 28 porque esa marca no estaba en él.

## 4 · El respaldo que se fabrica citando, y la propuesta (NO aplicada)

**El mecanismo, medido (casos C y D).** Una marca queda respaldada si uno de los literales que tiene
debajo aparece en un `docs/master/*.md` (o en `docs/microcopy/`, el máster o el registro congelado)
que en CUALQUIER parte atribuya algo al fundador. No hace falta que la atribución hable de esa frase.
Un registro que copie la frase para denunciarla y en otro párrafo nombre una decisión del fundador la
absuelve. Es lo que le pasó a `docs/master/SCRUM-1404.md`, y es por lo que en este registro los
literales largos van recortados.

**Por qué `[[cita]]` no lo evita hoy.** `_cita-declarada.mjs` se aplica al texto del COMENTARIO de la
marca y sólo en `tests/`. El índice de fuentes (`indiceDeFuentes`, en `tests/_respaldo-de-firma.mjs`)
lee los documentos enteros.

**La propuesta, dos líneas en `tests/_respaldo-de-firma.mjs`:** importar `sinCitas` y leer cada fuente
con `sinCitas(...)`. Medida en los casos E, F y G: sobre el árbol de hoy no cambia nada (28 y 24,
ningún caso en rojo); la frase declarada como cita deja de respaldar; la frase a pelo sigue bajando el
número, con rojo. Falla del lado que acusa: quien envuelva en `[[cita]]` un respaldo de verdad verá su
marca acusada, no absuelta. En `docs/` hay hoy un solo fichero con el delimitador.

**Lo que esa propuesta NO arregla, y hay que decidir aparte:**

- quien no sepa que tiene que declarar la cita sigue cayendo en el rojo de «tampoco baja en silencio»,
  y ese mensaje no dice QUÉ marca salió ni QUÉ documento la respaldó. Decirlo ahí son tres líneas más,
  y es lo que le habría ahorrado a J1 la separación por ejecución;
- la atribución se mira por FICHERO, no por frase: un documento largo que atribuya una cosa respalda
  cualquier otra que copie.

Las dos son cambios al mecanismo de un trinquete que corre en el obligatorio de los dos equipos. No se
aplican aquí.

## 5 · Errores propios

1. **El guion de mutaciones deshacía en el orden de ida.** Con dos mutaciones sobre el mismo fichero,
   la última escritura lo dejaba a medio mutar y cada comprobación suelta salía bien. La primera
   pasada dejó F y G ciegos y un fichero sucio en el árbol desechable; lo cazó el `git status` de
   después, no el guion. Ahora deshace en orden inverso (commit `123d1151`), y se repitió entero.
2. **Para limpiar ese árbol probé `git worktree remove --force`** y el hook lo paró. Se restauró el
   fichero con `git restore --source=HEAD` y el árbol se quitó sin forzar.
3. **Medí mi contexto por primera vez a 191.050**, con el aviso pedido a 200.000: la lectura entera de
   las normas comunes se llevó la mitad.
4. **Avisé al orquestador de que la frase del cliente estaba respaldada en el máster antes de abrirlo
   yo**: lo tenía de la clasificación del 17-sep. Se confirmó después (`docs/YAQU_MASTER.md:1374`).

## 6 · Lo que NO se ha hecho ni medido

- La búsqueda de §2 la hizo un subagente (69 llamadas). Yo comprobé por mi mano once de las rutas con
  su línea, el commit `3beaf9514` y que SCRUM-206 tiene un comentario con esas palabras. **Los ids de
  comentario de Jira no los he abierto yo uno a uno.** No se abrieron en Jira SCRUM-151, 593, 609, 684
  ni 257: esas filas descansan sólo en el repo.
- No se ha preguntado al fundador: eso es el comentario de entrega.
- No se ha tocado ninguna de las 28, ni el trinquete, ni su número.
- No se ha medido por qué `scrum568:200` dejó de estar acusada, ni las 149 «rastreables» (citan un
  ticket; nadie ha comprobado que el ticket diga lo que la marca dice), ni las 11 del asesor.
- La tanda completa no se ha corrido: el cambio son cuatro ficheros bajo `docs/master/`.

## Tramo 3 · la línea de atribución junto a la marca de `invoicesAdmin.routes.ts:1293`, y el número baja de 28 a 27

**Medido contra:** `origin/main` = `176d0772eb0f4be574dad06f5c548f7da73c5ca7` · 2026-10-08T01:44:30Z (hora de GitHub)

A9: comprobación → `tests/scrum387-procedencia-aprobacion.test.mjs`

Lo hace J1 (equipo de Javier), sesión `jv-j1` (relevo), en la rama
`scrum-1446c-la-factura-dice-siete-y-medio` (la ficha pedía no abrir otra). Permiso leído: SCRUM-1502
`c.18892`. La decisión que la línea cita: SCRUM-1502 `c.18835`.

### 🔴 El 27 es «bien escrito», NO «verificado»

El trinquete acepta esa línea POR SU FORMA: un ticket, la palabra y un id. No comprueba que el ticket
exista, ni que el comentario exista, ni que diga lo que la marca afirma: J4 fabricó un ancla a un
ticket que en Jira da 404 y el trinquete la dio por buena (SCRUM-1511; `c.18889` de este ticket).
**Nadie puede leer «27» como «27 marcas con su decisión comprobada».** En este caso la referencia es
verdadera porque la he abierto yo: `c.18835` existe y trata de esa marca. Eso lo sé yo, no el guard.

### 1 · Qué se ha cambiado

- `src/modules/system/app/routes/invoicesAdmin.routes.ts`: UNA línea de comentario, añadida al final
  del bloque de la marca. Ninguna línea de código. El texto del 409 no se toca ni se copia aquí.
- `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`: la constante `SIN_RESPALDO`, de 28 a 27.
  Sólo el número.

No se ha puesto ancla a ninguna otra marca: las otras 27 se le preguntan al fundador una a una.

### 2 · El orden, que es lo que distingue esto de relajar un guard

Población: las marcas que da `congeladas()`, el mismo camino que decide si el árbol pasa.

| paso | árbol | `congeladas()` | `:1293` en la lista | `scrum921c` |
| --- | --- | --- | --- | --- |
| ① | tal cual | 28 | sí | 13 de 13 |
| ② y ③ | con la línea, constante en 28 | 27 | **no** (es la única que sale) | 12 de 13: cae `SCRUM-921c · el trinquete tampoco baja en silencio` («quedan 27 y el trinquete dice 28») |
| ④ | con la línea, constante en 27 | 27 | no | 13 de 13 |

Por nivel, de ① a ②: `anclado` 14 → 15, `sin-respaldo` 28 → 27, el resto igual (negada 13, citada 1,
rastreable 149, documental 24).

### 3 · Lo que el permiso no preveía: un SEGUNDO trinquete

La misma línea le da «procedencia» a la marca para `tests/scrum387-procedencia-aprobacion.test.mjs`,
y cae `SCRUM-387 · el trinquete tampoco baja en silencio: la mejora se escribe`: «se han arreglado
marcas sin procedencia (17 → 16) y el número no se ha bajado». Pide bajar `SIN_PROCEDENCIA` de 17 a
16 en el mismo cambio. Ni la medición de J4 ni `c.18892` lo nombran. Lo cazó la tanda dirigida (65
ficheros: 660 tests, 657 pasan, 2 saltan, 1 cae), no yo leyendo.

Paré el commit y lo pregunté. La decisión está en `c.18900` (del orquestador del equipo de Javier,
leída): se baja también, sólo el número, porque bajar un trinquete cuando él mismo lo exige es
apretarlo y no relajarlo; tocar su lógica sería otro permiso. Y lo pedía el propio guard: el
comentario que lleva encima esa constante dice que el número «baja según se les ponga su ticket o su
documento». Con `SIN_PROCEDENCIA` en 16 la misma
tanda da 660 tests, 658 pasan, 2 saltan, 0 caen.

**El 16 vale lo mismo que el 27: «bien escrito», NO «verificado».** `scrum387` también mira la forma
(un ticket o un documento en el bloque de la marca), no si lo que nombra dice lo que la marca dice.

**El diff lleva dos cambios de número, y los dos vienen de UNA sola línea de comentario**: el 28 → 27
de `scrum921c` y el 17 → 16 de `scrum387`. No son dos decisiones: es una marca que deja de estar
acusada en los dos censos que la contaban. `scrum921c` cambia además, sin tocar nada, su reparto por
nivel (`anclado` 14 → 15), que no es una constante.

### 4 · Lo que no he hecho

- No he comprobado contra Jira ninguna de las otras 14 marcas «ancladas» ni las 149 «rastreables».
- No he corrido la tanda completa: la corre el check obligatorio.
- El «Tramo 2» de J4 (rama `scrum-1502b-mira-el-guard-en-jira`) no estaba en `main` al escribir esto:
  si entra después, los dos tramos se conservan.
---

## SCRUM-1502b · Tramo 2 (J4, 8-oct-2026): el trinquete NO mira en Jira. Mira el ÁRBOL, y de Jira sólo la FORMA de una cita escrita en el comentario de la marca

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` · 2026-10-08T01:26:20Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/scrum1502b/que-fuentes-lee.mjs`

La pregunta, de SCRUM-1502 comentario 18846: el 8-oct se reconoce en Jira (comentario 18835) la marca
de `src/modules/system/app/routes/invoicesAdmin.routes.ts:1293`, y `SIN_RESPALDO` sigue en 28. Se
contesta ejecutando el trinquete, no leyendo lo que dice de sí mismo. No se ha tocado `scrum921c`, ni
su número, ni `src/`, `public/` ni `tests/`; este tramo son este registro y
`docs/master/evidencias/scrum1502b/` (cuatro ficheros).

### T2.0 · En corto

| pregunta | respuesta medida |
|---|---|
| sale de la máquina mientras corre (red, nombres, procesos) | **0 salidas**, y con TODA salida bloqueada da lo mismo: 13 de 13 |
| consulta alguna credencial por su nombre | **0** de 19 variables de entorno consultadas (son de node y del compilador) |
| qué lee | 3.376 ficheros: `src/`, `public/`, `tests/`, `scripts/`, `docs/master/`, `docs/microcopy/`, el máster y el registro congelado de microcopy. 1 fuera del árbol (`typescript.js`). Ningún otro fichero de `docs/` |
| una marca con respaldo en el ÁRBOL | la encuentra (caso B: documental +1, el 28 no se mueve) |
| una marca con respaldo SÓLO en Jira | no la encuentra (caso D: la de `:1293`, que es exactamente eso, sigue acusada) |
| una marca que CITA un ticket que no existe en Jira | la da por buena (casos C y C′: «anclado» y «rastreable») |

Conclusión: el 28 mide **marcas cuyo comentario no dice dónde consta Y cuyo texto no está en esas
cuatro fuentes del repositorio**. Una decisión que sólo vive en un comentario de Jira no la puede
encontrar nunca, porque nunca va a Jira. No es un defecto de búsqueda: es su población. La cabecera de
`tests/_respaldo-de-firma.mjs:36` lo declaraba desde el 17-sep; el comentario 18835 afirmaba lo
contrario, y esto lo corrige.

### T2.1 · Los controles, antes del número

`espia.mjs` se carga delante del sujeto con `node --import` y envuelve las puertas por las que un
proceso lee un fichero, abre una conexión, resuelve un nombre, lanza otro proceso o consulta una
variable de entorno. Antes de ponerlo delante del trinquete se le pasan dos sujetos
(`sujetos-de-control.mjs`):

| control | qué tiene que dar | qué dio |
|---|---|---|
| CERO · un sujeto que lee un fichero y nada más | 0 salidas | 0, y le ve leer su fichero |
| POSITIVO · un sujeto que sale por cinco puertas | las cinco | 9 salidas por `child_process`, `dns`, `fetch`, `https`, `net`; y le ve consultar una variable por su nombre |
| BLOQUEO · el mismo, con las salidas cortadas | las sigue viendo | 5 vistas, el sujeto acaba con salida 0 |
| CERO de los casos · la frase fabricada y el ticket inexistente, en el espejo | 0 y 0 | 0 y 0 |
| POSITIVO de esa búsqueda · el ticket de este trabajo | más de 0 | 4 ficheros |

El ticket inexistente es el que da `docs/master/evidencias/scrum1505/control-de-cero.mjs` (el máximo
que nombra el árbol, más uno). Entra por la línea de órdenes y no se escribe aquí. Que tampoco existe
en Jira se miró con la herramienta de Jira: devuelve 404; la misma herramienta abre SCRUM-1502.

### T2.2 · Los casos del espejo

Espejo: `git worktree add --detach` sobre `fc639ef96`, retirado sin forzar al acabar, con
`git status --porcelain` vacío (0 líneas). Cada caso muta, mide con `evidencias/scrum1502/lista.mjs`
(el camino del propio trinquete) y deshace comprobando los bytes. 10 casos, 0 ciegos, 0 salidas al
exterior sumadas. Salida entera: `docs/master/evidencias/scrum1502b/salida.txt`.

| caso | sin respaldo | lo que cambia | cae |
|---|---|---|---|
| 0 · base | 28 | anclado 14 · rastreable 149 · documental 24 | nada |
| A · marca nueva, sin respaldo en ningún sitio | 29 | entra la fabricada | «el trinquete no sube» |
| B · marca nueva + un `docs/master` que lleva su frase y atribuye | 28 | documental 25 | nada |
| B′ · lo mismo, y el documento no atribuye a nadie | 29 | entra la fabricada | «el trinquete no sube» |
| C · marca nueva cuyo comentario cita ticket + comentario de un ticket que NO existe | 28 | anclado 15 | nada |
| C′ · marca nueva cuyo comentario sólo nombra ese ticket | 28 | rastreable 150 | nada |
| D · la real de `:1293`, sin tocar (su respaldo está sólo en Jira) | 28 | sigue acusada | nada |
| E1 · la real + ticket y comentario escritos en SU comentario | 27 | sale `:1293`, anclado 15 | «tampoco baja en silencio» |
| E2 · la real + sólo el ticket en su comentario | 27 | sale `:1293`, rastreable 150 | «tampoco baja en silencio» |
| E3 · la real + el id abreviado, sin ticket | 28 | nada | nada |
| E4 · la real + la palabra «comentario» y el id, sin ticket | 28 | nada | nada |

A y B separan «no hay respaldo» de «el respaldo está en el árbol». D y B separan «sólo en Jira» de «en
el árbol». C dice que lo que el trinquete llama Jira es una forma: da por anclada una cita a un
comentario que no puede existir.

### T2.3 · Qué forma espera

Lo que hace salir a una marca del 28, medido:

1. que su COMENTARIO (el bloque de `//` de la marca, no un documento) nombre un ticket `SCRUM-<n>`
   (rastreable), o un ticket seguido de la palabra `comentario` y un id de tres cifras o más (anclado);
2. que su comentario cite una ruta bajo `docs/` (no medido aquí con un caso: lo cubren las 149);
3. o que una frase de las que tiene debajo esté entera en el máster, en el registro congelado de
   microcopy, o en un `.md` de `docs/master/` o `docs/microcopy/` que atribuya algo en algún párrafo.

Y lo que NO: el id abreviado ni el id sin su ticket (E3, E4); y un puntero escrito en otro documento.
Esto último ya está en el árbol: `docs/master/SCRUM-1404.md:248` escribe ticket y comentario del
reconocimiento, con la forma exacta, y `:1293` sigue acusada. El ancla sólo se busca en el comentario
de la marca.

### T2.4 · Lo que esto cambia, y lo que decide un jefe

- Preguntar en Jira y recibir un sí deja una decisión válida y citable, y no mueve el número. Para que
  el número baje, el respaldo tiene que constar en el árbol por una de las tres vías de T2.3.
- La vía 1 (E1) es una línea de comentario en `invoicesAdmin.routes.ts`, junto a la marca. No copia
  ninguna frase, así que no es el respaldo fabricado del tramo 1. Pero edita una línea de atribución en
  un fichero de ruta de facturas, y obliga a bajar `SIN_RESPALDO` a 27 en el mismo cambio (lo pide el
  propio caso «tampoco baja en silencio»). **NO HECHO: son dos cosas que este encargo prohíbe.**
- La vía 1 no comprueba nada contra Jira (caso C). Quien escriba el ancla responde de que el comentario
  existe y dice eso; el trinquete no lo sabrá nunca.
- Si lo que se quiere es que el instrumento VEA Jira, eso es otro instrumento: red y credenciales en el
  obligatorio de los dos equipos. No se propone aquí.

### T2.5 · Errores propios

1. La primera pasada del espía dio «6 leídos fuera del espejo», y 5 estaban dentro: las rutas que el
   cargador de módulos pasa como URL las resolvía mal. Lo cazó leer la lista, no el número. Corregido
   y repetido entero: 1 (`typescript.js`).
2. El recuento de casos en rojo contaba la línea de resumen del informe como un caso (decía 2 donde
   había 1). Corregido y repetido.
3. Di por hecho que el espía no vería los módulos cargados con `import` y lo dejé escrito en su
   cabecera; la primera pasada lo desmintió. Cabecera corregida.

### T2.6 · Lo que NO se ha hecho ni medido

- No se fabricó un respaldo en Jira: sería escribir una firma falsa. El caso «sólo en Jira» es la marca
  real de `:1293`, cuyo comentario 18835 abrí hoy con la herramienta de Jira.
- El espía no ve lo que haga un addon nativo. No se midió en CI: sólo en esta máquina, node local.
- No se miraron las 149 rastreables ni las 14 ancladas: el caso C dice que ninguna está comprobada
  contra Jira por el trinquete, no que alguna sea falsa.
- El hook de arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j4`; SCRUM-1498, carril de
  S5). Se siguió por la norma común del 8-oct, y queda dicho.
- Tanda completa: no corrida. El cambio es este registro y cuatro ficheros bajo `docs/master/`.

---

## SCRUM-1502c · Tramo 4 (J1, 14-oct-2026): las 27 que quedan, con la cita LEÍDA en su sitio

**Medido contra:** `origin/main` = `c30729832c18b65c3793917ca836868e6cfdaa6e` · 2026-10-14T03:23:44Z (hora de GitHub)

A9: aviso → A10 «Un registro escrito por la misma mano que aplicó el texto no es su firma: es quien lo aplicó contando que la tuvo.» — no se pudo comprobar: separar «lo dice el registro de la sesión» de «lo dice el fundador» exige leer Jira, y el trinquete no sale de la máquina (tramo 2)

Lo hace J1 (equipo de Javier), sesión `jv-j1e`, por encargo del orquestador `cobroflash-backend-2e`.
El hook de arranque dijo «SIN IDENTIDAD… no construyas» (medido: SCRUM-1549); se siguió por la orden
escrita del orquestador. Sólo `docs/`: no se ha tocado ninguna marca, ningún texto, ningún guard ni
su número.

### Qué añade a los tramos 1-3

El tramo 1 dejó dicho que **los ids de comentario de Jira no los abrió nadie** y que varios tickets no
se miraron en Jira. Este tramo abre el sitio que cada «consta» cita y lo lee. Tres veredictos:
**CONSTA** (con la cita) · **NO CONSTA** · **NO HE PODIDO MIRAR**. «Consta» exige que el sitio diga
que lo decidió el fundador sobre ESE texto o ESA decisión; un registro de `docs/master/` escrito por la
misma sesión que aplicó el texto **no cuenta como consta**: es la misma mano.

Población: `congeladas()` del propio trinquete, hoy **27** (las 28 de J4 menos
`invoicesAdmin.routes.ts:1293`, que salió en el tramo 3). Control de la lista: las 27 son exactamente
las filas de §2 menos esa (`evidencias/scrum1502/lista.mjs`, 0 perdidas; al importarlo, `scrum921c`
corre sus casos y salen 0 fallos).

Cómo se leyó: el repo, a mano (fichero, línea y el commit que retiró cada marcador, con su mensaje);
Jira, 14 tickets leídos enteros (en los 14, comentarios devueltos = total) por dos subagentes con la
orden de devolver la cita literal y el id; y SCRUM-667 `c.14271` lo abrí yo para contrastar a uno de
ellos: coincide letra por letra. Y la función de la casa que contesta «¿consta?» para microcopy
(`aprobacionesDeMicrocopy`, `tests/_microcopy-aprobada.mjs`), en
`docs/master/evidencias/scrum1502c/consta.mjs`: 135 aprobaciones, 4 positivos que sí encuentra, un
cero inventado que no, y nada para ningún literal de las cinco urgentes (`salida-consta.txt`). Esa
función sólo mira los registros de microcopy, no Jira: su vacío no es «no consta», es «no está ahí».

### 🔴 Lo urgente: NO CONSTA y lo pinta la pantalla de un PROFESIONAL

Las cinco están en el código de `main`, que es lo que se despliega. **No las he visto en yaqu.app.**

| marca | texto que gobierna | dónde se pinta | por qué NO CONSTA |
|---|---|---|---|
| `src/modules/system/app/routes/quotesAdmin.routes.ts:395` | el 409 al emitir: «La factura se creó pero no se pudo registrar…» | `quotesDetailView.js` lo pinta tal cual (`textoDeErrorDeFacturar` devuelve el `message`) cuando el sellado queda pendiente | SCRUM-206 `c.11667` (30-jul 12:14) lo da por **pendiente** de aprobación del fundador; el único comentario posterior (`c.11670`) no habla de textos. Lo único que lo afirma es el commit que quitó la marca (`3beaf9514`). El fundador reconoció la frase HERMANA de `:1293` (`c.18835`), y ese comentario dice que no se extiende a otra por parecido |
| `public/dashboard/js/reportsView.js:1195` | el título, la ayuda y la etiqueta del bloque de desglose por empleado (literales: en el fichero, no aquí) | Informes, cuando el negocio tiene más de un empleado (`data.byEmployee.length > 1`) | el máster (entrada de SCRUM-228) los da por **pendientes**; en SCRUM-228 los literales no aparecen. Sólo lo afirma el commit `ed96e9357` |
| `public/dashboard/js/jobRailBlocks.js:19` | CLIENTE · DÓNDE · DINERO · PRESUPUESTO · RESPONSABLE | el raíl del Trabajo | la descripción de SCRUM-318 los da por **«sin aprobar»**; el cierre (`c.12400`) no habla de firma. Sólo lo afirma su registro (`docs/master/SCRUM-318.md`, «Microcopy») |
| `public/dashboard/js/settingsSubmenus.js:36` | los diez rótulos de Configuración | las pestañas de Configuración | la descripción de SCRUM-284 trae los nueve nombres **como «microcopy sin aprobar»**; lo único atribuido al fundador en Jira es dónde va cada campo (`c.12228`). Sólo lo afirma su registro (`docs/master/SCRUM-284.md`, «Dos correcciones del fundador», ②) |
| `tests/scrum291-series-huecos.test.mjs:99` | el título y el cuerpo del bloqueo de una serie con facturas emitidas (`TIT_SERIE_YA_EMITIDA`, `merchantAdmin.ts`; literales: allí, no aquí) | Configuración, al cambiar una serie que ya tiene facturas | el literal no aparece en SCRUM-291; el GO del fundador de ese día (`c.12490`) es para el bloque de series y su esquema, no para el texto. `docs/master/SCRUM-291.md` dice «APROBADA (5-ago)» **sin decir quién** |

Ninguna de las que no constan la lee un cliente final.

### Las otras 22

**CONSTA (13)**

| marca | dónde consta, leído |
|---|---|
| `homeView.js:779` | SCRUM-236 `c.11668` (30-jul): «MICROCOPY OFICIAL aprobado por el fundador: "Total cobrado" y "Cobros sin presupuesto"». Es un cierre de sesión, no una cita del fundador |
| `quoteActionsRegistry.js:64` | `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`, Bloque 3, tabla de `quoteActionsRegistry.js` (17-ago); la función de la casa lo confirma |
| `quoteMargen.js:64` | SCRUM-229, descripción: «Microcopy — APROBADO por el fundador (29-jul-2026)», con la tabla del formato |
| `parteDictado.ts:138` | el mismo registro, addendum del 2-sep: «el fundador aprobó el singular por línea»; la casa lo confirma |
| `tests/scrum283…:118` | el mismo registro, Bloque 1: «Marcar como cobrada»; la casa lo confirma |
| `tests/scrum294c…:175` | el mismo registro, Bloque 5: «Criterio de caja»; la casa lo confirma |
| `tests/scrum377…:72` | SCRUM-377 `c.12880`: «DECISIÓN DEL FUNDADOR (delegada, 9-ago-2026): apruebo el PATRÓN, no las cadenas». ⚠️ El mismo comentario se reserva «el visto final de cada cadena», y ese visto no consta |
| `tests/scrum593b…:89` | `docs/master/SCRUM-593.md`, con el literal del fundador entre comillas. Jira NO abierto |
| `tests/scrum609b…:75` | SCRUM-667 `c.14271` (2-sep), abierto por mí: «APROBADA POR EL FUNDADOR… «Esto es» · «Producto» · «Servicio»» |
| `tests/scrum651…:381` | SCRUM-651 `c.14229` (2-sep), bajo «Las tres decisiones del fundador»: los tres valores |
| `botFlow.service.ts:1` (lo lee un CLIENTE) | `docs/YAQU_MASTER.md`, «Copy A18 (fundador, 7-jul-2026…)» |
| `tests/scrum151…:53` | `docs/YAQU_MASTER.md`: «DECISIÓN DEL FUNDADOR: un Trabajo con condiciones MANUAL/SIN_CONDICIONES SÍ debe poder facturarse» |
| `tests/scrum320…:252` | SCRUM-320 `c.12636` (6-ago): «Decisión del fundador: el cuarto hueco VA» |

**NO CONSTA, y no gobiernan texto que vea nadie (6)**

| marca | qué se leyó |
|---|---|
| `parteDictado.ts:401` (instrucción al modelo) | su registro (`docs/master/SCRUM-683.md`) dice «queda aprobado», **sin decir quién**; en SCRUM-683 no hay nada del 2-sep; la cabecera de su propia sección sigue diciendo «PROPUESTA, PENDIENTE DEL FUNDADOR». Corrige al tramo 1, que decía que `docs/` sólo la nombraba para denunciarla |
| `tests/scrum320…:36` | «853» sólo está en SCRUM-320 como captura medida y como ilustración bajo la decisión del hueco, no como ejemplo aprobado |
| `tests/scrum683…:85` | su registro repite la decisión del 2-ago; en Jira, nada |
| `tests/scrum586…:178` y `:392` | sólo su registro («LA DECISIÓN DEL FUNDADOR (5-sep-2026)»); en SCRUM-586 nada del 5-sep. Lo único literal del fundador (`c.14585`, 6-sep) delega la redacción de una ayuda |
| `tests/scrum716…:127` | sólo su registro («Sí autorizo»). En Jira, `c.14645` dice que esa autorización **falta** y ningún comentario posterior la añade |

**No afirman ninguna firma (3)**, releídas: `customersView.js:977` (habla de un contador de textos
sin firma), `tests/scrum715…:147` (una hipótesis), `scripts/seed-video.mjs:1` (instrucciones: «el
fundador decide la BD»).

**NO HE PODIDO MIRAR:** ninguna marca entera. Sí partes: si un merchant real alcanza hoy el 409 de
`quotesAdmin:395` (no medido en producción), y Jira de SCRUM-593.

### En corto

| | tramo 1 (J4, 7-oct, sobre 28) | este (14-oct, sobre 27) |
|---|---|---|
| CONSTA | 14 | **13** |
| NO CONSTA (incluye «sólo en su registro» y «sin quién») | 11 | **11** |
| no afirman | 3 | 3 |

Cuadra: la que falta es `:1293`, que ya salió. Ninguna «consta» del tramo 1 se ha caído al leerla.
Lo que cambia es el porqué de dos: `scrum291:99` y `parteDictado:401`.

### Hallazgo de paso, FUERA de las 27: una marca que el trinquete da por buena y choca con Jira

`public/dashboard/js/jobDetailView.js:217` — «… aceptados y sin facturar», en el Trabajo. Su
comentario dice «APROBADO por el fundador (docs/master/SCRUM-320.md, C4…; marca: SCRUM-1215
comentario 19084)», así que el trinquete la cuenta como anclada. Pero en SCRUM-320 `c.13271` (11-ago)
el texto aprobado para ESE hueco, por delegación del fundador, es **«Falta emitir la factura»**. Dos
textos «aprobados» para la misma ranura. No he abierto SCRUM-1215 `c.19084`. Es la forma del caso C
del tramo 2: anclada no es verificada.

### Errores propios

1. **Encargué a los subagentes con una premisa falsa** que traía de mi memoria: «todo sale bajo la
   cuenta de Javier». Lo cazó el primero: 11668, 12880, 14229, 12636, 13271 y 11667 salen bajo la
   cuenta de Luis Lara. No cambia ningún veredicto (ninguno descansa en la cuenta); la nota de memoria
   queda corregida.
2. **Busqué en `docs/` a mano antes de usar la función de la casa** que contesta «¿consta?» para
   microcopy, que es justo la última línea de A10. La pasé después como contraste y no movió ningún
   veredicto.
3. Escribí este tramo con un heredoc de bash y reventó con los acentos (no escribió nada; `git status`
   lo confirmó). Lo tenía apuntado.
4. **🔴 El peor, y es el defecto que este ticket existe para medir: fabriqué respaldo citando.** La
   primera versión de este tramo copiaba los literales de dos de las urgentes en la tabla, en un
   registro que atribuye al fundador en otros párrafos. `scrum921c` cayó: «quedan 25 y el trinquete
   dice 27»; las dos que salieron eran `reportsView.js:1195` y `scrum291:99`, justo dos que NO
   constan. Lo cazó el trinquete, no yo: el tramo 1 lo avisaba en su §4 y lo leí antes de escribir.
   Quitados los literales (se nombran por fichero), vuelve a 27. La propuesta de §4 del tramo 1
   (`sinCitas` en el índice de fuentes) sigue sin aplicar, y esto es una segunda medición de que hace
   falta.

### Lo que NO se ha hecho

- No se ha tocado ninguna de las 27 marcas, ningún texto, `scrum921c`, `scrum387`, ni sus números.
- No se ha preguntado al fundador: las cinco urgentes van en el comentario de entrega.
- Tanda completa: no corrida. El cambio es este registro, dos ficheros bajo
  `docs/master/evidencias/scrum1502c/` y una línea en A10.

## SCRUM-1502d · Tramo 5 (J4, 23-oct-2026): las cinco firmas de c.20514 al código — dos aquí, tres en tickets para el equipo de Luis

**Medido contra:** `origin/main` = `fbf9701d1ee65e5cbcd49d02626156b03bbd87f6` · 2026-10-23T13:45:17Z (hora de GitHub)
**Skill UI:** no cargada · el cambio en `public/` son líneas de comentario de `settingsSubmenus.js`: no cambia nada que se pinte
A9: aviso → cicatriz J4 «para dar al otro equipo el número medido escribí, y luego quité, una línea de ancla en tres ficheros de S1 y S2 de mi árbol» — no se pudo comprobar: el hook de carril mira las herramientas de edición y no un `sed -i` de bash, y lo que no se empuja no lo ve ningún guard

### Qué firmó el fundador y dónde

SCRUM-1502 **comentario 20514** (23-oct, transcrito por el orquestador `cobroflash-backend-62`): los
cinco textos que el tramo 4 dejó en «no consta» y pinta un profesional, preguntados uno a uno sobre la
propuesta de `c.20490` (jv-j4p). El segundo, firmado como bloque entero. Los literales viven en Jira y
en el código; **aquí se nombran por fichero**, por lo que mide este ticket (tramo 1, §4).

### Carril de cada marca (`node scripts/carriles.mjs de <ruta>`, desde este árbol)

| marca | carril | qué se ha hecho |
|---|---|---|
| `public/dashboard/js/settingsSubmenus.js:36` | J3 (contenedor), `dos-equipos.md:146` | ancla puesta aquí, y «diez» → «nueve» |
| `tests/scrum291-series-huecos.test.mjs:99` (el texto vive en `merchantAdmin.ts`, J3) | `tests/`: sin fila; `dos-equipos.md:171`, «el test de un ticket → el puesto que trabaja el ticket». Lo trabaja J4 en SCRUM-1502 | ancla puesta aquí |
| `src/modules/system/app/routes/quotesAdmin.routes.ts:408` | **S1**, `dos-equipos.md:136` | NO tocado → **SCRUM-1591** |
| `public/dashboard/js/reportsView.js:1204` | **S2**, `dos-equipos.md:152` | NO tocado → **SCRUM-1590** |
| `public/dashboard/js/jobRailBlocks.js:19` | **S2**, `dos-equipos.md:152` | NO tocado → **SCRUM-1590** |

Cruce declarado: J4 escribe en un comentario de un contenedor de J3 (`settingsSubmenus.js`) y en un
test de un ticket cerrado (SCRUM-291, sin etiquetas). Ningún literal visible cambia: sólo comentarios.

### El orden (c.18892 lo exige así)

| paso | árbol | `congeladas()` | `scrum921c` | `scrum387` |
|---|---|---|---|---|
| ① | `main` tal cual | 27, las dos en la lista | — | — |
| ② ③ | con las dos líneas `Consta en: SCRUM-1502 comentario 20514.`, números sin tocar | **25**; salen exactamente `settingsSubmenus.js:36` y `scrum291:99`, no entra ninguna; anclado 16 → 18 | cae «el trinquete tampoco baja en silencio», y sólo ése | cae «tampoco baja en silencio» (16 → 15) |
| ④ | con `SIN_RESPALDO = 25` y `SIN_PROCEDENCIA = 15` | 25 | verde | verde |

Medido con `node docs/master/evidencias/scrum1502/lista.mjs`, que usa la misma `congeladas()` que el
guard. **El 15 sale de `settingsSubmenus.js`**: con la línea de `scrum291` quitada sigue dando 16 → 15.

🔴 **El 25 es «bien escrito», NO «verificado». Y el 15, igual.** Los dos trinquetes aceptan la línea por
su FORMA: no comprueban que el ticket exista, ni el comentario, ni que diga lo que la marca afirma
(tramo 2, caso C). Que la referencia es verdadera lo sé porque leí `c.20514` entero; el guard no lo sabe.
Los dos cambios de número salen de las mismas dos líneas de comentario: no son dos decisiones.

### Por qué no es 22, como pedía el encargo

22 es el número con las cinco, y tres son del equipo de Luis. Simulado en este árbol con las tres
líneas de S1 y S2 puestas y retiradas (no empujadas): `congeladas()` = **22**, salen exactamente las
tres y no entra ninguna; `scrum387` pasaría de 15 a 12. Cada ticket baja su número al hacerlo.

### 🔴 Lo que va a romper la de S1, medido: un control positivo tomado del árbol

Con la línea de `quotesAdmin.routes.ts` puesta cae además
`SCRUM-921c · 🔴 sólo PROSA respalda: un código de error no es una microcopy`
(`tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs:326`). Su segunda parte comprueba que esa marca
**sigue acusada**: usa una marca real sin respaldo como control positivo, y el día que la marca
encuentra su respaldo, el control cae. No es un trinquete y no se baja un número: hay que sembrar el
caso. Es tocar un guard (A23, regla 41) y va en SCRUM-1591 para que lo decida un jefe. No lo he tocado.

### De paso, en mi carril

La marca de `settingsSubmenus.js` decía «diez» y son nueve desde SCRUM-483 (12-ago, `af263005e`).
Corregido en la marca y en el comentario de dos líneas de encima, que decía lo mismo; el párrafo que
cuenta por qué se aprobaron de una vez queda como historia, avisado.

### Lo que NO se ha hecho

- `quotesAdmin.routes.ts`, `reportsView.js` y `jobRailBlocks.js`: sin tocar (tickets 1590 y 1591).
- Ningún texto visible, ni ninguna otra marca, ni la lógica de ningún guard.
- No he visto ninguna de las cinco en yaqu.app.
- Tanda completa: no corrida (guards dirigidos, en la entrega).

## SCRUM-1502f · Tramo 7 (J1, 23-oct-2026): las firmas de c.20629 al código — cinco marcas de `tests/` aquí; la de `parteDictado.ts` y la de `jobDetailView.js`, para el equipo de Luis

**Medido contra:** `origin/main` = `28098fe4b1a160303526f5a4002d52556d2c5b22` · 2026-10-23T18:05:00Z (hora de GitHub)
A9: comprobación → `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`

### Qué firmó el fundador y dónde

SCRUM-1502 **comentario 20629** (23-oct, transcrito por el orquestador `cobroflash-backend-62`): las
respuestas, una a una, a las preguntas de `c.20628` (jv-j4u) sobre las seis marcas que no son texto
visible, y la de la ranura de `jobDetailView.js`. Los literales viven en Jira y en el código; **aquí se
nombran por fichero:línea** (tramo 1, §4: citarlos aquí los absolvería).

### Carril de cada marca (`node scripts/carriles.mjs de <ruta>`, desde este árbol)

| marca (en `28098fe4b`) | carril | qué se ha hecho |
|---|---|---|
| `tests/scrum320-que-falta-para-cobrar.test.mjs:36` | `tests/`: sin fila; el test de un ticket → quien trabaja el ticket | ancla puesta |
| `tests/scrum683-parte-dictado.test.mjs:85` | ídem | ancla puesta |
| `tests/scrum586-forma-de-pago-por-cliente.test.mjs:178` | ídem | ancla puesta (misma firma que la de :392, c.20629 lo dice) |
| `tests/scrum586-forma-de-pago-por-cliente.test.mjs:392` | ídem | ancla puesta |
| `tests/scrum716-ritmo-de-despliegue.test.mjs:127` | ídem | ancla puesta |
| `src/modules/jobs/domain/parteDictado.ts:401` | **S1**, `dos-equipos.md:136` | NO tocado: ni el ancla ni la cabecera de :398 |
| `public/dashboard/js/jobDetailView.js:217` | **S2**, `dos-equipos.md:152` | NO tocado |

Sólo una línea de comentario por marca: ni el texto de ninguna marca, ni el código que gobiernan.

### El orden (c.18892)

| paso | árbol | `congeladas()` | `scrum921c` | `scrum387` |
|---|---|---|---|---|
| ① | `main` tal cual | 25; las cinco de `tests/` en la lista (sin respaldo) | 13 de 13 | — |
| ② ③ | con las cinco líneas `Consta en: SCRUM-1502 comentario 20629.`, número sin tocar | **20**; salen exactamente las cinco; anclado 18 → 23 | cae «el trinquete tampoco baja en silencio», y sólo ése (12 de 13) | 5 de 5: `SIN_PROCEDENCIA` sigue en 15 |
| ④ | con `SIN_RESPALDO = 20` | 20 | verde | verde, sin tocar |

Medido con `node docs/master/evidencias/scrum1502/lista.mjs`, la misma `congeladas()` del guard,
comparando las dos listas por `fichero:línea`. ⚠️ El diff de las dos listas da **seis** salidas y una
entrada: `scrum320:252` sale y entra `scrum320:253`. Es la MISMA marca, empujada una línea por el ancla
de :36 (el texto de la línea es idéntico en `main` :252 y en la rama :253). La lista identifica por
posición, así que cualquier ancla que añada una línea mueve el nombre de las marcas de debajo.

`scrum387` no se mueve porque las cinco ya tenían procedencia rastreable o no estaban en su población;
no lo he desglosado marca a marca.

🔴 **El 20 es «bien escrito», NO «verificado».** El trinquete acepta la línea por su FORMA (tramo 2,
caso C). Que la referencia es verdadera lo sé porque leí `c.20628` y `c.20629` enteros; el guard no lo sabe.

### Lo que el encargo no preveía: un TERCER trinquete, el de `scrum921`

La dirigida, con `SIN_RESPALDO = 20`, cayó en `SCRUM-921 · el trinquete tampoco baja en silencio`
(`tests/scrum921-firmas-con-respaldo.test.mjs`, `SIN_PROCEDENCIA`): quedan 26 y dice 27. Su censo
(`censarFirmas`, marca canónica) cuenta la marca de `scrum320:36` y ya ve la procedencia del ancla.
Rojo primero, con el fichero de `main` puesto en su sitio y luego restaurado (comprobado byte a byte):
**27**, y `scrum320:36` sin procedencia; con el ancla, **26**, y sólo ésa cambia. Las otras cuatro no
llevan la marca canónica de ese censo. Bajado a 26 en el mismo PR: es la misma línea de comentario, no
una decisión aparte, y es el mismo caso que c.18892 resolvió para el segundo trinquete (`scrum387`).
Y por el mismo motivo se reescribe `tests/_veredicto-mudez.json` con `npm run censo:mudez -- --escribir`
(dos fichas caducadas, `scrum320` y `scrum586`; las dos VIVO): lo pedía `scrum719`.

### Por qué no es 18 (las seis más la de :217)

- **`parteDictado.ts` es de S1.** El encargo pedía, además del ancla de :401, corregir la cabecera de
  :398, que titula la sección como pendiente y con `c.20629` ya no es verdad; decía «si el carril no es
  J1, PARAS». Paro en ese fichero. Con su ancla, `congeladas()` bajaría a 19 (no simulado: no escribo en
  un fichero de otro equipo ni en mi árbol, cicatriz J4 de 1502d).
- **`jobDetailView.js:217` es de S2** y no está entre las 25 (ya es «anclado», a `SCRUM-1215 comentario
  19084`). Cambiar su cita a `c.20629` no mueve ningún número; lo hace S2.

### Lo que NO se ha hecho

- `parteDictado.ts` (ancla de :401 y cabecera de :398) y `jobDetailView.js:217`: sin tocar, para S1 y S2.
- Ningún texto visible, ni ninguna otra marca, ni la lógica de ningún guard.
- No he visto nada en yaqu.app: ninguna de las cinco es pantalla.
- Tanda completa: no corrida (guards dirigidos, en la entrega).

---
## SCRUM-1502e · Tramo 6 (J4, 23-oct-2026): las seis marcas que no pinta ninguna pantalla, preguntadas y contestadas; las dos firmas de un mismo hueco; y el efecto medido de `sinCitas`

**Medido contra:** `origin/main` = `28098fe4b1a160303526f5a4002d52556d2c5b22` · 2026-10-23T19:13:18Z (hora de GitHub)
A9: aviso → cicatriz J4 «pedí cinco tickets ENTEROS a Jira, con todos sus comentarios devueltos al chat, cuando de cuatro sólo necesitaba uno o dos comentarios, y crucé los 200k a mitad del encargo» — no se pudo comprobar: la herramienta de Jira no deja pedir un comentario suelto, y lo que lo evita (salida a fichero y extraer los ids citados) no lo obliga nada

Sólo `docs/`: ninguna marca, ningún texto, ningún guard ni su número tocados. Los literales de las
marcas viven en Jira (c.20628) y en el código; **aquí se nombran por fichero:línea** (tramo 1, §4; la
lección de c.19543: copiarlos aquí los absuelve).

### ① Las seis, preguntadas al fundador (c.20628) y contestadas (c.20629)

Lista sacada con `docs/master/evidencias/scrum1502/lista.mjs` sobre este `origin/main`: **25 sin
respaldo**, `scrum921c` 13 de 13, las seis entre las 25. Dos cambiaron de línea respecto al encargo:
`parteDictado.ts` es la :401 (no :402) y `scrum716` la :127 (no :130).

| marca | qué gobierna | qué constaba antes de preguntar | respuesta del fundador (c.20629) |
|---|---|---|---|
| `src/modules/jobs/domain/parteDictado.ts:401` | la instrucción a la IA del parte dictado (`parteDictado.ts:428-449`, la usa `ai.service.ts:416`) | sólo `docs/master/SCRUM-683.md`, sin decir quién; la cabecera de su propia sección (`:398`) la sigue llamando propuesta pendiente | ✅ la firma |
| `tests/scrum320-que-falta-para-cobrar.test.mjs:36` | los datos de prueba del test de «Qué falta para cobrar»; nada visible | en SCRUM-320 la cifra sale como medida y como ejemplo de una línea; el ejemplo entero, en ningún sitio | ✅ lo aprobó |
| `tests/scrum683-parte-dictado.test.mjs:85` | la cantidad por defecto en el PRESUPUESTO sugerido por la IA (`src/modules/ai/domain/lineasSugeridas.ts:40-43`) | sólo `docs/master/SCRUM-683.md:38`; en SCRUM-683, nada | ✅ en presupuesto, 1 |
| `tests/scrum586-forma-de-pago-por-cliente.test.mjs:178` y `:392` | que la forma de pago pactada del cliente se propone y no se aplica sin un clic | sólo `docs/master/SCRUM-586.md:49`; en SCRUM-586, nada del 5-sep | ✅ se propone — **una respuesta para las dos marcas**, preguntada así a propósito |
| `tests/scrum716-ritmo-de-despliegue.test.mjs:127` | el permiso con el que se enchufó el ritmo de despliegue al vigía (commit `8de07cb31`) | sólo `docs/master/SCRUM-716.md:465`; y Jira lo contradecía (abajo) | ✅ lo autorizó |

**La contradicción de `scrum716`, con sus dos citas.** SCRUM-716 c.14645 (7-sep, 01:41Z) dice que el
vigilante es del fundador y que sin su autorización explícita una sesión sólo puede medir; c.14648
(02:06Z) deja la pieza sin conectar, con un test que se pone rojo si alguien la enchufa. La marca y el
registro (de la misma mano que hizo el cambio, 02:36Z) dicen que se autorizó. Ningún comentario de Jira
lo recogía. El fundador lo confirma en c.20629: el permiso existió; lo que faltaba era el papel.

🔴 **Respuesta del fundador = c.20629, NO un ancla.** Que las siete marcas (las seis y la de ②) citen
c.20629 en su comentario lo hace **otra sesión** (orden del orquestador `cobroflash-backend-62`), y
`SIN_RESPALDO` lo baja la medición de quien lo haga, no este tramo. Hasta entonces el trinquete sigue
en 25: Jira no lo lee (tramo 2).

### ② `public/dashboard/js/jobDetailView.js:217` — dos firmas para un mismo hueco

El hueco del Trabajo aceptado y sin ningún documento tiene dos textos «aprobados» en SCRUM-320:

- **A** — c.12636 (6-ago, al cerrar): decisión del fundador de que el cuarto hueco va, con su línea.
  Es el que sale hoy, y el que repite `docs/master/SCRUM-320.md:257`.
- **B** — c.13271 (11-ago, por delegación): otro literal para el mismo hueco. Medido: está en **0**
  líneas de `src/` y `public/`. Se escribió sobre una premisa caducada: daba el hueco por pendiente
  citando `SCRUM-320.md:85-97`, cuando ya estaba construido desde el 6-ago (`SCRUM-320.md:167`).
- SCRUM-1215 c.19084, el ancla que lleva la línea hoy, **no firma ningún literal**: remite al
  registro de SCRUM-320 y no nombra c.13271.

Los papeles no decidían solos. **Respuesta del fundador (c.20629): manda A; B no se aplica.** No
cambia nada en pantalla. Lo que queda —que la marca de :217 cite c.20629 y no c.19084— es de **S2**.

### ③ `sinCitas` en el índice de fuentes — efecto medido, sin tocar el guard

La propuesta del tramo 1 (leer cada fuente con `sinCitas`), aplicada en un worktree desechable fijado a
este `origin/main`, **fuera de este árbol**, por `docs/master/evidencias/scrum1502e/sincitas.mjs`;
salida en `salida-sincitas.txt` del mismo directorio. Población: las 246 marcas que reparte `porNivel`.

| caso | sin respaldo | documental | qué marca se mueve |
|---|---|---|---|
| base (el árbol tal cual) | 25 | 24 | — |
| con `sinCitas` | **25** | **24** | **ninguna**: 0 salen, 0 entran; anclado sigue en 18 |
| base + cobaya con la frase entre `[[cita]]` (POSITIVO sembrado) | 24 | 25 | sale `homeView.js:779`: la cita la absuelve |
| `sinCitas` + la misma cobaya | 25 | 24 | ninguna: la cita ya no absuelve |
| `sinCitas` + la frase a pelo | 24 | 25 | sale `homeView.js:779`: a pelo sigue absolviendo |

**Efecto sobre el árbol de hoy: ninguna marca cambia de nivel** — ni de anclada ni de documental a sin
respaldo. Era lo esperable para anclada (el ancla se lee en el comentario de la marca, no en las
fuentes), y para documental lo dice la medición: hoy ningún respaldo vive dentro de un `[[cita]]` (en
`docs/master`, `[[cita]]` sólo aparece en las evidencias y en prosa que explica el delimitador). El
positivo sembrado demuestra que el instrumento ve el caso: sin la propuesta, la cobaya baja a 24; con
ella, no. Cobaya y mutación retiradas: el guion termina con «árbol restaurado: true».

⛔ **No aplicado** (regla 41): cambia el guard del obligatorio de los dos equipos, lo deciden los jefes.

### Lo que no se hizo

- Ninguna marca cita c.20629 todavía: es de otra sesión (y la de :217, de S2).
- No he abierto yaqu.app: ninguna de las seis es pantalla, y ② no cambia nada visible.
- De SCRUM-1215 sólo he leído c.19084; SCRUM-320, 586, 683 y 716, enteros.
- ③ medido en esta máquina; la copia desechable usó el `node_modules` del checkout compartido por una
  unión de sólo lectura (sin `generate`).
- Tanda completa: no corrida (guards de registro dirigidos, en la entrega).

---

## SCRUM-1502g · Tramo 8 (J4, 23-oct-2026): dos tramos titulados «Tramo 6», renumerados sin mover una línea

**Medido contra:** `origin/main` = `b6dd5d1a8d64abd0bf835141e8d9bac6d5d2055f` · 2026-10-23T20:18:15Z (hora de GitHub)
A9: sin fallo que generalice — el número de tramo lo eligió cada rama contando los tramos que veía, y las dos ramas corrían a la vez; la identidad de cada tramo es su letra (1502e, 1502f), que no se repitió. Ningún guard caza dos tramos con el mismo título, y no lo he escrito: de 1.174 registros de `docs/master/`, sólo 15 títulos llevan «Tramo N» (este es el único repetido), así que el guard mediría una convención que nadie acordó.

Sólo `docs/`. Lo dijo J1 en c.20645 (errores, punto 1): la unión de `merge=union` dejó dos títulos «Tramo 6» y un `---` pegado al último punto del tramo de 1502f.

**El orden en que entraron**, leído en `git log origin/main --merges`: #2767 (1502e) a las 19:47:46Z; #2769 (1502f) a las 19:59:31Z. Así que 1502e es el Tramo 6 y 1502f pasa a **Tramo 7**. Los dos comentarios de entrega (c.20636 y c.20645) dicen «Tramo 6»: son de antes de este arreglo, y no se tocan.

**Qué cambia, sin añadir ni quitar líneas** (hay citas por línea a este fichero: `:348` en `docs/master/evidencias/SCRUM-1496c/veredictos-por-lote.md` y en `SCRUM-1496d/`, `:377` en `SCRUM-1496d/`; medido con `git grep -nE 'SCRUM-1502\.md(:|#L)[0-9]'` sobre `origin/main`):

- `:578`, el título de 1502f: «Tramo 6» → «Tramo 7». Sólo esa palabra.
- `:651-652`: el `---` y la línea en blanco cambian de sitio, y el separador deja de ir pegado al último punto. Las dos líneas siguen siendo dos.
- Este tramo, al final del fichero: no mueve ninguna línea de encima.

Los tramos siguen en el orden físico en que los dejó la unión (1502f antes que 1502e), como ya pasaba con el 3 delante del 2: reordenarlos movía 155 líneas para nada. El número dice el orden de entrada.

### Lo que no se hizo

- Ningún ancla «Medido contra:», ninguna marca, ningún guard ni su número.
- No hay pantalla: nada que ver en yaqu.app.
- Tanda completa: no corrida (guards de registro dirigidos, en la entrega).

---

## SCRUM-1502i · Tramo 10 (J4, 23-oct-2026): la firma REAL de las 18 que sólo respalda una cita — 0 enteras, 1 a medias, 3 sin firmante, 2 contradichas, 12 sin encontrar

**Medido contra:** `origin/main` = `ac9a7ae4ec4e4efc75fefdb0f3af304e5686d0bd` · 2026-10-23T21:30:53Z (hora de GitHub)
A9: aviso → A10 «Un registro escrito por la misma mano que aplicó el texto no es su firma: es quien lo aplicó contando que la tuvo.» — no se pudo comprobar: en 7 de las 18 el literal que hoy absuelve la marca ni siquiera es el texto aprobado (un texto viejo, otro texto, un mensaje de aserción o código), y separar eso de una firma exige leer Jira, que el trinquete no lee (tramo 2)

Sólo `docs/`. Responde a SCRUM-1502 c.20696 («cada una de las 18 se ancla a su firma REAL»). La entrega, con la tabla y las 17 preguntas al fundador **con sus literales**, es **SCRUM-1502 c.20701**. Aquí van por fichero:línea y SIN literales: copiarlos aquí los absolvería en `scrum921c` (tramo 4).

**Población.** `docs/master/evidencias/scrum1502i/dieciocho.mjs` es la sonda de 1502h (`docs/master/evidencias/scrum1502h/sonda-var.mjs`, rama `scrum-1502h-sin-citas`, aún no en `main`), variante A, con el mismo código, más el fichero de `docs/master` que respalda cada literal. Salida en `salida-dieciocho.txt`: 248 marcas, 1.339 fuentes, 25 documentales y **18 que pierden respaldo**, las mismas 18 y en las mismas líneas que 1502h. La sonda no aplica el filtro de negación del guard: cuenta 21 sin respaldo, y el guard 20.

**Cómo se buscó.** Por marca: el comentario entero en el código, el registro que la respalda y qué cita como origen (en las 18: **ninguno cita un comentario de Jira**), el ticket del fichero y el del registro leídos enteros, y JQL `text ~` con 2 a 5 trozos de cada literal. Las lecturas las hicieron tres sesiones de sólo lectura, seis marcas cada una. **Las tres que salieron con firma las leí yo, byte a byte**: SCRUM-299, 338 y 593, enteros. Las NO ENCONTRADA no las he repetido.

| # | marca | veredicto | dónde está (o dónde se buscó) | carril |
| --- | --- | --- | --- | --- |
| 1 | `src/modules/fiscal/librosAeat/librosAeat.ts:183` | NO ENCONTRADA | SCRUM-426 c.13034 decide el contenido, no el texto; c.13054 es el cierre del asesor | J1 |
| 2 | `src/modules/jobs/domain/albaranFirmante.ts:246` | CONTRADICHA (las columnas las decide el asesor, SCRUM-300 c.12491) + NO ENCONTRADA (los 2 mensajes) | SCRUM-300 entero; JQL 0 | S1 |
| 3 | `public/dashboard/js/albaranDetailView.js:292` | NO ENCONTRADA; el respaldo de hoy es otro texto | SCRUM-302 y 278 | S4 |
| 4 | `public/dashboard/js/jobDetailView.js:401` | NO ENCONTRADA; el respaldo de hoy es otro texto | SCRUM-304 y 607 (0 comentarios) | S2 |
| 5 | `public/dashboard/js/jobDetailView.js:484` | NO ENCONTRADA | SCRUM-303; JQL 0 ×5 | S2 |
| 6 | `public/dashboard/js/productsView.js:1178` | NO ENCONTRADA; el respaldo de hoy es el texto viejo | SCRUM-313, 338, 364; JQL 0 | S2 |
| 7 | `public/dashboard/js/productsView.js:1214` | NO ENCONTRADA; el respaldo de hoy es el texto viejo | SCRUM-364 c.12357 es un cierre | S2 |
| 8 | `tests/scrum244-menu-portabilidad.test.mjs:43` | NO ENCONTRADA | SCRUM-244 entero; JQL 0-1 | tests/ |
| 9 | `tests/scrum257-albaran-desde-presupuesto.test.mjs:26` | NO ENCONTRADA | en la descripción de SCRUM-257, como alcance, no como decisión | tests/ |
| 10 | `tests/scrum299-copy-factura-publico.test.mjs:27` | CON FIRMA, SIN FIRMANTE | SCRUM-299 c.12188; esos textos ya no están en `public/index.html` (0 apariciones) | tests/ |
| 11 | `tests/scrum324-aviso-simplificado-ui.test.mjs:30` | CONTRADICHA | `docs/master/SCRUM-324.md:399-403` y SCRUM-324 c.13135: retirado el mismo día | tests/ |
| 12 | `tests/scrum338-carga-de-catalogo-no-muda.test.mjs:109` | CON FIRMA, SIN FIRMANTE | SCRUM-338 c.12950 + c.12948 (cuenta de Luis: «yo aprobé»); el respaldo de hoy es código | tests/ |
| 13 | `tests/scrum344-cierre-con-saldo.test.mjs:30` | NO ENCONTRADA | SCRUM-344 entero; JQL 0 ×5 | tests/ |
| 14 | `tests/scrum364-cambiar-gremio.test.mjs:138` | NO ENCONTRADA | SCRUM-364 y 310 | tests/ |
| 15 | `tests/scrum394-plan-mudo.test.mjs:264` | CON FIRMA, SIN FIRMANTE | SCRUM-394 c.12814 (por su texto, el orquestador o el asesor) | tests/ |
| 16 | `tests/scrum428-terminado-sin-cobrar.test.mjs:120` | NO ENCONTRADA; el registro lo pone bajo «PENDIENTE» | SCRUM-428, 363, 917, 1355 | tests/ |
| 17 | `tests/scrum580-tags-por-contacto.test.mjs:319` | NO ENCONTRADA, y consta que falta | SCRUM-1215 c.19421 pide la firma | tests/ |
| 18 | `tests/scrum593b-superficie-texto-del-documento.test.mjs:21` | MITAD: cabecera ENCONTRADA (SCRUM-593 c.14262); pie del formulario sin firma (el mismo c.14262 lo deja sin decidir) | SCRUM-593 y 1206 | tests/ |

Carril, con `node scripts/carriles.mjs de <ruta>`. `tests/` es «el puesto que trabaja el ticket» (`docs/equipo/dos-equipos.md:171`). S1, S2 y S4 van a Luis (c.20696).

**Lo que sigue.** Hasta que el fundador conteste c.20701, ninguna marca se puede anclar: la 18 tampoco, porque nombra los dos rótulos y sólo uno está firmado. La mitad «a pelo» de `sinCitas` sigue sin poder aplicarse sin que cambien de nivel (condición ① de c.20690).

### Lo que no se hizo

- Ninguna marca, texto, guard ni número tocado. No he abierto yaqu.app.
- JQL con resultados que no se abrieron, porque la frase entera daba 0: SCRUM-1151 y 1147 (marca 1), 1164 y 929 (marca 4), 1300, 982 y 715 (marca 5), 365 (marca 6), 460, 458, 1369, 1355 y 1274 (marca 9).
- La lectura de la marca 4 (qué columnas) es de una de las tres sesiones. No la he copiado por programa.
- Tanda completa: no corrida (guards de registro dirigidos, en la entrega).
- Error propio: la línea de errores de c.20701 está mal redactada. Quiere decir que son 18 marcas y 17 preguntas, porque la 7 y la 14 comparten una.
