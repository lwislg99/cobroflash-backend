# SCRUM-930 — Guardar plantilla con descripción y descuento

**Medido contra:** `origin/main` = `c4ea45bb2a106516fb8a250fa76b5c4febb6becc` · 2026-09-26T13:15:47Z

## PASO 0 (Sesión 1, 26-sep-2026): la premisa del ticket era medio falsa

| Pieza | Estado medido en el repo | Quién |
|---|---|---|
| Descripción | El presupuesto NO tiene descripción de documento: es la descripción **por línea**. Ya viaja en `lines` (JSONB) y `templates.routes.ts` la guarda sin mirarla. Se pierde en dos puntos del front: al guardar (`quotesView.js`, `saveTemplateBtn` arma cada línea sin `description`) y al cargar (`cargarPlantilla` llama a `addLine` solo con concept/qty/price/tax). `addLine` ya la sabe pintar. | S2, sin servidor ni esquema |
| Descuento | `QuoteTemplate` no tiene columna. La mitad de carga YA está construida (`quotesView.js`, SCRUM-926, lee `template.discountGlobalAmount`), pero solo le llega al duplicar. | ② ALTER → ③ S1 + S2 |
| Suplido | Fuera por decisión del ticket. | — |

**Decisión (orquestador, 26-sep-2026): IMPORTE, no porcentaje.** Mismo nombre, tipo y semántica que `quotes.discount_global_amount`. Los tres motivos están en la cabecera del `.sql`.

## Entregado en esta rama: el ② preparado

- `docs/sql/scrum-930-descuento-de-plantilla.sql`: `ALTER TABLE "quote_templates" ADD COLUMN IF NOT EXISTS "discount_global_amount" DECIMAL(12,2);`
- Generado offline con `node scripts/preview-migracion.mjs --desde`. Control positivo de 31 tablas. Veredicto ADITIVA. `prisma/schema.prisma` NO se toca en esta rama (regla 40).

## Lo que falta, en orden

1. **②** El equipo de Javier aplica el `.sql` en staging → `yaqu_dev_javier` → producción (con GO aparte).
2. **③ S1**: la columna en `schema.prisma`; `templates.routes.ts` la acepta en POST/PUT y la devuelve en GET; tests (una plantilla vieja sin columna se sigue cargando).
3. **S2**: enviar `discountGlobalAmount` y `description` por línea al guardar. Y en `cargarPlantilla`, pasar `description` y aplicar el descuento. ⚠️ La lectura de SCRUM-926 vive en `loadInitialData`, que es el camino del argumento `template` (el de duplicar), NO en `cargarPlantilla`, que es el de «📋 Usar plantilla» y el de las fichas. Hay que reutilizar ese gesto también allí.

# APÉNDICE · SCRUM-930 (mitad de S2 que no espera a nadie) · La plantilla guarda y devuelve la descripción y el «Dto. %» de cada línea

**Medido contra:** `origin/main` = `33f07c332c3c95fe1656f640184c5d340e519f5d` · 2026-10-07T06:26:37Z
A9: sin fallo que generalice — dos guards vecinos cayeron al primer intento (`scrum139`: el camino de carga dejó de tener la forma que él cuenta; `scrum237`: una negación del test nuevo sin respaldo) y los dos se arreglaron en el código y en el test antes de empujar

**Skill UI:** no cargada · no toca ninguna vista, componente, texto ni CSS: cambia qué claves viajan dentro de `lines` al guardar una plantilla y qué campos YA EXISTENTES de la línea rellena al cargarla. Un fichero de `public/dashboard/js` (`quotesView.js`).

7-oct-2026 · **S2** (`s2-7octa`) · rama `scrum-930-plantilla-guarda-descripcion`.

## Qué entra y qué NO

