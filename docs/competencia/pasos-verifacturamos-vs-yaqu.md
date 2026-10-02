# De presupuesto a cobro, contado en PASOS: Verifacturamos · YaQu · la diferencia (SCRUM-1437)

> **2-oct-2026 16:35 GMT (hora de GitHub) · Sesión 0 (consultoría).**
> **Verifacturamos: VISTO POR DENTRO** el 2-oct-2026 con la cuenta de prueba autorizada (plan «Prueba», sin
> firma electrónica), capturas `docs/competencia/capturas/verifacturamos/pasos-NN-*.png`.
> **YaQu: CÓDIGO, NO PANTALLA** — leído en `origin/main` = `f30b1a4052957e245ebe1cfef53bbef410c5816b`. La cuenta
> de QA volvió a estar viva a las 16:37Z, pero de yaqu.app solo se pudo abrir el inicio (§6): ninguna cifra
> de la columna «nosotros» está vista en pantalla.
> Todo texto de pantalla ajeno citado aquí es dato de mercado, no propuesta (regla 39). Lo fiscal es dato, no
> propuesta. Este documento no recomienda qué copiar.

## 1 · El método (escrito antes de las cifras; el mismo para los dos lados)

- **Punto de partida:** sesión abierta, en la pantalla de inicio (su «Panel», nuestro inicio). Los tramos
  encadenados (enviar, convertir, cobrar) empiezan **donde te deja el tramo anterior**.
- **CLIC** = cada pulsación sobre un control: botón, enlace, entrada del menú lateral, abrir un desplegable (1)
  y elegir una opción (otro 1), un resultado de un buscador, confirmar un diálogo. Enfocar un campo para
  teclear **no** cuenta. Un atajo de teclado no se usa para rebajar la cifra de nadie.
- **CAMPO** = cada campo en el que hay que teclear o elegir algo para que el documento exista. Lo que viene
  relleno por defecto no cuenta. Teclear en un buscador de clientes cuenta como un campo.
- **PANTALLA** = cada vista, modal u hoja distinta que se pisa después del punto de partida, incluida la de
  aterrizaje. Un menú desplegable no es pantalla. Un asistente de varios pasos en una página es UNA pantalla
  (y se dice cuántos pasos tiene).
- **Camino mínimo:** lo menos que la aplicación deja hacer. Cliente con solo lo obligatorio; presupuesto de
  UNA línea (descripción + precio).
- **Lo no pulsado se nombra.** En Verifacturamos no se ha pulsado «Emitir factura», «Enviar al cliente» ni
  «WhatsApp»: sus tramos acaban en el botón y la cifra lleva «≥».

## 2 · El dato de pasos

| Tramo | Verifacturamos (visto) | YaQu (código, no pantalla) | Quién gana en pasos |
|---|---|---|---|
| Alta de cliente | 3 clics · 1 campo · 2 pantallas | 3 clics · 1 campo · 2 pantallas | Empate |
| Presupuesto, cliente que ya existe (sin enviar) | 3 clics · 3 campos · 2 pantallas | Editor: **6 clics** · 2 campos · 3 pantallas (asistente de 4 pasos) | **Ellos, por 3 clics** |
| Presupuesto SIN cliente | 2 clics · 2 campos · 2 pantallas | No hay camino: el cliente es obligatorio | **Ellos** |
| Presupuesto + envío al cliente | ≥ 5 clics (3 + «Enviar» + elegir canal; lo que venga detrás no se pulsó) | Rápido: **3 clics** · 3 campos · 2 pantallas, y sale ya enviado. Editor: 7 clics | **Nosotros, por ≥ 2 clics** (rápido); ellos por ≥ 2 si se usa el editor |
| De presupuesto a factura | 2 clics · 0 campos · 0 preguntas · no pide aceptación. Deja un **borrador** | Si el cliente firma: **0 clics**. A mano: 3 clics. Deja una factura **emitida**. **En España, hoy (flag en OFF): no hay camino** | Con firma, nosotros. A mano, ellos por 1. **Hoy en España, ellos** |
| Emitir | No medido (no pulsado). Mínimo deducido: ≥ 3 clics + 1 campo (el NIF), y la firma electrónica una vez | 0: va dentro del tramo anterior | Nosotros (deducido, no medido) |
| Cobrar | **No existe**: ni enlace de pago, ni medio de cobro, ni control visto para marcar pagada | Enlace de pago enviado solo al firmar (0 clics); marcar pagada: 2 clics | Nosotros: ellos no tienen el tramo |

**En qué nos ganan en pasos, de mayor a menor:**

