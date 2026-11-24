# SCRUM-1821 · BANCO · `removeAttribute('data-x')` no quitaba el dato de `dataset`

## SCRUM-1821 · S3 · la cura, con rojo primero, y el barrido

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24 09:59Z (cabecera `Date` de GitHub) · puesto S3, rama `scrum-1821-banco-removeattribute`, por encargo del orquestador `cobroflash-backend-41` (hallazgo de S4 del mismo día).

**El defecto.** En `tests/_banco-vistas.mjs`, `removeAttribute(k)` hacía sólo `delete n._attrs[k]`. El selector `[data-x]` (`casaSimple`) lee `n.dataset`, no `_attrs`. Así que un nodo al que la vista le quitaba un `data-*` SEGUÍA casando con `[data-x]` y con `[data-x="v"]`, y su `dataset.x` seguía puesto; en un navegador ninguna de las dos cosas pasa. El hueco nació en SCRUM-451, que reflejó `data-*` en `dataset` al PONER el atributo y no al QUITARLO.

**La cura** (`tests/_banco-vistas.mjs`, `removeAttribute`): si la clave empieza por `data-`, se borra también `dataset[camelCase]`, con la misma conversión que ya usaba `setAttribute`. Nada más: `id`, `class` y `style` siguen sin reflejarse al quitarlos (en `public/` no hay ni un `removeAttribute('id' | 'class' | 'style')`: sin víctima hoy, se dice y no se toca).

**Rojo primero** — `tests/scrum1821-banco-removeattribute-data.test.mjs`, 6 casos:

| banco | resultado |
|---|---|
| el de main | **3/6 ✖**: caen «deja de casar con `[data-x]` y `[data-x="v"]`», «desaparece de `dataset`, `getAttribute` y `hasAttribute`» y «`data-foo-bar` → `dataset.fooBar`, y sólo ése» |
| con la cura | 6/6 ✔ |

Los dos controles pasan en los dos bancos: «sin tocar nada casan los dos» y el **control positivo** «el nodo que SÍ conserva el atributo sigue casando, con su valor» (la cura no puede ser «`[data-x]` no casa nunca»). Un sexto caso fija que quitar un atributo que no es `data-*` no toca `dataset`.

### Barrido: ¿hay tests verdes por esta vía?

**Dinámico.** Población: los 310 tests que importan `_banco-vistas`, `_pagina-panel` o `_datos-del-censo` (`git grep -l`, lista en `docs/master/evidencias/scrum1821/poblacion.txt`), corridos en tandas de 30 con `docs/master/evidencias/scrum1821/barrido1821.mjs`, una vez con el banco de main y otra con la cura, mismo árbol:

| banco | ficheros | tests | pass | fail | saltados | tandas ciegas |
|---|---|---|---|---|---|---|
| main | 310 | 2.474 | 2.469 | 0 | 5 | 0 |
| cura | 310 | 2.474 | 2.469 | 0 | 5 | 0 |

Conjunto de fallos: vacío en los dos (`barrido-base.json`, `barrido-cura.json`). Ningún test cambia de veredicto con la cura. Lo que esto NO prueba: un test que afirme «ya no está» y siga verde con la cura también lo estaba antes; el barrido dinámico sólo caza los que dependían del falso casamiento para pasar.

**Estático.** Dónde se quita un `data-*` de verdad:

- `public/` entero: **1** sitio, `public/landing.js:40` (`sg.removeAttribute('data-sign')`, la demo de la landing). Ninguno en el panel. Con argumento que no es un literal: 0. Control del instrumento: el `grep` sin filtrar por atributo ve 10 `removeAttribute` en `public/` (el de la landing y 9 del panel, de `aria-*`, `src` y `max`).
- `tests/`: 0 llamadas a `removeAttribute('data-…')` fuera del test nuevo.

| test | ¿afirma ausencia de un `data-*` quitado? | veredicto |
|---|---|---|
| `tests/scrum1130-demo-llega-a-firmado.test.mjs` (monta la demo de `landing.js` en el banco) | no: mira clases, `disabled` y `#signOk`; `[data-sign]` sólo lo usa para pulsar | **no afectado** · verde con los dos bancos. Observación para su dueño, sin tocarlo: con el banco viejo, un segundo clic en `#signBtn` durante el trazo seguía encontrando `[data-sign]`; ningún caso lo mide. `landing.js:49` lo vuelve a poner al reiniciar |
| el test de 916b (protegido con `hasAttribute`, declarado por S4) | — | **no tocado**, por encargo |

### Hallazgo de paso (no se cura aquí): la dirección contraria

`dataset` es un objeto suelto: lo que la vista hace SOBRE `dataset` no llega a `_attrs`. `delete el.dataset.x` deja `getAttribute('data-x')`, `hasAttribute('data-x')` y la página que sirve `serializar` diciendo que el atributo sigue; `el.dataset.x = 'v'` no lo crea en `_attrs`. Los selectores aciertan (leen `dataset`); `hasAttribute` y la página servida, no. Sitios en `public/` con `delete …dataset.`: 5 (`api.js:949`, `expensesView.js:893`, `quotesView.js:3828`, `signaturePad.js:164` y `:219`). **No medido** si algún test lee `hasAttribute`/`getAttribute` de un `data-*` tras esas líneas. Curarlo es hacer de `dataset` una vista de `_attrs` (un `Proxy`), que toca a toda la población del banco: es pieza propia, se propone al orquestador.

A9: comprobación → `tests/scrum1821-banco-removeattribute-data.test.mjs`
