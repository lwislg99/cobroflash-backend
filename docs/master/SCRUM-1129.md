# SCRUM-1129 · La tabla de `ClaveRegimen` (L8A), verificada contra el BOE y la AEAT

**Medido contra:** `origin/main` = `7ba1ad5f2a87e7752894f790a5256b20a65f9ed5` · 2026-09-28T13:41:39Z

Sesión J5 (`jv-j5`), 28-sep-2026, por encargo del orquestador de Javier. **Este documento sólo mide:
no construye nada.** El arreglo toca el camino de emisión (`registro.builder.ts`, regla 40) y además
necesita saber el régimen del obligado, que `Merchant` no guarda: los dos son STOP y se quedan fuera.

Lo que se pidió, y lo único que se trae: **qué valor de `ClaveRegimen` corresponde a cada régimen**,
con la fuente de cada valor.

## ⓪ Las fuentes, y cómo se leyeron

Todas se bajaron con `curl` el 28-sep-2026 entre las 13:38Z y las 13:41Z y se leyeron en su texto
(el PDF con `pdftotext`, el `.xlsx` descomprimido y leída su hoja XML, el BOE en XML). **Ninguna con
WebFetch.** Las citas de abajo son copia literal.

| # | fuente | URL | versión / fecha | sha256 |
|---|---|---|---|---|
| F1 | **Orden HAC/1177/2024** (BOE) — su anexo trae el diseño de registro y las listas | `https://www.boe.es/diario_boe/xml.php?id=BOE-A-2024-22138` | BOE 28-oct-2024 | `79a0b6b5dd58528e3917b42e267a1c090624c1198e5c5fcd3b8503ec7e177c19` |
| F2 | **Diseño de registro** de la AEAT, `DsRegistroVeriFactu.xlsx`, hoja «6)Listas» | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DsRegistroVeriFactu.xlsx` | v1.0, 28/10/2024 («Versión oficial a raíz de la publicación de la Orden Ministerial HAC-1177-2024») | `40ce191aa1def6e44a5f1e86d7ece727258745b34e3fe4d6abe1468252dac2ca` |
| F3 | **Validaciones** de la AEAT, `Validaciones_Errores_Veri-Factu.pdf`, §15.6 | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` | v1.2.2, 08/04/2026 | `426eb926fc098a36a163f66ca5f40d9e0847ca23300bbe5008979832d3513440` |
| F4 | **RD 1007/2023** (RRSIF), art. 10 | `https://www.boe.es/buscar/xml.php?id=BOE-A-2023-24840` | texto publicado, idéntico al vigente (una sola versión) — *corregido en SCRUM-1241; decía «texto consolidado a 28-sep-2026», que era falso: esa URL da el texto publicado* | `e1b153bee806f9ae58a635773daba60f9a90c1e24adc01f06955b3219b5e414e` |
| F5 | **Aclaraciones a dudas de los desarrolladores** de la AEAT | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf` | v1.3 (pie: 4 de diciembre de 2025) | `73906dc8afbbb9da35f6cb489980352b42aed66d48828fd62a00168883c09d5e` |

F2 y F3 se localizaron desde la página oficial de desarrolladores de la AEAT
(`…/Documentacion/Sistemas_Informaticos_de_Facturacion_y_Sistemas_VERI_FACTU/…`), no por URL
recordada: la primera URL que probé para el `.xlsx` (`DsRegistroVeri-Factu.xlsx`, con guion) dio 404.

**Dos fuentes independientes para la tabla:** F1 es la norma publicada en el BOE; F2 es el fichero
técnico de la AEAT. Se compararon código a código.

## ① La tabla — lista L8A (desgloses cuyo impuesto es el IVA)

Título literal de la lista en F1 y F2: *«Descripción de la clave de régimen para desgloses donde el
impuesto de aplicación es el IVA»*. F3 §15.6: *«Si Impuesto = "01" (IVA) o no se cumplimenta
(considerándose "01" - IVA), el valor de ClaveRegimen deberá estar cumplimentado y contenido en
lista L8A.»* — que es el caso de YaQu (`Impuesto` fijo a `01`).

| valor | descripción literal (F1 = F2) | F1 BOE | F2 AEAT |
|---|---|---|---|
| `01` | Operación de régimen general. | ✔ | ✔ |
| `02` | Exportación. | ✔ | ✔ |
| `03` | Operaciones a las que se aplique el régimen especial de bienes usados, objetos de arte, antigüedades y objetos de colección. | ✔ | ✔ |
| `04` | Régimen especial del oro de inversión. | ✔ | ✔ |
| `05` | Régimen especial de las agencias de viajes. | ✔ | ✔ |
| `06` | Régimen especial grupo de entidades en IVA (Nivel Avanzado) | ✔ | ✔ |
| `07` | Régimen especial del criterio de caja. | ✔ | ✔ |
| `08` | Operaciones sujetas al IPSI / IGIC (Impuesto sobre la Producción, los Servicios y la Importación / Impuesto General Indirecto Canario). | ✔ | ✔ |
| `09` | Facturación de las prestaciones de servicios de agencias de viaje que actúan como mediadoras en nombre y por cuenta ajena (D.A.4ª RD1619/2012) | ✔ | ✔ |
| `10` | Cobros por cuenta de terceros de honorarios profesionales o de derechos derivados de la propiedad industrial, de autor u otros por cuenta de sus socios, asociados o colegiados efectuados por sociedades, asociaciones, colegios profesionales u otras entidades que realicen estas funciones de cobro. | ✔ | ✔ |
| `11` | Operaciones de arrendamiento de local de negocio. | ✔ | ✔ |
| `14` | Factura con IVA pendiente de devengo en certificaciones de obra cuyo destinatario sea una Administración Pública. | ✔ | ✔ |
| `15` | Factura con IVA pendiente de devengo en operaciones de tracto sucesivo. | ✔ | ✔ |
| `17` | Operación acogida a alguno de los regímenes previstos en el Capítulo XI del Título IX (OSS e IOSS) | ✔ | ✔ |
| **`18`** | **Recargo de equivalencia.** | ✔ | ✔ |
| `19` | Operaciones de actividades incluidas en el Régimen Especial de Agricultura, Ganadería y Pesca (REAGYP) | ✔ | ✔ |
| **`20`** | **Régimen simplificado** | ✔ | ✔ |

F1 y F2 dan los **mismos 17 códigos con el mismo texto** (salvo tipografía: espacios alrededor de «/»,
«D.A.4.ª» frente a «D.A.4ª» y la mayúscula de «capítulo»/«título» en el `17`). No hay `12`, `13` ni `16`: F2, pestaña «0)Control de cambios», v0.14.3:
*«listas L8A (IVA) y L8B (IGIC) respectos a claves de régimen 8 (se añaden) y 16 (se elimina)»*.

**Control contra el repositorio:** el XSD vendorizado
(`src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd`, `IdOperacionesTrascendenciaTributariaType`)
enumera exactamente el mismo **conjunto** (comparado valor a valor, no por recuento): 01–11, 14, 15, 17,
18, 19, 20. El XSD tenía los códigos; F1 y F2 ponen el significado.

## ② La respuesta al ticket

| régimen del art. 10 RRSIF | `ClaveRegimen` | estado |
|---|---|---|
| régimen general (lo que emite hoy YaQu) | `01` | **verificado** (F1, F2) |
| **régimen simplificado** («módulos») del IVA | **`20`** — «Régimen simplificado» | **verificado** (F1, F2) |
| **recargo de equivalencia** | **`18`** — «Recargo de equivalencia.» | **el código, verificado** (F1, F2). **Quién lo usa, sin determinar** — ver ③(a) |

La norma que lo exige, F4, art. 10, literal y **completa** (el enunciado del ticket la cortaba antes
del final): *«Se informará además si la operación documentada ha sido realizada por un contribuyente
al que le sea de aplicación el régimen simplificado o el régimen de recargo de equivalencia del
Impuesto sobre el Valor Añadido.»*

## ③ Lo que NO está determinado, y por qué

**(a) Recargo de equivalencia: si `18` lo pone el minorista o su proveedor.** Las fuentes dan la
etiqueta, «Recargo de equivalencia.», y nada más. Hay dos lecturas posibles:

- que marque el registro que emite **el contribuyente en recargo** (que es lo que pide el art. 10: la
  operación *«realizada por»* él), o
- que marque la factura del **proveedor en régimen general que le repercute el recargo** a su cliente
  minorista (los campos `TipoRecargoEquivalencia` / `CuotaRecargoEquivalencia`).

Lo único que F3 dice de la clave `18` está en su **histórico de revisiones**, no en el cuerpo:
v1.0.3 (18/03/2025) *«Se incluye nueva validación para la clave de régimen 18 (Recargo de
equivalencia)»*; v1.0.7 (26/05/2025) *«Eliminación en 15.6.9 ClaveRegimen 18 de la restricción de uso
de la clave de régimen 18 para informar datos sobre el recargo de equivalencia»*; v1.1.2 (15/07/2025)
*«Se elimina sección 15.6.9 ClaveRegimen 18 con validación obsoleta»*. Es decir: hubo una regla que
ataba los campos de recargo a la clave `18`, y se retiró. **El texto de aquella regla ya no está en la
versión publicada, y ninguna fuente leída dice hoy cuál de las dos lecturas es la buena.** F5 no trata
la clave `18`. **Sin determinar.** Esto se pregunta a la AEAT o a un asesor; no se deduce.

**(b) La clave va por operación, no sólo por obligado.** F5, p. 45 (criterio de caja), pone ejemplos
de un mismo emisor *«en criterio de caja (ClaveRegimen=[07])»* cuyo registro, para una operación
excluida del régimen, lleva `Clave de régimen: 08` o `Clave de régimen: 01`. Y el campo vive dentro de
cada `DetalleDesglose` (F2, hoja «2)D. Registro Facturación Alta», fila 39). **Consecuencia para el
arreglo:** guardar el régimen del obligado en `Merchant` es **necesario pero puede no bastar**; si un
profesional en simplificado o recargo tiene operaciones fuera de ese régimen, la clave cambiaría por
línea. Si eso ocurre con los oficios de YaQu **no está medido**.

**(c) Fuera de IVA (no aplica a YaQu hoy, se anota para quien lo toque).** Con `Impuesto` = `03`
(IGIC) rige la lista **L8B**, cuyos `17`, `18` y `19` significan **otra cosa** (F2: «Régimen especial de
comerciante minorista», «Régimen especial del pequeño empresario o profesional», «Operaciones
interiores exentas por aplicación artículo 25 Ley 19/1994»); F3 §15.6.11 añade el `21` «Régimen
simplificado» para IGIC, **que el XSD vendorizado no enumera** (llega a `20`). Con `02` (IPSI), F3
§15.6 da su propia lista, donde `20` es «Régimen estimación objetiva» y `18` otra cosa. **Una tabla
«código → régimen» sin el impuesto al lado es falsa:** el mismo número dice cosas distintas.

## ④ Lo que queda para quien construya (no lo hace esta sesión)

1. **Decisión (a)** con fuente: a quién corresponde la clave `18`.
2. **Campo nuevo** con el régimen del obligado → ALTER → A5; y la pregunta al profesional es texto
   de cara al usuario → firma del fundador (regla 39).
3. **Cambio en `registro.builder.ts`** (hoy `CLAVE_REGIMEN_GENERAL = '01'`, líneas 55, 313 y 328,
   medido en este árbol) → camino de emisión, regla 40 → **STOP**.

Mientras `INVOICING_ES_ENABLED` y `SIF_ENABLED` sigan en OFF, nadie emite y no hay víctima.

---

# SCRUM-1129b · ¿De dónde sale el régimen de cada merchant?

**Medido contra:** `origin/main` = `2b4db6a2948ba062909c38f3cac7e495c2b1e8cc` · 2026-09-28T16:45:54Z (hora de GitHub)

Sesión J5 (`jv-j5`), relevo del 28-sep-2026 por la tarde, por encargo del orquestador de Javier.
**Esto sólo lee y cita: no toca `src/`, ni el builder, ni el esquema, y no redacta ningún texto de
pantalla.** La pregunta: la tabla de 1129 dice qué código corresponde a cada régimen, pero el builder
sigue mandando `01` porque **nadie sabe de qué régimen es cada profesional**. ¿Qué hay que saber, y
cómo se le pregunta?

## Ⓐ Las fuentes

Descargadas con `curl` el 28-sep-2026 entre las 16:05Z y las 16:45Z, y leídas en su texto (los PDF
con `pdftotext`, el BOE en XML). Las citas son copia literal.

| # | fuente | de dónde | versión | sha256 |
|---|---|---|---|---|
| C1 | **RD 1007/2023 (RRSIF)**, consolidado | `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-2023-24840/texto` | art. 10 y art. 3: una sola versión, vigente desde el 7-dic-2023 | `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38` |
| C2 | **Ley 37/1992 (LIVA)**, consolidada | `…/id/BOE-A-1992-28740/texto` | la versión vigente a 28-sep-2026 de cada artículo citado (abajo, con su fecha) | `371432fc76f0ae3cb7bac8530cb1e229a8c6c6f2e09ee6fdf3f78fc18a70a202` |
| C3 | **RD 1624/1992 (RIVA)**, consolidado | `…/id/BOE-A-1992-28925/texto` | ídem | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` |
| C4 | **RD 1619/2012 (Reglamento de facturación, ROF)**, consolidado | `…/id/BOE-A-2012-14696/texto` | ídem | `95d8ff283a96a2a74263fd0bc079cbd00a5c5a418ba66ec046ca2aef4d56f586` |
| C5 | **Orden HAC/1425/2025**, módulos y régimen simplificado para **2026** (BOE 11-dic-2025) | `https://www.boe.es/boe/dias/2025/12/11/pdfs/BOE-A-2025-25272.pdf` | la publicada | `1434a2ec1183400f6d4174c7a8d38d95d7d6ee1324b139a918335c9a982beea1` |
| C6 | **AEAT, «Cuadro actividades régimen simplificado IVA 2026»** | `https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Reg_tributacion/Simplificado/cuadro_actividades_regimen_especial_IVA_2026.pdf` | 2026 | `59520533cfd88d8ec0098acb62003ae4dfae630674387dfe94d57dff86947218` |
| C7 | **AEAT, FAQ VERI\*FACTU «Cuestiones generales: ámbitos de aplicación»** | `https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-ambitos-aplicacion.html` | la página no lleva fecha: vale la de la descarga | (página HTML, cambia con la plantilla del sitio: se cita el texto, no el hash) |
| F3 | Validaciones AEAT (la F3 de 1129) | ver ⓪ arriba | v1.2.2, 08/04/2026 | `426eb926…3513440` (el mismo que en 1129) |
| F3′ | **La misma F3, versión 1.0.4**, recuperada del Internet Archive | `https://web.archive.org/web/20250416093638id_/https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` | v1.0.4 (captura del 16-abr-2025) | `4eb42e5dfabb88f0950aac706d832428691ca349f9fac09ca9c897d1ff79e5eb` |
| F5 | FAQ de desarrolladores (la F5 de 1129) | ver ⓪ arriba | v1.3, 4-dic-2025 | `73906dc8…883c09d5e` (el mismo que en 1129) |

