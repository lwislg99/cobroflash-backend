# SCRUM-1218 · DECLARACIÓN REESCRITA — el abort de libuv de SCRUM-1204 sigue vivo, el criterio de disparo SE HA CUMPLIDO, y la población no son «40»: el censo no seguía los imports

**Medido contra:** `origin/main` = `ee0687fd91c09561a46953f309f8c44310340c58` · 2026-09-28T21:22:07Z

J6 (jv-j6), por encargo del orquestador del equipo de Javier. Windows 11 · Node `v24.18.0`.
**Es una declaración, no una migración: no se ha tocado ningún test ni ningún banco.**
La declaración original vive en la descripción del ticket, escrita el mismo 28-sep sobre `29b492b0`.
Esto la sustituye.

## 1 · El arreglo de SCRUM-1204 sólo tocó `scrum910d`; el mecanismo sigue vivo

El commit del arreglo (`305d5c4f`) cambia **dos ficheros**: `tests/scrum910d-microcopy-recibo-pendiente.test.mjs`
y `docs/master/SCRUM-1204.md`. No toca `fetch`, ni `npm test`, ni ninguna bandera. La causa —el tier-up de
WebAssembly de V8 sobre el `llhttp` de `fetch` (undici), que termina mientras `--test-force-exit` cierra el
proceso— sigue en todos los demás.

**La prueba es `scrum1216b-numero-de-arranque`**, que abortó en una tanda entera el 28-sep (SCRUM-1244, tanda
T11) con la firma exacta:

    Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94

y el fichero salió `'test failed'` sin ningún subtest caído. Solo, 20 pasadas:

| cómo | abort de libuv | limpio |
| --- | --- | --- |
| `--test-force-exit` | **2/20** | 18 |
| `--test-force-exit --no-wasm-dynamic-tiering` | 0/20 | 20 |
| sin bandera | 0/20 | 20 |

La bandera de wasm lo apaga: es el mismo mecanismo que 910d, no otro.

## 2 · 🔴 El criterio de disparo SE HA CUMPLIDO

El criterio decía «si cae un segundo fichero **de los 40**». `scrum1216b` no estaba en la lista, y por la
letra no se cumpliría. **Se declara cumplido por la intención**, por decisión del orquestador: acogerse a la
letra cuando un segundo fichero aborta con la firma exacta sería ensanchar la lista para que la declaración
no salte, que es justo lo que una declaración con criterio de disparo existe para impedir.

**Y aun así no se migra todavía**, y el motivo es el punto 3: la lista sobre la que se migraría estaba incompleta.

## 3 · El censo no seguía los imports: la población no eran 40

El censo de SCRUM-1204 miraba cada `tests/*.test.mjs` por separado. `scrum1216b` no llama a `fetch` ni a
`listen(0)`: lo hace `tests/_banco-camino-real.mjs`, que el test importa. **El censo estaba ciego a esa forma.**

Censo nuevo, `docs/master/evidencias/SCRUM-1218/censo-con-imports.mjs`: por AST, sin contar comentarios ni
cadenas, siguiendo transitivamente los imports relativos (estáticos, `export … from` e `import('…')`).

| | ficheros |
| --- | --- |
| población `tests/*.test.mjs` | 1.072 (0 ciegos) |
| con `fetch()` y `.listen(0)` en su proceso | **42** |
| · en el propio fichero | 40 (los mismos 40 de la declaración original, comparados como conjunto) |
| · sólo a través de imports | **2**: `scrum1216b` y `scrum597-asignar-usuario-al-documento`, los dos por `_banco-camino-real.mjs` |

`scrum597`, 20 pasadas: 0/20 con `--test-force-exit` y 0/20 con la bandera de wasm (latente, no reproducido).

⚠️ **42 es lo que este censo ve, no la población cerrada.** No sigue lo que un test carga de `dist/` ni de
`node_modules`, ni rutas calculadas, ni un `fetch` llamado por otro nombre (`globalThis.fetch`,
`const f = fetch`), ni procesos hijos. Cualquiera de esas formas sería otro ciego del mismo tipo.

*(Corrección propia: en el aviso al orquestador escribí que «importan el banco 4 tests». Eran 2. Los otros
dos, `scrum702` y `scrum888d`, sólo lo nombran en comentarios y cadenas. Aquel recuento fue un `grep` de
texto; éste es por AST.)*

## 4 · El control positivo estaba CADUCADO; el nuevo puede fallar

El control del censo original era «`scrum910d` sale». Hoy sale **NO**, y es correcto, porque ya se migró.
Un control que ya no puede cumplirse no controla nada. Controles nuevos del censo:

| control | esperado | hoy |
| --- | --- | --- |
| POSITIVO por import: `scrum1216b` | SÍ | ✅ SÍ |
| POSITIVO directo: `albaran` | SÍ | ✅ SÍ |
| NEGATIVO: `scrum910d` (migrado) | NO | ✅ NO |
| NEGATIVO: `scrum1107b-rutas-garantia` (`node:http`) | NO | ✅ NO |

Cada control exige además que su fichero **exista** en la población. Si no existe, el control falla como
«en vacío». La primera versión de este censo tenía un negativo que se cumplía sobre un nombre de fichero
que no existía; así se cazó.

**Visto en rojo, con el censo commiteado (`ea22be65`) y restaurado después con `git restore --source=HEAD`:**

- **M-a · que el censo no siga los imports** (`numstat` 1/1): reproduce exactamente el censo viejo (40, 0 por
  import) y **cae** en el positivo de `scrum1216b`, con salida 1.
- **M-b · un control sobre un fichero que no existe** (`numstat` 2/2): **cae** como «en vacío», con salida 1.

## 5 · 🔴 El criterio de disparo NUEVO — por la firma, no por una lista

> **Cualquier fichero** de `tests/` que termine `'test failed'` sin ningún subtest caído y con
> `UV_HANDLE_CLOSING` / `src\win\async.c` en su salida es este defecto. **Esté o no esté en ningún censo.**
> Si cae uno, no se discute si «es de la lista»: se registra aquí (fichero, fecha, tanda) y se avisa al
> orquestador.

Y si un fichero cae y el censo no lo ve, **el que ha fallado es el censo**, como con `scrum1216b`: se
corrige el censo antes de seguir.

Antes de migrar nada, cada fichero se reproduce **solo, con `--test-force-exit` y 20 pasadas**. El arreglo
se mide igual: **0/20 con la bandera puesta**. «5/5 sin bandera» no mide nada.

## 6 · Lo que queda por decidir (NO es de J6)

- **Si se migra, y qué.** Dos de los 42 dependen de un solo sitio, `tests/_banco-camino-real.mjs`, que es de
  la S3 (equipo de Luis). Lo lleva el orquestador con esta medición. **J6 no lo toca.**
- **Linux/CI:** sin medir si allí cae. Si no cae, el verde de CI nunca lo cazaría.

## ⛔ Lo que sigue sin ser arreglo

- **Quitar** `--test-force-exit`: SCRUM-556 midió `scrum334` cayendo también sin ella.
- **Meter** `--no-wasm-dynamic-tiering` en `npm test`: relaja el instrumento de toda la tanda por una clase
  de ficheros.
- **Listas de excepciones o saltos:** regla 41.

## Reproducir

    node docs/master/evidencias/SCRUM-1218/censo-con-imports.mjs     # sale 0 con los 4 controles en verde
