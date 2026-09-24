# La tabla que se recorre de lado: no es de Gastos, es del sistema

Encargo de fondo de SCRUM-920. **No se resuelve aquí**: se deja escrito con las cuentas para que el orquestador decida
si abre un ticket transversal. Medido el 18-sep-2026 a las **07:01:21Z** (hora de GitHub) sobre
`origin/main = 16733a223b3d09d3fdf03bf03c67a2b278b4906c`.

## 1 · La causa, leída del código

`public/dashboard/css/styles.css:1944-1948`:

    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll .table { min-width: 520px; }

**El scroll lateral es el comportamiento POR DEFECTO.** Toda tabla metida en un `.table-scroll` mide al menos 520 px, y
a 390 px de pantalla eso es arrastrar. Para no hacerlo, cada pantalla tiene que **apuntarse** a una de dos salidas:
`table--cards-mobile` (`styles.css:2581`) o `table--stack-mobile` (`:2702`). La que no se apunta —por olvido, o
porque se escribió antes de que existieran— hereda el defecto sin que nadie lo decida.

> 🔒 **Cuando lo seguro es opcional, lo inseguro es lo que pasa solo.**

## 2 · Las cuentas, MEDIDAS en pantalla

`medir-tablas-390.mjs`: staging, sesión QA, 390 × 844 táctil, sólo lectura. Mide cada `.table-scroll` visible
(`scrollWidth` frente a `clientWidth`). Control positivo: una caja sembrada de 600 px en 200 — **la ve**.

| vista | filas | ¿se recorre de lado? | la tabla lleva |
|---|---|---|---|
| **Gastos** (`expenses`) | 4 | 🔴 **sí · 600 > 366** | `table` (y `min-width:600px` en línea) |
| **Productos** (`products`) | 1 | 🔴 **sí · 520 > 364** | `table` |
| **Informes** (`reports`) | 36 en 3 tablas | 🔴 **sí, las 3 · 520 > 324 · 420 > 324 · 520 > 324** | `table` |
| Libro registro (`libro-registro`) | 9 | sí · 520 > 364, **A PROPÓSITO** (ver §3) | `table` |
| Cobros | 9 | no | `table--cards-mobile` |
| Presupuestos | 14 | no | `table--cards-mobile` |
| Clientes | 6 | no | `table--stack-mobile` |
| Proveedores | 1 | no | `table--stack-mobile` |
| Facturas | 1 | no | `table--cards-mobile` |
| Plantillas | 1 | no | `table--stack-mobile` |
| Trabajos | 15 | no | `table--cards-mobile` |
| Albaranes | 8 | no | `table--cards-mobile` |

**4 vistas y 6 tablas se recorren de lado hoy; 8 vistas no.** La regla sale sin excepción en las doce: **las que
desbordan son exactamente las que no llevan ninguna de las dos clases**. De esas cuatro, **una lo hace a propósito**
(Libro registro, §3) y **tres sin que conste ninguna decisión**: Gastos, Productos e Informes (5 tablas). Más el editor
de presupuesto, donde lo midió SCRUM-139 F1 y se arregló allí mismo.

**Lo que NO se ha medido, y por qué** (un cero sin población no es un hallazgo):
- **Inicio** (`home`): hay una tabla con `min-width:420px` en línea (`homeView.js:681`), pero en la cuenta de QA no se
  pintó ninguna. **Sin población: no se sabe.**
- **Ficha del cliente** (`customerDetailView.js:234`): necesita un cliente abierto; el barrido no entra en fichas.
- Partes por valorar, Solicitudes y Equipo no pintaron ningún `.table-scroll`.

## 3 · Libro registro: bien decidido, y el motivo sigue vivo

`libroRegistroView.js:248-257` lo dice: «NO lleva `table--cards-mobile` (el patrón de Facturas), y es una decisión:
esa variante apila la fila en una rejilla de CINCO áreas fijas […] y este libro tiene ocho columnas […]. Un libro de
registro es un documento ANCHO: scrollea dentro de su envoltorio, y la página no.» Hoy sigue teniendo ocho columnas:
**el motivo está vivo**. No es un defecto; es el caso para el que tendría que existir una forma EXPRESA de pedir el
scroll (§4).

Y de paso, por qué el censo del código no bastaba: antes de medir se contaron las vistas que **mencionan** alguna de
las dos clases, y Libro registro salía como «apuntada» — la mención es justo ese comentario que dice que NO la lleva.
Buscar el nombre de una clase en un fichero cuenta menciones, no tablas.

## 4 · Lo que esto sugiere, para quien decida (no es una decisión)

Arreglarlo pantalla por pantalla es lo que se ha hecho hasta ahora: el editor en 139, Gastos en 920, y quedan
Productos e Informes. **Cada pantalla nueva vuelve a nacer con el defecto**, porque el defecto es el valor por
defecto. Las dos formas de cortarlo que se ven desde aquí:

1. **Invertir el defecto**: que una tabla dentro de `.table-scroll` se apile en móvil salvo que se apunte
   EXPRESAMENTE al scroll, como hace hoy Libro registro con su motivo escrito (y quizá Informes, si alguien decide
   que son documentos anchos). Toca `styles.css`: carril S2.
2. **Un guard** que falle si una tabla en `.table-scroll` no lleva ninguna de las dos clases ni una excepción
   declarada con su motivo. Carril S3. Con su positivo: hoy tendría que salir rojo en Gastos, Productos e Informes, y
   Libro registro entraría como excepción declarada.

El 1 arregla las que hay y las que vengan; el 2 sólo impide las que vengan. Ninguno se ha probado.
