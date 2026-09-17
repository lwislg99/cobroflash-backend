# La competencia, función por función · matriz viva

**Medido el 17-sep-2026 18:24:26Z (hora de GitHub) · `origin/main` = `ef332b90728399ab0ee75c9166af63890fda2bfa`.**
**Ticket:** SCRUM-906, FASE 2 · **Carril:** consultoría (Sesión 0) · **Encargo:** orquestador, 17-sep-2026.

Este documento **CRECE**: entra un competidor por entrega y el PR se amplía. Lo que ya está escrito
no se reescribe salvo que una medición nueva lo tumbe, y entonces se dice que lo tumbó.

Va **detrás** de `docs/master/SCRUM-906.md` (FASE 1, benchmark público de 8 competidores), y no lo
repite: aquel es una tabla de **huecos** («esto nos falta, y lo tienen estos»); éste es una tabla de
**funciones** («esta función, en cada producto»), pensada para leerse en columna.

## Cómo se lee una celda

| marca | qué quiere decir |
|---|---|
| ✅ **Sí** | Existe y está disponible para el usuario. |
| 🟡 **A medias** | Existe una parte, o existe entero pero apagado tras una bandera. Se dice cuál. |
| ❌ **No** | **Medido**: se buscó, no está, y hay un comando o una cita que lo respalda. |
| ❓ **No encontrado** | Se buscó en las fuentes que hay y no sale. **No es lo mismo que «no lo tiene».** Va con su *suelo*: qué búsqueda parecida SÍ dio resultado, para demostrar que la búsqueda no estaba ciega. |
| 🔒 **Sin cuenta** | Solo se sabría entrando en el producto. Hoy no hay cuenta de prueba (ver «Límites»), así que la celda queda honestamente vacía en vez de rellenada a ojo. |

🔴 **La regla que gobierna este documento:** «no lo encuentro» y «no lo tiene» son **veredictos
distintos**. Uno manda a mirar otra vez; el otro cierra la pregunta. Confundirlos es el peor error de
este puesto, y en este documento se distinguen con marca propia (❓ frente a ❌).

## Límites de esta medición

- **Los competidores están medidos SOLO por su web pública**: páginas de producto, precios, centro de
  ayuda y términos. **No hay ninguna cuenta de prueba abierta.** Un alta en un servicio de terceros la
  autoriza el fundador, y esa autorización no se hereda entre sesiones (A19 de
  `docs/equipo/00-normas-comunes.md`). Mientras no la haya, todo lo que solo se vería por dentro queda
  como 🔒 **Sin cuenta**.
- **YaQu está medido en el código** de `origin/main` en el SHA de la cabecera, con `git grep` sobre el
  árbol remoto. Cada celda lleva el fichero. **No está medido en staging**, salvo donde se diga.
- ⚠️ **`WebFetch` no se ha usado, y no debe usarse para esto.** No devuelve la página: devuelve el
  resumen de un modelo pequeño, y en la FASE 1 ese resumen **inventó tres cosas** que al pedir la frase
  exacta no aparecían. Las páginas se descargan a texto literal y se citan verbatim.
- ⛔ **Fiscal.** Lo que un competidor diga de VeriFactu **se anota, no se valida ni se promete**
  (regla 17 del máster, guion H2). Que alguien escriba «homologado» en su web no lo convierte en un
  hecho comprobado.
- Sin copiar textos, diseño ni código de nadie: se comparan **funciones e ideas**.

---

## 1 · La matriz

Los detalles, las citas literales y los enlaces, en la ficha de cada competidor más abajo.

