# SCRUM-1075 · Aviso de fin de trimestre: «Tu resumen del trimestre ya está listo»

**Medido contra:** `origin/main` = `f6814d23d2467de7f790e9bebb6e059a083f890c` · 2026-09-25T17:18:10Z
**Fecha:** 25-sep-2026
**Rama:** `scrum-1075-aviso-fin-trimestre` · **Skill UI:** cargada (`yaqu-premium-ui`)

## Encargo

Bloque Contabilidad (BLOQUE E, SCRUM-280), Ola 3. Desbloqueado por el orquestador el 25-sep-2026:
dependía de SCRUM-1049 (la pantalla del «Resumen del trimestre»), y esa pantalla ya existe (PR
#1778, auto-merge armado) aunque SCRUM-1048 (retenciones) siga esperando al asesor — este ticket
solo ENLAZA, no calcula.

Copia el HÁBITO de la competencia (Contasimple anuncia un «Calendario Fiscal»; Holded, un panel
«Upcoming Taxes») sin su AFIRMACIÓN: ninguna fecha de presentación, ningún plazo, nunca la palabra
«presentar» ni «Hacienda» (regla 7).

## Diseño

**Cero cálculo fiscal nuevo.** El aviso reutiliza los TRES endpoints que ya usa SCRUM-1049
(`/admin/reports/vat`, `/admin/libros/recibidas.json`, `/admin/reports/pl`) para el trimestre
NATURAL anterior — con la MISMA fórmula de «trimestre sin datos» que aquél, para no inventar un
segundo criterio de «¿hay algo que enseñar?» que pueda divergir del de la pantalla a la que enlaza.

- `public/dashboard/js/homeView.js`:
  - `trimestreAnteriorMadrid(fecha)` — el trimestre natural anterior al de `fecha` (por defecto
    `new Date()`), calculado con `Intl.DateTimeFormat(..., { timeZone: 'Europe/Madrid' })` y no con
    `getMonth()` en la hora del navegador: un profesional que abre la app desde fuera de España no
    debe ver el trimestre equivocado justo el día que cambia.
  - `claveDescarteResumenTrimestre(anio, trimestre)` — clave de `localStorage` por
    MERCHANT + USUARIO + TRIMESTRE (aceptación #5). Medido antes de pedir columna nueva: el
    descarte es una conveniencia de ESTE navegador, no un acuse que otro dispositivo del mismo
    usuario necesite ver, así que `localStorage` basta.
  - `pintarResumenTrimestreEnHome()` — pinta el `<div id="home-resumen-trimestre">` de la Home
    (fuera del `try` de las métricas, sin `await`, mismo patrón que `renderBotHandoffs`): sin
    descartar, con datos en el trimestre anterior, muestra el aviso; descartado o sin datos, lo
    deja vacío. Nunca lanza: cualquier fallo de red deja el aviso vacío (no se afirma lo que no se
    pudo comprobar).
- `public/dashboard/js/app.js`: una línea, `window.appTeamMemberId = me.teamMemberId ?? null` — el
  dato YA vuelve en `GET /admin/me`, solo faltaba publicarlo para poder construir la clave por
  usuario.

**Sin CSS nuevo.** El aviso usa `.alert.info` (ya en `styles.css`, el mismo que
`quotesView.js:1264/1786`) y `.btn-primary/.btn-ghost.btn-sm` del inventario AB3. El botón de
cerrar reutiliza `aria-label="Cerrar"`, que **no es texto nuevo** — ya lo usan
`invoiceDetailView`/`modalHeader.js` (api.js:857).

**NO se toca** `reportsView.js` ni el cálculo del resumen: el enlace es
`renderAppView('reports')` sin preseleccionar trimestre — el selector propio de SCRUM-1049 ya
está justo ahí. Preseleccionar el trimestre exacto habría significado tocar un fichero de otro
ticket (aún en PR sin mergear al empezar éste); se deja fuera a propósito, no es un hueco.

## ✅ Texto — FIRMADO por el fundador (regla 39; comentario del orquestador por delegación
permanente, SCRUM-1075, 25-sep-2026, sin cambios sobre la propuesta)

1. Título: «Tu resumen del trimestre ya está listo»
2. Cuerpo: «Con los números del trimestre pasado, para llevárselo a tu asesor.»
3. Botón de enlace: «Ver resumen»

## Test de contrato

`tests/scrum1075-aviso-resumen-trimestre.test.mjs`, sobre `pintarResumenTrimestreEnHome` con un
`<div id="home-resumen-trimestre">` suelto (mismo patrón que `scrum469-aviso-desalojo.test.mjs`,
sin montar la Home entera): suelo de publicación · el borde del trimestre en hora de Madrid (antes
del cambio / justo en el primer instante / vuelta de año) · sin datos no sale (verificado en rojo)
· con datos sale con el literal firmado y sin «presentar»/«plazo»/Hacienda/fechas · descartado no
reaparece (verificado en rojo) · el botón de cerrar guarda el descarte · aislamiento entre
comerciantes y entre dos usuarios del mismo comerciante · el enlace navega a Informes.

**Trampa de arnés encontrada escribiendo el test, NO del producto:** comparar con
`assert.deepEqual` un objeto devuelto por una función que corre DENTRO del VM del banco, contra un
objeto literal del fichero de test, falla por prototipos de distinto realm aunque los campos sean
idénticos — se corrige comparando sobre una copia plana (`{ ...valor }`).

**`tests/scrum698-vistas-que-no-se-miden.test.mjs` actualizado**: `renderHomeView` pasa de 144 a
145 nodos (el nuevo `div#home-resumen-trimestre`, vacío en ese banco porque sirve `{}` a los tres
endpoints y la fórmula de «sin datos» lo deja así) — entrada nueva en el trinquete, por identidad,
las otras tres vistas intactas.

## Fuera de este incremento

- Deep-link al trimestre exacto en el selector de `reportsView.js` (ver arriba).
- El guard `guard-objetivo-tactil.mjs` no cubre la Home: los botones nuevos se quedan en
  `.btn-sm` (30 px), igual que el resto de la Home hoy (p. ej. «Responder →» de
  `bot-handoffs-card`) — no es una regresión de este ticket, es el estado ya existente de
  `.btn-sm` en toda la pantalla, pendiente de la decisión del fundador (SCRUM-786/787).
