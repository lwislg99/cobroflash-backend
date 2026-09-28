# SCRUM-1240 · Criterio de caja: qué dice la norma sobre `ClaveRegimen`

**Medido contra:** `origin/main` = `0afa87cd95645317226f59bc379edae59a7bea44` · 2026-09-28T18:39:19Z (hora de GitHub)

Sesión J5 (`jv-j5`), 28-sep-2026 por la noche, por encargo del orquestador de Javier. **Aquí sólo se
lee y se cita.** No se toca `src/`, ni `registro.builder.ts`, ni el esquema. Tampoco se redacta
ningún texto de pantalla: cambiar de dónde sale `claveRegimen` es regla 40 y necesita el GO del
fundador. Esto es el expediente normativo del ticket, **no una afirmación fiscal de producto**
(regla 7).

La pregunta: SCRUM-1129b midió que el libro registro aplica `Merchant.criterioCaja` y que el
registro VERI\*FACTU manda `01` fijo. ¿Qué dice la norma que debería pasar?

## ⓪ Un error mío de 1129b, corregido antes de empezar

En 1129b escribí: «**El módulo fiscal NO lo lee.** `git grep criterioCaja -- src/modules/fiscal` → 0
resultados». El recuento era cierto, pero la conclusión era falsa. **El identificador no aparece,
pero el dato sí llega:** `fiscal/modelo303/modelo303.repo.ts:21`, `fiscal/librosAeat/librosAeat.repo.ts:44`
y `fiscal/evidencias/paquete.repo.ts:40` llaman a `criterioDelMerchantParaElLibro()`, que es quien lo
lee. Contar un nombre no es contar quién usa el dato (A3: «un prefijo no es un nombre»). Lo medido hoy
en `0afa87cd`, sólo leyendo:

| pieza | ¿aplica el criterio de caja del merchant? | dónde |
|---|---|---|
| libro registro de expedidas | **sí** | `invoicing/domain/criterioDelMerchant.ts`, `libroRegistro.repo.ts` |
| modelo 303 | **sí** (le llega por el libro) | `fiscal/modelo303/modelo303.repo.ts:21-22` |
| libros para la AEAT | **sí** | `fiscal/librosAeat/librosAeat.repo.ts:44-45` |
| paquete de evidencias | **sí** | `fiscal/evidencias/paquete.repo.ts:40-42` |
| **registro VERI\*FACTU** | **no**: `claveRegimen: CLAVE_REGIMEN_GENERAL` (`'01'`) | `fiscal/verifactu/registro.builder.ts:313` (rama S2) y `:328` (rama S1) |
| **PDF de la factura** | **no se encuentra la mención obligatoria** (ver Ⓓ) | `invoicing/infra/pdf/pdf.service.ts` |

**La contradicción es más ancha de lo que decía el ticket.** No son dos piezas, son cuatro contra
dos. El 303 y los libros declaran por caja, y el registro VERI\*FACTU dice «régimen general».

## Ⓐ Las fuentes

Descargadas con `curl` el 28-sep-2026 entre las 18:35Z y las 18:39Z. **Todas las del BOE salen de la API
de legislación CONSOLIDADA** (la norma de SCRUM-1242, aplicada), no de `buscar/xml.php`. La fecha
de vigencia de cada artículo va con su cita, leída del atributo `fecha_vigencia` de la última
`<version>` del bloque.

| # | fuente | de dónde | sha256 |
|---|---|---|---|
| C1 | **RD 1007/2023 (RRSIF)**, consolidado | `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-2023-24840/texto` | `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38` |
| C2 | **Ley 37/1992 (LIVA)**, consolidada | `…/id/BOE-A-1992-28740/texto` | `371432fc76f0ae3cb7bac8530cb1e229a8c6c6f2e09ee6fdf3f78fc18a70a202` |
| C3 | **RD 1624/1992 (RIVA)**, consolidado | `…/id/BOE-A-1992-28925/texto` | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` |
| C4 | **RD 1619/2012 (ROF)**, consolidado | `…/id/BOE-A-2012-14696/texto` | `95d8ff283a96a2a74263fd0bc079cbd00a5c5a418ba66ec046ca2aef4d56f586` |
| C8 | **Orden HAC/1177/2024**, consolidada (anexo, listas L8A/L8B) | `…/id/BOE-A-2024-22138/texto` | `284db49ed40e17ad47fb2447a6e37ef087c192d68336df9bd465fdfcbfd4a4ff` |
| C9 | **Ley 58/2003 (LGT)**, consolidada | `…/id/BOE-A-2003-23186/texto` | `abc3a2730bef3ee18569dacd58c71bf4e51424b2058087c032d805061c72f4c9` |
| F3 | AEAT, `Validaciones_Errores_Veri-Factu.pdf`, §15.6 | la F3 de 1129 | `426eb926fc098a36a163f66ca5f40d9e0847ca23300bbe5008979832d3513440` (v1.2.2) |
| F5 | AEAT, `FAQs-Desarrolladores.pdf`, §§ «Rectificaciones, anulaciones, subsanaciones» y 24 | la F5 de 1129 | `73906dc8afbbb9da35f6cb489980352b42aed66d48828fd62a00168883c09d5e` (v1.3, 4-dic-2025) |
| W1 | Sede AEAT, «Criterio de caja» y sus subpáginas «Obligaciones formales» y «Preguntas frecuentes» | `https://sede.agenciatributaria.gob.es/Sede/iva/regimenes-tributacion-iva/criterio-caja.html` (+ `/criterio-caja/obligaciones-formales.html`, `/criterio-caja/preguntas-frecuentes.html`) | HTML: cambia con la plantilla, se cita el texto. De referencia: `dc3b9524…`, `b06b8791…`, `201da697…` |