🔴 **Un error mío, cazado antes de escribir nada.** Primero bajé la LIVA, el RIVA y el ROF por
`https://www.boe.es/buscar/xml.php?id=…`, que es la URL que usó 1129 para el RRSIF. **Ese XML trae el
texto ORIGINAL de la norma, no el consolidado**: me di cuenta porque en la LIVA no aparecía el
art. 163 decies (el criterio de caja, que es de 2013). Con él estuve a punto de citar la lista de
epígrafes del art. 37 del RIVA de **1992**, que pone «504.2 Instalaciones de fontanería» y que se
suprimió en 1998. Todo lo de abajo sale de la API de legislación **consolidada** (C1–C4), con la fecha
de vigencia de cada artículo. **Para 1129 no cambia nada:** el art. 10 del RRSIF tiene una sola
versión, y su texto es idéntico en las dos URL. Pero la próxima sesión que cite una ley reformada no
debe usar `buscar/xml.php`.

Y otro, menor: filtré la Orden C5 con un `grep -v "cve:"` para quitar las cabeceras de página, y se
llevó por delante la línea del epígrafe 691.1, que lleva el sello en la misma línea. Lo destapó C6. La
ausencia de la división 5, abajo, está medida **sobre el fichero sin filtrar**.

## Ⓑ Pregunta 1 — ¿Qué necesita saber la AEAT? ¿Una clave por factura, por merchant o por operación?

