<!-- ─────────────────────────────────────────────────────────────────────────────
CABECERA (no forma parte del diseño — la añade SCRUM-287, no la epic)

  FUENTE:      descripción de la epic SCRUM-277 (BLOQUE B · Arquitectura de información), en Jira.
  COPIADO EL:  5-ago-2026, por SCRUM-287 · A0.1.
  ORIGEN:      https://yaqu.atlassian.net/browse/SCRUM-277
  QUÉ ES:      COPIA VERBATIM de la DESCRIPCIÓN (no los comentarios). No se resumió, no se
               reordenó, no se "mejoró". Si algo parece mal, se reporta en el informe de
               SCRUM-287, NO se corrige aquí.
  ⚠️ STALE:    Es una copia. Si la epic cambia en Jira, este fichero queda desactualizado. La
               fecha de arriba dice contra qué versión se copió.
───────────────────────────────────────────────────────────────────────────── -->

## 🟢 DISEÑADO · Va primero de todos los bloques

**El diseño completo está AQUÍ ABAJO, no en un enlace.** La primera tarea del bloque (B2) lo deja commiteado en `docs/diseno/bloque-b.md` para que viva en el repo.

**Por qué va primero:** si construimos el núcleo fiscal (Bloque A) o los albaranes (Bloque C) encima del desorden actual, lo hacemos dos veces. B2 define el patrón dentro del cual caen A, C y G.

## Lo que este bloque es y lo que no es

Todo lo de aquí es **presentación y rutas**. **No se toca el modelo de datos, ni fiscal, ni el cobro, ni la firma, ni WhatsApp, ni el PDF.** Si al diseñar una pantalla aparece la tentación de arreglar algo de A o de C, se reporta y no se arregla (regla 9). Es la única forma de que un rediseño no se convierta en seis semanas.

---

# B1 · La barra lateral

## Lo que hay hoy

```
PRINCIPAL   Inicio · Solicitudes · Trabajos · Clientes · Presupuestos
CATÁLOGO    Plantillas · Productos · Proveedores
FINANZAS    Informes · Facturas · Gastos · Descargar datos
CUENTA      Planes · Equipo · Configuración
```

Cuatro problemas medidos:

1. **Presupuestos y Facturas viven en grupos distintos** y son el mismo tipo de cosa: documentos del ciclo de venta. Uno está en PRINCIPAL y el otro en FINANZAS.
2. **Albaranes no existe** como sitio. Vive dentro de Trabajos, así que no se puede contestar «¿qué albaranes tengo sin firmar?».
3. **Plantillas está en CATÁLOGO**, junto a Productos y Proveedores, cuando solo se usa desde el editor de presupuestos.
4. **Descargar datos es una utilidad** entre sustantivos de trabajo diario.

## Lo que proponemos

```
(sin rótulo)
  Inicio
  Solicitudes          ← entra la demanda
  Trabajos             ← el objeto central del negocio

VENTA
  Presupuestos
  Albaranes            ← NUEVO: pestaña propia
  Facturas
  Cobros               ← NUEVO: separado de Facturas

NEGOCIO
  Clientes
  Productos
  Proveedores
  Gastos
  Informes

CUENTA
  Equipo
  Planes
  Configuración ▸
```

**Movimientos y su motivo:**

* **Plantillas** deja de ser entrada de menú y pasa a **pestaña dentro de Presupuestos** (`Historial · Plantillas`). Se usa desde ahí y solo desde ahí.
* **Descargar datos** pasa a `Configuración › Tus datos`. La página construida en SCRUM-244 **no se rehace**: solo cambia de dónde se enlaza.
* Los tres primeros van **sin rótulo de grupo**: son el trabajo del día y no necesitan que nadie los clasifique.

## Configuración troceada