**Control de las dos sondas.** C1 a C4, F3 y F5 dan **el mismo sha256** que en 1129b, descargados
dos horas antes. Las fuentes no han cambiado entre las dos mediciones, y lo citado allí sigue valiendo.
W1 es la segunda sonda, independiente del BOE: repite la ley con las palabras de la AEAT, y coincide
en todo lo que cito abajo.

## Ⓑ Pregunta 1 — ¿El criterio de caja se refleja en `ClaveRegimen`? ¿Con qué valor y cuándo?

**Sí: con la clave `07`, y sólo en las operaciones a las que se aplica el régimen.**

- **El valor.** C8, anexo, lista **L8A** (*«Descripción de la clave de régimen para desgloses donde
  el impuesto de aplicación es el IVA»*): **`07` — «Régimen especial del criterio de caja.»**
  (vigente desde el 29-oct-2024). La L8B, del IGIC, lleva el mismo `07`.
- **Por qué hay que informarlo.** C1, **RRSIF art. 10.1.k)** (vigente desde el 7-dic-2023): el
  registro de alta incluirá la *«Indicación del régimen o regímenes aplicados a las operaciones
  documentadas a efectos del Impuesto sobre el Valor Añadido»*. El criterio de caja **es** un
  régimen especial: C2, LIVA, Título IX, Capítulo X, *«régimen especial del criterio de caja»*.
- **Cuándo: por operación, no por merchant.** C2, **LIVA art. 163 duodecies.Uno**, párrafo 2.º
  (vigente desde el 1-ene-2014): *«El régimen especial del criterio de caja se referirá a todas las
  operaciones realizadas por el sujeto pasivo sin perjuicio de lo establecido en el apartado
  siguiente de este artículo.»* Y el **apartado Dos** enumera las que quedan fuera:
  > *«a) Las acogidas a los regímenes especiales simplificado, de la agricultura, ganadería y pesca,
  > del recargo de equivalencia, del oro de inversión, aplicable a los servicios prestados por vía
  > electrónica y del grupo de entidades. b) Las entregas de bienes exentas a las que se refieren los
  > artículos 21, 22, 23, 24 y 25 de esta Ley. c) Las adquisiciones intracomunitarias de bienes. d)
  > Aquellas en las que el sujeto pasivo del Impuesto sea el empresario o profesional para quien se
  > realiza la operación de conformidad con los números 2.º, 3.º y 4.º del apartado uno del artículo 84
  > de esta Ley. e) Las importaciones y las operaciones asimiladas a las importaciones. f) Aquellas a
  > las que se refieren los artículos 9.1.º y 12 de esta Ley.»*
- **La AEAT lo hace cumplir en el registro.** F3, **§15.6.5 «ClaveRegimen 07. Criterio de caja»**:
  *«Si ClaveRegimen = "07": CalificacionOperacion no puede ser "S2", "N1", "N2". OperacionExenta no
  puede ser "E2", "E3", "E4" y "E5".»* Es la letra d) (S2) y la b) (E2 a E5) de la ley, traducidas a
  campos.
- **Y qué clave lleva la operación excluida.** F5, §24, con ejemplos de un emisor *«en criterio de
  caja (ClaveRegimen=[07])»*: a la operación que queda fuera le pone **`01`** (servicio a un
  empresario de fuera de la UE, y servicio a un empresario de la UE con VIES) o **`08`** (IPSI/IGIC).
  Es decir, la clave de la operación excluida es **la que le tocaría sin caja**, no la `07`.

