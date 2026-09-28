# SCRUM-1216a · La pantalla de la serie deja de prometer lo que no hace

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:41Z (J1, árbol `cobroflash-jv1`; rama nacida de `f9dc44a3`)

SCRUM-1216 se partió en dos el 28-sep-2026. **1216a** es lo urgente que NO toca el camino de emisión.
**1216b** (el número de arranque declarado llega a la factura) toca `allocateInvoiceNumber` y va aparte.

## ① Qué se retira: la promesa

«Seguimos por ahí para que tu numeración no tenga saltos.», del alta (paso 2, `onboardingView.js`) y de
la puerta D1 de Ajustes (`puertaSerie.js`).

Es **falsa desde el 7-sep-2026**, con el corte de la serie F (SCRUM-780, `ba1cd2d5`). Medido contra el
`allocateInvoiceNumber` real (tx falso, SCRUM-1203): con «41» declarado y sin declarar nada salen las dos
`F260001`; el control anterior al corte da `2026-CF-042`. Se cumplió del 6-ago al 7-sep.

Lo demás de las dos pantallas **se queda como está**: la pregunta, el campo «Número» (lo necesita 1216b,
decisión del orquestador), la vista previa del servidor y el aviso «Compruébalo bien…». El hueco que deja
la frase lo cubre un `margin-top` en la vista previa: sin componente nuevo ni token nuevo.

## ② En `receipt` no se pinta NI el paso del alta NI la puerta de Ajustes

Regla 24: con `INVOICING_ES_ENABLED` en OFF, YaQu no emite nada. Medido antes de construir:

- **La puerta de Ajustes se enseñaba HOY en `receipt`.** `/admin/me` calcula `puertaSerieDisponible` sin
  mirar el modo (`app.ts:544-548`), y `puertaSerie.js` sólo ocultaba la vista previa (SCRUM-1029). Salían
  la pregunta, el campo y la promesa.
- **Guardar por detrás no bastaba.** `debeOfrecerArranqueDeSerie` con `invoiceSeriesYear: 2026` da
  `false` en 2026 y `true` a 1-ene-2027. Un merchant en `receipt` no emite nunca, así que nada vuelve a
  escribir el año y la puerta se le reabriría cada Nochevieja.

Se ocultan los dos con el modo que ya trae `/admin/me`, **sin tocar `src/`**:

- el alta filtra el paso marcado `pasoDeSerie` cuando `window.appModoEmision === 'receipt'` (`app.js` lo
  fija antes de abrir el asistente);
- `puertaSerieVisible` devuelve `false` en ese modo.

Decisión: ocultar el paso del alta en OFF, el fundador; extenderlo a la puerta de Ajustes, el orquestador,
sobre esta medición.

⚠️ **Fuera de España esto no aplica.** `getEmissionMode` devuelve `fiscal` para cualquier país que no sea
ES (`emission.service.ts:36-41`), así que un merchant no-ES emite hoy y ve el paso. Para él 1216a retira
la promesa falsa. El número declarado sigue sin llegar a su factura hasta 1216b.

## ③ Red — `tests/scrum1216a-serie-sin-promesa.test.mjs` (5)

Monta el dashboard con `tests/_banco-vistas.mjs` y pulsa, en las dos pantallas y en los dos modos:

- 🔴 **`receipt`, alta:** se recorre el asistente entero, sin el paso de la serie, sin la promesa y sin
  ninguna llamada a `/admin/onboarding/serie*`. Control: avanza al menos tres pasos distintos.
- 🔴 **`receipt`, Ajustes:** `renderPuertaSerie` devuelve `null` aunque el servidor la ofrezca, y
  `puertaSerieVisible(true)` es `false`.
- **`fiscal`, alta** (control positivo del filtro): el paso SÍ sale, sin la promesa, con la vista previa,
  y sigue guardando `{ vieneDeOtroSitio: true, ultimoNumero: 41 }`. Esto último **no cambia**: el campo
  se queda para 1216b.
- **`fiscal`, Ajustes:** la puerta sale sin la promesa, y la visibilidad sigue obedeciendo al servidor.
- **En el fuente de las dos pantallas:** la promesa no está.

**En rojo primero:** con las dos pantallas de `main` (hash de blob comprobado igual al de `main`) caen
los 5, por la promesa y por `receipt`. En `receipt`, los títulos recorridos eran `["¿A qué te dedicas?",
"¿Ya has facturado en 2026?", …]` y la puerta de Ajustes se pintaba. Con el cambio pasan los 5, y los 35
de los cuatro ficheros afectados.

### Tests existentes que cambian (regla 41: ninguno se relaja)

`scrum313-pantalla-numeracion` (lista de microcopy literal) y `scrumD1-puerta-serie` (las dos pantallas
dicen lo mismo) exigían la frase retirada. Sale de las dos listas, que siguen exigiendo el resto igual, y
su AUSENCIA la exige ahora `scrum1216a`. El guard de SCRUM-1029 no se tocó y sigue verde.

## ④ Lo que queda para 1216b, y SCRUM-1200

- **1216b:** con «41» declarado, la primera factura tiene que ser `F260042`; sin declarar, `F260001`.
  Toca `allocateInvoiceNumber` (regla 40) y lleva textos nuevos firmados. **J1 no lo empieza hasta que el
  GO del fundador para el camino de emisión, y los textos, estén escritos en el ticket.**
- **SCRUM-1200 vuelve a importar con 1216b.** En cuanto el número declarado cambie la factura, que el
  alta se trague un 400 con `.catch(() => {})` deja de ser inocuo: el profesional creería haber declarado
  el 41 y emitiría el 1. Va dentro de 1216b.
