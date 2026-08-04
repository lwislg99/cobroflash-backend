# SCRUM-284 · B1 — censo derivado de los campos de Configuración

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `17289f59f73e041b8989bddd69868aca056eec17`
**Tanda:** 1280 tests, 1213 pass, 0 fail, 67 skipped (`npm test` con exit **0**)
**Ficheros:** `tests/_censo-configuracion.mjs`, `tests/scrum284-censo-configuracion.test.mjs` (8)

> **ALCANCE:** solo el **censo**. No toca la sidebar, no mueve ni un campo, no renombra nada y
> **no asigna campos a submenús** — la asignación espera a que el fundador confirme el orden de B1.

## Por qué derivado

B1 trocea Configuración en nueve submenús, y el ticket nombra su propio fallo mudo: *«un ajuste
que desaparece en una reorganización… nadie lo nota hasta que alguien va a cambiar su IBAN y no lo
encuentra»*. Una lista a mano no avisa de lo que le falta.

## El resultado: 25 campos, en CUATRO formas de declaración

| origen | nº |
|---|---|
| `createField(etiqueta, clave, tipo, obligatorio)` | 13 |
| `createToggle(clave, etiqueta, pista)` | 3 |
| `createElement("select")` + `.name` | 1 |
| HTML dentro de plantillas (`<input id>`, `<select id>`) | 8 |

## 🔴 La cuarta forma es la lección, y la pagué yo

La **primera versión declaraba TRES formas**, medidas del árbol, daba **22 campos** y tenía **los
suelos en verde**. Los tres avisos por email no aparecían por ningún lado **con la pantalla
intacta** — se declaran con `createToggle`, no con `createField`.

**Lo destapó el CONTRASTE con la lista a mano del ticket, no el censo.** O sea que un censo
derivado tampoco es infalible: lo que lo salva es contrastarlo contra la lista humana y
**reportar la diferencia en vez de callarla**. La lista del ticket no sirve como censo, pero sí
como control cruzado — cada una ve lo que a la otra se le escapa.

## El cruce que caza un renombrado

Un conteo solo ve desapariciones. Si alguien **renombra** `iban`, el conteo no se mueve y el
ajuste queda escribiendo en una columna que no existe. Por eso toda clave de `createField` debe
ser columna de `Merchant`, **derivada del schema**, no de una lista. Con su propio suelo: si el
parseo del schema se rompiera, el conjunto quedaría vacío y el cruce pasaría en verde sin comparar
nada.

## Suelos, medidos hoy

13 `createField` · 3 `createToggle` · 1 `select` · 5 plantilla. No son cifras de gusto: son lo que
hay, fijado. Quitar un campo baja el conteo y cae.

## Verificado en rojo

- **Campo quitado** (`iban`, línea 113 de `settingsView.js`): cae con
  `🔴 el censo solo vio 12 campos vía createField (esperados ≥13)`.
- **Detector cegado** (`createField` deja de reconocerse): caen **dos** suelos. El mensaje dice las
  dos causas porque desde fuera son indistinguibles: *«o ha desaparecido un ajuste, o el detector
  dejó de reconocerlos»*.

Commiteado **antes** de inyectar. Árbol restaurado y verificado.

## Controles negativos

- Un **botón**, un **div** o un **enlace** con `id` no son ajustes: contarlos inflaría el censo y el
  suelo dejaría de proteger nada.
- La **declaración** del helper no es un campo; solo lo son sus llamadas.

## Contraste con la lista del ticket — lo que el fundador necesita

**Campos que la lista de doce asuntos NO menciona:**

- **`country`** (selector de país, línea 93)
- **`clabe`** (CLABE interbancaria · México, línea 114)
- **`approvalThreshold`** («Importe máximo sin aprobación», línea 412) — es un asunto entero:
  aprobaciones de equipo
- **`qr-formato`, `qr-size`, `qr-dark`** (línea 782) — opciones de descarga del QR

**Y lo que la lista SÍ menciona y el censo no veía:** los tres avisos por email — ya incorporados.

## Límites declarados

- Si aparece una **quinta forma** de declarar un campo, este censo no la verá. Por eso el suelo
  exige encontrar de las cuatro y por eso el contraste se reporta.
- El censo enumera **controles de la pantalla**, no columnas persistidas: `qr-*` y `ref-link` son
  controles de interfaz, no ajustes que se guarden. La distinción la decide la asignación, que no
  es de esta tarea.
