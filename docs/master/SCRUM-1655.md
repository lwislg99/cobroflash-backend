# SCRUM-1655 · `scrum1321` PUERTA 1b: el temporal nace en la unidad del repo, y si no puede, salta con su motivo

**Fecha:** 12-nov-2026 · **Escrita por:** jv-j3ca (puesto J3; el test es de SCRUM-1321, c.21388) · **Rama:** `scrum-1655b-puerta-1b-misma-unidad`
**Medido contra:** `origin/main` = `75d4878628254b3e6b72c1dfe69f2d8575b978ef` · 2026-11-12T10:17:51Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1321-el-resumen-no-prueba-el-final.test.mjs`

## La causa (c.21377 y c.21388, cotejada)

La PUERTA 1b creaba su temporal en `os.tmpdir()` y le pasaba a `aplicarUna` la ruta `path.relative(RAIZ, temporal)`.
Entre dos unidades de Windows, `path.relative` devuelve la ruta ABSOLUTA. Entonces `path.join(RAIZ, fichero)` no existe,
y el `assert.ok` «🔴 CIEGO … (¿otra unidad?)» FALLABA: «no pude medir» salía igual que «falló».

## Rojo primero (fabricado: esta máquina sólo tiene `C:`)

El árbol y `os.tmpdir()` están los dos en `C:` (`Get-PSDrive`: sólo `C`). Fabriqué la otra unidad con
`subst Y: <tmp del trabajo>` y `TEMP=TMP=Y:\` (es el caso del ticket con las unidades cambiadas: temporal en otra unidad que el árbol).

| entorno | código | TAP |
| --- | --- | --- |
| antes · TEMP en `Y:` | salida 1 | 5 tests · 4 pass · **1 fail**: «PUERTA 1b», error `🔴 CIEGO: el temporal no se alcanza desde la raíz del repo (¿otra unidad?)` |
| antes · TEMP en `C:` | salida 0 | 5 · 5 pass · 0 fail · 0 skipped |
| después · TEMP en `Y:` | salida 0 | 5 · 5 pass · 0 fail · 0 skipped |
| después · TEMP en `C:` | salida 0 | 5 · 5 pass · 0 fail · 0 skipped |

## El arreglo: (a), con (b) de reserva. La puerta (`aplicarUna`, S3) no se toca

`temporalEnLaUnidadDelRepo()` en el propio test, por orden:
① `os.tmpdir()` si está en la unidad del repo (el CI y casi todas las máquinas: el comportamiento no cambia ahí);
② si no, `temporal(prefijo, { dentroDe: path.dirname(RAIZ) })` (`tests/_temporal.mjs`, de la casa): misma unidad, FUERA del
árbol, se borra aunque el test caiga a mitad, y LANZA si cayera dentro (SCRUM-824). El test además lo afirma con `caeEnElArbol`;
③ si ② no se puede crear, `t.skip()` con el motivo: «otra unidad: el temporal del sistema está en X y el repo en Y, y en <madre>
no se pudo crear uno (<código>). PUERTA 1b NO MEDIDA.» Sale `# SKIP` en el TAP, nunca un verde mudo.

⚠️ **③ NO lo he ejercitado:** no supe fabricar aquí una carpeta madre donde no se pueda crear un directorio. Está escrito, no medido.
El `assert.ok` de CIEGO se queda como estaba para cualquier otra causa de «no se alcanza».

## Control positivo: la puerta sigue cazando (catálogo de la casa)

Añadida a `MUTACIONES_QUE_ME_TUMBAN` del propio test: `  if (ambigua) {` → `  if (false && ambigua) {` en
`scripts/meta-guard-mutaciones.mjs` (ancla única: 1 ocurrencia), `cae` = «SCRUM-1321 · 🔴 PUERTA 1b: un ancla que casa DOS veces sale CIEGA».
Pasada con `mutacionesDeclaradas` + `correr` + `aplicarUna` de la casa (driver en el tmp del trabajo, no comiteado):

