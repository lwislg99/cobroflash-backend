# La competencia, función por función · matriz viva

**Última entrega: 20-sep-2026 a las 19:20:38Z · `origin/main` = `8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`** (§10, las tres propuestas que cierran Holded). *(El §9 se midió sobre `d1782564`; el §8, a las 13:26:07Z sobre `f2fa091b`.)*

🔴 **Desde el §10 cambia el entregable de este documento:** una pasada de competencia ya no entrega una matriz, entrega **propuestas concretas de producto** con su respaldo medido. El porqué y la forma, en el §10.
*(La primera versión de este documento se midió el 17-sep a las 18:24:26Z sobre `ef332b90`; el §7 consolidado, el 18-sep a las 07:00:46Z sobre `ecccf94e`.)*
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

- **Verifacturamos y Quipu están medidos SOLO por su web pública**: páginas de producto, precios,
  centro de ayuda y términos. Lo que solo se vería por dentro queda como 🔒 **Sin cuenta**.
- **Holded está medido por fuera Y POR DENTRO** (§6). El fundador autorizó por escrito, el 17-sep-2026
  y para esa sesión concreta, crear una cuenta de prueba con un alias de su propio correo, con estas
  condiciones: **parar si piden NIF, DNI, tarjeta o teléfono**, y **no pagar nada**. Se cumplieron las
  dos. Un alta en un servicio de terceros la autoriza el fundador y esa autorización **no se hereda
  entre sesiones** (A19 de `docs/equipo/00-normas-comunes.md`): la próxima sesión que quiera entrar en
  otro producto tiene que pedirla de nuevo.
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

| # | Función | **YaQu** | **Verifacturamos** | **Holded** | **Quipu** |
|---|---|---|---|---|---|
| 1 | Presupuesto | ✅ | ✅ | ✅ con anticipo (Estándar+) | ✅ |
| 2 | Envío y canales | ✅ **WhatsApp con botones** | 🟡 PDF por el WhatsApp del móvil | 🟡 email y portal · ❓ WhatsApp | 🟡 email · ❓ WhatsApp |
| 3 | Firma del cliente | ✅ | ❌ | ✅ desde el Portal del cliente, **apagada de fábrica**, con cupo mensual por plan (§8) | ❓ |
| 4 | Cobro | 🟡 flags OFF | ❌ | ✅ tarjeta y SEPA · ❓ Bizum | 🟡 conecta Stripe/PayPal **para facturar**, no para cobrar · ❓ Bizum |
| 5 | Tipos de factura | 🟡 | ✅ 23 tipos | ✅ + Facturae | ✅ |
| 6 | Recurrentes | ❌ | ✅ | ✅ con tope por plan | ✅ |
| 7 | Rectificativas | ✅ | ✅ R1-R5 | ✅ | ✅ |
| 8 | VeriFactu | 🟡 **sin remisión** | ✅ vía colaborador | ✅ con certificado propio o suyo | ✅ declaración responsable pública |
| 9 | Gastos y justificantes | 🟡 foto, sin lectura | 🟡 | ✅ **OCR ilimitado en todos los planes** | ✅ OCR |
| 10 | Partes y albaranes | ✅ ambos, con firma | 🟡 solo albarán | 🟡 albarán sí · ❓ parte de trabajo | ❓ parte de trabajo |
| 11 | Fichaje | ❌ | ❓ | ✅ con geolocalización (gema) | ❓ |
| 12 | Equipos del cliente | ❌ | ❓ | ❓ solo lote y nº de serie | ❓ |
| 13 | Agenda | 🟡 sin calendario | ❓ | ✅ calendario y reservas | ❓ |
| 14 | App móvil | ✅ PWA | 🟡 «sin app nativa» | ✅ nativa iOS y Android | ❓ |
| 15 | Sin conexión | 🟡 firmar sí | ❌ | ❓ nada, e indicios de que exige red | ❓ |
| 16 | IA | ✅ redacta | ❓ | ✅ **conector MCP oficial** | ✅ OCR y conciliación |
| 17 | Precio | 19,90 €/mes | 9 €/mes | desde 15 €/mes + IVA | desde 17 €/mes (8,5 € los 3 primeros) |

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

## 5 · Quipu

**getquipu.com** · Facturación, gastos y tesorería para autónomos y pymes, muy orientado a la
**asesoría**. 21 páginas leídas a texto literal el 17-sep-2026. Dos URLs del plan de trabajo dieron
404 propio de Quipu (`/precios` y `/ayuda`); las buenas son `/es/plan-de-precios` y
`helpcenter.getquipu.com/es/`, y son las que se leyeron.

| # | Función | Quipu |
|---|---|---|
| 1-2 | Presupuesto y envío | Presupuestos sí; el envío documentado es **por email**. WhatsApp ❓ no encontrado. |
| 3 | Firma | ❓ **NO ENCONTRADO** firma del cliente sobre presupuesto o factura. Lo único que aparece con la palabra «firma» es la autorización VeriFactu del propio usuario ante la AEAT, que es otra cosa. |
| 4 | Cobro | 🟡 **Matizado tras repaso a mano.** Dicen *«Pasarelas de pago / Conecta con Stripe o PayPal»* (`getquipu.com/es/empresas`), pero la frase que lo explica es *«Conecta tu tienda online, CRM o pasarela de pago y deja que Quipu genere las facturas automáticamente»*: la conexión sirve para **generar facturas a partir de tus ventas**, no para que el cliente final pague desde un enlace. Lo que sí tienen documentado del lado del dinero es **conciliación bancaria** y **remesas SEPA** (éstas solo en Premium). **Bizum: 0 resultados.** |
| 6-7 | Recurrentes y rectificativas | ✅ ambas. |
| 8 | VeriFactu | ✅ Publican una **declaración responsable** con detalle técnico real (versión de software, un microservicio propio con colas y reintentos). ⛔ Anotado, no validado. |
| 9 | Gastos | ✅ OCR de tickets y facturas. |
| 10-15 | Partes, fichaje, equipos, agenda, app, sin conexión | ❓ **NO ENCONTRADO ninguno.** *Suelo:* las mismas búsquedas sobre facturación, conciliación y OCR sí devuelven páginas suyas en el mismo corpus. Es un facturador y una tesorería; no tiene capa de servicio técnico de campo. |
| 17 | Precio | **17 €, 30 € y 59 €/mes** (Starter, Solution, Premium), con **50 % los 3 primeros meses** → 8,5 € / 15 € / 29,5 €. Prueba 15 días sin tarjeta. **No dicen en ninguna parte si el IVA está incluido**: 0 coincidencias de «IVA» en sus dos páginas de precios. |

> **Una ambigüedad resuelta con aritmética, no con suposición.** La página enseña el precio con
> descuento y al lado uno tachado, sin decir qué es el tachado. Lo dice su propio «Ahorra»:
> `17,0 − 8,5 = 8,5` y `8,5 × 3 = 25,5`, que es exactamente el «Ahorra 25,5€ en 3 meses». Cuadra
> igual en los otros dos (45,0 y 88,5). Luego **el tachado es el precio mensual normal**, no un total
> a tres meses. Se deja escrito el cálculo para que cualquiera pueda tumbarlo.

### Lo que no tenemos (frente a Quipu)

Nada nuevo respecto a lo ya listado en Verifacturamos y Holded: recurrentes, OCR de gastos y remisión
a la AEAT. Quipu **no añade ningún hueco que no estuviera ya**, y eso también es un dato.

### Lo mejor suyo

- **La asesoría como cliente, no como añadido.** Tienen página propia para asesorías y el producto
  está pensado para que el gestor viva dentro. Es el canal de la Parte H, montado.
- **La declaración responsable con detalle técnico de verdad**, no una página de marketing.
- **Conciliación bancaria y remesas SEPA** como eje, en vez del cobro al cliente final.

### Lo que Quipu NO puede hacer, y nosotros sí

Ni firma del cliente, ni parte de trabajo, ni equipos, ni agenda, ni sin conexión, ni cobro por
enlace al cliente final. Es el mismo patrón que Holded: **son contabilidad, no son la obra.**

---

## 6 · Holded POR DENTRO (cuenta de prueba, 17-sep-2026)