| # | Función | **YaQu** | **Verifacturamos** | **Holded** |
|---|---|---|---|---|
| 1 | Presupuesto | ✅ | ✅ | ✅ con anticipo (Estándar+) |
| 2 | Envío y canales | ✅ **WhatsApp con botones** | 🟡 PDF por el WhatsApp del móvil | 🟡 email y portal · ❓ WhatsApp |
| 3 | Firma del cliente | ✅ | ❌ | ✅ con cupo mensual por plan |
| 4 | Cobro | 🟡 flags OFF | ❌ | ✅ tarjeta y SEPA · ❓ Bizum |
| 5 | Tipos de factura | 🟡 | ✅ 23 tipos | ✅ + Facturae |
| 6 | Recurrentes | ❌ | ✅ | ✅ con tope por plan |
| 7 | Rectificativas | ✅ | ✅ R1-R5 | ✅ |
| 8 | VeriFactu | 🟡 **sin remisión** | ✅ vía colaborador | ✅ con certificado propio o suyo |
| 9 | Gastos y justificantes | 🟡 foto, sin lectura | 🟡 | ✅ **OCR ilimitado en todos los planes** |
| 10 | Partes y albaranes | ✅ ambos, con firma | 🟡 solo albarán | 🟡 albarán sí · ❓ parte de trabajo |
| 11 | Fichaje | ❌ | ❓ | ✅ con geolocalización (gema) |
| 12 | Equipos del cliente | ❌ | ❓ | ❓ solo lote y nº de serie |
| 13 | Agenda | 🟡 sin calendario | ❓ | ✅ calendario y reservas |
| 14 | App móvil | ✅ PWA | 🟡 «sin app nativa» | ✅ nativa iOS y Android |
| 15 | Sin conexión | 🟡 firmar sí | ❌ | ❓ nada, e indicios de que exige red |
| 16 | IA | ✅ redacta | ❓ | ✅ **conector MCP oficial** |
| 17 | Precio | 19,90 €/mes | 9 €/mes | desde 15 €/mes + IVA |

---

## 2 · Columna YaQu — medida en el código, no recordada

Todo lo de abajo se midió con `git grep` sobre `origin/main` = `ef332b90`, el 17-sep-2026 a las
18:2xZ. Donde pone ❌ va el **comando** que lo mide; donde hay riesgo de estar buscando mal, va el
**suelo**.