```
Configuración
  ├ Empresa            nombre, razón social, NIF, dirección, país, moneda, WhatsApp
  ├ Facturación        prefijo, IVA por defecto, lugar de negocio
  ├ Numeración         (hueco para A4 — series)
  ├ Cobros             IBAN, Bizum, Stripe
  ├ Avisos             emails automáticos, resumen semanal
  ├ Tu página pública  dirección, zonas, años de experiencia
  ├ Marca              logo, color, «respeta mínimo»
  ├ Tus datos          descargar datos + portabilidad + borrar cuenta
  └ Cumplimiento       (hueco para A7/A8 — VERI*FACTU, firma, evidencias)
```

---

# B2 · El patrón de página de detalle

Esto es lo que arregla el amontonamiento de botones, y es una **ley**, no una pantalla: se aplica igual a factura, presupuesto, albarán y trabajo.

```
┌───────────────────────────────────────────────────────┐
│ Facturas ›  F-2026-0007                               │  migas
├───────────────────────────────────────────────────────┤
│ F-2026-0007   [PAGADA]         [ PRIMARIA ] [sec]  ⋮  │
│ Emitida el 4 ago 2026                                 │
├───────────────────────────────────────────────────────┤
│   ●─────────●─────────○                               │  estado
│   Borrador   Emitida   Cobrada                        │
├────────────────────────────────┬──────────────────────┤
│  LÍNEAS                        │  CLIENTE             │
│  TOTALES                       │  FECHAS              │
│  NOTAS                         │  ORIGEN → presup/trab│
│                                │  COBRO               │
└────────────────────────────────┴──────────────────────┘
```

## Las cinco reglas

1. **Exactamente UNA acción primaria.** Es el siguiente paso en la vida del objeto y **cambia con el estado**. Nunca hay dos cosas «igual de importantes»: si las hay, es que no hemos decidido nosotros y le pasamos la decisión al usuario.
2. **Máximo DOS secundarias**, y siempre las mismas para un tipo de objeto, de modo que la mano las aprenda.
3. **Todo lo demás va en «⋮»**. Sin excepciones y sin «esta también es importante».
4. **La columna derecha es contexto de solo lectura.** Ahí nunca se edita.
5. **Lo destructivo vive solo en «⋮»**, jamás como botón visible.

## Aplicado a FACTURA — de 8 botones a 1 + 2

| Estado | Primaria | Secundarias | En ⋮ |
| --- | --- | --- | --- |
| Borrador | **Emitir factura** | Modificar · PDF | Duplicar · Guardar como plantilla · Borrar borrador |
| Emitida (pendiente) | **Registrar cobro** | Enviar por WhatsApp · PDF | Recordar pago · Duplicar · Rectificar · Regenerar PDF |
| Pagada | **Ver justificante** | Enviar por WhatsApp · PDF | Duplicar · Rectificar · Regenerar PDF |
| Rectificativa | — | PDF · Ver original | Duplicar |

Hoy hay ocho botones del mismo peso: _Abrir PDF · Reenviar por WhatsApp · Marcar como PAGADA · Paquete de etiqueta · Confirmar Bizum recibido · Recordar pago · Rectificar factura · Regenerar PDF_. Ninguno dice cuál es el siguiente paso.

## Aplicado a PRESUPUESTO

| Estado | Primaria | Secundarias | En ⋮ |
| --- | --- | --- | --- |
| Borrador | **Enviar por WhatsApp** | Modificar · PDF | Duplicar · Guardar como plantilla · Borrar |
| Enviado | **Marcar aceptado** | Reenviar · PDF | Rechazar · Duplicar · Modificar |
| Aceptado | **Ver trabajo** | PDF | Duplicar |

## Aplicado a ALBARÁN

| Estado | Primaria | Secundarias | En ⋮ |
| --- | --- | --- | --- |
| Borrador | **Enviar para firmar** | Editar líneas · PDF | Añadir foto · Borrar |
| Firmado | **Convertir en factura** | PDF · Enviar por WhatsApp | Añadir foto · Duplicar |
| Facturado | — | PDF · Ver factura | — |

## Aplicado a TRABAJO

