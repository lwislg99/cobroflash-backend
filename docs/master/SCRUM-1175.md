# SCRUM-1175 · Parte de trabajo sin IA (916a) — PR-A: horas y desplazamiento

**Medido contra:** `origin/main` = `63e33e92c5c7f1f535513e7a52b7126707a34247` · 2026-09-27T16:51:50Z
**Rama:** `scrum-1175-parte-horas-selector`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`). Pantalla: `parteDetailView.js` + `styles.css`.
**Origen:** la parte de SCRUM-916 que NO depende de la IA. SCRUM-916 sigue ABIERTO: el dictado y la IA
que ordena las líneas están simulados y medir cuánto aciertan con voz real va antes (necesita
`GEMINI_API_KEY`, decisión de coste del fundador). Plan: PR-A horas (éste) → PR-B firmas → PR-C datos plegados.

## Textos

Firmados por delegación en SCRUM-916, comentario 17251 (corregido en 17255):
«Horas y desplazamiento», «Ahora», «Tiempo en la obra» con «3 h 30 min», «Revisa las horas»,
«La salida es antes que la entrada», «km». Los de siempre («Entrada», «Salida», «Desplazamiento»,
«Kilómetros») no cambian.

- **«La hora se elige, no se escribe.»** firmada CON CONDICIÓN: se pinta sólo cuando **los dos** campos
  son un selector de verdad. Con uno de texto libre la hora sí se escribe, y la frase sería falsa ahí.
- ⛔ **«horas» junto a Desplazamiento NO se pinta.** `desplazamientos` es `Int` y el `PATCH` responde
  «Los desplazamientos son un número entero»: es un recuento, no una duración. El prototipo lo trataba
  como horas con `step 0.25`, que el servidor rechazaría con un 400. Retirado en el com. 17255.
- ⛔ **«Sin las dos firmas el parte no se cierra.»** (PR-B) tampoco se pinta: con UNA firma cualquiera el
  parte pasa a `firmado` (`partes.routes.ts:675` y `:754`). `firmasCompletas()` existe
  (`parteTrabajo.ts:429`) y se sirve (`:161`), pero nada la consume. Decide el fundador (com. 17253).

## 🔴 Riesgo medido: pérdida silenciosa de datos

`entrada` y `salida` son `String?` de texto libre. Un `<input type="time">` con `value="8h"` sale
VACÍO, y el siguiente `change` guardaría el vacío encima del dato del profesional. Regla construida:
**si el valor guardado no es HH:MM estricto (`00:00`–`23:59`), el campo se queda de TEXTO con su valor y
sin «Ahora»**. La regla va campo a campo. Sin tocar el esquema.

## El cambio

- Entrada, salida, desplazamiento y kilómetros pasan a su paso «Horas y desplazamiento», debajo de
  obra/REF/técnicos. **Los siete campos siguen siendo campos**, con el mismo `data-parte-campo` y el
  mismo `PATCH`: ni uno retirado.
- Selector `type="time"` + «Ahora» (44 px), que guarda por el MISMO camino que el `change` a mano.
- Duración recalculada al elegir la hora. Salida anterior → aviso, sólo mientras el parte se puede
  editar. Salida igual a la entrada, o alguna hora de texto: no se pinta nada (no se adivina).
- Una visita que cruza la medianoche (22:00 → 02:00, una urgencia de noche: caso NORMAL en un oficio)
  da el aviso. **Molesta, pero no miente**, y por eso se deja así: «La salida es antes que la
  entrada» es literalmente cierto (02:00 es anterior a 22:00 en el reloj) y «Revisa las horas» es una
  petición, no un veredicto; no bloquea nada. Un «Las horas están mal» sí habría sido falso en ese caso.
  No se arregla: distinguir «se equivocó al teclear» de «cruzó la medianoche» necesita una FECHA en la
  salida, y hoy sólo hay una hora de texto. Sería cambio de esquema.
- Parte firmado: sin selector, sin «Ahora», sin guía y sin aviso; la duración sí (es un dato cierto).

## Tests — `tests/scrum1175-horas-del-parte.test.mjs` (8)

- **Contra main: 0/8** (rojo antes).
- **Mutación:** `cabeEnSelector` devolviendo siempre `true` (el selector se pinta sobre «8h») →
  cae **sólo** el test de la pérdida silenciosa (7 pasan, 1 falla). El guard ve el defecto que dice ver.
- Con el cambio, junto con los 14 ficheros que leen `parteDetailView` (818, 652c, 666b, 720, 890…):
  **136/136**. Ampliado a todo fichero que lee `parteDetailView` o `styles.css`, más el ancla (267) y
  el registro (854): **74 ficheros · 714/714 · 0 saltados**. La tanda completa NO se ha corrido en
  local (la máquina es compartida y el turno se pide para eso); la corre el check obligatorio del PR.

## Capturas (390 px, producto real en Edge, `docs/master/evidencias/scrum1175/`)

`selector-390-antes` (main) · `selector-390-despues` · `textolibre-390-despues` («8h» se queda de texto,
sin «Ahora» y sin la guía) · `aviso-390-despues`.
