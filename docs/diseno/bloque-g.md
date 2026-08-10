<!-- ─────────────────────────────────────────────────────────────────────────────
CABECERA (no forma parte del diseño — la añade SCRUM-411, no la epic)

  FUENTE:      descripción de la epic SCRUM-282 (BLOQUE G · Trabajos — ordenar nuestro
               diferencial y hacer visible el ciclo completo), en Jira.
  COPIADO EL:  10-ago-2026, por SCRUM-411.
  ORIGEN:      https://yaqu.atlassian.net/browse/SCRUM-282
  QUÉ ES:      COPIA VERBATIM de la DESCRIPCIÓN (no los comentarios). No se resumió, no se
               reordenó, no se "mejoró". Si algo parece mal, se reporta en el informe de
               SCRUM-411, NO se corrige aquí.
  ⚠️ STALE:    Es una copia. Si la epic cambia en Jira, este fichero queda desactualizado. La
               fecha de arriba dice contra qué versión se copió.
───────────────────────────────────────────────────────────────────────────── -->

## 🟡 DISEÑADO Y AUDITADO · pendiente de MEDICIÓN antes de partir en tareas

**Cada afirmación lleva su procedencia.** `[MEDIDO]` = sale de una captura vista o un ticket leído. `[SUPUESTO]` = sale de la cabeza del asesor y **hay que medirlo antes de crear tareas**.

Esta disciplina nace de un error real: el diseño de **B2** se escribió contra estados supuestos y produjo **cinco contradicciones** que una sesión encontró al medir el árbol. Un diseño mal medido es peor que un ticket mal medido, porque **el ticket hereda el error con autoridad**: la sesión lo lee como especificación, no como hipótesis.

---

# 0 · Este bloque es distinto a los demás

En A, B y C había algo que copiar. **Aquí no hay nada.**

Verifacturamos **no tiene Trabajos** `[MEDIDO — su sidebar entera: Panel, Facturas, Presupuestos, Albaranes, Clientes, Productos, Comparte con tu Gestor, Modelo 303, Exportar a contabilidad, Integraciones, Referidos, Configuración, Contáctanos]`. Su producto son cuatro carpetas de papeles que se convierten unos en otros.

Así que esto no es «copiar y mejorar»: es **ordenar lo único que tenemos y ellos no**.

> **Nuestra mayor ventaja está en la pantalla más desordenada del producto.** Alguien que la abra por primera vez no ve un sistema de negocio: ve una lista larga.

---

# 1 · Lo que hay hoy `[MEDIDO de las capturas]`

## El listado

* Pestañas con contador: `Todos - 9` · `Pendiente - 3` · `Parcial - 1` · `Pagado - 5`
* Secciones: **EN CURSO** · **ESTA SEMANA** · **SIN AGENDAR**
* Tarjeta con: cliente, `Presupuesto #N · importe`, chip de cobro, fecha agendada, barra de progreso de cobro, acción, y **notas internas siempre visibles**

**Está bastante bien** y no se toca en este bloque. Agrupar por «en curso / esta semana / sin agendar» ordena por **cuándo me toca**, no por cuándo se creó.

## El detalle

```
Presupuesto #2 · Francisco Jiménez        ← el título
Responsable: Fontanería Torres
Francisco Jiménez · 📞 34600000000
ESTADO  [EN CURSO] [PAGADO]                TOTAL ACEPTADO  853,05 €
Cobrado 853,05 € de 853,05 €  ▓▓▓▓▓▓▓▓ 100%
COBRADO 853,05 €    PENDIENTE 0,00 €
[Marcar terminado]
TIPO DE TRABAJO: Varios avisos o visitas sueltas          [Cambiar]
DOCUMENTOS
  + Nuevo albarán | Iniciar precio en el parte | + Añadir gasto
  Presupuesto #2 · 24 jun · 853,05 €              [Ver presupuesto]
  Albarán ALB-2026-0001  ENVIADO · 19 jul          [PDF][Firmar][Editar]
  Justificante J-20260629-6981  PAGADO · 853,05 €
  Albarán ALB-2026-096   FIRMADO · 20 jul          [PDF][WhatsApp]
  Albarán ALB-2026-097   BORRADOR · 12 jul         [Firmar][Editar][Foto]
  …
DATOS
  CLIENTE / TELÉFONO / DIRECCIÓN
```

---

# 2 · Los cinco defectos

## 🔴 D1 · El Trabajo no tiene identidad propia `[MEDIDO]`

Se titula `Presupuesto #2 · Francisco Jiménez`.

El objeto central de nuestro producto —el que nos separa de todos los facturadores del mercado— se presenta como **una fase del presupuesto**.

No es un detalle de rótulo: es **la tesis del producto contradicha en la primera línea de su propia pantalla**.

## 🔴 D2 · DATOS está abajo del todo `[MEDIDO]`

Cliente, teléfono y dirección están **debajo de la pila de documentos**. Y son exactamente lo que necesitas **de camino a la obra**: a quién llamas y adónde vas.

## 🔴 D3 · DOCUMENTOS mezcla cuatro cosas `[MEDIDO]`

En una pila vertical conviven **presupuesto** (uno), **albaranes** (n), **justificantes de cobro** (n) y **gastos** (n). Cuatro tipos de objeto con cuatro ciclos de vida, ordenados por fecha. Es la «pestaña gigantesca».

## D4 · Los tres botones de cabecera `[MEDIDO]`

`+ Nuevo albarán` · `Iniciar precio en el parte` · `+ Añadir gasto` — tres acciones del mismo peso sin decir cuál es la normal. Y la del medio no se entiende sin saber qué hay detrás. `[SUPUESTO]` que tiene que ver con `modoValoracion`.