Cuenta de prueba de 14 días, plan sin elegir, sin tarjeta. Perfil «Autónomo sin empleados», España.
Lo de abajo está visto en la aplicación real, no en su web comercial.

### El alta

Pide **nombre, correo y contraseña**, y nada más: el teléfono está en el formulario pero rotulado
**«Opcional»**, y el alta se completa sin tocarlo. Después, dos pasos: tipo de negocio
(Empresa / Autónomo / Asesoría) y *«Solo necesitamos tu país y tu web para configurar tu cuenta de
autónomo»*. **En ningún momento piden NIF, DNI ni tarjeta.** Luego, un asistente de **8 pasos** antes
de dejarte trabajar, y una última pantalla que ofrece plan de pago con *«50% de descuento por 3 meses»*
frente a *«Continuar con prueba de 14 días · Sin tarjeta · Cancela cuando quieras»*.

🔴 **Comparación directa con nosotros:** de registro a poder trabajar hay **2 pasos de alta + 8 de
asistente + 1 de oferta**. Es la primera medida real de su fricción de entrada, y es el terreno donde
YaQu compite.

### El presupuesto por dentro — lo que más importa

La pantalla **Nuevo presupuesto** (`/doc/estimate/new`) tiene, contados sobre el DOM, **más de 150
campos de formulario** en una sola página. Lo visible se organiza así:

- **Cabecera:** Contacto (hay que seleccionarlo), Número de documento (sale `E260001`), Número
  interno, Fecha, Vencimiento.
- **Líneas:** Concepto · Descripción · Cantidad · Precio · Impuestos · Total, con **IVA 21 % puesto
  por defecto**, «Añadir línea» y un campo de **tiempo (`00:00`)** por línea.
- **Extras de línea:** «Escanear producto» (código de barras), «Seleccionar lote / SN», «Mostrar tipo
  de unidad», «Añadir productos iguales en una línea».
- **Descuentos:** por producto o global, y «Mostrar descuento en el documento».
- **Método de pago:** *No seleccionada · Transferencia bancaria · Pago al contado*, más «Crear /
  Editar formas de pago».
- **Categorización:** Cuenta contable (`70000000 Ventas de mercaderías`), cuenta por concepto,
  etiquetas, etiquetas por concepto, nota interna, asignar usuarios, asignar a proyecto.
- **Editor de texto enriquecido** completo (negrita, colores, listas, tablas, insertar imagen y vídeo)
  para el texto del documento y el mensaje final.
- **Campos personalizados:** existen, pero rotulados **«Mejorar plan»** — están detrás del precio.
- **Bloque Facturae / FACe** para administración pública: Oficina contable, Órgano gestor, Unidad
  tramitadora, Órgano proponente, contratos y fechas del emisor y del receptor, Expediente, Número y
  fecha de albarán, Línea del pedido, Texto legal.
- **Bloque Kit Digital**, que no habíamos visto por fuera: *«Añadir información Agente digitalizador
  (KIT…)»*, con fecha de inicio y fin de prestación e **importe subvencionado**.

**Tres lecturas que sirven para decidir:**

1. 🔴 **En el presupuesto de Holded no hay forma de que el cliente pague con tarjeta ni por Bizum.**
   Las formas de pago que ofrece el documento son **transferencia y contado**. El cobro con tarjeta
   existe en Holded, pero vive en la factura y en el portal, no aquí. Nuestro foso —presupuesto que se
   firma y se paga desde el mismo sitio— sigue en pie, y ahora está visto por dentro.
2. **El Kit Digital y el bloque Facturae son trabajo español de verdad** que nosotros no tenemos. El
   Kit Digital, además, es dinero público que el cliente ya está cobrando: aparecer ahí es comercial,
   no solo técnico.
3. **Su presupuesto es una hoja de contabilidad; el nuestro es un mensaje.** Más de 150 campos, cuenta
   contable por línea y editor de texto enriquecido es exactamente lo contrario de «presupuesto en 30
   segundos». No es un defecto suyo: es otro cliente. Conviene no copiarles la pantalla.

### Lo que NO se pudo medir por dentro, y por qué

Honestamente, y sin convertirlo en «no lo tienen»:

- **Envío y canales, firma y VeriFactu desde dentro: NO MEDIDOS.** Para verlos hace falta un documento
  guardado, y no llegué a guardarlo: el navegador de esta tanda corre **sin ventana visible**, y eso
  tiene una consecuencia que costó varias vueltas descubrir —está escrita abajo— que hace el trabajo
  interactivo lento y poco fiable.
- Lo que la matriz dice de esas tres filas para Holded **sigue viniendo de su web pública**, que es
  fuente legítima pero distinta. Está marcado como tal.
- *(18-sep-2026: **envío y canales y VeriFactu ya están medidos por dentro**, y la firma a medias. Ver
  §7.0. Lo de arriba queda como historia de lo que no se pudo el 17-sep.)*

### Tres trampas medidas, para quien venga detrás

1. 🔴 **`innerText` y `page.screenshot` necesitan MAQUETADO.** Con el navegador sin ventana visible,
   Chrome no maqueta: `innerText` devuelve **cadena vacía** teniendo el DOM entero cargado (112.820
   caracteres de HTML, 21 hijos en el `body`) y la captura espera un fotograma que no llega y revienta
   a los 30 s. **Un `innerText` vacío se lee igual que «la página no cargó», y no es eso.** El respaldo
   es `textContent`, que no necesita maquetado.
2. **El panel de Holded vive dentro de un IFRAME.** El documento de arriba solo tiene la barra lateral.
   Quien lea solo la página principal concluirá «esta pantalla está vacía» teniendo el contenido
   delante.
3. **Una opción que es prefijo de otra elige la equivocada.** En su asistente conviven «Otro» y «Otro
   sitio web», y el botón «Empresa» dice *«…o eres autónomo con empleados»*, así que buscar el botón
   «Autónomo» por coincidencia parcial **casa con los dos** y coge el primero. Hay que anclar en texto
   que solo esté en uno («no tienes empleados»).

---

## 7 · Consolidado para decidir (18-sep-2026)

**Medido el 18-sep-2026 a las 07:00:46Z (hora de GitHub) sobre `origin/main` =
`ecccf94e8c90ec80eed75b5f3d4e320f90a910a8`.** Encargo del fundador, a través del orquestador: *¿qué
estamos sacando de la competencia para copiar, y qué nos falta para estar completos?* Consolida
Verifacturamos, Holded y Quipu. Las marcas ❓ y 🔒 se mantienen, y el juicio de si algo **acerca a
tener clientes pagando** es de la Sesión 0 y va escrito. Las propuestas van numeradas para poder
citarlas: **los tickets los abre el orquestador**.

### 7.0 · Holded por dentro, lo medido el 18-sep

Solo lectura: no se guardó nada, no se envió nada y no se cambió ninguna configuración.

- **Envío y canales.** El presupuesto guardado (`E260001`) se envía **solo por email**: «Enviar desde
  Holded», Para, CC/CCO y asunto en **«Solo lectura»** en este plan (editarlo es de pago), más
  «Copiar enlace», «Ver portal» e «Imprimir». **WhatsApp y SMS: 0 apariciones** en todo el DOM del
  presupuesto y del portal del cliente, incluido lo oculto. *Suelo:* la misma búsqueda sí encuentra
  «Enviar vía email».
- **Portal del cliente.** Enseña el PDF, «Descargar», «Imprimir» y **«Aceptar presupuesto» /
  «Rechazar presupuesto»**. No hay botón de pago en el presupuesto.
- **VeriFactu (configuración).** Ajustes → Facturación → Conformidad: *«Tu cuenta cumple con la
  normativa RRSIF (RD 1007/2023)»*. Se configura **por periodo**, con tres opciones: «Verifactu»,
  «No Verifactu» y «Exento». **Una cuenta nueva nace «Exento» hasta el 31/12/2026**, con el motivo
  «Otros» y el texto «Configuración inicial automática», sin que el usuario elija nada. Su
  declaración responsable, leída en la aplicación: *«Indicación de si el sistema solo funciona como
  «VERI\*FACTU»: No»*. En Facturas hay un modal de *«Envío requerimiento No verifactu»*. **No se midió**
  el QR ni el envío de una factura, a propósito: exigiría declarar otra cosa y mandar registros a la
  AEAT. ⛔ Todo esto se anota; no se valida.