1. **Nuestro editor completo cuesta el doble que el suyo: 6 clics contra 3.** Los tres de diferencia son los
   tres «Continuar» del asistente (Cliente → Conceptos → Condiciones → Revisar) más llegar a él: desde nuestro
   inicio no hay entrada directa al editor (menú «Presupuestos» + «Nuevo presupuesto»), y desde su Panel
   «Crear presupuesto» es un botón.
2. **Ellos dejan hacer un presupuesto sin cliente** (2 clics, 2 campos). Nosotros no.
3. **Convertir a factura a mano: 2 clics suyos contra 3 nuestros**, y ellos no piden que el presupuesto esté
   aceptado. Nosotros sí.
4. **Hoy, en España, el tramo de factura y el de cobro no existen en YaQu** (flag en OFF, regla 24). Ellos
   llegan hasta el borrador con cuenta gratuita.

**En qué ganamos nosotros:** crear y enviar es un solo botón (3 clics contra ≥ 5); el cliente firma y la
factura y la petición de pago salen solas; y cobrar existe.

## 3 · Ellos · nosotros · la diferencia, en lo que nota el profesional

| | Ellos (Verifacturamos) | Nosotros (YaQu) | La diferencia que nota |
|---|---|---|---|
| Empezar un presupuesto | Tres botones en el Panel: factura, presupuesto, albarán. Uno abre el formulario | Un botón «en 30 segundos» abre el rápido. El editor completo está dos clics más adentro | Para el caso corto empatamos. Para un presupuesto de verdad (varias líneas, condiciones), ellos llegan antes |
| El formulario | Una página, todo a la vista, un botón al final | Rápido: un modal. Editor: cuatro pasos, uno abierto cada vez | Ellos no hacen pasar por pantallas intermedias; nosotros pedimos tres «Continuar», uno de ellos (Condiciones) sin tocar nada |
| El cliente | Opcional. Buscador, o nombre/NIF/correo tecleados a mano | Obligatorio. En el rápido, teclear un nombre que no existe lo da de alta | Con ellos se puede dar precio sin saber aún para quién. Con nosotros el alta va dentro y sin salir |
| Lo mínimo que hay que teclear | Descripción y precio | Cliente, concepto y precio (y teléfono si se va a enviar por WhatsApp) | Uno o dos campos más, a cambio de que el presupuesto pueda llegar al cliente |
| Qué queda al terminar | Un borrador en la lista | Rápido: presupuesto **ya enviado**. Editor: borrador + ventana con el PDF | Con ellos crear y enviar son dos actos; con el rápido, uno |
| Enviar | Por fila y en el detalle: «Enviar» (despliega) y «WhatsApp». En una factura, «Enviar» ofrece: a mi correo, al cliente por correo, por WhatsApp. WhatsApp está en sus planes de 19 € y 29 €, no en el de 9 € | WhatsApp con un botón para ver y firmar; correo; PDF | Ellos tienen «enviármelo a mí», que nosotros no tenemos en lo leído. Nosotros mandamos algo que se firma |
| Que el cliente acepte | No vi firma ni estado «aceptado»: los estados vistos son Borrador y Convertido | Enlace para ver y firmar; o el profesional lo marca aceptado (2 clics) | Con ellos el «sí» del cliente ocurre fuera de la aplicación |
| Pasar a factura | «Convertir en factura»: 1 clic en el detalle, sin preguntas, sin esperar aceptación. Crea un borrador que se puede corregir | Solo con el presupuesto aceptado. Con firma, sola. A mano: «Aceptar» → «Confirmar» → «Generar factura». Sale emitida, sin borrador | Ellos dejan facturar un trabajo hecho «de palabra» en dos clics y repasar antes de emitir. Nosotros no dejamos repasar: lo que se genera ya está emitido |
| El NIF del cliente | Presupuesto: no lo pide. La factura ordinaria lo marca obligatorio, y la conversión la deja con el NIF vacío | Opcional en el alta. En el camino presupuesto → factura no encontré comprobación (⛔ dato, fiscal: no es propuesta) | Con ellos el NIF aparece tarde, al ir a emitir. Con nosotros, en lo leído, no aparece |
| Emitir | Bloqueado sin firma electrónica: «solo borradores y presupuestos». No pulsado | Dentro de «generar». En España real hoy, apagado | Ninguno de los dos emite hoy con una cuenta recién abierta en España, por motivos distintos |
| Cobrar | Nada visto: ni enlace de pago, ni pasarela (Integraciones: tiendas en línea, Drive y API), ni «marcar pagada» en una factura emitida de ejemplo. El filtro de facturas sí tiene los estados «Pagada» y «Vencida» | Enlace de pago por WhatsApp; «Marcar como pagada/cobrada» en 2 clics; Bizum manual según bandera | Ellos facturan; cobrar es cosa del profesional. Es el tramo donde no compiten |
| Después de la factura | Menú: duplicar, guardar como plantilla, repetir, rectificativa, anular. Casilla «Factura recurrente» | No medido en esta pasada | Sin comparar |