**Por operación.** C1, art. 10.1, letra k), literal: *«Indicación del régimen o regímenes aplicados a
las operaciones documentadas a efectos del Impuesto sobre el Valor Añadido, o de otras operaciones con
trascendencia tributaria.»* Y el último párrafo de la letra m): *«Se informará además si la operación
documentada ha sido realizada por un contribuyente al que le sea de aplicación el régimen simplificado
o el régimen de recargo de equivalencia del Impuesto sobre el Valor Añadido.»*

La norma habla de «régimen o regímenes» y de «la operación», no del contribuyente. El diseño técnico
lo lleva igual: `ClaveRegimen` vive dentro de cada `DetalleDesglose` (1129, ③(b)). Y F5, §26: *«El
campo de impuesto […] a indicar es el que corresponda a la operación […] es decir, ni al emisor ni al
receptor»*. F5 remite además a la FAQ 3.20 del SII, *«¿Cómo se registra una factura que comprende
operaciones con distinta clave de régimen especial?»*: la AEAT da por hecho que una misma factura
puede llevar varias claves.

**Pero la clave depende de DOS cosas, y sólo una es del merchant:**
- **del merchant**: en qué régimen está (general, criterio de caja, simplificado, recargo…). Eso es
  lo que hay que preguntarle;
- **de la operación**: si esa operación concreta cae dentro o fuera de su régimen (ver Ⓒ). Eso lo
  deduce el programa a partir de lo que ya sabe de la línea.