| # | Función | Estado | Dónde está, en el código |
|---|---|---|---|
| 1 | **Presupuesto** | ✅ | `src/modules/quotes/app/routes/quotes.routes.ts`. Plantillas (`QuoteTemplate` en `prisma/schema.prisma`) y sugerencia de líneas con IA. Presupuesto por **voz** construido pero **apagado**: `src/core/flags.ts:24` `VOICE_QUOTE_ENABLED: false`. |
| 2 | **Envío y canales** | ✅ | WhatsApp por la **Cloud API de Meta directa** (`src/integrations/whatsapp.ts`, importado en `quotes.routes.ts:26`), email y enlace público. **Es el foso: nadie más de los medidos manda el presupuesto por WhatsApp con botones.** |
| 3 | **Firma del cliente** | ✅ | `public/dashboard/js/signaturePad.js` (canvas), estado en `estadoFirma.js`. El cliente firma desde su móvil, sin instalar nada. |
| 4 | **Cobro** | 🟡 | Stripe (`src/integrations/stripe.ts`) y MercadoPago. **Connect apagado**: `flags.ts:18` `PAYMENTS_CONNECT_ENABLED: false` → hoy no se cobra con tarjeta del cliente final en la cuenta del profesional (regla 18: prohibido cobrar en la cuenta de plataforma). **Bizum manual apagado**: `flags.ts:19` `BIZUM_MANUAL_ENABLED: false`. Queda transferencia. |
| 5 | **Tipos de factura** | 🟡 | `src/modules/invoicing/`. Ordinaria y rectificativa sí; recapitulativa sí. **`flags.ts:16` `INVOICING_ES_ENABLED: false`** → para merchants ES reales hoy se emite **recibo**, no factura fiscal, hasta SIF-1 8/8. |
| 6 | **Recurrentes** | ❌ | **No hay generación automática de facturas de cuota.** Lo único que existe es `billingPeriodicity` (`schema.prisma:395`, valores `NINGUNA\|QUINCENAL\|MENSUAL` en `validation/schemas.ts:634`) y su propio código dice para qué es: *«periodicidad pactada (solo para AVISAR, ver bandeja)»* — `src/modules/system/customerAdmin.ts:39`. Avisa; no factura. |
| 7 | **Rectificativas** | ✅ | R1 y anulación con registro. `src/modules/invoicing/domain/clienteCongelado.ts:193` `congelarParaRectificativa`. Una factura emitida no se edita ni se borra (regla 29). |
| 8 | **VeriFactu** | 🟡 | Se construye el registro y su encadenado: `src/modules/fiscal/verifactu/registro.builder.ts` y `productor.ts`, con los XSD oficiales (`SuministroLR.xsd`, etc.). **Falta lo que más pesa: la remisión a la AEAT.** Medido: `git grep -n -E "fetch\(\|axios\|https://www1?\.agenciatributaria" origin/main -- src/modules/fiscal` → **cero resultados**. No hay una sola llamada de red hacia Hacienda. `flags.ts:17` `SIF_ENABLED: false`. |
| 9 | **Gastos y justificantes** | 🟡 | `model Expense` con `receiptData` (`schema.prisma:941`) y foto del ticket. **Sin lectura automática**, y lo dice el propio código: *«el mismo principio que rige el OCR si algún día entra»* — `src/modules/expenses/domain/justificante.ts:129`. |
| 10 | **Partes y albaranes** | ✅ | `model ParteTrabajo` y `model Albaran` en `schema.prisma`, con firma. Es de lo más completo que hay frente a los de facturación pura. |
| 11 | **Fichaje** | ❌ | **Nada.** `git grep -n -i -E "fichaje\|fichar\|controlHorario\|registroJornada\|clockIn\|timesheet" origin/main -- src prisma public` → **0 resultados**. **Suelo:** la misma forma de búsqueda sobre `albaran` devuelve 32 aciertos solo en `schema.prisma`, así que la búsqueda no está ciega. |
| 12 | **Equipos del cliente** | ❌ | No hay modelo de equipo, máquina ni instalación. **Suelo:** `git grep -n -E "^model " origin/main -- prisma/schema.prisma` lista **30 modelos** (`Merchant`, `Customer`, `Quote`, `Invoice`, `Albaran`, `ParteTrabajo`, `MaintenancePlan`…) y **ninguno** es `Equipment`, `Asset`, `Device` ni equivalente. Lo más cercano es `MaintenancePlan`, y está apagado: `flags.ts:37` `MAINTENANCE_ENABLED: false`. |
| 13 | **Agenda** | 🟡 | `scheduledAt` (`schema.prisma:1211`, con índice en `:1250`) y salida `.ics`. **No hay vista de calendario.** |
| 14 | **App móvil** | ✅ PWA | `public/manifest.json` + `public/sw.js`. No hay app nativa en las tiendas, y para el oficio eso también significa **nada que instalar ni actualizar**. |
| 15 | **Sin conexión** | 🟡 | `public/sw.js`, `public/dashboard/js/almacenLocal.js` y `colaDeFirmas.js`: **firmar sin red sí**, con cola. Crear o editar un parte entero sin red **no está medido**, y hasta que se mida no se afirma. |
| 16 | **IA** | ✅ | `src/integrations/gemini.ts` y `src/integrations/claude.ts`: líneas de presupuesto, albarán, parte y mensaje. |
| 17 | **Precio** | — | **Pro 19,90 €/mes** o **199 €/año**; **Founding 9,90 €**. Medido en `public/index.html:744-750`, `public/precios.html:7` y `public/dashboard/js/plansView.js:86-124`. |

---

## 3 · Verifacturamos

**verifacturamos.com** (el `.es` no responde). Titular **DIDO DIGITAL LLC**, Wyoming. Producto de
**facturación pura VeriFactu**: no intenta ser un ERP ni un gestor de trabajo de campo.
Fuentes: 29 páginas leídas a texto literal el 17-sep-2026.