## 4 · Verifacturamos, tramo a tramo (visto)

| Tramo | Camino | Captura | Cifra |
|---|---|---|---|
| Alta de cliente | «Clientes» → «Nuevo cliente» → nombre → «Crear cliente». Vuelve a la lista con aviso. Solo el nombre es obligatorio; NIF, correo, teléfono y dirección, no | `pasos-09`, `pasos-10`, `pasos-13` | 3 clics · 1 campo · 2 pantallas |
| Presupuesto con cliente | «Crear presupuesto» → teclear en el buscador → clic en el resultado (rellena «Nombre del destinatario») → descripción → precio → «Crear presupuesto». Vuelve a la lista con aviso. Por defecto: fecha de hoy, 30 días, IVA 21 %, cantidad 1 | `pasos-02`, `pasos-15`, `pasos-16`, `pasos-17` | 3 clics · 3 campos · 2 pantallas |
| Presupuesto sin cliente | Lo mismo sin tocar el cliente. En vacío solo reclama la descripción | `pasos-03`, `pasos-04`, `pasos-05` | 2 clics · 2 campos · 2 pantallas |
| Enviar | Desde la lista, por fila: Modificar · Descargar · WhatsApp · Enviar. En el detalle: Enviar al cliente · WhatsApp · Duplicar · Convertir en factura. **Ninguno pulsado en un presupuesto.** En la factura de ejemplo que trae la cuenta, «Enviar» despliega tres opciones (a mi correo · al cliente, con su correo · por WhatsApp); ninguna elegida | `pasos-06`, `pasos-18`, `pasos-23` | ≥ 2 clics; lo que hay detrás, NO VISTO |
| Convertir en factura | Clic en el número (el detalle es el propio editor) → «Convertir en factura». Sin diálogo. Abre el detalle de una factura ordinaria en borrador, con el nombre del cliente, el NIF vacío y vencimiento a 30 días. El presupuesto pasa a «Convertido» y pierde «Modificar» y «Enviar» | `pasos-18`, `pasos-19`, `pasos-08` | 2 clics · 0 campos · 2 pantallas |
| Emitir | El borrador ofrece Emitir factura · Modificar · PDF · menú (PDF, duplicar, plantilla, repetir, eliminar). «Modificar» abre el formulario de factura de seis secciones con Nombre y NIF obligatorios. **«Emitir» no pulsado**; la firma electrónica, no explorada | `pasos-11`, `pasos-20` | No medido |
| Cobrar | Factura emitida de ejemplo: PDF · Enviar · menú (PDF, duplicar, plantilla, repetir, rectificativa, anular). Integraciones: Shopify, WooCommerce, PrestaShop, Wix, Google Drive, API. Planes: ninguno nombra cobros | `pasos-22`, `pasos-24`, `pasos-12`, `pasos-26` | No existe en lo visto |

Fallo suyo visto dos veces: al convertir, el aviso dice «Factura null creada».

## 5 · YaQu, tramo a tramo (CÓDIGO, NO PANTALLA)

