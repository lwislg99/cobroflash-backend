# SCRUM-1258 · Una factura sellada no se declara con un tipo distinto del que entró en su huella

**Medido contra:** `origin/main` = `9599d40ab442ff573ac08a227ee82a39351dba95` · 2026-10-01T02:46:04Z
A9: aviso → cicatriz J1 «Propuse al orquestador una vía de prueba nombrando una función que no había leído (`buildRegistroAlta` no emite el marcador de la simplificada), y él autorizó sobre esa frase» — no se pudo comprobar: ningún test puede obligar a leer una función antes de nombrarla en un mensaje; lo cazó ir a escribir el test.
**Rama:** `scrum-1258-el-tipo-del-registro-es-el-de-la-huella`. **Sesión:** J1c (relevo de J1b).

## Las autorizaciones, y cómo me llegaron

Ninguna me la dio el fundador a mí. Las dos están en Jira, escritas por el orquestador del equipo de
Javier, que es quien se las pidió y transcribió su respuesta. Yo las leí allí.

- **GO para tocar el camino de emisión:** SCRUM-1258, comentario 17705 («1-Ok, Go»). Autoriza que el
  tipo del registro y el tipo sobre el que se calculó la huella no puedan discrepar. No autoriza
  tocar la huella de nada sellado, ni decidir qué facturas son simplificadas, ni encender flags, ni
  cambiar el esquema.
- **El texto que ve el usuario:** SCRUM-1258, comentario 17713 («2-Ok la tuya más corta»). Ficha en
  `docs/microcopy/2026-10-01-SCRUM-1258-tipo-distinto-del-sellado.md`.
- **Reescribir el caso «salida B» de SCRUM-215:** la autorizó el orquestador, no el fundador, en ese
  mismo comentario 17713 y, tras mi corrección, por mensaje (vía A, con dos condiciones; abajo).

## En corto

- **El defecto existe, corrido y no leído.** Una F1 sellada, sin NIF del cliente, exportada bajo el
  modo `SIMPLIFICADA_F2`, salía declarada como F2 con la huella que se calculó sobre F1: recalculada
  con los campos del propio XML, la huella no coincide con la que el XML lleva.
- **Han salido cero registros así, y no por mirar una base: por construcción.** La constante del
  modo vale `'SIN_DICTAMEN'` desde su único commit (`1e0d8914`, 29-jul-2026) y ningún llamador de
  producción pasa el modo.
- **Los latentes no los sé.** Cuántas facturas selladas como F1 y sin NIF hay —las que saldrían F2
  el día que alguien cambie la constante— sólo se cuenta en una base, y ninguna sesión toca
  producción.
- **El arreglo no escribe nada.** `construirRegistro` deja de emitir ese registro y lo excluye con
  motivo. La cadena persistida es byte a byte la misma antes y después, medido.
- **Efecto que hay que saber:** la rama F2 de `construirRegistro` queda **inalcanzable** para toda
  factura sellada. Detalle abajo.

## ① El defecto, corrido

`TipoFactura` es uno de los ocho campos de `computeVeriFactuHash`. Al sellar sale de la columna
(`applyVeriFactu` → `exigirTipoDeclarable(invoice.type)`). Al exportar, para una factura sin NIF del
cliente, lo decidía `resolverSinDestinatario`, que bajo `SIMPLIFICADA_F2` devuelve `F2`.

Sonda de sólo lectura contra `dist/` (4 casos; sella con la función real, exporta por
`buildVerifactuRegistrosXml` y recalcula la huella con los campos que el XML declara):

| caso | sale | recalculada == la que lleva |
|---|---|---|
| F1 con NIF, modo por defecto | F1 | sí |
| F1 sin NIF, modo por defecto (el de hoy) | excluida | — |
| F1 sin NIF, `ART_61D` | F1 | sí |
| F1 sin NIF, `SIMPLIFICADA_F2` | **F2** | **no** |

## ② Cuántos hoy

Dos números distintos.

**Registros que hayan salido con la discrepancia: 0.** La discrepancia no se guarda: se calculaba al
exportar. `git log -S` sobre `origin/main` da un único commit para la constante y nunca cambió de
valor. Los llamadores de producción son tres (`exports.routes.ts`, la ruta suelta y el paquete, y
`encolarRemision` → `registroParaRemision`, que pasa `opts: {}`), y ninguno pasa el modo; que nadie
lo pase lo vigila por AST `tests/scrum215-costura-de-test.test.mjs`, en verde en este árbol. La cola
de remisión guarda texto, pero sólo entra por ese mismo camino.

**Documentos latentes: sin medir.** Sólo se cuentan en una base. No se ha consultado ninguna.

## ③ El arreglo

`src/modules/invoicing/domain/verifactu.service.ts`, en `construirRegistro`: si la factura tiene
huella y el tipo que se va a declarar no es el de la columna, el registro no se emite.

- F1 sellada que se declararía F2 → `TipoDistintoDelSelladoError`, que es un
  `RegistroNoEmitibleError`: la exportación la excluye con su motivo y la cola deja constancia y no
  encola. El motivo es el texto firmado.
- Cualquier otra pareja de tipos no existe hoy y no tiene texto firmado: lanza un error con código,
  que detiene la exportación entera, como una cadena rota.

La constante y la clase van al final de `registro.builder.ts` para no mover líneas que otros
documentos citan por posición. `applyVeriFactu` no se toca.

Descartado: sellar como F2 (toca el sellado, y F2 es un tipo nuevo) y quitar la rama F2 (eso sí
sería elegir política).

## ④ El rojo primero

