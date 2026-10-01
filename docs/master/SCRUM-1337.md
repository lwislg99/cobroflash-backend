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
| La cuarta fila, «Herramientas de administración de la cuenta» | decisión del **orquestador**, no del fundador | mensaje del orquestador a esta sesión, 1-oct-2026; **sin comentario numerado en Jira al escribir esto** (se lo he pedido) |

La cuarta fila no la firmó el fundador y **el máster lo dice en la misma inserción**, con las
palabras del orquestador. Lo único mío en esa línea es el arranque «La fila de las herramientas de
administración:», para que se sepa a cuál se refiere.

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
sigue cerrado al Técnico sin que el máster lo diga. El orquestador se lo ha preguntado al fundador;
al escribir esto no hay respuesta que se pueda escribir. **No lo he metido en la tabla ni como ✅ ni
como ❌.** Entrará con su número cuando conste.

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