| Tramo | Camino | Evidencia | Cifra |
|---|---|---|---|
| Alta de cliente | «Añadir cliente» (lleva a la lista) → «Nuevo cliente» (modal) → nombre → «Guardar». Solo el nombre es obligatorio | `public/dashboard/js/customersView.js` (`required` del nombre; «NIF/CIF (opcional)») · `src/core/validation/schemas.ts` (`customerCreateSchema`) | 3 clics · 1 campo · 2 pantallas |
| Presupuesto rápido + envío, cliente existente | Botón ⚡ del inicio (modal) → teclear nombre → clic en la coincidencia → concepto → precio → «Enviar por WhatsApp». Crea, envía y abre la ficha | `public/dashboard/js/homeView.js` (`btn-quick-quote`, `qq-send`, llamada a `send-whatsapp`) | 3 clics · 3 campos · 2 pantallas |
| Presupuesto rápido + envío, cliente nuevo | Igual, pero el nombre sin coincidencias da de alta al cliente; hace falta su teléfono para enviar | `homeView.js` (alta dentro del envío) · `src/modules/quotes/domain/sendQuote.service.ts` (`customer_missing_phone`) | 2 clics · 4 campos · 2 pantallas |
| Presupuesto por el editor, sin enviar | «Presupuestos» → «Nuevo presupuesto» → elegir cliente → «Continuar» → concepto y precio → «Continuar» → «Continuar» (condiciones, sin tocar) → «Generar presupuesto». Abre una ventana con el PDF; queda en borrador | `public/dashboard/js/quotesView.js` (los cuatro pasos y sus `puede`) · `quotesListView.js` | 6 clics · 2 campos · 3 pantallas |
| Enviar tras el editor | «Enviar por WhatsApp» en esa ventana, sin confirmación | `quotesView.js` | 1 clic |
| De presupuesto a factura | Exige presupuesto aceptado. Con firma del cliente, el servidor emite solo. A mano, en la ficha: «Aceptar presupuesto» → «Confirmar aceptación» → «Generar factura (100%)». Sin borrador intermedio. **Con el flag en OFF y merchant español real, los botones no se pintan y el servidor responde 409** | `public/dashboard/js/quotesDetailView.js` · `src/modules/system/app/routes/quotesAdmin.routes.ts` (`quote_not_accepted`, `facturacion_no_disponible`) · `src/modules/quotes/app/routes/quotes.routes.ts` | 0 clics con firma · 3 a mano · sin camino con OFF |
| Cobrar | Con «100% al aceptar», la petición de pago sale por WhatsApp al firmar. «Marcar como pagada» en la ficha del presupuesto: botón + confirmación | `quotesDetailView.js` · `public/dashboard/js/invoiceDetailView.js` | 0 clics / 2 clics |

**Sin determinar leyendo, y que la pantalla tiene que contestar:**

- Si el cliente buscado sale entre los cuatro botones del paso 1 del editor (depende de los datos): si no sale,
  el editor suma un campo.
- El presupuesto rápido manda cada línea con el impuesto a cero (`homeView.js`, `tax: 0`). Qué IVA enseña el
  documento que recibe el cliente: no lo sé. Ellos ponen 21 % por defecto.
- Qué medios de pago ofrece la página que abre el enlace de cobro.
- Si los avisos de NIF y de duplicado del alta de cliente frenan el guardado.
- El estado real de la bandera de Bizum manual.

## 6 · Lo que no se pudo ver

| Qué | Por qué |
|---|---|
| YaQu en pantalla, salvo el inicio | El fundador renovó la cuenta de QA el 2-oct-2026 a las 16:37Z. Con ella se abrió **solo el inicio** de yaqu.app (lectura, con toda petición que no fuera de lectura cortada): confirma los tres botones de «Acciones rápidas» (presupuesto «en 30 segundos», añadir cliente, pendientes de cobro) y que no hay entrada directa al editor completo. El siguiente paso —abrir el presupuesto rápido y teclear en él, sin enviar— lo **denegó el clasificador de permisos** de la sesión por tocar producción. No se ha rodeado: lo autoriza el fundador o lo recorre él |
| Lo que hay detrás de «Enviar» y de «WhatsApp» en Verifacturamos | No se pulsa: enviar es enviar |
| «Emitir factura» y la firma electrónica de Verifacturamos | No se pulsa; emitir remite a la AEAT |
| Si Verifacturamos tiene un control para marcar una factura pagada | No apareció en una factura emitida sin enviar; puede aparecer en otro estado |
| Sus albaranes, productos, plantillas y facturas recurrentes | Fuera de este tramo |

## 7 · Los otros tres, con el mismo método — DE NOTAS Y CAPTURAS, NO DE PANTALLA DE HOY

Fuente: `docs/producto/_RAW-flujo-crear-factura.md` (Contasimple, 22-sep-2026; Billin y ServiceM8,
25-sep-2026), `docs/competencia/matriz.md` y `docs/competencia/con-que-venden-sin-cobro-21sep-j5.md`
(21-sep-2026). Nadie ha vuelto a entrar hoy.

**Lo que ese material permite y lo que no.** Las notas de Contasimple y de Billin recorren **crear una
factura suelta**; su presupuesto, su conversión y su cobro **no se abrieron por dentro**. Las notas describen
campos, no pulsaciones: toda cifra de esta tabla es **deducida** de la descripción, no contada en pantalla, y
por eso lleva «≈». Donde el material no llega, la casilla lo dice. Cada dato lleva su origen: **(dentro)** =
visto con cuenta de prueba en su fecha; **(web)** = solo su página comercial.

