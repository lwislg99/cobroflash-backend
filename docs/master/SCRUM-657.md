# SCRUM-657 · Clientes que son Administraciones Públicas (FACe, DIR3) — medición, sin código

**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:20:48Z

**Gate:** medición y propuesta. Cero líneas de `src/`, cero `prisma/schema.prisma`. Camino de
emisión fiscal: leerlo no es STOP (regla 38); este expediente no lo modifica.

---

## PASO 0 — barrido por PALABRA, no por número de ticket

`DIR3|FACe|Facturae|oficina contable|órgano gestor|unidad tramitadora` contra todo el repo.
Con límites de palabra (una pasada sin ellos da 59 falsos positivos: «facturae» como subcadena de
«facturación», «FACe» dentro de palabras inglesas sueltas en comentarios). El resultado real, 4
ficheros, ninguno en `src/` ni en `prisma/`:

- `docs/competencia/matriz.md:91` — fila 19 del análisis competitivo: «Facturae y FACe
  (administración pública) | Contasimple · Fixner | **No**» — YaQu no lo tiene, dos competidores
  sí, catalogado `M ⛔ fiscal` y puesto explícitamente **fuera del top** de prioridades
  (`matriz.md:119`).
- `docs/equipo/puesto-j1.md:79` — SCRUM-657 ya en la tabla de J1, con la nota «bajó de categoría
  el 2-sep».
- `docs/master/SCRUM-906.md` y `docs/verificacion/asuntos-jira.tsv` — la exportación cruda del
  propio ticket de Jira, sin medición nueva dentro.

Nada construido, nada medido antes con código. El alcance que pide el orquestador (medir qué
falta) es el que corresponde — no hay nada que rehacer.

## 1 · Qué pasa HOY si un profesional de YaQu factura a un ayuntamiento

- **La ficha de cliente no puede ni declarar que es una administración pública.**
  `Customer.contactKind` es un enum CERRADO — `z.enum(['EMPRESA', 'PERSONA'])`
  (`src/core/validation/schemas.ts:554`) — sin un tercer valor para organismo público. Un
  ayuntamiento se daría de alta como `EMPRESA`, indistinguible de cualquier SL.
- **Ningún campo del alta/edición de cliente pregunta por DIR3.** Confirmado por el censo del
  §2: cero columnas, cero validación, cero pantalla.
- **La factura que se genera hoy no es el formato que FACe exige.** El único camino de emisión
  que existe produce dos cosas — el PDF (`generateInvoicePdf`) y el XML de VeriFactu
  (`verifactu.service.ts`, bloque `<sum1:Destinatarios>` con `NombreRazon`+`NIF`) — y ninguna de
  las dos es **Facturae**, el estándar de e-factura que FACe exige. Son dos cosas distintas por
  diseño, no una que falte completar: VeriFactu es el registro ANTIFRAUDE que va a la AEAT;
  Facturae es el formato de ENTREGA de la factura al organismo receptor, con su propio XSD y sus
  propios códigos DIR3 (oficina contable, órgano gestor, unidad tramitadora) para dirigirla a la
  subdivisión administrativa correcta.
- **No existe un generador Facturae en el repo.** Grep de los elementos propios de ese estándar:
  sin resultados en `src/`.
- **No hay ninguna llamada de red hacia FACe ni hacia ningún portal de gobierno.** Verificado de
  primera mano (no solo citado): `git grep -n -E "fetch\(|axios|https://www1?\.agenciatributaria|face\.gob|facturae" -- src/modules/fiscal src/modules/invoicing` → el único resultado es
  `pdf.service.ts:120`, un `axios.get` que descarga el LOGO del merchant para el PDF — nada que
  ver con Hacienda ni con FACe. Coincide con lo que ya medía `docs/competencia/matriz.md` fila 8
  para VeriFactu→AEAT (cero llamadas), y aquí es la misma foto: cero también hacia FACe.
- **Dónde se corta el circuito, en orden — faltan CUATRO piezas, no una:**
  1. no se puede declarar que el cliente es una administración pública;
  2. no hay dónde guardar sus 3 códigos DIR3 aunque se preguntaran;
  3. no existe el generador del formato de fichero (Facturae) que FACe exige;
  4. no hay integración con el portal FACe para entregarlo.
- **La válvula manual que ya existe para otros casos similares** (Bizum/transferencia mientras
  Stripe Connect está apagado, regla 18) tiene un equivalente aquí, FUERA de YaQu: el profesional
  puede generar el Facturae con otra herramienta (o pedírselo a su gestor) y subirlo a mano al
  portal FACe. YaQu hoy no se lo impide ni se lo facilita — simplemente no participa.

## 2 · Los tres códigos DIR3 — ¿existe dónde guardarlos, hoy?

- `prisma/schema.prisma`: `git grep -n -iE "DIR3|FACe|Facturae|oficinaContable|organoGestor|unidadTramitadora"` → **0 resultados**, en `Customer` y en cualquier otro modelo.
- La ficha de cliente (`model Customer`, `schema.prisma:201-447`) tiene 24 columnas, cada una
  documentada con su motivo. Ninguna es un campo estructurado genérico reutilizable sin
  ambigüedad. La más parecida en espíritu es `internalRef` (CONT-16, línea 432) — pero es
  **explícitamente** texto libre, sin validar, para «el número con el que el PROFESIONAL conoce a
  este cliente en OTRO sistema» (el expediente de una aseguradora, el código de un sistema viejo).
  Su propio comentario dice por qué NO serviría aquí: «es el número de OTRO sistema y nosotros no
  mandamos sobre su forma» — tres códigos estructurados que además tiene que LEER un generador de
  XML necesitan su propio campo, no uno pensado para lo contrario.
