# SCRUM-1470 · El PDF del presupuesto dice bajo la firma el mismo día que su página pública

**Medido contra:** `origin/main` = `fdac6867180adf6892fa3cb0f514ebbf69d04ab5` · 2026-10-06T13:33:29Z

A9: comprobación → `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs`

Sesión J3d (`jv-j3`) · rama `scrum-1472-fecha-impresa-zona-del-negocio` · **cruce de carril declarado
por el orquestador de Javier** (el ticket es `area-j1`). Va en la MISMA rama que sus hermanos
SCRUM-1471 y SCRUM-1472, a propósito: los tres dicen que hay dos criterios para pintar una fecha, y
repartidos habrían salido tres.

## La forma, que es UNA y ya existía

    fecha.toLocaleDateString(<idioma>, { timeZone: zonaDelMerchant(merchant), …las mismas opciones })

Es lo que hace la página pública desde SCRUM-633 (cinco sitios en `quoteDecisionLanding.routes.ts`),
`validez.ts` y la franja de la visita del portal, y es lo único que el censo de SCRUM-1093h
(`scripts/_censo-fecha-sin-zona.mjs`) acepta como «con zona». No se ha escrito ningún helper nuevo.
El texto no cambia en ningún sitio: sólo el reloj con que se pinta el valor.

## El rojo, ejecutado ANTES de tocar nada

Con `tests/_sonda-fecha-impresa.mjs` (un proceso hijo que ARRANCA en UTC, como Railway; genera el
PDF de verdad y lee su texto, y pide la página por su ruta), sobre `origin/main` sin tocar:

| Caso | Página pública | PDF, bajo la firma |
|---|---|---|
| aceptado el 3-oct-2026 a las 00:30 de Madrid (+2), negocio en `Europe/Madrid` | 03 de octubre de 2026 | **02** de octubre de 2026 |
| aceptado el 15-ene-2026 a las 00:30 de Madrid (+1) | 15 de enero de 2026 | **14** de enero de 2026 |
| CONTROL · aceptado a las 14:00 de Madrid | 02 de octubre de 2026 | 02 de octubre de 2026 |
| el instante del primer caso, negocio SIN zona | 02 de octubre de 2026 | 02 de octubre de 2026 |

Después del arreglo las dos primeras filas dicen 03 y 15 en los dos papeles, y las dos últimas no se
mueven. El test se vio caer: con los cinco `src/` devueltos a `main` y `dist/` reconstruido, **9 de
15 casos caen**; los 6 que aguantan son el suelo, los controles de mediodía y los dos «declarados».

## Qué se ha cambiado

- `pdf.service.ts` (`generateQuotePdf`): la fecha bajo la firma (dos llamadas, la de `signedAt` y su
  respaldo `new Date()`) lleva `timeZone`. El documento recibe `zona` (el `Merchant.timezone` en
  crudo) y la resuelve con `zonaDelMerchant`: ausente, nula o rota cae a UTC, que es lo que el papel
  imprimía en producción.
- `presupuestoParaPdf.ts`: el constructor de las cuatro puertas pasa `zona`. Como su tipo es
  `Completo<…>`, una puerta que la olvidara no compila; y las cuatro le dan la fila entera del
  negocio (leído en cada una).
- ⚠️ **Una consecuencia que se dice:** un presupuesto YA FIRMADO cuyo PDF se regenere (el
  `GET /admin/quotes/:id/pdf` sobrescribe `pdfUrl`) saldrá con el día del negocio donde antes salía
  la víspera. Es justo lo que pide la aceptación 1; no cambia ningún hash (el sobre de SCRUM-805
  sella datos, no los bytes del PDF) ni ningún valor guardado. **Roza la regla conservadora de SCRUM-987** («el papel de un firmado no cambia de aspecto por debajo»): aquí cambia una fecha, de la equivocada a la correcta, sólo si alguien regenera el papel y sólo en negocios con zona declarada. Se queda dentro por decisión del orquestador de Javier, que lo sube al fundador.

## Lo que NO se ha cambiado, con su motivo y con QUÉ decisión lo desbloquea