| # | Función | Verifacturamos |
|---|---|---|
| 1 | Presupuesto | ✅ Cliente, conceptos y validez. Sin plantillas ni IA encontradas. `/como-hacer-presupuestos-factura` |
| 2 | Envío y canales | 🟡 PDF por email, o «compartir» del móvil → WhatsApp con el PDF adjunto. **Sin API de WhatsApp**: *«No necesitas conectar APIs»* (`/enviar-facturas-whatsapp`). Es el WhatsApp del teléfono, no un canal del producto. |
| 3 | Firma | ❌ No hay firma. La aceptación se hace *«por el chat»*, y el albarán *«que lo confirme en el momento»*. |
| 4 | Cobro | ❌ **No hay pasarela para el cliente final.** Stripe aparece solo como cobro de su propia suscripción (`/sub-procesadores`). Estados: emitida / enviada / cobrada. |
| 5 | Tipos de factura | ✅ **23 tipos**: IGIC, IPSI, intracomunitarias, E1-E6, recargo de equivalencia, inversión del sujeto pasivo, autofacturas, suplidos. Presupuesto y albarán → factura en un toque; agrupa albaranes en factura mensual. |
| 6 | Recurrentes | ✅ Mensual, trimestral, semestral y anual, con envío automático por email; se pausan y se edita la próxima. |
| 7 | Rectificativas | ✅ R1-R5, por diferencias o por sustitución, vinculadas a la original; las emitidas quedan bloqueadas. |
| 8 | VeriFactu | ✅ Solo modalidad VERI\*FACTU. Remite a través de **Verifacti** (Bilbabit SL, colaborador social, convenio 017). QR ISO 18004 nivel M. **Sin certificado del usuario.** Anulación y subsanación. Declaración responsable publicada en `app.verifacturamos.com/declaracion-responsable`. ⛔ Anotado, no validado. |
| 9 | Gastos | 🟡 **Contradictorio entre sus propias páginas.** Modelo 303: solo informe, no lo presenta. Libro registro en XLSX. Carpeta de Google Drive para el gestor. |
| 10 | Partes y albaranes | 🟡 Albaranes sí, y se agrupan en factura. Parte de trabajo no aparece. |
| 11 | Fichaje | ❓ No encontrado. **Suelo:** la misma lectura sí devuelve sus páginas de albaranes y recurrentes, así que el corpus no está vacío. |
| 12 | Equipos del cliente | ❓ No encontrado (mismo suelo). |
| 13 | Agenda | ❓ No encontrado (mismo suelo). |
| 14 | App móvil | 🟡 Web que se añade a la pantalla de inicio. Ellos mismos escriben **«Sin app nativa»**. |
| 15 | Sin conexión | ❌ No hay. Reintenta el envío. |
| 16 | IA | ❓ No encontrada. |
| 17 | Precio | **9 €/mes**, 20 facturas gratis, sin tarjeta. ⚠️ **Se contradicen** en si el IVA está incluido. El alta (`/signup`) pide **nombre, email y contraseña**; su portada dice «Solo tu email y tu NIF», pero **el formulario no pide NIF**. |

**Cosas suyas que conviene tener delante:**
- Regla automática del **40 % de materiales** → aplica IVA 10 % o 21 % al convertir el presupuesto en
  factura (`/facturacion-electricistas-fontaneros`). Es una regla de oficio metida en el producto.
- **Importar desde Holded, Quipu, Anfix y Factusol** continuando la numeración.
- Integraciones: Shopify, WooCommerce, Amazon, Wix, PrestaShop y API.

### Lo que no tenemos (frente a Verifacturamos)

1. **Facturas recurrentes de verdad.** Ellos generan y envían; nosotros solo avisamos
   (`customerAdmin.ts:39`). Es la cuota de mantenimiento, que es ingreso repetido del profesional.
   *Propuesta:* generar la factura de cuota desde `MaintenancePlan`, que ya existe, en vez de un módulo
   nuevo. ⛔ Toca dinero y fiscal.