## Ⓒ Pregunta 2 — ¿Puede un mismo profesional tener varias claves a la vez?

**Sí, por ley.** Tres fuentes independientes:

1. C2, **LIVA art. 9.1.º c) b')** (versión vigente desde el 1-jul-2021): *«se considerarán sectores
   diferenciados de la actividad empresarial o profesional los siguientes: […] b') Las actividades
   acogidas a los regímenes especiales simplificado, de la agricultura, ganadería y pesca, de las
   operaciones con oro de inversión o del recargo de equivalencia.»* Una misma persona puede tener un
   sector en un régimen y otro en otro.
2. C3, **RIVA art. 61.2.2.º** (vigente desde el 1-ene-2015), del minorista en recargo: *«Los
   empresarios que realicen operaciones u otras actividades a las que sean aplicables el régimen
   general de Impuesto o cualquier otro de los regímenes especiales […] deberán cumplir respecto de
   ellas las obligaciones formales establecidas con carácter general»*. Recargo en la tienda y régimen
   general en lo demás, a la vez.
3. C2, **LIVA art. 163 duodecies** (criterio de caja, vigente desde el 1-ene-2014). Uno: *«El régimen
   especial del criterio de caja se referirá a todas las operaciones realizadas por el sujeto pasivo
   sin perjuicio de lo establecido en el apartado siguiente»*. Y Dos: *«Quedan excluidas del régimen
   especial del criterio de caja las siguientes operaciones: […] d) Aquellas en las que el sujeto
   pasivo del Impuesto sea el empresario o profesional para quien se realiza la operación de
   conformidad con los números 2.º, 3.º y 4.º del apartado uno del artículo 84 de esta Ley.»*

