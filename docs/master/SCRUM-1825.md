# SCRUM-1825 · BANCO · `dataset` era un objeto suelto: lo que la vista hacía sobre él no llegaba a `_attrs`

## SCRUM-1825 · S3 · la cura, con rojo primero, el barrido, y PARADO antes del push

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T18:29:08Z

Puesto S3, rama `scrum-1825-dataset-proxy`, por encargo del orquestador (la dirección contraria de
SCRUM-1821). **Forense del relevo:** la sesión S3 anterior murió por límite de uso sin traspaso. Dejó en
este worktree UN commit local sin empujar (`3d3a7b15a`, «WIP, sin empujar … scrum817 cambia de veredicto
-> PARADO») con la cura, el test de 9 casos, un guion de mutaciones y un barrido de 406 ficheros sobre
`2db8e1c8b`; sin registro. Se aprovecha entero: lo he re-medido todo sobre `main` mezclado (`75091fc21`,
merge de `db0a6c045`), y lo que sigue es lo medido por mí.

**El defecto.** En `tests/_banco-vistas.mjs`, `dataset` era un objeto suelto que `setAttribute` rellenaba
y `removeAttribute` vaciaba (SCRUM-451, SCRUM-1821), pero lo que la vista hacía SOBRE `dataset` no
llegaba a `_attrs`: `delete el.dataset.x` dejaba `getAttribute('data-x')`, `hasAttribute('data-x')` y la
página de `serializar` diciendo que el atributo seguía; `el.dataset.x = 'v'` no lo creaba. Sitios de
`public/` que borran por `dataset` (re-medidos hoy): `api.js:949`, `expensesView.js:893`,
`quotesView.js:3831` (era `:3828`), `signaturePad.js:164` y `:219`.

**La cura.** `dataset` es un `Proxy` sobre `_attrs`, que queda como ÚNICA fuente: leer, poner, borrar,
`in` y enumerar van a `data-<guiones>`, con el valor como cadena (como `DOMStringMap`); un nombre con
«-minúscula» lanza `SyntaxError`, como en el navegador. Es propio, enumerable y de sólo lectura
(`el.dataset = {…}` lanza). El objetivo del Proxy es sólo un espejo para que `assert` lo pinte, refrescado
en cada escritura de un `data-*`; nadie lo lee para contestar. `scripts/_pagina-panel.mjs` (`serializar`)
deja de emitir dos veces un `data-*`: sale de `_attrs` y, de `dataset`, sólo lo que `_attrs` no tenga.

**Rojo primero** — `tests/scrum1825-banco-dataset-es-el-atributo.test.mjs`, 9 casos:

| banco | resultado |
|---|---|
| el de main | **4/9 ✖**: `delete el.dataset.x` quita el atributo · `el.dataset.x = v` lo crea · reescribir por `dataset` cambia el atributo y la página lo saca UNA vez · `dataset` de sólo lectura |
| con la cura | 9/9 ✔ |

Las dos direcciones caen en main y pasan con la cura. Los controles pasan en los dos: «sin tocar nada,
el atributo del marcado está en los dos sitios» y el **control positivo** «borrar uno por `dataset` deja
los demás, en el mismo nodo y en el vecino»; y «quitar por `removeAttribute` sigue curado (SCRUM-1821)».

**Mutaciones** — en `MUTACIONES_QUE_ME_TUMBAN` del test nuevo (el guion suelto `mutar1825.mjs` de la
sesión anterior se retira: SCRUM-1387 no admite bancos de mutación fuera del catálogo). Cada mitad de la
cura quitada por separado, leídas con el lector AST del meta-guard, cada `de` único; las cuatro caen:
borrar por `dataset` no toca `_attrs` → caen 2 · poner por `dataset` no toca `_attrs` → 5 · `serializar`
emite el `dataset` otra vez → 1 · el espejo no se refresca → 1.

### Barrido dinámico: el mismo instrumento de 1821

