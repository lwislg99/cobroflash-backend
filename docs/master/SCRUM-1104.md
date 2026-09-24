# SCRUM-1104 · Volcado de la respuesta del asesor a Q-C8 (modelos, 111/115, 347, 390, periodicidad, criterio de caja)

**Fecha:** 23-sep-2026 · **Carril:** J4 · **Gate:** ninguno — propone, no publica ni cobra.
**Medido contra:** `origin/main` = `a900d4484bddd80d3b0351294de6b6d2c53cc851` · 2026-09-23T17:45:31Z

## Encargo

Jira SCRUM-1104: volcar la respuesta completa del asesor fiscal a Q-C8 (23-sep-2026) a
`docs/legal/PREGUNTAS_ASESOR.md` y actualizar `docs/producto/CONTABILIDAD.md` §4, con la regla que
manda sobre todo el volcado: **ninguna cita que el propio asesor marcó ⚠ (de memoria) entra como cita
comprobada** — o se descarga y coteja el BOE consolidado, o va NO VERIFICADO (regla de oro de
`CONTABILIDAD.md` §0).

## Qué se hizo

1. **`docs/legal/PREGUNTAS_ASESOR.md`** — Q-C8 pasa de "parcialmente respondida" a **RESPONDIDA**,
   con el mapa completo de los 9 modelos (303/390/130/131/111+190/115+180/347/100/349), el detalle
   de 111/115, la periodicidad (REDEME→SII) y el criterio de caja. **Cada cita de artículo que el
   asesor dio de memoria queda marcada NO VERIFICADO ⚠** en la propia tabla, fila por fila; las
   fuentes AEAT que sí vinieron con enlace (exoneración del 390, calendario 2026, instrucciones del
   390, RECC en la guía del 036, ROF consolidado) se tratan como fuente, sin ⚠.
2. **`docs/producto/CONTABILIDAD.md`** — banner v0.11 (no se sobrescribe el v0.10), fila de Q-C8 en
   §4 actualizada a RESPONDIDA con resumen y remisión al detalle en `PREGUNTAS_ASESOR.md`, y la nota
   de "fuentes sin descargar" corregida: se retira el 131 de la lista de modelos pendientes de
   orden ministerial (no aplica, nunca) y se añaden explícitamente RGAT y los artículos nuevos de
   RIVA/RIRPF/LIRPF como fuentes SIN descargar todavía (ninguna se ha bajado en esta pasada). **No
   se tocó §3** (la tabla de citas YA comprobadas por script): añadir algo ahí exigiría bajar y
   cotejar el BOE, que es justamente lo que esta entrega NO hace.
3. **Cuatro cambios de alcance del encargo, aplicados:**
   - El **131** se retira: es el pago fraccionado de estimación objetiva (módulos), excluyente con
     el 130, y nunca aplica a este perfil (autónomo en estimación directa).
   - El **390 no está exonerado** — con fuente AEAT enlazada, no ⚠.
   - Se añaden el **100** (Renta, siempre) y el **349** (solo intracomunitario), que faltaban del
     mapa de modelos.
   - El **347 no desaparece con VeriFactu** — sólo lo elimina el SII, que es incompatible con
     VeriFactu.
4. **No duplicado:** REDEME→SII (ya **SCRUM-1102**) y la retención en facturas RECIBIDAS para
   111/115 (ya **SCRUM-1103**) se mencionan y se enlazan, pero no se repite su contenido.

## Lo que NO cubre esta entrega

* **No verifica ninguna de las citas ⚠** del asesor contra el BOE consolidado (arts. 30, 61 *decies*,
  71.3, 62.6 RIVA · 74-76, 100, 107, 109 RIRPF · 99 LIRPF · 31-35 RGAT · 163 *decies*/*duodecies*
  LIVA · numeración de casillas del 303). Quedan **NO VERIFICADO**, tal como exige la regla — no
  bloquea esta entrega, pero sí sigue siendo trabajo pendiente (CON-03) antes de que cualquiera de
  esas citas pueda entrar en §3 como comprobada.
* **No crea tickets nuevos en Jira** para 100/349 ni reestructura el backlog de §6: el encargo pedía
  actualizar el mapa, no abrir tickets (eso es de un jefe, A13).
* **No propone ningún texto de pantalla.** Las "cuatro preguntas de alta" que sugiere el asesor
  quedan citadas como propuesta, sin firma (regla 39). Cero claims fiscales (regla 7): nada de esto
  se implementa hasta que alguien lo firme.
* No repite ni resuelve SCRUM-1102 ni SCRUM-1103.

## Cómo se verifica

`git diff` de las dos rutas contra `origin/main` en este mismo commit: ninguna otra ruta tocada.
Lectura cruzada: la fila de Q-C8 en `CONTABILIDAD.md` §4 remite a `PREGUNTAS_ASESOR.md`, que trae el
detalle completo; ninguna cifra ni cita se repite con distinto valor entre los dos ficheros.