2. **Remisión a la AEAT.** Ellos remiten (vía un colaborador social); nosotros construimos el registro y
   ahí se acaba — cero llamadas de red a Hacienda, medido. *Propuesta:* decidir **antes de construir**
   si se remite directo o a través de un colaborador, porque cambia el proyecto entero. ⛔ Fiscal.
3. **El abanico de tipos de factura.** 23 contra los nuestros. *Propuesta:* no copiar los 23; mirar
   cuáles tocan a un oficio español (recargo de equivalencia, inversión del sujeto pasivo en obra,
   suplidos) y hacer **esos**. ⛔ Fiscal.
4. **Importar desde el software anterior conservando la numeración.** Es la barrera de cambiarse.
   *Propuesta:* un importador por competidor, empezando por el que más aparezca en las bajas.
5. **La regla del 40 % de materiales.** Conocimiento de oficio convertido en automatismo, que es
   exactamente nuestro terreno. *Propuesta:* estudiarla con el fundador antes de nada; si el criterio
   es correcto, es barata y se nota. ⛔ Fiscal.

### Lo mejor suyo

- **Enfocarse y decirlo.** Hacen facturación VeriFactu y nada más, y la web no promete otra cosa. A
  9 €/mes eso es una oferta legible en diez segundos.
- **Publicar la declaración responsable en una URL abierta.** Es la prueba que un autónomo pide, y se
  puede enseñar sin entrar. Barato y muy defendible.
- **Apoyarse en un colaborador social** en vez de construir la remisión: se ahorran el trozo más caro.
- **Páginas por oficio** («electricistas y fontaneros») con la regla fiscal de ese oficio dentro. Es
  captación por SEO y demostración de producto en la misma página.
- **No fingir app nativa.** Escriben «Sin app nativa» con todas las letras. Nos da permiso para decir
  lo mismo de nuestra PWA, y defenderla como ventaja: nada que instalar.

---

## 4 · Holded

**holded.com** · El grande del mercado español: ERP y contabilidad completa, con módulos de pago
sueltos («gemas») encima del plan. Medido **solo por su web pública**: 55 páginas descargadas a texto
literal el 17-sep-2026, de las que se citan 29. **No hay cuenta de prueba** (ver «Límites»), así que
lo que solo se vería por dentro no está aquí.

> **Cómo se comprobó, y qué NO cuadró.** La tabla la levantó un subagente y **yo la repasé después**:
> de 7 citas de riesgo elegidas a dedo, **6 aparecen literalmente** en los ficheros descargados
> (colaborador social, Bizum 0 resultados, escáner ilimitado, firma digital, MCP, «solo lectura»).
> **La séptima no:** la cita de precios «Plus 15,00 € 7,50 €/mes…» estaba **reconstruida leyendo una
> tabla en columnas**, no copiada de una línea. Los **números son correctos** —el fichero dice `Plus`
> / `15,00 €` / `7,50 €/mes` en líneas 106-108—, pero la frase entrecomillada no existía tal cual. Se
> ha sustituido por la del FAQ de la misma página, que sí es literal y se sostiene sola. Queda escrito
> porque es el fallo típico de este trabajo: una tabla aplanada parece una cita y no lo es.

