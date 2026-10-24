# SCRUM-1064 · Modelo 303, la pantalla — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## Dependencia declarada por el propio ticket

El ticket dice literalmente **«ESPERA el ticket del cálculo»** y **«Depende de: “Modelo 303
completo, el cálculo”»** — es decir, de SCRUM-1063. [`docs/master/SCRUM-1063.md`](./SCRUM-1063.md)
(mismo PR) mide que SCRUM-1063 está bloqueado por SCRUM-1039 (orden ministerial sin descargar) y
Q-C8 (sin responder, `docs/producto/CONTABILIDAD.md:86`).

Además, la propia aceptación de este ticket repite el mismo gate en su punto 3: **«casilla sin
cita = no aparece»**. Sin la orden citada no hay rótulos ni casillas que pintar: la pantalla se
quedaría vacía por diseño, no por un bug, así que construirla ahora no adelanta nada verificable.

## Qué existe ya, y qué falta

`GET /admin/modelo-303` existe (`src/modules/fiscal/modelo303/modelo303.routes.ts`) y no tiene
pantalla — el propio ticket lo cita correctamente
(`docs/master/SCRUM-295.md:136-147`). No hay ningún fichero de `public/dashboard/js/` con
`modelo303` ni `modelo-303` (grep sin resultados). No hay trabajo previo que absorber ni que
duplicar: simplemente no se puede construir la pantalla de un cálculo que todavía no tiene sus
casillas finales.

## Siguiente paso exacto

Ninguno para J1 hasta que SCRUM-1063 se desbloquee (que a su vez espera SCRUM-1039 + Q-C8). Cuando
llegue, además hace falta la skill `yaqu-premium-ui` (ya declarada en el propio ticket) y la firma
del fundador para el texto y el nombre del modelo (regla 39).

## STOP respetado

No se ha tocado el cálculo, la ruta existente, ni ningún fichero de `public/dashboard/`. Solo
lectura y este documento.

## SCRUM-1064b · Dónde vive la pantalla y qué textos necesita — medido, sin construir (J1, 24-oct-2026)

**Medido contra:** `origin/main` = `d34ee753fdd5b9858b31307d2d34704c80275f67` · 2026-10-24T10:26:03Z
**Rama:** `scrum-1064b-pantalla-303-medida` · **Puesto:** J1 (sesión jv-j1bk) · **Encargo:** orquestador `cobroflash-backend-95`, «solo medir y proponer»
**Entrega completa:** Jira SCRUM-1064, comentario 20741. Lleva la tabla de 22 textos y las 13 preguntas ✅/❌. Aquí va sólo lo que hace falta para retomarlo.

### Lo que cambió desde el bloqueo de arriba

El cálculo ya está en `main` (PR #1763, merge `8fe2de5af2530ad29a6ea1ca80391e68957d372d`), con las casillas 28/29, 45 y 46. La 64 = 46 y las 65, 66, 68, 69, 70 y 71 vacías, con su motivo como código, están en el PR #2811 (`scrum-1063c-suplidos-y-64` @ `c185f80c88f7c22c092c781a11da2e8131cf5b77`), ABIERTO a las 10:28Z. El aviso de suplidos está firmado (SCRUM-1063 c.20731), pero todavía sin aplicar.

### Dónde viviría, y de quién es (medido con `node scripts/carriles.mjs de …`)

- La ruta es `GET /admin/modelo-303` (`src/app.ts:605`, `requireRole('admin')`). Es de J1, y la pantalla sólo la consume.
- Ninguna pantalla la consume hoy. `git grep -E "modelo-?303|modelo303"` en `public/` da 0. El control positivo es el mismo patrón, que sí casa en `src/app.ts:605`.
- La vista natural es `public/dashboard/js/reportsView.js`, y es **S2**. Ya lleva dos piezas del 303: la tarjeta «IVA repercutido · modelo 303» (sobre `/admin/reports/vat`) y el «Resumen del trimestre» (SCRUM-1049).
- Un fichero nuevo `public/dashboard/js/modelo303View.js` también sería **S2** (`dos-equipos.md:152`). `app.js` e `index.html` son S2 (contenedor).
- **La pantalla la construye S2 (equipo de Luis).** J1 aporta el contrato de la ruta y la transcripción de los rótulos que faltan.

### Lo que sale de la medición

- **Textos ya firmados que esta pantalla puede usar:**
  - el aviso de suplidos (SCRUM-1063 c.20731);
  - el badge de trimestre en curso y el estado vacío de 1049 (c.17008). Estos dos están firmados para el Resumen, y reusarlos aquí pide un ✅.
- **El subtítulo firmado de 1049 no sirve aquí:** dice «Hacienda», y el punto 2 de la aceptación de 1064 lo prohíbe.
- **Rótulos citados en el repo:** 27, 28/29, 30/31, 45, 46, 64, 69 y 71 (`casillas.ts:63-64`, `SCRUM-1039.md:81-84`).
- **Rótulos sin cita literal:** 01–09, y 65, 66, 68 y 70. Hay que transcribirlos del Anexo III de la Orden HAC/27/2026 antes de construir.
- **El nombre oficial del modelo**, leído hoy en el título de BOE-A-2008-20953 (curl, 180.543 B): «modelo 303 Impuesto sobre el Valor Añadido, Autoliquidación». Propongo no pintar «Autoliquidación».
- **Avisos en texto llano:** los 7 de `motivosParaNoFiarse` (`modelo303.ts:316-348`) viajan así en el JSON y en el CSV de evidencias, y ninguno está firmado para pantalla. El `avisoObligatorio` (`modelo303.ts:140`) sigue con `[PENDIENTE microcopy oficial]`.

### No medido

- Si `/admin/reports/vat` y `/admin/modelo-303` dan el mismo repercutido. Con la pantalla nueva habría tres superficies «303» en Informes.
- Qué rol ve «Informes».
- Las imágenes del impreso.
- Tests: no he corrido ninguno.
- yaqu.app: no he verificado nada.

A9: sin fallo que generalice — el bloqueo del 22-sep caducó con #1763 y se vio cruzando SCRUM-1063, no este ticket; que un ticket hermano no comente en el dependiente no lo ve ningún guard del repositorio, porque no lee Jira.
