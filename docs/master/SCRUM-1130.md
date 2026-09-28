# SCRUM-1130 · La demo «Pruébalo tú» de la landing nunca llega a «Firmado»

**Medido contra:** `origin/main` = `0afa87cd95645317226f59bc379edae59a7bea44` · 2026-09-28T18:40:27Z (reloj de la máquina, UTC)

Sesión J3 (jv-j3). Carril: landing (`area-j3`, leída del ticket).

## 1 · PASO 0 — ejecutado en yaqu.app, no leído

Playwright contra `https://yaqu.app/#probar`, a 390×844. Se pulsan los botones de verdad:

| momento | pantalla visible | «Firmar y aceptar» |
|---|---|---|
| inicio | 0 | — |
| tras «Enviar por WhatsApp» | 1 | — |
| tras «Abrir y firmar» | 2 | activo |
| tras «Firmar y aceptar» +0,3 s | 2 | `disabled` |
| tras «Firmar y aceptar» +3,3 s | 2 | `disabled`, ningún estado nuevo |

Causa (`public/index.html`, bloque de la demo): el manejador de `[data-sign]` solo añadía la clase
`draw` al recuadro (el trazo animado de 1,1 s) y apagaba el botón. No marcaba el paso 3 como hecho
ni enseñaba ningún final, y solo existen las pantallas `data-scr` 0, 1 y 2. No es código muerto:
lo alcanza cualquier visitante que pruebe la demo.

## 2 · ¿La demo afirma algo que el producto no hace? No

La demo acaba en la firma del presupuesto y no enseña factura ni cobro. La firma sí ocurre en
España con la emisión apagada: regla 24, citada en `quotes.routes.ts:495-497` («presupuestos,
firma, albaranes y partes siguen igual»); en `receipt` solo se salta la emisión. Es un bug de botón.

Pero el final propuesto sí podía serlo: la opción A («Firmado · 961,95 €») es el fotograma `paid`
(COBRADO) de la cabecera. No se firmó; se firmó la B. Detalle en la ficha de microcopy.

## 3 · Arreglo

- `public/index.html`:
  - Al acabar el trazo (1,1 s; al momento con `prefers-reduced-motion`), `terminar()` marca los tres
    pasos como hechos, esconde el botón y enseña `#signOk`.
  - `#signOk` es una píldora con `role="status"` y el literal firmado «Firmado · Acepto».
  - «Volver a empezar» cancela el temporizador pendiente y lo deja todo como al principio.
  - Estilos con clases nuevas en el `<style>` de la página (`.isign-ok`, `.ibtn.is-hidden`) y
    tokens existentes (`--tint`, `--brand-700`, el borde `#bbf7d0` de la `.sign-ok` de cabecera).
    Ni un `style=` en línea.
- Firma: **SCRUM-1130 comentario 17403** (orquestador por delegación del fundador), leída en Jira
  antes de aplicarla. Ficha: `docs/microcopy/2026-09-28-SCRUM-1130-demo-firmado.md`.
- Se cargó `yaqu-premium-ui` antes de tocar la landing. Es un componente, en una pantalla.

## 4 · Test, con el rojo antes

`tests/scrum1130-demo-llega-a-firmado.test.mjs` ejecuta el bloque real de la demo, sacado de
`index.html` entre sus dos marcadores, en `node:vm` sobre el marcado de `#probar` (mini-DOM de
`_banco-vistas.mjs`). Los clics suben hasta `#iscreen` como en el navegador y los temporizadores
se avanzan a mano. `clearTimeout` cancela de verdad; uno de mentira habría acusado al código que sí
cancela.

- Suelo: el banco ve las 3 pantallas y los pasos 1 y 2 quedan hechos al llegar a la firma.
- Rojo sobre main (commit `6dabf826f06a4a2b9856dde66f4db75cda9f89ed`, antes de tocar la landing):
  1 pass y 3 fail, «🔴 el paso 3 (…) no queda hecho tras firmar: la demo no termina».
- Con el arreglo: 4 de 4.
- Límite del banco: no agrega el `textContent` que va detrás de un hijo (límite 4 declarado). Por
  eso el literal se lee del marcado de `#signOk`; lo que hace la demo se mide ejecutándola.

Navegador real, servidor estático local de `public/`, mismo recorrido:

- a +0,4 s de firmar, el paso 3 sigue «on» y el botón está `disabled` (el trazo aún se dibuja);
- a +1,6 s, los tres pasos están «done», el botón no se ve y `#signOk` se ve con «Firmado · Acepto»,
  56 px de alto y `role="status"`;
- tras «Volver a empezar», vuelve a la pantalla 0, el paso 1 queda «on» y `#signOk` deja de verse.

El único error de consola fue un 404 de `/public/founding-status`, que el servidor estático no sirve.

## 5 · Lo que NO se construye (comentario 17403)

El máster A22 describe la demo como «crear→enviar→firmar→factura→pagar» y hay tres pasos. Los dos
que faltan pondrían una factura y un cobro en la landing pública, contra la regla 24 enmendada
después de aprobar A22. Es una divergencia máster↔código que decide el fundador; aquí no se toca.

## 6 · La afirmación 19 del censo publicado (añadido el 28-sep-2026, 20:42Z GitHub)

El CI del PR #1923 cayó en `tests/scrum564-afirmaciones-publicadas.test.mjs`: «el censo encuentra 19
afirmaciones y se midieron 18». La 19 es la píldora nueva, `probar/div#7`, «Firmado · Acepto». Nadie la
había declarado. Esta sesión solo había corrido su test y 12 guards, no la suite entera, y por eso no
lo vio antes de entregar.

**Veredicto del orquestador:** se ANCLA, no se descarta. `DESCARTADAS` es para lo que no afirma nada
del producto (su ejemplo es la barra de direcciones simulada, `probar/div#1`). Esta píldora afirma que
el presupuesto se firma, y eso es verdad con la emisión apagada. Queda igual que su hermana
`probar/span#9` («Lo firma desde el móvil»): `anclas: [FIRMA]`.

Qué cambia:
- `scripts/_afirmaciones-publicadas.mjs`: `ANCLAS_564` gana `'probar/div#7'` con `[FIRMA]`.
- `tests/scrum564-afirmaciones-publicadas.test.mjs`: el trinquete pasa de 18 a 19 y CON_ANCLA de 13 a
  14, con el motivo escrito al lado. Las falsas siguen en 2, `ANCLA_A_DECLARAR` en 1 y las descartadas
  en 2. Además, dos nombres de test decían «18» a mano; ahora lo sacan de la constante.

Control negativo: con el ancla quitada y los contadores nuevos, el guard vuelve a caer en «ninguna se
queda sin declarar». Con el ancla puesta, 12 de 12. Suite entera sobre esta rama, tras `prisma generate` y `npm run build`: 8866 tests, 8732 pasan, **0 fallan**, 134 saltados (piden base). `public/index.html` no se toca: el texto sigue
siendo el firmado en 17403.
