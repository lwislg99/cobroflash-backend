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
