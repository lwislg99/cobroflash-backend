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
DOS MÁS, del cierre del 729 (dictadas por el fundador)

🔒 UN TEST QUE NECESITA CAMBIAR EL CÓDIGO PARA PODER MIRAR MIDE EL
   CÓDIGO CAMBIADO, NO EL TUYO.

   Los tres reconstructores de documento reciben el cliente de Prisma
   POR PARÁMETRO, así que el banco entero corre pasándoles un doble.
   Ni una firma se tocó, nada se exportó «para poder verlo», y no hay
   una sola línea de `src/` que exista sólo por el test.

🔒 UN LÍMITE QUE SE DISPARA ANTES QUE EL TUYO HACE QUE TU PROBLEMA NO
   EXISTA EN ESE TRAMO.

   El cuarto viaje de la reserva escala con las facturas del año.
   Buscar el umbral en la curva daba un número a ojo; encontrarlo en
   `MAX_REGISTROS_POR_ENVIO = 1000` —que ya rompe el XML anual antes—
   lo cierra: por debajo no hay nada que arreglar (1,95 ms sobre 5 s
   de presupuesto) y por encima éste no es el primer problema.

─────────────────────────────────────────────────────────────────────
Y POR QUÉ CUATRO VERDES NO SON UN VERDE REPETIDO CUATRO VECES

Los tres rojos se inyectaron de verdad en `src/` y cada uno tumbó
SÓLO lo suyo: el tipo cae en el build, el lector del XML tumba el
control 4 y no el 1, el lector del PDF tumba el 1 y no el 4. Eso es
lo que prueba que los cuatro controles miden cosas distintas. Sin la
discriminación, cuatro verdes pueden ser el mismo verde cuatro veces
— y nadie lo sabría hasta el día que hiciera falta.

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

─────────────────────────────────────────────────────────────────────
CÓMO MIENTE UN TEST — cuatro formas, las cuatro medidas (9-sep-2026)

✅ Este bloque llegó por SCRUM-844 y el de arriba por SCRUM-729. Se
cruzaron en un conflicto de este mismo fichero y se conservaron LOS
DOS, que era lo previsto: cuentan cosas distintas y ninguna sustituye
a la otra. La resolución no fue una decisión — fue la regla de la
casa, avisada antes de que el conflicto ocurriera.

🔒 UN TEST ESCRITO A LA LIGERA PUEDE PASAR EN VERDE HABIENDO PROBADO
   OTRA PUERTA.

   Es la más peligrosa de las cuatro, porque no deja rastro. El caso,
   entero, para que se reconozca:

   `applyVeriFactu` rechaza que le pasen un cliente de transacción
   (`verifactu_seal_inside_transaction`). Ese portón está en la línea
   283 — pero DELANTE tiene tres puertas más. Medido una a una:

       factura sin `type` ......... `unknown_invoice_type`
       sin doble de `invoice` ..... TypeError: no puede leer findUnique
       doble con `lines: []` ...... `invoice_without_lines_not_sealable`
       con `type` Y con líneas .... ✅ el portón

   O sea que un `assert.rejects(() => applyVeriFactu(inv, nif, {}))`
   SALE VERDE — la llamada sí rechaza — habiendo probado un TypeError
   a cuarenta líneas del mecanismo. Y la trampa se cierra sola: la
   ANULACIÓN sí llega al portón con el doble vacío, porque delante
   solo tiene el corte del `J-`. Copiar el caso de una función para la
   otra da un verde correcto en una y FALSO en la otra.

   El antídoto no es tener cuidado: es comprobar el MENSAJE, y probar
   el test en rojo quitando el punto exacto. Si al quitarlo no cae, no
   estaba mirando eso.

🔒 UN TEST GATEADO QUE CI NO CORRE NO ES UN TEST QUE EXISTE: ES UN
   TEST QUE EXISTIRÁ SI ALGÚN DÍA ALGUIEN PONE LA VARIABLE.

   Las dos puertas de arriba YA estaban cubiertas por `scrum173`… que
   sale **7 skipped, 0 pass** en `npm test`. Medido: 66 ficheros de
   `tests/` están gateados, 63 por `QA_DB_TEST`. Entre ellos
   `tenancy-permisos` y `webhooks-idempotencia`.