- **Firma.** La app «Firma digital» existe, es gratis y se activó. **El flujo para PEDIR la firma de un
  presupuesto NO se ha encontrado**: no está en el panel del presupuesto (al activar la app desapareció
  la tarjeta «Activa la firma digital» y no la sustituyó nada), ni en el modal de envío, ni en el
  portal. Y el botón «Enviar documento» del módulo lleva a Facturas de venta, que están vacías. ❓ **Es
  «no lo encuentro», no «no lo tiene»**: su ayuda dice que sí.
  - *(20-sep-2026: **esta ❓ está RESUELTA y la resolvió «no lo tiene» al revés.** La pantalla existe,
    está en `Configuración > CRM > Firma digital`, y los cinco tipos de documento **nacen apagados**.
    Lo de arriba queda como historia de dónde NO está. Ver §8.)*

### 7.1 · 🔴 Una corrección antes de nada: el cobro NO es foso hoy

Es cierto que en el presupuesto de Holded las formas de pago son solo *Transferencia bancaria* y *Pago
al contado*, y que su portal no tiene botón de pago en el presupuesto (§6 y §7.0). **Pero YaQu hoy
tampoco cobra al cliente final ni con tarjeta ni con Bizum**:

    git grep -n -E "PAYMENTS_CONNECT_ENABLED|BIZUM_MANUAL_ENABLED|BIZUM_AUTO_ENABLED" origin/main -- src/core/flags.ts
    → flags.ts:18 PAYMENTS_CONNECT_ENABLED: false · :19 BIZUM_MANUAL_ENABLED: false · :23 BIZUM_AUTO_ENABLED: false

Nos queda la transferencia, igual que al presupuesto de Holded. Y Holded sí cobra con tarjeta **en la
factura** (§4, fila 4). **Un foso construido y apagado no es un foso: es una promesa.**
Consecuencias: en marketing no se dice «cobra con tarjeta o Bizum» hasta CONNECT-1 / C1-4 (además es
la regla 18); en producto, es el foso más grande **el día que se encienda**.

### 7.2 · Lo que nos falta

| # | Qué | Quién lo tiene | Para qué le sirve al profesional | ¿Acerca a tener clientes pagando? |
|---|---|---|---|---|
| F1 | Lectura con IA del ticket de gasto | Holded (ilimitada en todos los planes), Quipu; en la FASE 1, además Contasimple, Plenia, Fixner y STEL | Quitar el papel de la furgoneta. Se usa cada semana | **SÍ, la primera.** Todos los de nuestro precio la dan por hecha, y Gemini ya está integrado. Que **proponga** el gasto y la persona lo confirme |
| F2 | Remisión a la AEAT | Los tres (Holded como colaborador social; Verifacturamos a través de Verifacti) | Cumplir VeriFactu | **No es una ventaja: es la condición.** Sin ella no se vende facturación en España desde 2027. Antes de escribir código hay que decidir: directo o por colaborador social. ⛔ Fiscal |
| F3 | Facturas recurrentes | Verifacturamos · Holded (con cupo; el plan más barato no las tiene) · Quipu | La cuota de mantenimiento | **SÍ, detrás de SIF-1**: sin factura fiscal no hay cuota fiscal. Sale mejor de `MaintenancePlan`, que ya existe. ⛔ Dinero y fiscal |
| F4 | Importar desde el software anterior conservando la numeración | Verifacturamos (Holded, Quipu, Anfix, Factusol) | Cambiarse sin perder la serie | **SÍ.** Es la barrera de cambio de quien ya factura. ⛔ La numeración es fiscal |
| F5 | La gestoría dentro: acceso del gestor o envío automático | Quipu (vive de ello) · Holded · Verifacturamos (email o Drive) | Quitarse el «¿y mi gestoría?» | **SÍ.** Es una objeción de compra, y la gestoría es un canal (Parte H) |
| F6 | Fichaje con geolocalización | Holded (gema, desde 1,5 €/empleado) | Obligación legal con empleados | **Solo para quien tiene empleados**, pero para ése es obligatorio. Ya es SCRUM-913. ⛔ Esquema |
| F7 | IVA del oficio automático (la regla del 40 % de materiales) y solo los tipos de factura del oficio | Verifacturamos | Acertar el IVA sin saber de IVA | **SÍ**: barato y de oficio. ⛔ Fiscal: el criterio lo valida el fundador con un gestor |
| F8 | Calendario sincronizado y cita previa pública | Holded | Agenda | **No a corto**: el oficio agenda por WhatsApp |
| F9 | Conector MCP | Holded | Hablar con los datos desde un asistente | **No hoy.** Si sale, se copia su regla: lo que mueve dinero o tiene efecto fiscal, en solo lectura |
| F10 | Facturae / FACe | Holded · Contasimple · Fixner | Facturar a la administración | **No**: el oficio pequeño casi no factura a la administración |

### 7.3 · Lo mejor suyo (cómo lo resuelven, no qué tienen)

- **M1 · Racionar por cupo, no por módulo.** Holded pone la misma función en todos los planes con
  distinto techo: firmas 5/20/50/100/400 al mes y recurrentes 0/10/100/300/1.000 al año. Es una palanca
  de precio que no usamos.
- **M2 · Regalar la función que engancha** (el escáner ilimitado) y cobrar por el resto.
- **M3 · Alta sin NIF ni tarjeta** (Holded: nombre, correo y contraseña; el teléfono pone «Opcional»).
  Se copia esa mitad y no la otra (N2).
- **M4 · Enfocarse y decirlo** (Verifacturamos: VeriFactu y nada más, a 9 €).
- **M5 · Páginas por oficio con la regla del oficio dentro** (Verifacturamos, «electricistas y
  fontaneros»): captación y demostración en la misma página.
- **M6 · Decir «sin app nativa»** (Verifacturamos). Nos da permiso para defender la PWA como ventaja.
- **M7 · Declaración responsable legible** (Quipu y Verifacturamos, en una URL pública; Holded, dentro
  de la aplicación). ⛔ En YaQu, nada hasta SIF-1 8/8 (regla 17).
- **M8 · Apoyarse en un colaborador social** para la remisión en vez de construirla. Es el dato que
  falta para decidir F2.

### 7.4 · Nuestro foso, con la medición que lo sostiene

- **Z1 · El presupuesto por WhatsApp con botones.** `src/integrations/whatsapp.ts` y
  `flags.ts:15` `WHATSAPP_TEMPLATES_ENABLED: true`. Holded, medido por dentro: solo email (§7.0).
  Verifacturamos: el PDF por el WhatsApp del móvil. Quipu: email. ⚠️ **Desde aquí no se puede medir si
  la cuenta de WhatsApp de producción manda hoy a clientes reales**: es una pregunta para el fundador,
  no un hecho.
- **Z2 · El cliente firma desde el móvil sin instalar nada** (`signaturePad.js`). Verifacturamos ❌;
  Quipu ❓; Holded ❓ (§7.0: existe, pero no se encontró cómo pedirla).
- **Z3 · Parte de trabajo con firma, y firmar sin red** (`colaDeFirmas.js`). Holded ❓; Quipu ❓. Son
  contabilidad, no son la obra.
- **Z4 · Cobrar con tarjeta o Bizum desde el presupuesto: FOSO APAGADO** (§7.1). No se vende hasta que
  se encienda.
- *No se pone como foso lo que no se ha medido:* nuestra fricción de alta frente a sus 2 + 8 + 1 pasos.
  Para compararla hay que contar la nuestra.

### 7.5 · Lo que NO hay que copiar

- **N1 · Su pantalla de presupuesto**: más de 150 campos, cuenta contable por línea, editor enriquecido,
  y Facturae y Kit Digital en la misma hoja. **Su presupuesto es una hoja de contabilidad; el nuestro es
  un mensaje.** Vale para toda la cola de rediseños.
- **N2 · El asistente de 8 pasos** antes de dejar trabajar.
- **N3 · Capar lo básico por plan** (el asunto del email en «Solo lectura»). Racionar cupos sí (M1);
  capar lo que todo el mundo espera, no.
- **N4 · La exención VeriFactu automática.** Marcar al usuario como exento sin que lo elija sería, en
  YaQu, decidir algo fiscal por el profesional. Ni se copia ni se sugiere. ⛔ Regla 17.
