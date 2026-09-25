# SCRUM-657 · Clientes que son Administraciones Públicas (FACe, DIR3) — medición, sin código

**Medido contra:** `origin/main` = `53d72343cd74f262aae15531c64e21615122c0a9` · 2026-09-23T08:24:17Z

**Gate:** medición y propuesta. Cero líneas de `src/`, cero `prisma/schema.prisma`. Camino de
emisión fiscal: leerlo no es STOP (regla 38); este expediente no lo modifica.

---

## El PASO 0 que pide el propio ticket, y qué pude hacer de él

El ticket no es una idea abstracta: nace de un hallazgo real, 19-ago-2026, leyendo facturas
verdaderas del merchant **Tecnosel Seguridad, S.L.** para el sprint. Al pie de una factura real al
**I.E.S. Ramón y Cajal** aparecían los tres códigos DIR3 (oficina contable, órgano gestor, unidad
tramitadora), y de los cinco documentos aportados por ese merchant, **cuatro** eran a centros
públicos de la Comunidad de Madrid. El propio texto del ticket pide TRES mediciones antes de
decidir nada, y las repito tal cual — porque solo una de las tres es de las que se contestan
leyendo código:

1. **«¿Cómo presenta HOY estas facturas? ¿Las sube él a FACe, o se las presenta la gestoría?»**
   — el ticket dice explícitamente que la pregunta **ya está hecha al padre del fundador** y que
   **«sin esa respuesta no se dimensiona nada»**. No es algo que yo pueda medir con grep ni
   corriendo código: es una respuesta humana pendiente, fuera de este repo. La dejo **PENDIENTE**,
   no la invento ni la doy por soluble desde aquí.
2. **«¿Qué proporción de su facturación es pública?»** — con los datos REALES de Tecnosel, no con
   los cinco documentos que él eligió enseñar. Requeriría consultar staging/producción para ese
   merchant. Esta máquina no tiene Postgres (`TRAMOS_PG_URL`/`LIBRO_PG_URL` no corren aquí,
   medido en sesiones anteriores) y esta sesión no tiene turno de staging abierto. **PENDIENTE,
   declarado como SUELO** — no silenciado: quien lo mida, que lo haga contra staging/producción
   con su turno, no a ojo ni con la muestra que trajo el propio merchant.
3. **«¿Existe algo de Facturae en el código?»** — Esta sí la pude medir de primera mano. Resultado:
   cero. Ver §1 y §2 abajo, con censo y grep reales, no de memoria.

**Solo la (3) queda resuelta desde este carril.** Las preguntas (1) y (2) siguen abiertas, y el
propio ticket es explícito en que sin la (1) «no se dimensiona nada» — mi medición de tamaño (§3)
es información real y utilizable, pero **no sustituye** esa respuesta pendiente: dimensiona
«cuánto costaría construirlo SI se aprueba», no «si hace falta ya para Tecnosel en concreto». Esa
segunda pregunta la responde quien tenga la (1) y la (2).

## 1 · Qué pasa HOY si un profesional de YaQu factura a un ayuntamiento

- **La ficha de cliente no puede ni declarar que es una administración pública.**
  `Customer.contactKind` es un enum CERRADO — `z.enum(['EMPRESA', 'PERSONA'])`
  (`src/core/validation/schemas.ts:554`) — sin un tercer valor para organismo público. Un
  ayuntamiento o un IES se daría de alta como `EMPRESA`, indistinguible de cualquier SL.
- **Ningún campo del alta/edición de cliente pregunta por DIR3.** Confirmado por el censo del
  §2: cero columnas, cero validación, cero pantalla.
