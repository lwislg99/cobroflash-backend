# SCRUM-1443 · Presupuesto rápido: cuando algo falla se dice qué ha pasado, no «API 500: …»

**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:42:58Z
A9: comprobación → `tests/scrum1443-rapido-dice-que-ha-pasado.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de texto y de qué rama lo pinta en `public/dashboard/js/homeView.js`: sin marcado, sin estilos y sin clases nuevas.

6-oct-2026 · **S2** (`s2-6octb`) · rama `scrum-1443-rapido-dice-que-ha-pasado`. Firmas: SCRUM-1443 c.18307 (sustituye a c.18284, que no se podía construir) y c.18313. Ficha: `docs/microcopy/2026-10-06-SCRUM-1443-presupuesto-rapido-fallos.md`. Carril: `homeView.js` es de S2 (`dos-equipos.md`, y el ticket lleva `area-s2`).

## Qué había, medido antes de tocar

- **Visto en yaqu.app el 6-oct-2026** (build `39af736e`, cuenta QA 46, 8 casos: escritorio y 390×844 × «Un precio» y «3 opciones» × cliente nuevo y existente): con el envío contestando 500, dentro del modal se lee **«API 500: internal_error»**. La respuesta del servidor la simulaba la sonda (`sondas-s2/qq2.mjs`).
- El `catch` de `submitQuickQuote` pintaba `err.message`, y cubre dos fallos distintos: el alta (nada guardado) y el envío (presupuesto ya guardado).
- **`qqState.creado` no sirve para distinguirlos** (lo midió S4 en c.18296 y lo confirmo): recuerda el presupuesto del intento anterior. Caso ejecutado en el test: primer intento guardado, se cambia una línea, y el alta del segundo falla.

## Qué contesta el servidor al envío (LEÍDO en `quotesAdmin.routes.ts`, no ejecutado contra él)

| contesta | ¿salió el WhatsApp? | qué se lee ahora |
| --- | --- | --- |
| 400 `customer_missing_phone` | no: no se intentó | aviso de «sin teléfono», fuera |
| 400 `invalid_phone_format` | no: no se intentó | aviso de «teléfono no válido», fuera |
| 404 `not_found` · 400 `invalid_id` | no: no se intentó | **como antes: el código crudo** (ver defecto abierto) |
| 500 `internal_error` · sin red · plazo vencido | no se sabe | «…no sabemos si el WhatsApp ha salido…», en el modal |
| 409 `pending_approval` | no | su aviso de siempre, sin tocar |

Los rechazos de Meta, los topes diarios y la baja del cliente no llegan a ese `catch`: vuelven 200 con una frase del servidor y se pintan como antes.

## Qué cambia

- `guardadoEnEsteIntento`: variable local de `submitQuickQuote`, falsa antes del `try` y cierta en cuanto hay presupuesto (creado ahora, o reutilizado porque lo pedido es idéntico). Decide entre «no hemos podido crear» y «hemos guardado».
- `textoDelFalloQq(err, guardado)`: lo que se lee en el modal. Pasa por `mensajeParaPersona`: si el servidor manda una frase, se lee ésa; si no, el texto firmado.
- `avisarGuardadoSinTelefono` atiende también `invalid_phone_format`, con su texto y el mismo gesto: cerrar el modal, avisar fuera, abrir el presupuesto.
- La palabra del documento sale de `appLocale.quoteVerb` («presupuesto» / «cotización», en minúscula), con «presupuesto» de respaldo.
- Desaparece el respaldo «Error al crear la cotización.», que decía «cotización» en un panel español.

## El gemelo

El aviso de «sin teléfono» de SCRUM-1198 (firmado el 2-oct, c.18206) escribía «El presupuesto se ha guardado» sin la palabra del país y con un «enviarlo» que señala al documento. El c.18313 lo sustituye. **`tests/scrum1198-cliente-nuevo-sin-telefono.test.mjs` cambia lo que afirma, y lleva las dos fechas dentro.**

**Regla de esta pantalla (c.18313): ningún pronombre apunta al documento.** La palabra cambia de género según el país; lo que haya que nombrar se nombra («el WhatsApp», «el teléfono») y del documento se habla en voz activa. Está escrita también en el código, encima de `palabraDelPresupuestoQq`.

Sin tocar, y son de la misma pantalla: los avisos de cuando todo va bien («✓ Presupuesto enviado por WhatsApp», «Presupuesto creado. Envío WhatsApp pendiente.») componen con `appLocale.quote` y **«enviado» y «creado» concuerdan en masculino**: con «Cotización» salen mal. No tienen firma nueva y no entran aquí.

## Verificado, ejecutando

`tests/scrum1443-rapido-dice-que-ha-pasado.test.mjs`, con el modal de verdad en el banco y una red de mentira.

- **Antes de tocar el código** (17 casos de la primera versión): 4 verdes (el suelo, la frase del servidor y dos controles) y 13 rojos.
- **Después:** todos verdes, con los casos del teléfono no válido añadidos al llegar el c.18313.
- `tests/scrum1198-…`: sus dos casos del aviso cayeron en rojo con el código nuevo, como debían, y vuelven a verde con el literal del c.18313.
- `tests/scrum514-aprobado-y-aplicado.test.mjs`: los cuatro textos se declaran como compuestos (`NO_SE_CRUZAN`), con sus partes fijas.

## Defectos que quedan abiertos, a propósito

- **`not_found` e `invalid_id` en el envío se siguen leyendo como código crudo.** Se sabe que el WhatsApp no salió, así que «no sabemos si ha salido» sería falso, y no tienen texto firmado. Justo después de crear el presupuesto no deberían darse. Hay un test que fija que no se les pone el texto de otro caso.
- Una frase del servidor al fallar el envío taparía el «hemos guardado». Hoy la ruta no manda ninguna en los fallos que llegan al `catch` (leído).

## Lo que NO se ha podido mirar

- **En yaqu.app, con este código:** no está desplegado.
- El servidor de verdad contestando `invalid_phone_format` o un 500: la tabla de arriba es lectura de la ruta.
- Con «cotización»: medido en el banco; no hay cuenta de pruebas de otro país.