**El caso concreto que les pasa a nuestros oficios:** un fontanero en criterio de caja al que una
constructora subcontrata una rehabilitación. Esa operación va con inversión del sujeto pasivo (LIVA
art. 84.Uno.2.º f), vigente desde el 1-ene-2023: *«ejecuciones de obra, con o sin aportación de
materiales, […] que tengan por objeto la urbanización de terrenos o la construcción o rehabilitación
de edificaciones»*) y, por la letra d) de arriba, **queda fuera del criterio de caja**. Y la AEAT lo
hace cumplir: F3 §15.6.5, *«Si ClaveRegimen = "07": CalificacionOperacion no puede ser "S2"»*. **El
mismo profesional necesita `07` en unas líneas y otra clave en la `S2`.** F5, §24 (pp. 45-46), pone ejemplos del
mismo tipo: un emisor *«en criterio de caja (ClaveRegimen=[07])»* cuya operación excluida lleva
`Clave de régimen: 01` o `08`.

**Lo que NO puede pasar:** régimen simplificado en una actividad y régimen general en otra. C2, **LIVA
art. 122.Dos.1.º** (vigente desde el 1-ene-2016): *«Quedarán excluidos del régimen simplificado: 1.º
Los empresarios o profesionales que realicen otras actividades económicas no comprendidas en el régimen
simplificado, salvo que por tales actividades estén acogidos a los regímenes especiales de la
agricultura, ganadería y pesca o del recargo de equivalencia.»*

## Ⓓ Lo que esto significa para nuestros oficios — el dato que más pesa

🔴 **En 2026, los oficios de YaQu NO pueden estar en módulos.** La clave `20` («Régimen simplificado»)
**no le corresponde a ningún fontanero, electricista, albañil, pintor ni instalador de clima**.

- C3, **RIVA art. 37.1** (vigente desde el 18-ene-1998): *«El régimen simplificado se aplicará respecto
  de cada una de las actividades incluidas en el régimen de estimación objetiva del Impuesto sobre la
  Renta de las Personas Físicas […]. A efectos de la aplicación del régimen simplificado, se
  considerarán actividades independientes cada una de las recogidas específicamente en la Orden
  ministerial que regule este régimen.»*
