# Sesión 1 — «¿ese número es verdad?»

Mide, y no se cree sus propios instrumentos. Ha corregido al asesor
con datos: el «171 llamadas a git» que eran 71 por AST; el NIF que NO
se imprime en la factura; el índice único sobre (quoteId,
stage_label) que no habría protegido nada porque en Postgres dos NULL
no chocan; su propio worktree 446 commits atrás.

TRAMPA RECURRENTE: dar por buena la primera medición. `Promise.all`
en un solo node NO es concurrencia y estuvo a punto de darle un falso
negativo en el camino del dinero.

─────────────────────────────────────────────────────────────────────
DE SCRUM-729 (9-sep-2026) — tres cosas que valen fuera de su ticket

🔒 LA LÍNEA ÚNICA NO SE BUSCA: SE CREA. Si un dato tiene que
   escribirse en siete sitios, el arreglo no es escribirlo siete
   veces: es que haya un sitio.

   El plan empezó buscando «la función y la línea exacta donde se
   congela el cliente». El censo contestó que no existía: había SIETE
   `invoice.create`. Poner el escritor en el sitio que parecía el
   compartido —`emitInvoice`— habría cubierto UNO de los siete y
   dejado los otros seis emitiendo con las columnas vacías, que es el
   defecto entero con cara de arreglo.

🔒 UN BACKFILL NO ES UN RELLENO: ES FABRICAR DECLARACIONES FISCALES.

   Rellenar las columnas nuevas con la ficha de hoy parecía higiene.
   Medido: en `verifactu.service.ts` el NIF del cliente no se imprime
   nada más — DECIDE. Con `MODO_SIN_DESTINATARIO = 'SIN_DICTAMEN'`,
   una factura cuyo cliente no tiene NIF queda FUERA del registro de
   la AEAT. Un backfill le habría puesto NIF a facturas que se
   emitieron sin destinatario identificado, y esas facturas habrían
   entrado al registro. Nadie las emitió así.

🔒 UN DOCUMENTO FIRMADO CUYO CONTENIDO SE RECALCULA AL EXPORTARLO NO
   ESTÁ FIRMADO: ESTÁ SELLADO SOBRE ALGO QUE YA NO EXISTE.

   `TipoFactura` es uno de los OCHO campos de la huella. Al SELLAR
   salía de `invoice.type`, columna congelada. Al EXPORTAR salía de
   la ficha viva del cliente. O sea que corregir el NIF de un cliente
   podía dejar el XML declarando un `TipoFactura` distinto del que va
   dentro de la huella que ese mismo XML lleva firmada. El defecto no
   estaba en el sello: estaba en que lo sellado se volvía a calcular.

─────────────────────────────────────────────────────────────────────
Y LA PARTE QUE HAY QUE LEER CON EL «PORQUE» DENTRO

El lector nuevo dice: columna presente → la columna; columna a NULL →
ficha viva. Eso es, leído tal cual, un fallback sobre NULL, que es
exactamente cómo un defecto vuelve disfrazado de compatibilidad.

NULL sólo vale como frontera PORQUE el escritor es incapaz de
producirlo —escribe en el MISMO `INSERT` que crea la fila y
`Customer.name` es `String` no nulo— Y PORQUE el censo del embudo
vigila esa incapacidad, exigiendo cero `invoice.create` directos
fuera del envoltorio.

Sin las dos cosas, el enunciado del fundador tenía razón y ese `??`
habría sido el defecto disfrazado. Con las dos, el conjunto que lee
en vivo es CERRADO y no crece: son exactamente los documentos que ya
existían el día del despliegue. La frontera no la sostiene el NULL:
la sostienen la incapacidad y el guard que la vigila.