**Consecuencia para el caso que ya mediste en 1129:** un fontanero en caja que factura a una
constructora con inversión del sujeto pasivo (línea `S2`) lleva **`01` en esa línea** y **`07` en las
demás**. No es «si `criterioCaja` entonces `07`»: es «si `criterioCaja` **y** la operación no cae en
163 duodecies.Dos, entonces `07`».

**Y además:** la opción no tiene grados. C3, **RIVA art. 61 septies.2** (vigente desde el
1-ene-2014): *«La opción deberá referirse a todas las operaciones realizadas por el sujeto pasivo que
no se encuentren excluidas del régimen especial conforme a lo establecido en el apartado dos del
artículo 163 duodecies»*. Un merchant en caja no puede elegir factura a factura.

## Ⓒ Pregunta 2 — ¿Es compatible con módulos, recargo de equivalencia y REAGYP?

**En la misma operación, excluyente. En el mismo profesional, compatible, siempre que sean
operaciones distintas.**

- **En la operación, excluyente, por ley.** Lo dice la letra a) de 163 duodecies.Dos, citada arriba:
  una operación acogida al simplificado (`20`), al recargo (`18`) o al REAGYP (`19`) **queda fuera del
  criterio de caja**. Nunca puede llevar a la vez la `07` y una de esas tres. W1 lo repite literal:
  *«Se excluyen: Las acogidas a los regímenes especiales simplificado, de la agricultura, ganadería y
  pesca, del recargo de equivalencia, del oro de inversión […]»*.
- **En el profesional, compatible.** La exclusión es de **operaciones**, no de personas: 163
  duodecies.Uno dice «sin perjuicio» de ese apartado. La AEAT lo confirma en W1 (preguntas
  frecuentes): *«Un sujeto pasivo que tributa en REAGP ¿puede acogerse al RECC por las operaciones de
  transmisión de inmuebles? Sí, siempre que no haya inversión del sujeto pasivo, operación que
  también está excluida del RECC.»* Y en sentido contrario: *«Un sujeto pasivo que tributa en régimen
  simplificado ¿puede acogerse al RECC por las operaciones de transmisión de activos fijos? No, dado
  que la transmisión de activos fijos forma parte del contenido del régimen simplificado.»*
- ⚠️ **La AEAT no lo vigila en el registro.** Medido sobre F3 v1.2.2, §15.6 entera: **no hay ninguna
  validación que cruce la `07` con la `18`, la `19` o la `20`** entre desgloses. Las únicas reglas de
  la `07` son las de §15.6.5 (S2, N1, N2, E2 a E5). **Control positivo:** la misma lectura sí
  encuentra reglas que cruzan otras claves con otros campos, como la `10` (*«TipoFactura tiene que ser "F1"»*) o la
  `14`. Si un registro llevara `07` y `18` en la misma operación, **la ley lo prohíbe y la AEAT lo
  aceptaría igual**. El programa no puede fiarse de que la AEAT le avise.
- **Para nuestros oficios, esto es casi teórico**, y lo dice 1129b (Ⓓ): los oficios de la división 5
  del IAE no pueden estar en módulos en 2026 (Orden HAC/1425/2025), el recargo sólo aparece si hay
  tienda, y ningún oficio entra en el REAGYP. **El choque realista es `07` con `S2`**, no `07` con
  `18`/`19`/`20`.

## Ⓓ Pregunta 3 — ¿Quién tiene que estar en el registro: el emisor, el destinatario o los dos?

**El registro VERI\*FACTU es del EMISOR.** El destinatario tiene obligaciones propias por el criterio de caja
de su proveedor, pero las cumple en **su** libro de recibidas, no en el registro de facturación de
quien le factura.

- **El registro lo genera el obligado a expedir la factura.** C1, **RRSIF art. 10.1.a)**: el
  registro de alta lleva el *«Número de identificación fiscal y nombre […] del obligado a expedir la
  factura»*. Del destinatario, la letra b) pide sólo **la identificación** (*«Cuando sea obligatorio
  […] el número de identificación fiscal […] del destinatario»*). **Ningún campo del art. 10 recoge
  el régimen del destinatario.** La clave `07` describe la operación **del emisor**.