- C5, **Orden HAC/1425/2025, art. 1.1**: *«el método de estimación objetiva del Impuesto sobre la
  Renta de las Personas Físicas y el régimen especial simplificado del Impuesto sobre el Valor Añadido
  serán aplicables a las actividades o sectores de actividad que a continuación se mencionan»*. **En
  esa lista no hay ni un epígrafe de la división 5 del IAE** (501.3 albañilería, 504.1 instalaciones
  eléctricas, 504.2 fontanería, 504.3 frío y calor, 505 acabado de obras). Medido sobre las 5.254
  líneas del PDF, sin filtrar: `504` → 0 apariciones; «Instalaciones» → 0; «Albañil» → 0. **Control
  positivo**, que el instrumento ve la lista: «691.1 Reparación de artículos eléctricos para el hogar»
  → sí aparece.
- C6, **el cuadro de la AEAT para 2026**, que es la segunda fuente: tampoco trae ningún `50x`, y sí
  el 691.1.

Lo que sí está en la lista de 2026 y queda cerca de YaQu: **691.1** (reparación de electrodomésticos),
**691.9** (reparación de otros bienes de consumo), **699** (otras reparaciones n.c.o.p.) y el comercio
al por menor **653.2** y **653.4-5** (material eléctrico; materiales de construcción y saneamiento). Un
técnico de electrodomésticos **sí** puede estar en módulos.

**Consecuencia de facturación, que va más allá de la clave:** los oficios de la división 5 están en
estimación directa en el IRPF, y C4, **ROF art. 26.1** (vigente desde el 1-ene-2013), manda: *«estarán
obligados a expedir factura […] cuando determinen dichos rendimientos por el método de estimación
directa, con independencia del régimen a que estén acogidos a efectos del Impuesto sobre el Valor
Añadido.»* Para el oficio típico de YaQu, la obligación de facturar no depende del régimen de IVA.

**Recargo de equivalencia (`18`) en nuestros oficios: casi nunca.** C2, **LIVA art. 149.Uno.1.º** (sin
cambios desde 1993): el minorista es quien realiza *«con habitualidad entregas de bienes muebles o
semovientes sin haberlos sometido a proceso alguno de fabricación, elaboración o manufactura»*. Es un
régimen de **venta de mercancía**, no de servicios. Y C3, **RIVA art. 59.2.12.º** (vigente desde el
16-dic-2000) lo excluye expresamente para *«Materiales y artículos para la construcción de edificaciones
o urbanizaciones.»* Sólo aparece si el profesional tiene además una **tienda**, y entonces sólo para esas
ventas. Si «vender e instalar» una caldera es o no «transformación» a efectos del art. 149 **no está
determinado** con las fuentes leídas. Eso lo dice un asesor.

**REAGYP (`19`)**: es de actividades agrícolas, ganaderas y pesqueras, y ningún oficio de YaQu entra.
C7: *«No con carácter general, ya que los obligados a este régimen, no están obligados a expedir
factura salvo determinadas excepciones.»*

**Criterio de caja (`07`)**: es **el único régimen especial realista** para nuestros oficios. Es
voluntario (C2, **LIVA art. 163 undecies**: *«podrá aplicarse por los sujetos pasivos que cumplan los
requisitos […] y opten por su aplicación»*) y admite hasta 2.000.000 € de volumen (art. 163 decies.Uno).

## Ⓔ Lo que YA hay en el repositorio (leído, no tocado)

Medido en `origin/main` = `2b4db6a2…`:

- `prisma/schema.prisma`, **`Merchant.criterioCaja Boolean?`** (SCRUM-294, fase C), con los tres estados
  NULL / false / true. **Ya se le pregunta al profesional**: `public/dashboard/js/settingsView.js`,
  un `<select>` en Ajustes → Empresa. Lo lee el **libro registro** (`invoicing/domain/criterioDelMerchant.ts`,
  `libroRegistro.repo.ts`, `devengoPorCaja.ts`).
