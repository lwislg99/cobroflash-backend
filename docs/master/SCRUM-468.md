# SCRUM-468 · La pantalla de firma enseña lo mismo que el PDF que se firma

**Fecha:** 11-ago-2026 · **Carril:** H (offline) / evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `22323e14683e77ff4baa6af91703eccf21830f53` · 2026-08-11T16:26:58Z

**Paso 0:** `docs/master/SCRUM-468.md` no existía en `main` ni en ninguna rama remota (`git
ls-remote --heads origin`, listado completo), y **su ausencia no se dio por prueba**: se comprobó
la lista entera, no un filtro. Ningún worktree tenía la rama.

## 1 · Qué arregla

La página pública de firma pintaba **concepto, cantidad y unidad — y nada más**, a todos los
albaranes. Esa regla era correcta cuando solo existía `SIN_VALORAR`: **SCRUM-65 metió el modo
`VALORADO` —precio unitario, importe por línea, `Base` y `Total`— en el PDF y no tocó la pantalla**.

Desde entonces, para un albarán valorado, el cliente **firmaba una pantalla sin importes y quedaba
vinculado a un papel con Base y Total**. Una prueba de conformidad sobre lo que el firmante no vio
no prueba nada.

**No es un hallazgo nuevo: es el que SCRUM-466 §2 midió y aparcó** con todas las letras — *«el
firmante ve un albarán sin importes y recibe un PDF con ellos. Reportado, no arreglado: es otro
carril»*. Este carril.

## 2 · Por dónde se arregla, y por qué no por el otro

El PDF firmado entra en el **hash del sobre v:2** y queda sellado: **no se regenera ni se reescribe**
(regla 29). De los dos lados que discrepaban, el que puede moverse es **la pantalla**. Así que el
PDF, `generateAlbaranPdf` y su único llamador (`albaran.service.ts:777`) quedan **intactos**.

Y el cambio es **aditivo**: `SIN_VALORAR` sale byte a byte como salía.

## 3 · Lo que ahora ve el firmante de un VALORADO

Lo mismo que su PDF: **`PRECIO UD.`**, **`IMPORTE`** por línea, **`Base`** y **`Total`**, con la
leyenda *«Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente.»*

**Cero microcopy nueva** (regla 30): los dos rótulos y la leyenda se copian **literales** del PDF, y
el test lo comprueba derivándolos de su fuente — si allí cambian, aquí sale rojo.

**Y sigue sin ser una factura** (regla 24): **sin desglose de cuota de IVA**, sin serie fiscal y sin
QR. Enseñar precios no lo convierte en documento fiscal — el propio PDF los lleva desde SCRUM-65.

## 4 · Tres divergencias que solo aparecieron al comparar campo por campo

El primer intento «funcionaba» y estaba mal en tres sitios. Ninguno se ve leyendo:

| # | Lo que hacía la pantalla | Lo que hace el PDF |
| --- | --- | --- |
| 1 | leía `l.precio` — **campo que no existe** | lee `l.precioUnitario` |
| 2 | `Intl.NumberFormat(style:'currency')` → `35,40 €` con **U+00A0** | `toLocaleString` + `' €'` con espacio normal |
| 3 | pintaba **`0,00 €`** en una línea sin precio | deja las dos celdas **vacías** |

El #1 habría puesto **0,00 € en todas las líneas**. El #2 son dos cadenas distintas que se ven
idénticas en pantalla. El #3 **afirma que una línea no cuesta nada**, que es peor que callarlo.

> Los tres los cazó el mismo mecanismo: comparar **ejecutando**, no leyendo.

## 5 · El guard: se ejecutan las dos representaciones, no se leen

`tests/scrum468-firma-ve-lo-que-firma.test.mjs` — sin gate, sin BD, sin red.

Del fuente del PDF se **derivan por AST** y se **ejecutan** (`new Function` sobre el trozo derivado):
su formateador de dinero, su aritmética del importe por línea, sus dos rótulos y su leyenda. La
pantalla se **renderiza de verdad** (`renderLineasAlbaran` desde `dist/`) y se enfrentan **celda a
celda**. Base y Total salen de ejecutar la **plantilla del propio PDF** con los totales de
`calcAlbaranTotales`, que es la única aritmética de los dos lados.

Por eso el marcado se ha sacado a **`src/modules/jobs/app/routes/albaranPublicVista.ts`**: dentro
del handler harían falta Express, Prisma y un token, y el guard habría acabado **mirando el fuente**
— que es exactamente como se coló el defecto original.

### Los seis rojos, vistos fallar

Control positivo previo: árbol limpio, **3.066 tests, 0 fallos**.

