# SCRUM-890 · Firmar un parte vacío: el aviso se ve y la cola deja de reintentarlo

**Medido contra:** `origin/main` = `c8f9548338dcd3d3ed93d3ef2afdcc5161abdfd4` · 2026-09-16T18:45:56Z
**Rama:** `scrum-890-parte-vacio-cola` · **Carril:** Sesión 4 · **Gate:** literal firmado por delegación del fundador (SCRUM-890 comentario 15623)

> Dos fallos que se tapaban uno al otro: la pantalla se callaba el 409 y la cola lo guardaba como
> si fuera un corte de red.

⏱ Hora **de GitHub** (cabecera `Date:` de `gh api -i zen`).

---

## 0 · PASO 0

- **El 409:** `POST /admin/partes/:id/firmar` y `/firmar-tecnico` responden 409 `parte_vacio` si el
  parte no tiene líneas (`partes.routes.ts`, `puedeFirmarse`).
- **El silencio:** `firmarConRedDeSeguridad` devuelve el error DENTRO del resultado; `firmarParte`
  no lo lanzaba, y `signaturePad.js` sólo avisa si `onConfirm` lanza. El pad se cerraba como si el
  cliente hubiera firmado.
- **La cola:** `colaDeFirmas.js` dejaba en la cola cualquier error que no fuera `*_locked`, al
  firmar y al vaciarla, y `app.js` la vacía en cada arranque: el mismo 409, para siempre.
- **Reproducido corriendo** en un banco con los ficheros reales (`colaDeFirmas.js` +
  `parteDetailView.js`), el pad con el contrato de `signaturePad.js` y el error con la forma de
  `api.js`. **No se repitió en staging.**

## 1 · Lo construido

- **Rechazo definitivo = lista cerrada de `status:code`**: `409:parte_vacio`, `400:firma_invalida`,
  `400:firma_sin_nombre`, `400:calidad_firmante_invalida`, `400:calidad_firmante_otro_vacio`,
  `413:firma_demasiado_grande`. Al firmar sale de la cola (`rechazada: true`); al vaciarla sale y se
  cuenta en `rechazadas` con su código.
- **Se quedan en la cola**: `invalid_transition` (SCRUM-358: sacarla sería perderla), 401, 403,
  404 (otra cuenta en el mismo móvil), 408, 429, 5xx y cualquier código desconocido.
- **Parte vacío:** el pad no se abre; aviso `.alert warning` con `role="alert"` en la sección de
  firmas. Si el 409 llega con el pad abierto, `firmarParte` lanza y el pad no se cierra.
- Literal: `docs/microcopy/2026-09-16-SCRUM-890-parte-vacio-no-se-firma.md`. Sin schema.

## 2 · Rojo, verde y mutaciones

- **Rojo** (commit `53ffdb4f`): el pad se cerraba, la firma seguía en la cola y el vaciado la
  dejaba en `fallidas`.
- **Mutaciones**, cada una tumba su guard y al revertir vuelve el verde: 404 en la lista,
  `invalid_transition` en la lista, red como rechazo, `*_locked` como rechazo, aviso sin tono,
  sin aviso, sin `throw`.
- **Suite completa** antes del merge con main: 6.991 pasan; el único rojo era esta entrada.

## 3 · Medido en navegador (360 y 390 px)

Página de prueba con `tokens.css`, `styles.css`, `colaDeFirmas.js` y `parteDetailView.js` reales,
parte vacío, dos pulsaciones: **un** aviso, `display: block`, 13,5 px, `#B45309` sobre `#FFF7ED`,
62,5 px de alto, sin desbordar la página ni la caja, pad sin abrir, cero errores.
Captura: `evidencias/scrum890/aviso-parte-vacio-360.png`.

⚠️ La primera medida dio **0 avisos**: a la página de prueba le faltaba `colaDeFirmas.js`, y
`firmarParte` sale antes sin `firmarConRedDeSeguridad`. El `index.html` real lo carga (línea 372).

## 4 · Fuera de este PR (decidido: segundo PR del mismo ticket)

1. Firmar un parte **sin red** también cierra el pad en silencio → igual que el albarán.
2. `rechazadas` no se enseña en ninguna pantalla → el profesional lo verá en el propio parte.
