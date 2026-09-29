# SCRUM-1293 · Opción B: las listas de los censos de marcadores, a un JSON declarado — APARCADO por permisos

**Rama:** `scrum-1293-listas-de-marcadores-a-json` · **Carril:** S3 · instrumentos (s3-29e) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `f9b5cdbf74901a1a7dd34d7caa27596628827328` · 2026-09-29T17:32:41Z

> 🔴 **PR EN BORRADOR A PROPÓSITO.** Lo que entra aquí (el JSON y su cargador) no lo usa nadie
> todavía: el paso que los conecta es editar tres tests, y el clasificador de permisos lo BLOQUEÓ.
> Mergearlo así metería en `main` una pieza sin consumir.

## Qué hay en la rama

- `scripts/_marcadores-pendientes-declarados.json`: las listas, copiadas del `main` de hoy.
  `panel` (10 ficheros, el `CENSO` de scrum402), `servidor` (9, el `CENSO_SERVIDOR` de scrum667) y
  `papel` (1, el `EN_EL_PAPEL` de scrum667). Misma convención que `_sin-consumir-declarados.json` y
  `_suelos-sin-leer-declarados.json`.
- `tests/_marcadores-declarados.mjs`: el cargador. **Fail-closed por cuatro lados**: sale en ROJO si
  el fichero no se lee, si una sección viene vacía, si un número es 0 (una entrada que llega a 0 se
  BORRA) o si una clave está REPETIDA (en JSON, como en un literal de JS, la última gana en silencio).

## Lo que falta — y exige una regla de permiso `Edit` del fundador para ESTOS TRES ficheros

1. `tests/scrum402-marcador-no-se-pinta.test.mjs`: `const CENSO = Object.freeze({…})` pasa a
   `const CENSO = marcadoresDeclarados().panel;`. Los comentarios de historia se quedan en el test
   (el JSON no admite comentarios). **La aserción R4 no cambia.**
2. `tests/scrum667-marcador-visible.test.mjs`: `CENSO_SERVIDOR` = `.servidor` y `EN_EL_PAPEL` =
   `.papel`. **Aserciones sin tocar.**
3. `tests/scrum650d-pantalla-asignar.test.mjs:416`: el `1` de `assert.equal(literalesConMarca.length, 1, …)`
   pasa a `marcadoresDeclarados().panel['jobAsignados.js'] ?? 0`. **La aserción es la misma** (igualdad
   exacta); solo cambia de dónde sale el número.
4. Probar en ROJO: un marcador sin declarar en `public/dashboard/js/` y otro en `src/` tienen que
   seguir tumbando R4 y el trinquete de 667; quitar el de `MARCA_ASIGNADOS` tiene que tumbar 650d.
5. Un test propio del cargador con sus cuatro controles negativos (fichero ausente, sección vacía, 0,
   clave repetida), cada uno comprobado en rojo.

Qué se bloqueó, literal: el primer `Edit` sobre scrum402 (solo la cabecera del objeto, sin quitar
ninguna entrada) → «Permission for this action was denied by the Claude Code auto mode classifier».
No se probó en 667 ni en 650d: el bloqueo vale para el resultado, y probar por otro fichero sería el rodeo.

## Hallazgo de paso: «R4c» no existe

`scrum402-marcador-no-se-pinta.test.mjs:697` dice «Que no vuelva a colarse lo vigila **R4c**» (claves
repetidas en `CENSO`). **No hay ningún R4c en el repo** (grep en `tests/` y `scripts/`, 29-sep). No
sé si es un resto de algo que se quitó o un caso que nunca se construyó. El cargador de esta rama sí
caza las claves repetidas, así que al conectarlo (paso 1) R4c quedaría cubierto de verdad.
