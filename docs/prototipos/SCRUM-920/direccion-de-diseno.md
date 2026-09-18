# SCRUM-920 · Dirección de diseño de Gastos

Rediseño 4/4 (tras 915, 917 y 916). El fundador lo quiere **«moderno, elegante y fácil»**, y el ticket lo concreta:
**apuntar un gasto en segundos desde el móvil, con la foto del ticket primero**. Prototipo: `gastos.html`. Lo que hay
hoy, medido: `inventario-hoy.md`. Las cuentas: `medicion.md`.

## 1 · La regla que ordena lo demás

> 🔒 **Casi todo está bien decidido y mal presentado.** Los catorce campos del alta tienen cada uno su motivo
> (SCRUM-403, SCRUM-324 E3, SCRUM-135); los tres KPI y los filtros hacen falta. Lo que falla es el ORDEN, el TAMAÑO y
> lo que NO se ve.

Lo mal decidido son cuatro cosas, y son las que el prototipo cambia de verdad:

1. **La foto es el campo 14 de 14.** Lo único que se hace con el papel en la mano va al final de un modal de 760 px.
2. **El justificante no se ve en la lista.** En una pantalla que la matriz de competencia llama «gastos y
   justificantes».
3. **La tabla se recorre de lado a 390 px** (628 px de columnas en 390 de ancho, dentro de su caja).
4. **Un gasto no se puede LEER, sólo editar.** Tocar la fila abre el modal de edición.

## 2 · El alta: la foto primero, y decir cuándo se puede parar

Tres bloques en vez de catorce campos seguidos:

1. **La foto del ticket.** «📷 Hacer foto» a ancho completo y «Elegir foto o archivo» debajo. Y una salida explícita,
   «Ahora no tengo el ticket», porque la foto va primero pero **no es obligatoria** (hoy no lo es y no se cambia).
2. **Qué es y cuánto.** Los dos obligatorios de hoy (concepto e importe, el importe grande) más fecha, categoría y
   trabajo. Y una línea que hoy no existe: «✓ Con esto ya se guarda. Lo de abajo es opcional.» Con doce campos
   opcionales sin marca, parecen doce obligatorios.
3. **Lo opcional, plegado:** los siete datos de la factura del proveedor (proveedor, NIF, nº, fecha, base, tipo,
   cuota) juntos, porque se rellenan en el mismo momento —con la factura delante—, y las notas.

**Ningún campo se retira**: los catorce siguen, medido (la foto es su input de fichero de siempre).

En móvil, **«Añadir gasto» va fijo abajo** con «Cancelar». Con la foto hecha y el importe puesto, el gasto se guarda
sin bajar 1.500 px.

**El ticket dice «IVA» en segundo lugar**, detrás del importe. No lo sigo al pie de la letra y lo digo: el IVA va en el
bloque plegado porque no es obligatorio, y subirlo al bloque 2 vuelve a poner siete campos entre la foto y el botón.
Si el fundador lo quiere arriba, es mover un bloque.

### El hueco de la lectura del ticket (SCRUM-912)

La lectura con IA es de la S1 y está parada. Aquí **sólo se dibuja dónde cae**, detrás de un andamio apagado por
defecto («Con lectura del ticket (SCRUM-912, no existe)»): con la foto hecha, el importe y la fecha llegan rellenos,
cada uno con una marca «leído de la foto», y un aviso encima pide revisarlos: **lo que se guarda es lo que ponga el
profesional**. Sin foto no se lee nada, y el formulario entero funciona sin la lectura. Qué campos lee es decisión
de 912; el prototipo enseña dos porque son los que un ticket de caja trae siempre.

### «Foto o archivo»

El ticket dice «foto o archivo», y la factura del proveedor llega en PDF. Hoy el campo acepta sólo imagen. Se
**propone** aceptar también PDF; el tamaño de lo que se guarda en `receiptData` (base64) lo decide la S1.

## 3 · La lista: el justificante a la vista, y sin recorrerla de lado