| Pieza | Antes | Ahora | Estado |
|---|---|---|---|
| Descripción de la línea, al GUARDAR | no viajaba (`{concept, qty, price, tax}`) | viaja como `description` si no está vacía | **hecho** |
| «Dto. %» de la línea, al GUARDAR | no viajaba | viaja como `dto` si es mayor que 0 (misma función que el payload del presupuesto, `descuentoParaPayload`) | **hecho** · desviación declarada, abajo |
| Las dos, al CARGAR por la ficha rápida o por «Usar plantilla» dentro del editor (`cargarPlantilla`) | sólo se pasaban cuatro campos a `addLine` | se pasan también `description` y `dto` | **hecho** |
| Las dos, al CARGAR por «Usar» desde Plantillas (la plantilla como argumento) | ese camino ya pasaba la línea entera a `addLine`; no traía nada porque nada se guardaba | igual; ahora trae lo guardado | sin tocar |
| Suplido | no se guardaba | **sigue sin guardarse** (decisión del ticket) | fijado por test |
| Descuento GLOBAL del presupuesto (importe) | no se guarda: `quote_templates` no tiene columna | **igual** | 🔴 **NO HECHO**: espera ② (el ALTER de arriba) y ③ (S1) |
| Documento suelto | — | una plantilla con descripción o descuento **no** los carga allí | fijado por test |

**El ticket NO se cierra con esta entrega: falta el descuento global**, que sigue donde lo dejó el PASO 0.

## Desviación declarada: el «Dto. %» de línea

El ticket dice «Descuento: SÍ» y la decisión del 26-sep fijó que el descuento GLOBAL se guarda como
importe, en una columna que hoy no existe. El descuento de LÍNEA (el porcentaje de la hoja «Ajustes
de la línea») no estaba en aquel PASO 0 y viaja dentro de `lines`, como la descripción: no necesita
columna ni servidor. Lo he metido porque es el caso literal del ticket («a comunidades, un 10 %») y
porque hoy se pierde en silencio: una plantilla hecha de un presupuesto con un 10 % en la línea crea
presupuestos a precio entero. **No lo decidió nadie por escrito: es lectura de S2.** Si no vale, se
quita en dos sitios (`descuentoParaPayload(...)` al guardar y `dto: dto` al cargar) y cae el test.

El descuento cargado **se ve antes de enviar** (el NEGATIVO del ticket): baja el total de la línea
y la ficha de la línea deja de estar oculta y lo nombra. Lo afirma el test.

## 🔴 El documento suelto

En el documento suelto la descripción y el «Dto. %» no se pintan, porque el emisor los descarta
(SCRUM-616). Pero los nodos existen, y la vista previa calcula con el valor del campo aunque no se
vea. Sin guarda, una plantilla con un 10 % cargada allí bajaba el total de la línea de 108,90 a 98,01
con un descuento que el profesional no ve y que el documento emitido no recoge. `cargarPlantilla` no
pasa ninguno de los dos campos en ese modo. **Leído y ejecutado en el banco; el camino de emisión no
se toca ni se lee más allá de eso (regla 38).**

## Verificado, ejecutando

- `tests/scrum930-plantilla-guarda-descripcion-y-dto.test.mjs`, 7 casos, en el banco de vistas
  (el editor ejecutado, la hoja de ajustes abierta y cerrada como la abre el profesional, un servidor
  de plantillas en memoria): **rama 7 de 7**.
- **En rojo:** con el `quotesView.js` de `origin/main`, 7 casos · 2 pasan (los dos controles) · 5 caen.
  Con un mutante de la rama sin la guarda del documento suelto, cae sólo ese caso («el total de la
  línea sale rebajado por un descuento que en el documento suelto no se ve ni se emite»).
- Vecinos: los 69 ficheros de `tests/` que nombran `quotesView`, en dos mitades.

## Lo que NO se ha podido mirar

- **Nada en yaqu.app todavía** (no está desplegado al escribir esto): se mira con la sonda al desplegar.
- El coste de la línea (`costeUnitario`) tampoco se guarda en la plantilla: no está en el ticket y no se ha tocado.
- Móvil y otro navegador.
