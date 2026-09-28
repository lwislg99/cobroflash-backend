# SCRUM-1232 · El libro registro de facturas expedidas incluye justificantes (`type 'JUST'`)

El ticket es de J1 (`area-j1`). Este fichero lo abre la parte **b**, que sólo mira la norma. Si J1
escribe aquí su parte, **anexa una sección** (A8); no escribe encima.

## SCRUM-1232b · ¿Un justificante de cobro entra en el libro registro y en el 303? Lo que dice la norma

**Medido contra:** `origin/main` = `7ddab7d83ed9cc6c7c4b18e9d780f641c56fe1a6` · 2026-09-28T20:16:50Z (hora de GitHub, `gh api -i zen`)

Sesión J5 (`jv-j5`), 28-sep-2026 por la noche, por encargo del orquestador de Javier. **Aquí sólo se
lee y se cita.** No se toca `src/` ni el camino de emisión (regla 38/40), no se arregla el 1232 y no se
escribe ningún texto de pantalla. Es el expediente normativo que servirá para decidirlo. **No es una
afirmación fiscal de producto** (regla 7), y lo que no se puede sostener con fuente queda **SIN
DETERMINAR** o **→ ASESOR**.

### ⓪ PASO 0 · el defecto sigue vivo en este `main`

Repetí la sonda de J1 (comentario 17411) con `dist/` recién compilado desde `7ddab7d8`: funciones
reales, cliente Prisma falso, **ninguna base**. Filas del merchant 7 en el 3T-2026: `F260001` F1 base
100 · `J-2026-0001` **JUST** base 200 · `R260001` R1 base −100, todo al 21 %, más una factura del
merchant 8 como control de tenencia. La sonda y su salida están en
`evidencias/SCRUM-1232b/sonda-libro-303.mjs`.

| pasada | `where` que pide `leerLibroRegistro` | asientos | 303 · 07 / 09 | 303 · 27 |
|---|---|---|---|---|
| `main` tal cual | `{ merchantId, createdAt }` (sin `type`) | F1 · **JUST** · R1 | **200 / 42** | **42** |
| con `type: { not: 'JUST' }` simulado **en el cliente falso** | — | F1 · R1 | 0 / 0 | 0 |

**Vivo.** Es lo mismo que midió J1 sobre `0afa87cd`: el justificante es lo único que pone IVA en el 303
de esa muestra.

### Ⓐ Las fuentes

Descargadas con `curl` el 28-sep-2026 entre las 20:13Z y las 20:16Z. **Las del BOE salen todas de la
API de legislación CONSOLIDADA** (la norma de SCRUM-1242), no de `buscar/xml.php`. Cada cita lleva la
vigencia leída del atributo `fecha_vigencia` de la última `<version>` del bloque con fecha ≤ hoy. Los
extractos literales, con los mismos sha256, están en `evidencias/SCRUM-1232b/extractos.txt`, y el
extractor en `evidencias/SCRUM-1232b/extraer-articulo.cjs`.

