# SCRUM-1337 · La Parte S1 del máster dice qué VE el Técnico en Inicio

**Medido contra:** `origin/main` = `01d99084936c73ce975d708c31397281ebc1538f` · 2026-10-01T06:27:26Z

A9: sin fallo que generalice — los tropiezos de la tanda (§Ⓖ) son de cómo lancé y conté mis propias mediciones, y a cada uno lo paró algo en el momento: el arnés, el `ERR_MODULE_NOT_FOUND`, la cabecera de GitHub y el recuento del guion. Ninguno llegó al máster ni al registro.

Sesión J2g (puesto J2, equipo de Javier), por encargo del orquestador del equipo de Javier
(`cobroflash-backend-5b`). **Cruce de carril declarado en el encargo:** el ticket lleva `area-j4` y
J4c está con SCRUM-1317; aquí sólo se toca el máster y este registro. Lo cojo en el comentario 17786.

## Ⓐ Quién firma qué

Es un cambio de máster (regla 27). **Yo no se lo he oído a Javier:** lo leo en la descripción del
ticket, escrita por el orquestador, y Jira publica todo bajo la cuenta de Javier.

| Qué | Literal | Dónde lo leo |
|---|---|---|
| La decisión de producto del fundador, 1-oct-2026 | «Sí el operario ve la actividad de sus compañeros» | descripción de SCRUM-1337 |
| La firma del cambio de máster, del fundador | «1-Firmo» | descripción de SCRUM-1337 |
| El hueco, dicho por el fundador el 22-jul-2026 | «la tabla S1 cubre qué puede hacer, no qué puede ver» | SCRUM-55 comentario 10699, citado en la descripción |
| «Cotizaciones sin respuesta» entra en la fila de abajo | decisión del **orquestador** | SCRUM-1337 comentario 17781 |
| La cuarta fila, «Herramientas de administración de la cuenta» | decisión del **orquestador**, no del fundador | SCRUM-1337 comentario 17788 (me llegó antes por mensaje; pedí el número y lo leí en Jira) |

La cuarta fila no la firmó el fundador y **el máster lo dice en la misma inserción**, con las
palabras del orquestador. Lo único mío en esa línea es el arranque «La fila de las herramientas de
administración:», para que se sepa a cuál se refiere; el orquestador lo aprueba en ese mismo
comentario 17788.

## Ⓑ Qué se ha cambiado

**Catorce líneas insertadas en `docs/YAQU_MASTER.md`, Parte S1, y nada más:** entre la línea «Ruta
nueva = declara rol mínimo; default Admin-only…» (la 668) y el bloque `> ✅ SCRUM-147` (era la 669,
pasa a la 683). El título, la tabla de seis líneas, la frase firmada, el paréntesis de autoría de la
cuarta fila, y cinco líneas en blanco para que Markdown no pegue un bloque con otro.

| Comprobación | Resultado |
|---|---|
| `git diff --numstat` del máster contra `origin/main` | 14 altas · 0 bajas |
| Quitando el tramo insertado, ¿queda el original? | sí, byte a byte (lo exige el guion antes de escribir) |
| Las dos anclas | casan una vez cada una y eran consecutivas |
| Fin de línea y BOM | LF en las 1.886 líneas (pasan a 1.900), sin BOM; se conserva |
| Tamaño | de 501.920 a 503.057 bytes |

El guion es `docs/evidencias/scrum1337/insertar-s1.mjs.txt`. El texto no lo redacté: está copiado
de la descripción del ticket, con la fila de abajo del comentario 17781 y la cuarta fila del
orquestador.

**No se ha tocado ninguna otra parte del máster**, ni `adminRouteDeclarations.ts`, ni nada de `src/`
o `public/`.

## Ⓒ El control que pedía el encargo: la tabla contra el Inicio de SCRUM-1317

SCRUM-1317 no está en `main`. Lo leí en la rama local de J4c
(`scrum-1317-inicio-del-operario-y-cierre-admin`, commit `4547d6e5`) con `git show`, sin tocar su
árbol, y contra su medición en Edge sobre el commit `5a0fd1dd`.

