<!-- ─────────────────────────────────────────────────────────────────────────────
CABECERA (no forma parte del diseño — la añade SCRUM-300, no la epic)

  FUENTE:      descripción de la epic SCRUM-278 (BLOQUE C · Albaranes como objeto de
               primera clase), en Jira.
  COPIADO EL:  5-ago-2026, por SCRUM-300 · C5.
  ORIGEN:      https://yaqu.atlassian.net/browse/SCRUM-278
  QUÉ ES:      COPIA VERBATIM de la DESCRIPCIÓN (no los comentarios). No se resumió, no se
               reordenó, no se "mejoró". Si algo parece mal, se reporta en el informe de
               SCRUM-300, NO se corrige aquí.
  ⚠️ STALE:    Es una copia. Si la epic cambia en Jira, este fichero queda desactualizado. La
               fecha de arriba dice contra qué versión se copió.

  ⚠️ DOS PREMISAS DE ESTE TEXTO YA ESTÁN CORREGIDAS, y NO se tocan aquí (verbatim manda).
     La corrección vive en `docs/master/SCRUM-300.md`:

       ① «lugar de entrega (sale del Trabajo)» y «Fecha de entrega separada» → el lugar de
          entrega es campo DEL ALBARÁN (decisión del asesor, 5-ago-2026), y la fecha de
          entrega YA existía: `Albaran.fecha`. Lo que faltaba era que alguna UI la escribiera.
       ② Las cinco opciones que enumera C5 NO son las aprobadas. Las aprobadas por el fundador
          el 5-ago-2026, y que manda `src/modules/jobs/domain/albaranFirmante.ts`, son:
          «El propio cliente» · «Un familiar o alguien que vive en el domicilio» ·
          «Personal de la obra» · «Portero o conserje del edificio» · «Otro».
───────────────────────────────────────────────────────────────────────────── -->

## 🟢 DISEÑADO · El diseño completo está aquí abajo

La primera tarea del bloque lo deja commiteado en `docs/diseno/bloque-c.md`.

Queja del fundador, textual: «_dentro de un trabajo es una pestaña gigantesca que se aplican los albaranes y se crean super raro sin líneas y luego se editan. No son cosas intuitivas ni ordenadas._»

---

# 0 · Lo que exige un albarán — investigado, no supuesto

## Contenido mínimo

* **Lugar y fecha de emisión**
* **Código o número**, con **serie** recomendada
* Datos identificativos de **comprador y vendedor**
* **Domicilio de ambas partes**
* **LUGAR Y FECHA DE ENTREGA**
* **Firma y sello del receptor**
* Cantidad y descripción de lo entregado

## Sobre el precio — confirma la decisión del fundador

> «No especificar precio en el albarán es válido, ya que su función es acreditar entrega, no justificar pago.»

Nuestro albarán sin precios **no es una carencia: es lo correcto**. El _albarán valorado_ solo aparece cuando se factura por periodos con factura recapitulativa — que es lo que hace `consolidar`.

## Sobre la firma — jurisprudencia

* Un albarán es documento privado unilateral, pero **su no reconocimiento no lo priva de valor probatorio**.
* **Una firma presente lo refuerza** como prueba genuina de la entrega.
* 🔴 **«Las firmas ilegibles o no identificadas requieren prueba complementaria.»**
* Y esto, que describe literalmente nuestro caso de uso: **«es habitual que personal de la misma obra rubrique la recepción»** cuando la mercancía requiere instalación inmediata.

---

# 🔴 EL HALLAZGO: nuestra mejor función tiene un hueco legal

Tenemos **el mejor mecanismo de firma del mercado** — canvas in situ, firma remota por WhatsApp con `firmaToken` (SCRUM-49), evidencias con fotos (SCRUM-68) y hash de contenido sellado.

**Y guardamos un trazo sin nombre.**