| entorno | limpia | «EL CASO MEDIDO» (la que ya estaba) | «PUERTA 1b» (nueva) | árbol restaurado |
| --- | --- | --- | --- | --- |
| TEMP en `Y:` (camino ②) | 5 pass · 0 caídos | VIVA | **VIVA** | sí |
| TEMP en `C:` (camino ①) | 5 pass · 0 caídos | VIVA | **VIVA** | sí |

Con la puerta apagada el test cae en los dos entornos: el arreglo la ha hecho alcanzable, no la ha apagado. Y como ahora está en
el catálogo, el meta-guard del CI lo vuelve a comprobar en cada pasada.

## Punto 3 de c.21377: ¿hay más tests con la misma sensibilidad?

Barrido dinámico, mismo fichero con TEMP en `Y:` y en `C:`; con `dist/` construido (`tsc --noCheck`):
· los que usan `aplicarUna` y crean temporales, más `scrum813` y `scrum1473` (6 ficheros + `scrum1321`): **118 casos, 118 pass en los dos**;
· los que usan `tmpdir()`/`temporal(` **y** `path.relative(` (24 ficheros, `scrum1321` incluido): **170 casos · 168 pass · 0 fail · 2 skipped en los dos**
(los 2 saltos son `scrum1515` y `scrum1685` por «sin LIBRO_PG_URL», iguales en los dos entornos).
**Población medida: 24 + 6 de los 147 ficheros con temporales en `tests/`; los otros ~117 NO los he pasado.** Entre los medidos,
ninguno más cambia con la unidad del temporal. Eso no dice nada de los no medidos.

## Mis errores

· Corrí el primer barrido sin `dist/` y salieron 2 rojos (`scrum836` por `dist/…/pdf.service.js` que no existía, y `scrum1551i`):
la cicatriz J3 del 23-oct, al pie de la letra. Lo cacé al leer el texto del primer rojo antes de contarlo; construí y repetí.
· No me medí en los dos puntos fijos (al acabar el arranque y al acabar Jira). Primera medida: 148.880 tokens, después del arreglo.
· Lancé `node --test $(ls tests/scrum1395*.test.mjs)` sin comprobar que el patrón casara: no casa con nada, y `node --test` sin
ficheros se puso a descubrir y correr todo. Lo paré a los 600 s sin leer nada de su salida; `git status` después: sólo mis tres ficheros.

**Suite entera local: NO CORRIDA** (orden del orquestador: la cola va saturada). Corridos, en el entorno normal (TEMP en `C:`):
`scrum1321`, `scrum237`, `scrum976`, `scrum1387`, `scrum1387d`, `scrum1387f`, `scrum836`, `scrum267`, `scrum273`, `scrum1294`:
**81 casos · 81 pass · 0 fail · 0 skipped**, salida 0. `scrum719` + `scrum745`: **48 · 48 pass · 0 skipped**. `meta:mutaciones --solo-censo`: salida 0.

# SCRUM-1655b · El obligatorio de #3099 cayó por `scrum824`: el censo no veía de dónde colgaba el temporal nuevo

