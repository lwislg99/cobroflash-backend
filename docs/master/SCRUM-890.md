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

---

# PR 2 · Firma de parte sin red y rechazo visible en el parte

**Medido contra:** `origin/main` = `74ba2aeb3f669c02a1bd0fb1cc548d6377e82e74` · 2026-09-17T09:01:50Z
**Rama:** `scrum-890b-firma-sin-red-rechazo` · **Carril:** Sesión 4 · **Gate:** literal firmado por delegación del fundador (SCRUM-890 comentario 15665)

## 5 · Lo construido

- **Sin red el pad del parte no se cierra:** `firmarParte` relanza sin ③ con `mensajeDeFalloAlFirmar`,
  el literal del albarán (no hay texto nuevo). La firma sigue en la cola, como fijó el PR 1.
- **El rechazo al vaciar la cola se ve en el parte:** antes de sacar la firma, `colaDeFirmas.js` deja
  constancia en `localStorage` (`yaqu_firma_rechazada_<claveIdempotencia>`). Si no se puede escribir,
  la firma **se queda** en la cola. El parte la lee al abrirse y avisa en la sección de firmas:
  `parte_vacio` → `TEXTOS.parteVacioNoSeFirma`; el resto → `TEXTOS.firmaRechazada`
  (`docs/microcopy/2026-09-17-SCRUM-890-firma-rechazada.md`). Se borra cuando esa firma sube con
  éxito y al cerrar sesión (registrada en `CLAVES_LOCALES` con purga).
- **`400:invalid_id`** entra en los rechazos definitivos (comentarios 15668 y 15670).
- **Toda conexión a IndexedDB se cierra con `versionchange`**, también la que llega tarde tras un
  `blocked`. `VERSION_BD` sigue en 1. Sin schema.

## 6 · Por qué la constancia NO está en IndexedDB

La primera versión la guardaba en un almacén nuevo `firmasRechazadas` (base a v2). Medido en Chromium
con dos pestañas del mismo origen (JS de main y JS de la rama), y con el dashboard de main entero:

- La pestaña vieja bloquea la subida de versión **sólo durante cada operación** (quieta, 0 bloqueos;
  en operaciones seguidas, 8 de 10 intentos, 2–94 ms). Pero la apertura bloqueada dejaba una conexión
  huérfana: la subida siguiente seguía bloqueada a los 2 s en 8 de 10 intentos (0 de 10 con
  `onversionchange`).
- 🔴 **Tras subir a v2, la pestaña con el JS de main se queda sin almacén (`VersionError`) y un parte
  firmado sin red cierra el pad y no queda en ninguna cola.** Control sin la subida: sí queda.

Decisión del orquestador (17-sep, 10:50 CEST): medir la constancia sin subir la versión y, si cumple,
un solo PR. Cumple (§8).

## 7 · Rojo, verde y mutaciones

- Rojos: `0f026ffb` (pad y rechazo mudo), `9764f43a` (`versionchange`), `9ee92e21` (base sube de
  versión, constancia que no se escribe, `invalid_id`). Arreglos: `e4a5eb26`, `ddbe1ff9`, `c766dce2`.
- Mutaciones, cada una tumba su test: escritura que devuelve GUARDADO tras fallar, clave sin purga,
  olvidar que no borra, sin `onversionchange`.

## 8 · Medido en navegador

Chromium real, dashboard de la rama y de main en el mismo origen, sin service worker, red interceptada:

- Sin red → pad abierto con el literal del albarán → la firma en la cola.
- Vaciar con 400 `firma_invalida` → constancia escrita y firma fuera; **recargar** → el parte avisa;
  IndexedDB en versión 1.
- Pestaña con el JS de main a la vez: abre la base sin error y su firma sin red queda en la cola.
- Firmar ese parte con éxito → constancia borrada, sin aviso.
- `localStorage` lleno (comprobado que no cabe ni una constancia) → el servidor rechaza y la firma
  **se queda** en la cola; con sitio, el siguiente vaciado la rechaza y deja la constancia.
- Cerrar sesión (`purgarDatosLocales`) → constancia borrada; `yaqu_tips_shown` sobrevive.
- **360 y 390 px** con el `index.html` real: el aviso ocupa 2 líneas (336 / 366 px de ancho, 63 px
  de alto), sin desbordar la caja ni la página.

⚠️ Dos medidas salieron ciegas y se repitieron: la clave sembrada a mano era `firma:cliente:7` (la
real es `firma:parte:7`, de `claveDeFirma`), y la red se interceptaba por `/api/` cuando el panel
llama a `/admin/...`.

**Límite aceptado:** con el parte ya abierto cuando se vacía la cola, el aviso sale al volver a abrirlo.
