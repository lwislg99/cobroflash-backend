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

# SCRUM-657b · preguntas normativas

**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T16:53:26Z

Puesto J4. Solo documentación: ni código, ni esquema, ni texto de producto. Lo encarga la decisión
del fundador del 26-nov-2026 (SCRUM-657, c.22858): primero las tres preguntas de arriba, el esquema
después. **Este tramo no recomienda construir ni dejar de hacerlo.** Es un registro interno: nada de
lo que dice es un texto para el usuario ni una afirmación fiscal de producto (reglas 17 y 39).

A9: aviso → cicatriz J4 «pedí a un grep ocho alternativas a la vez sobre una orden ministerial y me devolvió treinta párrafos enteros» — no se pudo comprobar: el recorte de una búsqueda lo decide quien la escribe y ninguna herramienta mide el contexto de una sesión desde dentro.

## Qué se leyó (población) y qué no

Descargado el 26-nov-2026 entre las 16:51:05Z y las 16:54:10Z (la primera, cabecera `Date` de
GitHub; la última, `date -u`), a un temporal fuera del repo, y leído por artículos, no entero:

| norma | identificador BOE | fuente | bloques | última reforma que trae |
|---|---|---|---|---|
| Ley 25/2013 | BOE-A-2013-13722 | API de legislación consolidada, `/texto` | 38 | LO 6/2015 (BOE-A-2015-6517), vigente desde 2015-06-14, en los arts. 4, 6, 9, 12 y la D.A. 6.ª |
| Orden HAP/1074/2014 | BOE-A-2014-6662 | la misma API | 29 | BOE-A-2015-8844, vigente desde 2015-08-07 (art. 5 y los nuevos 5 bis, 5 ter y 8 bis) |
| Orden HAP/492/2014 | BOE-A-2014-3373 | la misma API | 26 | BOE-A-2015-8844, vigente desde 2015-08-07 (anexos) |
| RD 1619/2012 (Reglamento de facturación) | BOE-A-2012-14696 | la misma API | 57 | art. 10: RD 238/2026 (BOE-A-2026-7295), vigente desde 2026-04-20 · art. 5: RD 596/2016 |
| DIR3, ficha y área de descargas del CTT | — | `https://administracionelectronica.gob.es/ctt/dir3` y `…/ctt/dir3/descargas` | 2 páginas | fechas de modificación de sus listados: 30/06/2026 |

- **Control positivo del consolidado:** los metadatos de la Ley 25/2013 dan
  `fecha_actualizacion` = 2025-12-19 y estado de consolidación «Finalizado», y el texto trae la
  reforma de 2015. **El ejemplo de control que traía el encargo no sirve y lo digo:** la Ley 18/2022
  («Crea y Crece») no figura entre las normas que modifican la Ley 25/2013 en el análisis del BOE
  (la única es la LO 6/2015); la factura electrónica entre empresas vive en el art. 2 bis de la Ley
  56/2007, que es otra norma y aquí no se ha leído.
- **No leído, y por tanto sin afirmar nada sobre ello:** la documentación de FACe en
  `face.gob.es` (se pidieron `/es/faqs`, `/es/proveedores` y `/es/directorio/administraciones`;
  las tres contestaron 200 con una página de aplicación de unos 6 KB cuyo texto visible son 25
  caracteres: el contenido lo pinta un navegador y no lo abrí con uno); el manual de servicios web
  de FACe; el PDF «Relacion DIR3 FACE» del área de descargas de DIR3 (visto en la lista, no
  abierto); la Ley 9/2017 de Contratos del Sector Público (la Orden HAP/1074/2014 remite todavía a
  la D.A. 33.ª del texto refundido de 2011); la Ley 6/2020 de servicios de confianza (la Orden
  remite todavía a la Ley 59/2003); y cualquier norma de la Comunidad de Madrid.

## Pregunta 1

> La Ley 25/2013 y sus umbrales/plazos exactos para la obligación de facturación electrónica a
> AA.PP. — el ticket ya la cita como motivación; confirmar el detalle normativo (art. 4 y
> excepciones) antes de que aparezca en cualquier copy o decisión de producto.

**Respuesta.** La obligación no depende del importe sino de **quién factura**: están obligadas las
sociedades anónimas y limitadas y el resto de la lista cerrada del art. 4.1; una persona física (el
autónomo) no está en esa lista y para ella la factura electrónica es un derecho, no una obligación.
Los 5.000 € **no son un umbral general**: son una exclusión que cada administración puede aprobar o
no por reglamento.

**Citas** (Ley 25/2013, texto consolidado, `https://www.boe.es/buscar/act.php?id=BOE-A-2013-13722`):