**Fecha:** 12-nov-2026 · **Escrita por:** jv-j3ca (relevo, puesto J3) · **Rama:** `scrum-1655b-puerta-1b-misma-unidad`
**Medido contra:** `origin/main` = `d8c441b9402cb21ea892afdf72f07b006294ba88` · 2026-11-12T11:01:45Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum824-temporales-fuera-del-arbol.test.mjs`

**El rojo.** Job 131124710528: 1 fallo de 13.338, `scrum824:217` «el conjunto de ficheros SIN PROBAR no crece». Entraba
`tests/scrum1321-el-resumen-no-prueba-el-final.test.mjs`. El tramo de arriba creó el `dir` con `const { dir, motivo } = temporalEnLaUnidadDelRepo(…)`,
y esa función era una `function` con tres `return`. El censo (`scripts/_temporales-en-el-arbol.mjs`) solo sigue un `const` con un único
`return`, y no atraviesa una desestructuración. Sus dos `writeFileSync` salían `DESCONOCIDO`. `guards:entrada` no lleva `scrum824`, así que en local no se vio.

**Arreglado en el test, no en el censo (regla 41), y sin tocar `SIN_PROBAR_CONOCIDOS`.** `temporalEnLaUnidadDelRepo` pasa a ser
un `const` flecha con UN `return`: `unidad(os.tmpdir()) === unidad(RAIZ) ? temporal(prefijo) : temporal(prefijo, { dentroDe: madre })`.
Las dos ramas pasan por `temporal()` de la casa, que el censo reconoce como TMP. El salto declarado se mantiene: el `catch` entrega el
motivo a `alFallar` (el test pasa `t.skip`) y el test sale si no hay `dir`. El comportamiento en los tres caminos no cambia.

| control | qué | resultado |
| --- | --- | --- |
| censo sobre la versión de la rama (`9bd677d82`) | `clasificaFuente` | 5 sitios: 3 TMP + **2 DESCONOCIDO** (`:235`, `:237`) |
| censo sobre la versión nueva | `clasificaFuente` | 5 sitios, **los 5 TMP** |
| negativo: la rama ② cambiada a `fs.mkdtempSync(path.join(RAIZ, "tmp-"))` | `clasificaFuente` | 6 sitios, **3 ARBOL**: el censo sigue cazando |
| `sinProbar(censar(RAIZ))` | conjunto | sólo `scrum951d`, que ya estaba en la lista: `scrum1321` sale |

**Tests (todos tras el cambio):**
· `scrum824` + `scrum1321`, TEMP en `C:`: **14 · 14 pass · 0 skipped**, salida 0.
· `scrum1321` con TEMP en `Y:` (`subst`): **5 · 5 pass · 0 skipped**, salida 0. Control rojo, la versión de `main` (`75d487862`) con TEMP en `Y:`: 5 · 4 pass · **1 fail**, salida 1.
· Mutaciones del catálogo de `scrum1321`, con `censoDeDeclaraciones` + `correr` + `aplicarUna` de la casa (driver en el tmp del trabajo, no comiteado):
**2 de 2 VIVAS con TEMP en `C:` y 2 de 2 con TEMP en `Y:`** (las dos: «EL CASO MEDIDO» y «PUERTA 1b»), y `scripts/` + `src/` quedaron en HEAD.
· `scrum824`, `scrum1321`, `scrum237`, `scrum976`, `scrum1387`, `scrum1387d`, `scrum1387f`, `scrum836`, `scrum267`, `scrum273`, `scrum1294`: **90 · 90 pass · 0 fail · 0 skipped**, salida 0.
· `guards:entrada`: **15 guards, 170 · 170 pass · 0 skipped**, salida 0. Los 5 de árbol entero que pide a mano (`scrum195`, `scrum414`, `scrum694`, `scrum710b`, `scrum737`): **38 · 38 pass · 0 skipped**, salida 0.
· El camino ③ (el salto) sigue **sin ejercitar**, como en el tramo de arriba.
· **Suite entera local: NO CORRIDA.**

**Mis errores.**
· Lancé `node scripts/meta-guard-mutaciones.mjs --help` para ver sus opciones. No tiene `--help`: arrancó la pasada entera, que muta el árbol.
La paré a los 120 s y dejó `src/modules/fiscal/modelo130/modelo130.ts` mutado (`rn > 0` → `rn !== 0`) y el `dist/` compilado con la mutación.
Devolví la línea a la de HEAD con Edit (`git diff --quiet HEAD -- src`: sin diferencias) y recompilé con `tsc --noCheck` (`dist`: 0 `rn !== 0`).
Es de J1; no lo he cambiado, solo restaurado, y no entra en el commit. Cicatriz J3 nueva.