- **N5 · El bloque de Kit Digital del presupuesto.** *Lectura de la Sesión 0, sin medir:* sirve para
  facturar **como agente digitalizador**, y eso no es lo que hace un fontanero. Que YaQu entre como
  solución del Kit Digital es otra cosa, de negocio, y la decide el fundador.
- **N6 · Contabilidad completa, nóminas, TPV y los 23 tipos de factura**: son de otro cliente.

**El juicio, en una línea:** los que acercan dinero son **F1, F4, F5 y F7**, más **encender Z4**. **F2 no
es opcional**: es la puerta de 2027. Todo lo demás, después.

---

## 8 · La firma de Holded, recorrida por dentro (20-sep-2026)

**Medido el 20-sep-2026 a las 13:26:07Z (hora de GitHub) sobre `origin/main` =
`f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4`.** Misma cuenta de prueba del 17-sep, en el navegador que
sigue vivo. **Solo lectura: no se activó ni se desactivó ningún ajuste, no se guardó nada y no se
envió ningún documento a firmar.**

**Resuelve la ❓ de §7.0, y la resuelve al revés de lo que parecía:** Holded **sí** pide la firma de un
presupuesto. Lo que faltaba no era la función: era la pantalla donde se enciende.

### 8.1 · Dónde estaba, y por qué no aparecía en ninguna parte

`Configuración > CRM > Firma digital` (`app.holded.com/home#settings:/crm/settings/digitalsignature`):
*«Elige qué documentos podrán firmarse online de forma rápida y segura.»* Cinco interruptores, con el
estado leído del DOM —no de una captura— en esta cuenta, con la gema ya activada desde el 18-sep:

| interruptor | estado |
|---|---|
| Presupuestos | `false` |
| Facturas | `false` |
| Proformas | `false` |
| Pedidos de venta | `false` |
| Albaranes de venta | `false` |
| Utilizar la fecha de expiración predeterminada | `false` |

    node interruptores.mjs "app.holded"   → POBLACION interruptores=6 · los 6 en estado=false

**Los cinco tipos nacen apagados.** Por eso el 18-sep no había rastro de la firma en el presupuesto, ni
en su modal de envío, ni en el portal: la gema estaba puesta y el tipo de documento, no.

    🔒 Un producto que nace apagado se mide igual que un producto que no lo tiene, si solo se mira la
       pantalla donde se usaría.

La misma pantalla fija la caducidad: **«Días para que expire la firma»** con 1 / 2 / 7 / 15 / 30 días.

### 8.2 · Las tres pantallas, vueltas a medir hoy, con población y suelo

| dónde | bloques con «firma» | suelo: la misma búsqueda que SÍ encuentra |
|---|---|---|
| Panel del presupuesto `E260001` | **0** · 3 marcos, 2.100 nodos | «Convertir» → **5** bloques |
| Modal «Enviar vía email» del presupuesto | **0** · 3 marcos | «Enviar desde Holded» → **1** bloque |
| Portal del cliente del presupuesto | **0** · 1 marco, 644 nodos | «Aceptar presupuesto» → **1** bloque |

El patrón va **anclado a palabra** (`\b(firma|firmar|firmado|firmante|firmas)\b`) porque **«Confirmar»
contiene «firmar»**: sin el ancla, el barrido devuelve falsos positivos en todas las pantallas de
Holded, que tienen un botón «Confirmar» en casi todas.

### 8.3 · Un defecto de su producto que se ve desde fuera

El módulo **Firma digital** está vacío, y su único botón —el del estado vacío,
`data-ref="digital_signature-no_rows_overlay-cta"`, rotulado **«Enviar documento»**— lleva a
**Facturas de venta**. Medido dos veces, el 18-sep y el 20-sep.

Y ahí hay una contradicción entre sus dos fuentes propias, las dos leídas hoy:

- su **ayuda** (`help.holded.com/es/articles/10900972`) enumera como firmables *Presupuestos, Facturas
  proforma, Pedidos de venta y Albaranes de venta* — **las facturas de venta no están**;
- su **pantalla de ajustes** ofrece un interruptor **«Facturas»** además de «Proformas».

No se resuelve desde fuera cuál manda, y no se resuelve aquí. *Lectura de la Sesión 0, no medición:*
el único camino que su producto le ofrece a quien estrena la firma desemboca justo en el tipo de
documento cuya firmabilidad se contradicen ellos mismos.

### 8.4 · Su ficha de producto, literal (Holded Store, dentro de la app)

> «Permite que tus clientes firmen **presupuestos, albaranes y otros documentos desde el Portal del
> Cliente**, sin necesidad de herramientas externas. Controla el estado de cada solicitud con un
> registro detallado de actividad. La firma se añadirá automáticamente al documento PDF y ambas partes
> recibirán una notificación por email al completarse el proceso.
> **(Por ahora, solo podrás enviar documentos para que te los firmen, no podrás firmarlos tú mismo).**»
>
> Registro detallado de firmas y control de estados y versiones firmadas · **Envío a múltiples
> destinatarios (firma única)** · Avisos y notificaciones automáticas por email · Firmas gratis de tus
> clientes a través del Portal del cliente, **según tu plan**.

Precio **Gratis**, desarrollador Holded, tags *Facturación* y *CRM*. Esa frase —«desde el Portal del
Cliente»— es la que mandó a mirar en el sitio correcto: estaba en la Store, no en el documento.

### 8.5 · Cupos, estados, permisos y qué clase de firma es

De su ayuda, leída hoy en el navegador (no con `WebFetch`). Los cupos ya estaban en §4 por su web
pública y **hoy se confirman sin cambio**; lo nuevo son los estados y los permisos:

- **Estados de una firma:** Pendiente · Firmado · Expirado · Cancelado · No requiere firma.
- **Cupo mensual por plan:** Freelance PRO 5 · Básico 20 · Estándar 50 · Avanzado 100 · Premium 400
  firmas/mes. *«Una vez alcanzado el límite mensual, no podrás solicitar nuevas firmas hasta el
  siguiente periodo.»*
- **Permisos:** hace falta ser **miembro CRM** o tener un **rol personalizado** con ese apartado.
- **Qué firma es, en sus palabras:** *«La firma digital se basa en evidencias electrónicas como el
  correo electrónico del firmante, la dirección IP, el hash del documento y la fecha y hora de la
  firma. Estas evidencias permiten demostrar el acuerdo entre las partes, aunque **no equivale a una
  firma electrónica cualificada**.»*
- **Varios firmantes:** sí, *«Puedes añadir varios firmantes al enviar el documento»*.

⛔ Todo esto **se anota, no se valida**: es lo que ellos dicen de su producto.

### 8.6 · Qué deja para decidir

1. **Su firma es de evidencias y lo dicen por escrito** (correo, IP, hash, fecha y hora), igual familia
   que la nuestra. No es una ventaja suya ni nuestra: es el suelo del mercado, y quien lo cuente mejor
   gana. ⛔ Cualquier frase que YaQu escriba sobre esto es texto que ve el usuario y va con firma.
2. **Racionar por cupo en vez de capar la función** (ya recogido como M1 en §7.3) tiene aquí su segundo
   caso medido: 5 / 20 / 50 / 100 / 400 firmas al mes. **Si YaQu tiene o no tope de firmas hoy NO se ha
   medido en esta entrega**, y hasta que se mida no se afirma.
3. **Nacer apagado tiene un precio.** Su gema se instala, no se ve nada, y el único botón que ofrece
   lleva al sitio equivocado. Es el mismo riesgo que corre YaQu con todo lo que está construido y
   detrás de una bandera (§7.1).

### 8.7 · Lo que NO se midió, y por qué

- 🔴 **El flujo de petición sigue sin recorrerse**: cómo se elige al firmante, qué ve el cliente en el
  portal, qué email le llega y cómo queda el PDF. Para verlo hay que **encender el interruptor de
  Presupuestos**, y eso es **escribir** en la cuenta: lo que el fundador autorizó el 17-sep fue el
  **alta**, no la configuración, y las autorizaciones **no se heredan entre sesiones** (A19). Queda
  pedido por el canal y no se hizo. La ❓ de §7.0 está resuelta —la función existe y se sabe dónde
  vive—; lo que queda abierto es distinto y más pequeño: **cómo es por dentro la petición**.
  - *(20-sep-2026, unas horas después: **el fundador dio el GO y el interruptor se encendió**. Lo que
    se midió con él encendido está en §9, y el flujo de petición **sigue sin recorrerse**, ahora por
    otro motivo.)*