- **Conclusión medida: no existe ningún sitio para guardarlos hoy.** Hace falta un ALTER — tres
  columnas nuevas, aditivas, `nullable`, sin `@default` (mismo patrón que el resto de `Customer`:
  NULL = «no declarado»). Decisión y aplicación en las tres bases: **de Javier**, ciclo de la
  regla 3 (decisión → ALTER aditivo → PR con esquema+código+tests). No propongo el DDL aquí — el
  ticket pide diseño, no schema ni código.

## 3 · Tamaño real del problema

- **Ya está medido y rebajado por el propio equipo**, por DOS fuentes independientes que no se
  citan entre sí: `puesto-j1.md:79` («bajó de categoría el 2-sep») y `matriz.md` fila 19+línea 119
  (catalogado `M`, puesto explícitamente fuera del top «por tamaño o por gate»). No es una
  apreciación mía nueva, es una confirmación de lo que ya se había medido.
- **Es un problema de SEGMENTO, no de todos los oficios.** Solo afecta al profesional que factura
  a una administración pública (mantenimiento municipal, obra pública menor…) — un subconjunto de
  un subconjunto (España-first, y dentro de España solo quien trabaja con el sector público). El
  producto hoy **no puede ni contar** cuántos clientes actuales caen en ese subconjunto: no existe
  el campo para marcarlo (§2), así que ni siquiera es una pregunta que el modelo de datos sepa
  responder todavía.
- El enunciado del ticket («sin factura electrónica por FACe la administración no paga») es
  correcto como motivación de negocio pero **no es una afirmación que yo pueda verificar contra el
  BOE** — se deja como pregunta para J4 (abajo), no se da por buena de memoria (es exactamente el
  defecto que el propio encargo pide evitar).
- **El tamaño de construir esto, si se aprobara, es mayor que «añadir tres campos».** Exige (a) el
  ALTER, (b) un generador de un formato de documento COMPLETAMENTE NUEVO (Facturae/XSD propio, no
  reutiliza nada de `verifactu.service.ts`), (c) integración con la API/portal de FACe
  (autenticación, envío, y probablemente firma electrónica del XML — sin confirmar, ver preguntas
  abajo). Y las tres se apoyarían sobre una tubería VeriFactu que **hoy todavía no remite nada a
  la AEAT** (`flags.ts` `SIF_ENABLED: false`, cero llamadas de red medidas, `matriz.md` fila 8):
  construir la entrega a FACe antes de que la tubería fiscal base llegue a producción sería
  levantar el piso de arriba sin haber acabado el de abajo — y antes de SIF-1, en España, ni
  documento ni cobro por YaQu (regla 24).
- El alcance que pidió el orquestador (medir qué falta y el tamaño real) es el que corresponde al
  ticket de Jira real — no hace falta parar por desajuste de alcance.

## Preguntas para J4 (normativa — no las respondo yo, se cotejan contra el BOE)

1. ¿Es cierto, y con qué plazo/excepciones/umbrales, que «sin factura electrónica por FACe la
   administración no paga»? (Motivación probable: Ley 25/2013, art. 4 — a confirmar, no citar de
   memoria en ningún expediente fiscal.)
2. ¿Hace falta firma electrónica del propio profesional/autónomo sobre el XML Facturae, o basta
   con la identificación del emisor que ya va en el documento? Si hace falta, la pieza (c) del §3
   pasa de «llamar a una API» a «gestionar certificados digitales» — un carril entero aparte.
3. ¿DIR3 es un catálogo cerrado que YaQu tendría que sincronizar (como hace cualquier ERP con
   e-factura), o el profesional copia los tres códigos a mano de la orden de compra del
   organismo? Cambia el tamaño real de (b)/(c).

## Recomendación

**No construir todavía.** Tres motivos que apuntan al mismo sitio, no uno solo: (1) ya está
rebajado por el propio equipo el 2-sep, con motivo de tamaño, confirmado por dos fuentes
independientes; (2) depende de una tubería VeriFactu que aún no llega a producción (regla 24); (3)
las tres preguntas normativas de arriba cambian el tamaño real de la construcción en un factor
grande — con firma electrónica y catálogo DIR3 sincronizado es un carril entero, sin ellas mucho
menos, y hoy no se sabe cuál de los dos escenarios es el real. Mantenerlo donde está (cola U /
Acción del fundador) hasta que J4 conteste y SIF-1 esté más cerca de producción real.

**Si algún día se aprueba construir**, el primer paso no es el generador Facturae: es el ALTER de
los tres campos DIR3 + decidir cómo se marca «esta ficha es una administración pública» sin
mezclarlo con `contactKind` (EMPRESA/PERSONA) — misma lección que ya se aplicó al separar
`tipoDestinatario` de `contactKind` (`schema.prisma:204-217`: dos preguntas distintas no se
mezclan, ni con un valor por defecto que deduzca una de la otra). El generador Facturae y la
integración con FACe serían fases posteriores, cada una con su propio expediente.

## Declarado, sin arreglar aquí

- El texto de producto/marketing sobre este gap (si se anuncia o no como «próximamente») no se
  propone aquí — copy con firma (regla 30/39), fuera de mi carril.
- Recuento real de clientes que hoy podrían ser administraciones públicas en cualquier entorno: no
  medible — el campo para identificarlos no existe (§2), así que no hay qué contar todavía.
