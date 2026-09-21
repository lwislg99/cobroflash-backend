# Con qué venden los competidores cuando NO pueden prometer el cobro (21-sep-2026)

**Medido el 21-sep-2026 sobre `origin/main` = `a65a77f444cc9fcc78eb63f7a3d0c09174ccccb6`** (el código
nuestro; esta entrega no lo toca). Las webs de los competidores, descargadas entre las **15:33:11Z y
las 15:33:56Z** del mismo día (hora de GitHub, `gh api -i zen`). Rama `scrum-1016-competencia-sin-cobro-j5`.
Escribe **J5**, para dar respuesta al encargo que dejó **SCRUM-1016** (J4): tras la enmienda de
SCRUM-612 (regla 24, PR #1593), el titular de YaQu (`H7/AB5`) y el héroe de la landing no pueden seguir
prometiendo cobro en España mientras `INVOICING_ES_ENABLED` esté en OFF, y J4 se paró explícitamente en
esos tres puntos (titular, héroe, objeción del Kit Digital) porque decidir el ángulo nuevo es del
fundador, no de una sesión.

🔴 **Esto NO propone ningún titular ni frase de usuario para YaQu.** Trae datos de mercado para que
Javier decida el ángulo con algo delante. Firma de texto: regla 39 del máster.

## 0 · Método (y por qué NO es `WebFetch`)

`docs/competencia/matriz.md` ya dejó escrito, y se repite aquí porque aplica igual: **`WebFetch` no se
usa para esto**. Devuelve el resumen de un modelo pequeño, no la página, y ese resumen puede inventar
una cita que "suena bien" y no existe tal cual (medido por la sesión que escribió la matriz, líneas
42-44). Aquí se ha usado un método distinto pero con la misma garantía — **cero interpretación de un
modelo entre la web y la cita**:

1. `curl` descarga el HTML tal cual lo sirve el dominio (con user-agent de navegador de escritorio),
   a un fichero por competidor, fuera del árbol (`$CLAUDE_JOB_DIR/tmp/competencia/`, no se sube: son
   descargas de terceros, no evidencia que deba vivir en git — si hace falta releer, se vuelve a
   descargar con la misma receta).
2. Un script de Node (sin llamar a ningún modelo) extrae por regex literal: `<title>`, `meta
   description`, `og:title`, `og:description`, todos los `<h1>` y los tres primeros `<h2>`. Es texto
   quitando etiquetas, no un resumen.
3. Las citas de "cobro/pago" del cuerpo de la página se sacan con una segunda pasada, también por
   regex sobre el texto plano, mostrando **80 caracteres de contexto a cada lado** de cada coincidencia
   — así se ve si la palabra vende o solo describe una función en una lista.

**Límite declarado de este método:** es la portada pública de cada dominio, en escritorio, sin cuenta,
sin geolocalización española forzada y sin JavaScript ejecutado (algunas cadenas que solo pinta un
framework de cliente pueden no estar en el HTML servido; donde eso importa, se dice en la fila). No es
una opinión de diseño ni un juicio de qué "se lee mejor": es lo que el HTML de hoy contiene, citado
tal cual.

**Población:** los 13 competidores que ya estaban documentados en `docs/competencia/` (heredados de mi
antecesora y de la Sesión 0 de Luis, `matriz.md` §3-16): Verifacturamos, Holded, Quipu, Anfix,
Billin/TS Facturas, Contasimple, FacturaDirecta, Sage, Jobber, ServiceM8, Housecall Pro, Tradify y
Fergus. **No se ha dado de alta en ningún sitio nuevo** (A19): todo esto es su web pública, igual que
el resto de `matriz.md`.

## 1 · El titular (H1) de cada uno, literal

| # | Competidor | `<h1>` literal | Subtítulo / meta, si aporta |
|---|---|---|---|
| 1 | **Verifacturamos** | *"Crea facturas conformes con Hacienda y Verifactu en 2 min."* | og:title: *"Factura Electrónica Verifactu — Crea facturas conformes con Hacienda en 2 minutos"* |
| 2 | **Quipu** | *"Tu facturación lista para Verifactu . Sin complicaciones."* | meta: *"La solución para controlar tu facturación, impuestos, tesorería y clientes en un único lugar"* |
| 3 | **Anfix** | *"Simplifica la gestión de tu negocio"* | meta: *"Software profesional de facturación online y contabilidad... Optimiza tu gestión financiera ¡YA!"* |
| 4 | **Billin / TS Facturas** | *"Programa de facturación online"* | h2: *"Factura fácil y sin errores con TS Facturas"*, *"Prepárate para Verifactu..."* |
| 5 | **Contasimple** | *"Contasimple, el único software de gestión para autónomos y pymes gratis para siempre"* | — |
| 6 | **FacturaDirecta** | *"Facturas con flow para autónomos y pymes"* | h2: *"Todo en un solo programa"*, *"Preparados para VeriFactu"* |
| 7 | **Sage** | *"Para cada fase de tu negocio"* | meta: *"Sage, empresa líder en software de gestión empresarial..."* |
| 8 | **Holded** | *"Factura, cobra y cierra el mes. Sin complicaciones."* | meta: *"Facturación, contabilidad, CRM, proyectos, inventario y RR.HH. en una sola plataforma. Más de 900.000 usuarios..."* |
| 9 | **Jobber** | *"Run a stronger service business"* | meta: *"Quote, schedule, invoice, and **get paid**—all in one place."* (og:title: *"Jobber: The #1 Field Service Management Software"*) |
| 10 | **ServiceM8** | *"Smart software for contractors & services"* | meta: *"Job tracking & CRM for trade contractors... Cut paperwork, get more jobs done..."* |
| 11 | **Housecall Pro** | *"Everything to run and grow your business"* | meta: *"...helping Pros manage scheduling, dispatching, invoicing, payments, and customer communication."* |
| 12 | **Tradify** | *"Job Management Software \| The Best Tool to Run Your Business"* | meta: *"Get your life back! Try the #1 rated all-in-one job management app..."* |
| 13 | **Fergus** | *"Job management software built for tradies"* | meta: *"...A better way to run your business."* |

**Lo primero que salta, contado:** de los **13**, **CERO** hace del cobro/la morosidad el titular de su
web — ninguno dice, en su `<h1>`, algo del tipo "cobra antes" o "deja de perseguir a nadie" como
promesa aislada y protagonista. El único que **menciona** cobrar en su H1 es **Holded** (#8), y lo
mete como el **segundo verbo de una cadena de tres** ("Factura, **cobra** y cierra el mes"), no como
el titular por sí solo — su venta real es el ciclo administrativo completo, no el cobro.

## 2 · Los ejes que SÍ usan, contados

| eje de venta (del titular) | competidores | cuántos |
|---|---|---|
| **Velocidad / simplicidad** ("en 2 min", "en segundos", "sin complicaciones", "fácil") | Verifacturamos, Quipu, Anfix, Billin, Holded (parcial: "sin complicaciones") | 5 |
| **Cumplir con Hacienda / VeriFactu sin pensar** (en el H1, no solo mencionado más abajo) | Verifacturamos, Quipu | 2 |
| **Gestión integral / todo-en-uno** ("un solo programa/plataforma", ciclo completo) | Anfix, Contasimple, Sage, Holded | 4 |
| **Precio / gratis** | Contasimple ("gratis para siempre") | 1 |
| **Categoría + profesionalizar el oficio** ("job management software", "run/grow your business") | Jobber, ServiceM8, Housecall Pro, Tradify, Fergus | 5 |
| **Estilo de vida / tiempo libre** | Tradify ("Get your life back!", en meta) | 1 |
| **Cobro/morosidad como titular único** | *ninguno* | **0** |

(Varios competidores entran en más de un eje a la vez — p.ej. Holded es "todo-en-uno" y "sin
complicaciones" a la vez — por eso las columnas no suman 13.)

**Lectura del bloque español (7 de 7):** los siete —Verifacturamos, Quipu, Anfix, Billin, Contasimple,
FacturaDirecta, Sage— abren SIEMPRE con **facturación + velocidad/simplicidad**, y **4 de 7** añaden
VeriFactu explícitamente (2 en el H1 mismo, 2 en el subtítulo inmediato). Ninguno de los siete vende
"que te paguen"; venden "que cumplas y no te compliques".

**Lectura del bloque anglosajón / oficios (5 de 5):** los cinco —Jobber, ServiceM8, Housecall Pro,
Tradify, Fergus— abren con la **categoría del producto y la promesa de profesionalizar/crecer el
negocio** ("run/grow your business", "job management software"), nunca con el cobro. Son el grupo más
parecido a YaQu en lo que hacen (presupuesto → trabajo → factura en campo) y **tampoco** usan la
morosidad como titular — la palabra que más se repite en sus H1 es "business"/"negocio", no "paid".

## 3 · "No lo ofrece" vs. "no lo usa para vender" — la distinción que pide el encargo

Aquí está el matiz que cambia la lectura del punto 1: **la mayoría SÍ ofrece cobro online del cliente
final, y lo dice en su propia portada — solo que no abre con eso.** Contado con cita y contexto (80
caracteres a cada lado, extracto literal del HTML, sección "Método"):

| competidor | ¿ofrece cobro online del cliente final? | ¿dónde lo dice, si lo dice? |
|---|---|---|
| **Holded** | ✅ Sí (Wallet propio + Stripe/PayPal/Square/GoCardless) | **En el H1** ("Factura, cobra..."), y repetido 6 veces más en la portada: *"Holded elimina el estrés de la facturación: creas, envías y cobras desde un mismo sitio"*, *"cuando entra un cobro... Holded avisa"* |
| **Anfix** | ✅ Sí (Anfix Pay) | Feature, no titular: *"Ofrece pago online con Anfix Pay para cobrar más rápido y de forma segura"* |
| **Contasimple** | ✅ Sí (menciona cobro en su TPV y en 5 páginas de industria) | Feature, no titular: *"Cobra rápido y gestiona tus ventas desde nuestro POS"*, *"Cobra antes y planifica gastos"* (repetido en las páginas de bares, construcción, alimentación) |
| **FacturaDirecta** | ✅ Sí (portal de cliente + Stripe) | Feature muy presente, no titular: *"Portal de cliente y cobros"*, *"Portal de cliente con cobro por Stripe y remesas SEPA"* (aparece en el menú, en funcionalidades y en precios) |
| **Jobber** | ✅ Sí ("make payments" en el *client hub*, "Payments" en el menú) | Solo en subtítulo/menú, nunca en el H1: *"Quote, schedule, invoice, and get paid—all in one place"* |
| **Housecall Pro** | ✅ Sí, y lo destaca justo bajo el héroe | No en el H1, sí en el primer bloque de features: *"Run your business... **Get paid** Every payment collected, no chasing required."* |
| **Fergus** | ✅ Sí, con marca propia ("Fergus Pay") | No en el H1, sí en un bloque de features destacado: *"Fergus Pay — **Get paid 2x faster**"*, *"let customers pay via Tap to Pay"* |
| **ServiceM8** | ✅ Sí ("accept credit card payments") | No en el H1, sí en el menú de features: *"Get paid faster. Produce professional invoices in seconds and even take payment before you leave"* |
| **Tradify** | 🟡 Sí, pero muy secundario | Solo aparece en metadatos de una página propia (*"credit-card-payments-with-stripe"*); no se ve texto de venta de esa página en la portada |
| **Quipu** | 🟡 Matizado | Lo que dice es *"Cobros y pagos sincronizados y al día con tu facturación"* — conciliación bancaria, no confirma un enlace de pago al estilo Stripe para el cliente final |
| **Verifacturamos** | ❌ No | Confirmado ya en `matriz.md` §3: *"No hay pasarela para el cliente final. Stripe aparece solo como cobro de su propia suscripción."* Cero coincidencias de "cobro/pago/stripe" en su portada |
| **Billin / TS Facturas** | ❓ No verificado a fondo | La única mención en la portada es genérica, en una lista de funciones ("administración de cobros y pagos"); no cita pasarela propia como las demás — **no se concluye que no la tenga, se concluye que la portada no la vende ni la nombra con detalle** |
| **Sage** | ❓ No verificado | **Cero** coincidencias de cobro/pago/Stripe/PayPal en toda la portada. Coherente con lo ya medido en `matriz.md` §16 (solo dos artículos de blog leíbles, nada de producto) |

**Contado:** de 13, al menos **9 SÍ ofrecen y SÍ mencionan** el cobro online en algún punto de su propia
portada (Holded, Anfix, Contasimple, FacturaDirecta, Jobber, Housecall Pro, Fergus, ServiceM8, y
Tradify de forma marginal) — **pero ninguno lo pone en el titular como gancho único**, y solo uno
(Holded) lo mete siquiera dentro del H1. 1 confirmado que NO lo ofrece (Verifacturamos). 1 matizado
(Quipu: lo que tiene es conciliación, no un enlace de pago claro). 2 no verificados con el mismo detalle
(Billin, Sage) — declarado como límite, no como negativo.

🔒 **Esto es el dato que pidió el encargo, dicho sin mezclar:** el mercado no calla que se puede cobrar
por la plataforma — **lo pone en una sección de features, nunca en la frase de apertura.** El cobro es
un ARGUMENTO DE SOPORTE casi universal (9 de 13 lo usan en algún sitio de la home) pero NUNCA el ángulo
de entrada. Eso es justo lo que J4 necesitaba para que Javier decida: no hay que inventar un mercado
que "vive sin cobro" — vive CON cobro, pero vende otra cosa primero, y eso primero cambia según el
segmento (Hacienda/VeriFactu en España; profesionalizar el negocio en el mundo anglosajón).

## 4 · Lo que esto no contesta (y que sí importaría para elegir el ángulo)

- **No mide conversión.** Que el eje "velocidad/simplicidad" sea el más repetido no prueba que sea el
  que más vende — solo que es el que más se ha probado. Ninguna de estas 13 páginas es un test A/B
  publicado.
- **No mide al cliente de YaQu.** Los 13 son competidores de la competencia, no encuestas a electricistas
  o fontaneros españoles. La matriz ya lo advierte para otras conclusiones (§15.4) y aplica igual aquí.
- **No se ha ejecutado JavaScript del cliente.** Si alguna de estas páginas pinta su H1 real con un
  framework de cliente (React, Vue) en vez de servirlo en el HTML inicial, esta medición no lo vería y
  se leería como más vacía de lo que es. **No se ha detectado ese patrón** en ninguna de las 13 (todas
  sirvieron su titular en el HTML de la primera respuesta), pero se declara como límite del método.
- **Contasimple, Quipu, Anfix, FacturaDirecta también tienen páginas por oficio** (construcción,
  electricistas, fontaneros) con su propio titular, distinto del de portada — no se han recorrido todas;
  solo las que ya cayeron dentro del barrido de "cobro/pago" de la §3. Si el ángulo final se decide por
  oficio, esas páginas son la siguiente lectura, no ésta.

## 5 · Entrega

Comentario dejado en **SCRUM-1016** con el resumen de esta tabla, para que quede al lado de las 12
líneas que J4 verificó y de la pregunta que dejó abierta sobre el titular (#7 H7/AB5). J5 no propone
texto de usuario: entrega los datos y para aquí (regla 39, y el propio encargo de J4).