En obra, quien firma casi nunca es el cliente: es su pareja, el portero, el encargado, un vecino que estaba. La jurisprudencia **lo reconoce como normal** — y en la misma frase dice que una firma no identificada **exige prueba complementaria**.

> Estamos capturando la firma mejor que nadie y dejándola legalmente más floja de lo que podría estar, por el coste de un campo de texto.

**Añadir «quién firma» y «en calidad de qué» convierte nuestra mejor función en la más difícil de discutir.** Es la mejora con mejor relación valor/coste del bloque, y no se le ha ocurrido a nadie porque nadie más firma albaranes en obra.

---

# 1 · Lo que tienen ellos

## Listado

* Botón `+ Nuevo albarán`
* **Pestañas de estado con contador**: `Todos (1)` · `Borrador (0)` · `Entregado (0)` · `Firmado (0)` · `Facturado (0)`
* Columnas: **Número · Fecha emisión · Fecha entrega · Cliente · Tipo · Estado**

## Detalle `ALB-2026-0001`

* Migas: `Albaranes › ALB-2026-0001`
* Título + chips `[Entregado]` `[Sin valorar]` + «Creado el 4 de agosto de 2026»
* Acciones: `Marcar como firmado` · `Convertir en factura` (primaria) · `Descargar` · `Enviar ▾` · `⋮`
* **Pestañas de progreso**: Generado → Entregado → Firmado → Facturado
* Izquierda: **Líneas del albarán**, `DESCRIPCIÓN | CANT` — **sin columna de precio**
* Rail derecho: **FECHAS** (emisión · entrega) · **CLIENTE** · **DIRECCIÓN DE ENTREGA** · **PLAZO DE PAGO** · **PRESUPUESTO ORIGEN** enlazado

## Lo que hacen bien y se copia sin orgullo

1. El albarán **es un objeto con su pantalla**, no un trozo de otra cosa.
2. **Fecha de entrega separada** de la de emisión — además es contenido mínimo obligatorio.
3. **Dirección de entrega separada** del domicilio fiscal — ídem.
4. **Presupuesto origen enlazado y visible.**
5. **Pestañas de estado con contadores**: contestan «¿qué tengo sin firmar?» de un vistazo.

---

# 2 · Lo que tenemos nosotros

Los albaranes viven **dentro del Trabajo**, apilados en tarjetas verticales, cada una con **botones distintos según su estado**, sueltos y sin jerarquía:

```
Albarán ALB-2026-0001   ENVIADO · 19 jul, 17:50 · Sin pagar
   [PDF] [Firmar] [Editar líneas] [⋯]

Albarán ALB-2026-096    FIRMADO · 20 jul, 17:40 · Sin pagar
   [PDF] [Enviar por WhatsApp]

Albarán ALB-2026-097    BORRADOR · 12 jul, 10:15 · Sin pagar
   [Firmar] [Editar líneas] [Añadir foto]
```

## Lo que tenemos y ellos NO

* **Firma real**: canvas in situ + **firma remota por WhatsApp** con `firmaToken`
* **Fotos como evidencia** (SCRUM-68)
* **Envío por WhatsApp** con Cloud API, no un `wa.me`
* **Prellenado desde el presupuesto** (SCRUM-257)
* **Hash de contenido sellado** (`computeAlbaranContentHash`)
* Y detrás, **un presupuesto firmado con precios pactados**

## Lo que nos falta y es obligatorio

* ❌ **Fecha de entrega** separada
* ❌ **Lugar de entrega** — la dirección de obra
* ❌ **Identificación de quién firma**

Tres campos. Dos son contenido mínimo del documento y el tercero decide su fuerza probatoria.

---

# 3 · Las siete tareas

**C1 · Albaranes como sección propia.** Listado global con pestañas de estado y contadores. Hoy es **imposible** contestar «¿qué albaranes tengo sin firmar?» sin entrar trabajo por trabajo. 🏆 Con columna **Trabajo**, que ellos no pueden tener.

**C2 · Página de detalle**, con el patrón de B2:

| Estado | Primaria | Secundarias | ⋮ |
| --- | --- | --- | --- |
| Borrador | **Enviar para firmar** | Editar líneas · PDF | Añadir foto · Duplicar · Borrar |
| Enviado | **Firmar aquí** | Reenviar · PDF | Añadir foto · Duplicar |
| Firmado | **Convertir en factura** | PDF · Enviar por WhatsApp | Añadir foto · Duplicar |
| Facturado | — | PDF · Ver factura | Duplicar |

Rail: **FECHAS** · **CLIENTE** · **LUGAR DE ENTREGA** · **FIRMADO POR** · **TRABAJO** · **PRESUPUESTO ORIGEN** · **FOTOS**.

**C3 · Dentro del Trabajo: tabla, no pila.** `Nº · Fecha · Estado · Líneas · Acción`. Una acción visible por fila. Diez albaranes hoy son pantalla y media; en tabla son diez líneas.

**C4 · Crear en UNA pantalla.** Hoy: crear → sale vacío → editar líneas → firmar. Nuevo: **abre ya prellenado** (SCRUM-257 ya lo construyó), revisas cantidades y firmas. Y `BORRADOR` deja de ser un limbo.

**C5 · Los tres campos que faltan.** Fecha de entrega · lugar de entrega (sale del Trabajo) · y 🔴 **FIRMADO POR** con nombre y en calidad de qué: el propio cliente / familiar o conviviente / encargado o personal de obra / portero o conserje / otro.

**C6 · Qué queda por entregar.** Presupuestaste 10, llevas 3+4, el Trabajo dice **«quedan 3»**. 🏆 Nadie lo tiene porque nadie liga cantidades de albarán a líneas de presupuesto. Es **certificación por partes** (SCRUM-18) sin construir nada nuevo.

**C7 · Serie de numeración propia.** Reutiliza el mecanismo de **A4**. **No se escribe un segundo generador** — defecto de SCRUM-240.

---

# 4 · Declarado y FUERA

* **Firmar sin cobertura** → propuesto como **Bloque H**. Es la funcionalidad más de gremio de la lista y Verifacturamos no puede resolverla, pero tiene cola de sincronización, conflictos, sello de tiempo sin servidor y fotos pesadas. Meterlo en C lo convierte en tres semanas.
* **Foto por línea**, no solo por albarán.
* **El albarán como parte de horas.**
* **Factura recapitulativa desde varios albaranes** — `consolidar` ya existe.

_(Duplicar el albarán de ayer SÍ entra, en el «⋮» de C2: en una reforma de tres semanas cada día es un parte.)_

---

# 5 · Dependencias

* **B2** — el patrón de detalle. Sin él, C2 inventa otro y hay que rehacerlo.
* **B1** — la entrada `Albaranes` en el menú.
* **A0.2** — si las líneas no se pueden casar, **C6 no se puede construir**.
* **A0.4** — la conversión a factura. C2 deja el hueco de la primaria; el mecanismo es de A.
* **A4** — el mecanismo de series, que C7 reutiliza.

# 6 · Lo que NO toca

El **mecanismo de firma**, que funciona y es nuestra joya · el **envío por WhatsApp** · `prisma/schema.prisma` · la conversión a factura (**A0.4**). El **PDF** solo se toca para añadirle los tres campos de C5.

# 7 · Microcopy pendiente

Rótulos del listado y sus pestañas · las cuatro acciones primarias · los nombres de los tres campos nuevos · **las cinco opciones de «en calidad de qué»**, que son las que más cuidado piden porque acaban en un documento que se puede leer en un juzgado.

---

# Fuentes

* Estudio jurisprudencial sobre la fuerza probatoria de los albaranes y las facturas — La Ventana Jurídica
* ¿Qué requisitos deben cumplir los albaranes o notas de entrega? — M. Romero Consultores
* Qué es un albarán y para qué sirve — Legálitas
