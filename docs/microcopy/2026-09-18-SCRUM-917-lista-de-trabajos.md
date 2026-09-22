# SCRUM-917c · la lista de Trabajos rediseñada: las dos cifras, el importe y el grupo de hoy

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-917 comentario 15881.

**Aplicado en el mismo acto** (regla 30), en el corte 917c (la LISTA, `jobsView.js`). La delegación es
la permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de
microcopy. Esta ficha **no** lleva la firma del fundador; el fundador aprobó el prototipo entero el
18-sep-2026 (SCRUM-917 comentario 15876) y los literales los firmó el orquestador.

La fuente de los literales es `docs/prototipos/SCRUM-917/textos-propuestos.md` (sección «La lista»).
Los dos singulares («en 1 trabajo sin cerrar», «1 sin importe de referencia, no entra») tienen su
propia ficha en este directorio, porque se firmaron en otro comentario (el 15938).

## Formato aprobado, literal

> Para hoy · {N} trabajos

> Por cobrar · {importe}

> en {N} trabajos sin cerrar · {N} sin importe de referencia, no entran

> {importe que falta} / de {importe de referencia}

> ✅ Terminados — cobra el resto · {N} · {importe} por cobrar

`{N}` es un recuento y `{importe}` un importe formateado como el resto de la pantalla (`fmtMoneyEs`).
Ejemplos, tal como se pintan: «2 trabajos», «5.356,61 €», «en 7 trabajos sin cerrar · 2 sin importe
de referencia, no entran», «740,00 €» sobre «de 1.240,00 €».

Con N = 0 en «en N trabajos sin cerrar» esa parte del pie **no se pinta** (queda escrito en SCRUM-917
comentario 15938): no es un texto nuevo, es no pintar uno.

## Texto aprobado: sus partes fijas, tal cual están en el código

Una plantilla con huecos no aparece nunca literal en el código (la compone), así que lo que se cruza con
el código (guard SCRUM-514) son sus partes fijas y los textos enteros:

> Para hoy

> trabajos

> Nada para hoy.

> Por cobrar

> sin cerrar

> sin importe de referencia,

> no entran

> Sin importe

> no hay presupuesto aceptado

> ✓ Cobrado

> por cobrar

> 📅 Hoy

## Dónde se pinta

`public/dashboard/js/jobsView.js`:

- `pintarCifrasDeLaLista` — las dos cifras, antes de la lista: «Para hoy» (valor «N trabajos» y pie con los
  clientes, o «Nada para hoy.») y «Por cobrar» (valor, y el pie «en N trabajos sin cerrar · N sin importe de
  referencia, no entran»). «Por cobrar» no se pinta si la lista llega con 200 filas (el tope del servidor) ni
  si hay más de una moneda.
- `celdaImporte` — la cifra grande de cada fila es lo que falta, y debajo «de {importe}»; «✓ Cobrado» cuando
  no falta nada; «Sin importe» / «no hay presupuesto aceptado» cuando no hay eje de cobro.
- `renderJobRows` — la cabecera de grupo nueva «📅 Hoy», y «por cobrar» detrás de la suma en la cabecera de
  Terminados.

## Qué cambió

- Antes la lista no decía en euros cuánto faltaba por cobrar en ningún sitio.
- Antes la cifra grande de cada fila era el total del presupuesto y debajo «0,00 € de 417,45 €».
- Antes una fila sin presupuesto enseñaba «—».
- «Sin asignar» (firmado el 4-sep-2026) no cambia de palabra: con equipo sigue en el desplegable de la fila;
  sin equipo ya no se pinta.

## Qué queda sin firmar o sin aplicar

- 🔴 «cobrado 628,60 € de 539,05 €» y «⚠︎ cobrado de más · 89,55 €» **NO están firmados** (comentario 15881):
  esperan a que la Sesión 1 decida si cobrar de más es legítimo. Esas filas se pintan como hoy.
- «Por cobrar» en una barra fija de abajo en móvil (textos-propuestos, «Móvil»): **no se construye** en 917c.
  Medido: el botón de ayuda fijo (`#tut-help-btn`) queda encima del botón de esa barra (1.664 px² de solape a
  390, 360 y 640 px). Consta en SCRUM-917 comentario 15938.
- Los textos del DETALLE firmados en el mismo comentario se registran con su corte (917e), cuando se apliquen.