| # | fuente | de dónde | sha256 |
|---|---|---|---|
| C2 | **Ley 37/1992 (LIVA)**, consolidada | `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-1992-28740/texto` | `371432fc76f0ae3cb7bac8530cb1e229a8c6c6f2e09ee6fdf3f78fc18a70a202` |
| C3 | **RD 1624/1992 (RIVA)**, consolidado | `…/id/BOE-A-1992-28925/texto` | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` |
| C4 | **RD 1619/2012 (ROF)**, consolidado | `…/id/BOE-A-2012-14696/texto` | `95d8ff283a96a2a74263fd0bc079cbd00a5c5a418ba66ec046ca2aef4d56f586` |
| C10 | **Orden EHA/3786/2008 (modelo 303)**, consolidada | `…/id/BOE-A-2008-20953/texto` | `b9c55b7ff35c95c51ff5e9bb23c76ce455d33ee5beeafbc3664ddfccf0c48e1d` |
| W2 | Sede AEAT, **instrucciones del modelo 303** (2026, periodos 02-12 y 2T-4T) | `https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html` | HTML, cambia con la plantilla. De referencia: `544f27f23d9b66f7d60ac57f838f1748c48a7f35686815955cbefa016f20ea18` |

**Control de la sonda de fuentes.** C2, C3 y C4 dan **el mismo sha256** que en SCRUM-1240, descargados
hora y media antes por mi sesión anterior: las fuentes no han cambiado. **Control de que es el
consolidado:** el RIVA vigente del art. 63 no contiene «documento sustitutivo» (0 apariciones en la
versión vigente desde 2023-07-01), y el XML completo sí lo contiene (28), en versiones anteriores del
mismo artículo. Si fuera el texto publicado en 1992, lo tendría en la vigente.

**Lo que no pude leer.** El anexo I de C10, que es el formulario del 303, está en el BOE **como
imagen** (67 `<img>`, vigente desde 2026-01-27 por la Orden HAC/27/2026). El rótulo «IVA devengado» de
las casillas lo cito de W2, que es la AEAT y **no es norma**: es su instrucción oficial.

### Ⓑ Pregunta 1 — ¿Qué es un «justificante de cobro» a efectos del IVA?

**Respuesta: no es nada con nombre legal. Es una figura nuestra.** 🟢 Sostenido.

1. **La expresión no existe en la norma.** «justificante de cobro» aparece **0 veces** en LIVA, RIVA y
   ROF consolidados (recuento sobre los tres XML completos).
2. **El ROF sólo usa «justificante» en tres sentidos, y ninguno es el nuestro:**
   - Genérico, en el título y el cuerpo del **art. 1 ROF** (vigente desde 2013-01-01): «Los empresarios
     o profesionales están obligados a expedir y entregar, en su caso, **factura u otros
     justificantes** por las operaciones que realicen…». No define ninguno.
   - **Justificante contable**, **art. 2.4 ROF** (vigente desde 2021-07-01): «cualquier documento que
     sirva de soporte a la anotación contable de la operación **cuando quien la realice sea un
     empresario o profesional no establecido en la Comunidad**». Un profesional de oficios en España
     no lo es.
   - **Recibo** del régimen especial de agricultura, ganadería y pesca, **art. 16.1 ROF** (vigente desde
     2015-01-01): lo expide quien **compra** a un agricultor acogido a ese régimen. Tampoco.
3. **Lo que la norma exige por esa operación es una FACTURA.** **Art. 2.1 ROF** (vigente desde
   2021-07-01): «los empresarios o profesionales están obligados a expedir factura y copia de esta por
   las entregas de bienes y prestaciones de servicios que realicen en el desarrollo de su actividad
   […] **sin más excepciones que las previstas en él**». Y el párrafo segundo alcanza también a la
   señal: «También deberá expedirse factura y copia de esta **por los pagos recibidos con anterioridad
   a la realización** de las entregas de bienes o prestaciones de servicios». Lo repite la ley: **art.
   164.Uno.3.º LIVA** (vigente desde 2024-01-01), «Expedir y entregar factura de todas sus operaciones».
4. **Las excepciones del art. 3 ROF** (vigente desde 2019-01-01) son operaciones exentas del art. 20,
   recargo de equivalencia, régimen simplificado por módulos, autorizaciones de la AEAT y el régimen de
   agricultura. **Ninguna es «el profesional cobró sin tener activada la facturación».** Y si el cliente
   es empresario, el **art. 2.2.a) ROF** obliga a factura «en todo caso».
5. **La forma mínima que admite la norma sigue siendo una factura:** la **simplificada** del **art. 4
   ROF** (hasta 400 €, IVA incluido, o 3.000 € en ciertas operaciones).

**Lo que eso significa para el `J-`, leído en nuestro código.** El PDF del justificante
(`invoicing/infra/pdf/pdf.service.ts:389` y `:697-702`) se titula «JUSTIFICANTE DE COBRO», dice «No
constituye una factura» y **desglosa base e IVA** («TOTAL COBRADO»). Es decir: **documenta una
operación sujeta, con su IVA, por la que la norma pedía una factura que no se expidió.** Nuestro propio
código ya lo sabía: `tipoDocumento.ts:18` («Un justificante de cobro **no es una factura**») y
`AEAT_POR_TIPO.JUST = null`.

> ⚠️ Una observación que no me toca decidir: el **art. 88.Dos LIVA** (vigente desde 2013-01-01) dice
> que «La repercusión del Impuesto deberá efectuarse **mediante factura**», y el **88.Tres**, «al
> tiempo de expedir y entregar la factura». Un documento que dice no ser factura y desglosa el IVA
> está en un sitio que la ley no contempla. **Qué es exactamente eso → ASESOR.**

### Ⓒ Pregunta 2 — ¿Qué compone el libro registro de facturas EXPEDIDAS?

**Respuesta: las facturas que el profesional ha expedido, y nada más.** 🟢 Sostenido.

- **Art. 62.1.a) RIVA** (vigente desde 2021-07-01): el primero de los libros obligatorios es el
  «Libro registro de facturas expedidas». El nombre de la pantalla es **el nombre reglamentario**.
- **Art. 63.1 RIVA** (vigente desde 2023-07-01): «deberán llevar y conservar un libro registro **de
  las facturas que hayan expedido**, en el que se anotarán, con la debida separación, el total de los
  referidos documentos».
- **Art. 63.3 RIVA**: «se inscribirán, **una por una, las facturas expedidas**», con número y serie,
  fecha de expedición, **fecha de realización de las operaciones, en caso de que sea distinta**,
  destinatario, base, tipo y cuota. Las letras d) y e) nombran las **rectificativas** y las
  **simplificadas canjeadas**: todas son facturas.
- **Lo único que entra sin ser factura** es la regularización de base de las agencias de viajes y de
  bienes usados cuando no procede rectificativa (63.3, párrafo segundo). No nos aplica.
- Para quien lleva el SII (62.6), la orden de campos «podrá exigir» identificar «recibos y otros
  documentos» del art. 16.1 y de la DA 1.ª ROF. Son los recibos agrarios de arriba. Tampoco nos aplica.
- **Control de la versión:** las seis versiones del art. 63 vigentes entre 1993-01-01 y la de
  2013-10-27 dicen «las facturas **o documentos sustitutivos**». Desde la de 2017-07-01 ya no lo
  dicen, y la vigente (2023-07-01) tampoco. El ROF de 2012 había suprimido los documentos sustitutivos
  (su disposición transitoria permite canjear los antiguos por facturas). **No queda en el libro ningún hueco para un documento que no sea factura.**

**Conclusión 2.** Un `J-` **no se anota** en el libro de expedidas. Tampoco en el que exportamos a la
AEAT, que es su versión electrónica. Esto **coincide** con lo que ya pregunta P16.1
(`docs/legal/PREGUNTAS_ASESOR.md:648`) para el registro VERI\*FACTU: excluirlo, no reclasificarlo.

### Ⓓ Pregunta 3 — El 303, ¿se declara por documento emitido o por operación devengada?

**Respuesta: por operación DEVENGADA en el periodo. La factura no es el hecho que se declara.**
🟢 Sostenido por la ley y por la instrucción de la AEAT. El formulario no lo pude leer (Ⓐ).

- **Art. 164.Uno.6.º LIVA**: «Presentar las declaraciones-liquidaciones correspondientes e ingresar el
  importe del Impuesto resultante». **Art. 167.Uno LIVA** (vigente desde 2023-01-01): «los sujetos
  pasivos deberán **determinar e ingresar la deuda tributaria**». **Art. 71.1 RIVA** (vigente desde
  2024-12-22): «la **determinación de la deuda tributaria** mediante declaraciones-liquidaciones», y el
  **71.3**: el período de liquidación es el trimestre natural.
- **Qué deuda cae en cada periodo lo decide el DEVENGO, art. 75 LIVA** (vigente desde 2021-07-01):
  - servicios: «**cuando se presten, ejecuten o efectúen** las operaciones gravadas» (75.Uno.2.º);
  - ejecuciones de obra con aportación de materiales: cuando los bienes «se pongan a disposición del
    dueño de la obra» (75.Uno.2.º, tercer párrafo);
  - **pagos anticipados** (la señal): «el impuesto se devengará **en el momento del cobro** total o
    parcial del precio por los importes efectivamente percibidos» (75.Dos).
  - **Ninguna de esas reglas depende de la factura.** La única del artículo que la nombra es la de las
    entregas intracomunitarias (75.Uno.8.º), y lo hace para **adelantar** el devengo, nunca para
    crearlo.
- **La AEAT (W2)** agrupa las casillas 01 a 09 bajo **«IVA Devengado»**, por tipo («En las casillas 07,
  08 y 09 se harán constar las bases imponibles gravadas al tipo del 21% y las cuotas resultantes»), y
  define la declaración «sin actividad» como aquella en la que «**no se hayan devengado** ni soportado
  cuotas». No distingue entre operaciones con o sin factura.

**Conclusión 3.** Quitar el justificante del libro **no debe** quitarlo del 303 por arrastre. Son dos
poblaciones distintas por norma: el libro son **documentos** (facturas), y el 303 son **operaciones
devengadas**. Hoy nuestro código las trata como una sola, porque el 303 se construye sumando el libro
(`modelo303.repo.ts:3-6`, dicho a propósito: «el 303 y el libro siguen diciendo lo mismo»). **La
norma no dice que tengan que coincidir.** Con facturas bien emitidas coinciden casi siempre. Con un
`J-` no.

### Ⓔ Pregunta 4 — ¿Puede una operación devengar IVA sin que se emita factura? ¿Cómo se declara?

**Respuesta: SÍ devenga. Cómo se regulariza, en concreto → ASESOR.** 🔴 Éste es el riesgo.

- **Sí devenga (🟢 sostenido).** El devengo del art. 75 LIVA (Ⓓ) nace de la operación o del cobro
  anticipado, no del papel. Emitir la factura es una **obligación distinta** (164.Uno.3.º) cuyo
  incumplimiento no hace desaparecer la deuda del 164.Uno.6.º. La propia ley lo presupone: el **art.
  88.Cuatro LIVA** cuenta el plazo para repercutir «**desde la fecha del devengo**», no desde la
  factura. Y el art. 3 ROF enumera operaciones **sujetas** que no necesitan factura: el impuesto existe
  aunque el documento no.
- **Por eso filtrar el `J-` del 303 infradeclararía**, **si** el justificante documenta una operación
  sujeta y ya devengada en ese periodo. Lo que dice nuestro PDF (base, IVA, «TOTAL COBRADO») apunta a
  que sí. Con la muestra de la sonda, la 27 pasaría de 42 a 0.
- **Lo que la norma NO me deja cerrar (→ ASESOR):**
  1. **En qué casillas.** Las instrucciones no distinguen «con factura» y «sin factura»: todo va a
     01-09 por tipo. **No hay casilla aparte para operaciones sin factura.** Yo leo que van en las mismas
     casillas, pero no tengo una cita que lo diga expresamente para este caso.
  2. **En qué periodo.** Nuestro libro filtra por `createdAt`, la fecha del `J-`, que es la del cobro.
     Para una **señal** coincide con el devengo (75.Dos). Para un **trabajo ya terminado** el devengo es
     la prestación (75.Uno.2.º), que puede caer en otro trimestre.
  3. **Si hay que expedir ahora la factura que faltó**, con fecha de hoy y la de la operación (63.3
     permite «fecha de realización… distinta»), y fuera del plazo del **art. 11 ROF** (vigente desde
     2014-01-01): «en el momento de realizarse la operación», o antes del día 16 del mes siguiente si el
     cliente es empresario. Y si al expedirla **entra entonces en el libro**.
  4. **La consecuencia sancionadora** de no haberla expedido. Fuera de mi alcance, igual que en 1240.

### Ⓕ Lo que la norma dice de las tres salidas de SCRUM-1232

| salida | qué hace | veredicto | por qué |
|---|---|---|---|
| **(a)** excluir en `leerLibroRegistro` | lo quita del libro, del libro AEAT, de evidencias, de Informes **y del 303** | ❌ **CAE** | Acierta en el libro (Ⓒ) y **se equivoca en el 303** (Ⓓ, Ⓔ): IVA devengado que desaparece de la autoliquidación. Es peor que el defecto que arregla, como se temía. |
| **(b)** excluirlo del libro y del libro AEAT; que el 303 lo siga declarando, a la vista | libro = facturas; 303 = operaciones devengadas | ✅ **QUEDA EN PIE** | Es la única que respeta a la vez el RIVA 63 (Ⓒ) y el LIVA 75/167 (Ⓓ). **Dos matices:** «aparte» sólo puede ser aparte **en nuestro modelo** (un aviso, un desglose), porque el 303 **no tiene casilla propia** para esto (Ⓔ.1). Y lo que haya que hacer con la factura que faltó, el periodo exacto y la sanción siguen **→ ASESOR** (Ⓔ.2-4). |
| **(c)** mantener el libro y cambiarle el nombre | la pantalla deja de llamarse «de facturas expedidas» | ❌ **CAE como arreglo** | «Libro registro de facturas expedidas» es el **nombre del RIVA** (62.1.a). Cambiar el rótulo no hace que el `J-` sea una factura, y **no contesta al 303**: el defecto de fondo seguiría igual. Además choca con SCRUM-612/825, que retiran el justificante. Una lista aparte de «cobros sin factura» podría existir **junto a** (b), pero sería texto nuevo y necesitaría firma (regla 39). |

**Veredicto: la (b).** La (a) queda descartada por la norma. La (c) no arregla nada fiscal.

### Ⓖ Dos cosas del código que el que decida (b) tiene que saber (sólo leídas; no tocadas)

1. **«Es un justificante» se decide hoy por DOS criterios, y no coinciden.** `invoiceAdmin.ts:40` y
   `tipoDocumento.ts` miran `type === 'JUST'`. `receipt.routes.ts:104` e `invoiceAdmin.ts:251` miran
   **además** el número (`isReceiptNumber`, `^J-`). Y el censo de producción del 10-ago-2026
   (`PREGUNTAS_ASESOR.md:640-641`, medido por otra sesión) contó **44 `JUST` y 5 `F1` con número
   `J-`**. Un filtro sólo por `type` dejaría esas **5** dentro del libro, como facturas. **Cuántas hay
   hoy: SIN DETERMINAR.** No mido producción (el encargo lo prohíbe, y la clave del entorno no se usa).
   Desde SCRUM-1027 (21-sep-2026) no se emite ninguno nuevo (`invoiceNumber.service.ts:545-547`).
2. **El 303 fecha por emisión, y la norma fecha por devengo.** Pasa también con las facturas normales,
   no sólo con el `J-`: el art. 11 ROF deja facturar a un empresario hasta el día 16 del mes siguiente,
   y una obra del 28-sep facturada el 10-oct devenga en el 3T y nuestro 303 la pondría en el 4T.
   **No lo he medido; lo he leído.** Lo dejo anotado como posible ticket para el orquestador, no como
   defecto confirmado.

### Ⓗ Propuesta de pregunta para la consulta de Javier (texto de trabajo, no firmado)

> Durante unas semanas, un profesional en régimen general, sin la facturación activada, cobraba por
> YaQu y recibía un «justificante de cobro» (serie `J-`) que desglosa base e IVA y dice «No constituye
> una factura». (1) Esas operaciones, ¿se declaran en el 303 del periodo de devengo, en las casillas
> 01-09 como cualquier otra? (2) ¿Hay que expedir ahora la factura que faltó (art. 2 y 11 ROF), y con
> qué fechas? Si es así, ¿entra entonces en el libro de expedidas? (3) Si el `J-` fue una señal, ¿el
> devengo es la fecha del cobro (art. 75.Dos LIVA)? Y si fue un trabajo terminado, ¿la de la
> prestación? (4) ¿Qué consecuencia tiene no haberla expedido en plazo?

Encaja al lado de P15 (libros) y P16.1 (el justificante en el registro), en `PREGUNTAS_ASESOR.md`.
**No lo he añadido allí:** ese fichero lo decide su dueño.

### Ⓘ Lo que me salió mal

Al volcar los sha256 en `extractos.txt`, `sha256sum` sobre una ruta con espacio y barras de Windows
escapó el nombre y antepuso una `\` al hash. Lo arreglé dos veces con una expresión regular que no
casaba, y en lugar de mirar la línea di por buena una causa que no era: primero pensé en CRLF, y el
fichero no tenía ni uno. Al final medí la línea, vi que la barra se me perdía en el heredoc y reescribí
el arreglo sin barras. Los hashes buenos coinciden con los de 1240.

Y en el primer borrador escribí que el art. 63 decía «documentos sustitutivos» «hasta 2012». Lo había
deducido de la fecha del ROF, sin mirarlo. Al medirlo versión por versión salió otra cosa: la
expresión sigue en la versión de 2013-10-27 y desaparece en la de 2017-07-01. Está corregido arriba.
También había citado `tipoDocumento.ts:17`, y la frase está en la `:18`.