- No se envió ningún documento a firmar, ni se pulsó nada que mandara un correo.
- Cupos, estados y permisos son **su ayuda**, no están comprobados en la cuenta.
- De la tabla «Permisos necesario según el rol» solo se leyeron las dos etiquetas («miembro CRM»,
  «rol personalizado»); el detalle de la tabla no llegó a renderizarse.
- La cuenta de prueba marcaba **2 / 14 días** el 20-sep: caduca sola a primeros de octubre, y con ella
  la posibilidad de recorrer lo de arriba sin un alta nueva.

---

## 9 · Con la firma de presupuestos ENCENDIDA (20-sep-2026, con GO del fundador)

**Medido el 20-sep-2026 sobre `origin/main` = `d17825645813deb7406d8c6cc3fdd7f3a06e1657`.** Continúa el
§8 y **no lo repite**.

**La autorización, y sus condiciones.** El fundador dio el GO, literal: *«autorizo encender la firma de
presupuestos en Holded mientras sea gratis»*, con la condición dura de **parar en cuanto apareciera un
precio, un plan, un "mejora tu plan", una tarjeta o un aviso de créditos**; más cuatro del orquestador:
solo ese interruptor, cualquier correo a una dirección nuestra, no tocar nada más de la configuración
(nadie sabe la contraseña de esa cuenta) y dejarlo como estaba al terminar. ⚠️ **Ese GO fue para esa
sesión y no se hereda** (A19).

### 9.1 · El cambio, medido antes y después

| interruptor | antes | después |
|---|---|---|
| **Presupuestos** | `false` | **`true`** |
| Facturas | `false` | `false` |
| Proformas | `false` | `false` |
| Pedidos de venta | `false` | `false` |
| Albaranes de venta | `false` | `false` |
| Utilizar la fecha de expiración predeterminada | `false` | `false` |

El pulsador **comprueba la etiqueta del índice antes de tocar y aborta si no coincide**, y compara los
seis estados: `CAMBIARON: 0`, es decir **exactamente el que se pulsó y ninguno más**.

**No apareció nada de pago.** Se buscaron precio, plan, «mejora tu plan», tarjeta y créditos: lo único
que sale es el banner de prueba que ya estaba antes (**2 / 14 días**). No hubo que parar.

🔴 **Y una trampa que vale para toda la casa:** al guardar, la pantalla mostró *«La petición está
tardando más de lo esperado — recargar la página — contactar con nosotros»*… **y había guardado
igual**. Se comprobó recargando la página entera: `Presupuestos = true`, los otros cuatro en `false`.

    🔒 Un mensaje de error tampoco es una medición: dice que algo tardó, no que algo no pasara.

### 9.2 · Lo que NO cambió al encenderlo

- **El panel del presupuesto sigue con 0 bloques de firma**, y no por caché: se midió tras **recargar
  el documento entero** (3 marcos, 2.100 nodos).
- **El portal del cliente sigue exactamente igual**: «Aceptar presupuesto» y «Rechazar presupuesto», y
  nada más (587 nodos, el suelo los ve en los clicables). **Encender el tipo de documento no pone por
  sí solo el botón de firma en el portal**: hace falta pedir la firma de ESE documento, una a una.
- 🔴 **Tercera medición del mismo defecto:** con **Presupuestos ENCENDIDO** y **Facturas APAGADO**, el
  único botón del módulo de Firma digital (`data-ref="digital_signature-no_rows_overlay-cta"`) **sigue
  llevando a Facturas de venta**. La ruta no depende de la configuración: está clavada.

### 9.3 · Tres fuentes suyas que no concuerdan entre sí

Las tres medidas, ninguna deducida:

| fuente | qué dice de los documentos firmables |
|---|---|
| **Ficha de la Store**, dentro de la app | «presupuestos, **albaranes** y otros documentos desde el Portal del Cliente» |
| **Ayuda**, artículo `10900972` | Presupuestos · Facturas **proforma** · Pedidos de venta · Albaranes de venta — **las facturas de venta NO** |
| **Pantalla de ajustes**, en la propia cuenta | Presupuestos · **Facturas** · Proformas · Pedidos de venta · Albaranes de venta |

Y una cuarta, sobre el portal: el artículo `9382835`, *«Acciones disponibles en el Portal del
cliente»*, enumera **nueve** acciones del cliente —resumen, pagos, aceptar presupuestos, descargar,
comentar, catálogo, pedidos, contraseña e idioma— y **firmar no está entre ellas**.

*Lectura de la Sesión 0, no medición:* no es que a Holded le falte la firma. **La tiene y está a medio
montar**: nace apagada, su único atajo lleva al sitio equivocado y sus propias fuentes no se ponen de
acuerdo en qué se puede firmar. Para la decisión de producto eso importa más que la lista de
funciones: es la diferencia entre «lo tienen» y «les funciona».

### 9.4 · Dónde se paró, y por qué

Todo apunta a que la petición de firma sale de la **caja de envío del documento**. **Ese clic no se
hizo.** No lo impidió Holded: lo impide el **clasificador de permisos de la máquina del equipo**, que
bloquea cualquier interacción con un control de envío de una aplicación de facturación de terceros. Se
intentó por dos vías legítimas —el botón de correo y el desplegable de acciones, que solo abre un
menú— y bloqueó las dos. **No se buscó la vuelta**, y esa es la conducta correcta: el guard existe
justo para esto.

Para cerrarlo hacen falta dos cosas, y las decide un jefe: permitir **ese** clic, y saber **a qué
dirección iría el correo** antes de abrir la caja (condición 2 del encargo).

Sigue **sin medir**, y por tanto sin afirmarse: cómo se elige al firmante · qué ve el cliente en el
portal · qué correo le llega · cómo queda el documento firmado.

### 9.5 · Cómo queda la cuenta

**El interruptor de Presupuestos se deja ENCENDIDO a propósito**, por decisión del orquestador del
20-sep: el recorrido no terminó, apagarlo obligaría a repetirlo y el cambio es reversible y está
medido. Los otros cuatro siguen apagados. Se apaga en un comando, volviendo a pulsar esa misma casilla
en `Configuración > CRM > Firma digital` y comprobando los seis estados. La cuenta caduca sola a
primeros de octubre.

> 🔴 **TUMBADO unas horas después, el mismo 20-sep (19:20:38Z), al ir a fotografiar esa pantalla.**
> En una pestaña recién abierta, leyendo el DOM y no la imagen, **los seis interruptores están en
> `false`**, Presupuestos incluido:
>
>     node interruptores.mjs "digitalsignature"  → POBLACION interruptores=6 · los 6 en estado=false
>
> Lo confirma la captura [`capturas/holded/caducidad-firma-lista-cerrada.png`](capturas/holded/caducidad-firma-lista-cerrada.png),
> donde los cinco tipos salen apagados. **Nadie lo tocó desde esta casa.** Por qué se apagó no se
> sabe desde aquí y **no se inventa una causa**: el hecho medido es el estado, no el motivo.
> **No se ha vuelto a encender:** la autorización del 20-sep describía un interruptor que ya estaba
> puesto, no daba permiso para ponerlo, y una autorización no se estira (A19).
>
>     🔒 Verificar recargando la página demuestra que se guardó entonces, no que siga guardado después.
>
> Es hermana de la trampa de §9.1 y del aviso de siempre: allí un mensaje de error tapaba un guardado
> que sí ocurrió; aquí una verificación correcta tapa un estado que **dejó** de ser cierto. Las dos se
> arreglan igual: **volver a medir en el momento en que se va a afirmar algo.**

---

## 10 · Lo que se hace con Holded: tres propuestas de producto (20-sep-2026)

**Escrito el 20-sep-2026 a las 19:20:38Z (hora de GitHub) sobre `origin/main` =
`8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`.** Cierra el recorrido de Holded (§4, §6, §7.0, §8, §9).

