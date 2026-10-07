# SCRUM-1404 · El PDF de una factura sin sellar contesta 500: medido ejecutando las dos rutas, sin tocar nada

**Medido contra:** `origin/main` = `965e3d053f1f7d9ba24830f17abc7a54254c83f9` · 2026-10-07T17:05:20Z (hora de GitHub)

A9: comprobación → `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`

Sesión J1 (`jv-j1`, 7-oct), por encargo del orquestador de Javier: **medir y parar**. No se ha tocado
`src/`, ni un test, ni un texto. Al cerrar, `origin/main` iba por `60f1933845705618e5b82847d6090158f730a390`;
los cinco ficheros leídos abajo son idénticos en los dos (diff vacío).

## Qué se hizo

`docs/master/evidencias/SCRUM-1404/medir-1404.mjs` carga de `dist/` las dos rutas que sirven el PDF de
una factura, con la base doblada, y les pide el PDF. `ensureInvoicePdf`, el portón y el `catch` de
cada ruta son el código de producción. Salida entera: `salida-medir-1404.txt`, al lado. Tres casos por
dos rutas, seis llamadas, seis hechas.

| la factura | panel · `GET /admin/invoices/:id/pdf` | cliente final · `GET /recibo/:token/pdf` |
|---|---|---|
| ① `pendiente_de_sellado` (España, con NIF, sin huella) | **500** · `{"error":"pdf_generation_failed"}` | **500** · página «Documento no disponible», con «Este enlace no corresponde a ningún documento activo.» |
| ② control: `sellado` en la columna y sin huella | 409 · `invoice_sin_sellar` y su frase firmada | 409 · página «Factura en proceso» y su frase firmada |
| ③ control: la factura llega sin su cliente | 500 · `pdf_generation_failed` | 500 · «Documento no disponible» |

El defecto existe hoy, y son **dos rutas**, no una: el ticket nombra la del panel; la del recibo es
pública y la abre el cliente final.

## Por qué: los dos códigos nacieron distintos

- `src/lib/invoicing.ts:61-62` · si `vfEstado` es `pendiente_de_sellado`, `ensureInvoicePdf` lanza
  `new Error('invoice_pendiente_de_sellado')` (la constante `ERROR_PDF_SIN_SELLAR`). Entró el
  29-jul-2026, commit `f0a005d61` (SCRUM-205/206 parcial).
- `invoicesAdmin.routes.ts:1290` y `receipt.routes.ts:509` · el `catch` pregunta `esErrorSinSellar(err)`,
  que sólo reconoce `invoice_sin_sellar` (el código del portón, `portonDocumento.ts:117`). Entró el
  30-jul-2026, commit `58d6d136d` (SCRUM-206).

El ticket suponía que el error «cambió de forma y el `catch` se quedó con la anterior». No es eso: el
`throw` es un día anterior al `catch`, y nunca casaron. La comprobación de la línea 61 corta antes de
llegar al portón de la línea 104, así que el 409 sólo se alcanza con una fila incoherente (el caso ②).
Para una factura que de verdad espera su sellado, el 409 no se alcanza nunca.

**Los dos textos del 409 llevan en el código una marca de aprobación del 30-jul-2026 y hoy no los
ve nadie.** Están en `invoicesAdmin.routes.ts:1295` (panel) y en `portonDocumento.ts:51-52` (cliente);
no se copian aquí a propósito (ver «Mi error», abajo). ⚠️ Esa aprobación **no la he comprobado en su
origen**: lo único que la sostiene, que yo haya visto, es el comentario del propio código.

## Censo de quien llama a `ensureInvoicePdf`

Cuatro llamadas en `src/` (control con un nombre inventado: 0).

| quién | qué hace con el rechazo | ¿500? |
|---|---|---|
| `invoicesAdmin.routes.ts:1280` · panel | `catch` con el código que no casa | sí, ejecutado |
| `receipt.routes.ts:498` · recibo público | el mismo `catch` | sí, ejecutado |
| `email.service.ts:76` · correo de la factura | deja constancia del fallo y relanza | leído, no ejecutado |
| `exports.routes.ts:201` · ZIP de datos | la factura va a `fallidos` y el ZIP sigue | leído, no ejecutado |

Aparte, `POST /admin/invoices/:id/regenerate-pdf` (`invoicesAdmin.routes.ts:1210`) mira el estado él
mismo y contesta 409 con `invoice_pendiente_de_sellado`, sin frase. Son tres respuestas distintas
para la misma situación.

