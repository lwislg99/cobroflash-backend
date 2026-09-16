# SCRUM-322 · E1 · PASO 0: el canal existe, la entrega no, y la pregunta legal no está contestada

**Medido contra:** `origin/main` = `b8b8afd9b572cd72c531ad335eb42dfe0948ca43` · 2026-08-11T19:50:35+02:00
**Rama:** `scrum-322-envio-asesor` · **Cero construcción**: esta tarea solo lee.

> ⚠️ **PARO en (b), y lo pide el propio encargo.** El envío saca del producto datos personales
> **de los clientes del profesional**, no solo suyos. Lo de abajo es la medición completa; la
> decisión es del fundador y la respuesta legal, del asesor.

---

## (a) Qué existe ya del envío al asesor — **medido, no contado**

**SUELO:** el censo de lo entregado del bloque E devuelve **tres entradas** (`SCRUM-321` = E0,
`SCRUM-324` = E3, `SCRUM-325` = E4). No es cero, así que lo de abajo significa algo.

### Lo que SÍ existe

| pieza | estado |
|---|---|
| **E0 · el recon del bloque** (`SCRUM-321`, 5-ago) | las nueve preguntas medidas con suelo en cada derivación |
| **E3 · el modelo del gasto** (`SCRUM-324` medición + la UI ya mergeada) | tres campos + el aviso de factura simplificada |
| **E4 · el libro por trimestre en un fichero** (`SCRUM-325`, 7-ago) | **construido**, corre en `npm test` |
| **el canal de correo** | Resend, **11 emisores**, y los adjuntos **ya se usan en producción**: la factura viaja siempre con su PDF |

### Lo que NO existe, y es lo que este ticket tendría que construir

🔴 **No hay ningún envío a un tercero. Ni uno.** Todo lo que el producto entrega hoy es una
**descarga que hace el propio profesional**, y las cuatro rutas del periodo van montadas
`mountAdmin(..., requireRole('admin'), ...)`. El producto solo escribe a dos sitios: al merchant y
al cliente final del merchant. **El asesor no es destinatario de nada.**

🔴 **No hay registro de entrega.** E0 lo midió por **tres vías independientes y las tres dan cero**:
la respuesta de Resend se descarta en los 6 emisores HTTP (el `id` de mensaje no se guarda), no hay
tabla de correo entre los 24 modelos del DMMF —`WhatsAppMessage` sí tiene funnel `queued→sent→
delivered→read`; el correo no tiene ni fila—, y ninguna de las 180 rutas recibe eventos
`delivered`/`bounced`. **Consecuencia directa para «por el canal que la ley permite»: hoy no se
puede acreditar que un envío llegó.** Si la entrega tiene que ser demostrable, esa pieza se
construye; no está.

🔴 **El asesor no existe en el producto.** Cero campos en los 24 modelos, cero preguntas en 505
ficheros barridos (E0/Q9). No hay a quién mandarlo ni dónde guardarlo.

---

## (b) 🔴 «Por el canal que la ley permite» — **el expediente NO lo dice, y paro aquí**

### Lo que el expediente sí dice

`docs/legal/RGPD_TRATAMIENTO_DATOS.md` reparte los dos papeles: sobre los datos del **cliente final**
YaQu es **encargado del tratamiento** (art. 28) y el profesional es el responsable; sobre los datos
del profesional, YaQu es responsable por ejecución de contrato. Los **subencargados a publicar** son
seis: Railway, Stripe, Meta, Resend, Anthropic, Mercado Pago.

### Lo que NO dice, y es exactamente lo que este ticket necesita

**Nada sobre que YaQu envíe los datos de un merchant a un tercero designado por él.** La política
dice «no vendemos tus datos ni los de tus clientes a terceros» — eso es la **venta**, no un envío
que el propio profesional ordena. Y un asesor que recibe el paquete **no es un subencargado**: es un
**destinatario** distinto por cada merchant, una figura que el expediente no contempla.

### Y el dato que convierte esto en un PARO, leído del código y no del informe

`exportData.ts:139` — cabecera de `clientes.csv`:

> `Nombre` · `Razón social` · `NIF/CIF` · `Teléfono` · `Email` · `Notas` · `Baja WhatsApp` · `Fecha de alta`

**Lo que saldría del producto no son «los datos fiscales del profesional»: son los datos personales
de SUS CLIENTES** — justo aquéllos sobre los que YaQu es **encargado** y él es el **responsable**.
Enviarlos a un tercero es un tratamiento nuevo, con un destinatario nuevo, sobre datos de los que
YaQu no decide el fin.

**No invento la respuesta.** La pregunta, redactada para que el asesor pueda contestarla:

> Cuando el profesional nos pide que enviemos su paquete trimestral a su asesor —un tercero que él
> designa—, y ese paquete incluye datos personales de sus clientes (nombre, NIF, teléfono, email):
> ¿basta con su instrucción como responsable del tratamiento, o hace falta algo más (contrato con
> el destinatario, actualización de la política de privacidad y del DPA, registro de la
> comunicación, algún requisito de acreditación de la entrega)?

⚠️ Y un aviso que apunta al mismo sitio: `docs/legal/PACK_GESTORIA.md` —el one-pager pensado
**para la gestoría del profesional**— lleva escrito **«No distribuir hasta SIF-1 8/8 ✅ + revisión
del asesor (S1-F)»**. El artefacto de cara al asesor ya está bloqueado por ese gate.

---

## (c) El ciclo trimestral — **el número: 4 y 0**

**El producto sabe qué ES un trimestre: cuatro rutas ya lo toman como parámetro.**

| ruta | montaje |
|---|---|
| `/admin/libros/expedidas.csv` · `/admin/libros/recibidas.csv` | `mountAdmin(..., requireRole('admin'))` |
| `/admin/modelo-303` | ídem |
| `/admin/evidencias.zip` | ídem |

**Y no sabe cuándo TERMINA: de los 6 crons del producto, cero son trimestrales.** Son uno horario,
tres diarios, uno semanal (lunes) y uno diario de madrugada. Nada se dispara al cerrar un trimestre.

O sea: el **periodo** está resuelto y reutilizable; el **ciclo** —el momento recurrente que
dispararía el envío— **no existe y hay que construirlo**. Es una pieza pequeña y aislada, y no es
la que decide el ticket.

---

## Lo que propongo

**Parar E1 hasta que (b) tenga respuesta**, porque las otras dos piezas dependen de ella: si el
envío exige entrega acreditable, hay que construir el registro de correo (fila + webhook de Resend)
antes que la pantalla; y si exige contrato con el destinatario, el campo «asesor» no es un email en
un formulario.

Mientras tanto hay dos cosas que **no dependen** de la respuesta legal y podrían adelantarse si lo
decides, cada una con su ticket:

1. **El registro de entrega del correo** — hoy no se puede demostrar que ningún email llegó, y eso
   ya afecta a la factura que se manda al cliente final, no solo a E1.
2. **El disparador trimestral** — el cron que sabe que un trimestre cerró.

**No se ha construido nada.** Ni un campo, ni una ruta, ni microcopy. `prisma/schema.prisma`, el
camino de emisión y `docs/legal/` quedan intactos.
