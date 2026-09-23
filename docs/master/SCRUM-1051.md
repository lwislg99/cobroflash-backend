# SCRUM-1051 · Facturar con inversión del sujeto pasivo (ISP) en obra — MEDICIÓN, pendiente GO

**Fecha:** 23-sep-2026 · **Carril:** J1 (camino de emisión) · **Gate:** STOP fiscal (reglas 29, 38, 40) — pendiente GO de Javier, esta entrada NO construye nada
**Medido contra:** `origin/main` = `13e967cde072faacf8abb4c3d15019a25ad9b721` · 2026-09-23T10:15:54Z

## Encargo

SCRUM-1051 («ISP en obra/subcontrata, entre profesionales») lleva `esperando-asesor` y depende
de Q-C2 (SCRUM-1039): *"Cómo debe verse en la factura y quién es «promotor/contratista» a
efectos prácticos NO está verificado... Hasta responderse, NO se implementa."* Mismo método que
SCRUM-1050: comprobar si esa espera sigue vigente y medir el defecto con el código real.

## PASO 1 — ¿sigue esperando asesor?

**No.** El apéndice de `docs/master/SCRUM-1023.md` clasifica **Q-C2 entre los 17 grupos que NO
necesitan asesor nuevo**: "🟢 Sustancialmente respondida por F4 (LIVA 84.f, subcontrata
explícita)". La sección F de `docs/legal/PREGUNTAS_ASESOR.md` (bloquea SCRUM-212) trae la cita
literal y **cotejada el 23-sep (SCRUM-1088) contra fuente jurídica** (Iberley, texto vigente):

> *"Ejecuciones de obra, con o sin aportación de materiales, así como las cesiones de personal
> para su realización, consecuencia de contratos directamente formalizados entre el promotor y
> el contratista..."* (art. 84.Uno.2.º.f LIVA) — **y el cotejo confirma explícitamente el matiz
> "o subcontrata": la regla aplica igual cuando el destinatario es el contratista principal u
> otros subcontratistas.**

Es la misma fuente que cita el propio ticket SCRUM-1051 (art. 84, letra f), palabra por palabra.
El código AEAT es `S2` — cotejado contra el XSD vendorizado del repo (`SuministroInformacion.xsd:1245-1247`,
"OPERACIÓN SUJETA Y NO EXENTA - CON INVERSIÓN DEL SUJETO PASIVO").

**A diferencia de SCRUM-1050:** aquí SÍ hay caso de uso real y citado — un electricista, fontanero
o instalador de YaQu que subcontrata o es subcontratado en una obra. No es un supuesto de manual.

## PASO 3 — el defecto, medido con el código real (no creído)

Fabriqué una factura de subcontrata (base 1.000 €, ISP: el total a cobrar es la base, sin
cuota — aceptación punto 2 del ticket) y la pasé por el mismo clasificador que SCRUM-1050
(`verifactu.service.ts:791` → `clasificarDetalleDesglose`, `registro.builder.ts:298-318`):

```
calcVatBreakdown -> {"entries":[{"rate":0,"base":1000,"cuota":0}],"base":1000,"cuota":0}
RECHAZADA por DesgloseNoClasificableError :: ... tramo de IVA al 0% (base 1000.00): no se puede
saber si es sujeta al 0%, exenta (art. 20 LIVA) o no sujeta ...
```

**Mismo defecto que SCRUM-1050, exactamente**: hoy no existe una `causa` por línea, así que la
única forma de que una línea ISP no repercuta IVA es poner `tax: 0`, que el clasificador rechaza
sin distinguir ISP de exenta de no-sujeta.

Comprobé también si declarar el tipo nominal (21 %) con cuota forzada a 0 es una vía existente:
no lo es. `calcVatBreakdown` con `tax: 0.21` calcula la cuota real (210 €), no la pone a 0 — no
hay hoy ningún campo que diga "aplica el 21 % pero lo autorrepercute el destinatario".

## Relación con SCRUM-1050

El propio ticket (punto 5 de aceptación) pide compartir con «exentas y no sujetas» el mismo
mecanismo de causa por línea. SCRUM-1050 mide el defecto pero Javier decide NO construirlo
porque E1/N1 no tienen caso de uso citado. **Este ticket SÍ lo tiene (S2, subcontrata).**
Construir el mecanismo de causa aquí, con S2 como primer y único consumidor real, deja la puerta
abierta a E1/N1 sin coste extra el día que aparezca su caso — no habría que rediseñar nada.

## Schema

Igual que SCRUM-1050: `Invoice.lines` es `Json` (`prisma/schema.prisma:637`). Añadir `causa` por
línea no necesita ALTER.

## Lo que falta verificar si se da el GO (no lo hago aquí, es diseño)

* Punto 6 de aceptación (rechazo servidor si ISP + cliente sin NIF): no medí si ya existe una
  validación de NIF del destinatario reutilizable, o si hay que escribirla.
* Punto 4 (cómo entra en el resumen del 303 trimestral): el propio ticket dice que lo fija Q-C2,
  no esta entrada.

## Estado

Sin GO de Javier no se toca `src/modules/fiscal/verifactu/**` ni
`src/modules/invoicing/domain/**` (regla 38/40). Esta entrada es sólo medición.

## Lo que NO cubre esta entrada

* No construye el mecanismo de causa, el selector ni la validación de NIF.
* No decide si el mecanismo se construye aquí primero y SCRUM-1050 lo hereda gratis, o al revés
  — es una posibilidad que dejo señalada, no una decisión.