- **El destinatario, en su propio libro.** C2, **LIVA art. 163 quinquiesdecies.Uno** (vigente desde
  el 1-ene-2014): *«El nacimiento del derecho a la deducción de los sujetos pasivos no acogidos al
  régimen especial del criterio de caja, pero que sean destinatarios de las operaciones incluidas en
  el mismo, […] se producirá en el momento del pago total o parcial del precio»*. Y C3, **RIVA
  art. 61 decies.2** (vigente desde el 1-ene-2014): *«Los sujetos pasivos acogidos al régimen
  especial del criterio de caja así como los sujetos pasivos no acogidos al régimen especial del
  criterio de caja pero que sean destinatarios de las operaciones afectadas por el mismo deberán
  incluir en el libro registro de facturas recibidas […] 1.º Las fechas del pago […] 2.º Indicación
  del medio de pago»*. En el mismo sentido, **RIVA art. 64.4** (vigente desde el 1-ene-2018).
- **Cómo se entera el destinatario: por la factura.** C4, **ROF art. 6.1.p)** (vigente desde el
  7-dic-2023): *«En el caso de aplicación del régimen especial del criterio de caja la mención
  «régimen especial del criterio de caja.»* (sic, las comillas del BOE consolidado van así). Y C3,
  **RIVA art. 61 undecies.1**: *«toda factura y sus copias expedida por sujetos pasivos acogidos al
  régimen especial del criterio de caja referentes a operaciones a las que sea aplicable el mismo,
  contendrá la mención de «régimen especial del criterio de caja»»*. W1, «Obligaciones formales»:
  *«Deberán incluirse en las facturas que se emitan la mención "régimen especial del criterio de
  caja"»*.
- **Y el registro también le llega al destinatario.** C1, **RRSIF disposición adicional tercera**:
  *«Los destinatarios de las facturas cuya información haya sido remitida por «Sistemas de emisión de
  facturas verificables», además de poder verificar en línea la información de esas facturas
  recibidas, podrán descargarla para integrarla en sus libros registros.»* **Lectura mía, no cita:**
  un `01` donde debía ir `07` no sólo es un error del emisor. Es el dato que el destinatario puede
  descargar a su libro, y le diría que deduzca al recibir, cuando la ley le obliga a esperar al pago.
  **Si la AEAT cruza así los datos, no está determinado** con las fuentes leídas.

**Lo que esto significa en YaQu, en sus dos papeles:**

1. **Como emisor** (el merchant factura): hacen falta **dos** cosas y hoy no se cumple **ninguna**.
   La `07` en el registro no se pone (builder `:313`/`:328`). La mención en la factura (ROF 6.1.p)
   **no la encuentro**: `git grep -i "especial del criterio" origin/main -- src public` → **0**
   resultados. **Control positivo** del mismo instrumento: `git grep -i "criterio de caja" -- src public`
   sí encuentra la etiqueta de Ajustes (`public/dashboard/js/settingsView.js:297`) y los mensajes de
   error de `criterioCaja.ts`. **No he generado un PDF**: es lectura, no ejecución. El rojo lo
   escribe quien lo arregle.
2. **Como destinatario** (los gastos del merchant): si un proveedor suyo está en caja, el merchant
   tiene que anotar en recibidas **la fecha y el medio de pago** (RIVA 61 decies.2).
   `libroRecibidas.ts` no trata el criterio de caja: sus tres apariciones de «caja» hablan de
   «apunte de caja», que es otra cosa. **Sin víctima hoy.** Lo reporto aquí y **no abro ticket** (A7).

## Ⓔ Pregunta 4 — ¿Qué pasa hoy, de verdad, si el libro y el registro discrepan?

**Hoy, nada: no se emite.** Con `INVOICING_ES_ENABLED` y `SIF_ENABLED` en OFF, ningún registro sale
a la AEAT, y no hay víctima. Lo que sigue es **qué pasaría el día que se encienda**, con la parte que
la norma resuelve y la que no.

**Lo que la norma resuelve: cómo se corrige.** Depende de si la factura impresa también está mal:

| caso | qué dice la fuente | cómo se arregla |
|---|---|---|
| **La factura NO lleva la mención** «régimen especial del criterio de caja» | C4, **ROF art. 15.1** (vigente desde el 1-ene-2018): *«Deberá expedirse una factura rectificativa en los casos en que la factura original no cumpla alguno de los requisitos que se establecen en los artículos 6 ó 7»*. La mención es del art. 6.1.p. | **Factura rectificativa**, con su registro de alta. F5, caso 2.a: el registro original *«quedaría para siempre con esos errores en la AEAT»* y el error se da por resuelto al recibir la rectificativa. |
| **La factura SÍ lleva la mención**, pero el registro dice `01` | F5, caso 2.b: errores *«NO contemplados en el ROF, pero [que] afectan a campos del registro de facturación […] (que, digamos, "no se ven" en la factura impresa, es decir, son campos "internos", como ciertas codificaciones tributarias)»* | **Registro de alta de subsanación** (`Subsanacion = "S"`), sin factura nueva. *«Estos casos deberían ser MUY POCO FRECUENTES.»* |