| Fila de la tabla | Técnico | Lo que hace su código | ¿Coincide? |
|---|---|---|---|
| Saludo · avisos de riesgo · acciones rápidas · «Te esperan en WhatsApp» · globos | ✅ | se pintan sin mirar el rol; los globos salen de su ruta propia; Edge: acciones sí, globos 1/5/3 | sí |
| Actividad reciente (últimos presupuestos, con importe) | ✅ | `getInicioOperario` devuelve los 5 últimos presupuestos del merchant con `total`; Edge: actividad sí | sí |
| Héroe · cobrado / gastos / beneficio · semana · tops · «Cotizaciones sin respuesta» | ❌ | el héroe no se pinta (alto 0 px) y los bloques `kpis`, `week` y `tops` se quitan del DOM; «Cotizaciones sin respuesta» es la primera tarjeta de `kpis` | sí |
| Herramientas de administración: «⚙ Personalizar», lista de puesta en marcha, aviso del trimestre | ❌ | las tres miran `appUserRole` | sí |

**La premisa de la frase firmada, medida.** «Esos mismos presupuestos ya los tiene en la pantalla
de Presupuestos»: `src/modules/quotes` no menciona el rol en ninguno de sus 18 ficheros (`userRole`,
`seesAll`, `operarioId`: 0), con control positivo — el mismo patrón sí encuentra `seesAllJobs` en
`jobs.routes.ts`. No hay filtro por operario en presupuestos. Se sostiene.

**«Ya eran sólo-admin antes de SCRUM-1317», medido en `main`.** «Personalizar» y la lista de puesta
en marcha miran el rol en el front (`public/dashboard/js/homeView.js`, líneas 16 y 396 de `main`).
El aviso del trimestre **no**: en `main` el front lo pide igual para el Técnico y lo que lo cierra es
el 403 de `/admin/reports/*` (el `catch` no pinta nada). Por efecto vale para las tres; por mecanismo,
la tercera la cierra el servidor y es SCRUM-1317 quien pone la guarda en el front.

## Ⓓ Lo que la tabla NO dice, y está pendiente del fundador

**«Rendimiento del equipo»** (`renderTeamPerformance`, línea 706 de `homeView.js` en `main`; pide
`/admin/metrics/team`). Es sólo-admin hoy, en `main` y en la rama de SCRUM-1317, y **la tabla no lo
nombra en ningún sentido**.

Por qué pesa: la frase firmada es «Sí el operario ve la actividad de sus compañeros», la tabla la
aterriza en los últimos presupuestos, y el bloque que más literalmente es actividad de compañeros
sigue cerrado al Técnico sin que el máster lo diga.

Y el dato que hace que no sea mecánico, que midió el orquestador y he leído yo en el fuente:
`getTeamMetrics` (`src/modules/metrics/domain/metrics.service.ts`) consulta las facturas **pagadas**
del mes con su `total` y las reparte por compañero. Es **dinero cobrado por persona**, y la tercera
fila de la tabla firmada pone lo cobrado en ❌ para el Técnico. Abrir ese bloque tal cual chocaría
con esa fila. (Leído, no ejecutado.)

El orquestador se lo ha llevado al fundador con esa medición delante; al escribir esto no hay
respuesta que se pueda escribir. **No lo he metido en la tabla ni como ✅ ni como ❌.** Entrará con
su número cuando conste.

🔴 **SCRUM-1337 no se cierra con este PR**: le falta esa línea (orden del orquestador).

## Ⓔ Consecuencia conocida: catorce líneas más abajo

Insertar en la 669 baja 14 posiciones todo lo que hay después. Quién cita el máster por número de
línea (`docs/evidencias/scrum1337/citas-master.mjs.txt`, sobre el árbol de `bee39d3b`):

| | |
|---|---|
| Población | 4.474 ficheros seguidos, 3.788 de texto leídos, 0 ilegibles |
| Citas `YAQU_MASTER.md:<n>` | 106 |
| Con línea mayor que 668 | 38: 22 en `docs/master/`, 9 en `docs/legal/`, 7 en código y tests |

