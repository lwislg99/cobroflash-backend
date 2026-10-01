# SCRUM-1292 · Un cobro ya PAGADO no retrocede a fallido ni a caducado

**Medido contra:** `origin/main` = `483010e03a3836c702932420c239344ee2838d9e` · 2026-09-30T21:30:46+01:00
(orquestador del equipo de Javier, `cobroflash-backend-47`)

A9: comprobación → `tests/scrum1292-cobro-pagado-no-retrocede.test.mjs`

## 0 · El permiso

**GO del fundador, 30-sep-2026.**

> **Pregunta que se le hizo, literal:** «¿GO para arreglar SCRUM-1292? Es dinero. Si lo das, lo
> construyo con la plantilla que ya dejó S1 (`escrituraConVersion.ts`) y los cinco casos de
> aceptación que ellos escribieron.»
>
> **Respuesta literal: «1-Go».**

Se le presentó con la medición delante: los dos defectos reproducidos sobre la ruta compilada y los
cuatro controles limpios (comentario 17635 de este ticket). Y se le dijo lo que el arreglo **no**
hace: no repara lo ya pisado.

**Qué NO cubre:** nada más del camino de cobro que esto; no cambia la respuesta al proveedor de
pagos (sigue siendo 200 en todos los casos, que es lo que evita el reintento de tres días); no toca
el camino de emisión fiscal; y **no repara los cobros que este defecto ya haya pisado en
producción**, que es un trabajo aparte y sin medir.

## 1 · El defecto, y por qué no necesitaba ninguna carrera

Encontrado por **S3** (equipo de Luis) censando 127 escrituras — no tropezando, contando.

`/webhooks/psp` escribía el estado sin mirar el que ya tenía:

- `psp.routes.ts:41` → el atajo `already_paid` cubría **sólo** `payment.confirmed`.
- La segunda guarda cubría **sólo** `failed+payment.failed` y `expired+payment.expired`. **`paid` no
  aparecía en ninguna.**
- Las dos escrituras hacían `update({ where: { id: chargeId } })` **a secas**.

El caso es el **orden normal de dos avisos de Stripe**:

1. El cliente paga por **Bizum** y el cobro queda `paid`. El dinero está.
2. La sesión de Stripe abierta para ese mismo cobro **caduca después**, porque nadie la usó.
3. Llega `payment.expired` → **el cobro pagado pasaba a `expired`**.

Y con él, lo que el panel dice que le deben al profesional, los avisos y la facturación.

## 2 · Reproducido ANTES de tocar nada

S3 pidió expresamente «empezad reproduciendo, no construyendo». Sonda fuera del árbol, sobre la ruta
**compilada**, con la base doblada:

| # | Caso | Antes | Después |
| --- | --- | --- | --- |
| ① | `paid` + `payment.expired` | 🔴 quedaba `expired` | `paid`, cero escrituras |
| ② | `paid` + `payment.failed` | 🔴 quedaba `failed` | `paid`, cero escrituras |
| ③ | `pending` + `payment.failed` | `failed` | `failed` |
| ④ | `pending` + `payment.expired` | `expired` | `expired` |
| ⑤ | `paid` + `payment.confirmed` | `paid`, `already_paid`, cero escrituras | igual |
| ⑥ | `failed` + `payment.failed` | `failed`, `already_failed`, cero escrituras | igual |

Los controles ⑤ y ⑥ son los que hacen que esto valga: demuestran que la ruta **sí sabía**
cortocircuitar cuando el estado coincidía. Así que ① y ② no eran «la ruta escribe siempre» — era que
**ese mismo mecanismo no contemplaba `paid`**.

## 3 · El arreglo: dos barreras, como en SCRUM-1276

**`src/modules/billing/domain/estadoDelCobro.ts`** declara la regla:

```
ESTADOS_QUE_UN_FALLO_PUEDE_PISAR = ['pending', 'failed', 'expired']
```

🔴 **Es una lista de los que SÍ, no un «todos menos `paid`».** `Charge.status` es un `String` libre
en el esquema, no un enum: con un «todos menos», el día que aparezca un estado nuevo quedaría
pisable **sin que nadie lo decida**. Con esta lista, un estado nuevo queda protegido hasta que
alguien lo añada a propósito. Ante la duda, el dinero no se toca.

En `psp.routes.ts`:

- **Primera barrera**, el `if` de entrada: da la respuesta buena y ahorra la escritura.
- **Segunda barrera**, `where: { id: chargeId, status: { in: … } }` **dentro del `update`**: es la
  que de verdad sujeta, porque entre el `if` y la escritura cabe otra petición. Si no casa, Prisma
  lanza P2025, no se escribe nada y se contesta `already_paid`.

Al proveedor se le sigue contestando **200** en todos los casos.

## 4 · Interrogado, no sólo visto verde

Cinco mutaciones sobre el **fuente**, recompilando cada una, y las cinco se comportan como el diseño
dice:

| Mutación | Qué pasa | Qué demuestra |
| --- | --- | --- |
| (a) se quita la condición del `update`, se deja el `if` | cae **sólo** el ⑦ | el `if` solo no sujeta: por eso existe el ⑦ |
| (b) se quita el `if`, se deja la condición del `update` | **sigue verde** | la segunda barrera sola ya sujeta; son redundantes a propósito |
| (c) se quitan las dos | caen ①②③⑦ | es el defecto entero, incluido el caso del Bizum |
| (d) se mete `paid` en la lista | caen ①②③⑦ | la lista es donde vive la decisión |
| (e) la ruta deja de escribir | caen ④⑤ | para esto existen los controles positivos |

Post-condición de **contenido**: los dos ficheros quedaron con el mismo sha256. Un `finally` no
basta — si el proceso muere se lo salta.

### Y un hueco en mi propio instrumento, que destapó la (e)

La primera versión del doble de la base **ignoraba el `id` del `where`**: hacía cumplir el estado
pero no la fila. Así que la mutación (e) —apuntar la escritura a una fila inexistente— **no tumbaba
los controles positivos**, y sus verdes no valían nada. Un doble más laxo que la base convierte en
ruido todo lo que mide. Arreglado: ahora hace cumplir el `where` entero.

Lo encontró la mutación, no yo leyendo. Es justo para lo que sirve interrogar un guard.

## 5 · Los tres caminos, medidos

`stripe.routes.ts` (dos veces) y `connectWebhook.routes.ts` **todos hacen `POST` a `/webhooks/psp`**:
ninguno escribe el estado por su cuenta. Así que un arreglo en el webhook los cubre a los tres — y
eso está **medido, no supuesto**. El caso ⑧ lo sujeta: si mañana alguno empezara a escribir directo,
cae.

## 6 · 🔴 Lo que este arreglo NO hace

**No repara lo ya pisado.** Un cobro que hoy figure `expired` o `failed` en producción por este
defecto **seguirá figurando así**, y con él lo que el panel dice que se debe.

**Cuántos hay no está medido.** Ninguna sesión toca la base de producción, por diseño. Es una
pregunta para el fundador, y conviene contestarla: el arreglo para la sangría, no cura la herida.

## 7 · Dos que quedan abiertos, del mismo censo

Los marca S3 como «del revisor, **no verificados a mano**», y aquí tampoco se han verificado:

- `psp.routes.ts:119` — un `payment.confirmed` **doble** produciría **dos** `ensureInvoiceForCharge`,
  porque `chargeId` no es único.
- `invoiceAdmin.ts:285` — **una factura ANULADA resucita como pagada.** Toca la regla 29, así que es
  carril J1 y probablemente más grave de lo que parece.

Y uno verificado por S3 que **no urge**: `invoice.routes.ts:108` hace lo mismo pero es inalcanzable
hoy (detrás de `requireInternalSecret`, sin llamadas internas).

## 8 · Una nota sobre la plantilla que el ticket señalaba

El enunciado decía «hay plantilla ya hecha y probada, usadla: `src/core/db/escrituraConVersion.ts`».
**No se ha usado, y a propósito.**

Primero, porque **no está en `main`**: vive en la rama sin mergear `scrum-1285b-plan-de-cobro-con-version`.

Y segundo, porque resuelve **otro problema**: es concurrencia optimista con el `updatedAt` que manda
*la pantalla*, para rutas de edición donde alguien pudo cambiar la fila entre que se pintó y se
guardó. Aquí no hay pantalla ni versión que mandar: hay un webhook de Stripe y una **regla de
dominio** —un cobro pagado no retrocede—. El precedente bueno es el que el propio ticket cita al
lado: **SCRUM-1276, que puso la condición de estado dentro del `update`**, y es el que se ha seguido.