`docs/master/evidencias/scrum1821/barrido1821.mjs`, tandas de 30, una vez con el banco de main
(`tests/_banco-vistas.mjs` y `scripts/_pagina-panel.mjs` de `origin/main`) y otra con la cura, MISMO árbol.
Población: unión de la de la sesión anterior (`poblacion.txt`, 406) y de los consumidores TRANSITIVOS de
los dos ficheros (`poblacion-transitiva.mjs` → `poblacion-transitiva.txt`, 329): `poblacion-v2.txt`, 425.

| banco | ficheros | tests | pass | fail | saltados | tandas ciegas |
|---|---|---|---|---|---|---|
| main | 425 | 3.435 | 3.420 | 6 | 9 | 0 |
| cura | 425 | 3.435 | 3.423 | 3 | 9 | 0 |

(`barrido-base-v2.json`, `barrido-cura-v2.json`; los de la sesión anterior, sobre `2db8e1c8b`, quedan como
`barrido-base.json`/`barrido-cura.json` y dan lo mismo.) Fallos por conjunto:

- **Sólo en main:** los 4 rojos del test nuevo (es su rojo primero).
- **En los dos:** `scrum1726-tanda-firmada-j1.test.mjs`, 2 casos D1 (zona horaria de la hoja). Ajeno a esto:
  cae igual con los dos bancos.
- **🔴 Sólo con la cura — CAMBIA DE VEREDICTO:** `scrum817-orden-del-detalle-del-trabajo.test.mjs` ·
  «SCRUM-817 · 🔴 el reorden no pierde NI UNA acción».

### 🔴 La lista, con dueño — y por eso este PR NO se empuja

| test | qué pasa | por qué | dueño |
|---|---|---|---|
| `tests/scrum817-orden-del-detalle-del-trabajo.test.mjs:139` «el reorden no pierde NI UNA acción» | el inventario pierde los DOS «`BUTTON:+ Nuevo albarán`» en vez de uno (sólo uno está en `RETIRADAS_A_PROPOSITO`) | `public/dashboard/js/jobDetailView.js:1166` hace `cta.dataset.accion = 'cta'`. En el navegador eso ES `data-accion="cta"`, y `tests/_inventario-detalle-trabajo.mjs` identifica una acción por su GANCHO (`data-accion` antes que el texto). Con la cura, el banco por fin lo ve y el inventario la nombra `data-accion=cta` (medido: está en el inventario de hoy). **La acción no se ha perdido: ha cambiado de nombre en el censo.** La lista `ANTES` se midió con el banco que no veía el `dataset.accion` | S2 (pantalla). Último que lo tocó: SCRUM-1740 (S2, `23aac424b`); el CTA por identidad es SCRUM-1725h (S2, `556039c95`). Original: SCRUM-817 |

**MI LECTURA** (no la he aplicado: es fichero de otro carril y el encargo dice parar): la corrección
es del FIXTURE del test, no del producto: en `ANTES`, una de las dos `'BUTTON:+ Nuevo albarán'` pasa a ser
`'data-accion=cta'` (es la primaria de la cabecera, la que se conserva), y `RETIRADAS_A_PROPOSITO` sigue
igual. Lo decide su dueño. Hasta entonces la rama no se empuja: si entrara la cura sola, este test
pasaría a rojo en `main`.

**Lo que este barrido NO prueba:** un test que afirme «ya no está» y siga verde con la cura también lo
estaba antes; el barrido sólo caza los que cambian de veredicto.

**Estado al relevo:** commit local en `scrum-1825-dataset-proxy`, SIN empujar. Antes del push: decisión del
dueño de 817 → re-mezclar `main` → repetir el barrido con `poblacion-v2.txt` (y regenerar la transitiva) →
`ancla.mjs` + A9 + `guards:entrada`.

A9: comprobación → `tests/scrum1825-banco-dataset-es-el-atributo.test.mjs`
Mutaciones: catálogo → `tests/scrum1825-banco-dataset-es-el-atributo.test.mjs`
