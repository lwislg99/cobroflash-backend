# El aviso del estado que no reconocemos

**Aprobado por el fundador** el 8-sep-2026, en **SCRUM-707**.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

| Texto aprobado | Dónde se pinta |
|---|---|
| No reconocemos el estado de este documento — no podemos ofrecerte acciones aquí. | `public/dashboard/js/invoiceDetailView.js` y `public/dashboard/js/albaranDetailView.js`, en la barra de acciones del detalle |

Raya larga `—` de un solo carácter, **con punto final**, sin corchete de marcador.

## Cuándo sale, y cuándo NO

Sale **sólo** cuando el estado del documento **no está en la tabla de acciones** de su registro
(`estadoReconocido`, derivado de las propias acciones).

⚠️ **No sale por «cero botones».** Una factura `annulled` ofrece dos acciones y podría ofrecer cero
mañana sin que eso signifique que no la entendemos. Si el aviso se disparara por lista vacía,
saldría en documentos correctos y en dos días nadie lo leería.

## Qué había antes: un TypeError

No sustituye a ningún texto. Antes de esto, un estado no contemplado hacía que `destinoEfectivo`
devolviera `undefined` y que `cubos[undefined].push(...)` lanzara
`TypeError: Cannot read properties of undefined (reading 'push')` — en las **dos** pantallas y sin
red de seguridad alrededor. No había mensaje porque no había pantalla.

## Por qué estas palabras

* **«No reconocemos»** — en primera persona del plural: el fallo es nuestro, no del profesional.
  No dice «estado inválido», que sonaría a que él ha hecho algo mal.
* **«no podemos ofrecerte acciones aquí»** — contesta la pregunta que se hace ante una barra de
  botones vacía. Sin esa mitad, el aviso diría que pasa algo y no por qué faltan los botones.
* **No promete arreglo ni pide nada**, porque desde esa pantalla no hay nada que él pueda hacer.

## Por qué el aviso y no un botón por defecto

Medido en SCRUM-707: caer a un cubo por defecto **ofrecería** acciones que están ocultas en TODOS
los estados conocidos — `btnAnular` y `btnBizum` en la factura, `btnFacturar` y
`btnConvertirFactura` en el albarán, y con ellas `btnEmitir`, `btnEnviarFirmar` y `btnFirmarAqui`.

> 🔒 Un fallback no es neutral: abre, en el estado que nadie ha vetado, justo las acciones que
> alguien decidió ocultar en todos los que sí vetó. Anular una factura emitida es la regla 29;
> firmar un albarán lo congela.

## Verificación

`tests/scrum707-estado-no-contemplado.test.mjs`: el aviso aparece con un estado no reconocido y
**no** aparece en uno reconocido que sí admite acciones, comprobado sobre el resultado y no sobre
el fuente.
