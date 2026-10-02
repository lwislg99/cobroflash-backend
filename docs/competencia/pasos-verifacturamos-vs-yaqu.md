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
| **ServiceM8** | (dentro) no hay documento: se crea un Trabajo, con el cliente dado de alta solo al teclear su nombre y la línea elegida de una lista con precio. ≈ 3 clics · 2 campos | (dentro) **no se convierte**: se cambia el estado del Trabajo (abrir el desplegable y elegir, 2 clics · 0 campos) y el mismo registro pasa de presupuesto a factura | (dentro) un botón de enviar con desplegable, en presupuesto y en factura; no pulsado | (dentro) al pasar a factura aparecen «pagado» y «saldo pendiente». (web) anuncia cobro con tarjeta antes de irse de la obra; no visto por dentro |
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

## 8 · Cuenta de prueba

Sigue **abierta** (competidor: Verifacturamos · alta: 21-sep-2026). Darla de baja es lo último de la
consultoría. Datos inventados creados el 2-oct-2026: cliente «Cliente Inventado Prueba», presupuestos
P-2026-0002 y P-2026-0003 (los dos convertidos) y dos borradores de factura sin número. Nada emitido, nada
enviado.