| Sitio | Qué imprime | Por qué se queda | Qué lo desbloquea |
|---|---|---|---|
| `pdf.service.ts::dateStr` (3 filas del censo) | la «Fecha:» del PDF de la **FACTURA** | Vive dentro de `generateInvoicePdf` y sólo la usa la factura: el PDF del presupuesto NO imprime fecha de creación (el enunciado decía «factura y presupuesto»). Esa fecha es fiscal. | **El fundador decide qué día imprime el PDF de la factura** (aceptación 2). Dato para decidir, LEÍDO y no ejecutado: el registro fiscal ya deriva su fecha con `zonaDelMerchant` desde SCRUM-735, así que hoy el PDF y el registro pueden decir días distintos. |
| `pdf.service.ts::generateQuotePdf`, el sello | «Sello temporal: 02/10/2026, 22:30:00 (hora del servidor)» | El literal dice de sí mismo que es la hora del servidor, está firmado y es copia byte a byte del albarán (lo ata `scrum805`). Pintarlo en la zona del negocio lo haría FALSO. | **Firma del fundador sobre el literal** (regla 39): o se queda como está —dice la verdad—, o cambian a la vez la hora y la frase. |
| `invoicesAdmin.routes.ts::fD` | las fechas del paquete de disputa | El enunciado no le encontró gemelo. Lo tiene: el sello de arriba. El banco recibe el paquete («Aceptado el … 22:30», sin decir de qué reloj) y el PDF firmado («22:30:00 (hora del servidor)»). Hoy coinciden; mover uno solo abre la contradicción que este ticket prohíbe. | **La misma firma que el sello.** Cambian juntos o no cambian. |

Las tres quedan en la clase IMPRIME del censo con este motivo escrito en `USO`.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| 1. Un presupuesto aceptado a las 00:30 hora del negocio, con la zona declarada, imprime en su PDF el MISMO día que su página pública. | `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs` · «SCRUM-1470 · 🔴 aceptado a las 00:30 del negocio…» (verano, invierno y Canarias), su control de mediodía y el borde |
| 2. Decidido por J1 con su jefe qué día imprime el PDF de la FACTURA, y escrito en este ticket. | NO HECHO → el fundador, por el orquestador de Javier. Este ticket no se cierra: se parte. |
| 3. Las filas de `pdf.service.ts` e `invoicesAdmin.routes.ts` salen de la clase IMPRIME del censo, o quedan con su motivo escrito. | `censar()`: de 7 quedan 5 (las tres de `dateStr`, el sello y `fD`), cada una con su motivo en `USO`; las 2 de la firma han salido. Lo ata el último caso del test. |
| 4. Cada gemelo de la tabla está hecho o declarado. | firma ↔ página: hecho. `dateStr` ↔ portal (fecha de la factura): declarados los dos, esperan la aceptación 2 (SCRUM-1471). Sello ↔ `fD`: declarados los dos. |

## Lo que no se ha mirado

- **No está visto en yaqu.app:** la rama no está mergeada.
- La tanda completa local no se ha corrido (no es alcanzable en esta máquina): una lista dirigida y
  el obligatorio del PR.
- La comprobación de tipos local da 6 errores, los 6 en ficheros que esta rama no toca y por el
  cliente de Prisma viejo del checkout compartido; la buena es la del CI.

## 6-oct-2026 · el obligatorio del PR #2220 salió ROJO, y los dos casos eran de esta rama

Lo escribe J3e (relevo de J3d), sobre la rama mezclada con `origin/main` =
`ee4331a46b2d89864d1f044dcdc43af32e4c4479`. El job obligatorio de la punta `d6efb53a` acabó en
`failure` con dos casos caídos. Ninguno era ajeno.

### ① `SCRUM-643 · la DECISIÓN de qué zona usar vive en UN sitio`

**La rama introdujo una lectura directa de `merchant.timezone` con su propia decisión para cuando
falta:** `src/modules/quotes/domain/presupuestoParaPdf.ts`, `zona: merchant.timezone ?? null`. No es
un tropiezo administrativo: es el patrón exacto que el guard existe para impedir.