Las 7 de código y tests: `registro.builder.ts` (1328-1331), `scrum216` (dos veces, 1328-1331),
`scrum390` (dos veces, 1472), `scrum710b` (1472) y `_respaldo-de-firma.mjs` (1353). **Ninguna
resuelve la línea**: son comentarios o cadenas. Los 16 ficheros de `tests/` que leen el máster dan
178 casos de 178 antes de insertar y 178 de 178 después.

**Y ya estaban desfasadas antes de este cambio:** hoy la 1328 del máster habla de SCRUM-271 y la
1472 de un test de rutas, no del dictamen ni de la regla de datos que sus citas dicen. Este inserto
no las rompe: las aleja 14 líneas más. **No he renumerado ninguna** — tampoco el censo congelado de
SCRUM-612, que el orquestador pidió dejar como está — porque renumerar a mano un registro lo separa
de la medición que dice haber hecho. Arreglarlo de verdad es citar por identidad, y es otro ticket.

## Ⓕ Lo que NO está hecho

- La línea de «Rendimiento del equipo» (§Ⓓ).
- La tanda completa no se ha corrido en local: el cambio es de documentación y el turno lo tienen
  otras sesiones. Corrido: los 16 que leen el máster, los guards de registro y `guards:entrada`.
- Un comentario de la rama de SCRUM-1317 (`getInicioOperario`) dice que la decisión sobre la
  actividad de los compañeros «sigue pendiente desde SCRUM-55». Con este cambio deja de ser verdad.
  Es del carril de J4c: avisado al orquestador, no tocado.

## Ⓖ Lo que me salió mal

1. Corrí la base de los 16 guards **sin `dist/`** en un árbol recién creado: 3 ficheros «rojos» que
   eran `ERR_MODULE_NOT_FOUND`. Lo vi al leer el motivo antes de contarlos; emití `dist` y repetí.
2. Tres órdenes rechazadas por el arnés por llevar variables o `--test-force-exit` en línea. Acabé
   con un lanzador escrito a fichero, que es lo que la memoria del puesto ya decía que hiciera.
3. En un mensaje al orquestador puse «~06:35Z» **a ojo**; la cabecera de GitHub decía 06:27Z un
   momento después. La hora de este registro sí sale de la cabecera.
4. En ese mismo mensaje dije «4 en blanco»: son cinco. El total, 14, sí lo había medido.

# SCRUM-1337b · «Rendimiento del equipo»: la nota con la decisión firmada y su ticket

**Medido contra:** `origin/main` = `eb3d3b367e62e95ca86c217a0a39a32764200075` · 2026-10-01T06:51:11Z

A9: sin fallo que generalice — mis tropiezos de esta tanda (§⑥) los paró algo en el momento: el arnés, el bloqueo del árbol de J2g, bash, y leer el ticket antes de nombrarlo. Ninguno llegó al máster.

Sesión J2h (puesto J2, equipo de Javier, relevo de J2g), por encargo del orquestador del equipo de
Javier (`cobroflash-backend-5b`). El cruce de carril es el mismo que declara la sección de arriba.
El PR #2060 (lo de arriba) entró en `main` a las 06:41:44Z, commit de merge
`5de9464f6064d9caaa6408cfb88615f7ce461c3b`; por eso esto va en rama y PR aparte.

## ① Qué faltaba y qué contestó el fundador

La sección Ⓓ de arriba deja «Rendimiento del equipo» fuera de la tabla, pendiente del fundador.
Ya consta, en el comentario 17795 de SCRUM-1337 (lo escribe el orquestador; **yo no se lo he oído a
Javier**, lo leo ahí):

| Qué | Literal | Dónde lo leo |
|---|---|---|
| Primera respuesta del fundador | «Lo ve» | SCRUM-1337 comentario 17795 |
| Por qué no se escribió | `getTeamMetrics` reparte lo cobrado del mes por compañero, y lo cobrado va en ❌ en la fila firmada | comentario 17795, y §③ de aquí |
| Segunda respuesta, con ese dato delante | «1-B» | comentario 17795 y descripción de SCRUM-1341 |
| Qué significa la B | el Técnico ve la actividad de sus compañeros SIN importes | comentario 17795 |
| Dónde se construye | SCRUM-1341 (abierto, sin empezar al escribir esto) | Jira |

## ② Qué se ha cambiado

