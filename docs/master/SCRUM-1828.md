# SCRUM-1828b

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar la vista). Sin tokens, clases ni componentes nuevos: cambia solo el texto del aviso de `setAlert` (que ya escribe por `textContent`, `settingsView.js:236`).

**Medido contra:** `origin/main` = `6fbcde28651d2eed9190ced9efbc7663d8cdac7a` · 2026-11-24T11:54:42Z

Primera mitad de SCRUM-1828 (jv-j3cw, J3). Medición: c.22596 (jv-j3cv). Decisión del fundador: c.22597 («Cuenta como aprobado»: el respaldo del helper es el rótulo que cada sitio ya pinta, sin «: » y sin el crudo; ningún texto nuevo).

| qué | esperado | visto |
|---|---|---|
| `settingsView.js:1000` (`loadMerchant`), 500 al cargar | «No se han podido cargar los datos» | antes: «No se han podido cargar los datos: API 500: internal_error» · después: el rótulo solo (`tests/scrum1828b-ajustes-carga-y-guardado-sin-crudo.test.mjs`) |
| `settingsView.js:1208` (guardar), 500 al guardar | «Error al guardar» | antes: rojo en el mismo test · después: el rótulo solo |
| control: guardado que sale | «Datos de empresa guardados correctamente.» | igual antes y después |

Arreglo: `mensajeParaPersona(err, "<rótulo>")` (`public/dashboard/js/api.js:333`). Si el servidor manda `data.message`, se pinta esa frase (regla del helper); si no, el rótulo. Nota: el plan de c.22596 proponía `rótulo + ': ' + frase`; se sigue la decisión literal de c.22597 (el rótulo como respaldo).

**Techo de `settingsView.js` en el censo de SCRUM-644** (`tests/scrum644-trinquete-mensaje-crudo.test.mjs`): 3 → 1. Queda `:783` (vista previa del resumen semanal), que es de la segunda mitad (:783, :1603, :1696, :1872), junto con el censo de 1233.

`tests/scrum1536d-forales-y-canarias-fuera.test.mjs`: su control «cualquier otro error cae en el aviso de siempre» fijaba el texto crudo viejo; ahora espera «Error al guardar». No es relajar un guard: el control afirmaba justo el defecto que c.22597 manda quitar.

Verde en local (TAP fuera del árbol): los 55 ficheros de `scrum644*`, `scrum1233*`, el test nuevo y los que nombran `settingsView` → 505 casos, 504 pass y 1 fail (el control de 1536d de arriba); tras corregirlo, 1536d + test nuevo + 644 + 1415 + 719 → 64 de 64. **NO corrido:** la suite entera (orden del encargo), 1294, 267, 854 y 811c sueltos (sí `guards:entrada`); `tsc -p .` con tipos no se corrió: el cambio no toca `src/`.

Mutaciones: catálogo → `tests/scrum1828b-ajustes-carga-y-guardado-sin-crudo.test.mjs`

A9: aviso → cicatriz J3 «Tercera vez que corro un test en un árbol anidado sin dist: la misma orden me dijo NO-DIST y lo corrí igual, con 3 rojos de Cannot find module.» — no se pudo comprobar: qué tiene construido el árbol antes de una tanda es cómo trabaja la sesión y ningún test del árbol lo ve; lo cazó leer el «Cannot find module ../dist» del primer rojo antes de contarlo.

# SCRUM-1828c

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar la vista; después de escribir el test). Sin tokens, clases ni componentes nuevos: cambia solo el texto de cuatro avisos de error, que ya se pintaban por `textContent`.

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:09:43Z

La segunda mitad (decisión del fundador SCRUM-1828 c.22597; medición c.22596). En `public/dashboard/js/settingsView.js` (J3), los cuatro sitios que quedaban pasan por `mensajeParaPersona` con el rótulo que cada uno ya pintaba, sin «: » y sin el crudo. Ningún texto nuevo:

| sitio | qué | esperado | visto antes (rojo) | visto después |
|---|---|---|---|---|
| :783 | vista previa del resumen semanal, 500 | «No se pudo cargar la vista previa» | «No se pudo cargar la vista previa: API 500: internal_error» | el esperado |
| :1603 | guardar la página pública, 500 con `message` en blanco | «No se pudo guardar. Inténtalo de nuevo.» | «   » | el esperado |
| :1696 | QR del perfil, 500 con `message` en blanco (`mensajeParaPersona({ data: cuerpo }, QR_COPY.errorGenerico)`) | `QR_COPY.errorGenerico` | «  » | el esperado |
| :1872 | eliminar los datos de ejemplo, 500 | «No se pudo eliminar» | «No se pudo eliminar: API 500: internal_error» | el esperado |
| control | el borrado que sí sale | «Listo. Hemos eliminado 1 clientes, 2 presupuestos y 3 facturas de ejemplo.» | el esperado | el esperado |

Ojo con :1603 y :1696: con un 500 SIN `message` ya pintaban su rótulo (c.22596 ya lo decía). Su rojo es la frase en blanco del servidor, que antes salía tal cual; es lo único que cambia en ellos.

Test: `tests/scrum1828c-ajustes-los-cuatro-sin-crudo.test.mjs` (banco de vistas, `apiRequest` real). Rojo antes: 4 de 5 cayeron (el control, verde). Después: 5 de 5.

Techos: `tests/scrum644-trinquete-mensaje-crudo.test.mjs`, `settingsView.js` 1 → 0 (sale de `CENSO_HEREDADO`). `tests/scrum1233-mensaje-para-persona.test.mjs`, `settingsView.js` 3 → 0 (sale de `TECHO` y entra en la lista de los que se quedan en cero); `TOTAL_MEDIDO` 13 → 10, que es la suma de la tabla que queda.

Verde en local, antes del merge con main: 10 ficheros (el nuevo, 1828b, 644, los seis 1233*, 1536d) → 70 casos, 70 bien, 0 «not ok». **NO corrido:** la suite entera, los otros 41 ficheros que nombran `settingsView`, 1415, 1294, 267, 854, 811c, 719 y el censo de mudez. Paré porque pasaba el tope de contexto del encargo (159.072 medido; el tope era 155k).

Mutaciones: catálogo → `tests/scrum1828c-ajustes-los-cuatro-sin-crudo.test.mjs`

A9: aviso → cicatriz J3 «Tercera vez que corro un test en un árbol anidado sin dist: la misma orden me dijo NO-DIST y lo corrí igual, con 3 rojos de Cannot find module.» — no se pudo comprobar: cuarta vez, en la tanda siguiente a esa cicatriz: mi primera pasada roja fueron 5 «Cannot find module ../dist»; qué tiene construido el árbol no lo ve ningún test del árbol, y lo cazó otra vez leer el texto del primer rojo antes de contarlo.