🔒 UN GUARD QUE CUENTA OCURRENCIAS DENTRO DE UN FICHERO NO VIGILA EL
   DEFECTO: VIGILA ESE FICHERO. EL TERCER SITIO NUNCA EXISTE PARA ÉL.

   SCRUM-577 contaba dos literales `customer: { … legalName … }` en
   `lib/invoicing.ts`. Había un TERCER generador de PDF de factura —el
   de admin— que llevaba desde entonces sin pasar `legalName`, y el
   guard no podía verlo porque no miraba ese fichero. La misma factura
   salía distinta según por dónde se pidiera, con el guard en verde.

🔒 UN FIXTURE CON EL MERCHANT DEMO DESACTIVA COMPROBACIONES SIN TOCAR
   NADA Y DEJA EL TEST VERDE MIDIENDO OTRA COSA.

   Mío, del mismo día: un `merchantId: 1` en un banco nuevo. El demo
   no se comporta como un merchant normal —la política de WhatsApp
   corta por su id, el PDF lleva marca de agua, la pasarela se
   desvía—, así que el caso corre por un camino que no es el que se
   creía estar probando. Lo cazó SCRUM-409.

🔒 UN GATE PUESTO AL FICHERO APAGA TAMBIÉN LAS MITADES QUE NO LO
   NECESITABAN.

   Auditados los siete tests de `scrum173`: cinco necesitan base por
   una razón que sigue en pie —miden qué devuelve la BASE, no qué
   dice el código: el orden real, el advisory lock, la historia
   persistida—. Los otros dos MEZCLAN dos cosas en el mismo test: una
   guarda de presencia que sí necesita base («con el cliente global SÍ
   sella») y un rechazo que es lógica pura. El gate está en el
   FICHERO, así que se llevó por delante la mitad pura, y esas dos
   puertas llevaban meses sin que CI las mirase.

   El gate no estaba mal puesto: nadie separó las dos mitades, y un
   gate no puede distinguirlas. Por eso, para barrer los 66 ficheros
   gateados, la pregunta que rinde NO es «¿este fichero necesita
   base?» —casi todos dirán que sí, y tendrán razón— sino «¿hay
   dentro algún assert que no la necesite?».

🔒 «LLEGAR NO ES CUBRIR» — y un gate tampoco es una razón: es la razón
   que había el día que se puso.

─────────────────────────────────────────────────────────────────────
🔒 UNA TANDA LARGA LEE EL REPOSITORIO. TOCARLO MIENTRAS CORRE LE
   CAMBIA EL SUELO BAJO LOS PIES.

Me pasó DOS VECES el mismo día, con dos caras distintas, y las dos
veces el rojo parecía un defecto y era mío:

  · SCRUM-763 compara el fuente con el árbol COMPILADO. Corrí la tanda
    de fondo mientras inyectaba rojos en `src/` y reconstruía `dist/`:
    el guard midió un árbol que ya no existía. Verde al repetir.
  · SCRUM-804 compara su censo con lo que lista `git` EN LA MISMA
    PASADA. Corrí `git fetch --prune` a media tanda para mirar un PR.
    Verde 5 de 5 al repetirlo en aislamiento, con el remoto quieto.

⚠️ Lo segundo NO lo he reproducido: es la explicación que encaja con
lo medido (aislado no falla, y yo sí toqué las refs), no un hecho
comprobado. Se dice así a propósito.

Lo que sí es firme: mientras una tanda corre, el árbol y las refs son
SUYOS. Ni `git fetch`, ni cambiar de rama, ni `npm run build`. Y si un
rojo aparece solo dentro de una tanda de fondo, la primera hipótesis
es «se lo he movido yo», no «hay un defecto».

─────────────────────────────────────────────────────────────────────
Y LO QUE HACE QUE ESTO SE VEA: que un guard sepa decir «NO PUEDO
MIRAR». SCRUM-413 se declaró CIEGO —«el censo devuelve CERO tipos»—
en vez de dar un verde vacío, y por eso se encontró. Un guard que
dice «todo bien» sin haber mirado es peor que no tenerlo: ocupa el
sitio de uno que sí miraría.