No fue un descuido. J3d pasó la zona **en crudo a propósito** y la resolvía dentro del documento
(`pdf.service.ts`, `zonaDelMerchant({ timezone: params.zona })`): su comentario lo decía. Lo que el
guard lee como una segunda decisión era la decisión deliberada de no decidir ahí. **El guard tiene
razón de todas formas**: un `timezone ?? X` en el camino es justo como se vuelve al reloj del
proceso, y el guard no puede distinguir un `?? null` inocente del `?? 'Europe/Madrid'` que vendría
después copiándolo. Y la ironía, que se escribe: **el guard ha cazado en esta rama el mismo defecto
que estos tres tickets arreglan** — una zona resuelta a mano.

**El arreglo es del código, no del guard (regla 41):** `zona: zonaDelMerchant(merchant)`. El
comentario de J3d que decía «EN CRUDO» lleva debajo una línea fechada que dice que ya no lo es.

Lo que cambia y lo que no, medido:

- `zonaDelMerchant` **no** devuelve lo mismo que `merchant.timezone ?? null` cuando el negocio no
  tiene zona: devuelve `'UTC'`, no `null`. Y con una zona que `Intl` no conoce devuelve `'UTC'`,
  donde antes viajaba la cadena rota. Se paró y se consultó al orquestador antes de cambiarlo.
- El campo `zona` tiene **un solo lector** en `src/`: `pdf.service.ts`, que lo vuelve a pasar por
  `zonaDelMerchant`. Sobre una zona ya resuelta devuelve la misma, así que cambia el valor
  intermedio y **no el día impreso**.
- **Ejecutado, no sólo leído:** «SCRUM-1470 · 🔴 CONTROL: una firma de mediodía NO cambia de día, y
  sin zona declarada (o con una rota) el papel dice lo que decía» pasa antes y después del cambio,
  con los mismos literales (`sinZona` y `zonaRota`: «02 de octubre de 2026»). «Negocio sin zona: no
  se mueve nada» sigue siendo verdad en el papel.
- La alternativa `zona: merchant.timezone` a secas dejaba el guard verde esquivando el patrón en
  vez de llamar al sitio único. Descartada.

### ② `SCRUM-553 · el número de etiquetas con el \`>\` pegado NO SUBE` (21 sobre un tope de 20)

Había tres candidatos en `tests/_sonda-fecha-impresa.mjs`, que añade esta rama. **Medido con el
propio censo** (`scripts/censo-etiquetas-pegadas.mjs`, 1.709 ficheros leídos) antes de tocar: cuenta
**uno solo**, el extractor del evento del recibo, `<li>` con el `>` pegado. El comentario de uso de
la cabecera **no cuenta**, y el extractor de `pf-card-meta` ya llevaba `[^>]*`. El arreglo es la
forma que el propio guard enseña: `<li[^>]*>`. Tras el cambio el censo dice 20 (20 también sobre el
árbol mezclado, 1.713 leídos). **El tope y el fichero del guard no se han tocado.**

### Por qué llegó rojo al CI, y qué lo impide

Antes de empujar se corrieron el test nuevo y los guards de registro, pero **no** los guards de
suite que barren el árbol entero (`scrum643`, `scrum553`): un fichero nuevo en `src/` o en `tests/`
entra en la población de guards que no llevan su número. No hay comprobación nueva que escribir:
la que lo impide ya existe y es la que lo cazó, en el check obligatorio. Lo que faltó fue correrla
en local, y eso es un aviso, no un mecanismo.

Corrido en local sobre la mezcla, con el TAP a fichero: 12 ficheros (`scrum1470`, `scrum987`,
`scrum1093h`, los dos `scrum643`, `scrum553` y los seis tests que pasan por `presupuestoParaPdf`),
**149 pruebas, 0 caen, 0 saltos**; 15 «SCRUM-147x · » por nombre y un nombre inventado que da 0.
Los guards de registro, aparte. La tanda completa local sigue sin correrse; la comprobación de
tipos local sigue dando los 6 errores ajenos de arriba, ninguno en el fichero tocado.
