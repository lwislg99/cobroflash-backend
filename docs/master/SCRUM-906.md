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