## Quién lo ve

- **El profesional**, en el detalle de la factura: «Descargar PDF» hace `window.open` de la ruta
  (`public/dashboard/js/invoiceDetailView.js:360`). Se le abre una pestaña con el JSON en crudo. Con
  el 409 de hoy también vería JSON en crudo: la frase firmada viaja en un campo `message` que esa
  pestaña no pinta como pantalla. Leído, no visto en navegador.
- **El cliente final**, en la página del recibo: el enlace «Descargar … en PDF» se pinta siempre que
  el cobro está pagado y hay factura (`receipt.routes.ts:184-189`), sin mirar si está sellada. Lo que
  lee es «Este enlace no corresponde a ningún documento activo», que es falso: el documento existe.
- **Ningún cron** pide estas rutas.

## Lo que la frase firmada promete y no he encontrado construido

«Se reintenta solo» y «Vuelve a intentarlo en un minuto». En `src/`, `scripts/` y `public/` sólo
siete ficheros de `src/` nombran el estado, y ninguno lo usa para buscar facturas pendientes: no hay
tarea programada que las vuelva a sellar. El único camino que vuelve a intentarlo es
`ensureInvoiceForCharge` (`invoicing.ts:240`), cuando llega otra vez el mismo cobro. Es lectura por
texto, no ejecución: puede haber un reintento que no nombre la columna.

Si es así, una factura cuyo sellado falló se queda pendiente hasta que alguien la mire, y quien vuelva
«en un minuto» encuentra lo mismo.

## Las opciones, sin elegir

| opción | qué le dice a quien lo abre | qué habría que tocar |
|---|---|---|
| 409 con las frases ya firmadas | «no está registrada todavía», al profesional y al cliente | el `catch` de las dos rutas o el código que lanza `invoicing.ts:62`; la frase sólo es verdad si existe el reintento |
| 202 | «está en marcha, vuelve»: la misma promesa de reintento | lo mismo, más una frase nueva (regla 39) |
| 404 | «no existe»: es lo que ya lee hoy el cliente, y es falso | sólo el código |
| el PDF sin el QR, con una marca | entrega algo que parece una factura sin estar registrada | la generación del PDF; es lo que SCRUM-206 cerró a propósito |
| dejarlo | un fallo previsto cuenta como avería del servidor | nada |

Todas menos la última modifican el camino de emisión o la ruta que lo sirve: regla 40, GO del fundador.
`receipt.routes.ts` es del carril de J2.

## La pregunta para el fundador y el asesor

1. Una factura con número que todavía no se ha registrado, ¿se le puede entregar al cliente en algún
   formato, o no sale nada hasta que lo esté? (SCRUM-206 decidió que no sale nada; se pregunta si
   sigue siendo así.)
2. Si no sale nada: ¿valen las dos frases del 30-jul tal cual, sabiendo que hoy nada reintenta el
   sellado por su cuenta? ¿O se construye antes el reintento, o se cambian las frases?
3. El enlace al PDF en el recibo del cliente, ¿se sigue pintando mientras la factura no está
   registrada?

## Mi error

La primera versión de este registro (punta `edf4e4d3`) copiaba las dos frases enteras al lado de la
atribución de su firma. El obligatorio cayó en `SCRUM-921c · el trinquete tampoco baja en silencio`
(«quedan 27 y el trinquete dice 28»): ese guard busca el literal de cada marca de aprobación en
`docs/`, y mi registro pasó a contar como respaldo documental de una firma que sólo repetía del
código. Separado por ejecución: el guard pasa en la base del CI (`938c73a6`) y en `origin/main`
(`6536e63e`), y cae en mi punta. Se arregla aquí, quitando la copia; el trinquete no se toca.

De paso, y es un dato: esa marca es una de las 28 que el trinquete tiene por «sin respaldo». Dónde
consta la firma del 30-jul no está escrito en ningún sitio que el guard encuentre.

## Lo que NO lleva

- Ningún arreglo y ningún test en la tanda: el script es evidencia, no un guard.
- El PDF de una factura ya sellada (el control «sigue saliendo igual»): ejecutarlo escribe en disco.
- El correo y el ZIP, ejecutados.
- Nada visto en yaqu.app ni en un navegador.
- Si en producción hay hoy alguna factura en `pendiente_de_sellado`: no se consulta producción.