- Art. 4.1, redacción de la LO 6/2015: «Todos los proveedores que hayan entregado bienes o prestado
  servicios a la Administración Pública podrán expedir y remitir factura electrónica. En todo caso,
  estarán obligadas al uso de la factura electrónica y a su presentación a través del punto general
  de entrada que corresponda, las entidades siguientes: a) Sociedades anónimas; b) Sociedades de
  responsabilidad limitada; […]». Las letras c) a f) son entidades sin nacionalidad española,
  establecimientos permanentes de no residentes, uniones temporales de empresas, y agrupaciones de
  interés económico y fondos.
- Art. 4.1, último párrafo: «las Administraciones Públicas podrán excluir reglamentariamente de
  esta obligación de facturación electrónica a las facturas cuyo importe sea de hasta 5.000 euros».
- Art. 3 (plazo): la factura se presenta ante un registro administrativo «en el plazo de treinta
  días desde la fecha de entrega efectiva de las mercancías o la prestación de servicios».
- D.F. 8.ª a): «El artículo 4, sobre obligaciones de presentación de factura electrónica, entrará
  en vigor el 15 de enero de 2015».
- Art. 6.1 y 6.7: el punto de entrada es el de cada administración; una comunidad autónoma puede
  tener el suyo o adherirse al del Estado, y si no hay ninguno el proveedor puede presentar en el
  del Estado. **«FACe» es el nombre del punto del Estado** (Orden HAP/1074/2014, D.A. 1.ª), no un
  sinónimo de «factura a una administración».

**Lo que esto corrige o confirma de lo ya escrito.** Confirma la lectura de c.14159 (la exclusión es
facultad de cada administración). Añade una cosa que no estaba escrita en ningún sitio del ticket:
Tecnosel es una S.L. y por eso está en la lista; un profesional persona física que facture a un
ayuntamiento no lo está.

**Sin contestar con fuente oficial:**

- `[VALIDAR]` Si la Comunidad de Madrid, que es la administración de los cuatro centros de la
  muestra, ha aprobado la exclusión de hasta 5.000 € y qué punto de entrada usa. No lo he
  intentado: no se buscó su normativa.
- `[VALIDAR]` Si los 5.000 € se cuentan con IVA o sin él. El art. 4 dice «importe» y nada más.
- Propuesta de frase para `docs/legal/PREGUNTAS_ASESOR.md` (no escrita allí; la escribe quien un
  jefe decida): «Para un proveedor S.L. que factura a centros educativos de la Comunidad de Madrid:
  ¿ha excluido esa administración de la factura electrónica obligatoria las facturas de hasta
  5.000 € (art. 4.1 de la Ley 25/2013)? Si es así, ¿el importe se mide con IVA o sin IVA, y por qué
  punto de entrada se presentan las que superan ese importe?»

## Pregunta 2

> Si el modelo de representación ante la AEAT (PREGUNTAS_ASESOR.md punto 1) se resuelve como
> «colaborador social», ¿sirve el mismo certificado de YaQu para firmar el Facturae, o FACe exige
> un modelo de firma distinto del de la remisión a la AEAT? Cambia si (c) del §3 necesita además
> un circuito de firma propio.

**Respuesta.** Son dos regímenes distintos: ninguna de las cuatro normas leídas menciona la
colaboración social, y lo que piden es otra cosa. Piden **dos firmas**, cada una con su regla: la de
la **factura** (firma avanzada con certificado reconocido, o sello de persona jurídica) y la de las
**comunicaciones** por servicios web con el punto de entrada, que la propia Orden permite firmar con
el certificado de un tercero contratado por el proveedor. Si un certificado de YaQu vale para firmar
la factura misma en nombre de cada profesional **no lo contesta ningún texto leído**.

**Citas:**

- Ley 25/2013, art. 5.1: las facturas «deberán tener un formato estructurado y estar firmadas con
  firma electrónica avanzada basada en un certificado reconocido, de acuerdo con lo dispuesto en el
  artículo 10.1 a) del Real Decreto 1619/2012»; art. 5.2: «También se admitirá el sello electrónico
  avanzado basado en un certificado reconocido», que debe «identificar a la persona jurídica o
  entidad sin personalidad jurídica que selle la factura electrónica».
- RD 1619/2012, art. 10.1 a), redacción del RD 238/2026 (vigente desde 2026-04-20,
  `https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696`): «firma electrónica avanzada basada en
  un certificado electrónico cualificado de firma o sello electrónico avanzado basado en un
  certificado electrónico cualificado de sello».
- Orden HAP/1074/2014 (`https://www.boe.es/buscar/act.php?id=BOE-A-2014-6662`), art. 3.4, sobre el
  envío por servicios web: las comunicaciones «estarán siempre firmadas por un certificado
  propiedad del proveedor o propiedad de un tercero diferente del proveedor con el que tenga
  contratado el servicio de facturación electrónica».
