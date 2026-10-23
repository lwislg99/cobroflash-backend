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

## SCRUM-1470b · La firma del presupuesto no pisa «Firmado digitalmente por…» (J1, jv-j1ap, 23-oct-2026)

**Medido contra:** `origin/main` = `391212830da7698fed4bccf1da95f668292710ee` · 2026-10-23T13:46:55Z (hora de GitHub)

A9: comprobación → `tests/scrum1470b-la-firma-no-pisa-el-texto.test.mjs`

Lo midió S1 en su gemelo del albarán (SCRUM-1589, PR #2731) y nos pasó el número en el comentario
20507 de este ticket. Aquí, en `generateQuotePdf` (`pdf.service.ts`), el mismo `moveDown(5)` tras
`fit: [180, 70]`. Es el PDF del PRESUPUESTO: `generateInvoicePdf` no se ha tocado.

- **El rojo, ejecutado antes de tocar `src/`** (PDF real por `paramsDePresupuestoParaPdf` +
  `generateQuotePdf`, pdfkit envuelto desde fuera en el proceso hijo): 3 de 3 rojos con
  **12,2 pt de solape**, no 10,5. La diferencia es medida, no un error de S1: aquí el cursor baja
  a 10 pt Helvetica normal (5 × 11,56 = 57,8 pt) y en el albarán a Helvetica-Bold (59,5 pt).
- **Arreglo:** el mismo número que S1, para que no haya dos soluciones: el cursor va a
  `arriba + 70 + 4`. La línea de `doc.image` queda idéntica. Ningún texto cambia (regla 39).
- **Salto de página:** la reserva de este bloque es `doc.y + 120`, no 130. Con el arreglo el
  bloque mide **105,2 pt** (raya → fin de la línea de debajo): cabe, con 14,8 pt de margen. El test
  lee la reserva del fuente y lo comprueba de dos formas: el bloque medido cabe en ella, y un
  barrido de 91 papeles (13 tamaños de tabla × 7 de observaciones) que cruza el borde por los dos
  lados y se le acerca a ≤ 6 pt (lo mide y lo exige) nunca lo parte.
- **Mutaciones sobre `dist/`** (nunca reescribiendo `src/`), base verde 5/5 antes:
  M1 `moveDown(5)` de vuelta → caen 3 (los de solape); M2 hueco de 30 pt → caen 5;
  M3 reserva 120 → 90 → cae el barrido («con 19 líneas y 6 de observaciones … texto p.2»).
  Control del barrido sembrado: sin observaciones se queda a 14,8 pt del borde y dice CIEGO.
- **Error mío, cazado antes de empujar:** el primer barrido iba de 18 en 18 pt (sólo filas de
  tabla) y M2 salió viva para él, porque su ventana de fallo era de 11 pt y la saltaba. Y su
  control de población (`pagina > 0`) era una tautología: las páginas empiezan en 1. Lo que lo
  impide ahora es el propio test: exige cruzar el borde y acercarse a ≤ 6 pt, o dice CIEGO.
- **No tocado:** la aceptación 2 (`dateStr`, la fecha del PDF de la FACTURA) sigue esperando al
  fundador. No visto en yaqu.app: pendiente de despliegue, y hará falta un presupuesto firmado
  nuevo, porque el PDF de uno ya firmado puede servirse del disco (no lo he comprobado en el
  presupuesto; S1 lo midió en el albarán).

## SCRUM-1470c · El PDF de la FACTURA imprime el día de su registro fiscal (J1, jv-j1aq, 23-oct-2026)

**Medido contra:** `origin/main` = `01edf6213c16417989a4fbf50e9d28b9f707e881` · 2026-10-23T14:26:12Z (hora de GitHub)

A9: comprobación → `tests/scrum1470c-la-factura-imprime-el-dia-de-su-registro.test.mjs`

**La decisión (aceptación 2).** Jira SCRUM-1470 c.20530: el orquestador de Javier transcribe la
pregunta («¿das permiso (toca el PDF de factura) para que imprima el MISMO día que su registro
fiscal, calculado con la zona del negocio como ya hace la numeración?») y la respuesta del fundador:
«Sí, el mismo día». Es el GO de regla 40 con este alcance: `dateStr` del PDF de FACTURA usa el día
natural del registro, sin tocar sellado, XML ni libros; sin zona declarada no cambia nada.

**El rojo, ejecutado antes de tocar `src/`** (`tests/_sonda-fecha-de-la-factura.mjs`, proceso en
UTC, PDF generado de verdad y leído; el registro, con `formatDateES(createdAt, zonaDelMerchant(m))`,
que es la función que escribe la `FechaExpedicionFactura`): factura del 3-oct a las 00:30 de Madrid
→ PDF `02/10/2026`, registro `03/10/2026`. Mediodía y negocio sin zona: los dos iguales. Después del
arreglo: `03/10/2026` en los dos, y los otros dos casos sin moverse.

**Qué se ha cambiado.**
- `pdf.service.ts`, `generateInvoicePdf`: `dateStr` pinta `diaNaturalEn(d, zonaDelMerchant({ timezone: params.zona }))`
  en vez de `getDate()/getMonth()/getFullYear()`. Entra el parámetro `zona` (crudo, como en
  `generateQuotePdf`), **obligatorio**: un llamador que no lo pase no compila (comprobado con `tsc`
  sobre una llamada sembrada fuera del árbol, que da TS2345; la misma con `zona: null` compila).
- Los tres llamadores de `src/` pasan `merchant.timezone`: `src/lib/invoicing.ts` (los dos
  generadores) e `invoicesAdmin.routes.ts` (regenerar PDF). Los tres ya cargaban la fila entera del
  merchant: no hay consulta nueva. Es el único cambio fuera del cuerpo del PDF y no toca sellado,
  huella, XML ni libros.
- `tests/_cambios-autorizados-de-la-factura.mjs`: la entrada de este cambio (firma SCRUM-1470 c.20530),
  con las cuatro huellas copiadas de `docs/master/evidencias/SCRUM-1446d/huellas.mjs` sobre la base
  `9a9518c2e42f50a3d95d884f076ed58e647750e6`. Sin ella, `scrum603b` y `scrum723` caían (medido).
- Censo (`scripts/_censo-fecha-sin-zona.mjs`): `pdf.service.ts::dateStr` sale de `USO` y entra en
  `RETIRADAS`; el test de SCRUM-1470 pasa de 6 a 3 llamadas que imprimen en sus cinco ficheros.

**Mutaciones sobre `dist/`** (restaurado byte a byte después): M1 ignora la zona → caen 2 casos ·
M2 Madrid fijo → cae «sin zona» · M3 vuelve `getDate` → caen 2.

**Aceptación 3.** De las filas de J1 en la clase IMPRIME quedan 2, con su motivo en `USO`: el sello
«(hora del servidor)» de `generateQuotePdf` y `fD` del paquete de disputa (su gemelo es ese sello, y
el literal necesita firma, regla 39). Salen las 3 de `dateStr`.

**Aceptación 4 · el gemelo del portal: DECLARADO, no hecho.** `customerPortal.routes.ts::fechaDeLaFactura`
es del carril J2 y no lo he escrito. Sigue en SCRUM-1471 (J2, En curso; aviso en su c.20542), con su
motivo en `USO`. MEDIDO por la ruta real, no leído: el portal de `origin/main` ya pinta con la zona
del negocio la fecha del presupuesto y el «Pagada» (`dateShort`, desde #2220), pero la fecha de la
FACTURA sale de `fechaDeLaFactura`, sin zona. La sonda de SCRUM-1470 pide el portal por su ruta con el
proceso en UTC, y en mi tanda pasó el caso «SCRUM-1471 · DECLARADO»: a las 00:30 de verano, invierno
y Canarias el portal dice la víspera de la factura, y el PDF (este tramo) el día de su registro.
**Falta esa fila: el gemelo NO está hecho.** Es la contradicción que la regla del ticket quiere evitar,
y se dice aquí para que no se pierda. Hoy sólo la puede ver un negocio con `timezone` puesta (los 13 del relleno de SCRUM-643, todos
de prueba, según su registro; no lo he contado en ninguna base).

**De paso:** el caso «DECLARADO» de SCRUM-1471 en `tests/scrum1470-…` decía que el portal seguía el
reloj del proceso «como la del PDF de la factura»; ya no es cierto, y su texto lo dice. Y la línea
nueva del primer llamador movió la puerta `exigirDocumentoEmitible` de `src/lib/invoicing.ts:261` a
`:262`: `scrum525d` lo cazó en la dirigida y `docs/legal/AUDITORIA_CAMINO_EMISION.md` apunta ya a `:262`.

**Dirigida** (`npm run tanda:dirigida`, base `01edf621`): 466 ficheros · 4.432 tests · 4.411 pass ·
5 fail. Uno era mío (525d, arriba, ya verde: 8/8). Los otros cuatro (`scrum1298b` ×2, `scrum351`,
`scrum476`) miden la topología de `node_modules` y los hooks del árbol principal; este worktree no
tiene `node_modules` propio, y ninguno de los tres ficheros nombra nada de lo que toca esta rama
(grep, con control positivo sobre la sonda). NO los he corrido sobre la base: «son del entorno» es
lectura, no medición. Los 16 que faltan para sumar 4.432 no los imprime la herramienta: no los he contado.

**Error mío, cazado antes de correrlo:** escribí el suelo exigiendo tres desplazamientos distintos
para verano, invierno y Canarias; Canarias en julio va a +60, igual que Madrid en enero. Ahora el
suelo compara la lista entera `[120, 60, 60]`.

**No medido:** yaqu.app (falta el despliegue; si una factura ya emitida sirve su PDF del disco o lo
regenera, no lo he comprobado),
ninguna base de datos, y la tanda completa (sólo los guards de suite que tocan lo cambiado).