| # | Función | Holded | Cita literal y fuente |
|---|---|---|---|
| 1 | Presupuesto | ✅ | *«Un presupuesto es un documento en el cual se indica el importe y la cantidad acordada por la venta de un bien o servicio y que no tiene ninguna validez hasta que el cliente lo acepte y lo firme.»* Convierte a Factura, Ticket de venta, Proforma, Pedido, Albarán. Anticipo a cuenta y previsión de facturación **solo en Estándar, Avanzado y Premium**. `help.holded.com/es/articles/6987424` y `/6895939` |
| 2 | Envío y canales | 🟡 | Email (SMTP propio o de Holded) para *«facturas, tickets, presupuestos, proformas, albaranes y pedidos»*, y enlace al Portal del cliente. `help.holded.com/es/articles/6836216`. **WhatsApp ❓ NO ENCONTRADO como canal de documentos.** *Suelo:* buscar `whatsapp` en su ayuda sí devuelve 1 artículo, pero es del **programa de referidos** (*«Comparte ese enlace como prefieras (email, WhatsApp, redes…)»*), no de envío de facturas. `help.holded.com/es/?q=whatsapp` |
| 3 | Firma | ✅ | *«La firma digital te permite enviar documentos para firmar de forma sencilla y seguir su estado en todo momento, sin necesidad de imprimir, escanear ni utilizar herramientas externas.»* Sobre presupuestos, proformas, pedidos y albaranes de venta, desde el Portal del cliente. **Cupo mensual por plan:** 5 / 20 / 50 / 100 / 400 firmas. `help.holded.com/es/articles/10900972` |
| 4 | Cobro | ✅ | Tarjeta vía Holded Wallet: *«Cada factura incluirá la opción Pagar con tarjeta cuando el método esté activo.»* (`/13741751`). Pasarelas: *«Stripe, Paypal, Square y GoCardless»* (`/6881253`). Domiciliación SEPA con reintento (`/7902294`). Recordatorios automáticos de impago, gema gratuita, **solo Avanzado y Premium** (`/6984213`). **Bizum ❓ NO ENCONTRADO.** *Suelo:* su buscador responde *«No hemos encontrado ningún artículo para:bizum»*, mientras «GoCardless» y «Stripe» sí devuelven artículos. `help.holded.com/es/?q=bizum` |
| 5 | Tipos de factura | ✅ | Factura, ticket de venta, proforma, venta rectificativa y **factura electrónica Facturae** para administraciones públicas. `help.holded.com/es/collections/3745408-ventas`. ❓ No aparecen con ese nombre «factura simplificada» ni «recapitulativa»; el ticket de venta cubre el caso de la simplificada. |
| 6 | Recurrentes | ✅ | *«Una factura de venta recurrente es un documento que se convierte en factura en el intervalo de tiempo que tú decidas y que se envía de forma repetida al mismo contacto…»* `/6895111`. **Con tope por plan:** 0 / 10 / 100 / 300 / 1.000 al año — el plan más barato **no las tiene**. |
| 7 | Rectificativas | ✅ | *«Una venta rectificativa, también llamada nota de crédito, se utiliza para detallar alguna corrección en el importe de la factura original…»*, relacionable con la original y conciliable con ella. *«El importe a rectificar se reporta siempre en positivo en el campo Total, se convertirá en negativo automáticamente.»* `/6895315` |
| 8 | VeriFactu | ✅ | ⛔ *Anotado, no validado.* *«Solo necesitas […] subir tu certificado electrónico o, si lo prefieres, usar el de Holded, ya que estamos reconocidos como colaborador social por la AEAT.»* y *«Cuando apruebes una factura, ticket o venta rectificativa, Holded la enviará automáticamente a la Agencia Tributaria. Una vez recibida, la Agencia generará un código QR y un identificador VFAC, y devolverá el documento ya validado a Holded.»* `/11406283`. Fechas que publican: **sociedades 1-ene-2027, autónomos 1-jul-2027**. |
| 9 | Gastos | ✅ | Escáner con lectura automática por subida, por email a `@holdedbox.com` o por foto: *«Los archivos digitalizados con esta opción estarán certificados por la AEAT, y no será necesario conservar sus copias físicas.»* (`/6908098`) y *«Sí, el escáner ilimitado está incluido en todos los planes de Holded sin coste adicional.»* (`holded.com/es/escaner`). |
| 10 | Partes y albaranes | 🟡 | Albarán de venta y de compra, ligados a stock: *«Actúa como comprobante para la entrega o recepción de bienes entre empresas o individuos.»* `/6884228`. **Parte de trabajo ❓ NO ENCONTRADO.** *Suelo:* buscar «parte de trabajo» da 10 resultados y **los diez** son «carga de trabajo» (RR.HH.), «centro de trabajo» (nóminas) o control horario; ninguno es una hoja de intervención. La misma búsqueda con «albarán» sí devuelve su artículo dedicado. |
| 11 | Fichaje | ✅ | Desde la app, con Play / Pausa / Stop, y vista de supervisor que permite *«saber desde qué lugar realizaron el fichaje gracias a la geolocalización del móvil.»* `/11000150`. Va en la gema de RR.HH., **desde 1,5 €/empleado/mes**. |
| 12 | Equipos del cliente | ❓ | **NO ENCONTRADO** como módulo: no hay ficha de máquina instalada en casa del cliente con historial ni próxima revisión. Lo más cercano es lote y número de serie en el documento (*«Selecciona el lote o el número de serie correspondiente al crear el presupuesto.»*, `/6987424`) y *«control de la garantía»* a nivel de producto de inventario. *Suelo:* buscar «mantenimiento» en su ayuda da **2 resultados**, y son «Sitio en Mantenimiento» de PrestaShop y el tiempo de retención de la papelera. |
| 13 | Agenda | ✅ | Calendario con *«conexión bidireccional»* a Google y Microsoft (`/10090977`), y módulo **Reservas** con página pública de cita previa (`/9546137`), limitado a *«50 reservas al mes, un máximo de 3 espacios»* sin la gema. |
| 14 | App móvil | ✅ | Nativa iOS y Android: fichar, subir gastos al escáner y usar Holded Wallet. Acceso con credenciales, cuenta de Google o Apple, PIN o biometría. `/8290826` |
| 15 | Sin conexión | ❓ | **NO ENCONTRADO**: ni un artículo sobre modo sin conexión. *Suelo:* las búsquedas «offline», «sin conexión» y «sin internet» no devuelven ninguno, y lo único relacionado apunta al contrario — *«puedes acceder desde cualquier navegador web y dispositivo con conexión a Internet»*. `help.holded.com/es/?q=sin%20internet`. **No se concluye que no funcione sin red: se concluye que no lo cuentan.** |
| 16 | IA | ✅ | **Conector MCP oficial**, `https://mcp.holded.com/mcp`: *«Una vez conectado, puedes pedirle a Claude que trabaje con los datos de tu cuenta de Holded en lenguaje natural.»* Con límite explícito de permisos: *«Todo lo que mueve dinero, tiene efecto fiscal o afecta a personas se queda en solo lectura.»* `/15646468`. Además, categorización contable con IA (*«más del 95% de precisión»*, `holded.com/es/programa-contabilidad/contabilidad-ia`) y la lectura del escáner. |
| 17 | Precio | — | *«Holded cuesta desde 15 € al mes con el plan Plus. El resto de planes son Básico (29 €), Estándar (59 €), Avanzado (99 €) y Premium (199 €), **IVA no incluido**. Los tres primeros meses tienen un 50% de descuento y puedes probarlo gratis 14 días sin tarjeta.»* `holded.com/es/precios?audience=smallBusiness`. **No hay plan gratuito permanente.** Aparte se pagan las gemas: RR.HH. desde 1,5 €/empleado/mes, Inventario desde 25 €/mes, TPV desde 25 €/tienda/mes, SII desde 30 €, y **10 €/mes por usuario extra**. |