**Dos líneas más en `docs/YAQU_MASTER.md`, Parte S1, y ninguna otra:** una en blanco y la nota,
justo debajo del paréntesis de autoría de la cuarta fila y antes del bloque `> ✅ SCRUM-147`.

**La tabla no cambia.** «Rendimiento del equipo» no entra ni como ✅ ni como fila: la tabla dice lo
que ES, y lo decidido no está construido. Un ✅ haría falsa la tabla (es el defecto que corrigió
SCRUM-1319 en la línea de SIF-1). Cuando SCRUM-1341 se construya, la nota pasa a fila.

**Quién ha escrito la nota.** El orquestador mandó QUÉ tiene que decir (encargo y comentario 17795):
que hoy es sólo-admin, la decisión firmada y el número del ticket. **La redacción es mía**, hecha
con sus frases; el literal «1-B» está copiado, no reescrito. Sus dos textos no decían lo mismo
sobre la forma —el comentario 17795 dice «no entra en la tabla» y «la nota pasa a fila»; la
descripción de SCRUM-1341 dice «→ ❌ para el Técnico, más una nota»— y elegí **nota sola que dice
el ❌ dentro**, que cumple los dos sin añadir una fila que SCRUM-1341 tendría que partir en dos.
Se lo propuse al orquestador por mensaje a las 06:39Z con el literal entero.

| Comprobación | Resultado |
|---|---|
| `git diff --numstat` del máster contra el `main` de antes de mi cambio | 2 altas · 0 bajas |
| El mismo, contra el `main` de antes de SCRUM-1337 (`01d99084`) | 16 altas · 0 bajas |
| Líneas borradas o cambiadas en el diff | 0 |
| Fin de línea y BOM | LF, sin BOM; se conserva |
| Tamaño | de 1.900 a 1.902 líneas; de 503.057 a 503.410 bytes |
| Dónde queda el bloque `> ✅ SCRUM-147` | era la 669, pasó a la 683 con #2060 y ahora es la 685 |

## ③ Lo que la nota afirma de HOY, ejecutado

J2g dejó dicho que lo de `getTeamMetrics` estaba **leído, no ejecutado**. Ahora está ejecutado, las
dos mitades, sin servidor y sin tocar ninguna base:

**La puerta** (`docs/evidencias/scrum1337/sonda-team.mjs.txt`): carga el router real de métricas
desde `dist/` (7 rutas) y le pasa una petición fabricada a la primera mano de `GET /team`.

| Rol | Estado | ¿Pasa a la mano siguiente? |
|---|---|---|
| `tecnico` | 403, `required_role: admin` | no |
| `admin` (control positivo) | ninguno | sí |
| `comercial` (rol desconocido) | 403 | no |

Lo que **no** mide: una sesión real por HTTP. Es la puerta de la ruta, no la cookie.

**El contenido** (`docs/evidencias/scrum1337/sonda-ensamblado.mjs.txt`): la función pura real
`ensamblarMetricasEquipo` con dos compañeros fabricados. Hay dinero en **cuatro** sitios de la
respuesta, no en uno:

| Dónde | Qué es |
|---|---|
| `members[].collected` | lo cobrado del mes por compañero |
| `sinAsignar.collected` | lo cobrado sin presupuesto |
| `totalCollected` | el total cobrado del negocio |
| `members[].isBest` | la estrella «Mejor del mes»: **cambia de persona con sólo cambiar lo cobrado** (Ana 100 y Blas 900 → Blas; al revés → Ana), aunque Ana mande y cierre más presupuestos en los dos casos |

El orden de las filas no cambió con lo cobrado en ese caso (un caso, dos pasadas: no prueba que
nunca cambie). Esto es para quien coja SCRUM-1341: quitar el campo del importe no basta, porque la
estrella dice quién cobró más.

**Una palabra que no cuadra.** El título de SCRUM-1341 y el encargo dicen «el facturado del mes».
El código filtra las facturas pagadas, por su fecha de pago dentro del mes, y la columna de la
pantalla se llama «Cobrado»: es lo **cobrado**. No cambia la decisión (choca igual con la fila
firmada), pero el ticket dice una palabra y el código otra.

## ④ El desplazamiento, re-medido

