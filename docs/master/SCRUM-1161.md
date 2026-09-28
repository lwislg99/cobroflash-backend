# SCRUM-1161 · Dar de alta un cliente sin correo o sin teléfono ya no falla con «API 400: validation_error»

**Medido contra:** `origin/main` = `7ba1ad5f2a87e7752894f790a5256b20a65f9ed5` · 2026-09-28T13:40:30Z (J2, `jv-j2`)

Carril J2 (`customersView.js`, `dos-equipos.md` §3). Cierra **P1-CONT-19b** de `docs/BUGS.md`.

## PASO 0 — ¿quién exige los dos campos?

**Nadie.** El servidor los declara `.optional()` (`customerCreateSchema`): acepta la clave
AUSENTE y rechaza la cadena vacía. Ejecutando el esquema compilado de `origin/main`:

| payload | veredicto |
|---|---|
| modal sin correo (`email: ""`) | RECHAZA · `email: Invalid email address` |
| modal sin teléfono (`phone: ""`) | RECHAZA · `phone: Too small … >=5 characters` |
| claves ausentes | ACEPTA |
| con los dos | ACEPTA |

O sea que no había una decisión de producto que tomar: el modal mandaba `""` donde quería decir
«no hay dato». Es un arreglo, y es el que recomendaba el propio ticket (opción 1, en el front).

## Qué cambia

- `customersView.js`: `phone` y `email` viajan `|| undefined`, la misma regla que ya seguía
  `mobile` desde SCRUM-590 (y que la ficha 360 aplica con `if (phone) payload.phone = …`).
  Lectura INLINE del control, para que el censo de SCRUM-692 siga viendo de dónde sale cada clave.
- `tests/scrum1161-alta-sin-correo.test.mjs`: monta el modal REAL, pulsa Guardar y pasa el payload
  por la puerta REAL. Cuatro casos: control (la puerta rechaza `""` y un correo mal escrito), sin
  correo, sin teléfono, y un correo mal escrito que SIGUE llegando a la puerta (vacío no viaja; lo
  mal escrito, sí).
- `tests/scrum590b-…`: quita el rodeo que rellenaba el email para poder medir el móvil.

## Rojo verificado

Con `customersView.js` de `origin/main` y los tests nuevos: **5 fail / 5 pass** (los dos que
deciden de SCRUM-1161 y tres de SCRUM-590b sin su rodeo). Con el arreglo: **16/16** en
`scrum1161` + `scrum590b` + `scrum692`.

## Lo que NO se toca, y por qué

- **El mensaje en crudo** (punto 2 del ticket). Tras el arreglo sólo queda para bordes (un teléfono
  de una o dos cifras; el correo mal escrito ya lo para el navegador, el campo es `type="email"`).
  Cambiarlo es microcopy (regla 39): va como PROPUESTA en el ticket, para firma, no en este PR.
- **Exigir al menos uno de los dos** (sugerencia del ticket). Hoy el servidor no exige ninguno;
  exigirlo es una regla nueva con texto nuevo → decisión, no se inventa aquí.
- **Vaciar un correo o teléfono ya guardado no lo borra** (ausente = «no toques»). Es la limitación
  que ya tenía `mobile`; se cierra el día que el esquema acepte `null` en los tres a la vez.
- **`homeView.js:1337`** (alta rápida desde el presupuesto rápido) manda `phone: null` sin teléfono,
  y la puerta también rechaza `null`. Es de **S2** (`dos-equipos.md`), no de J2: reportado en el
  ticket, no arreglado (A7).
