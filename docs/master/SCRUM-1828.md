# SCRUM-1828b

**Skill UI:** `yaqu-premium-ui` cargada antes de tocar la vista. Sin tokens, clases ni componentes nuevos: cambia solo el texto del aviso de `setAlert` (que ya escribe por `textContent`, `settingsView.js:236`).

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
