# SCRUM-729 · Una factura EMITIDA reimprime el cliente DE HOY, no el del día que se emitió

**Fecha:** 7-sep-2026 · **Carril:** fiscal (documento emitido) · **Gate:** medición, sin código de arreglo

**Medido contra:** `origin/main` = `e8ae10697d61fef37f87156cc227eecae4a9a39d` · 2026-09-07T10:52:00+02:00

> ⛔ **Esto es medir, no arreglar.** No se ha tocado el camino de emisión (regla 38: leer sí,
> modificar no) ni `prisma/schema.prisma`. Ni una línea.

---

## 0 · PASO 0 — el defecto vive HOY en `main`

No es una foto vieja. La prueba de abajo se corrió contra `e8ae1069` (7-sep-2026, PR #1133), con
`prisma generate` rc=0 y `npm run build` rc=0 **antes** de medir nada.

```
model Invoice, en main hoy:  campos de cliente congelados → 0
```

`Invoice` **sí** congela `number`, `total`, `currency`, `lines`, `suplidos`, `albaranRefs`,
`qrData` y `stageLabel` («congelada al crear la factura»). El cliente **no**: se lee en vivo por
la relación `customer` cada vez que se produce el documento.

El propio esquema ya lo tenía escrito, en el comentario de `shippingAddress` (SCRUM-602):

> *«Que el nombre y el NIF de la factura sigan leyéndose en vivo es deuda VIEJA (SCRUM-729): no
> se propaga a un campo nuevo para que "case".»*

Estaba **declarado**. Lo que faltaba era la demostración corriendo, que es esto.

---

## 1 · La prueba, CORRIDA — Postgres desechable, camino real

Banco portátil en loopback (`127.0.0.1:55432`, base `yaqu_729_test`), esquema derivado del
`schema.prisma` de main con el binario local (`./node_modules/.bin/prisma migrate diff
--from-empty`, **nunca** `npx`, SCRUM-385). Se ejecuta `ensureInvoicePdf` de `dist/` —el camino
real— y se compara el **texto** del PDF.

**La secuencia**, sobre una factura ya EMITIDA y SELLADA (`vfEstado: 'sellado'`, con `vfHash`):

1. se **borra el fichero** del disco — `ensureInvoicePdf` regenera cuando falta, y **ésa es la
   vía por la que esto muerde de verdad en Railway**: el disco es efímero, así que el PDF se
   rehace solo, meses después de emitir;
2. se regenera;
3. se compara.

La fila de `invoices` **no se toca en ningún momento**: el único `update` de toda la prueba va
contra `customers`.

### 🔴 El control positivo, que es lo que hace que la prueba valga

```
🔴 CONTROL POSITIVO · dos regeneraciones SIN tocar al cliente:
  [1ª]                      fichero regenerado          · 5518 bytes · 598 caracteres de texto
  [2ª, sin tocar nada]      fichero BORRADO y regenerado · 5518 bytes · 598 caracteres de texto
   ¿el TEXTO del PDF sale idéntico en las dos?  SÍ
```

Sin cambiar nada del cliente, **el PDF sale idéntico**. Así que lo que se mide abajo es el dato
del cliente y no el ruido de la regeneración.

### El resultado

```
AHORA se cambian NOMBRE, DENOMINACIÓN LEGAL y NIF del cliente.
La fila de la factura NO se toca: ni un update sobre `invoices`.
  [3ª, tras cambiar el cliente]  fichero BORRADO y regenerado · 5528 bytes · 601 caracteres

   ¿el PDF sale distinto que antes del cambio?  SÍ
  NOMBRE  antes: «Ferreteria Pepe»     SÍ salía · después: YA NO sale / «Suministros Norte»     APARECE
  LEGAL   antes: «Ferreteria Pepe SL»  SÍ salía · después: YA NO sale / «Suministros Norte SLU» APARECE
  NIF     antes: «B99999999»           no salía · después: YA NO sale / «B11111111»             no aparece
```

**Los dos textos, tal y como se imprimen bajo el rótulo CLIENTE:**

| | bloque «CLIENTE» del PDF |
| --- | --- |
| **antes** | `CLIENTE` `Ferreteria Pepe SL` `pepe@ferre.test` `600111222` |
| **después** | `CLIENTE` `Suministros Norte SLU` `pepe@ferre.test` `600111222` |

Misma factura. Mismo número. Misma huella VeriFactu. **Otro destinatario impreso.**

---

## 2 · 🔴 El hallazgo que corrige el enunciado: el NIF del cliente NO SE IMPRIME

El encargo daba por hecho «cambia el NOMBRE y el NIF». El nombre, confirmado. El NIF, **no**: no
cambia porque **no sale en el PDF de factura, ni antes ni después**.

No es una conjetura de la medición: está en el tipo, por identidad de propiedad.

```ts
// src/modules/invoicing/infra/pdf/pdf.service.ts:252 — generateInvoicePdf
customer: { name: string; legalName?: string | null; email?: string | null; phone?: string | null };
//         ↑ no hay `taxId`
```

Y quien la llama tampoco lo pasa (`src/lib/invoicing.ts`): `{ name, legalName, email, phone }`.

`taxId` del cliente **sí** viaja en otro documento —el albarán (`albaranPdf.service.ts`)— y por eso
el ticket lo daba por presente aquí. Son dos maquetas distintas.

> ⚠️ Esto es una avería DISTINTA y probablemente más gorda: una factura completa (F1) sin NIF del
> destinatario. **No se abre ticket desde aquí** ni se arregla en esta tanda; queda anotado para
> que lo decida el fundador con el asesor. Si mañana se congelan cinco columnas de cliente, la de
> `taxId` se congelaría **sin que ningún documento la imprima todavía**.

---

## 3 · El alcance, por lectura del árbol

| documento | ¿lee el cliente en vivo al reimprimir? | campos |
| --- | :-: | --- |
| **factura** (`ensureInvoicePdf`) | **SÍ** | `name`, `legalName`, `email`, `phone` |
| **albarán** (`albaranPdf.service.ts`) | **SÍ** | `name`/`legalName`, `taxId`, `email`, `phone` |
| **presupuesto** | correcto | no es documento emitido: debe reflejar al cliente actual |

---

## 4 · Lo propuesto, y NO aplicado

Cinco columnas **nullable y sin default** en `invoices` —y las mismas en `albaranes`— con el
nombre, la denominación legal, el NIF, el email y el teléfono **copiados al emitir**.

Nullable sin default por el motivo de siempre en esta casa: un default convertiría todas las
facturas históricas en «este era el cliente», que no lo ha dicho nadie. `NULL` = «no consta».

El escritor que las rellene es **camino de emisión** → STOP del fundador (AA1.4). El ALTER está
pedido a Javier; este documento sólo aporta la medición que lo justifica.

---

## 5 · Notas de banco de pruebas (hallazgo, sin ticket)

El banco portátil **no sobrevive intacto a la limpieza del temporal**: se llevó
`pgsql/share/` entero —`timezone` y `timezonesets` incluidos— dejando `bin/` y `lib/`. El
servidor arrancaba y moría con `FATAL: configuration file … contains errors`, que no se parece
en nada a la causa.

**Sí tiene arreglo barato**, y es el que se aplicó: el `pg.zip` vive en el scratchpad de la
sesión, y re-extraer **sólo `pgsql/share/**`** (1.412 ficheros, segundos) devuelve el banco sin
volver a bajar 338 MB ni re-inicializar el cluster. Los datos (`pgb/datos`) sobrevivieron.

---

## 6 · Lo que NO se ha tocado

- `prisma/schema.prisma` — ni una línea.
- El camino de emisión — sólo se **llama** y se **lee** (regla 38).
- Ningún texto de microcopy.