**Por qué cambia la forma de este documento.** Hasta aquí las entregas de competencia eran
mediciones: matrices, celdas y suelos. El fundador dijo el 20-sep que *la consultoría no está
sacando cosas reales que cambiar*, y tenía razón: una matriz dice cómo está el mercado, no qué
construir el lunes. A partir de §10 el entregable de una pasada es un puñado de **propuestas
concretas**, con esta forma: *en tal competidor la pantalla X hace esto · nosotros hacemos esto otro ·
el profesional gana esto · se construye así · tamaño*. La medición no desaparece: pasa a ser el
respaldo de cada propuesta, y sigue distinguiendo ❓ de ❌.

🔴 **Y la primera regla de la forma nueva: se mide NUESTRA columna antes de escribir la propuesta.**
De las cinco candidatas que salieron de Holded, **dos murieron al medirnos a nosotros** —las dos
estaban ya construidas— y una tercera se redujo a una décima parte de lo que parecía. Eso está
abajo, en §10.4, porque es el trabajo que más ahorra: *una propuesta de copiar algo que ya tenemos
es exactamente lo que el fundador dice que no le sirve.*

Van ordenadas por **lo que más le cambia el día al profesional**, no por tamaño.
**Los tickets los abre el orquestador**, no esta sesión.

### 10.1 · El portal del cliente, en el mensaje · **MEDIANO**

**En Holded**, el Portal del Cliente es la dirección fija del cliente, no la página de un documento:
su artículo `9382835` enumera **nueve** acciones —resumen, pagos, aceptar presupuestos, descargar,
comentar, catálogo, pedidos, contraseña e idioma— y le enlazan ahí desde cada envío (§7.0).
📷 [`capturas/holded/portal-cliente-nueve-acciones.png`](capturas/holded/portal-cliente-nueve-acciones.png).
La octava —**crear y modificar contraseña**— es la que lo convierte en una dirección suya y no en un
enlace de usar y tirar.

**Nosotros lo tenemos construido, y el cliente NO RECIBE NUNCA EL ENLACE.** Medido:

    git grep -n "/cliente/" origin/main -- src

Las únicas apariciones son el propio portal (`customerPortal.routes.ts`), su declaración de ruta
pública (`publicAccessDeclarations.ts:136-137`) y `customersAdmin.routes.ts:144` —el endpoint
`GET /admin/customers/:id/portal-url`—, más dos comentarios. **Cero en `src/integrations`,
`src/modules/quotes`, `src/modules/jobs` y `src/modules/messaging`**: o sea, en ningún envío.
*Suelo:* la misma búsqueda sí encuentra `${BASE_URL}/albaran/${token}`
(`albaranWhatsApp.service.ts:158`) y `${BASE_URL}/pay/quote/${decisionToken}`
(`sendQuote.service.ts:75`), que **sí** se mandan solos; la búsqueda no está ciega.
Lo único que hay es un botón de **copiar enlace** en la ficha y en la lista de clientes
(`customerDetailView.js:103`, `customersView.js:671`): copiar y pegar, cliente a cliente, a mano.

**El profesional gana:** deja de recibir *«mándame otra vez el presupuesto»*, *«¿cuánto te debo?»*,
*«pásame la factura de junio»* — el WhatsApp que le come la tarde. Y el **«pedir presupuesto nuevo»
que YA está construido** (`POST /cliente/:token/quote-request`) empieza a traerle trabajo: hoy no
puede, porque nadie llega a esa pantalla.

**Se construye así, a grandes rasgos:** `ensurePortalToken` ya existe y el token se genera al crear
el cliente (`customerAdmin.ts:242`). Falta (a) el enlace en el pie del mensaje de WhatsApp del
presupuesto y del albarán, y (b) el mismo enlace en el correo y en la pantalla de «gracias» tras
firmar. ⛔ **STOP del fundador para (a):** es texto de plantilla de Meta y canal nuevo
(regla 28 y tabla J6; spec en `docs/WHATSAPP_TEMPLATES.md`). Si eso frena, **(b) se hace sin tocar
Meta** y ya se nota.

🔴 Y conviene decirlo con todas las letras, porque es el mismo defecto que le medimos a ellos en
§8.3 y §9.2: **un portal que el cliente no recibe está tan apagado como una gema que nace apagada.**

### 10.2 · Que el presupuesto llegue a quien decide · **GRANDE**

**En Holded**, la caja de envío admite varios destinatarios: su ficha de la Store dice *«Envío a
múltiples destinatarios (firma única)»* (§8.4) y su ayuda *«Puedes añadir varios firmantes al enviar
el documento»* (§8.5).
📷 [`capturas/holded/varios-firmantes-ayuda-10900972.png`](capturas/holded/varios-firmantes-ayuda-10900972.png).
⚠️ Esa captura es su **fuente escrita**, no la caja de envío: el clic que la abre sigue bloqueado por
el clasificador de la máquina (§9.4), y no se busca la vuelta.

**Nosotros mandamos el presupuesto a UN número:** `sendQuote.service.ts` construye un `decisionToken`
y lo manda por WhatsApp a un teléfono. En el albarán vamos **por delante de ellos** —
`albaranFirmante.ts` distingue *«el propio cliente»*, *«un familiar o conviviente»*, *«portero o
conserje»*—, pero eso es **quién firma en la puerta**, no a quién se le pide la decisión.

**El profesional gana:** comunidad de vecinos, administrador de fincas, la pareja que decide junta,
la empresa donde el que llama no es el que paga. Hoy el presupuesto muere en el móvil equivocado y
el profesional **no se entera**: solo ve que no le contestan, y no distingue *«no le interesa»* de
*«no le ha llegado»*.

**Se construye así, a grandes rasgos:** un segundo destinatario opcional al enviar, mismo documento y
**un token por destinatario** para saber quién abrió y quién decidió; respeta J6 (tope 3/cliente/día)
y `waOptOut`; el panel enseña «visto por X, decidido por Y». ⛔ **STOP:** canal nuevo (regla 28) y
con toda probabilidad plantilla.

### 10.3 · Caducidad en un toque: 7 / 15 / 30 días · **PEQUEÑO**

**En Holded**, la caducidad de la firma se elige de una **lista cerrada** —1 / 2 / 7 / 15 / 30 días—
en `Configuración > CRM > Firma digital` (§8.1). No se escribe una fecha: se toca un número.
📷 [`capturas/holded/caducidad-firma-lista-cerrada.png`](capturas/holded/caducidad-firma-lista-cerrada.png),
con los cinco valores leídos del DOM: `<select> n=5 actual=«15» · 1 Día | 2 Días | 7 Días | 15 Días | 30 Días`.

🔴 **Y ahí sale un dato nuevo que afina la propuesta: su defecto son 15 días; el nuestro, 30**
(`quotes.routes.ts:223`). No es solo que ellos dejen elegir y nosotros no: es que **arrancan en la
mitad de tiempo**. El defecto es una decisión de producto, y la nuestra empuja al presupuesto que se
enfría.

**Nosotros tenemos la caducidad de verdad y entera**, y eso es lo que hace pequeña esta propuesta:
`validUntil` con defecto de +30 días (`quotes.routes.ts:223`), cron horario `expireQuotes()` que pasa
`sent` → `expired` (`cron.ts:61`, `expire.service.ts`), etiqueta «Caducado» en el panel
(`api.js:1156`) y el cliente viendo *«pide uno actualizado»*. Lo que falta es **solo la pantalla**:
hoy es un `<input type="date">` con la fecha ya puesta a 30 días (`quotesView.js:993`), que se cambia
abriendo un calendario y contando días.

**El profesional gana:** **30 días es mucho para un presupuesto de oficio.** «Caduca el viernes»
cierra ventas; uno que dura un mes se enfría y se pierde. Con tres botones lo pone en 7 días sin
pensarlo.

**Se construye así, a grandes rasgos:** tres chips (7 / 15 / 30) al lado del campo que ya existe, que
escriben en `validInput` llamando a `window.quoteCaducidad.diaPorDefecto(zona, n)` — que **ya está
escrito y ya resuelve la zona del NEGOCIO**, que es la parte difícil de esto y está hecha (SCRUM-633).
Marcar cuál está activo. Sin schema, sin dinero, sin fiscal, sin Meta. Es UI: quien lo haga pasa por
`yaqu-premium-ui` y `DESIGN.md` (Parte AB), y respeta la advertencia del propio fichero — *«los cinco
sitios se arreglan juntos»*— no tocando la regla, solo llamándola.

