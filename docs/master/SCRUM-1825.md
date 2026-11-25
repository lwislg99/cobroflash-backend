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

### El fixture de 817, corregido aquí por cruce autorizado (S3 → carril S2)

**Autorización** (orquestador, mensaje a S3, 24-nov-2026; literal): «DECISIÓN: CRUCE S3→S2 AUTORIZADO
NOMINALMENTE AQUÍ (precedente de hoy: cruce S2→S1 en SCRUM-1804 c.22551; registro del uso en SCRUM-1656 lo
hago yo). Alcance EXACTO y nada más: en tests/scrum817-orden-del-detalle-del-trabajo.test.mjs, UNA de las dos
cadenas «BUTTON:+ Nuevo albarán» del fixture — la que corresponde al cta de jobDetailView.js:1166 — pasa a
nombrarse por su gancho «data-accion=cta»; cero cambios más en ese fichero, jobDetailView.js NO se toca.» Y,
tras medir el rojo en main: «SÍ a tu propuesta: commit aparte en la MISMA rama y el MISMO PR — mi «mismo
commit» era por la atomicidad del aterrizaje, y eso el PR la da (main nunca ve una mitad sin la otra)». S2
lo ratifica en su carril al relevo (lo señala el orquestador).

**El diff, una línea** — `tests/scrum817-orden-del-detalle-del-trabajo.test.mjs:148`:

```
-    'BUTTON:+ Nuevo albarán', 'BUTTON:+ Nuevo albarán',
+    'BUTTON:+ Nuevo albarán', 'data-accion=cta',
```

**Medido** (scrum817 entero): con la cura, 4/4 ✔. Con el banco de main (`_banco-vistas` + `_pagina-panel` de
`origin/main`, mismo árbol), 3/4: cae «el reorden no pierde NI UNA acción», porque sin la cura el banco no ve
`cta.dataset.accion` y nombra el CTA por su texto. **El fixture corregido solo vale con la cura; entran juntos
en el PR; por separado, cualquiera de los dos deja scrum817 en rojo en main.**

**Lo que este barrido NO prueba:** un test que afirme «ya no está» y siga verde con la cura también lo
estaba antes; el barrido sólo caza los que cambian de veredicto.

**Re-medición sobre `main` `31af3ad11` (12 commits más; uno toca `jobDetailView.js`, SCRUM-1834, aviso del
método de cobro, no el CTA):** mezclado y recompilado. Barrido de la CURA, ya con el fixture corregido: 426
ficheros, 3.438 tests, 2 ✖, 0 ciegas. El de la BASE **lo cortó Claude Code por falta de memoria en la máquina**
en la tanda 13 de 15, sin escribir su JSON: la comparación por conjuntos sobre este árbol NO está hecha, y sin
ella no se empuja. Las copias del banco de main que dejó el corte en el árbol se guardaron en el stash
`422e0760ae58ea4341a52981ed479996e3265c93` (idénticas a `origin/main`; el guard `guard-dangerous` no dejó
descartarlas y el permiso de un solo uso fue denegado).

**Estado al relevo (24-nov):** commit local en `scrum-1825-dataset-proxy`, SIN empujar. Faltaba SÓLO el barrido de la
base sobre el árbol mezclado (`poblacion` v3 = la v2 + la transitiva regenerada).

A9: comprobación → `tests/scrum1825-banco-dataset-es-el-atributo.test.mjs`
Mutaciones: catálogo → `tests/scrum1825-banco-dataset-es-el-atributo.test.mjs`

### El barrido de la base v3, completo (relevo del 25-nov)