J2g midió +14. Con la nota es **+16** para todo lo que estaba por debajo de la línea 668 antes de
SCRUM-1337. Censo de citas por número de línea, con el mismo guion de la sección Ⓔ
(`citas-master.mjs.txt`), sobre este árbol:

| | J2g, sobre `bee39d3b` | ahora, sobre `eb3d3b36` más la nota |
|---|---|---|
| Ficheros seguidos · de texto leídos · ilegibles | 4.474 · 3.788 · 0 | 4.505 · 3.817 · 0 |
| Citas al máster por número de línea | 106 | 106 |
| Con línea mayor que 668 | 38 | 38 |
| Con línea entre 669 y 681 (el tramo insertado) | sin medir | 0: con corte 681 salen las mismas 38 |

Las 38 quedan 16 líneas más lejos en vez de 14. Siguen sin tocarse, por lo mismo que dice la
sección Ⓔ: ya apuntaban a otra cosa antes, y ninguna resuelve la línea.

## ⑤ Lo corrido

Lanzador en `docs/evidencias/scrum1337/lanzar-1337b.mjs.txt` (entorno sin `FORCE_COLOR`, TAP fuera
del árbol, población y código de salida a la vista). `dist/` emitido con `tsc --noCheck`: `src/` no
cambia entre `2ef69c97` y este árbol.

| Pasada | Ficheros | Casos | Caídos | Saltos | Salida |
|---|---|---|---|---|---|
| Base, antes de la nota (árbol de `5de9464f`) | 21 | 224 | 0 | 0 | 0 |
| Con la nota (árbol de `eb3d3b36`), más `scrum55` | 22 | 229 | 0 | 0 | 0 |

Los 22: los 16 de `tests/` que leen el máster, los de registro (`scrum267`, `273`, `649`, `854`,
`1294`, `976`) y `scrum55`. **La tanda completa no se ha corrido en local** (el turno lo tiene otra
sesión y el cambio es de documentación); la cubre el CI del PR.

**El CI de #2060, leído** (run 36825246476, probó el merge de `2ef69c97` sobre `01d99084`):

| Job | Resultado |
|---|---|
| build + tests (el obligatorio) | verde: 9.551 casos, 9.453 pasan, 0 caen, 98 saltos |
| meta-guard | verde: 361 líneas de guard que cae, ninguna ciega ni caída |
| navegador · zona roja · constancia del ALTER | verdes |
| trinquete de zona | **rojo**, y no es de este cambio: tres casos de `scrum524b` salen `pass` en una zona y **ausentes** en la otra. Es la firma que mide SCRUM-1335 (casos que se pierden en el job de zona), no un caso que pasa en una zona y cae en la otra. El único de esa segunda clase (`scrum592`) está censado. |

## ⑥ Lo que me salió mal

1. Intenté entrar en el árbol de J2g y estaba bloqueado por su sesión, que seguía viva. El arnés lo
   paró; trabajé en un árbol propio. No toqué `cobroflash-jv-j2`.
2. Encadené tres órdenes de git en una sola y el arnés la rechazó. La memoria del puesto ya lo
   decía (órdenes planas, una cada vez).
3. Quise anexar esta sección con un heredoc de bash y reventó en la primera comilla. También estaba
   en la memoria del puesto («no pasar texto por bash»). El registro no llegó a tocarse: lo comprobé
   antes de reintentar con la herramienta de edición.
4. Iba a llamar al rojo del trinquete «el de SCRUM-1339», que es como venía en el encargo. Leí el
   ticket antes de escribirlo: 1339 pregunta por el check obligatorio; el job de zona es SCRUM-1335.
5. Le dije al orquestador que, si #2060 seguía abierto, empujaría a la misma rama. Entró dos minutos
   después y fue rama nueva.

## ⑦ Lo que NO está hecho

- SCRUM-1341 no está empezado: aquí sólo se deja escrita la decisión.
- El control que pedía el ticket contra el Inicio de SCRUM-1317 lo hizo J2g sobre un commit local de
  J4c. SCRUM-1317 sigue sin estar en `main` al escribir esto; no lo he repetido.
- La pantalla (`renderTeamPerformance`) la he leído, no la he abierto en un navegador.
