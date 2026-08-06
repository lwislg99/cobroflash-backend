# SCRUM-D1 · la puerta de última oportunidad de la numeración (bloque D, lado front)

**Fecha:** 6-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `f56f49038ab9fbeb2e1a21bc2eb9ec0958c48877` · 2026-08-06T14:26:21+02:00
**Tanda:** 2042 tests, 1974 pass, 0 fail

## El defecto

El Paso 2 del asistente pregunta por la numeración, así que a quien se da de alta HOY sí se le
pregunta. Lo que **no existía es la segunda oportunidad**: quien ya pasó el onboarding —o se lo
saltó— no tenía dónde contestar. Y es justo el perfil que importa: el que viene de otro programa
con facturas ya emitidas y descubre el problema cuando ya ha emitido tres mal numeradas.

**Medido antes de construir:** `puertaSerieDisponible` se calcula y se publica en `/admin/me`, y
había **CERO ocurrencias en todo `public/`**. El backend ya decía a quién le corresponde y no
había ninguna pantalla que lo leyera.

## Lo que se construye

Una tarjeta en **Configuración → Numeración**, encima del campo de la serie, con:

* **El veredicto del SERVIDOR**, consumido tal cual (`window.appPuertaSerieDisponible`). El
  navegador **no** comprueba `invoiceSeriesYear !== año`: hay un test que prohíbe ese nombre en
  `public/`, con su respaldo en el servidor (SCRUM-237 — una negación necesita quien la sostenga).
* **La vista previa EN VIVO** ya construida, pedida al mismo endpoint que el asistente. Sin ella
  la puerta no protege nada: el usuario no sabría qué está confirmando. Y calculándola aquí diría
  un número y la factura otro.
* **El campo Serie BLOQUEADO con su motivo** cuando ya hay emitidas, nombrando cuántas y cuál fue
  la última. Un campo editable que el servidor va a rechazar es peor que uno bloqueado: le deja
  escribir, le deja guardar y le contesta que no.
* **Microcopy: el aprobado del asistente, literal** (regla 30), con un test que compara las dos
  pantallas frase a frase. Que digan lo mismo es parte del punto: quien vuelva a verla tiene que
  reconocerla.

## Un cambio de servidor, mínimo y por el mismo motivo de siempre

`puertaSerieDisponible` es `false` por **DOS motivos distintos** —ya emitió, o ya contestó este
año— y solo el primero bloquea el campo. Para que la pantalla no tenga que adivinar cuál es, se
publica `serieEmitida: { emitidas, ejemplo }`, derivado del **mismo array** que ya se calculaba.

Y para no escribir «el ejemplo es el número más alto» en dos sitios, se extrae
`resumenSerieEmitida` de `bloqueoCambioDeSerie` y **ésta la usa**. Hay un test que comprueba que
el aviso de la pantalla y el rechazo del servidor enseñan **el mismo número**.

## Los dos controles, y por qué hacen falta los dos

| | Caso | Resultado |
| --- | --- | --- |
| **NEGATIVO** | ya emitió con nosotros | NO ve la puerta |
| **POSITIVO** | se saltó el asistente, no ha emitido | **SÍ** la ve |
| tercero | ya contestó este año, sin emitir | no hay puerta, y su campo **no** se bloquea |

Sin el POSITIVO, una puerta que no se le enseña a **nadie** pasaría el negativo tan campante — el
caso en el que el ticket se da por hecho y la pantalla no existe. Es el mismo par que los dos
vacíos de SCRUM-385: cada uno solo, engañable; juntos, no.

## Rojo por el mecanismo (por `$?`)

| Inyección | Resultado |
| --- | --- |
| el front deja de consumir el flag | exit 1 · «nadie lee `puertaSerieDisponible`… la pantalla no se entera» |
| Configuración deja de pintarla | exit 1 · «Configuración no pinta la puerta» |
| la regla se reimplementa en el navegador | exit 1 · «está mirando invoiceSeriesYear» |
| deja de pedirse la vista previa | exit 1 · «el usuario confirmaría a ciegas» |

## Lo que cazó un guard ajeno

**SCRUM-274**: el script nuevo faltaba en el shell del service worker. Tenía razón — `addAll` es
atómico y la app se habría servido a medias. Añadido a `public/sw.js`.
