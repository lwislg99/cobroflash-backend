// tests/_cambios-autorizados-de-la-factura.mjs — SCRUM-1446d
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍA DE CAMBIO AUTORIZADO DEL PDF DE LA FACTURA
//
// `scrum603b` (el cuerpo de `generateInvoicePdf`) y `scrum723` (su ámbito alcanzable) comparan
// el código que genera la factura con el PUNTO DE PARTIDA de la rama. Hasta el 23-oct-2026 eso
// los hacía PROHIBIR cualquier cambio, también uno autorizado: en CI la base es la punta de
// `main`, así que un PR que toca esa función salía rojo por construcción (medido en SCRUM-1446,
// c.18895 y c.18901). El fundador decidió abrir una vía (SCRUM-1446 c.20473, «Sí, abrir la vía»).
//
// 🔴 LA VÍA NO ES UNA EXCEPCIÓN POR NOMBRE NI POR FICHERO: es UN PAR DE HUELLAS. Un cambio pasa
// sólo si la huella del texto en la BASE y la del texto en el DISCO son, las dos, las que se
// declararon aquí junto a su firma. Lo que no casa con un par declarado sigue cayendo igual que
// antes:
//   · un cambio sin declarar → cae (lo de siempre);
//   · el cambio autorizado MÁS cualquier otro byte → cambia la huella del disco → cae;
//   · el mismo cambio sobre otra base (main tocó la factura entretanto) → cambia la huella de
//     la base → cae, y hay que volver a pedirlo.
// Y una vez el cambio está en `main`, base y disco coinciden y la declaración ya no interviene:
// se queda como historia legible de quién autorizó qué.
//
// LA FIRMA SE LOCALIZA: cada entrada nombra el comentario de Jira (`SCRUM-N c.M`) y su registro,
// que es el del mismo ticket en docs/master y tiene que contener ese número de comentario Y la
// cita literal.
// Lo comprueba `tests/scrum1446d-via-de-cambio-autorizado.test.mjs`.
//
// ⚠️ Lo que este fichero NO puede comprobar: que el comentario de Jira exista y diga lo que la
// cita dice. Jira no se lee desde la tanda; eso lo mira quien revisa el PR.
// ═════════════════════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';

