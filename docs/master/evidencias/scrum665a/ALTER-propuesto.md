# SCRUM-665 (A) · El ALTER propuesto — **NO aplicado**

> ⛔ `prisma/schema.prisma` **no se ha tocado**. Esto es la propuesta, para que el fundador la
> aplique si la aprueba. **No se ha corrido `db push`, ni `migrate dev`, ni `migrate diff`, ni
> contra ninguna de las tres bases, ni «para comprobar».**

## El diff, literal

En `model Invoice`, junto a las cinco del cliente congelado (SCRUM-729) y **con el mismo estilo**:

```diff
   customerName      String? @map("customer_name")
   customerLegalName String? @map("customer_legal_name")
   customerTaxId     String? @map("customer_tax_id")
   customerEmail     String? @map("customer_email")
   customerPhone     String? @map("customer_phone")
+
+  // SCRUM-665 (A) · EL EMISOR, CONGELADO AL EMITIR.
+  // `src/lib/invoicing.ts:108-114` leía estos siete EN VIVO al repintar el PDF, así que una
+  // factura emitida cambiaba de aspecto si el profesional corregía su perfil. Regla 29.
+  // 🔴 `merchant_name` va NULLABLE aunque `Merchant.name` sea NOT NULL: ese NULL es el CENTINELA
+  // que distingue «factura anterior al escritor» de «factura sin nombre». Mismo mecanismo que
+  // `customer_name`. No se le ponga NOT NULL ni un valor por defecto.
+  merchantName      String? @map("merchant_name")
+  merchantLegalName String? @map("merchant_legal_name")
+  merchantTaxId     String? @map("merchant_tax_id")
+  merchantAddress   String? @map("merchant_address")
+  merchantLogoUrl   String? @map("merchant_logo_url")
+  merchantPhone     String? @map("merchant_phone")
+  merchantEmail     String? @map("merchant_email")
```

## Por qué es aditivo puro

| | |
|---|---|
| columnas que cambian de tipo | **ninguna** |
| columnas que cambian de nulabilidad | **ninguna** |
| columnas que se borran | **ninguna** |
| índices que cambian | **ninguno** |
| relaciones que cambian | **ninguna** |
| filas existentes | quedan con los siete a `NULL`, que es el **caso previsto**: el lector las trata como facturas anteriores al escritor y las pinta **exactamente como hoy** |

**Siete `TEXT NULL`**, sin `@default`. Un `@default` aquí sería un error de diseño, no un atajo:
convertiría el centinela en basura y las facturas viejas dejarían de distinguirse de las nuevas.

## Las tres bases (regla 3)

`DATABASE_URL_STAGING` · `DATABASE_URL_DEV` · `DATABASE_URL_TESTS`, **en una sola PR**.
**Producción la aplica el fundador.** Ninguna sesión toca producción.

Y el orden que ya está escrito en la casa: **preview antes de `db push`**
(`node scripts/preview-migracion.mjs`, SCRUM-385), nunca `npx prisma migrate diff` a pelo.

## Lo que falta cablear DESPUÉS del ALTER, y por qué no está hecho

`src/modules/invoicing/domain/emisorCongelado.ts` está construido y **probado de punta a punta**
(`tests/scrum665a-congelar-el-emisor.test.mjs`, con el contraste positivo/negativo sobre PDFs
reales). Lo único que no se puede escribir hoy es su llamador, porque sin las columnas
**no compila**:

**① El escritor — en el momento de emitir**, dentro de la transacción que reserva el número
(`allocateInvoiceNumber`), que es el embudo por el que pasan los siete caminos de emisión
(SCRUM-203/207). Junto a `congelarCliente`, no en otro sitio:

```ts
data: {
  ...congelarCliente(tx, merchantId, customerId),
  ...congelarEmisor(merchant),          // ← SCRUM-665 (A)
  …
}
```

**② El lector — en `ensureInvoicePdf`** (`src/lib/invoicing.ts:108-114`), sustituyendo las siete
lecturas en vivo:

```diff
-      merchant: {
-        name: inv.merchant.name,
-        legalName: inv.merchant.legalName,
-        taxId: inv.merchant.taxId,
-        address: inv.merchant.address,
-        logoUrl: inv.merchant.logoUrl,
-        phone: inv.merchant.whatsappPhone,
-        email: inv.merchant.email,
-      },
+      // SCRUM-665 (A) · la copia de la fila manda; la ficha viva sólo para facturas anteriores
+      // al escritor. Mismo patrón que `clienteDelDocumento` dos líneas más abajo.
+      merchant: emisorDelDocumento(inv, {
+        name: inv.merchant.name,
+        legalName: inv.merchant.legalName,
+        taxId: inv.merchant.taxId,
+        address: inv.merchant.address,
+        logoUrl: inv.merchant.logoUrl,
+        phone: inv.merchant.whatsappPhone,
+        email: inv.merchant.email,
+      }),
```

⚠️ **Y el `select` de la consulta tiene que traer las siete**, o no viajarán y nada se pondrá
rojo — es la lección de SCRUM-688: clasificar un campo no es que llegue. Lo más seguro es
derivarlo de `CAMPOS_CONGELADOS_EMISOR` en vez de escribir una segunda lista.

**③ El segundo generador**, `ensureInvoiceForCharge` (`src/lib/invoicing.ts:245-268`), tiene el
mismo patrón de emisor vivo (`:249-255`) y necesita el mismo lector.