### Lo que no tenemos (frente a Holded)

1. **Lectura automática del ticket de gasto.** Ellos la dan **ilimitada hasta en el plan más barato**, y
   encima con la digitalización certificada, que es el argumento que quita el papel de la furgoneta.
   Nosotros tenemos la foto y nada más, y el código lo admite: *«el OCR si algún día entra»*
   (`expenses/domain/justificante.ts:129`). **Es el hueco más grande de los cinco**, porque es semanal.
   *Propuesta:* extraer emisor, NIF, base, IVA y fecha con el Gemini que ya está integrado, y
   **proponer** el gasto para que la persona confirme, nunca darlo por bueno solo.
2. **Remisión de la factura a la AEAT.** Ellos envían al aprobar y reciben QR e identificador; nosotros
   construimos el registro y ahí acaba —cero llamadas de red a Hacienda, medido—. *Propuesta:* la
   decisión de fondo (directo o por colaborador social) va **antes** de escribir código. ⛔ Fiscal.
3. **Facturas recurrentes.** Ver la ficha de Verifacturamos: misma propuesta, y ojo a un detalle suyo
   que es de producto, no de ingeniería: **las racionan por plan** (0/10/100/300/1.000) y así el plan
   barato no las lleva.
4. **Fichaje con geolocalización.** Es obligación legal de quien tiene empleados, ellos lo cobran
   aparte a 1,5 €/empleado y en YaQu no hay **nada**: 0 resultados en `src/`, `prisma/` y `public/`.
   *Propuesta:* es la línea de SCRUM-913, que ya está en la cola. ⛔ Esquema: ALTER antes.
