# SCRUM-446 · PASO 0: las 24 cabeceras NO son homogéneas — paro antes de unificar

**Medido contra:** `origin/main` = `bf4ffb730a332f936e5bec6000fe665d4e6b0a9c` · 2026-08-10T20:34:39+02:00
**Rama:** `scrum-446-cabecera-modal`

**10-ago-2026, 20:34 CEST (UTC+0200)**

El encargo decía: *«Si al medir resulta que las 24 no son homogéneas —que hay dos o tres formas
distintas de cabecera— DILO ANTES DE UNIFICAR»*. **Hay tres mecánicas y cuatro etiquetas de título.**

## El censo, sobre código ejecutable

Confirmado el punto de partida: **24 cabeceras en 16 ficheros**. (El primer barrido las contó
incluyendo menciones en comentarios; se rehízo sobre `soloEjecutable` — la trampa de
autorreferencia, séptima vez en este repo.)

### Tres mecánicas de construcción

| | mecánica | cuántas |
|---|---|---|
| ① | **HTML en plantilla** (`<div class="modal-header">…`) | **17** |
| ② | **DOM imperativo** (`document.createElement` + `className`) | **6** |
| ③ | **DOM con el helper local** `createElement(tag, clase, texto)` | **1** |

Un constructor compartido que devuelva una **cadena** no sirve a ② ni a ③; uno que devuelva un
**nodo** obliga a reescribir las 17 de ①. **No es un detalle de estilo: es la firma del constructor**,
y elegirla mal deja siete sitios fuera o diecisiete tocados de más.

### 🔴 Y el que convierte esto en decisión, no en refactor: la etiqueta del título

| etiqueta | cuántas |
|---|---|
| `<h3 class="modal-title">` | **12** |
| `<span class="modal-title">` | **5** |
| `<div class="modal-title">` | **5** |
| otro (div/desconocido) | 2 |

**`<h3>` y `<span>` no son la misma cosa para quien no ve la pantalla.** Un lector de pantalla
anuncia el `h3` como encabezado y le da estructura al modal; el `span` no anuncia nada. Unificar
**obliga a elegir una**, y esa elección **cambia lo que se anuncia en 12 sitios** (si gana `span`) o
**en 12 sitios** (si gana `h3`) — en los dos casos, media docena larga de pantallas cambian de
comportamiento para una persona con lector de pantalla.

Eso es una decisión de accesibilidad (checklist AB6), **no un refactor**, y no me corresponde
tomarla en una tarea que dice explícitamente que no cambia nada que vea el usuario.

### Y dos cabeceras SIN botón de cierre

`customerDetailView` y `quotesView:70`. Un constructor con botón las **añadiría** uno donde hoy no
lo hay: eso **cambia el comportamiento**, y puede haber flujos que obliguen a elegir a propósito.
Un constructor sin botón se lo **quitaría** a las otras 22.

## Lo que pregunto antes de construir

1. **La firma del constructor:** ¿devuelve cadena (y se reescriben las 7 imperativas) o nodo (y se
   reescriben las 17 de plantilla)? Las dos son un refactor mayor que «pasar las cabeceras por él».
2. **La etiqueta del título:** `<h3>` o `<span>`. Con lo que implica para el lector de pantalla, y
   sabiendo que hoy hay 12 de cada bando.
3. **Las dos sin botón de cierre:** ¿es deliberado? Si lo es, el constructor necesita el botón como
   opción, y eso hay que decidirlo antes de escribirlo.

**Unificar sin contestar esas tres es exactamente el defecto que este proyecto nombró en SCRUM-242:
reutilizar algo que respondía a otra pregunta.** Aquí serían tres preguntas distintas metidas en una
sola función.

## Lo que NO he hecho

No he construido el constructor · no he tocado ninguna cabecera · no he escrito el guard (nacería
midiendo una forma que aún no está decidida) · no he añadido ni un «?» (eso es SCRUM-416).

## Lo que SÍ queda medido para cuando se decida

- las 24, con fichero, línea, mecánica, etiqueta de título y si tienen botón;
- los **3 overlays propios** que el encargo ya señalaba —`signaturePad`, `onboardingView`,
  `tutorial`— siguen fuera del alcance del constructor **y hay que declararlos**, porque la ayuda
  está oculta por **dos mecanismos distintos**: los modales compartidos por
  `display:none !important` (`styles.css:2173`) y la firma **porque su overlay está a z-index 1200
  con el FAB en 350** — no oculto, **debajo**. Quien arregle solo el primero verá desaparecer el
  síntoma en 24 de 27 sitios y lo dará por resuelto.