- **La factura que se genera hoy no es el formato que FACe exige.** El único camino de emisión
  que existe produce dos cosas — el PDF (`generateInvoicePdf`) y el XML de VeriFactu
  (`verifactu.service.ts`, bloque `<sum1:Destinatarios>` con `NombreRazon`+`NIF`) — y ninguna de
  las dos es **Facturae**, el estándar de e-factura que FACe exige. Son dos cosas distintas por
  diseño, no una que falte completar — coincide con lo que ya deja escrito el propio ticket:
  VeriFactu (RD 1007/2023) es el registro ANTIFRAUDE remitido a la AEAT, para TODAS las facturas
  desde el 1-1-2027; Facturae+FACe (Ley 25/2013) es el formato y canal de ENTREGA de la factura al
  CLIENTE, solo cuando ese cliente es una administración pública. Una factura a un IES en 2027
  necesitaría LAS DOS, y hoy no hay ninguna de las dos construida.
- **No existe un generador Facturae en el repo.** Grep de los elementos propios de ese estándar:
  sin resultados en `src/`.
- **No hay ninguna llamada de red hacia FACe ni hacia ningún portal de gobierno.** Verificado de
  primera mano: `git grep -n -E "fetch\(|axios|https://www1?\.agenciatributaria|face\.gob|facturae" -- src/modules/fiscal src/modules/invoicing` → el único resultado es
  `src/modules/invoicing/infra/pdf/pdf.service.ts:120`, un `axios.get` que descarga el LOGO del
  merchant para el PDF — nada que ver con Hacienda ni con FACe. Coincide con lo que el propio
  ticket cita de SCRUM-525 (auditoría del 19-ago): tampoco se remite nada a la AEAT todavía.
- **Dónde se corta el circuito, en orden — faltan CUATRO piezas, no una:**
  1. no se puede declarar que el cliente es una administración pública;
  2. no hay dónde guardar sus 3 códigos DIR3 aunque se preguntaran;
  3. no existe el generador del formato de fichero (Facturae) que FACe exige;
  4. no hay integración con el portal FACe para entregarlo, ni forma de leer los estados que
     devuelve (registrada, conformada, pagada, rechazada — los cuatro que el propio ticket nombra
     como parte del alcance).
- **La salida sensata mientras tanto, que el propio ticket ya propone y yo confirmo que hoy
  funciona sin tocar nada:** el merchant puede usar YaQu para presupuestos, trabajos, partes,
  firmas y empleados, y seguir presentando la factura fiscal por FACe **fuera** de YaQu, como
  hace hoy (a mano o vía gestoría). Ningún hallazgo de este expediente bloquea eso.

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
  NULL = «no declarado»), coincidiendo con lo que el propio ticket ya anticipa: «los tres códigos
  DIR3 pasan a ser campos del CLIENTE, no del merchant». Decisión y aplicación en las tres bases:
  **de Javier**, ciclo de la regla 3 (decisión → ALTER aditivo → PR con esquema+código+tests). No
  propongo el DDL aquí — el ticket pide diseño, no schema ni código.

## 3 · Tamaño de la CONSTRUCCIÓN si se aprueba — no confundir con la urgencia para Tecnosel

Esto mide «cuánto cuesta construirlo», que es una pregunta distinta de «hace falta ya» (que
depende de las preguntas (1) y (2) del PASO 0, todavía abiertas — ver arriba):

- **Es mayor que «añadir tres campos».** El propio ticket ya da la orientación de tamaño y la
  confirmo: (a) el ALTER de los tres DIR3 + declarar «es administración pública» sin mezclarlo con
  `contactKind`; (b) un generador de un formato de documento COMPLETAMENTE NUEVO (Facturae, su
  propio XSD — no reutiliza nada de `verifactu.service.ts`), **firmado electrónicamente**; (c)
  integración con la API/portal de FACe (autenticación, envío, lectura de estados).
- **La pieza (b) firmada electrónicamente reabre la MISMA pregunta que ya bloquea VeriFactu**, y
  no es una lectura mía: lo dice el propio ticket y coincide con `docs/legal/PREGUNTAS_ASESOR.md`
  punto 1 — «Modelo de representación ante la AEAT»: colaborador social (un solo certificado de
  YaQu, apoderamiento) frente a certificado por merchant (custodia de N certificados). Esa
  decisión, sin respuesta hoy, es la misma que necesitaría la firma del Facturae — «es la misma
  decisión, no dos», tal cual lo dice el ticket.
