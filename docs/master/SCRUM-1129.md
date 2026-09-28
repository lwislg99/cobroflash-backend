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