/** La huella de un trozo de código. Sin `\r`: el blob de git y el disco de Windows no difieren. */
export function huella(texto) {
  return crypto.createHash('sha256').update(String(texto).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/**
 * Cada cambio autorizado del código de la factura. `cuerpo` es lo que compara `scrum603b`;
 * `ambito`, lo que compara `scrum723`. `de` es la huella en la base y `a` la del disco.
 * Se genera EJECUTANDO `docs/master/evidencias/SCRUM-1446d/huellas.mjs`, nunca a mano.
 */
export const CAMBIOS_AUTORIZADOS = [
  {
    // El rótulo del tipo deja de redondearse a entero: un 7,5 % se imprimía «8%».
    firma: 'SCRUM-1446 c.20473',
    registro: 'docs/master/SCRUM-1446.md',
    cita: '«Sí, abrir la vía»',
    cuerpo: {
      de: '50ad8aa09d1c6195d237aed071a09b76179d381ec9eeedd84fd03135aaa5c984',
      a: '48cc44fa273e62c744d7eeae63b5205f830f4dda77b30925787da38a5af7e05a',
    },
    ambito: {
      de: '44c1fa96abbb71b898e89b6db1de90d94a4d5a8d423456e694f51b65ce4dbe2a',
      a: '7e8ce68f697dccf494c35fd831adccace46de06909171b01e2072e3699c57de8',
    },
  },
  {
    // SCRUM-1470c · la «Fecha:» de la factura imprime el día natural de su registro (zona del negocio).
    firma: 'SCRUM-1470 c.20530',
    registro: 'docs/master/SCRUM-1470.md',
    cita: '«Sí, el mismo día»',
    cuerpo: {
      de: '48cc44fa273e62c744d7eeae63b5205f830f4dda77b30925787da38a5af7e05a',
      a: 'fdaddbd5bb32a099baa5eaa0acddba18685f76b437f4bc4b8e4838e2b7718acc',
    },
    ambito: {
      de: '7e8ce68f697dccf494c35fd831adccace46de06909171b01e2072e3699c57de8',
      a: '7109a19821c60f7e303d855def8a08e45ed0f02e8ee36fb2dd5cad6e5df4ff83',
    },
  },
  {
    // SCRUM-624e · el bloque de totales de la F1 imprime el desglose del registro y su total
    // guardado; la R1 y el justificante, como hasta hoy.
    firma: 'SCRUM-624 c.20817',
    registro: 'docs/master/SCRUM-624.md',
    cita: '«A solo en facturas normales»',
    cuerpo: {
      de: 'fdaddbd5bb32a099baa5eaa0acddba18685f76b437f4bc4b8e4838e2b7718acc',
      a: '4505331c59025f2a96599024980d6a2c366d6bdac8f65c52eeaf80fd85588741',
    },
    ambito: {
      de: '7109a19821c60f7e303d855def8a08e45ed0f02e8ee36fb2dd5cad6e5df4ff83',
      a: '11a1c6198c347365b671acadfd82e00feca86f13b03a92ba59666758034ea631',
    },
  },
  {
    // SCRUM-1446e · en la F1 la columna de cada línea va sin IVA y su cabecera dice «IMPORTE»;
    // la R1 y el justificante, como hasta hoy.
    firma: 'SCRUM-1446 c.20917',
    registro: 'docs/master/SCRUM-1446.md',
    cita: '«IMPORTE»',
    cuerpo: {
      de: '4505331c59025f2a96599024980d6a2c366d6bdac8f65c52eeaf80fd85588741',
      a: 'ad5b56695af75a66367ee34e747fe7b090496403a1277dad71a1b8c1e0a680c4',
    },
    ambito: {
      de: '11a1c6198c347365b671acadfd82e00feca86f13b03a92ba59666758034ea631',
      a: '9e1d7085237bb4c4b814d685eeca3672d611b2d016dba4ee549015b8d0c847bc',
    },
  },
  {
    // SCRUM-1446g · en una F1 por tramos, el céntimo que falta para que la columna sin IVA sume la
    // base va a la línea de mayor resto; sin tramos, la columna como hasta hoy.
    firma: 'SCRUM-1446 c.20945',
    registro: 'docs/master/SCRUM-1446.md',
    cita: '«B, mayor resto»',
    cuerpo: {
      de: 'ad5b56695af75a66367ee34e747fe7b090496403a1277dad71a1b8c1e0a680c4',
      a: '4666fceba0c0fea949ae93c963dc1dc4bf639d4059f8cbed48cca7d60d3cf8b7',
    },
    ambito: {
      de: '9e1d7085237bb4c4b814d685eeca3672d611b2d016dba4ee549015b8d0c847bc',
      // SCRUM-1446g (2.º) · la `causa` del grupo, al tipo de `VatLine` (el build no compilaba), y
      // el comentario «de tramo» corregido por SCRUM-1446 c.20964 (1446h): mismo código, mismo papel.
      a: '1737745f493343caf708b01d64fe95d74bbfb5fdeae62918bd4f144ac405c25e',
    },
  },
  {
    // SCRUM-1051g · una F1 con líneas S2 imprime P1 («Inversión del sujeto pasivo») en su propia
    // fila, con la base de las S2, y esas líneas salen de la fila de su tipo. Sin S2, el papel no cambia.
    firma: 'SCRUM-1051 c.21750',
    registro: 'docs/master/SCRUM-1051.md',
    cita: '«el PDF imprime P1 y separa la fila S2 del desglose de IVA»',
    cuerpo: {
      de: '4666fceba0c0fea949ae93c963dc1dc4bf639d4059f8cbed48cca7d60d3cf8b7',
      a: 'b4ee934e80da6a987ea3e7f125967a2e98179a5f90830342e9dcb6d988995146',
    },
    ambito: {
      de: '1737745f493343caf708b01d64fe95d74bbfb5fdeae62918bd4f144ac405c25e',
      a: '01fc1c03e13e38bed7621e399573e4fdfe85d5b76bfa953ba2643b70e7a4b5a6',
    },
  },
  {
    // SCRUM-1240d · una factura con el criterio de caja CONGELADO a true y al menos un tramo S1
    // imprime la mención firmada en su propia línea, entre los totales y el bloque VERI*FACTU.
    // Con NULL o false, o sin S1, o en un justificante, el papel no cambia.
    firma: 'SCRUM-1240 c.21776',
    registro: 'docs/master/SCRUM-1240.md',
    cita: '«Régimen especial del criterio de caja»',
    cuerpo: {
      de: 'b4ee934e80da6a987ea3e7f125967a2e98179a5f90830342e9dcb6d988995146',
      a: '3967c7ef8e699f0e46167c4c04dbb6b11daa51745b78a23317416aa7d6bd96b1',
    },
    ambito: {
      de: '01fc1c03e13e38bed7621e399573e4fdfe85d5b76bfa953ba2643b70e7a4b5a6',
      a: '508c20188d476ab2bc19c82f37180201f2692fd881563ba73b2e185d132af3c0',
    },
  },
  {
    // SCRUM-624y · el arreglo A también en la R1: su bloque de totales imprime el desglose de
    // `calcVatBreakdown` y su total guardado, como la F1 (revoca c.20817 para la R1). El
    // justificante, como hasta hoy. Huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre
    // origin/main 0c787556f6eaf44531b76bbe0b59b076ef744386.
    firma: 'SCRUM-624 c.22137',
    registro: 'docs/master/SCRUM-624.md',
    cita: '«A en la R1»',
    cuerpo: {
      de: '3967c7ef8e699f0e46167c4c04dbb6b11daa51745b78a23317416aa7d6bd96b1',
      a: '7cbda25fd230c4f65873e4549c1a93ba0f98ee3b212cad922a0abcf12b7855e5',
    },
    ambito: {
      de: '508c20188d476ab2bc19c82f37180201f2692fd881563ba73b2e185d132af3c0',
      a: '775ce32827dad87ee48cfa9c3c98593570866587ade6e267ea62bf5539f41a2d',
    },
  },
  {
    // SCRUM-1771c · el rótulo de la columna de bases del desglose (≥ 2 tipos) deja de ser el
    // marcador `[PENDIENTE microcopy oficial]` y pasa al literal firmado. Solo cambia la constante
    // de `pdf.service.ts:54`, que está en el ámbito y no en el cuerpo: por eso no hay par `cuerpo`.
    firma: 'SCRUM-1771 c.22164',
    registro: 'docs/master/SCRUM-1771.md',
    cita: '«Base imponible por tipo»',
    ambito: {
      de: '775ce32827dad87ee48cfa9c3c98593570866587ade6e267ea62bf5539f41a2d',
      a: 'deb02178fdb8d0346d7127db2f89c6e663a41c9725f7ec1b063c3060f51343a8',
    },
  },
  {
    // SCRUM-1779d · una factura que la emisión dejó sin sello (`SIF_ENABLED` en OFF) no dibuja QR:
    // `qrData` vacío → sin imagen. SCRUM-1779 c.22239 por SCRUM-1585 c.21290 (decisión de
    // autorizar: SCRUM-1779 c.22253). Huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre
    // origin/main fea1c00078654d8d617af055de94f2b627df07ce.
    firma: 'SCRUM-1779 c.22239',
    registro: 'docs/master/SCRUM-1779.md',
    cita: '«no linkado a verifactu»',
    cuerpo: {
      de: '7cbda25fd230c4f65873e4549c1a93ba0f98ee3b212cad922a0abcf12b7855e5',
      a: '4daa145e0323e604a3c1a6e591204303466c4546e4b0dee47329a233ba0378d6',
    },
    ambito: {
      de: 'deb02178fdb8d0346d7127db2f89c6e663a41c9725f7ec1b063c3060f51343a8',
      a: '300a3fb3f0a1af3481188846a89e457e8cf4d4b75f71bfcbd9b0e5a1c7ca4b23',
    },
  },
  {
    // SCRUM-1788a · la tabla de conceptos empieza debajo del bloque más alto (emisor o cliente):
    // un emisor de 5+ líneas ya no se pinta encima de la cabecera. Sin texto nuevo ni datos nuevos.
    // Huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre origin/main
    // 53cde1aa49e8b8235b6b562f9a81bb6d175ac571.
    firma: 'SCRUM-1788 c.22299',
    registro: 'docs/master/SCRUM-1788.md',
    cita: '«Sí go»',
    cuerpo: {
      de: '4daa145e0323e604a3c1a6e591204303466c4546e4b0dee47329a233ba0378d6',
      a: '44d7d101465e2f0909db25950bf4fc1dae8d729d6e31222924a72aeec310824f',
    },
    ambito: {
      de: '300a3fb3f0a1af3481188846a89e457e8cf4d4b75f71bfcbd9b0e5a1c7ca4b23',
      a: '0c1839e4d2df8ded0228160e90fdfd46eb9549daba2055fe29016bf5e5b13a08',
    },
  },
  {
    // SCRUM-1787d · el PDF de factura imprime «NIF:» y «Dirección:» del cliente, leídos de las
    // columnas congeladas de la factura (nunca de la ficha viva). GO c.22303 ①; ALTER aplicado
    // c.22311. La rama lleva 1788a (PR #3301) sin mergear: este par vale con la base en main
    // SIN 1788a (origin/main c10a80edd301ed2a320f758f33fcd5814991c850). Huellas de
    // `evidencias/SCRUM-1446d/huellas.mjs`.
    firma: 'SCRUM-1787 c.22303',
    registro: 'docs/master/SCRUM-1787.md',
    cita: '«1-Sí GO · 2-Ok sí · 3-Firmo · 4-Sí»',
    cuerpo: {
      de: '4daa145e0323e604a3c1a6e591204303466c4546e4b0dee47329a233ba0378d6',
      a: '60177ce0b87bb2564937abcb0dd56959186d36056e8714302a0629516558942b',
    },
    ambito: {
      de: '300a3fb3f0a1af3481188846a89e457e8cf4d4b75f71bfcbd9b0e5a1c7ca4b23',
      a: '837928ef82df7eadff7e17edb8887e39b358d0c8da6a3d847547632ae9f1d030',
    },
  },
  {
    // SCRUM-1787d · el MISMO cambio, si 1788a (PR #3301) entra antes en main: la base es entonces
    // el `a` de 1788a (calculado sobre su punta e8b19bd74636e82bd6fa0c556aab5ffb79689ccb con
    // `huella` y `ambitoDeLaFactura`; coincide con lo que declaró 1788a). Mismo disco.
    firma: 'SCRUM-1787 c.22303',
    registro: 'docs/master/SCRUM-1787.md',
    cita: '«1-Sí GO · 2-Ok sí · 3-Firmo · 4-Sí»',
    cuerpo: {
      de: '44d7d101465e2f0909db25950bf4fc1dae8d729d6e31222924a72aeec310824f',
      a: '60177ce0b87bb2564937abcb0dd56959186d36056e8714302a0629516558942b',
    },
    ambito: {
      de: '0c1839e4d2df8ded0228160e90fdfd46eb9549daba2055fe29016bf5e5b13a08',
      a: '837928ef82df7eadff7e17edb8887e39b358d0c8da6a3d847547632ae9f1d030',
    },
  },
  {
    // SCRUM-1787l · el PDF de factura pinta las Observaciones (`docFooterText`, congelado al
    // emitir) con el rótulo firmado `TITULO_OBSERVACIONES`, sólo si hay texto. Decisión c.22345 ②;
    // ALTER aplicado c.22346. Base origin/main ccb69008b5aaa80d3f7cb712be77ce025c146238. Huellas de
    // `evidencias/SCRUM-1446d/huellas.mjs`.
    firma: 'SCRUM-1787 c.22345',
    registro: 'docs/master/SCRUM-1787.md',
    cita: '«1-Sí 2-Solo pie 3-GO 4-No 5-Sí»',
    cuerpo: {
      de: '60177ce0b87bb2564937abcb0dd56959186d36056e8714302a0629516558942b',
      a: '1a4bd416a2c0231ed8b7fa4b64c6f21f6c1bf91a3c73ca4075af714d1cc3656e',
    },
    ambito: {
      de: '837928ef82df7eadff7e17edb8887e39b358d0c8da6a3d847547632ae9f1d030',
      a: '9eecc6a9d13680f109b6f384d03b42a0f98bfc98c5b296a47a73e494e5517432',
    },
  },
  {
    // SCRUM-1787m · el PDF de factura imprime «Vence el <fecha>» y «Formas de pago: …» con el
    // vencimiento y las formas de pago CONGELADOS en la factura (`dueDate` y `payMethods`, de
    // SCRUM-1787i), sólo si constan: una factura sin ellos sale igual. GO de regla 40 en c.22338 ③.
    // Huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre origin/main
    // d5bec9526fe9165e38598f6eb054d0717e788740 (el `de` es el `a` de 1787l).
    firma: 'SCRUM-1787 c.22338',
    registro: 'docs/master/SCRUM-1787.md',
    cita: '«1-Sí 2-Sí 3-GO»',
    cuerpo: {
      de: '1a4bd416a2c0231ed8b7fa4b64c6f21f6c1bf91a3c73ca4075af714d1cc3656e',
      a: 'a83c6654bb5840ddd838a5d571c21c3f08f5f9dca2033f2876368c35c9f34d7a',
    },
    ambito: {
      de: '9eecc6a9d13680f109b6f384d03b42a0f98bfc98c5b296a47a73e494e5517432',
      a: '0fbb6f5bf50aa18f400151930edf508f199df754f619062d4eee6fee94fdf739',
    },
  },
  {
    // SCRUM-1787t · SOLO la línea «Vence el» del PDF de factura pasa a la fecha LARGA es-ES (zona del
    // negocio), con las opciones de la página de pago (1787q); la «Fecha:» no cambia. Decisión
    // c.22390 ③; GO de regla 40 en c.22408. Huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre
    // origin/main 57cc6d45bca6debe92bd55d6a55e7232c21985d4 (el `de` es el `a` de 1787m).
    firma: 'SCRUM-1787 c.22408',
    registro: 'docs/master/SCRUM-1787.md',
    cita: 'Respuesta literal: «go»',
    cuerpo: {
      de: 'a83c6654bb5840ddd838a5d571c21c3f08f5f9dca2033f2876368c35c9f34d7a',
      a: '2b62a73e67001b850f2005f950480cf0a9e7a603d83e4325bd7acbb7cc9346ce',
    },
    ambito: {
      de: '0fbb6f5bf50aa18f400151930edf508f199df754f619062d4eee6fee94fdf739',
      a: 'a8bd2fb9e99037e52b07fcbdf3133bfcc4adf32100d4b50b8ea4796e2e8b3857',
    },
  },
  {
    // SCRUM-1787x · la misma línea «Vence el» de 1787t (dentro del GO c.22408): SOLO el día pasa de
    // `2-digit` a `numeric` («5 de diciembre de 2026»). Decisión del fundador c.22431. Huellas de
    // `evidencias/SCRUM-1446d/huellas.mjs` sobre origin/main 4aeac0f6c1f5a63b97b009a1c1b3ebc93c973e3e
    // (el `de` es el `a` de 1787t).
    firma: 'SCRUM-1787 c.22431',
    registro: 'docs/master/SCRUM-1787.md',
    cita: 'Respuesta literal: «4-Sí ok quita el 0»',
    cuerpo: {
      de: '2b62a73e67001b850f2005f950480cf0a9e7a603d83e4325bd7acbb7cc9346ce',
      a: '3cc5a0bd8afcc8d7b9a69bff74fd60059271779970c09cc76b72bbdb204b2f24',
    },
    ambito: {
      de: 'a8bd2fb9e99037e52b07fcbdf3133bfcc4adf32100d4b50b8ea4796e2e8b3857',
      a: '7685e52da0bab2674ea7211a022a592b929598f1974b4528108aba98389c7676',
    },
  },
  {
    // SCRUM-1787w · el PDF de factura pasa al dibujo del presupuesto (una columna emisor/cliente,
    // rótulos y cabecera de tabla del presupuesto, sin banda), con los literales firmados en
    // c.22428. GO de regla 40 en c.22416. Huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre
    // origin/main 42cae61092ba69761d6d7bba0504abe6baee1e52 (el `de` es el `a` de 1787x).
    firma: 'SCRUM-1787 c.22416',
    registro: 'docs/master/SCRUM-1787.md',
    cita: '«1-GO»',
    cuerpo: {
      de: '3cc5a0bd8afcc8d7b9a69bff74fd60059271779970c09cc76b72bbdb204b2f24',
      a: '8b726e56e936e44643995e02a292a06be7cfa45521ad23e5e804df89b509ae5a',
    },
    ambito: {
      de: '7685e52da0bab2674ea7211a022a592b929598f1974b4528108aba98389c7676',
      a: 'f979edbc86098b8aca725929c889f13c6ed9dfa0af7fcc8dffdd4114b17754fc',
    },
  },
];

/**
 * La entrada que autoriza pasar de `enBase` a `enDisco` en el trozo `clave` ('cuerpo' o
 * 'ambito'), o `null` si ninguna lo autoriza.
 */
export function cambioAutorizado(clave, enBase, enDisco, lista = CAMBIOS_AUTORIZADOS) {
  const de = huella(enBase);
  const a = huella(enDisco);
  return lista.find((c) => c[clave] && c[clave].de === de && c[clave].a === a) ?? null;
}