### 10.4 · Las que murieron al medirnos a nosotros

Se dejan escritas porque el ahorro está aquí, y porque la próxima pasada empieza por este paso:

| candidata, salida de Holded | qué la mató |
|---|---|
| «Copiar la caducidad del presupuesto» | **Ya la tenemos entera**, cron y estado incluidos. Quedó reducida a §10.3, que es solo la pantalla: de un módulo a tres botones. |
| «Hacer un portal del cliente como el suyo» | **Ya está hecho** (`/cliente/:token`, con contacto, presupuestos, facturas y petición de presupuesto). El problema era otro y más barato: nadie se lo manda. Es §10.1. |
| «Racionar las firmas por cupo, 5/20/50/100/400» (M1 de §7.3) | No es de producto sino de precio, y **no le cambia el día a nadie**. Sigue viva como palanca comercial en §7.3; no se asciende a propuesta. |

    🔒 Medir su producto dice qué existe en el mercado. Medir el nuestro dice qué hay que construir.
       Sin lo segundo, la mitad de las propuestas son cosas que ya están hechas.

### 10.5 · Lo que de Holded NO hemos recorrido, y si daría propuesta

Pedido por el orquestador para decidir **con la lista delante** si se vuelve a Holded o se pasa a
Jobber. Junta lo que ya estaba disperso en §6 y §8.7, y dice de cada cosa si podría dar propuesta.

| # | lo que queda sin recorrer | por qué no se hizo | ¿daría propuesta? |
|---|---|---|---|
| 1 | **La caja de envío del documento** (a quién se manda, varios destinatarios, qué correo sale) | El clic lo bloquea el clasificador de la máquina (§9.4) | **Sí, y es la única gorda.** Es el respaldo directo de §10.2 |
| 2 | **El recorrido de la firma de punta a punta**: elegir firmante, qué ve el cliente, qué email llega, cómo queda el PDF | Depende de la 1 | Sí, pero **refina** §10.1 y §10.2; no abre una propuesta nueva |
| 3 | **Su escáner de gastos con OCR** por subida, por email a `@holdedbox.com` y por foto | Nunca se entró: exige subir un documento real | **Sí, y es de las buenas.** Es F1 de §7.2, el hueco más grande, y nadie lo ha visto por dentro |
| 4 | **Sus facturas recurrentes** por dentro | No se entró | Sí, pero F3 ya está decidida y va detrás de SIF-1 |
| 5 | **Su app móvil nativa** (fichaje, foto de gasto, Wallet) | Hace falta instalarla en un teléfono | Quizá; es el terreno donde defendemos la PWA |
| 6 | **Su Portal del Cliente de cuenta**, entrando como cliente con contraseña | Haría falta un segundo usuario | Refina §10.1; lo esencial ya está en su artículo `9382835`, que sí se leyó y fotografió |
| 7 | **Emitir una factura de verdad** y ver QR, VFAC y envío a la AEAT | ⛔ **A propósito, y no se hará**: exigiría declarar otra cosa y mandar registros reales a Hacienda | **No.** Y es la decisión correcta |
| 8 | **La tabla «Permisos necesario según el rol»** completa | No llegó a renderizarse (§8.7) | No |
| 9 | **Recordatorios automáticos de impago** (gema gratuita, solo Avanzado y Premium) | Plan de prueba sin esa gema | Puede que sí, y toca J6 (anti-spam) de lleno |
| 10 | **Sus cupos de verdad** (que 5 firmas/mes sean 5) | Solo tenemos su ayuda, no la cuenta llena | No: es su precio, no nuestro producto |

**El juicio de la Sesión 0, en una línea:** de las diez, **solo dos darían propuesta nueva** —la caja
de envío (1, bloqueada por permisos, no por Holded) y **su escáner de gastos (3)**—; las demás refinan
lo que ya está escrito o son suyas, no nuestras. Y la cuenta **caduca sola a primeros de octubre**, así
que si se vuelve, se vuelve por la 3.

---

## 11 · Su escáner de gastos, por dentro · tres propuestas más (20-sep-2026)

**Medido el 20-sep-2026 sobre `origin/main` = `8f63a2c5da10daf7d368d1ec781cf56e67268c8b`.** Encargo del
orquestador, acotado a una hora: era una de las dos filas de §10.5 que podían dar propuesta nueva, y
la que más toca a tres tickets vivos (la lectura del ticket con IA, las fotos reales y el rediseño de
Gastos). **Solo lectura: no se subió ningún documento, no se tocó ningún ajuste.**

Su escáner vive en `Compras > Escáner`, que por dentro es la ruta **`/inbox`** (el nombre comercial y
el nombre real no coinciden, y por eso `app.holded.com/purchases/scanner` da su 404).
📷 [`capturas/holded/escaner-inbox-por-dentro.png`](capturas/holded/escaner-inbox-por-dentro.png) —
nadie lo había visto por dentro hasta hoy.

### 11.1 · Lo que se ve en su pantalla, y no estaba escrito en ninguna parte

- **La dirección de correo del buzón preside la pantalla**, al lado del título y no enterrada en
  ajustes: `luislara@holdedbox.com`.
- Arriba, un triaje de tres contadores: **Nuevos · Pendientes de revisar · Errores**.
- Botones **Historial**, **Subir archivo** y engranaje de configuración.
- Zona de arrastre: *«Los formatos soportados son PDF, PNG y JPEG de hasta 20MB»*.
- Dos caminos rotulados abajo: *«Recibe los gastos en tu Mailbox»* y *«Sube un archivo desde tu
  dispositivo»*.

🔴 **Y una quinta fuente suya que no concuerda** (van cinco, contando las cuatro de §9.3): la pantalla
dice **PDF, PNG y JPEG hasta 20 MB**; su ayuda dice **PDF, JPEG, TIFF y PNG**, con **5 MB** por subida
manual y **17 MB** por correo. Ni los formatos ni el tamaño coinciden. No se resuelve desde fuera cuál
manda, y no se resuelve aquí.

### 11.2 · Su flujo, en sus palabras

De `help.holded.com/es/articles/6908098`, leído en el navegador. 📷
[`capturas/holded/escaner-estados-del-documento.png`](capturas/holded/escaner-estados-del-documento.png)
y [`capturas/holded/escaner-borrador-solo-si-hay-confianza.png`](capturas/holded/escaner-borrador-solo-si-hay-confianza.png).

- **Tres puertas de entrada:** subida manual · **correo a un buzón `@holdedbox.com`** (20 ficheros por
  correo) · **foto desde la app móvil**, y solo ésta *«estarán certificados por la AEAT, y no será
  necesario conservar sus copias físicas»*. Más una cuarta: **Holded-to-Holded**, si tu proveedor
  también usa Holded te manda el documento directo al Inbox.
- **Qué extrae el OCR:** *«los datos principales (emisor, importe, fecha, impuestos)»*. Cuatro.
- **Cinco estados:** Procesando · **Revisar** · Hecho · Error · **Descartado**, este último *«el
  sistema ha detectado que el archivo no es un documento válido (por ejemplo, un logo o una imagen de
  un email) y lo ha excluido automáticamente. No requiere ninguna acción»*.
- **Dos pestañas:** Bandeja de entrada (lo pendiente) e **Historial**, *«el registro completo de todo
  lo que ha entrado»*.
- **La puerta de la confianza:** *«los documentos escaneados se generarán automáticamente como
  borradores **siempre que el sistema no detecte inconsistencias y tenga un alto nivel de confianza en
  la lectura**»*.
- **Cupo:** *«El número de escaneos automáticos disponibles al año es ilimitado en cada plan.»*

### 11.3 · Nuestra columna, medida hoy (y aquí gana YaQu, que también hay que decirlo)

`SCRUM-912` ya está en main: `src/modules/expenses/domain/lecturaTicket.ts` y
`POST /admin/expenses/leer-ticket`.