| Competidor | Presupuesto | Convertir a factura | Enviar | Cobrar |
|---|---|---|---|---|
| **Verifacturamos** (dentro, 2-oct) | 3 clics · 3 campos; sin cliente, 2 clics | 2 clics, sin preguntas; deja un borrador | ≥ 2 clics; correo, y WhatsApp en los planes de 19 € y 29 € | **No tiene**: ni enlace de pago ni pasarela; no vi cómo marcar pagada |
| **Contasimple** | No abierto por dentro. (web) existe, con firma electrónica | No abierto por dentro. (web) «con un clic», pudiendo cambiar cantidades y precios antes | No visto | (dentro) casilla para marcar la factura como cobrada, en opciones avanzadas del formulario. (web) anuncia cobro en su TPV; un enlace de pago para el cliente final, sin confirmar |
| **Billin / TS Facturas** | No abierto por dentro. (web) con estados pendiente, aceptado, rechazado y facturado, y aviso de si el cliente lo abrió | No abierto por dentro. (web) desde el presupuesto aceptado se genera factura, albarán o proforma | (dentro) casilla «enviar por correo al emitir» en el paso 2: 1 clic más; solo correo | (dentro) bloque para añadir un método de pago y casilla de «cantidad ya pagada», vistos y sin explorar. Pasarela: sin verificar |
| **ServiceM8** (fila del 25-sep; **la del 2-oct, vista por dentro, está en §8 y manda**) | (dentro) no hay documento: se crea un Trabajo, con el cliente dado de alta solo al teclear su nombre y la línea elegida de una lista con precio. ≈ 3 clics · 2 campos | (dentro) **no se convierte**: se cambia el estado del Trabajo (abrir el desplegable y elegir, 2 clics · 0 campos) y el mismo registro pasa de presupuesto a factura | (dentro) un botón de enviar con desplegable, en presupuesto y en factura; no pulsado | (dentro) al pasar a factura aparecen «pagado» y «saldo pendiente». (web) anuncia cobro con tarjeta antes de irse de la obra; no visto por dentro |
| **YaQu** (código, no pantalla) | Rápido: 3 clics · 3 campos, ya enviado. Editor: 6 clics | Con firma, 0 clics; a mano, 3. Sale emitida. En España hoy, sin camino | Dentro del propio botón (rápido) o 1 clic | Petición de pago al firmar; marcar pagada, 2 clics |

La factura suelta, que es lo único medible en los dos españoles (deducido de las notas):
Contasimple ≈ 6 clics · 2 a 3 campos · 1 página («Crear» → «Facturas emitidas» → elegir cliente en el
desplegable → obtener número → «Crear factura»); Billin ≈ 4 clics · 3 campos · asistente de 2 pasos con vista
previa antes de emitir («Crear factura» → cliente por buscador → continuar → guardar o emitir).

### Cuántos tienen cobro

**No es «ninguno».** De estos cuatro:

| | ¿Cobro del cliente final? | Origen |
|---|---|---|
| Verifacturamos | **No** | dentro, 2-oct |
| Contasimple | Apunta el cobro; anuncia cobro en TPV. Enlace de pago, sin confirmar | dentro (casilla) y web |
| Billin | Método de pago y «ya pagado» en la factura. Pasarela, sin verificar | dentro, sin explorar |
| ServiceM8 | Sí según su web; por dentro se ve el saldo, no el pago | web y dentro |

Uno confirmado sin cobro, uno con cobro anunciado, dos sin poder decirlo. Y el recuento del 21-sep sobre
trece competidores (solo web) ya decía que **al menos nueve ofrecen cobro en línea** al cliente final y que
solo Verifacturamos está confirmado sin él. Con este material, «tener cobro» no nos separa del mercado; nos
separa de Verifacturamos.

Lo que este material **no** contesta, de ninguno de los tres: cuántos clics cuesta su presupuesto, cuántos su
conversión, y cuántos cobrar. Para eso hay que entrar.

## 8 · ServiceM8 por dentro (2-oct-2026): un Trabajo que cambia de estado, no un documento que se convierte

👁 **Visto por dentro** el 2-oct-2026 con la cuenta de prueba del 25-sep (periodo de prueba: le quedan 7 días).
Capturas `docs/competencia/capturas/servicem8/pasos-NN-*.png`. Corrige y sustituye la fila de ServiceM8 del §7.
No pulsados: «Send Quote», «Send Invoice», «Email Invoice», «Approve» y «Add Payment». La propia cuenta avisa
de que no puede mandar correo ni SMS hasta verificar el correo del titular.

**El modelo.** No hay «presupuesto» ni «factura» como documentos: hay un **Trabajo** con un campo de estado
(Presupuesto · Orden de trabajo · Terminado · No conseguido). La pestaña de importes es la misma siempre; lo
que cambia con el estado es cómo se llama y qué botón ofrece. Todo se guarda solo: no existe botón de guardar.