Con el código de hoy, el primer caso es el que tocaría: **no he encontrado la mención** (Ⓓ.1). Así
que cada factura de un merchant en caja necesitaría **una rectificativa**, no sólo un registro nuevo.

⚠️ **Un dato para el máster, no un cambio (regla 35):** la regla 29 dice «solo R1 o anulación con
registro». La AEAT describe una **tercera** vía, el **registro de alta de subsanación**, para
corregir un dato «interno» sin tocar la factura (F5, caso 2.b; C1, **RRSIF art. 8.2.a)**: *«Cualquier
necesidad de corrección o anulación de los datos registrados deberá ser realizada mediante al menos un
registro de facturación adicional posterior»*). No contradice la regla 29, porque tampoco edita nada.
Pero la regla no la nombra, y alguien que la lea podría creer que el único camino es la rectificativa.
Lo decide quien lleve el máster.

**Lo que la norma NO resuelve, y por eso es SIN DETERMINAR:**

- **¿Hay sanción, y cuánta?** C9, **LGT art. 201.1** (vigente desde el 1-jul-2004): *«Constituye
  infracción tributaria el incumplimiento de las obligaciones de facturación, entre otras, la de
  expedición, remisión, rectificación y conservación de facturas»*. El **201.2.a)** la califica de
  grave *«Cuando se incumplan los requisitos exigidos por la normativa reguladora de la obligación
  de facturación»*. Que una factura sin la mención de caja **encaje** ahí es mi lectura. Que un
  `ClaveRegimen` equivocado en el registro, con la factura correcta, **sea** infracción del 201 (o de
  otro artículo), **no está determinado** con las fuentes leídas. Y tampoco la cuantía ni si la
  subsanación la evita. **Esto lo tiene que decir un asesor fiscal.**
- **¿El 303 queda mal?** No. El 303 **ya** declara por caja (⓪), que es lo que la ley manda para
  el devengo (LIVA 163 terdecies.Uno). Lo que queda mal es **el registro**, que afirma otro régimen.
  Si la AEAT cruza el 303 con los registros VERI\*FACTU y qué haría con la diferencia, **no está
  determinado**: no hay fuente pública que lo diga.
- **¿Cuándo se detecta?** F3 **no rechaza** un `01` en un merchant de caja: el registro es
  formalmente válido. **La AEAT no avisaría.** El error sólo aparece en una comprobación.

## Ⓕ Veredicto

1. **La norma es clara en lo esencial.** Un merchant acogido al criterio de caja tiene que llevar
   **`07`** (C8, L8A) **en cada operación incluida en el régimen**, y la clave que le tocaría sin
   caja (normalmente `01`) **en las excluidas** por LIVA 163 duodecies.Dos. Para nuestros oficios, la
   excluida típica es la **inversión del sujeto pasivo** (`S2`), y la AEAT **rechaza** `07` con `S2`
   (F3 §15.6.5). El builder de hoy acierta por casualidad en la rama `S2` (`01`) y **se equivoca en
   la rama `S1`** para todo merchant en caja.
2. **`07` excluye `18`, `19` y `20` en la misma operación** (163 duodecies.Dos.a), pero no en el
   mismo profesional. La AEAT **no lo valida**: tiene que hacerlo el programa.
3. **El registro es del emisor.** El régimen del destinatario no va en ningún campo. El destinatario
   cumple en su libro de recibidas, y se entera **por la mención en la factura** (ROF 6.1.p), que
   **hoy no encuentro en nuestro PDF**.
4. **Hoy, sin víctima.** Encendido el flag, cada factura de un merchant en caja saldría con **dos**
   defectos: la clave del registro y la mención de la factura. El segundo, por ROF 15.1, obliga a una
   **rectificativa**, no sólo a una subsanación. **Se arregla antes de encender, como decía el
   ticket**, y con un dato nuevo: el arreglo no es sólo del builder (J1). También lo es del PDF, que
   tendría que llevar un texto nuevo y **firmado** (regla 39: aquí no se propone ningún literal).
5. **SIN DETERMINAR, para un asesor:** si un `ClaveRegimen` erróneo con factura correcta es
   infracción y de qué cuantía, y si la AEAT cruza el 303 con los registros.

**Nada de esto cambia el suelo del ticket:** es STOP de regla 40 para el builder, y de regla 39 para
el texto de la factura. Lo que aquí queda es **qué** hay que construir, con la fuente al lado.