**Lo nuestro extrae ONCE campos donde ellos documentan cuatro:** `concept`, `amount`, `baseAmount`,
`vatRate`, `vatAmount`, `date`, `providerInvoiceDate`, `providerInvoiceNumber`, `proveedorNombre`,
`nifProveedor` y `providerId`. Y **descarta campo a campo con motivo medido** —`no_es_numero`,
`fuera_de_rango`, `tipo_iva_no_admitido`, **`no_cuadra_con_el_total`**, `fecha_invalida`,
`fecha_futura`, `nif_invalido`, `demasiado_largo`, `no_es_texto`—, que es una comprobación aritmética
de verdad y no un «nivel de confianza» sin enseñar. El proveedor **solo** se propone si el NIF casa
con uno, no por nombre.

    🔒 No todo lo que se mide de la competencia es un hueco. Aquí el motor nuestro es mejor que el
       suyo documentado, y decirlo evita reconstruir lo que ya está bien.

**Lo que sí nos falta, medido:**

| qué | cómo se midió |
|---|---|
| **Solo hay UNA puerta**, y es el panel autenticado | `POST /leer-ticket` es la única ruta de entrada de `expenses.routes.ts` |
| **No hay bandeja ni historial de lo que entra** | `git grep -i -E "bandeja\|inbox" -- src/modules/expenses prisma/schema.prisma` → solo un comentario de otra cosa (SCRUM-69) |
| **Tope de 5 lecturas al día** frente a su «ilimitado en cada plan» | `lecturaTicket.ts` · `LECTURAS_TICKET_POR_DIA = 5` |

🔴 **Y un hecho que hay que decir con su suelo, porque es de los que ve el profesional:** hoy
**ninguna pantalla llama a esa lectura**. `git grep "leer-ticket" -- public` → **0**. *Suelo:* la misma
cadena aparece en **nueve** ficheros del árbol (la ruta, `adminRouteDeclarations.ts`, su test
`scrum912-leer-ticket-gasto.test.mjs`, su expediente…), así que la búsqueda no está ciega; y buscar
`ticket` en el panel junto a `apiRequest`/`fetch` da **0**. No se afirma que sea un defecto —puede ser
el reparto deliberado entre SCRUM-912 (motor) y SCRUM-920 (pantalla)—, pero **mientras siga así, la
lectura del ticket no existe para el profesional**, que es el tercer caso hoy de lo mismo que se le
midió a Holded en §8.3 y a nosotros en §10.1.

*(Comprobado antes de decirlo, y casi me cuela un falso hallazgo: el menú de Gastos se oculta en
`app.js`, pero **solo para los técnicos** y a propósito —SCRUM-107, la lista completa y los márgenes
son economía del negocio—. El admin lo ve. Un `style.display='none'` sin leer su `if` de arriba
habría sido un defecto inventado.)*

### 11.4 · Las tres propuestas

Ordenadas por lo que más le cambia el día al electricista.

#### 11.4.1 · El gasto entra por WhatsApp, como todo lo demás · **MEDIANO**

**En Holded**, la pantalla del escáner tiene **su propia dirección de correo presidiéndola**
(`…@holdedbox.com`): el profesional —o directamente su proveedor— reenvía la factura ahí y el gasto
aparece solo, sin abrir la aplicación.

**Nosotros tenemos una sola puerta y obliga a sentarse delante del panel:** `POST /leer-ticket` es una
ruta autenticada del dashboard.

**El profesional gana:** el albarán del almacén a las 7 de la mañana, la factura del mayorista que
llega por correo, el ticket de gasolina en la gasolinera. Hoy todo eso **espera a que se siente**, y
lo que espera se pierde: el papel se queda en la furgoneta, que es justo el problema que el OCR venía
a resolver. Y nuestro canal ya existe y ya es el bueno: **le hace la foto al ticket y la manda al
mismo WhatsApp por el que manda los presupuestos.**

**Se construye así, a grandes rasgos:** el webhook de WhatsApp ya recibe mensajes
(`src/integrations/whatsapp.ts`); enrutar una **imagen entrante** desde el número de un merchant a
`leerTicket`, guardar el resultado como **gasto propuesto pendiente de confirmar** y contestar con el
resumen y un botón de confirmar. El motor, los once campos y los descartes **ya están escritos**: lo
nuevo es la puerta. ⛔ **STOP:** canal nuevo (regla 28, tabla J6, tope 3/cliente/día) y muy
probablemente plantilla de Meta.

#### 11.4.2 · La bandeja: que no se pierda nada de lo que entra · **GRANDE**

**En Holded**, todo lo que entra vive en dos pestañas —**Bandeja de entrada** e **Historial**, *«el
registro completo de todo lo que ha entrado»*— con cinco estados y tres contadores arriba. Lo que el
OCR no entiende no desaparece: se queda en **Revisar**, o el sistema lo marca **Descartado** él solo
cuando ve que no es un documento (*«un logo o una imagen de un email»*).

**Nosotros no tenemos bandeja ni historial de entradas.** Una lectura que sale mal es una respuesta de
error y se acabó: no queda rastro, no hay a dónde volver, y el ticket de papel ya se ha tirado.

**El profesional gana:** dejar de tener que acordarse. Hace la foto, y si la lectura no sale, el gasto
sigue ahí esperando en vez de evaporarse. Es lo que convierte «probé el OCR una vez» en «meto todos
mis gastos aquí».

**Se construye así, a grandes rasgos:** un modelo de **documento entrante** con su estado
(`procesando` / `revisar` / `hecho` / `error` / `descartado`), la imagen guardada, y la propuesta de
`leerTicket` colgando de él; una pantalla con los pendientes y su historial. ⛔ **Esquema: ALTER
antes**, y la foto pesa — enlaza con lo que ya está abierto sobre las fotos reales y el peso de la
lista de Gastos.

#### 11.4.3 · Decir por qué un campo vino vacío · **PEQUEÑO**

**En Holded**, cuando el OCR no se fía no rellena y lo dice con un estado: **Revisar**, y el
automatismo solo crea el borrador *«siempre que el sistema no detecte inconsistencias y tenga un alto
nivel de confianza»*. El profesional sabe que hay algo que mirar.

**Nosotros calculamos algo bastante mejor que eso y lo tiramos:** `sanearLectura` devuelve
`Descartado { campo, motivo }` con nueve motivos, incluido **`no_cuadra_con_el_total`**, que es una
comprobación aritmética real. Hoy eso no llega a ninguna pantalla.

**El profesional gana:** la diferencia entre un hueco en blanco —que le obliga a coger el ticket otra
vez y teclear— y una línea que dice *«el IVA que leí no cuadraba con el total»* o *«la fecha salía en
el futuro»*. Lo segundo se corrige en cinco segundos y **enseña a hacer mejor la foto**.

**Se construye así, a grandes rasgos:** pasar los `Descartado` a la respuesta —si no van ya— y pintar
el motivo junto al campo vacío, con el texto en `es-ES` de los nueve motivos. Sin schema, sin dinero,
sin fiscal, sin Meta. 🔴 **Es pequeño HOY porque la pantalla de Gastos se está construyendo justo
ahora**: entra como un requisito de ese diseño. Cuando la pantalla esté hecha, añadirlo cuesta el
doble.

### 11.5 · Lo que NO se midió de su escáner, y por qué

**No se subió ningún documento.** Por tanto **no se ha visto** el OCR leyendo de verdad: ni su
precisión, ni la pantalla de revisión campo a campo, ni qué hace exactamente con una foto mala, ni el
Historial con filas dentro (los tres contadores estaban a cero). Lo de §11.2 es **su ayuda**, no su
comportamiento observado, y así queda marcado. Subir un ticket de verdad sería meter un documento
nuestro en un producto de terceros, y eso lo decide el fundador, no esta sesión.

---

## Cola de competidores

Uno por entrega, avisando al orquestador al acabar cada uno.

**Hechos:** Verifacturamos ✅ · Holded ✅ (público **y por dentro**) · Quipu ✅
**Pendientes:** Anfix · Billin · Contasimple · FacturaDirecta · Sage (Active o 50) · Odoo ·
Jobber · Tradify · Fergus · ServiceM8 · Housecall Pro.
**Excluidos por decisión del orquestador:** STEL Order y Fixner — sus términos **prohíben
expresamente** usar el producto para competir (cláusula «Uso limitado», recogida en
`docs/master/SCRUM-906.md` §2).

Los tickets de «lo que no tenemos» **los abre el orquestador**, no esta sesión.
