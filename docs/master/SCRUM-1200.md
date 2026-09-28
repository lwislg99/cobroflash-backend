# SCRUM-1200 · El arranque de la serie: el 400/409 (ya arreglado) y la falta de respuesta (esto)

**Medido contra:** `origin/main` = `9a05dea65dfbc2800e2f405fcc05ed4f1ffe399c` · 2026-09-28T19:15:00Z (los 3 commits que main avanzó después, hasta `65cb140e`, no tocan ningún fichero de este cambio)

Sesión J1 (`jv-j1`), 28-sep-2026, por encargo del orquestador de Javier.

## ① PASO 0 · el enunciado ya estaba arreglado, bajo OTRO número

El defecto del ticket —que el paso 2 del alta se tragara el 400/409 de `/admin/onboarding/serie` y
avanzara— lo cerró **SCRUM-1216b** en el PR #1895 (merge `76da0f49`, en producción):
`docs/master/SCRUM-1216.md` §⑦ «SCRUM-1200, cerrado aquí». Buscar «1200» en ramas, en `git log` o en
`docs/master/` no lo encuentra, porque los commits llevan el número 1216b. Hay que buscar el
**defecto**, no la referencia.

Medido corriendo, en un worktree fijado a `9a05dea6`: `tests/scrum1216b-pantalla-arranque.test.mjs`,
**14/14**. El 400 y el 409 no avanzan, y cada uno enseña su texto; «Sí + 41» y «No» avanzan.

## ② Lo que quedaba: la falta de respuesta

Medido con la pantalla real (banco de vistas), con los dos errores que construye `api.js`:

| fallo | ¿avanza? | lo que veía el profesional |
|---|---|---|
| `sinRed` | no | «Failed to fetch»: en inglés, y distinto según el navegador |
| `incierto` | no | «no se pudo confirmar si la petición llegó», cadena interna |

`textoErrorSerie` devolvía `e.message` tal cual. El «No se pudo guardar.» de reserva no llegaba a
salir, y si hubiera salido habría afirmado algo que no se sabe.

## ③ El arreglo

- `public/dashboard/js/puertaSerie.js`: una ranura nueva, `SERIE_TEXTOS.errorSinRespuesta`, y
  `textoErrorSerie` la devuelve si `e.sinRed || e.incierto`, **antes** de mirar código o mensaje.
  Sirve a las dos pantallas (el alta la usa desde `window`). Nada de `src/`.
- Texto: **Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1200
  comentario 17418. Registro: `docs/microcopy/2026-09-28-SCRUM-1200-arranque-sin-respuesta.md`.

**Rojo primero** (`tests/scrum1200-sin-respuesta.test.mjs`, commit `1fee191c`): con el código de main
caen 7 de 8, todos con el mensaje crudo («🔴 enseña «Failed to fetch»»), y pasa el control. **Verde
después:** 8/8. El control comprueba que un rechazo CON respuesta (400 `numero_fuera_de_rango`, 400
`numero_invalido`, 409 con título y mensaje) sigue diciendo lo suyo.

⚠️ Depende de que `api.js` siga marcando `sinRed` e `incierto` (SCRUM-404/459). Si esa distinción se
pierde, el texto vuelve a firma.