**Medido contra:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392` · 2026-11-25T07:54:42Z

La sesión del 24-nov, tras el corte por memoria, lo re-corrió **un tramo de 30 por comando** (15 tramos) y dejó
los JSON en el temporal de su trabajo antes de morir por límite; no llegó a copiarlos. Los he recuperado y
comprobado: los 15 `tNNN.txt` concatenados en orden son EXACTAMENTE `poblacion-v3.txt` (426 líneas), y cada
`tNNN.json` tiene una sola tanda de su tramo. Copiados tal cual a `evidencias/scrum1825/tramos-base-v3/` y unidos
en `barrido-base-v3.json` (mismo formato que los demás; `origen` nombra cada tramo). La carpeta es la `scrum1825`
que ya usa esta rama, no `SCRUM-1825`. Lo medido es del árbol `3e01d4fec` con el banco de `origin/main`.

| banco | ficheros | tests | pass | fail | saltados | tandas ciegas |
|---|---|---|---|---|---|---|
| main | 426 | 3.438 | 3.421 | 8 | 9 | 0 |
| cura | 426 | 3.438 | 3.427 | 2 | 9 | 0 |

(`barrido-base-v3.json`, `barrido-cura-v3.json`.) Fallos por conjunto:

| test | dónde cae | lectura |
|---|---|---|
| `scrum1825-banco-dataset-es-el-atributo.test.mjs`, 4 casos | sólo main | su rojo primero |
| `scrum817-orden-del-detalle-del-trabajo.test.mjs` «el reorden no pierde NI UNA acción» | sólo main | esperado: el fixture corregido sólo vale con la cura (sección anterior) |
| `scrum836-ancla-de-mutacion-viva.test.mjs` «NINGUNA mutación declarada tiene el ancla caducada» | sólo main | **artefacto del intercambio de banco:** las `MUTACIONES_QUE_ME_TUMBAN` del test nuevo anclan texto de la CURA en `tests/_banco-vistas.mjs` y `scripts/_pagina-panel.mjs`; con esos dos ficheros cambiados por los de `main`, sus anclas no están y 836 las da por caducadas. Con la cura, 836 en verde. No es un fallo que pueda ver `main`: el test nuevo y la cura entran en el mismo PR. **Lectura aceptada por el orquestador, SCRUM-1656 c.22748** |
| `scrum1726-tanda-firmada-j1.test.mjs`, 2 casos D1 | los dos | ajeno (zona horaria de la hoja), igual que en v2 |

**Sólo con la cura: ninguno.** Ningún test cambia de veredicto a peor con la cura.

**Main al empujar:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392`, 87 commits por delante de la base
del barrido (`31af3ad11`). Medido: ninguno de sus 140 ficheros cambiados es `tests/_banco-vistas.mjs`,
`scripts/_pagina-panel.mjs`, `jobDetailView.js`, `_inventario-detalle-trabajo.mjs`, ni los tests 817/836. No se
re-mezcla para no invalidar el barrido; el check del PR corre sobre la mezcla.

**Para quien cierre el ticket — dos stashes de esta rama, NO tirados:** `00b424b3c77a3f79b5c78b463f16684e0085a0b7`
(«s3-1825-banco-de-main-barrido-base-v3») y `422e0760ae58ea4341a52981ed479996e3265c93`
(«s3-1825-banco-de-main-tras-barrido-cortado-24nov»). Son las copias del banco de `main` que dejaron los
barridos de la base en el árbol; por lo medido el 24-nov, idénticas a `origin/main`. Se tiran al cerrar.

A9: sin fallo que generalice — tramo de relevo que recupera, comprueba y copia evidencias ya medidas; el BOM que mete `Set-Content -Encoding utf8` de PowerShell 5.1 en el JSON unido lo vi en los primeros bytes y lo rehíce con node antes del commit (trampa ya escrita en la descripción de la herramienta)

## SCRUM-1825 · apéndice 25-nov tarde — el rojo de #3439 (S3)

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T14:51:41Z

En el run 45623864611 (tras el update-branch, punta `2d92b3100`), `build + tests` cayó con UN fallo: `scrum719`
«SCRUM-1395b · ① el veredicto guardado de `censo:mudez` cubre la población, al día», con el motivo literal
«scrum817-orden-del-detalle-del-trabajo.test.mjs · el fichero cambió desde la medida». Es el fixture de 817 que
corregí en esta rama (cruce autorizado, arriba): su ficha en `tests/_veredicto-mudez.json` se quedó caducada.
Cura con el comando del propio test, `npm run censo:mudez -- --escribir`, sobre main `2a6675c97` mezclado: midió 1 de
148 → **VIVO 1 · MUDO 0 · CIEGO 0**, filtro `_guard-texto.mjs` idéntico al original; el diff del JSON es una
línea, la huella de 817 (`b07a09d0…` → `5dda44c2…`), que sigue VIVO.

El trinquete de zona, también rojo en este PR, NO es de esta rama: la pared de 15 min del hijo corta la cola de
la tanda, y le pasa también a ramas ajenas (medido y entregado al orquestador).

Error propio: toqué un guard de la población de `censo:mudez` y no regeneré el derivado. El barrido de esta rama
no pasa por `scrum719`.

A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`
