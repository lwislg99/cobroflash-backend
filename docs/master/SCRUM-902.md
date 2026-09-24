# SCRUM-902 · «Firma del técnico» salía como botón nativo en el parte

**Fecha:** 17-sep-2026 · **Carril:** Sesión 4 · parte de trabajo
**Medido contra:** `origin/main` = `755d23997bd55ce7aa6d6a1cb6a98616926dfd7e` · 2026-09-17T14:04:27Z
**Rama:** `scrum-902-firma-tecnico-con-estilo`
**Horas:** las de la API de GitHub.

## ① PASO 0

- Visto en staging a 390 px el 17-sep (verificación de SCRUM-890 PR 2) y en el banco local: botón gris
  nativo con borde de sistema bajo «Firmar aquí mismo», que sí sale verde.
- **Causa:** los botones del parte no llevan `class`; `styles.css:3039-3076` (SCRUM-720) los estiliza
  por ATRIBUTO. El del cliente es `data-parte-firmar`; el del técnico se pinta con
  `data-parte-firmar-tecnico` (`parteDetailView.js:555`), que es otro atributo: `[data-parte-firmar]`
  no casa con él y ninguna regla le llega. Ningún otro botón del parte está en ese caso (medido).
- Comparación pedida: el albarán usa `mk()` con clases de la casa; el parte, reglas por atributo.

## ② Arreglo (sólo CSS, la vista no se toca)

`[data-parte-firmar-tecnico]` se añade a los cuatro grupos de los botones del parte: aspecto base,
`:active`, `:disabled` y `min-height: 44px`. **No** a la regla verde de `[data-parte-firmar]`: sería una
segunda primaria verde en la misma pantalla (Regla de Una Sola Voz). Sin estilos en línea ni clase nueva.

## ③ Rojo, verde y medida

- Rojo `920cd9db` (`tests/scrum902-botones-del-parte-con-estilo.test.mjs`): pinta el parte con el
  dashboard entero (con y sin la firma del cliente) y exige que TODO botón sin clase tenga un selector
  por atributo en `styles.css` (sin comentarios). Cayó exactamente con `[["data-parte-firmar-tecnico"]]`
  y con «ninguna regla le da los 44 px». Suelo: ve el botón del cliente y el lector del CSS distingue
  `[data-parte-firmar]` de `[data-parte-firmar-otra]`.
- Arreglo `adb84749`. Tests del parte (890, 890b, 902): 25 ✔.
- Chromium con el `index.html` y el CSS reales: a 390 y a 1280 px «Firma del técnico» = fondo blanco,
  texto Tinta, borde 1 px, pastilla, Inter 600, **44 px**; «Firmar aquí mismo» sigue verde; sin scroll
  horizontal. El comportamiento de firmar no cambia (no se toca la vista).

## ④ De paso, pedido por el orquestador

`docs/equipo/sesion-4.md`: la trampa «comprobación encadenada al push» (SCRUM-895) y corregidos, sin
borrar lo medido entonces, «② A15 NO EXISTE» (A15 está en `00-normas-comunes.md:249`) y «EL #1212
PARADO» (mergeado 2026-09-15T11:30:34Z).