- **Se apoyaría sobre una tubería VeriFactu que hoy todavía no remite nada a la AEAT**
  (`flags.ts` `SIF_ENABLED: false`, cero llamadas de red medidas — SCRUM-525, confirmado también
  aquí de primera mano en §1). Antes de SIF-1, en España, ni documento ni cobro por YaQu (regla
  24) — construir la entrega a FACe antes de que la tubería fiscal base llegue a producción sería
  levantar el piso de arriba sin haber acabado el de abajo.
- **Nota aparte, sin resolver aquí:** `docs/equipo/puesto-j1.md:79` registra que el ticket «bajó
  de categoría el 2-sep» — una nota posterior al hallazgo del 19-ago, sin el motivo escrito en ese
  mismo sitio. No la reconcilio con la urgencia que transmite el propio ticket (un merchant real,
  con facturas reales ya rechazables): dejo las dos cosas dichas, con su fecha y su fuente, para
  que quien tenga las respuestas (1)/(2) decida con las dos delante, no con una sola.

## Preguntas para J4 (normativa — no las respondo yo, se cotejan contra el BOE)

1. La Ley 25/2013 y sus umbrales/plazos exactos para la obligación de facturación electrónica a
   AA.PP. — el ticket ya la cita como motivación; confirmar el detalle normativo (art. 4 y
   excepciones) antes de que aparezca en cualquier copy o decisión de producto.
2. Si el modelo de representación ante la AEAT (PREGUNTAS_ASESOR.md punto 1) se resuelve como
   «colaborador social», ¿sirve el mismo certificado de YaQu para firmar el Facturae, o FACe exige
   un modelo de firma distinto del de la remisión a la AEAT? Cambia si (c) del §3 necesita además
   un circuito de firma propio.
3. ¿DIR3 es un catálogo cerrado que YaQu tendría que sincronizar (como hace cualquier ERP con
   e-factura), o el profesional copia los tres códigos a mano de la orden de compra del
   organismo, como parece indicar el pie de la factura real de Tecnosel?

## Recomendación

**No construir todavía — pero no por «baja prioridad» genérica: por las dos preguntas del PASO 0
del propio ticket que siguen sin respuesta** (cómo presenta Tecnosel hoy sus facturas, y qué
proporción real de su facturación es pública). El propio ticket dice que sin la primera «no se
dimensiona nada», y esta sesión no puede conseguir ninguna de las dos desde este carril. Lo que sí
dejo resuelto y reutilizable en cuanto esas respuestas lleguen: el tamaño de la construcción (§3,
cuatro piezas, con la firma electrónica como el mismo cuello de botella que ya bloquea VeriFactu)
y dónde falta cada pieza (§1, §2), para que la decisión se tome sabiendo qué hay, tal como pide el
propio ticket.

**Si algún día se aprueba construir**, el primer paso no es el generador Facturae: es el ALTER de
los tres campos DIR3 + decidir cómo se marca «esta ficha es una administración pública» sin
mezclarlo con `contactKind` (EMPRESA/PERSONA) — misma lección que ya se aplicó al separar
`tipoDestinatario` de `contactKind` (`schema.prisma:204-217`: dos preguntas distintas no se
mezclan, ni con un valor por defecto que deduzca una de la otra).

## Declarado, sin arreglar aquí

- El texto de producto/marketing sobre este gap (si se anuncia o no como «próximamente») no se
  propone aquí — copy con firma (regla 30/39), fuera de mi carril.
- Las preguntas (1) y (2) del PASO 0 del ticket: no resueltas desde esta sesión (sin acceso a la
  respuesta del padre del fundador ni a los datos reales de Tecnosel en staging/producción desde
  esta máquina). Declaradas como SUELO, no como «no aplica».
- Los tickets hermanos vistos de pasada en el mismo lote de hallazgos de Tecnosel (SCRUM-650,
  654, 655, 656) no se abren aquí: quedan fuera del encargo.