| Tramo | Camino (visto) | Captura | Cifra |
|---|---|---|---|
| Presupuesto, con cliente nuevo | «New Job» (el Trabajo ya existe, con número y en estado Presupuesto) → teclear el nombre del cliente y salir del campo (queda creado, con un «Deshacer» a mano) → pestaña «Billing» → teclear en la fila de líneas → clic en la sugerencia, que trae su precio | `pasos-04`, `pasos-05`, `pasos-08`, `pasos-09` | **3 clics · 2 campos · 1 pantalla** |
| Enviar | Botón «Send Quote» con desplegable al lado, en la misma pestaña | `pasos-09` | ≥ 1 clic; no pulsado |
| De presupuesto a factura | Pestaña «Details» → abrir «Job Status» → «Completed». Al volver a «Billing»: cabecera verde, la descripción pasa a ser de factura, el botón pasa a «Send Invoice» y aparecen «Paid» y «Balance Due». Ni cliente ni líneas se tocan | `pasos-10`, `pasos-12` | **3 clics · 0 campos · 0 pantallas nuevas** (2 si ya se está en «Details») |
| Aprobar | Hay un paso que no tenemos ni nosotros ni Verifacturamos: el Trabajo terminado cae en «Invoicing» → «Awaiting Approval», y hasta que se aprueba no pasa a «Awaiting Payment» | `pasos-13`, `pasos-14`, `pasos-15` | 4 clics deducidos (Invoicing → pestaña → fila → «Approve»); «Approve» no pulsado |
| Cobrar | En «Invoicing», con la fila elegida: «Receive Payment» abre una ventana con importe, fecha (hoy), método (por defecto, efectivo) y nota, y «Add Payment». Es **apuntar** un cobro. Cobro con tarjeta al cliente: su web lo anuncia; por dentro no lo he visto | `pasos-16` | 5 clics · 1 campo deducidos (Invoicing → pestaña → fila → «Receive Payment» → importe → «Add Payment»); «Add Payment» no pulsado |

En `pasos-16` la ventana enseña un error de «no se pueden cargar los pagos»: lo provoqué yo. Mi conductor
corta toda petición cuya ruta nombre un pago, y la lista de pagos se carga con una de ésas.

**Sin impuestos en la línea**, como ya decían las notas del 25-sep: el total del presupuesto y de la factura
sale con el impuesto a cero. No es una herramienta fiscal española.

**Ellos · nosotros · la diferencia**, en este tramo:

| | ServiceM8 (visto) | YaQu (código, no pantalla) | La diferencia que nota |
|---|---|---|---|
| De presupuesto a factura | Un campo de estado en el mismo registro: 3 clics, nada que volver a mirar | Un documento nuevo: con firma del cliente sale solo; a mano, 3 clics, y exige aceptación | Empate en clics a mano. Con ellos el profesional no tiene la sensación de «hacer otra cosa»: sigue en la misma ficha y la ve cambiar de color |
| Guardar | No existe: cada cambio queda guardado | Botones de continuar, generar y guardar | Con ellos no hay un momento de «¿lo he guardado?» |
| Cliente nuevo | Se crea al teclear el nombre y salir del campo | En el rápido, al enviar; en el editor, modal de alta | Parecido en el rápido; ellos no piden nada más |
| Entre terminar y cobrar | Un paso de aprobación, en otra pantalla | No hay | Aquí ellos piden más pasos que nosotros |
| Cobrar | Apuntar el cobro: otra pantalla, ≈ 5 clics | Marcar pagada: 2 clics; petición de pago sola al firmar | Nosotros, por ≈ 3 clics en lo visto |

**Un Trabajo en estado Presupuesto no sale en la lista de trabajos de la pizarra** (filtro «All Jobs»): los
cuatro que creé desaparecieron de ella al cerrar la ficha, y por eso gasté cuatro donde cabía uno. La pizarra
tiene una cola aparte, «Pending Quotes», que **no abrí**: lo medido es que no están en la lista general, no
que no estén en ningún sitio.

Lo que no vi: el cobro con tarjeta, lo que hay detrás de enviar, la cola de presupuestos pendientes y la
aplicación móvil (donde su web dice que se cobra «antes de irse de la obra»).

**Contasimple y Billin: sin entrar.** De Billin no se guardó la contraseña (lo dicen sus notas del 25-sep). De
Contasimple no hay en esta máquina ningún fichero de credencial reconocible por su nombre. En los dos casos el
camino es recuperar la contraseña por correo, y eso es del fundador. Sus filas del §7 se quedan como están.