- 🔴 **El módulo fiscal NO lo lee.** `git grep criterioCaja -- src/modules/fiscal` → 0 resultados.
  `registro.builder.ts` sigue con `claveRegimen: CLAVE_REGIMEN_GENERAL` (`'01'`) en las dos ramas, la
  `S2` y la `S1`. **Hoy, un profesional que declare «Sí» al criterio de caja tendría un libro registro
  por caja y un registro VERI\*FACTU que dice `01`.** Son dos partes del producto que se contradicen
  sobre el mismo dato. **Sin víctima hoy**, porque con `SIF_ENABLED` en OFF no se emite. Por eso no
  abro ticket (A7): lo reporto.
- `Client.recargoEquivalencia Boolean?` (SCRUM-294-a) es el recargo **del cliente**, es decir, el caso
  en que el profesional es el **proveedor** de un minorista. Es justo la segunda lectura de la duda (a)
  de 1129, y no está cableado al total por decisión (camino de emisión).
- La rama `S2` del builder ya existe (SCRUM-1051), separada de la `S1`. Si algún día se cablea `07`, esa
  separación es la que evita mandar un `07` con `S2`, que la AEAT rechaza (§15.6.5).

## Ⓕ Pregunta 3 — La pregunta mínima para un fontanero

**No se redacta aquí ningún texto de pantalla (regla 39).** Lo que sigue es **qué dato** hace falta y
**de dónde puede salir**, no cómo se pregunta.

Con lo medido en Ⓓ, para un oficio de la división 5 el régimen sale de **un solo dato que no se puede
deducir**, más uno raro:

| dato | ¿hace falta preguntarlo? | por qué |
|---|---|---|
| ¿Criterio de caja? | **Ya se pregunta** (`Merchant.criterioCaja`). Falta que el builder lo lea (STOP, regla 40) | es voluntario: sólo lo sabe él (o su gestoría) |
| ¿Módulos? | **Para los oficios de la división 5, no**: en 2026 no pueden estarlo (C5, C6). Sólo tendría sentido para actividades de la lista (691.1, 691.9, 699, 653.x) | se deduce de la actividad |
| ¿Tiene tienda y vende mercancía al por menor? | Sólo si YaQu quiere cubrir ese caso. Hasta que se cierre la duda (a), **no hay clave segura que mandar** | recargo = venta de bienes, nunca servicios |
| ¿La operación va con inversión del sujeto pasivo? | **No se le pregunta al merchant**: ya lo decide la línea (`causa: 'S2'`) | es de la operación, no del régimen |

**La diferencia entre un producto que se usa y uno que manda a la gestoría**, medida: al fontanero no
hay que preguntarle «¿en qué régimen de IVA estás?», porque la respuesta para su oficio sale de la ley.
Sólo hay una pregunta que únicamente él puede contestar, la del criterio de caja, **y ya está hecha**.
Si el producto quiere admitir otras actividades (reparación de electrodomésticos, tienda), el dato que
decide es **la actividad** (el epígrafe del IAE, que figura en su alta censal y su gestoría conoce), no
el nombre del régimen.

⚠️ **Lo que no está medido:** si YaQu sabe hoy la actividad de cada merchant (el oficio, `trade`, o lo
que sea) **y si ese dato es fiable como epígrafe del IAE**. Un «fontanero» en el onboarding no es un alta
en el 504.2. Deducir el régimen de un dato de marketing sería inventar una calificación fiscal.

## Ⓖ Pregunta 4 — Los tres SIN DETERMINAR de 1129

| | 1129 dejó | hoy | con qué |
|---|---|---|---|
| **(a)** ¿La `18` la pone el minorista o su proveedor? | SIN DETERMINAR | 🟡 **SIGUE SIN DETERMINAR, pero con un dato nuevo que la estrecha** | F3′ (abajo) |
| **(b)** ¿La clave va por operación? ¿Les pasa a nuestros oficios? | «por operación» con fuente; «si nos pasa, no medido» | ✅ **CERRADA** | Ⓑ y Ⓒ: art. 10.1.k RRSIF; caja + `S2` (LIVA 163 duodecies.Dos.d, F3 §15.6.5) |
| **(c)** Fuera del IVA (IGIC, IPSI) | anotado, no aplica | ⚪ **sigue sin aplicar**, con una contradicción nueva entre fuentes de la AEAT | abajo |

**(a), el dato nuevo.** Recuperé la versión **1.0.4** de las validaciones (F3′), que es anterior a la
retirada de la regla. Su §15.6.9, literal:

> *15.6.9 ClaveRegimen 18. Recargo de equivalencia*
> *- Sólo se puede cumplimentar TipoRecargoEquivalencia y CuotaRecargoEquivalencia cuando CalificacionOperacion es "S1".*
> *- Si CalificacionOperacion es "S1": Si Impuesto = "01" (IVA) […], sólo se podrá cumplimentar TipoRecargoEquivalencia y CuotaRecargoEquivalencia si ClaveRegimen igual a "18". Si Impuesto = "01" (IVA) […] y ClaveRegimen igual a "18", es obligatorio cumplimentar TipoRecargoEquivalencia y CuotaRecargoEquivalencia.*

Y LIVA art. 154.Tres (vigente desde el 1-ene-2015): los minoristas en recargo *«repercutirán a sus
clientes la cuota resultante de aplicar el tipo tributario del impuesto […] sin que, en ningún caso,
puedan incrementar dicho porcentaje en el importe del recargo de equivalencia.»*

Juntas, dicen esto: **tal como la AEAT diseñó al principio la clave `18`, sólo podía usarla quien cobra el
recargo, que es el PROVEEDOR del minorista.** El minorista no puede cobrarlo (art. 154.Tres), así que
nunca habría podido rellenar los campos que la `18` exigía. Esa regla se relajó en la v1.0.7 y se
retiró entera en la v1.1.2, **y no la sustituyó ninguna**. Hoy la `18` no tiene validación, y ninguna
fuente leída dice cuál de las dos lecturas vale ahora.

**Veredicto (a): no se puede cerrar con fuente.** El diseño original apunta al proveedor, pero se retiró
sin explicación, y el art. 10 («realizada por un contribuyente al que le sea de aplicación […] el
régimen de recargo») se lee más bien como el minorista. **Lo tiene que decir un asesor fiscal, o una
consulta a la AEAT**. A YaQu le afecta
por el lado del proveedor: un profesional en régimen general que factura a un cliente con
`recargoEquivalencia = true`. Con las validaciones de hoy, `01` más los campos de recargo **pasa**
(la restricción se quitó en la v1.0.7). Si además **debería** llevar `18`, sin determinar.

**(c), la contradicción nueva.** Para el IPSI (Ceuta y Melilla), F5 (v1.3, 4-dic-2025), §26:
*«si en Impuesto se indica IPSI, el campo ClaveRegimen no ha de rellenarse»*. F3 (v1.2.2, 08/04/2026),
§15.6: *«Si Impuesto = "02" (IPSI), el valor de ClaveRegimen deberá estar cumplimentado»*, con su lista
propia, aviso sin rechazo *«hasta el 31/12/2026 y se procederá a rechazar el registro a partir de
01/01/2027»*. El cambio entró en F3 v1.1.6 (11/11/2025, *«Se añaden claves de régimen para IPSI»*), antes
de la fecha de F5. **Gana F3**, que es posterior y es la que valida; F5 se quedó atrás. 1129 ③(c) seguía
a F3 y está bien. No aplica a YaQu mientras `Impuesto` vaya fijo a `01`. **Sin determinar** si YaQu
admite merchants en Canarias, Ceuta o Melilla: si los admite, el problema no es la clave, es el
`Impuesto`.

## Ⓗ Veredicto

1. **La AEAT quiere el régimen por operación** (RRSIF art. 10.1.k). Se forma con el régimen del merchant
   y el tipo de operación.
2. **Un profesional puede tener varias claves a la vez**, y a nuestros oficios les pasa: criterio de
   caja (`07`) más una obra con inversión del sujeto pasivo, que no puede ir en `07`.
3. **Para los oficios de la división 5, en 2026, el régimen sale de la ley más una sola pregunta**, la del
   criterio de caja, **y esa pregunta ya existe** en Ajustes → Empresa. Módulos no es posible (Orden
   HAC/1425/2025), recargo no aplica a servicios ni a materiales de construcción, y REAGYP no es un
   oficio. **No hace falta preguntarle al fontanero por su régimen de IVA.**
4. **Lo que queda y no es mío:**
   - **(a)**, la clave `18` → **asesor fiscal o consulta a la AEAT**. Es un dato valioso, no un fracaso:
     ninguna fuente pública lo resuelve hoy.
   - Que el builder lea `Merchant.criterioCaja` y mande `07` en las líneas `S1` (y no en las `S2`) →
     **camino de emisión, regla 40, GO del fundador.**
   - Si YaQu admite actividades fuera de la división 5 (electrodomésticos, tiendas), hace falta saber la
     actividad **como epígrafe del IAE**, no como etiqueta de marketing. Eso es una decisión de producto.