- La misma Orden, art. 3.2: la presentación «podrá realizarse mediante un representante del
  proveedor si así lo permite la normativa específica, o en su defecto, la normativa reguladora de
  las obligaciones de facturación».
- La misma Orden, art. 3.3 a), sobre el portal web (el camino que c.14159 dice que usa hoy el
  merchant): quien presenta «habrá de estar en posesión de un certificado electrónico reconocido de
  persona física, de persona física representante de persona jurídica, o de persona jurídica».
- La misma Orden, art. 3.5: si la firma de la factura no cumple, el punto de entrada «la rechazará
  de forma automática».
- RD 1619/2012, art. 5.1 y 5.3: la obligación de expedir «podrá ser cumplida materialmente por los
  destinatarios de las operaciones o por terceros», y el obligado «será el responsable del
  cumplimiento de todas las obligaciones».
- Recuento, sobre los cuatro textos descargados: «colaborador social» y «colaboración social»,
  0 apariciones; control positivo, «certificado» aparece 20, 8, 4 y 4 veces. (La primera pasada,
  con la raíz «colaborador», dio 1 y 6: eran la función colaboradora de las mutuas y las entidades
  colaboradoras de la devolución del IVA a viajeros. Leídas una a una, ninguna es esto.)

**Lo que esto cambia de lo ya escrito.** El §3 y la descripción del ticket dicen que la firma del
Facturae «es la misma decisión, no dos» que el punto 1 de `docs/legal/PREGUNTAS_ASESOR.md`. Con los
textos delante, el parecido es de fondo (quién custodia qué certificado) pero la base legal es otra:
contestar el punto 1 no contesta esto. Y hay un tercer camino que la pregunta no nombraba y la
Orden sí: que la factura la firme el profesional con su certificado y YaQu, como tercero, firme
solo el envío.

**Sin contestar con fuente oficial:**

- `[VALIDAR]` Si el punto de entrada comprueba que el titular del certificado que firma la factura
  es el emisor, o solo que el certificado es válido. La documentación de FACe no se pudo leer (ver
  «Qué se leyó»).
- `[VALIDAR]` Si el portal web de FACe admite subir un Facturae sin firmar y lo firma en el
  momento, o exige el fichero ya firmado. De eso depende el camino que apunta c.14159 («generar el
  XML Facturae para que él lo suba»).
- Propuesta de frase para `docs/legal/PREGUNTAS_ASESOR.md` (no escrita allí): «Si YaQu genera la
  factura electrónica de un profesional para una administración pública como tercero que expide por
  su cuenta (art. 5 del RD 1619/2012): ¿puede firmarla YaQu con un certificado o sello propio, o
  debe firmarla el profesional con el suyo? ¿Y basta el contrato de servicio con el profesional
  para que YaQu firme las comunicaciones con el punto de entrada (art. 3.4 de la Orden
  HAP/1074/2014), o hace falta un apoderamiento aparte? Esta pregunta es distinta de la del modelo
  de representación ante la AEAT.»

## Pregunta 3

> ¿DIR3 es un catálogo cerrado que YaQu tendría que sincronizar (como hace cualquier ERP con
> e-factura), o el profesional copia los tres códigos a mano de la orden de compra del
> organismo, como parece indicar el pie de la factura real de Tecnosel?

**Respuesta.** Las dos cosas son ciertas a la vez y ninguna norma leída obliga al proveedor a
sincronizar nada: DIR3 es un inventario público de las administraciones, con listados descargables,
y el profesional puede copiar los tres códigos a mano. Lo que decide si la factura entra no es que
el código exista en DIR3, sino que **las tres unidades y sus relaciones estén dadas de alta en el
catálogo del punto de entrada**; si no lo están, la factura no se admite.

**Citas:**

- Orden HAP/492/2014 (`https://www.boe.es/buscar/act.php?id=BOE-A-2014-3373`), D.A. 3.ª: las
  facturas «ajustarán la codificación de los órganos administrativos que participen en la
  tramitación de las mismas a la establecida en el directorio DIR3 de unidades administrativas
  comunes».
- La misma Orden, anexo II, apartado 8 (añadido en 2015): «a) Se validará que los códigos DIR3 de
  los tres órganos administrativos que resulta obligatorio identificar en la factura electrónica
  tengan valor y existan en las tablas de órganos administrativos del registro contable de
  facturas. b) Se validará que las relaciones oficina contable-órgano gestor; oficina
  contable-unidad tramitadora; y órgano gestor-unidad tramitadora existan».
- Orden HAP/1074/2014, D.A. 1.ª: FACe «actualizará de forma permanente el catálogo de unidades
  administrativas implicadas en la gestión de las facturas electrónicas: oficinas contables,
  órganos gestores y unidades tramitadoras, y de las asociaciones entre ellas», y «no admitirá
  facturas electrónicas que no correspondan a unidades administrativas que no estén
  convenientemente reflejadas en los catálogos anteriores».