## 9 · Cuentas de prueba

**ServiceM8** (alta: 25-sep-2026) sigue **abierta**, con 7 días de prueba por delante el 2-oct. Datos
inventados creados el 2-oct-2026: Trabajos n.º 2 (vacío), 3, 4 y 5, y los clientes «Cliente Inventado Prueba
Dos», «… Tres» y «… Cuatro». Nada enviado, nada aprobado, ningún cobro apuntado.

**Verifacturamos** sigue **abierta** (alta: 21-sep-2026). Darla de baja es lo último de la
consultoría. Datos inventados creados el 2-oct-2026: cliente «Cliente Inventado Prueba», presupuestos
P-2026-0002 y P-2026-0003 (los dos convertidos) y dos borradores de factura sin número. Nada emitido, nada
enviado.

## 10 · La página para el fundador

> **A ellos los vimos por dentro; a nosotros, leyendo el código.** Verifacturamos y ServiceM8, con cuenta de
> prueba el 2-oct-2026. YaQu, en `origin/main`, sin abrir la pantalla. Contasimple y Billin, solo de notas de
> septiembre. Cada cifra nuestra de esta página puede cambiar cuando alguien la cuente en yaqu.app.

**Lo medido, en cuatro líneas.**

- Crear y enviar un presupuesto corto: nosotros 3 clics, Verifacturamos ≥ 5, ServiceM8 3 sin contar el envío.
- Presupuesto por el editor completo: nosotros 6 clics, Verifacturamos 3.
- De presupuesto a factura a mano: nosotros 3 clics y exigimos aceptación; Verifacturamos 2 y deja un borrador;
  ServiceM8 3 sobre el mismo registro, y luego pide aprobar en otra pantalla.
- Cobrar: Verifacturamos no lo tiene; ServiceM8 apunta el cobro en ≈ 5 clics; nosotros 2, o ninguno si el
  cliente firma. Y hoy, en España, nuestro tramo de factura y cobro está apagado.

**Las tres cosas que esta comparación abre**, ordenadas por lo que ahorran frente a lo que cuestan. No son
propuestas de pantalla: son la cuenta de cada una, para decidir.

| | Qué es | Base | Qué ahorra | Qué cuesta en nuestro código | Etiqueta |
|---|---|---|---|---|---|
| 1 | **Llegar al editor completo desde el inicio** | Verifacturamos: un botón en el Panel. Nosotros: menú «Presupuestos» + «Nuevo presupuesto» | 1 clic de 6 | El destino ya existe y ya se abre con una línea desde cinco pantallas (`renderAppView('quotes-new')`); el inicio tiene tres acciones rápidas en `homeView.js`. Es un control más en el inicio, con texto que ve el usuario: pide firma (regla 39) y es del carril de la pantalla | Ahorro **deducido** (código, no pantalla) · coste **medido** leyendo |
| 2 | **Un presupuesto sin cliente** | Verifacturamos: cliente opcional, 2 clics y 2 campos | 1 campo en el presupuesto rápido (el nombre) y 1 clic en el editor. En el rápido, teclear un nombre que no existe ya da de alta al cliente sin salir | El presupuesto lleva el cliente como dato obligatorio en tres capas: la tabla (`prisma/schema.prisma`, `customerId Int`), el validador (`src/core/validation/schemas.ts`) y el editor. Once ficheros de `src` leen el cliente del presupuesto, y el envío necesita su teléfono. **Toca el esquema: se nombra y se para** (regla 40) | Ahorro **medido** en ellos, **deducido** en nosotros · coste **medido** en su entrada, **no mirado** en sus once ficheros |
| 3 | **Repasar la factura antes de emitirla** | Verifacturamos: «Convertir» deja un borrador que se corrige. Nosotros: «Generar factura» la deja emitida | Ningún paso: **añade** uno (de 3 a 4 clics a mano). Lo que da es poder corregir antes, en vez de rectificar después | **Es el camino de emisión: se nombra y se para** (reglas 29 y 40). No he leído qué haría falta | Diferencia **medida** en ellos, **leída** en nosotros · coste **no mirado**, a propósito |

**Lo más grande que salió y no cabe en esa tabla.** ServiceM8 no convierte documentos: cambia el estado de
un Trabajo, sobre el mismo registro y sin botón de guardar. En clics empata con nosotros; la diferencia es de
modelo, y un cambio de modelo es del máster, no de una tanda. Queda descrito en §8 y no se cuenta su coste.