5. **Un conector MCP.** Que el cliente hable con sus datos desde su propio asistente. Nuestro tamaño
   lo hace **más fácil** que en un ERP: menos entidades que exponer. *Propuesta:* de salir, copiar su
   regla de permisos tal cual —lo que mueve dinero o tiene efecto fiscal, en solo lectura—, que
   encaja con nuestras reglas 18 y 29 sin tocarlas.
6. **Calendario de verdad y cita previa pública.** Tenemos `scheduledAt` y un `.ics`; ellos, calendario
   sincronizado y página pública de reservas.

### Lo mejor suyo

- **Racionar por plan en vez de por módulo.** Firmas al mes, recurrentes al año, facturas al año: la
  misma función en todos los planes, con distinto cupo. Se vende mejor que «esto no lo tienes» y es
  una palanca de precio que hoy no usamos.
- **El escáner ilimitado en todos los planes.** Regalan la función que engancha y cobran por el resto.
- **La página de VeriFactu como captación.** Fechas, sanciones y comparativa con TicketBAI y SII: es
  SEO y es tranquilizar a la vez. ⛔ En YaQu eso solo se puede escribir con el guion H2.
- **El conector MCP con permisos por área.** Van por delante, y la regla que eligieron es sensata.
- **Portal del cliente único**: ver, pagar, aceptar presupuesto, comentar, pedir y firmar en un sitio.

### Lo que Holded NO puede hacer, y nosotros sí

Esto es lo que más importa de toda la ficha, porque es la razón de existir de YaQu, y hoy está
**medido**, no supuesto:

- **Mandar el presupuesto por WhatsApp.** No aparece en ninguna de las 55 páginas. El único WhatsApp
  que documentan es el de compartir el enlace de referidos.
- **Cobrar por Bizum.** Su propio buscador devuelve cero.
- **Un parte de trabajo de campo.** Diez resultados y ninguno lo es.
- **La ficha de la caldera o el cuadro del cliente**, con su historial. Solo lote y número de serie.
- **Trabajar sin cobertura en un sótano.** No lo cuentan en ninguna parte, y lo poco relacionado dice
  que hace falta conexión.

🔴 Y al mismo tiempo Holded **se posiciona en Construcción** (`holded.com/es/construccion`). Es decir:
va a por ese cliente **sin** las cinco cosas de arriba. Ahí está el hueco, y no es pequeño.

---

## Cola de competidores

Uno por entrega, avisando al orquestador al acabar cada uno.

**Hechos:** Verifacturamos ✅ · Holded ✅ (público)
**Pendientes:** Quipu · Anfix · Billin · Contasimple · FacturaDirecta · Sage (Active o 50) · Odoo ·
Jobber · Tradify · Fergus · ServiceM8 · Housecall Pro.
**Excluidos por decisión del orquestador:** STEL Order y Fixner — sus términos **prohíben
expresamente** usar el producto para competir (cláusula «Uso limitado», recogida en
`docs/master/SCRUM-906.md` §2).

Los tickets de «lo que no tenemos» **los abre el orquestador**, no esta sesión.