- Ficha de DIR3 en el Centro de Transferencia de Tecnología
  (`https://administracionelectronica.gob.es/ctt/dir3`, leída el 26-nov-2026): «El Directorio Común
  proporciona un Inventario unificado y común a toda la Administración de las unidades orgánicas /
  organismos públicos, sus oficinas asociadas y unidades de gestión económica - presupuestaria».
  Destinatarios: «Cualquier Administración Pública». Acceso a producción: «solo disponible Red
  Sara».
- Área pública de descargas de DIR3 (`https://administracionelectronica.gob.es/ctt/dir3/descargas`,
  leída el 26-nov-2026): listados de unidades orgánicas de la AGE, de las comunidades autónomas y
  de las entidades locales, y de unidades de gestión económica-presupuestaria, todos con «Fecha de
  modificación: 30/06/2026».

**Lo que se deduce de las citas, dicho como deducción.** El servicio de DIR3 es para
administraciones (red SARA); lo que tiene a mano una empresa son los listados públicos, y el día que
se miraron llevaban casi cinco meses sin cambiar de fecha. Con qué frecuencia cambian los códigos
no lo dice ninguna fuente leída: la Orden dice «de forma permanente» y no da cifra.

**Sin contestar con fuente oficial:**

- `[VALIDAR]` Si FACe ofrece al proveedor una consulta o una descarga de su propio catálogo de
  ternas (oficina contable, órgano gestor, unidad tramitadora), por web o por servicio web. Es la
  fuente que valdría para validar un código antes de enviar, y es justo la página que no se pudo
  leer.
- `[VALIDAR]` Si los listados públicos de DIR3 incluyen el papel de cada unidad (contable, gestora,
  tramitadora) o solo el código y el nombre. No se abrió ningún listado.
- Esto no es pregunta para el asesor fiscal: es técnica, y se contesta leyendo la documentación de
  FACe con un navegador. Propuesta de frase, para quien lo retome: «¿Publica FACe su catálogo de
  relaciones oficina contable-órgano gestor-unidad tramitadora de forma que un programa de
  facturación pueda comprobar los tres códigos de un cliente antes de enviar la factura?»

## Qué cambia en la decisión

Una línea por pieza del §3. «Más grande» y «más pequeña» hablan del tamaño de la pieza, no de si
conviene hacerla.

| pieza del §3 | efecto | por qué, en una línea |
|---|---|---|
| ALTER de los tres códigos DIR3 | igual | siguen siendo tres códigos obligatorios en la factura (HAP/492/2014, D.A. 3.ª); ninguna norma leída añade ni quita campos |
| marca «es administración pública» | más grande | la obligación depende también de la forma jurídica de quien factura (art. 4.1) y el umbral de cada administración (art. 4.1, último párrafo): la marca del cliente sola no dice si la factura electrónica es obligatoria |
| generador Facturae | igual | formato estructurado y campos obligatorios por anexo (Ley 25/2013, art. 5; HAP/1074/2014, art. 5.2); el esquema Facturae no se leyó y su tamaño sigue sin medir |
| firma y entrega en FACe | distinta, no medible todavía | son dos firmas con reglas distintas y la del envío admite a un tercero (HAP/1074/2014, art. 3.4); no depende de la respuesta al punto 1 del asesor, pero si YaQu puede firmar la factura sigue en `[VALIDAR]` |
| validar los códigos antes de enviar (no estaba en el §3) | pieza nueva, opcional | lo que rechaza una factura es la terna que no existe en el catálogo del punto de entrada (HAP/1074/2014, D.A. 1.ª); copiar a mano es legal y es por donde entra el rechazo |

## Los dos datos que siguen siendo del fundador

- **Cómo presenta Tecnosel hoy sus facturas a la administración:** hay una respuesta del 2-sep-2026
  recogida en c.14159 («De momento las presentamos nosotros […] la subimos nosotros de momento»);
  el fundador la volvió a pedir como dato pendiente el 26-nov (c.22858), así que queda por
  confirmar si sigue siendo así y con qué certificado firman.
- **Qué parte de su facturación es pública:** sin dato. La única cifra es la muestra de cinco
  documentos que eligió el propio merchant, y no se ha medido aquí.

## Lo que no medí, junto a lo que sí

Leí artículos concretos de cuatro normas consolidadas y dos páginas del CTT; no leí ninguna de
ellas entera, ni la documentación de FACe, ni normativa autonómica. Todo lo marcado `[VALIDAR]`
está sin fuente: no es una respuesta probable, es una pregunta abierta. Las vigencias citadas son
las que da el BOE en cada bloque del consolidado; no comprobé normas posteriores que puedan afectar
sin modificar el texto (por ejemplo, la sustitución de la Ley 59/2003 por la Ley 6/2020).