- **El justificante, en cada fila**: «Foto guardada» con la miniatura del ticket, o «⚠︎ Sin foto». Es un HECHO sobre
  el archivo que guardamos —la foto está o no está—, no una afirmación sobre lo que Hacienda admite.
- **Dos chips con su cuenta**: «Todos · 9» y «Sin foto · 3». La cuenta es lo que hace accionable el dato.
- **Filtro por trabajo**, que pide el ticket y hoy no existe (el dato ya viaja en `item.job`).
- **Filas en rejilla, no tabla.** A 1280, cinco columnas; a 390, cada fila se reordena en tres renglones (qué y
  cuánto · categoría y justificante · trabajo y «⋯») sin desbordar. **0 cajas que desbordan a 390**, medido.
- **La papelera de 21 × 29 px se va al «⋯»** de la fila, a 44 px, separada del gesto que navega.
- **Una cifra, una vez.** El total del mes sale en el KPI y **en ningún otro sitio**. Con filtros aparece otra cifra
  —la suma de lo que se ve— con su salvedad: «Es la suma de lo que estás viendo, no la del mes.» El borrador de
  anoche lo sacaba tres veces en la primera pantalla de 390 (KPI, cabecera del mes y barra fija), que es el defecto
  que la v1 de 917 metió con «620,00 €» cinco veces.
- **Los tres KPI, en móvil, en una tarjeta de tres renglones.** Apilados en tres tarjetas, la primera fila de gastos
  caía por debajo de la mitad de la pantalla.
- **El trabajo se llama como en Trabajos**: «Presupuesto #5 · María López», no «Trabajo». Hoy Gastos lee el título
  crudo y Trabajos usa `tituloDeTrabajo()` (SCRUM-944).

## 4 · El detalle: lo que hoy no existe

Cabecera con concepto, fecha, categoría, justificante e importe; «Editar» y «Ver el trabajo» a mano; el resto en «⋯».
Debajo, **el justificante grande**, en su tarjeta, lo primero. Sin foto, un bloque propio que lo dice y ofrece
«📷 Añadir la foto ahora».

### 🔴 Lo que el detalle NO enseña, a propósito

El motor del justificante (`justificante.ts`) ya devuelve un veredicto y una lista de «qué falta», y la pantalla no
pinta nada de eso **a propósito**: roza una afirmación fiscal y espera al asesor (SCRUM-324 E3). El orquestador lo
acotó el 18-sep: ni el veredicto ni la lista, tampoco como «cuarta vía».

Y aquí había una trampa sin querer. El borrador pintaba los seis datos de la factura con un «—» en cada vacío: en la
Gasolina salía **una columna de seis guiones bajo «Datos de la factura del proveedor»**. Eso ES la lista de «qué le
falta» del motor, puesta por la puerta de atrás. Por eso el detalle enseña **sólo los datos que el profesional
apuntó**, y si no apuntó ninguno, la tarjeta no se pinta. El instrumento lo vigila (`medir.mjs`: 0 datos y 0 guiones
en la Gasolina).

Tampoco se toca «NIF del proveedor»: se enseña como dato apuntado, igual que hoy. Que no alimente el veredicto es
SCRUM-937 (S1).

## 5 · Lo que NO se toca

El alta desde la ficha del Trabajo (SCRUM-135, con su propio `onSaved`); el vínculo por `quoteId`; el trabajo sin
presupuesto deshabilitado con su motivo (SCRUM-89); el NIF que se rellena solo al elegir proveedor (SCRUM-324 E3); el
estado vacío palabra por palabra; «Nuevo gasto» con su atajo «N» (firmado, SCRUM-769: cambia de sitio en móvil, no de
texto); la exportación a CSV con los filtros aplicados.

## 6 · Tokens

Los de `DESIGN.md`, los mismos que 915, 917 y 916; los cinco colores de categoría son los de hoy
(`CATEGORY_LABELS`). La variante `btn-sm` no baja de 44 px de alto: `DESIGN.md` la exime a 30 px con su motivo, y
aquí se mide contra el pulgar en obra (declarado en `medicion.md`).
