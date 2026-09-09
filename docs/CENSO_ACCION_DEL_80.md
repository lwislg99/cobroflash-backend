# Las cinco listas del panel · ¿la acción del 80% y a cuántos clics?

**Encargo del fundador, 8-sep-2026.** Medición y veredicto. **No hay propuesta de rediseño.**

**Medido contra:** `origin/main` = `0e8c589a78f913f550db55277c80b3ec5ec295c2` · 2026-09-08
**Árbol medido:** rama `scrum-823-la-escalera-mira-el-estado`, con SCRUM-816 y SCRUM-823 dentro.
**Cómo:** Edge, `page.setViewport` a 1700 px, el producto pintándose de verdad
(`npm run censo:accion-del-80` y `npm run censo:clics-del-80`). **Pulsando, no leyendo.**

> ⚠️ Trabajos se mide **con el 816 dentro**, así que sale a 1402 px. En `main` sigue en 978 por
> `.jobs-pantalla { max-width: 980px }`. El dato del fundador es correcto para `main`; éste
> describe el árbol que va a mergear.

---

## Lo medido

| Lista | Columnas | Controles **en la fila** | Primario en la fila | La fila abre el documento | Casilla |
|---|---|---|---|---|---|
| **Trabajos** | 5 | **6** · desplegable de técnicos + 4 casillas + 1 primario | **sí**, y cambia con el estado | sí, por el router | sí |
| **Presupuestos** | 8 | **1** · «Ver detalle» | no | sí, **sin pasar por el router** | no |
| **Facturas** | 7 | **1** · una casilla, nada más | no | sí, por el router | sí |
| **Albaranes** | 6 | **0 acciones** · dos enlaces de navegación | no | **no** | no |
| **Clientes** | 9 | **4** · casilla + Editar + Portal + 📊 Historial | no | sí, por el router | sí |

Las cinco miden **1402 px de 1700** (ya con el 816 dentro).

---

## La acción del 80%, y su coste

El «80%» lo pongo yo, del oficio; el número de clics está medido.

| Lista | Lo que se hace casi siempre | Clics hoy | |
|---|---|---|---|
| **Trabajos** | repartir el día: agendar, empezar, asignar técnico | **1–2** | la acción está en la fila y **cambia con el estado** |
| **Presupuestos** | crear uno nuevo; y de los abiertos, ver si lo han aceptado | **1** | «Nuevo presupuesto» en la barra; «✓ Aprobar» en la fila |
| **Clientes** | encontrar a alguien y abrir su ficha | **1–2** | buscador arriba, tres acciones en la fila |
| **Facturas** | marcar cobrada la que acaba de pagarse | **2** | casilla + «✓ Marcar como pagadas» **en la barra, no en la fila** |
| **Albaranes** | emitir el que el técnico acaba de traer, o mandarlo a firmar | **2**, y el 1º no es un botón | hay que acertar con el enlace del número |

---

## 🔴 Veredicto: la peor es **ALBARANES**

Y no por poco. Es **la única de las cinco cuya fila no deja hacer NADA con el documento**.

**Los tres hechos que lo deciden, medidos:**

1. **Cero acciones en la fila.** Sus dos únicos elementos pulsables son enlaces de navegación: el
   número del albarán y el nombre del Trabajo. Las otras cuatro tienen al menos una casilla; tres
   tienen botones.
2. **La fila no se anuncia como pulsable** (`cursor: auto`). Trabajos, Presupuestos, Facturas y
   Clientes usan `cursor: pointer` en la fila entera. Aquí sólo son pulsables los dos enlaces
   —verdes y con `pointer`, eso sí—, así que el usuario tiene que **acertar con la palabra**, no
   con la fila.
3. **Tiene una columna con la clase `cell-actions`, y dentro hay un enlace al Trabajo.** No una
   acción: una navegación. La única de las cinco donde la ranura de acciones está ocupada por otra
   cosa.

**Por qué eso duele más aquí que en ninguna otra:** el albarán es el documento de la cadena
Tecnosel —el técnico lo trae de la obra y la oficina lo emite y lo manda a firmar—, y su estado
está **pintado en la propia fila** (`Borradores 1 · Emitidos 1 · Firmados 0` en los filtros, y una
columna «Estado»). La pantalla **sabe** en qué estado está cada uno y **no ofrece el paso
siguiente de ninguno**: hay que entrar a cada documento para hacer lo que la lista ya sabía que
tocaba.

🔒 *Una pantalla se ordena por lo que se hace en ella.* Ésta está ordenada por lo que se
**consulta**.

### La segunda peor: **Facturas**

Tampoco tiene ninguna acción nombrada en la fila —sólo la casilla— y su acción del 80% («marcar
cobrada») vive **en la barra de arriba**, a dos clics y separada de la fila que la origina.

Se queda por detrás de Albaranes por una razón concreta y a su favor: **la vía en lote es la
correcta para su caso**. Marcar cinco facturas pagadas cuesta 6 clics, no 10. Albaranes no tiene
ni eso.

### Las tres que están bien, y por qué

- **Trabajos** — tras 816/823 es la única cuya acción principal **cambia con el estado de la
  fila**, y se ejecuta ahí mismo. Es el patrón que le falta a Albaranes.
- **Presupuestos** — su 80% es *crear*, y crear está a un clic en la barra. Correcto.
- **Clientes** — su 80% es *encontrar*, y el buscador está arriba. Correcto.

---

## Dos hallazgos de camino (reportados, no tocados)

1. **Presupuestos navega SIN pasar por el router.** `quotesListView` llama a
   `renderQuoteDetailView(contenedor, id)` directamente y reemplaza el contenedor. Consecuencia:
   no deja rastro en el historial — el botón «atrás» del navegador no vuelve a la lista. Es la
   familia de SCRUM-819 (`guard:rastro-del-menu`), que hoy mide los 17 destinos del **menú** y no
   los saltos desde una fila.
2. **`invoicesView` carga con `fetch` crudo**, no con `apiRequest` (ya reportado por la
   certificación del 816). Aquí volvió a morder: los dos censos leyeron **«0 controles en la
   fila»** para Facturas, y era `skeleton-row` — **cero por no haber pintado, no por no haber
   botones**. Se arregló el instrumento (el banco ahora sirve esas rutas), no el producto.

## Lo que este censo NO dice

- **No propone rediseño.** El encargo era medir y dar veredicto.
- **El «80%» es mi criterio de oficio, no una medición de uso.** No hay analítica de clics en el
  producto; si la hubiera, esta tabla se contrastaría contra ella y podría cambiar.
- **Se mide UNA fila por lista.** La pregunta es «qué se hace con un documento»; sumar veinte
  filas multiplica la misma respuesta por veinte.
- **A 1700 px y en escritorio.** El móvil reordena las cinco en cards y es otra medición.
