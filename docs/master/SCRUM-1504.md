# SCRUM-1504 · El comentario de `asignacionDeDocumento.ts` nombra el guard que promete

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:53:55Z

A9: comprobación → `tests/scrum1408-asignar-no-es-un-permiso.test.mjs`

Sesión S1 · rama `scrum-1504-el-comentario-nombra-su-guard`. Encargo del orquestador; ticket abierto por J2 (sesión `jv-j2`) porque `src/core/documentos/**` es carril de S1.

## El defecto

`src/core/documentos/asignacionDeDocumento.ts:13` decía «hay un guard que lo comprueba» sin decir cuál. Desde SCRUM-1408 ese guard existe (`tests/scrum1408-asignar-no-es-un-permiso.test.mjs`, en `main`), y la segunda mitad de la frase («si un día alguien lee `quote_assignees` para decidir un 403…») ya no era verdad tal cual: desde el 2-oct dos puertas leen la asignación para decidir si un Técnico VE el documento (SCRUM-1390 c.17962). Y la línea 19 nombraba sólo `accesoALaFactura.ts`; desde SCRUM-1403 también `accesoAlPresupuesto.ts`.

## El arreglo — sólo comentarios, mismas líneas

- Líneas 13-15: el texto que propuso J2 en la descripción del ticket, literal. Tres líneas por tres, para no mover las de debajo (hay evidencias que citan este fichero por número de línea).
- Líneas 19-20: nombran las dos puertas. Dos líneas por dos.

Ningún comportamiento, ningún texto que vea el usuario, nada del esquema.

## Verificado, ejecutando

- **El JS emitido es idéntico:** `typescript.transpileModule` con `removeComments` sobre la versión de `HEAD` y la de la rama → 1.462 bytes y 1.462 bytes, idénticos. Control positivo con el mismo instrumento: añadir un `export` da un JS distinto.
- `tests/scrum1408-asignar-no-es-un-permiso.test.mjs`: 4 de 4 (población declarada por el test: 327 ficheros `.ts` de `src/` leídos, 6 tocan la asignación). Es el único test que nombra el módulo.
- `git diff --numstat`: `5 5` en el fichero, nada más en `src/`.

## Lo que NO toca

- `tests/scrum1408-…` sigue diciendo en su cabecera «EL COMENTARIO DEL MÓDULO TODAVÍA NO NOMBRA ESTE FICHERO». El test es de SCRUM-1408 (J2): esa frase la retira su dueño. No cambia lo que el test mide.
- `docs/evidencias/scrum1408/censo-promesas.salida.txt:12` conserva la frase vieja de la línea 13: es la salida fechada de un censo, y una salida no se reescribe.
