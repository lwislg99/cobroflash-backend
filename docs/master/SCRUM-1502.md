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