## D5 · No se ve qué falta para cobrar `[MEDIDO]`

La pantalla dice **cuánto** se ha cobrado. No dice **qué falta**. Un trabajo terminado y sin cobrar y uno a medias y sin cobrar **se ven igual**: la barra a la mitad. Y son situaciones opuestas — en uno hay que trabajar, en el otro hay que perseguir un pago.

---

# 3 · 🔴 LO QUE ENCONTRÓ LA AUDITORÍA DEL PROPIO DISEÑO

## Corrección 1 · El Trabajo tiene DOS EJES, no uno

La primera versión de la tabla tenía **el mismo error que B2**: colapsó en una columna dos cosas que las capturas muestran separadas.

`[MEDIDO]` — el detalle enseña **dos chips a la vez**: `[EN CURSO] [PAGADO]`. Y el listado lo confirma desde el otro lado: las **pestañas** son de cobro y las **secciones** son de trabajo.

* **Eje TRABAJO** — sin agendar → agendado → en curso → terminado
* **Eje COBRO** — pendiente → parcial → pagado

Un trabajo puede estar **terminado y sin cobrar**, o **en curso y pagado por adelantado**. Poner «Cobrado» como quinto estado detrás de «Terminado» era inventarse una secuencia que el producto no tiene.

### La primaria sale del CRUCE

| Trabajo | Cobro | Primaria |
| --- | --- | --- |
| Sin agendar | cualquiera | Agendar |
| Agendado | cualquiera | Empezar |
| En curso | cualquiera | Marcar terminado |
| **Terminado** | **pendiente o parcial** | **Cobrar** |
| Terminado | pagado | — |

**El caso que la tabla de un eje escondía: _terminado y sin cobrar_.** Es el estado más importante del negocio —el trabajo hecho y el dinero fuera— y no tenía fila propia.

⚠️ Los **ejes** están medidos; los **nombres de estado y las acciones NO**.

## Corrección 2 · G5 necesita un hueco declarado

G5 incluye una línea de «quedan 3 m por entregar» que **consume C6**, y C6 está bloqueada por **A0.2**.

No se declaró — que es **literalmente el fallo del hueco estructurado de B2**: usar el mecanismo en unos sitios y olvidarlo en otro.

**G5 se parte en dos mitades:** la que no depende de nada (presupuesto aceptado, trabajo terminado, factura emitida, cobrada) y la línea de «quedan N», que es **HUECO DECLARADO** y entra con C6. **Sin línea vacía ni «pendiente de calcular»: o está el dato, o no está la línea.**

---

# 4 · Lo que se construye

```
┌────────────────────────────────────────────────────────┐
│ Trabajos ›  Francisco Jiménez · Reforma baño             │
├───────────────────────────────────────────────────────┤
│ Francisco Jiménez   [EN CURSO][PAGADO]  [PRIMARIA] [sec] ⋮│
├─────────────────────────────────┬─────────────────────┤
│  QUÉ FALTA PARA COBRAR         │  CLIENTE                │
│  ALBARANES        (tabla, C3)  │  DÓNDE → abrir en mapa  │
│  GASTOS                        │  DINERO                 │
│  NOTAS INTERNAS                │  PRESUPUESTO → origen   │
│                                │  RESPONSABLE            │
└─────────────────────────────────┴─────────────────────┘
```

**G1** · El detalle con el patrón de **B2** y la primaria del cruce de ejes.

**G2** · **El título**: el Trabajo se llama por su nombre. El presupuesto pasa al rail como origen. `[SUPUESTO]` que existe un campo de descripción.

**G3** · **DATOS pasa al rail**, con 🏆 **enlace a mapa** — que no lo tiene nadie y es de lo más usado desde una furgoneta.

**G4** · **DOCUMENTOS se parte por tipo**: `QUÉ FALTA PARA COBRAR` · `ALBARANES` (la tabla de C3) · `GASTOS`. El **presupuesto** sale de la pila al rail (es uno y no cambia). Los **justificantes** se van al bloque DINERO, coherente con **B4**.

**G5** · **«Qué falta para cobrar»**:

```
✓ Presupuesto aceptado y firmado          24 jun
✓ Trabajo terminado                       19 jul
⬚ Falta emitir la factura                 → [Emitir factura]
⬚ Quedan 3 m de bajante por entregar      ← HUECO, entra con C6
```

🏆 **No lo tiene nadie**, y es la diferencia entre un producto que **guarda documentos** y uno que **te dice qué hacer**.

---

# 5 · Dependencias

**B2** (el patrón) · **C3** (la tabla de albaranes que G4 coloca) · **C6** («quedan N», hueco de G5) · **B4** (la separación factura/cobro que G4 aplica al rail).

# 6 · Lo que NO toca

El listado de Trabajos · el mecanismo de agenda · el cobro · la firma · `prisma/schema.prisma` · los albaranes en sí (**C**).

---

# 7 · 🔴 LO QUE HAY QUE MEDIR ANTES DE PARTIR EN TAREAS

**Este bloque NO se convierte en tickets hasta tener esto.** Es la tarea **G0**.

1. **Qué estados tiene un Trabajo de verdad, en los DOS ejes**, derivados del modelo.
2. **Qué acciones existen hoy en la vista**, con su línea y su **condición de aparición**. Censo derivado, como el de B2.
3. **Qué es «Iniciar precio en el parte»** y su relación con `modoValoracion`.
4. **Si existe un campo con la descripción del trabajo**, para el título de G2.
5. **Qué es «Tipo de trabajo»** (`Varios avisos o visitas sueltas`) y qué gobierna.
6. **Si la dirección del Trabajo es campo propio** o viene del cliente — lo necesita también **C5**.
