# SCRUM-593 / DOC-03 · Texto en el documento y observaciones — **PASO 0: no se construye todavía**

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** PARADO — dos bloqueos y un instrumento que no sirve
**Medido contra:** `origin/main` = `558765adf2d2f09288e20e2b878c69d6edc3380b` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-593-texto-y-observaciones`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> El ancla está **medida** con `git rev-parse`.

---

## LAS TRES COSAS QUE HAY QUE DECIDIR ANTES DE ESCRIBIR CÓDIGO

## 1 · 🔴 LA PREMISA ES PARCIALMENTE FALSA: el mensaje final del ALBARÁN **ya existe**

El encargo dice «hoy no existe ninguno de los dos». Medido:

| campo | Quote | Albaran |
|---|---|---|
| **texto libre bajo la cabecera** | ❌ no existe | ❌ no existe |
| **mensaje final** | ❌ no existe | ✅ **`notas String? @db.Text`** — existe, se guarda **y se imprime** |

`albaranPdf.service.ts` ya lo pinta, bajo el rótulo **«Notas:»**:

```ts
if (params.notas) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text('Notas:');
  doc.font('Helvetica').fillColor(BODY).text(params.notas, { width: W });
}
```

**Eso cambia el ticket para el albarán:** no es «crear el campo», es **retitularlo** de «Notas:» a
«Observaciones» — y ahí hay una decisión que no es mía:

> «Notas:» es **texto que ya está aprobado y ya se enseña**. Sustituirlo por
> `[PENDIENTE microcopy oficial]` sería **quitar texto firmado y poner un marcador**, justo al revés
> de la regla que el propio censo escribe: *«Sólo se marca lo NUEVO — marcar de más obliga al
> fundador a reescribir lo que ya estaba bien.»*

**Tres salidas, y la elige el fundador:** (a) el albarán conserva «Notas:» y sólo el campo NUEVO de
cabecera lleva marcador; (b) «Notas:» pasa a marcador porque el concepto cambia a «Observaciones»;
(c) se añade un campo aparte y `notas` se queda como está. **No la tomo yo.**

Y lo que la vista pública del albarán hace hoy con `notas`: **nada**. No la pinta.

## 2 · 🛑 LOS CAMPOS NUEVOS SON SCHEMA, y el schema es de los fundadores

`Quote` no tiene ningún campo de texto libre para el documento. `internalNotes` **no** sirve: su
propio comentario dice *«Notas privadas del profesional, nunca visibles al cliente»* — usarlo
publicaría en el documento algo declarado privado.

**El diff, ADITIVO, preparado y sin aplicar:**

```prisma
model Quote {
  // DOC-03 · texto libre bajo la cabecera del documento. Nullable: los presupuestos
  // anteriores no lo tienen, y `null` («no se escribió») no es `''`.
  docHeaderText String? @map("doc_header_text") @db.Text
  // DOC-03 · mensaje final, que en el PDF se presenta como «Observaciones».
  docFooterText String? @map("doc_footer_text") @db.Text
}

model Albaran {
  // DOC-03 · el mismo texto de cabecera. El mensaje final YA existe aquí (`notas`).
  docHeaderText String? @map("doc_header_text") @db.Text
}
```

Tres columnas, todas nullable, ningún `@default`, ningún índice: **puramente aditivo**. Pero
`prisma/schema.prisma` es de los fundadores y la regla es preparar el diff y **PARAR**. No lo he
tocado y no he lanzado ningún `db push`.

## 3 · 🔴 EL CONTROL QUE PIDE EL ENCARGO **NO ES POSIBLE** CON EL INSTRUMENTO QUE NOMBRA

El encargo ordena comprobar los saltos de línea en el PDF con `_texto-del-pdf.mjs`. **No puede.**
Medido, en las dos direcciones:

```
CON salto  ('ALFA\nBETA')  ->  "ALFABETA"
SIN salto  ('ALFABETA')    ->  "ALFABETA"
¿los distingue?            ->  🔴 NO: son idénticos
```

PDFKit **sí** respeta el salto —lo pinta en dos líneas—, pero el extractor concatena los fragmentos
sin separador, así que **un PDF con salto y otro sin él dan el mismo texto**. Un test escrito contra
ese instrumento pasaría en verde con el salto roto: sería un guard muerto el día que nace.

> Esto es lo que pedías que dijera («comprueba si el control PUEDE cazar la regresión; si no puede,
> dilo»). Y afecta **también a SCRUM-655 (T6)**, cuyo criterio de aceptación es exactamente ése.

**Lo que haría falta:** un instrumento que lea la POSICIÓN de los fragmentos, no sólo su texto —dos
líneas ocupan dos `y` distintas—. Es trabajo propio, y su sitio natural es T6, que es quien pone el
criterio.

Los otros dos canales sí son verificables hoy: la pantalla con `white-space: pre-line` (hay
precedente vivo en `aiQuoteAssistant.js:109`, con su comentario de que no es decoración) y WhatsApp
por el cuerpo del mensaje.

---

## Lo que NO se ha hecho, y por qué

* **No se ha tocado `prisma/schema.prisma`** ni se ha lanzado ninguna migración.
* **No se ha escrito copy**: ni las etiquetas ni el título del bloque. Cuando se construya, van con
  marcador y con la subida declarada en SCRUM-402 — y con la lección de SCRUM-575 escrita: **si las
  ranuras comparten una constante, el censo cuenta MARCAS y no rótulos**, así que aprobar un texto
  no apaga los otros. Quien quiera poder firmarlos por separado, constante por ranura.
* **No se ha tocado ninguna LÍNEA del documento** (S1 en DOC-16, S2 en CAT-02), ni el desglose de
  IVA del pie (S1, 623), ni los formateadores de dinero, ni el calentamiento del navegador.

## Lo que desbloquea el ticket

1. **Decidir el punto 1**: qué pasa con «Notas:» del albarán.
2. **Aplicar el diff aditivo del punto 2** (o autorizarme puntualmente, como en SCRUM-574).
3. **Decidir el punto 3**: si el instrumento de saltos lo construye T6 o este ticket. Sin él, el
   criterio «los saltos se ven en el PDF» no se puede afirmar.

**Suite: sin cambios de código en esta rama** — no se ha modificado ningún fuente.