**Lo que tampoco entra, y por qué.** Tres de los seis clics de nuestro editor son «Continuar», uno de ellos
en un paso (Condiciones) que se pasa sin tocar nada. Es el mayor ahorro posible de toda la comparación, pero
quitar pasos al asistente es rehacer una pantalla decidida. La decisión, leída después, está en §11.

**Lo que falta para que esta página valga del todo:** contar nuestros pasos en yaqu.app (lo denegó el
clasificador de permisos; lo autoriza o lo recorre el fundador), y entrar en Contasimple y Billin (hay que
recuperar sus contraseñas por correo). La cuenta de ServiceM8 tenía 7 días de prueba el 2-oct-2026.

## 11 · La decisión de los cuatro pasos del editor, y el paso de Condiciones

Leído en `origin/main` el 2-oct-2026. No es una propuesta: es la decisión, su motivo y la cuenta de quitar
**ese** paso.

**La decisión existe, tiene motivo y es del fundador.** Es SCRUM-915; vive en
`docs/prototipos/SCRUM-915/direccion-de-diseno.md` y se construyó en el corte 915d
(`docs/master/SCRUM-915.md`).

| Versión (17-sep-2026) | Qué era | Qué dijo el fundador |
|---|---|---|
| v1 | Una hoja con un riel de cinco pasos, todos a la vista | «Mola, pero sigue siendo un poco lioso…» (comentario 15790 del ticket) |
| v2 | Dos columnas: a la izquierda los pasos **con solo el actual abierto**; a la derecha el documento vivo. Presupuesto: Cliente → Conceptos → Condiciones → Revisar y enviar | «me gusta mucho más» |
| v3 | La v2 con dos cambios; es la aprobada y la que cita el código | Aprobada |

**El motivo es la claridad, no los pasos.** Los cuatro pasos nacen para que la pantalla deje de ser «liosa».
Ni la dirección de diseño ni su medición (`medicion.md`: errores de consola, desplazamiento horizontal,
tamaño de los controles, totales) cuentan pulsaciones: la palabra «clic» no aparece en la medición. La
decisión no pesó cuántos «Continuar» costaba, porque nadie se lo preguntó. El motivo sigue vigente: tiene
quince días.

**Condiciones se diseñó para pasarse sin tocar.** La v2 lo dice así: «Condiciones ya elegidas: tres filas
resumen (cobro, formas de pago, validez), cada una con "Cambiar"». Que el paso llegue relleno y se confirme
con un «Continuar» no es un descuido: es lo dibujado.

**¿Cuántas veces se toca? No se puede saber hoy**, y no es lo mismo que «nadie lo toca»:

- El editor no deja rastro de qué paso se abre ni de qué se cambia en él (en `quotesView.js` la única
  telemetría que hay es la del origen por voz).
- Se podría deducir de los datos —cuántos presupuestos guardan una forma de cobro o una validez distintas de
  las de fábrica—, pero producción no tiene clientes reales y desde aquí no se ha consultado ninguna base.

**Lo que cuesta quitar ese paso, leído:**

| | Qué hay | Etiqueta |
|---|---|---|
| El mecanismo | Ya existe y está en producción: el paso se añade con una condición, y el justificante corre con **tres** pasos (Cliente · Conceptos · Revisar). El corte 915g ya mudó su fila «Ajustes del documento» al último paso | medido leyendo |
| Lo que habría que mudar | En el presupuesto, Condiciones lleva cuatro filas: forma de cobro, formas de pago, validez y «Ajustes del documento». Tendrían que vivir en «Revisar», como en el justificante, plegadas y con su «Cambiar» | deducido |
| Lo que lo sujeta | `tests/scrum915d-pasos-del-editor.test.mjs` y los guards del editor que nombra el registro de SCRUM-915 fijan el orden y el reparto de bloques de hoy. Guardan una decisión firmada: no se reescriben sin el fundador | medido en su existencia; **no leídos uno a uno** |
| Lo que ahorra | 1 clic: el editor pasa de 6 a 5. Con la entrada directa desde el inicio (§10, fila 1), a 4. Verifacturamos está en 3 | deducido (código, no pantalla) |
| Quién decide | Cambia una pantalla aprobada el 17-sep-2026: firma del fundador y carril de la pantalla | — |

**Un dato que salió al leer la decisión.** La v3 aprobada no está construida entera: su último paso es
«Guardar y enviar», que abre una hoja con el mensaje tal como le llega al cliente. Ese corte (915f) consta en
el registro como parado hasta un GO escrito del fundador, porque toca envío y cobro. Hoy el editor acaba en
«Generar presupuesto» y una ventana con el PDF. En pulsaciones no cambia nada: son las mismas.