`tests/scrum1258-el-tipo-del-registro-es-el-de-la-huella.test.mjs`. Sella cuatro facturas por
`applyVeriFactu` (F1 y R1, con y sin NIF), exporta en cada modo —los modos se leen del fuente por
AST— y recalcula cada huella desde el XML.

Antes del arreglo, sobre el commit `b9391267a6b26e39d09defa2ce440fa2041d7573`: 7 tests, 6 pass,
1 fail. El que cae es el que decide, con este mensaje: «[SIMPLIFICADA_F2] 2026-CF-002: sellada como
F1, el registro declara F2 · lleva la huella sellada: true · recalculada desde el XML == la que
lleva: false» (población: 3 modos · 9 declarados · 3 excluidos). Después del arreglo: 8 de 8 (se
añadió el caso del texto firmado).

Dos mutaciones declaradas en el test, corridas a mano con `build` entre una y otra:

| mutación | numstat | tests que caen |
|---|---|---|
| quitar la comprobación (`if (false)`) | 1/1 | el que decide, el del texto firmado y el caso nuevo de SCRUM-215 |
| sellar con `'F2'` en vez del tipo de la columna | 1/1 | el del sellado, y tres más |

Deshechas con la edición inversa; `git status --porcelain` vacío después.

## ⑤ El control que no se puede saltar: la cadena, byte a byte

Banco `docs/master/evidencias/scrum1258/banco-huellas.mjs`, comiteado antes de tocar el código: un
ejercicio fijo de 5 facturas selladas en cadena (sellos puestos a mano, no `new Date()`), exportado
sin modo y en cada uno de los 3 modos. Su cliente de mentira lanza ante cualquier escritura. Salida
de antes en `docs/master/evidencias/scrum1258/antes.txt`; la de después, en `despues.txt`.

- sha256 de la cadena persistida: `2d070c12f928659ce4287d0a017f96f41bc40d7e5a61a29c157e5f50cf55bce8`
  en los 4 casos, antes y después.
- sha256 del XML: idéntico en 3 de 4 (sin modo, `SIN_DICTAMEN`, `ART_61D`).
- Cambia sólo `SIMPLIFICADA_F2`: de 4 declarados (`F1,F2,R1,F1`) a 3 (`F1,R1,F1`), con `2026-CF-002`
  excluida. `diff` de los dos ficheros: una línea.

Y dentro del test, de forma permanente: exportar no escribe en ningún modo, y cada huella persistida
es la de sus campos con el tipo de la columna.

## ⑥ El caso «salida B» de SCRUM-215

`tests/scrum215-sin-destinatario.test.mjs` tenía un caso que exportaba una F1 **sellada** bajo
`SIMPLIFICADA_F2` y exigía que saliera F2 y validara contra el XSD. Ese caso afirmaba el defecto.

Ahora son dos:

1. por el constructor real, esa factura queda fuera del registro, con el motivo firmado;
2. el XSD acepta una F2 con su marcador y sin `Destinatarios`, sobre un registro que **compone el
   test**: `buildRegistroAlta` con una huella calculada sobre F2, más el marcador que devuelve el
   `resolverSinDestinatario` real, insertado detrás de `DescripcionOperacion`. Lleva un control: el
   mismo marcador detrás de `Desglose` no valida.

**Lo que se ha dejado de probar:** que `construirRegistro` coloque ese marcador en su sitio para
una F2. No puede probarse: el constructor real ya no emite una F2 para ninguna factura sellada, y
sin sellar no hay huella que validar. Está escrito en el propio test, encima de los dos casos.

## ⑦ Código inalcanzable, declarado

Con este arreglo, la rama F2 de `construirRegistro` —el `marcadorXml` de la simplificada y el
`tipoFactura: 'F2'` que llegan de `resolverSinDestinatario`— es **inalcanzable** para cualquier
factura sellada: toda factura sellada lo está con el tipo de su columna, que no puede ser F2.

No se ha quitado, porque quitarla es decidir que la simplificada no será la salida, y esa decisión
es del dictamen (SCRUM-1264). Lo que cambia es el precio: SCRUM-215 prometía que aplicar el dictamen
sería cambiar una constante. Si el dictamen elige la simplificada, no bastará: habrá que sellar como
F2, con su tipo y su serie, y ese código habrá que revisarlo entonces.

## Lo medido en este árbol

Tras `git merge origin/main` (9599d40a; sólo añadía `docs/master/SCRUM-1253.md`), con
`prisma generate` y `build` en 0. Las cifras de las tandas, en el comentario de entrega de Jira y en
el PR: se miden después de escribir este fichero.

## Lo que NO hace

- No cuenta los documentos latentes.
- No decide qué facturas son simplificadas, ni activa F2, ni le da serie.
- No toca flags ni esquema.
- No comprueba el techo de 3.000 € de una simplificada: sigue sin comprobarlo nadie, como ya decía
  el caso de la constante en SCRUM-215.

## Mis errores

1. **Propuse una vía sin leer la función que nombraba.** Le dije al orquestador que la demostración
   XSD de la F2 podía ir por `buildRegistroAlta`. Ese constructor no emite el marcador de la
   simplificada. Él autorizó la reescritura apoyándose en mi frase («prueba más, no menos»). Lo vi
   al ir a escribir el test, paré y se lo dije; la vía que se hizo es otra y declara lo que pierde.
2. **Un `git checkout --` para deshacer una edición.** Lo paró `guard-dangerous`. Mi ficha de
   encargo lo avisaba para `git restore`; no lo apliqué al comando hermano. Deshecho con la edición
   inversa.
3. **La primera colocación del arreglo movía líneas.** Puse la constante y la clase en mitad de
   `registro.builder.ts`, que varios catálogos citan por línea. Lo corregí antes de compilar: van al
   final del fichero.