| Estado | Primaria | Secundarias | En ⋮ |
| --- | --- | --- | --- |
| Sin agendar | **Agendar** | Ver presupuesto | Notas · Cancelar |
| Agendado | **Empezar** | Reagendar · Ver presupuesto | Añadir a calendario · Cancelar |
| En curso | **Marcar terminado** | Nuevo albarán · Añadir gasto | Ver presupuesto · Notas |
| Terminado | **Emitir factura** | Nuevo albarán · Añadir gasto | Ver presupuesto |

---

# B3 · Formularios numerados

**Regla:** todo formulario de más de seis campos se trocea en bloques numerados, cada uno con su título y su tarjeta. **El orden es el orden en que un humano toma las decisiones**, no el orden en que están las columnas en la base de datos.

## Nuevo presupuesto — reordenado

```
1. Cliente          buscar o crear
2. Líneas           plantilla → conceptos → cantidades → precios
3. Condiciones      validez, forma de pago, anticipo
4. Envío            WhatsApp o email · qué datos pide al cliente
5. Notas
```

Hoy el formulario empieza por «Estación de calor» y las condiciones de pago **antes de haber dicho a quién le vendes**. Nadie decide la forma de pago antes de saber el cliente y lo que va en el presupuesto.

## Nueva factura — el esqueleto, no el contenido

```
1. Tipo de factura     ← HUECO. El contenido es A1.
2. Cliente
3. Fechas              emisión · vencimiento · operación
4. Datos fiscales      ← HUECO. El contenido (IRPF, recargo) es A2/A3.
5. Líneas
6. Notas
```

---

# B4 · Separar Facturas de Cobros

Hoy entras por el menú **Facturas**, abres una, y dentro te encuentras «Justificante de cobro». **Son dos documentos con dos significados legales distintos compartiendo pantalla.**

* **Factura** — documento fiscal, obligatorio, numerado, **inmutable** (regla 29). Lo que Hacienda mira.
* **Justificante de cobro** — acredita que se recibió el dinero. **No es una factura**, y el propio PDF ya lo dice.

**Ese aviso existe para compensar en el papel una confusión que creamos en la navegación.** Si la navegación fuera clara, el PDF no tendría que disculparse.

## Propuesta

* Menú **Facturas** = solo facturas.
* Menú **Cobros** = los cobros con su justificante. Filtros por método (Bizum · tarjeta · transferencia · efectivo) y por antigüedad de la deuda.
* Desde la factura, el enlace a su cobro va en la **columna derecha**, como contexto. No como botón.

---

# Bloqueo activo

**Los \~35 rótulos del bloque son microcopy y los aprueba el fundador (regla 30).** Mientras no lleguen, las tareas entregan con `[PENDIENTE microcopy oficial]` y un guard que falla si alguien mete un texto plausible — el mismo patrón que funcionó en portabilidad.

**Rótulos a aprobar:**

* Grupos: `VENTA` · `NEGOCIO` · `CUENTA`
* Entradas nuevas: `Albaranes` · `Cobros`
* Submenús: `Empresa` · `Facturación` · `Numeración` · `Cobros` · `Avisos` · `Tu página pública` · `Marca` · `Tus datos` · `Cumplimiento`
* Pestañas de Presupuestos: `Historial` · `Plantillas`
* Acciones primarias: `Emitir factura` · `Registrar cobro` · `Ver justificante` · `Enviar por WhatsApp` · `Marcar aceptado` · `Ver trabajo` · `Enviar para firmar` · `Convertir en factura` · `Agendar` · `Empezar` · `Marcar terminado`
* Títulos de bloque: `Cliente` · `Líneas` · `Condiciones` · `Envío` · `Notas` · `Tipo de factura` · `Fechas` · `Datos fiscales`

# Reglas

* **Regla 4**: vanilla. Sin React, sin Tailwind, sin bundler.
* **Regla 29**: el patrón no puede abrir en ningún estado la puerta a editar o borrar una factura emitida.
* **Regla 30**: ni un rótulo sin aprobar.
* **Regla 9**: lo que se vea fuera del carril se reporta, no se arregla.
