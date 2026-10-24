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

## SCRUM-1064c · Los rótulos del impreso en la ruta, y las dos rutas del repercutido medidas (J1, 24-oct-2026)

**Medido contra:** `origin/main` = `bcfc99b0d9a4f4a3aaf9d1608dce06b3d3691482` · 2026-10-24T15:32:25Z
**Rama:** `scrum-1064c-rotulos-y-rutas` · **Puesto:** J1 (sesión jv-j1bu) · **Encargo:** orquestador `cobroflash-backend-95`
**Decisión que lo autoriza:** SCRUM-1064 c.20780 (T9 y T17: transcripción literal; T10 y T13–T16: sin la fórmula). **Entrega:** comentario en SCRUM-1064.

### 1 · Los rótulos (hecho)

`ROTULOS_303` en `src/modules/fiscal/modelo303/casillas.ts`: casilla → rótulo, columna y página, y `GET /admin/modelo-303` lo sirve como `rotulos` junto al cálculo (`modelo303.routes.ts`; `construirModelo303` no cambia). Leídos como IMAGEN del Anexo III de la Orden HAC/27/2026: página 1 (`…/1761_16563944_7.png`, 01–09, 27, 28–31, 45, 46) y página 3 (`…/1761_16563944_9.png`, 64–71).
- **Las 01–09 no tienen rótulo propio.** Son tres filas de la llave «Régimen general», bajo «IVA devengado», y las distingue la columna: «Base imponible», «Tipo %», «Cuota». La llave abarca seis filas: 150, 165, 01, 153, 04 y 07.
- 28/29 y 30/31 llevan las columnas del bloque deducible: «Base» y «Cuota». La 65 y la 66 comparten rótulo («Atribuible a la Administración del Estado»), y la 65 lleva «%».
- La 70 lleva en el impreso una llamada «(*)» a una nota al pie. Aquí va sin ella.
- Test: `tests/scrum1064c-rotulos-del-303.test.mjs` (3 casos), con los literales copiados del impreso, no de `casillas.ts`. Declara 4 mutaciones en `MUTACIONES_QUE_ME_TUMBAN`, y las ejecuta el `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`. El resultado va en la entrega.
- **Error mío, de la tanda:** primero escribí un mutador propio en `docs/master/evidencias/`. Una de sus anclas casaba dos veces en `dist/casillas.js`: la M4 decía «quita el rótulo de la 70» y quitaba la 70 de la lista de vacías. Lo vi leyendo qué caso caía. Después `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs` tumbó el banco por llevar lista propia. El de la casa ya comprueba el ancla única (`ambiguedadDelAncla`, SCRUM-1321). Lo borré antes de empujar.

### 2 · ¿Dan `/admin/reports/vat` y `/admin/modelo-303` el mismo repercutido? (medido; NO arreglado)

Banco: `docs/master/evidencias/scrum1064c/repercutido-dos-rutas.mjs`. Pasa facturas fabricadas por los DOS handlers reales de `dist/`, con el `prisma` singleton sustituido por una base en memoria y `TZ=UTC`, como Railway. Población: 6 casos, medidos tras traer a la rama el `main` que lleva SCRUM-1063e (la ISP fuera de las casillas). Control: con 21/10/4 % y una factura ajena y otra del 3T de por medio, las dos rutas dan cuota 63,00 y base 1.119,97 (calculado a mano: 21,00 + 2,00 + 40,00).

| caso | cuota vat | casilla 27 | base vat | base casillas 303 | periodo |
|---|---|---|---|---|---|
| control 21/10/4 | 63 | 63 | 1.119,97 | 1.119,97 | igual |
| + una línea al 0 % | 21 | 21 | 250 | 100 | igual |
| + una línea al 5 % | **31** | **21** | 300 | 100 | igual |
| + una línea al 7,5 % | **36** | **21** | 300 | 100 | igual |
| + una línea ISP (causa S2) al 21 % | 21 | 21 | 400 | 100 | igual |
| sin trimestre, 30-jun 22:30Z | 21 | 21 | 100 | 100 | **vat 2T · 303 3T** |

Por qué:
- **Tipos sin tripleta (5 %, 7,5 %…), el 0 % y la ISP:** Informes suma TODOS los tipos en `totals` y agrupa sólo por tipo (`src/modules/reports/app/routes/reports.routes.ts:293-297`). El 303 aparta a `sinClasificar` la ISP (`src/modules/fiscal/modelo303/modelo303.ts:308`) y los tipos sin tripleta (`modelo303.ts:325-334`). Con el 5 % o el 7,5 %, la cuota discrepa; el 7,5 % lo declara `src/modules/invoicing/domain/vat.service.ts:21` entre sus tipos. Con el 0 % y con la ISP sólo discrepa la base. La ISP, además, Informes la funde en su fila del 21 %: esa fila enseña base 400 con cuota 21. `tests/scrum389-un-solo-iva.test.mjs` cuadra Informes contra «27 + `sinClasificar`», no contra la 27 sola. Además está gateado por `LIBRO_PG_URL` y su juego no lleva ningún tipo sin tripleta.
- **El periodo por defecto:** Informes saca el trimestre en curso del reloj del PROCESO (`reports.routes.ts:266-268`). El 303 lo saca de la zona del merchant (`modelo303.routes.ts:25-38`, SCRUM-735). En la madrugada española de cada cambio de trimestre, las dos pantallas abiertas sin `quarter` enseñan trimestres distintos. El resumen del trimestre hace lo mismo que Informes (`reports.routes.ts:363-365`). `reports.routes.ts` es de S1 (`node scripts/carriles.mjs de …`), así que lo de Informes no lo arregla J1.
- **Sin medir:** si el 5 % o el 7,5 % son alcanzables hoy desde una pantalla de YaQu, y qué tipo va en las filas 150, 165 y 153 del impreso. Si la 153–155 fuera la del 5 %, la casilla 27 del 303 se quedaría corta, y sería del cálculo, no de Informes. El impreso no lo dice: lo dirían las instrucciones de la orden, que no he leído.

### No hecho / no medido

- No he tocado `public/` ni el cálculo. Los 7 avisos (T20) no se exponen.
- Suite entera en local: NO CORRIDA (10 sesiones a la vez). Corridos: el test nuevo, el type-check (`tsc --noEmit`, 0 líneas), 35 dirigidos tras el merge (368 = 365 + 3 saltos por `LIBRO_PG_URL`) y la selección de `tests:que-cubren`, antes del merge. En esa selección cayeron `scrum1298b` (2), `scrum351` (1) y `scrum476` (1). Los tres primeros caen igual sobre `origin/main` en un árbol hermano: son del árbol anidado sin `node_modules`. `scrum476` no lo he corrido sobre `main`.
- yaqu.app: sin verificar; la ruta pide sesión de admin.

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`
