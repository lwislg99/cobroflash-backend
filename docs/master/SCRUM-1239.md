# SCRUM-1239 · El alta de cliente deja de decir «Revisa los datos» cuando se cae la conexión

**Medido contra:** `origin/main` = `d49787292b06b2bca8dfee765f401ca5cd39b6f7` · 2026-09-28T16:57:04Z (J2, `jv-j2`)

Textos: SCRUM-1239 comentario 17386 (firma delegada), registrados en
`docs/microcopy/2026-09-28-SCRUM-1239-alta-cliente-sin-conexion.md`. Va encima de SCRUM-1199 (#1865),
verificado en `main` por efecto antes de empezar: los cuatro literales de 1199 están en `customersView.js`.

## 1 · El defecto, provocado de verdad

`tests/scrum1239-alta-cliente-sin-conexion.test.mjs` monta el modal real con `api.js` real y sólo
dobla `fetch`. Cada caso se provoca en la red, no se fabrica el error:

| Caso | Cómo se provoca | Qué marca `api.js` | Antes (commit 85e5e7f8) |
|---|---|---|---|
| Sin cobertura | `fetch` rechaza con `TypeError('Failed to fetch')` | `err.sinRed` | «Revisa los datos…» |
| Se cortó a mitad | el POST no vuelve; plazo a 5 ms y `abort` | `err.incierto` | «Revisa los datos…» |
| El servidor revienta | `500 {error:'internal_error'}` | `err.status = 500` | «Revisa los datos…» |

Rojo: 6 casos, 3 fail, los tres con el genérico de 1199 en pantalla (el mensaje del test lo imprime).

## 2 · El cambio

`public/dashboard/js/customersView.js`, `avisoDeGuardadoFallido`: después del mensaje humano del
servidor (que sigue ganando) y antes de los avisos por campo, se decide por la MARCA de `api.js`
—`sinRed`, `incierto`, `status >= 500`—, nunca por el texto del error. No se tocan `api.js` ni
`schemas.ts`.

## 3 · Un error propio, encontrado al medir

El caso «los literales constan firmados» **pasaba antes de que existiera el registro**. `constaAprobado`
devuelve un array, y `assert.ok([])` es verde. Censo del patrón en `tests/`: sólo mis dos tests
(`scrum1199-…` y éste) lo usaban así; los demás ya comparan `.length` o `.includes`. Los dos pasan a
`.length > 0`, y se comprobó que el de 1239 CAE con el registro fuera y pasa con él.

## 4 · Verificación

- 1239 + 1199: 10 casos, 10 pass.
- Mutaciones con el código quieto, una por rama (`sinRed`, `incierto`, `>= 500`): cada una tumba
  exactamente su caso. Árbol restaurado y comprobado con `git diff --quiet`.
- Controles: el 400 sin campo sigue en el genérico de 1199, y un `message` humano del servidor sigue
  ganando también en un 500.
