# SCRUM-1050 · Facturar operaciones exentas y no sujetas a IVA — MEDICIÓN, NO se construye

**Fecha:** 23-sep-2026 · **Carril:** J1 (camino de emisión) · **Gate:** STOP fiscal (reglas 29, 38, 40) — **Javier decidió NO construir por ahora** (Jira, comentario 16593). Esta entrada es sólo la medición, para que el día que aparezca un caso real esto sea una tarde de trabajo y no una investigación desde cero.
**Medido contra:** `origin/main` = `13e967cde072faacf8abb4c3d15019a25ad9b721` · 2026-09-23T10:12:36Z

## Encargo

SCRUM-1050 («hoy una línea al 0 % no se puede sellar») lleva la etiqueta `esperando-asesor` y
depende explícitamente de Q-C9 (SCRUM-1039): *"hasta que se responda y se cite, NO se
implementa nada"*. Esta entrada comprueba si esa espera sigue vigente y mide el defecto con el
código real, sin tocar el camino de emisión.

## PASO 1 — ¿sigue esperando asesor?

**No.** El apéndice de hoy de `docs/master/SCRUM-1023.md` (mapa de las 35 preguntas agrupadas)
clasifica **Q-C9 entre los 17 grupos que NO necesitan asesor nuevo**: ya tiene cita verificable
(`docs/legal/PREGUNTAS_ASESOR.md`, sección Q-C9 — LIVA art. 7 completo + art. 20.Uno cabecera y 5
apartados), pendiente sólo de que Javier la confirme, no de una consulta externa.

Los códigos AEAT que hacen falta para construir —S2 (ISP), N1 (no sujeta), E1 (exenta art. 20)—
están además **cotejados el 23-sep (SCRUM-1088) contra el XSD oficial ya vendorizado en este
repo** (`src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd`), no de memoria ni de la
skill.

**Matiz que no decido yo:** Q-C9 concluye que, de los 12 supuestos del art. 7 y los 5 primeros de
20.Uno revisados, **ninguno aplica a la venta ordinaria de un oficio**. El único caso con cita
fuerte y uso real (obra/subcontrata, S2 = inversión del sujeto pasivo) es justo el que este
ticket **excluye a propósito** («desbloquea Inversión del sujeto pasivo» = otro ticket). E1/N1
quedarían como mecanismo genérico **sin caso de uso citado todavía** para un oficio de YaQu. Es
alcance de producto, no un hecho medible — lo dejo escrito para quien dé el GO, no lo resuelvo
aquí.

## PASO 3 — el defecto, medido con el código real (no creído)

Fabriqué una factura con una línea al 0 % y la pasé por el clasificador que usa
`buildVerifactuRegistrosXml` antes de sellar (`src/modules/invoicing/domain/verifactu.service.ts:791`
→ `clasificarDetalleDesglose`, `src/modules/fiscal/verifactu/registro.builder.ts:298-318`), contra
el `dist/` ya compilado, sin modificar código:

```
calcVatBreakdown -> {"entries":[{"rate":0,"base":100,"cuota":0}],"base":100,"cuota":0}
RECHAZADA por DesgloseNoClasificableError :: verifactu_desglose_no_clasificable:2026-CF-999 —
tramo de IVA al 0% (base 100.00): no se puede saber si es sujeta al 0%, exenta (art. 20 LIVA) o
no sujeta, y cada una declara una cosa distinta. El dato que las separa no está en las líneas de
la factura. Se bloquea la emisión en vez de elegir un código: adivinarlo es declarar en falso.
```

Y en factura mixta (línea al 21 % + línea al 0 %): la línea al 21 % SÍ se clasifica (`S1`), la
del 0 % tumba el desglose entero con el mismo error. **Confirmado: hoy una línea al 0 % no se
puede sellar**, exactamente como dice el enunciado del ticket — no es una afirmación sin medir.

El propio código ya documenta la causa (comentario en `registro.builder.ts:283-297`): `tax: 0`
no distingue sujeta-al-0 / exenta / no sujeta, y `VatLine` (`Invoice.lines`) sólo guarda `qty`,
`price` y `tax` — ese dato no existe hoy en la línea.

## Schema

`Invoice.lines` es `Json` (`prisma/schema.prisma:637`), no relacional. Añadir una `causa` por
línea **no necesita ALTER**: es una extensión del objeto JSON, no una columna nueva.

## Lectura de fondo (dejada por Javier, no decidida por esta sesión)

Que una línea cuya causa fiscal nadie ha declarado **se niegue a sellarse** puede ser el
comportamiento CORRECTO, no el defecto: sellar una `S1`/`E1`/`N1` adivinada sería declarar en
falso ante la AEAT, y eso es peor que rechazar la línea. El `DesgloseNoClasificableError` de hoy
no es necesariamente un hueco que rellenar con urgencia.

## Estado

**NO se construye.** Con el matiz de Q-C9 delante (ningún supuesto de art. 7/20.Uno aplica a la
venta ordinaria de un oficio; el único caso con cita fuerte, ISP, es de otro ticket), construir
`E1`/`N1` hoy sería mantener y probar un mecanismo para el que no hay caso de uso citado. Javier
decidió esperar a un caso real.

**El ticket SCRUM-1050 NO se cierra ni se transiciona**: no está resuelto, está esperando un
caso. Lo que sí queda cerrado es la pregunta del PASO 1 (Q-C9 ya no bloquea) y la medición del
PASO 3 (el defecto es real y está localizado con precisión).

## Lo que NO cubre esta entrada

* No construye el selector, la validación ni el guardado de la `causa`.
* No decide el alcance (E1/N1 completos, o descontarlos por falta de caso de uso citado).
* No repropaga la confirmación de Q-C9/F a sus tickets bloqueados — eso es de quien lleve
  SCRUM-1023.
