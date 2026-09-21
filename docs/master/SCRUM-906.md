# SCRUM-906 · La competencia: FASE 1, benchmark público

**Medido contra:** `origin/main` = `f3ab211d54fb4b04129498985b6a78079cf78448` · 2026-09-17T10:14:49Z
**Rama:** `scrum-906-benchmark-publico` · **Carril:** consultoría (Sesión 0) · **Encargo:** orquestador, 17-sep-2026 13:35 CEST
**Estado:** FASE 1 (fuentes públicas) entregada. La **FASE 2** está **EMPEZADA por fuera**: ver §5 al final y el documento vivo [`docs/competencia/matriz.md`](../competencia/matriz.md). Entrar por dentro con cuentas de prueba sigue teniendo **gate del fundador** y NO se ha hecho.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`). Webs leídas el 17-sep-2026; el código de YaQu se midió sobre el commit de arriba.

## Población y método

- **8 competidores:** Holded, STEL Order, Verifacturamos (el nombre existe tal cual: verifacturamos.com), Contasimple, Fixner, AppSat, Plenia y PresupuestAPP.
- **Unas 96 páginas abiertas**, entre webs, precios, ayuda, novedades, términos legales y reseñas en Capterra, Trustpilot y App Store.
- **12 que no pude mirar:**
  - el alta de Holded, de Verifacturamos y de STEL;
  - la ayuda de STEL (403);
  - G2 de Holded (403);
  - Google Play de Fixner, AppSat y STEL (llegó vacío o cortado);
  - la cuota base de Fixner, que no se ve en la web;
  - los precios de AppSat (404);
  - el changelog de Verifacturamos y el de Contasimple.
- **Tres subagentes** leyeron las webs; yo repasé sus informes y volví a leer a mano las 2 cláusulas contra la competencia y la web de PresupuestAPP.
- ⚠️ **WebFetch no devuelve la página, sino el resumen de un modelo pequeño**, y ese resumen inventó 3 cosas que al pedir la frase exacta no aparecían: el «Bizum/Stripe» y la «firma del cliente» de Contasimple, y un formulario de alta de Verifacturamos. Lo que digan las cláusulas debe comprobarlo una persona antes de apoyarse en ello.
- **YaQu** está medido en el código: los 31 modelos de `prisma/schema.prisma`, `src/` y `public/dashboard/js/`, unas 40 comprobaciones. No en staging, salvo lo visto hoy en #1880.
- **Candidatos descartados o sin mirar:**
  - Workeo: no hay producto con ese nombre.
  - Geinfor: es un ERP industrial.
  - Fieldeas: empresa grande.
  - Vendomia y Afer: genéricos.
  - Obralia, Zeus, Gextor, Sage, Quipu, Billin, Presu.app, Motor de Presupuestos y Presux: no mirados.
- 🔴 **SUELO:** «no pude mirar» ≠ «no lo tienen».
- ⛔ **Fiscal:** lo que dicen de VeriFactu se ANOTA, no se valida ni se promete (regla 17, guion H2).

## 1 · Parte Z del máster: qué sigue siendo cierto

| Z dice | Hoy |
|---|---|
| **Z2:** Reseñas de Google al cobrar, «candidata fuerte a U2» | **Obsoleto: YA ESTÁ HECHO** (SCRUM-590). Tras el cobro se manda el enlace de reseña: `psp.routes.ts:285`, `mpWebhook.routes.ts:202`. |
| **Z2:** IA voz/foto → presupuesto (VOZ-1, MEDIA-1) | **A medias.** La voz existe con el flag apagado (`flags.ts:24` VOICE_QUOTE_ENABLED=false; `:29` VOICE_ALBARAN_ENABLED=false). Hay fotos (`Attachment kind=photo`, para `quote_request\|job`); audio «F2». |
| **Z2:** Recordatorios de cobro J1 ✅ | **Cierto.** `cron.ts:58`: presupuestos cada hora; `cron.ts:73`: facturas a diario a las 10:00. |
| **Z2:** Mantenimientos RITE (MANT-1, F2) | **Construido y APAGADO.** `MaintenancePlan` más cron diario que propone un presupuesto al profesional por WhatsApp; `flags.ts:37` MAINTENANCE_ENABLED=false. Ya no es «F2 por construir». |
| **Z2:** Banco de precios por gremio | **A medias.** Existen los catálogos por gremio (`src/core/data/tradeCatalogs.ts`); el «cobran 23 % más» no. |
| **Z2:** Factoring, BNPL, scoring de morosos, tarjeta del merchant | **Cierto** que no hay nada (0 resultados en el código). |
| **Z3:** PresupuestAPP, «el más directo y más barato (9,99 €)» | **Cierto y ha crecido.** Plan gratis permanente, 5 planes (0 / 9,99 / 15,99 / 22,99 / 34,99 €) con tope de presupuestos al mes. Añade red profesional para captar clientes, previsión de tesorería, inventario de materiales y 8 idiomas (presupuesta.eu). |
| **Z3:** STEL Order, «WhatsApp + tarjeta + VeriFactu certificado, ERP pesado» | **Cierto en lo de pesado.** Lite 24 / Business 36 / Pro 60 €/mes más usuario extra. Hoy tiene además plan Free, asistente IA, TPV, fichaje (Tempo) y changelog mensual. Dicen «homologados», no «certificado». WhatsApp no lo vi en esta pasada. |
| **Z3:** Holded/Quipu, «VeriFactu no operativo en producción (feb-2026)» | **Obsoleto para Holded.** Afirma envío automático, QR y certificado ofrecido por ellos (holded.com/es/programa-facturacion-verifactu). Una reseña de marzo de 2026 en Capterra describe un fallo en el XML. No validado. Quipu no lo miré. |
| **Z3:** Presu.app, Motor de Presupuestos, Presux | No mirados. |
| **Nuevos que Z3 no tiene** | **Fixner y AppSat** (servicio técnico e instaladores). **Plenia** (autónomo de oficio a 5,99 €, con firma, cobro con Bizum y tickets por IA; en beta cerrada). **Verifacturamos** (9 €/mes, solo facturación VeriFactu). **Contasimple** (gratis). |

## 2 · Prueba gratis, alta y cláusula contra la competencia (para SCRUM-906)

| Competidor | Prueba | Qué pide para el alta | ¿Prohíbe usarlo para competir? |
|---|---|---|---|
| **STEL Order** | Plan Free permanente y garantía de 30 días (stelorder.com/precio/) | **no pude mirar** | **SÍ, expresamente.** Cláusula 1 «Uso limitado»: «El Cliente no usará el Servicio para desarrollar, apoyar, crear u ofrecer precios para ningún producto o servicio que compita directamente con el Servicio.» Última modificación: 30-jun-2026. https://www.stelorder.com/terminos-de-uso-stel-order/ (leída por mí) |
| **Fixner** | 15 días | Empresa, nombre, apellidos, email; sin tarjeta, CIF ni teléfono (fixner.com/registro) | **SÍ, expresamente.** «Uso limitado», con la misma frase y además «…o que pueda crear un sustituto funcional». v1.2, 07-feb-2026. https://www.fixner.com/terminos-y-condiciones (leída por mí) |
| **Holded** | 14 días, sin tarjeta | Nombre legal, email, contraseña y datos de empresa | No encontrada de forma expresa. §6 prohíbe «ingeniería inversa» y «procesos manuales para controlar o copiar cualquier contenido del Servicio»; §7, «explotar ninguna parte». Es amplia. https://www.holded.com/es/tac (26-feb-2025) |
| **Contasimple** | 30 días de Ultimate y Básico gratis para siempre; sin método de pago | Email y contraseña; los términos exigen nombre real | No encontrada. §8 prohíbe ingeniería inversa y «procesos manuales» para copiar. https://www.contasimple.com/terminos-y-condiciones-del-servicio/ |
| **AppSat** | 30 días | Email, país y aceptar los términos | No encontrada. Cl. 13 prohíbe copiar y hacer ingeniería inversa. https://appsat.net/condiciones-de-uso/ (12-sep-2026) |
| **Verifacturamos** | 20 facturas, sin tarjeta | «Solo tu email y tu NIF» (portada; el formulario no se pudo ver) | No encontrada. §3 prohíbe ingeniería inversa y copiar el software. https://app.verifacturamos.com/terminos |
| **PresupuestAPP** | Gratis para siempre y 15 días de Autónomo, sin tarjeta | Solo email verificado | No encontrada. §7 prohíbe ingeniería inversa; §8.2 prohíbe «crear obras derivadas» y explotar comercialmente. https://presupuesta.eu/aviso-legal |
| **Plenia** | 14 días sin tarjeta; hoy solo lista de espera | Email | No encontrada ninguna. https://plenia.app/legal/terms (4-may-2026) |

**Lectura (no es consejo legal; decide el fundador):** STEL y Fixner lo prohíben por escrito. En los otros seis, mirar el producto choca como mucho con cláusulas amplias («procesos manuales», «obras derivadas»). Todos prohíben la ingeniería inversa.

## 3 · Tabla de huecos

Cómo se lee:
- **YaQu hoy** está medido en el código: sí, a medias o no, con fichero.
- **Para quién:** Of = profesional de oficio, Ofi = oficina, Obra = técnico en obra.
- **Tamaño:** S = días, M = 1-2 semanas, L = 3-6 semanas, XL = más.

| # | Función | Quién la tiene | YaQu hoy | Para | Tam. |
|---|---|---|---|---|---|
| 1 | Trabajar sin conexión: crear y editar parte, albarán y presupuesto en obra | STEL /erp/movilidad/ · Fixner /partes-de-trabajo · AppSat /partes-de-trabajo/ · Holded (app) | **A medias.** Firmar albarán o parte sin red sí (`almacenLocal.js`, `colaDeFirmas.js`, SCRUM-455/890b); crear o editar sin red no lo he medido | Obra | L |
| 2 | Equipos del cliente (marca, modelo, nº de serie, historial, garantía) | STEL /erp/software-sat-servicio-tecnico/ · Fixner /empresas-instaladoras · AppSat /software-de-gestion-de-mantenimiento/ | **No.** No hay modelo en el esquema; «NumSerie» solo aparece en VeriFactu | Obra/Ofi | M |
| 3 | Mantenimientos preventivos con órdenes automáticas y aviso de vencimiento del contrato | AppSat · Fixner · STEL · Plenia | **A medias.** `MaintenancePlan` y cron existen, flag apagado (`flags.ts:37`); no hay contrato con vencimiento | Of | S (encender) / M (contratos) |
| 4 | Lectura con IA de tickets de gasto (proveedor, NIF, base, IVA) | Holded (Básico+) · Contasimple Ultimate · Plenia · Fixner · STEL | **No.** `Expense` tiene `receiptData` y los campos de IVA, pero ningún extractor | Of | M |
| 5 | Fichaje / registro de jornada con ubicación | Holded 1,50 €/emp · STEL Tempo 3,6 €/usr · Fixner +1,25 €/usr · Plenia | **No.** Nada en el esquema | Obra | M |
| 6 | Stock por almacén y furgoneta, descontado desde el parte | STEL · Fixner · Holded (25 €/mes) · Contasimple Ultimate | **No.** Nada en el esquema | Obra/Ofi | L |
| 7 | Compras: pedido a proveedor, albarán de compra, lectura de documentos del proveedor | STEL «Inbox Compras» · Fixner · AppSat +15 € | **No.** `Provider` existe, pero sin pedidos | Ofi | M |
| 8 | Checklists o formularios configurables en el parte | STEL · Fixner · AppSat | **No.** «checklist» solo aparece en el onboarding | Obra | M |
| 9 | Firma reforzada: código OTP y DNI del firmante | Fixner (OTP por SMS) · STEL (DNI) · Holded (firma avanzada eIDAS con cupo) | **A medias.** Firma con evidencias (`fiscal/evidencias/`); el parte guarda nombre y calidad del firmante, sin DNI; OTP no hay | Of | S-M |
| 10 | Facturas recurrentes (cuotas) | Holded · Verifacturamos · Contasimple | **No.** Solo `MaintenancePlan`, que propone presupuestos | Ofi | M ⛔ dinero y fiscal |
| 11 | Envío automático al gestor y acceso gratis de la asesoría | Verifacturamos (email/Drive) · Holded · STEL | **A medias.** Exportación manual (`/datos.zip`, CSV, libros AEAT); roles solo `admin\|tecnico` (schema:1096) | Ofi | S-M |
| 12 | Importar desde otro software, continuando la numeración | Verifacturamos (Holded, Quipu, Anfix, Factusol) | **A medias.** `csvImport.js` (CSV genérico) | Ofi | S-M |
| 13 | Portal del cliente (ver documentos, pagar, pedir) | Holded · STEL Shop · AppSat +20 € | **A medias.** `customerPortal.routes.ts` (ver y pedir presupuesto) y pago de factura por enlace (`/pay/invoice/:token`) | Of | S-M |
| 14 | Roles de oficina y permisos finos | Holded (Avanzado) · STEL · Fixner | **A medias.** Solo `admin\|tecnico` | Ofi | M |
| 15 | Asignación por cercanía, GPS y rutas | STEL Pro · Fixner · AppSat · Plenia | **No** | Ofi | L |
| 16 | Remesas SEPA | STEL Lite · Contasimple | **No** | Ofi | M ⛔ dinero |
| 17 | Conexión con el banco y conciliación automática | Holded (300+ bancos) · Contasimple (módulo) · Fixner | **No.** `Reconciliation` solo casa un `Charge` con `bankRef`; no hay datos del banco | Ofi | XL ⛔ dinero |
| 18 | Modelos 130, 390 y otros | Holded · Contasimple · Plenia (Fiscal Pro) | **A medias.** 303 (`fiscal/modelo303`) y libros AEAT en CSV; 130 y 390 no | Ofi | M ⛔ fiscal |
| 19 | Facturae y FACe (administración pública) | Contasimple · Fixner | **No** | Ofi | M ⛔ fiscal |
| 20 | TicketBAI | Holded · STEL · Plenia (lo afirman) | **No** (Z: cajón F3) | Ofi | L ⛔ fiscal |
| 21 | Importar BC3 (construcción) | STEL (ago-2026) | **No** | Ofi | M |
| 22 | IA que actúa (crear factura, agendar, leer PDF) | STEL Assistant | **A medias.** Líneas sugeridas (`aiQuoteAssistant.js`); voz apagada | Of | L |
| 23 | Previsión de tesorería / cuándo pagará cada cliente | Holded (IA) · PresupuestAPP | **No** | Of | M |
| 24 | API REST, webhooks, Zapier | Holded · Verifacturamos · STEL Pro · Plenia | **No** | Ofi | M |
| 25 | Contabilidad completa y cuentas anuales | Holded Estándar · AppSat +45 € | **No** (Z: «❌ nunca», a revisar con «somos ERP») | Ofi | XL |
| 26 | Nóminas | Holded 5 €/empleado | **No** | Ofi | XL |
| 27 | TPV | Holded · STEL POS · Contasimple | **No** | tienda | XL (poco encaje) |
| — | Recordatorios de cobro escalonados | Holded (solo email) · reseñas de STEL piden que los tenga | **Sí**, por WhatsApp (`cron.ts:58,73`) | Of | — |
| — | Cadena presupuesto → albarán → factura → cobro y margen por obra | Holded · STEL construcción | **Sí** (`jobDocsReparto.js`, `quoteMargen.js`, «Gastos y margen» visto hoy en staging) | Of/Ofi | — |
| — | El cliente firma y paga desde WhatsApp | Ninguno de los 8 lo muestra así (Holded firma por email; STEL firma en el móvil del técnico; Plenia cobra por enlace) | **Sí**: es el foso | Of | — |

## 4 · Top 10, por lo que acerca a clientes pagando

Criterio: qué pesa en la decisión de compra de un oficio pequeño o una pyme con técnicos, qué usa cada semana y qué ya dan por hecho todos los de su precio. Carriles según §11bis.

1. **Encender mantenimientos y añadir contratos con aviso de vencimiento** (fila 3). Ya está construido y apagado; es ingreso recurrente para el cliente y motivo para escribirle. Carril **S1** con **S4** (texto de WhatsApp). ⛔ Encender el flag para todos es STOP del fundador (Parte P).
2. **Lectura con IA de tickets de gasto** (fila 4). La tienen los 5 de su franja, el autónomo la usa cada semana y ya hay integración con Gemini. Carril **S1** (extracción) con **S2** (pantalla).
3. **Parte y albarán completos sin conexión** (fila 1). En obra ya se da por hecho (STEL, Fixner, AppSat). Carril **S4** con **S2**.
4. **Envío automático al gestor y acceso gratis de la asesoría** (fila 11). Quita el «¿y mi gestoría?» y convierte a la gestoría en canal (Parte H). Carril **S1**.
5. **Fichaje / registro de jornada** (fila 5). Es obligación legal para quien tiene empleados y en la competencia se cobra por usuario (1,25-3,6 €). Carril **S1** con **S2**. ⛔ Esquema: ALTER antes.
6. **Equipos del cliente con historial y garantía**, ligados a mantenimientos (fila 2). Es lo que define a un servicio técnico. Carril **S1** (esquema) con **S4** (ficha en el parte). ⛔ Esquema.
7. **Importar desde Holded, Quipu o STEL continuando la numeración** (fila 12). Baja la barrera de cambiarse. Carril **S1**. ⛔ La numeración de serie toca lo fiscal.
8. **Firma reforzada**: OTP por WhatsApp y DNI del firmante (fila 9). Refuerza el foso sin salir de él. Carril **S4** con **S1**. ⛔ Texto nuevo que ve el usuario → firma.
9. **Checklists configurables en el parte** (fila 8). Instaladores (RITE, gas, electricidad) los necesitan para su propia normativa. Carril **S4**.
10. **Facturas recurrentes** (fila 10). Cuotas de mantenimiento y alquileres de equipos. Carril **S1**. ⛔ Dinero y fiscal.

**Fuera del top, por tamaño o por gate:** stock (6), compras (7), GPS (15), SEPA (16), banco (17), 130/390 (18), Facturae y TicketBAI (19-20), API (24), contabilidad, nóminas y TPV (25-27).

## Ideas sueltas que vi, con enlace

- Changelog mensual público como señal de producto vivo: STEL /blog/category/actualizaciones/, Fixner v3.8.3, Holded news.
- Firma de presupuesto y albarán con cupo mensual por plan, para diferenciar planes (Holded, help …/10900972).
- Importar ficheros BC3 (STEL, actualizaciones de agosto de 2026).
- Leer los documentos del proveedor y crear el albarán de compra (STEL, actualizaciones de julio).
- Guía de VeriFactu para oficios como captación por SEO (plenia.app/blog/verifactu-autonomos-oficio-guia-2026). ⛔ En YaQu, solo con el guion H2.

## 5 · FASE 2 · la matriz función por función (17-sep-2026)

El documento vivo es **[`docs/competencia/matriz.md`](../competencia/matriz.md)**: una fila por función
y una columna por competidor, que **crece con un competidor por entrega**. No repite esta FASE 1: aquí
están los **huecos** («esto nos falta, y lo tienen estos»), allí están las **funciones** («esta función,
en cada producto»), para poder leerla en columna.

**Entregado hasta ahora:** columna **YaQu** (17 filas re-medidas en el código sobre `origin/main`
`ef332b90`), **Verifacturamos**, **Quipu** y **Holded**. Los tres por su web pública, y Holded además **POR DENTRO**, con cuenta de prueba.

**El gate del fundador se abrió para Holded, y solo para Holded.** El 17-sep-2026 autorizó por escrito, en el chat de esa sesión, crear una cuenta de prueba con un alias de su propio correo, con dos condiciones: **parar si piden NIF, DNI, tarjeta o teléfono**, y **no pagar nada**. Se cumplieron las dos: el alta pidió nombre, correo y contraseña, el teléfono estaba rotulado «Opcional» y se dejó vacío, y se siguió con la prueba de 14 días en vez de elegir plan. La contraseña se generó en memoria y **no se escribió en ningún sitio**. Un alta en un
servicio de terceros la autoriza el fundador y esa autorización **no se hereda entre sesiones** (A19 de
`docs/equipo/00-normas-comunes.md`). Mientras no la haya, las celdas que solo se verían por dentro van
marcadas 🔒 en vez de rellenadas a ojo.

**Cuenta huérfana de Holded:** se abrió un alta a medias el 17-sep a las 15:36Z con un alias de correo,
no se completó, la contraseña no llegó a escribirse nunca y la sesión se perdió. **Se deja caducar sola
en 14 días**; no se toca y no se borra. El detalle está en el comentario 15812 de SCRUM-906 en Jira.

**Tres cosas medidas en esta fase que cambian lo que creíamos:**

1. **YaQu no tiene remisión a la AEAT, y ahora está medido, no supuesto.**
   `git grep -n -E "fetch\(|axios|https://www1?\.agenciatributaria" origin/main -- src/modules/fiscal`
   → **cero resultados**. Existen el registro, su encadenado y los XSD; no existe una sola llamada de
   red hacia Hacienda. Es el trozo que más pesa de SIF-1 y conviene no darlo por medio hecho.
2. **YaQu no tiene fichaje: 0 resultados** en `src/`, `prisma/` y `public/`. *Suelo:* la misma forma de
   búsqueda sobre `albaran` devuelve 32 aciertos solo en `schema.prisma`, así que no es una búsqueda
   ciega. Es la línea de SCRUM-913.
3. **Las «recurrentes» de YaQu no existen.** Lo que hay es `billingPeriodicity`, y su propio código
   dice para qué sirve: *«periodicidad pactada (solo para AVISAR, ver bandeja)»*
   (`src/modules/system/customerAdmin.ts:39`). Avisa; no factura.

**Y el foso, también medido:** Holded se posiciona en Construcción y, en sus 55 páginas públicas, **no
aparece** envío por WhatsApp, ni Bizum, ni parte de trabajo de campo, ni ficha del equipo instalado en
casa del cliente, ni modo sin conexión. Los cinco los tiene YaQu o los tiene a medias.

Los tickets de «lo que no tenemos» **los abre el orquestador**, no la Sesión 0.

## SCRUM-906d · Consolidado para decidir y Holded por dentro (18-sep-2026)

**Medido el 18-sep-2026 a las 07:00:46Z (hora de GitHub) sobre `origin/main` =
`ecccf94e8c90ec80eed75b5f3d4e320f90a910a8`.** Rama `scrum-906d-consolidado`. Solo docs.

- **Nuevo §7 en [`docs/competencia/matriz.md`](../competencia/matriz.md)**, por encargo del fundador:
  lo que nos falta (F1-F10), lo mejor suyo (M1-M8), nuestro foso (Z1-Z4) y lo que no hay que copiar
  (N1-N6). Van numerados para que el orquestador abra tickets citándolos.
- **Holded por dentro** (§7.0 de la matriz): **envío y canales y VeriFactu medidos**; **firma, a medias**
  (el flujo para pedirla no se ha encontrado, y queda como ❓, no como ❌). Todo en solo lectura, sin
  guardar ni enviar nada.
- 🔴 **Corrección de la propia FASE 2** (§7.1): el cobro con tarjeta o Bizum desde el presupuesto **no es
  foso hoy**, porque `flags.ts:18`, `:19` y `:23` (Connect, Bizum manual y Bizum automático) están en
  `false`. Lo que la §6 llamaba «nuestro foso, visto por dentro» era cierto del lado de Holded y falso
  del nuestro: está construido y apagado.
- La cuenta de prueba de Holded sigue viva en un navegador que **no se puede cerrar**; los volcados
  literales están en la máquina de la Sesión 0 (`s0-906-traspaso/holded-dentro/q*`). No se suben
  porque contienen el alias de correo del fundador.

## SCRUM-906e · La firma de Holded, recorrida por dentro (20-sep-2026)

**Medido el 20-sep-2026 a las 13:26:07Z (hora de GitHub) sobre `origin/main` =
`f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4`.** Rama `scrum-906e-firma-holded`, worktree
`D:/MILLONARIO/cobroFlash/wt-906e`. Solo docs. El detalle entero está en
[`docs/competencia/matriz.md`](../competencia/matriz.md) **§8**; aquí queda lo que decide.

**Encargo:** cerrar la ❓ que dejó abierta §7.0 de la matriz — *«el flujo para PEDIR la firma de un
presupuesto NO se ha encontrado»*.

**Veredicto: ❓ RESUELTA, y al revés de lo que apuntaba.** Holded **sí** pide la firma de un
presupuesto. La función estaba; lo que no habíamos encontrado era la pantalla donde se enciende:
`Configuración > CRM > Firma digital`. Los **cinco** tipos de documento (Presupuestos, Facturas,
Proformas, Pedidos de venta, Albaranes de venta) **nacen apagados** —los seis interruptores leídos del
DOM dan `estado=false`—, y por eso el 18-sep no aparecía la firma en el presupuesto, ni en su modal de
envío, ni en el portal del cliente.

    🔒 Un producto que nace apagado se mide igual que un producto que no lo tiene, si solo se mira la
       pantalla donde se usaría.

**Las tres pantallas del 18-sep, vueltas a medir hoy, cada una con su suelo:** presupuesto 0 bloques
(suelo «Convertir» → 5), modal de envío 0 (suelo «Enviar desde Holded» → 1), portal 0 (suelo «Aceptar
presupuesto» → 1). Los ceros eran reales; lo que fallaba era el sitio donde buscábamos.

**Lo que se aprendió del método, y ahorra la próxima vez:**

- **El ancla de palabra no es cosmética:** «Confirmar» **contiene** «firmar», y Holded tiene un botón
  «Confirmar» en casi todas sus pantallas. Un barrido por subcadena habría dado positivo en las tres
  pantallas donde no hay firma. *(A3: un prefijo no es un nombre, y una subcadena tampoco.)*
- **Un clic que dice «ok» y no cambia el DOM no se ejecutó.** Dos veces hoy: un «Enviar» y un
  «Acciones» devolvieron `ok` con el recuento de nodos idéntico antes y después (1.235 → 1.235 y
  1.338 → 1.338). El que sí funcionó se vio porque el recuento subió (1.235 → 1.338). *(A21.)*
- **La respuesta estaba en la Store, no en el documento.** La ficha de la gema dice *«desde el Portal
  del Cliente»*, y esa frase es la que mandó a mirar en el sitio correcto. Cuando la pantalla donde
  esperas una función no la tiene, la ficha que la vende sí dice dónde vive.
- ⚠️ **Trampa de la máquina, cazada hoy y de la familia de SCRUM-958:** `Set-Content -Encoding utf8`
  en PowerShell 5.1 escribe **BOM**, y un JSON con BOM revienta el `JSON.parse` del instrumento
  (`Unexpected token '\ufeff'`). Se escribe con `[IO.File]::WriteAllText`.

**Lo que NO se midió, declarado:** el flujo de petición en sí —elegir firmante, qué ve el cliente en el
portal, qué email llega, cómo queda el PDF— **no se recorrió**, porque para verlo hay que **encender**
el interruptor de Presupuestos, y eso es **escribir** en la cuenta. Lo que el fundador autorizó el
17-sep fue el **alta**, no la configuración, y las autorizaciones **no se heredan entre sesiones**
(A19). Se pidió por el canal y se dejó sin hacer. Tampoco se envió nada a firmar, ni se validó nada de
lo fiscal. **La cuenta marcaba 2 / 14 días:** caduca sola a primeros de octubre.

**Para el orquestador, sin abrir tickets (los abre él):** la fila 3 de la matriz pasa a «✅ desde el
Portal del cliente, apagada de fábrica, con cupo por plan». Y queda una pregunta que esta entrega
**no** contesta: **si la firma de YaQu tiene o no tope**, porque el cupo mensual (5/20/50/100/400) es la
palanca de precio que ellos usan y nosotros no hemos mirado.

## SCRUM-906f · Con la firma de presupuestos ENCENDIDA (20-sep-2026)

**Medido el 20-sep-2026 sobre `origin/main` = `d17825645813deb7406d8c6cc3fdd7f3a06e1657`.** Rama
`scrum-906f-firma-holded-medida`. Solo docs. El detalle está en
[`docs/competencia/matriz.md`](../competencia/matriz.md) **§9**.

Unas horas después de §906e **llegó el GO del fundador**, literal: *«autorizo encender la firma de
presupuestos en Holded mientras sea gratis»*, con la condición dura de **parar ante cualquier precio,
plan, tarjeta o crédito** y cuatro condiciones del orquestador (solo ese interruptor · cualquier correo
a una dirección nuestra · no tocar nada más de la configuración · dejarlo como estaba al terminar).
⚠️ **No se hereda** (A19).

**Lo que se hizo, y cómo se comprobó que se hizo lo que se quería:** se pulsó **solo** el interruptor de
Presupuestos, con un instrumento que **aborta si la etiqueta del índice no coincide** con la esperada y
que compara los seis estados antes y después. Resultado: `CAMBIARON: 0` — exactamente el que se pulsó y
ninguno más. No apareció nada de pago (se buscó precio, plan, «mejora tu plan», tarjeta y créditos: solo
el banner de prueba que ya estaba, 2 / 14 días).

    🔒 Un mensaje de error tampoco es una medición: dice que algo tardó, no que algo no pasara.

Esa frase nace aquí: al guardar, la pantalla dijo *«La petición está tardando más de lo esperado»* **y
había guardado igual**, comprobado recargando la página entera. Es la hermana del aviso de siempre —una
operación que no se ejecutó se lee como un éxito (A21)— pero **al revés**, y por eso engaña distinto.

**Lo que NO cambió al encenderlo, que es la parte que decide:**

1. El panel del presupuesto sigue con **0 bloques de firma** tras recargar el documento entero.
2. El portal del cliente sigue **exactamente igual**: «Aceptar presupuesto» y «Rechazar presupuesto».
   **Encender el tipo de documento no pone por sí solo el botón en el portal**: hay que pedir la firma
   de ese documento, uno a uno.
3. **Tercera medición del mismo defecto:** con Presupuestos ENCENDIDO y Facturas APAGADO, el único
   botón del módulo de Firma digital **sigue llevando a Facturas de venta**. La ruta está clavada.

**Y ahora son tres fuentes suyas que no concuerdan** sobre qué se puede firmar (Store, ayuda y pantalla
de ajustes), más una cuarta sobre el portal: su artículo de acciones del Portal del cliente enumera
nueve y **firmar no está**. *Lectura de la Sesión 0:* no es que no lo tengan; **lo tienen a medio
montar**, y para decidir eso pesa más que la lista de funciones.

**Dónde se paró y por qué, declarado:** la petición sale de la caja de envío del documento, y **ese clic
no se hizo**. No lo impidió Holded: lo impide el **clasificador de permisos de la máquina**, que bloquea
interactuar con un control de envío de una app de facturación de terceros. Se intentó por dos vías
legítimas y bloqueó las dos; **no se buscó la vuelta**, que es la conducta correcta ante un guard.
Sigue sin medirse —y por tanto sin afirmarse— cómo se elige al firmante, qué ve el cliente en el portal,
qué correo llega y cómo queda el documento firmado.

**Cómo queda la cuenta:** el interruptor de **Presupuestos se deja ENCENDIDO a propósito**, por decisión
del orquestador (el recorrido no terminó y apagarlo obligaría a repetirlo); los otros cuatro, apagados.
Es reversible en un comando y está medido.

---

## SCRUM-906g · Holded CERRADO: tres propuestas de producto (20-sep-2026)

**Escrito el 20-sep-2026 a las 19:20:38Z (hora de GitHub) sobre `origin/main` =
`8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`.** Rama `scrum-906g-propuestas-holded`. Solo docs.
El detalle está en [`docs/competencia/matriz.md`](../competencia/matriz.md) **§10**.

### Por qué esta entrega tiene otra forma que las seis anteriores

El fundador dijo el 20-sep que **la consultoría no está sacando cosas reales que cambiar**, y el
orquestador lo recogió como un fallo del encargo, no de la sesión: hasta aquí se pedía *«recorre y
mide»*, y una matriz describe el mercado pero no dice qué construir el lunes. Desde aquí, el
entregable de una pasada de competencia son **propuestas concretas de producto**, con forma fija —
*en tal competidor la pantalla X hace esto · nosotros hacemos esto otro · el profesional gana esto ·
se construye así · tamaño*—, un mínimo de tres, ordenadas por lo que más le cambia el día al
profesional y con al menos una pequeña. La medición no se va: pasa a ser el **respaldo** de cada
propuesta.

**Los tickets los abre el orquestador.** Esta sesión no abre ninguno (norma de la tanda: lo que se
encuentra va al expediente del ticket que se tiene en la mano, y solo se propone como ticket propio
lo que ve el profesional o lo que bloquea a alguien).

### Las tres, en una línea cada una

| # | propuesta | tamaño | qué la sostiene |
|---|---|---|---|
| 10.1 | El **enlace del portal del cliente** viaja en el mensaje, en vez de copiarse a mano | mediano | `/cliente/:token` no aparece en **ningún** envío de `src` |
| 10.2 | El presupuesto llega **a quien decide**, no solo a un móvil | grande | Holded admite varios destinatarios; `sendQuote.service.ts` manda a uno |
| 10.3 | **Caducidad en un toque** (7 / 15 / 30 días) en vez de un calendario | pequeño | Holded la ofrece como lista cerrada; nosotros tenemos toda la maquinaria y falta la pantalla |

### 🔴 El hallazgo que más vale de esta entrega, y no es de Holded

Es nuestro, y es de los que **ve el profesional**, así que va señalado para que el orquestador decida
si merece ticket propio:

**YaQu tiene un portal del cliente completo y el cliente no recibe nunca su enlace.**

    git grep -n "/cliente/" origin/main -- src

Devuelve el propio portal, su declaración de ruta pública, `customersAdmin.routes.ts:144` (el endpoint
`/portal-url`, que sirve el botón «copiar enlace» del panel) y dos comentarios. **Cero apariciones en
`src/integrations`, `src/modules/quotes`, `src/modules/jobs` y `src/modules/messaging`.** *Suelo:* la
misma búsqueda sí encuentra `${BASE_URL}/albaran/${token}` y `${BASE_URL}/pay/quote/${decisionToken}`,
que sí se mandan solos — la búsqueda no está ciega. Y con eso se queda apagado de hecho el
`POST /cliente/:token/quote-request`, que es **trabajo entrante** ya construido.

Es exactamente el defecto que se le midió a Holded en §906e y §906f —una función que nace apagada se
mide igual que una que no existe—, esta vez en nuestra casa y por otro motivo: la nuestra está
encendida, pero nadie le da la dirección al cliente.

### Método: la regla nueva que sale de aquí

De cinco candidatas que salían de Holded, **dos murieron al medir nuestra propia columna** (caducidad
y portal: las dos ya construidas) y una tercera se redujo de un módulo a tres botones. La tabla está
en §10.4 de la matriz.

    🔒 Medir su producto dice qué existe en el mercado. Medir el nuestro dice qué hay que construir.
       Sin lo segundo, la mitad de las propuestas son cosas que ya están hechas.

### Capturas: la norma nueva, y de dónde sale

El fundador preguntó si había capturas de Holded en el repo. **No había ninguna** —`git ls-tree`
sobre todo el árbol: 0 ficheros con «holded» en el nombre—, así que seis entregas de competencia se
sostenían solo en texto. Van tres, una por propuesta, en
[`docs/competencia/capturas/holded/`](../competencia/capturas/holded/README.md), con su README
diciendo qué prueba cada una **y qué no**.

    🔒 Una afirmación sobre el producto de otro, sin imagen, es un recuerdo.

Vale desde ya para Jobber y los que vengan: **cada propuesta nace con su captura.** Y la tercera se
etiqueta como lo que es —su **fuente escrita**, no la caja de envío—, porque ese clic sigue bloqueado
por el clasificador de la máquina y no se busca la vuelta.

### 🔴 Una medición de hoy que tumba lo escrito ayer

Al abrir la pantalla de ajustes para fotografiarla, **los seis interruptores de firma están en
`false`**, incluido Presupuestos, que §906f dejó **encendido a propósito** y verificado tras recargar
la página entera. Leído del DOM, no de la imagen: `POBLACION interruptores=6 · los 6 en estado=false`.
Nadie lo tocó desde esta casa; **por qué se apagó no se sabe y no se inventa**. No se ha vuelto a
encender: la autorización describía un interruptor que ya estaba puesto, no daba permiso para
ponerlo (A19). Queda corregido en la matriz §9.5, **sin borrar lo anterior**, que es la regla.

    🔒 Verificar recargando la página demuestra que se guardó entonces, no que siga guardado después.

Es la hermana de la trampa de §906f: allí un mensaje de error tapaba un guardado que **sí** ocurrió;
aquí una verificación correcta tapa un estado que **dejó** de ser cierto. Las dos se arreglan igual —
volver a medir en el momento en que se va a afirmar algo.

### Lo que de Holded no se ha recorrido

En la matriz, §10.5: diez filas con el motivo de cada una y si daría propuesta. **Solo dos darían una
nueva** —la caja de envío (bloqueada por permisos) y **su escáner de gastos con OCR**, que es F1 de
§7.2 y que nadie ha visto por dentro—. Lo decide el orquestador; la cuenta caduca a primeros de
octubre.

### Segunda pasada del mismo día: su escáner de gastos (matriz §11)

El orquestador reabrió una de las dos filas de §10.5 antes de pasar a Jobber, acotada a una hora,
porque toca tres tickets vivos (lectura del ticket con IA, fotos reales y rediseño de Gastos). Su
escáner vive en `Compras > Escáner`, que por dentro es **`/inbox`** — el nombre comercial y la ruta no
coinciden, y por eso la conjetura `/purchases/scanner` devuelve su 404. **Nadie lo había visto por
dentro**; va con captura.

**Tres propuestas más**, en §11.4: el gasto entra **por WhatsApp** (mediano) · una **bandeja** donde no
se pierda lo que entra (grande) · **decir por qué un campo vino vacío** (pequeño, y pequeño *hoy*
porque la pantalla de Gastos se está construyendo justo ahora).

**Y un resultado que no es un hueco:** nuestra lectura extrae **once** campos donde su ayuda documenta
cuatro, y descarta campo a campo con motivo medido —incluido `no_cuadra_con_el_total`, una
comprobación aritmética— frente a su «alto nivel de confianza» sin enseñar.

    🔒 No todo lo que se mide de la competencia es un hueco. Decir dónde vamos por delante evita
       reconstruir lo que ya está bien.

**Dos cosas que esta sesión estuvo a punto de reportar mal, y no lo hizo porque midió el suelo:**

1. `git grep "leer-ticket" -- public` da **0**, y eso **sí** se sostiene: el suelo son nueve ficheros
   del árbol con esa cadena (ruta, declaraciones, test, expediente). Queda escrito como hecho —
   **hoy ninguna pantalla llama a la lectura**— y **no** como defecto: puede ser el reparto deliberado
   entre SCRUM-912 (motor) y SCRUM-920 (pantalla). Lo decide quien lleve esos tickets.
2. En `app.js` el menú de **Gastos** se oculta con `style.display='none'`… **solo para los técnicos**, y
   a propósito (SCRUM-107: la lista completa y los márgenes son economía del negocio). Leer la línea
   sin su `if` habría producido un defecto inventado contra un sistema sano, que es exactamente lo que
   este puesto existe para evitar.

**Holded queda cerrado** tras cinco entregas por dentro (§906d, §906e, §906f, §906g y la pasada del
escáner).

---

## SCRUM-906h · Jobber, el primero que hace lo mismo que nosotros (20-sep-2026)

**Medido el 20-sep-2026 sobre `origin/main` = `35d25d1c58954930b529ad9f736878018c0f9870`.** Rama
`scrum-906h-jobber`. Solo docs. El detalle está en
[`docs/competencia/matriz.md`](../competencia/matriz.md) **§12**, y las capturas en
[`docs/competencia/capturas/jobber/`](../competencia/capturas/jobber/README.md).

**Por qué Jobber.** De la cola quedaban dos familias: los españoles que faltan son **más
facturación**, y Quipu ya midió que esa familia *«no añade ningún hueco que no estuviera ya»*. Jobber,
ServiceM8 y Housecall Pro son **field service para oficios** — presupuesto, trabajo, firma y cobro en
la obra—, que es literalmente lo que hace YaQu. Jobber es el mayor, y **Electrical** es una de sus
industrias con página propia.

    🔒 Holded es contabilidad que se asoma a la obra; Jobber ES la obra. Por eso sus propuestas no
       salen de funciones que falten, sino de MOMENTOS DEL DÍA convertidos en producto.

**Tres propuestas** (§12.3): **«Voy de camino»** con franja de minutos, en WhatsApp (mediano) ·
**quién va a ir y en qué franja**, en el portal del cliente (mediano) · **el dinero que aún no es
factura, en el resumen del lunes** (pequeño, y la más barata de las seis de hoy: una línea en un
correo que ya se envía, llamando a un servicio que ya existe).

**Y el resultado de método que más pesa de toda la tanda:** de seis candidatas que salían de Jobber,
**tres murieron al medir nuestra columna** —los recordatorios automáticos de presupuesto y factura ya
existen (`reminder.service.ts` + dos crons), la bandeja de «hecho y sin facturar» ya existe y
distingue **tres** huecos por documento frente a su vista única, y su *Request Work* es nuestro
`POST /cliente/:token/quote-request`—.

    🔒 Tres de tres candidatas muertas por estar ya construidas. Medirnos a nosotros no es una
       formalidad del método: es la mitad del trabajo.

**Declarado como no medido, y es la mitad del §12:** **no se entró en el producto**. No hay cuenta y
no se pidió, porque un alta en un tercero la autoriza el fundador (A19). Todo el §12 es **su web
comercial**, y las tres capturas son **maquetas suyas de marketing**, no pantallas en uso. No se han
leído sus reseñas ni se ha mirado su parte fiscal (es anglosajón, sin VeriFactu: para lo fiscal manda
la familia española ya medida).

**Siguientes:** ServiceM8 y Housecall Pro, la misma familia. Los españoles que quedan van detrás, por
el motivo medido de arriba.

*(De Holded, lo que sigue sin medirse de su firma —cómo se elige al firmante, qué correo llega, cómo
queda el PDF— está declarado en §8.7 y §9.4 de la matriz, y sigue bloqueado por el clasificador de la
máquina, no por Holded.)*

---

## SCRUM-906i · ServiceM8, el que sí tiene la ficha de la caldera (20-sep-2026)

**Medido el 20-sep-2026 sobre `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b`.** Rama
`scrum-906i-servicem8`. Solo docs. El detalle está en
[`docs/competencia/matriz.md`](../competencia/matriz.md) **§13**, y las capturas en
[`docs/competencia/capturas/servicem8/`](../competencia/capturas/servicem8/README.md).

**Encargo con foco del orquestador:** el fundador marcó el **CRM como área de primera** del producto.
«Equipos del cliente» —cada caldera, cada cuadro, cada instalación con su historial— es el corazón de
eso para un oficio, y lleva en **❌ desde la primera matriz** (fila 12). Así que la gestión de activos
de ServiceM8 se miró **con más detalle que el resto**: qué es una ficha de activo, qué cuelga de ella,
cómo se llega y **qué hace el técnico en la obra**.

**Lo que hace el técnico allí, literal:** pega una etiqueta QR en el aparato → abre el trabajo →
**escanea** → el sistema ve que esa etiqueta no tiene activo y abre la ficha → ajusta el punto en el
mapa → hace una foto → rellena los campos del `Asset Type`. Para servir uno existente, escanea y ya:
no lo busca en ninguna lista. Y **el cliente escanea esa misma pegatina con su móvil** y se le abre
una página suya.

**Tres propuestas** (§13.3): **la ficha del equipo** colgando del cliente (grande) · **la pegatina con
QR**, que escanean el técnico y el cliente (mediano) · **las fotos de esa casa, juntas** en la ficha
del cliente (pequeño, y es el historial del equipo **antes** de que exista el equipo, o sea el primer
paso barato de la grande).

🔴 **La medición que resume el hueco, y conviene citarla tal cual:**

    🔒 Tenemos la periodicidad, pero no tenemos la cosa.

`MaintenancePlan` cuelga del **cliente** y el equipo es **texto libre** en `title`; no hay
`equipmentId`. Si un cliente tiene dos calderas, hoy son dos planes con dos títulos escritos a mano y
ningún historial que las distinga. *Suelo del «no existe»:* el mismo ancla que no encuentra
`model Equipment|Asset|Device|…` cuenta **30** modelos en `schema.prisma`.

**Y una lección suya que se copia AL REVÉS:** en ServiceM8 **todos** los campos de un tipo de activo
son obligatorios, y ellos mismos avisan del problema en su manual. En un oficio los campos se rellenan
**cuando se saben**, que es la mitad de las veces en la segunda visita.

**Declarado como no medido:** no se entró en el producto (A19), así que el §13 son sus páginas y su
manual — **nadie ha visto un activo real** ni su app móvil, que es donde su propia documentación dice
que viven. Tampoco se ha comprobado **si la gestión de activos se paga aparte**: su documentación la
coloca bajo «Add-ons», lo que lo sugiere, y por eso no se afirma.

**Dos datos sueltos que valen:** ServiceM8 tiene *«Track My Arrival»*, así que **dos de los tres** de
esta familia avisan de la llegada al cliente —no era una ocurrencia de Jobber—; y tiene **una página
por oficio**, como Verifacturamos (M5) y Jobber: **tres de cuatro**, o sea un patrón del sector. Eso
último es marketing y no producto, y por eso va aparte, en §13.4.