| Se rompe… | El guard dice… |
| --- | --- |
| se quitan las celdas de importe | *«EL PRECIO UNITARIO DE «Mano de obra» NO COINCIDE CON EL PDF. PDF: «35,40 €» · pantalla: «(no hay celda)»»* |
| se formatea con `Intl` currency | *«PDF: «35,40 €» · pantalla: «35,40 €»»* — **idénticos a la vista, distintos byte a byte** |
| desaparecen Base/Total/leyenda | *«LA PANTALLA NO DICE «Base: 3792,00 €», Y EL PDF SÍ»* |
| se desglosa la cuota de IVA | *«LA PANTALLA ESTÁ ENSEÑANDO LA CUOTA DE IVA (796,33 €)… eso es una factura»* |
| cambia el `SIN_VALORAR` | *«HA CAMBIADO LA PANTALLA DEL SIN_VALORAR… tiene que salir byte a byte»* |
| el test deja de ver el PDF | *«ESCÁNER CIEGO: no se ha derivado `fmtMoney` del PDF»* (3 fallos) |

**El suelo por los dos lados:** si no se deriva el PDF, falla declarándose ciego; y si la fixture no
tuviera precios, falla también — comparar dos pantallas vacías no prueba nada.

## 6 · Censo en producción (10-ago-2026)

| | emitidos | firmados |
| --- | --- | --- |
| **VALORADO** | 1 | **0** |
| SIN_VALORAR | — | 4 |

**El único valorado vivo todavía no está firmado**: el arreglo llega antes que su firma. Los 4
firmados son `SIN_VALORAR` y **no se rozan** — es el control positivo del guard.

## 7 · Dos guards ajenos enmendados (y uno que NO se ha tocado)

`tests/scrum463-…` y `tests/scrum466-…` fijaban *«la pública no enseña importes»*. Eran ciertos y
**hoy dejan de serlo por decisión, no por medida**. Se han **actualizado, no borrado** —que es lo
que el propio assert de SCRUM-463 pedía por escrito— y cada uno lleva su enmienda fechada al lado.

🔴 **Lo que NO se mueve: el pad de obra** (`public/dashboard/js/signaturePad.js`) y lo que su
llamador le pasa. Esa es **la** decisión de SCRUM-466 —*quien firma en obra no es necesariamente
quien acordó el precio*— y sus dos guards siguen intactos y en verde. Ver §9.

> Y el bucle de ausencias se cazó a sí mismo al nacer: pedía que no apareciera «serie» y casó **el
> comentario de la vista que dice «sin serie fiscal y sin QR»**. Ahora mira `leerFuente` (solo
> código). Es la trampa de `_guard-texto.mjs`, otra vez.

## 8 · Lo que NO se ha tocado

`generateAlbaranPdf` y su llamador · el hash del sobre v:2 y el sellado · `prisma/schema.prisma` ·
la microcopy (`ALBARAN_ROTULOS`) · el pad de obra · ningún albarán de producción. El CSS añadido
solo casa con marcado que el `SIN_VALORAR` no genera (`.num`, `.totales`) y **no introduce ni un
color nuevo**: los tres ya estaban en ese mismo fichero.

## 9 · La divergencia entre canales es DELIBERADA y está declarada

Se planteó como pregunta abierta y **el fundador la resolvió el 11-ago-2026**: los dos canales
enseñan cosas distintas **a propósito**, y no se unifican.

| Canal | ¿Importes? | Por qué |
| --- | --- | --- |
| **Remoto** (móvil del cliente, enlace con token) | **sí** | quien abre ese enlace **es el cliente** —le llegó a su WhatsApp— y no puede firmar viendo menos de lo que se sella: su PDF lleva Base y Total |
| **Pad de obra** (móvil del profesional) | **no** | allí firma **quien esté delante** —el portero, la pareja, el encargado— y enseñarle precios es **revelar condiciones comerciales a un tercero**. Lo que se firma en obra acredita la **ENTREGA**, no el precio |

**Fijada en un test, no en un comentario suelto:** `SCRUM-468 · LOS DOS CANALES ENSEÑAN COSAS
DISTINTAS, Y ES DELIBERADO` cae por **los dos lados**, y el rojo trae el motivo dentro:

| Se «unifica»… | El guard dice… |
| --- | --- |
| pasándole importes al pad de obra | *«SE LE ESTÁ PASANDO «totales» AL PAD DE OBRA… enseñarle precios REVELA CONDICIONES COMERCIALES A UN TERCERO… es una decisión del fundador, no un olvido»* |
| quitándoselos al remoto | *«FALTA LA COLUMNA «PRECIO UD.» EN LA PANTALLA»* (+1) |

El mismo motivo queda escrito **donde se decide** —el llamador del pad, `albaranDetailView.js`—
porque es ahí donde alguien lo leerá antes de «arreglarlo».

Y lo que sí es medida, no decisión: hoy `modoValoracion === 'VALORADO'` significa exactamente *«el
papel que se lleva el cliente lleva importes»*.

## 10 · Tests que corren

- `tests/scrum468-firma-ve-lo-que-firma.test.mjs` — 6 tests (suelo, campo por campo, control
  positivo `SIN_VALORAR`, control negativo regla 24, aritmética compartida)
- `tests/scrum463-firmante-ve-el-contenido.test.mjs` — enmendado
- `tests/scrum466-el-firmante-ve-el-albaran.test.mjs` — enmendado (solo el bloque de la pública)

Suite completa: **3.067 tests, 0 fallos**. `npm run guards:entrada`, `npm run guard:prisma` en verde.
