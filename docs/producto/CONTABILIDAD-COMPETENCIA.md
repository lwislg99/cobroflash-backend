# Contabilidad · cómo lo resuelve la competencia, y qué copiar (SCRUM-1012b)

> **21-sep-2026 17:41 GMT (hora de GitHub) · código leído en `b6cde0517649d991a1b08eabb50017a81a03acfb`; `origin/main` ya iba en `4f40e95c169281beb224e7b61c904974b4534141` al cerrar · Sesión 0 (consultoría).**
> Encargo del fundador: «para las dudas de contabilidad, fijarnos en cómo lo hacen los competidores y copiarles todo». Este documento
> **describe lo que hacen y dicen los competidores; NO afirma qué manda la ley** (regla 7). Lo verificado del BOE sigue en
> `CONTABILIDAD.md` §3 y lo no verificado sigue en su §4 (→ asesor). Todo texto de pantalla que aparezca aquí es **propuesta sin firma**
> (regla 39). Esta pasada es **por FUERA** (documentación pública): nadie abrió cuentas ni entró en ninguna, y la columna «dentro/fuera» de cada tabla lo dice fila a fila. **La pasada por DENTRO** (cuentas de prueba, autorizada después por el orquestador el 21-sep) está **pendiente**: §9.

## 0 · Cómo se leyó: población, fiabilidad y límites

**Población:** 8 competidores (Verifacturamos, Billin/TeamSystem Facturas, Contasimple, FacturaDirecta, Holded, Quipu, Anfix, Sage) × 5 preguntas
(a-e) = 40 celdas. Las leyeron 4 subagentes con sus herramientas web (102 + 46 + 56 + 73 = **277 llamadas**, todas por encima del tope que se les
pidió: 40) y **yo releí 11 páginas distintas con mi propia lectura (12 lecturas)**, más 2 búsquedas y varias comprobaciones contra los volcados de página de Anfix y Sage. Muchas celdas quedan
«NO ENCONTRADO»: en cada una va lo que se buscó y el suelo (que la misma búsqueda sí devuelve otra cosa).

**Fiabilidad de cada dato** (columna «Fuente»):
- ✔ = lo releí yo (WebFetch propio) **o** lo comprobé contra el volcado de página del subagente (Anfix y Sage, en la carpeta temporal del job, **fuera de git**).
- ◐ = solo lo leyó un subagente. WebFetch resume con un modelo pequeño: la cita es la que devolvió, **sin contraste carácter a carácter**.
- ✖ = fragmento de buscador, la página no se abrió. Solo orienta; no prueba nada.

**Dónde está la prueba:** los cuatro informes originales de los subagentes, sin editar, están en `docs/competencia/lotes-contabilidad-21sep/` (con lo que buscaron, el suelo y sus propios errores). Los volcados de página (HTML y texto) **no** están en git.

**Tipo de fuente** (no pesan igual): `[AYUDA]` manual del producto · `[PRODUCTO]` página comercial · `[BLOG-PRODUCTO]` blog con pasos dentro del producto ·
`[BLOG-LEY]` blog que explica la ley en general (**no prueba cómo se comporta el producto**) · `[LOCAL]` lo que ya estaba en `docs/competencia/`.

**Abreviaturas de dirección:** `V` = https://verifacturamos.com · `B` = https://billin-ts.zendesk.com/hc/es/articles · `BN` = https://www.billin.net ·
`CS` = https://www.contasimple.com · `FD` = https://help.facturadirecta.com/es/articles · `H` = https://help.holded.com · `Q` = https://helpcenter.getquipu.com/es/articles ·
`QB` = https://getquipu.com · `A` = https://ayuda.anfix.com/articulo · `AW` = https://www.anfix.com · `S` = https://www.sage.com/es-es · `M` = `docs/competencia/matriz.md`.

**Límites que condicionan las conclusiones:**
1. **Nadie vio el formulario real.** Sin cuenta, el valor «por defecto» de una casilla dentro de la factura no se puede medir: solo se lee lo que la ayuda dice. Donde la ayuda calla, es «no encontrado», no «no lo hace».
2. **Billin:** su centro de ayuda (Zendesk) devuelve 403 a WebFetch. El subagente lo leyó con un navegador sin sesión; **yo intenté releerlo con mi navegador y recibí un desafío anti-bot («Un momento…»), que no se rodea**. Todo lo de `B` queda ◐.
3. **Verifacturamos no tiene manual público**: solo web comercial y guías, que mezclan ley y frases de producto. Sus guías dicen «actividad y régimen de IVA» en el alta; **lo visto por dentro el 21-sep** (`docs/competencia/capturas/verifacturamos/`, `[LOCAL]`) pide tipo de entidad, nombre y NIF (pasos 1-2; el paso 3, «Dirección», no se vio) y **no pide actividad ni epígrafe**.
4. **Sage Active** no tiene ayuda pública localizable; lo de Sage 50/200 (`es-kb.sage.com`) es otro producto y se descarta. Los blogs de `holded.com` no abren («Header overflow»): solo hay fragmentos ✖.
5. Un competidor que dice algo en su blog **no** demuestra que su software lo haga. Toda la tabla lo marca.

## 1 · Resumen: qué copiar

| # | punto | lo que hace la mayoría de los ocho | recomendación para YaQu | ticket |
|---|---|---|---|---|
| a | Perfil y retención de IRPF | La retención se elige **en el documento** (Billin, Contasimple, FacturaDirecta, Anfix, Holded); 15 y 7 % son universales. **Ninguno pregunta «empresarial o profesional» con esas palabras en el producto**: Anfix pregunta la actividad y el régimen de IRPF; Verifacturamos nombra el IAE solo en una guía | **No copiar** el «apagada por defecto»: YaQu ya distingue tres estados (más prudente que lo visible en los ocho). **Copiar con matiz** la pregunta de actividad y la retención por cliente/factura | **nuevos** 1072 perfil-actividad · 1073 retención por cliente y factura; ya en 1053 la retención a particulares |
| b | IVA 10 % en reforma de vivienda | Solo Verifacturamos lo automatiza (calcula el % de materiales y **sugiere**; el profesional confirma). Billin y Anfix lo cuentan en plantillas y blogs. **Se contradicen** en comunidades de propietarios | **Copiar con matiz** el cálculo con confirmación (ya en 1052). **No copiar** el 21 % automático, el texto legal ni la prueba de los 2 años: preguntas al asesor (Q-C1) | 1052 (existe) · **nuevo** 1074: presupuesto con reforma |
| c | Inversión del sujeto pasivo en obra | Se marca por **tipo de impuesto u operación en la línea** (Billin, Anfix, Holded-SII); nadie documenta la leyenda que imprime su PDF | **Copiar con matiz**: marca por línea, valor de partida en el cliente, leyenda firmada | 1051 (existe) |
| d | Exento / no sujeto | Tres piden **motivo** (Verifacturamos, Billin con lista cerrada y códigos E, Holded «Causa»); FacturaDirecta lo agrupa todo en «Sin IVA / exento 0 %» | **Copiar tal cual** motivo obligatorio de lista cerrada; **no copiar** texto libre ni la opción única | 1050 (existe) |
| e | Modelos y plazos | 6 de 8 **preparan o descargan** el modelo y **no lo presentan**; solo Holded y Anfix presentan con el certificado del usuario. Calendario con avisos: solo Contasimple y Holded | **Copiar tal cual** el borrador sin presentar (D2). **No copiar** presentar. **Copiar con matiz** aviso de trimestre neutro y calendario con estado tras citar. Añadir el 390 | 1063-1067 (existen) · **nuevos** 1075 aviso de trimestre · 1076 calendario · 1077 modelo 390 |

Las tres etiquetas de recomendación son las del encargo: **copiar tal cual** · **copiar con matiz** · **no copiar y por qué**.

## 2 · (a) Perfil del autónomo y retención de IRPF

**Qué tiene YaQu hoy** (leído, no medido en staging): el perfil ya tiene un selector «Retención de IRPF» con **tres estados que no colapsan**: «No consta» · «No aplico retención» · 15/7/2/1 %
(`public/dashboard/js/settingsView.js:375-403`; columnas `retencionIrpfDeclarada` y `retencionIrpfTipo`, `prisma/schema.prisma:155-169`; cubo en
`src/modules/invoicing/domain/retencionIrpf.ts:54`). El comentario del esquema explica por qué: emitir sin la retención de quien sí retiene es un fallo mudo. El 19 % está excluido a propósito
(`retencionIrpf.ts:69`). Lo que falta ya lo dice el diseño: el valor **no llega al total** ni se sabe si se guarda (SCRUM-1037/1053). No existe ninguna pregunta de actividad.

| competidor | qué hace o dice | fuente | dentro/fuera |
|---|---|---|---|
| Verifacturamos | Retención **en el perfil**: «puedes configurar tu tipo de retención (15 %, 7 % o ninguna) en tu perfil… la aplica automáticamente a las facturas dirigidas a empresas y autónomos. Para facturas a particulares, se desactiva.» | `V/facturacion-profesiones-liberales-freelancers` `[PRODUCTO]` ✔ | fuera |
| Verifacturamos | IAE solo como **checklist**: «Conocer tu epígrafe del IAE. Determina si tu actividad es profesional (retención de IRPF) o empresarial». Y en la guía de oficios: «Si tienes epígrafe empresarial (la mayoría de electricistas y fontaneros), no aplicas retención en ningún caso.» (frase del competidor, no verificada aquí) | `V/empezar-facturar-hoy` ◐ · `V/facturacion-electricistas-fontaneros` ✔ | fuera |
| Verifacturamos | El alta **visto por dentro** pide tipo de entidad (Autónomo/Empresa/Otro), nombre y NIF; **no pide actividad ni IAE** en los pasos 1-2. Valor por defecto de la retención: **no encontrado** | `[LOCAL]` `capturas/verifacturamos/02-…`, `03-…` | **dentro** (21-sep, sesión anterior) |
| Billin | Retención **a nivel de factura y oculta**: «Las opciones avanzadas, por defecto, aparece oculta… Una vez seleccionadas, se muestran por defecto» (opciones «Añadir gastos suplidos», «Incluir retención/IRPF»); el % es libre, la ayuda no fija 15/7. Lectura del subagente: **apagada por defecto**. Un blog dice «introducir de forma automática tu retención a todas las facturas», sin decir dónde. Sin pregunta de IAE | `B/48672406842257`, `B/48672361117329` `[AYUDA]` ◐ · `BN/blog/ejemplo-factura-profesional-irpf/` `[BLOG-LEY]` ◐ | fuera |
| Contasimple | Desplegable «retención» **en la pantalla de crear factura** (a nivel de documento). En su **calculadora pública**: «por defecto un 0% de retención», con 0, 1, 2, 7, 15 y 19 %; eso es la calculadora, **no el formulario**. Sin pregunta de IAE; «cliente particular no retiene» solo en blog | `CS/academia/contabilizar-retenciones-de-facturas/` `[AYUDA]` ◐ · `CS/calculadoras-financieras/calculadora-facturas-iva-irpf-autonomos-pymes/` `[PRODUCTO]` ◐ | fuera |
| FacturaDirecta | La retención se elige **del catálogo de impuestos del documento**: «Una retención superior al 0% requiere que asignes un contacto al documento»; «Sin IRPF» = 0 % y no exige contacto. Aviso: la retención del 5 % de obra «no está disponible ahora… como tipo vigente seleccionable». Valor por defecto: **no encontrado** | `FD/15385328-anadir-lineas-descuentos-e-impuestos-en-una-factura` `[AYUDA]` ✔ | fuera |
| Holded | La retención es **un impuesto más del catálogo** (19, 15 o 7 %); los impuestos se rellenan por prioridad: «first the contact's preferences, then the product's, and finally the company's». Sin pregunta de IAE (su alta pide razón social, NIF, dirección, moneda) | `H/en/articles/6923165-types-of-taxes-and-their-percentages`, `H/en/articles/6834950-create-an-invoice` `[AYUDA]` ◐ | fuera |
| Quipu | Retención **en la factura de gasto** («opciones avanzadas» → «marcar el % de IVA o IRPF que quieres deducir»). En la de ingreso: la página no abrió (404), fragmento ✖. Blog: 15, 7, 1 y 2 %; «En caso de facturar a particulares… no se puede aplicar dicha retención» | `Q/7198438-preguntas-frecuentes-sobre-impuestos` `[AYUDA]` ✔ · `QB/blog/factura-con-retencion/` `[BLOG-LEY]` ◐ | fuera |
| Anfix | Es el único que **pregunta la actividad dentro del producto**: Configuración → Actividades, desplegable «escribiendo su código o una parte del nombre», marca «principal» y «Define el régimen de IVA y el régimen de IRPF» (directa → 130, normal o simplificada; objetiva → 131). No dice «IAE» ni «epígrafe». Retención **en la línea** y **en la ficha del cliente**; sin casilla on/off: «El sistema propondrá el porcentaje usado en la última factura emitida.» | `A/indicar-actividades-economicas` ✔ · `A/dar-alta-factura-con-retencion`, `A/dar-de-alta-clientes` `[AYUDA]` ✔ (volcados) | fuera |
| Sage | Sage Active **se contradice en la misma página**: «gestiona correctamente los impuestos aplicables, incluidas las retenciones» frente a la nota «Sage Active no gestiona aún las Retenciones.» | `S/productos/sage-active/` `[PRODUCTO]` ✔ | fuera |

**Lo que se ve:** en lo que se pudo leer (sin ver los formularios reales), **ninguno de los ocho distingue «no lo he declarado» de «declaro que no retengo»**. La retención se puede decidir **en el documento** en 5 de 8 (Billin, Contasimple, FacturaDirecta, Holded, Anfix); solo Verifacturamos la fija en el **perfil**, y solo Anfix (ficha del cliente) y Holded (preferencias del contacto) admiten un valor **por cliente**.

**Recomendación (a):**
1. **No copiar «apagada por defecto» (Billin).** YaQu ya tiene «No consta», más prudente que lo que se ve en los ocho. Cambiarlo a «apagada» sería un retroceso: reabre el fallo mudo que el propio esquema documenta.
2. **Copiar tal cual — ya está hecho — la retención en el perfil con 15/7** (Verifacturamos). Solo falta que se guarde y llegue al total (1037 y 1053). Los **2 y 1 %** aparecen en Quipu (blog), Contasimple (calculadora) y Billin (blog) pero no en las ayudas de producto: se queda en Q-C5.
3. **No copiar el 19 %** (Holded, Contasimple, Sage-blog): YaQu lo excluyó a propósito.
4. **Copiar con matiz la pregunta de actividad** (Verifacturamos como checklist, Anfix como campo): una pregunta corta en el perfil que ayude a contestar el selector de retención, con salida «no lo sé → No consta, pregúntale a tu asesor». **No afirma qué corresponde a cada actividad** (regla 7). → **ticket nuevo SCRUM-1072: PERFIL · actividad**.
5. **Copiar con matiz «desactivar para particulares»** (Verifacturamos): como sugerencia visible que el profesional confirma, no como automatismo silencioso, y solo tras Q-C5. Ya está en 1053, aceptación 4.
6. **Copiar tal cual el patrón «se decide por documento»** (5 de 8): perfil como valor de partida, cliente como excepción (Anfix, Holded) y factura como última palabra (todos). → **ticket nuevo SCRUM-1073: retención por cliente y factura** (camino de emisión, J1).
7. **Para el asesor (Q-C5):** el aviso de FacturaDirecta sobre la retención del 5 % en obra. Es una frase de un competidor; YaQu no la ofrece y nadie ha confirmado si existe el caso.

## 3 · (b) IVA del 10 % en reforma de vivienda

**Qué tiene YaQu hoy:** el 10 % se puede emitir; **la regla del 40 % de materiales no existe en el código** (`CONTABILIDAD.md` §3 y §1). SCRUM-1052 (J1, Ola 2) diseña el aviso y espera a Q-C1.

| competidor | qué hace o dice | fuente | dentro/fuera |
|---|---|---|---|
| Verifacturamos | **Único con automatismo**: «Verifacturamos calcula el porcentaje de materiales. Si es ≤ 40% y la obra es en vivienda > 2 años, sugiere IVA 10%. Tú confirmas y emites.» Fórmula: «Total materiales que tú aportas / Total factura antes de IVA × 100. Si ≤ 40%, IVA 10%. Si > 40%, IVA 21% a todo.» Otra página: «IVA 10% y 21% automáticos. Seleccionas el tipo de obra.» Ya lo recogía la matriz | `V/plantilla-factura-construccion-reformas` `[BLOG-PRODUCTO]` ✔ · `V/facturacion-construccion` `[PRODUCTO]` ◐ · `M` L133, L449 | fuera |
| Verifacturamos | Texto de su «Modelo 1» de ejemplo: «IVA reducido aplicable — Art. 91.Uno.2.10º Ley 37/1992» · «Vivienda particular > 2 años · Materiales < 40% · Cliente residente». **Es un ejemplo de la guía, no se sabe si es lo que imprime el software**; y la misma página dice «≤ 40 %» en el paso y «< 40 %» en el modelo | `V/plantilla-factura-construccion-reformas` ✔ | fuera |
| Verifacturamos | **Comunidades de propietarios**: «Las zonas comunes no son vivienda habitual de nadie… IVA 21%». Prueba de los 2 años: **no encontrado** | `V/facturacion-electricistas-fontaneros` `[BLOG-LEY]` ✔ | fuera |
| Billin | Producto: **no encontrado** (ni casilla ni cálculo del 40 %). Solo su plantilla de presupuesto: «Se aplica el tipo reducido del 10% cuando realices un presupuesto a una comunidad de propietarios» y «Si el presupuesto del material de la obra supone más del 40% del total presupuestado, se le aplicará el tipo general del 21%.» | `BN/plantilla-presupuesto-instalacion-electrica/` `[BLOG-LEY]` ◐ | fuera |
| Anfix | Producto: **no encontrado**; el 10 % se añade a mano («puedes añadir más de un porcentaje pulsando en +»). Blogs: 40 % sobre el total de la factura, 2 años, destinatario «comunidad de propietarios o una persona física»; otro blog: «Es conveniente que el beneficiario de la obra manifieste por escrito que estos requisitos se cumplen» | `A/configurar-datos-fiscales` `[AYUDA]` ◐ · `AW/blog/el-iva-en-las-obras-de-albanileria-fontaneria-y-carpinteria`, `AW/blog/el-iva-reducido-en-obras-cuando-se-trabaja-para-una-aseguradora` `[BLOG-LEY]` ◐ | fuera |
| Holded | Producto: **no encontrado**; su ayuda describe el 10 % solo como «a number of specific activities, such as the sale of… nutrition». Un blog de plantillas de reforma (fragmento) lista uso residencial, comunidad, 2 años y 40 % | `H/en/articles/6923165-…` `[AYUDA]` ◐ · `holded.com/es/blog/plantillas-de-facturas-de-reformas-de-vivienda` ✖ | fuera |
| Contasimple · FacturaDirecta · Quipu · Sage | **No encontrado** en ninguno (casilla, 40 %, 2 años, comunidades, texto). Suelo: FacturaDirecta lista «Reducido 10%» sin reformas; las mismas búsquedas sí devolvieron otras páginas | `FD/13570491-que-tipos-impositivos-estan-disponibles-en-facturadirecta` `[AYUDA]` ✔ | fuera |

**Lo que se ve:** solo **uno de ocho** convierte la regla en función, y lo hace como **sugerencia con confirmación**. Los competidores **se contradicen sobre las comunidades**: Verifacturamos dice 21 %, Billin dice 10 %, Anfix dice «comunidad o persona física». Nadie documenta qué se pide como prueba de los 2 años dentro del producto; la única mención es un blog de Anfix («conveniente… por escrito»).

**Recomendación (b):**
1. **Copiar con matiz el cálculo y la confirmación** (Verifacturamos): calcular el % sobre la base **antes de IVA**, mostrarlo y que **decida el profesional**. Es lo que ya dice SCRUM-1052, aceptación 2 («el aviso no bloquea ni cambia el tipo solo»). El matiz es que Verifacturamos **sugiere** el 10 %; YaQu solo **avisa** cuando se pasa, que es menos.
2. **No copiar «> 40 % → 21 % a todo» como automatismo.** Es interpretación de la regla: que la haga el asesor (Q-C1).
3. **No copiar el texto impreso** («Art. 91.Uno.2.10º…») hasta que lo firme el fundador con el asesor (regla 39); además el ejemplo del competidor se contradice (≤ / <).
4. **No copiar comunidades**: con tres respuestas distintas, ninguna sirve. **Q-C1** lo decide; entretanto la casilla **no presupone destinatario**.
5. **No copiar la prueba de los 2 años como función**: nadie la tiene en producto. Se deja como pregunta para el asesor (qué prueba, si alguna) y SCRUM-1052 ya guarda con el documento los dos datos.
6. **Copiar con matiz que la regla viaje del presupuesto a la factura** (Verifacturamos la aplica «al convertir el presupuesto»; Billin la explica en su plantilla de **presupuesto**): en YaQu el primer precio que ve el cliente es el del presupuesto. → **ticket nuevo SCRUM-1074: PRESUPUESTOS · reforma de vivienda y aviso del 40 %** (Luis; depende de 1052 y Q-C1).

## 4 · (c) Inversión del sujeto pasivo en obra

**Qué tiene YaQu hoy:** no existe (`tiposDeIva.js:11-13`). SCRUM-1051 (J1) lo diseña, con la leyenda «que fije el asesor», solo con cliente con NIF.

| competidor | qué hace o dice | fuente | dentro/fuera |
|---|---|---|---|
| Billin | Se marca **en el tipo de impuesto de la factura**: «debes seleccionar en el campo Impuestos la opción Inv. Suj. Pasivo IVA». Solo con dos claves de IVA («la 01 - Régimen general y la 04 - Régimen especial oro inversión»). Con VeriFactu la clave hace mostrar «los motivos correspondientes; exento, no sujeto o inversión de sujeto pasivo». Libros: se traspasa a su contabilidad («Fras. Emitidas») y se revisa el IVA repercutido. Leyenda literal: **no encontrado** (su blog solo dice «indicar en dicha factura que es una operación de Inversión en sujeto pasivo según artículo 84 de la Ley de IVA») | `B/48672319350161`, `B/48672370212625`, `B/48672372585617` `[AYUDA]` ◐ · `BN/blog/que-es-y-como-funciona-el-sujeto-pasivo/` `[BLOG-LEY]` ◐ | fuera |
| Anfix | Se marca por **«Tipo de operación (modelos de IVA)»**, en la **línea** y en la **ficha del cliente** («Por defecto, se asigna el tipo 1»), que decide las casillas del 303 y 390. Agrupa «no sujetas a IVA o inversión del sujeto pasivo con derecho a deducción: Casilla 61» y describe la «Casilla 122» para la base con inversión. Leyenda que imprime: **no encontrado** (su ayuda «datos obligatorios» dice solo que la factura debe llevar la mención: es ley, no producto) | `A/dar-de-alta-facturas` ✔ · `A/info-303-regimen-general` `[AYUDA]` ✔ (volcado) · `A/info/datos-obligatorios-factura` `[AYUDA]` ◐ | fuera |
| Holded | Es la **«clave de operación S2»** dentro de Opciones → SII de la factura; con S2 y sin NIF del cliente, error: «no se ha especificado el NIF del cliente o proveedor». Es campo SII; **no dice que imprima leyenda**. Los modelos se autorrellenan solo con **impuestos predefinidos**; su 303 no menciona la inversión | `H/es/articles/10079158-sii-errores-frecuentes`, `H/en/articles/6955477-complete-the-sii-fields-on-your-sales-invoices` `[AYUDA]` ✔/◐ · `H/en/articles/7894887-…` ◐ | fuera |
| Verifacturamos | **Solo la intracomunitaria**, y se marca **en el cliente**: «Al configurar un cliente como “intracomunitario”… IVA a 0 %, retención IRPF desactivada, mención de inversión del sujeto pasivo incluida en el PDF, y la operación se marca para el Modelo 349». Leyenda en su guía: «Inversión del sujeto pasivo — Art. 196 Directiva 2006/112/CE». **Obra/subcontrata: no encontrado**, aunque publica «inversión del sujeto pasivo» entre sus 23 tipos (`M` L118) | `V/facturar-clientes-ue-intracomunitaria` `[PRODUCTO]` ◐ | fuera |
| FacturaDirecta | En **compras** aparece en el selector («Si la operación es intracomunitaria, exenta, importación o inversión del sujeto pasivo, se refleja aquí»); en venta: **no encontrado**. Su blog da la fórmula «Operación con Inversión del Sujeto Pasivo de acuerdo al artículo 84.uno.2º de la Ley 37/1992» | `FD/15386195-anadir-lineas-iva-y-descuentos-en-una-factura-de-compra` `[AYUDA]` ◐ · `facturadirecta.com/blog/inversion-del-sujeto-pasivo/` `[BLOG-LEY]` ◐ | fuera |
| Quipu | Blog con la leyenda «Operación con inversión del sujeto pasivo conforme al Art. 84 (Uno.2º) de la Ley 37/1992 de IVA» y casillas 12, 13, 28, 29, 53 y 61 del 303; el resumen dice que **no muestra pasos de Quipu**. Cómo se marca: **no encontrado** | `QB/blog/factura-con-inversion-del-sujeto-pasivo/` `[BLOG-LEY]` ◐ | fuera |
| Contasimple | Una frase comercial al cierre de un blog: «permiten emitir facturas con inversión del sujeto pasivo de forma automática». Sin casilla ni leyenda ni pasos | `CS/blog/factura-inversion-sujeto-pasivo/` `[BLOG-LEY]` ◐ | fuera |
| Sage | **No encontrado** para Sage Active | `S/blog/inversion-del-sujeto-pasivo/` `[BLOG-LEY]` ✔ (no menciona el producto) | fuera |

**Lo que se ve:** la marca va en la **línea o el tipo de impuesto** (Billin, Anfix, Holded), con Anfix añadiendo un **valor de partida en el cliente**. Los tres que publican la leyenda en un blog (FacturaDirecta, Quipu y, por fragmento ✖, Holded) **coinciden en el mismo remite legal, «art. 84.Uno.2º de la Ley 37/1992»**; **ninguno demuestra que su PDF la imprima**. Holded confirma el requisito de NIF del cliente (lo que pide 1051, aceptación 1 y 6).

**Recomendación (c):**
1. **Copiar con matiz la marca por línea/tipo de impuesto** (Billin, Anfix): mismo mecanismo de causa por línea que en exentas (1051, aceptación 5: «no dos sistemas»).
2. **Copiar con matiz el valor de partida en la ficha del cliente** (Anfix; Verifacturamos en intracomunitarias): que el cliente pueda **proponerlo**, nunca aplicarlo solo. 1051 dice «solo si lo activa»: encaja. Se añade como comentario a 1051, no como ticket.
3. **Copiar tal cual el bloqueo sin NIF** (Holded SII): ya está en 1051.
4. **Leyenda: no copiar ningún texto tal cual.** Lo que sí ofrece la competencia es un **candidato para el asesor**: la fórmula que repiten tres blogs, «Operación con inversión del sujeto pasivo [conforme/de acuerdo] al art. 84.Uno.2º de la Ley 37/1992». Lo firma el fundador con el asesor (regla 39; Q-C2). Nótese que `CONTABILIDAD.md` §3 cita la letra f) con «apartado por confirmar»: los tres blogs escriben «84.Uno.2º», lo que podría ser ese apartado; **lo confirma el asesor, no este documento**.
5. **Copiar con matiz la llegada al libro y al resumen** (Billin traspasa a su contabilidad; Anfix mapea a casillas): la marca debe verse en el libro de emitidas (1051, aceptación 4).

## 5 · (d) Exento y no sujeto

**Qué tiene YaQu hoy:** no existen. Una línea al 0 % no se puede sellar. SCRUM-1050 (J1) diseña «causa de lista cerrada» y espera a Q-C9.

| competidor | qué hace o dice | fuente | dentro/fuera |
|---|---|---|---|
| Verifacturamos | **Pide motivo y pone el texto solo**: «solo tienes que seleccionar “Exento de IVA” y elegir el motivo de exención. El texto legal se inserta automáticamente en la factura PDF con la referencia correcta al artículo 20.»; el registro se envía «con el código de exención correspondiente (E1 — exenta por art. 20)». La guía trata «no sujeto» como concepto aparte, sin decir si es opción distinta en pantalla ni si la lista es cerrada | `V/facturar-sin-iva-actividades-exentas` `[PRODUCTO]` ✔ | fuera |
| Billin | **Lista cerrada ligada a la clave de IVA**: E1 art. 20, E2 art. 21, E3 art. 22, E4 arts. 23-24, E6 otros; la clave 01 permite E1, E2, E4, E5, E6; la 02 (exportaciones) E2, E3. «Si tu clave de IVA es cualquier otro, no podrás seleccionar “Exento”». **No sujeto**: «La única clave que permite que una factura no esté sujeto a IVA es la clave 10 - Cobros por cuenta de terceros» (y la 17, B2C UE, se presenta «como no sujeta»). El texto legal va en «Observaciones (texto legal)», configurable; texto por motivo: **no encontrado** | `B/48672370212625`, `B/48672370641425`, `B/48672406842257` `[AYUDA]` ◐ (no releído: muro anti-bot) | fuera |
| Holded | Desplegable **«Causa» por línea** en Opciones → SII: «Select the reason why the tax is different from VAT»; estados «Exempt, Not exempt, or Not subject», asignados según el impuesto añadido. **No lista causas E1-E6** en esas páginas; el catálogo incluye «Exemption (art.20)» como impuesto. **Es campo SII**: puede no aplicar a quien no lo use. Texto impreso: **no encontrado** | `H/en/articles/6955477-complete-the-sii-fields-on-your-sales-invoices` `[AYUDA]` ✔ · `H/es/articles/10079158-…` ◐ | fuera |
| Contasimple | **Plantillas «Profesional Exenta» y «Profesional Servicios Exenta»**, «que no muestran las columnas de impuestos», y **texto libre a mano** en el pie: «Actividad exenta de IVA de conformidad al artículo 20 de la ley 37/1992 (Ley de IVA)». Sin lista cerrada ni códigos E | `CS/academia/contabilizar-actividades-exentas-de-iva/` `[AYUDA]` ✔ | fuera |
| FacturaDirecta | **Una sola opción**: «Sin IVA / exento 0%» = «Operaciones exentas, no sujetas, intracomunitarias o exportaciones, según el caso». No distingue ni pide motivo; texto impreso: **no encontrado** | `FD/13570491-que-tipos-impositivos-estan-disponibles-en-facturadirecta` `[AYUDA]` ✔ | fuera |
| Anfix | Sin campo de motivo: lo trata por **tipo de operación** («Operaciones exentas sin derecho a deducción… con derecho a devolución», intracomunitarias, exportaciones, Canarias/Ceuta/Melilla, «no sujetas o inversión del sujeto pasivo: casilla 61»). Distingue exento (dos tipos) de no sujeto (agrupado con la inversión). Texto impreso: **no encontrado** | `A/info-303-regimen-general` `[AYUDA]` ✔ (volcado) | fuera |
| Quipu | **No encontrado** en producto (solo blogs; fragmentos ✖: art. 20 para exentas, art. 7 para no sujetas) | `QB/blog/facturas-sin-iva/` `[BLOG-LEY]` ◐ | fuera |
| Sage | **No encontrado** para Sage Active | — | fuera |

**Lo que se ve:** **tres de ocho piden un motivo** (Verifacturamos, Billin, Holded); Contasimple lo deja a mano; FacturaDirecta y Anfix no lo piden. La lista más completa y más estricta es la de **Billin**, que **liga el motivo a la clave de IVA** y restringe «no sujeto» a muy pocos casos. Los códigos E1-E6 son los que Verifacturamos y Billin usan en su registro VeriFactu/SII (según ellos).

**Recomendación (d):**
1. **Copiar tal cual el motivo obligatorio de lista cerrada** (Billin, Verifacturamos): es lo que ya dice SCRUM-1050, aceptación 1 y 5. Contra FacturaDirecta y Contasimple, que dejan la puerta abierta a un texto libre que el registro no puede distinguir.
2. **Copiar con matiz el texto impreso automático según el motivo** (Verifacturamos): que salga solo, pero **el literal lo firma el fundador** (regla 39; Q-C9). Ya en 1050, aceptación 4.
3. **Copiar con matiz que el motivo dependa del tipo** (Billin: «Exento» solo con ciertas claves): en YaQu equivale a **no ofrecer «exento» y «no sujeto» a la vez con las mismas causas**. Se añade como comentario a 1050.
4. **No copiar «Sin IVA / exento 0 %» como opción única** (FacturaDirecta): agrupa cuatro cosas distintas y 1050, aceptación 2, dice justo lo contrario («no son lo mismo»).
5. **No copiar la plantilla de factura sin columnas de impuestos** (Contasimple): sirve a una actividad exenta entera; sin víctima hoy en un oficio.
6. **Para el asesor (Q-C9):** qué causas de «no sujeto» ofrecer, si alguna. Billin solo admite dos casos (clave 10 y 17); un oficio no parece tenerlos, pero eso lo confirma el asesor.

## 6 · (e) Modelos y plazos

**Qué tiene YaQu hoy:** 303 solo devengado y sin pantalla; 130/111/115/347/349/390 no existen (`CONTABILIDAD.md` §1). Ya hay tickets para 303 (1063/1064), 130 (1065), 111/115 (1066) y 347 (1067); **ninguno para 390, 349, 131 ni para un calendario**.

| competidor | modelos que nombra | ¿presenta ante la AEAT? | calendario / avisos / plazos en el producto | fuente | dentro/fuera |
|---|---|---|---|---|---|
| Verifacturamos | 303 («Verifacturamos genera un informe que facilita la preparación… ¿presenta el Modelo 303 por mí? No»), 130 («datos listos para el 130 o para tu gestor»), 349 (marca la operación). 111/115/347/390: **no encontrado** | No | Calendario/avisos como función: **no encontrado**. Fechas solo en una guía: 1-20 abril, julio, octubre y 1-30 enero, «recargos del 1% por mes de retraso» | `V/facturacion-iva-modelo-303` `[PRODUCTO]` ◐ · `V/modelo-130-irpf-autonomos` ◐ · `V/facturacion-electricistas-fontaneros`: «El informe del Modelo 303 separa las operaciones al 10% y al 21%» ✔ · guía de plazos `[BLOG-LEY]` ◐ | fuera |
| Billin | «no saca directamente los modelos… (303, 347, 390), pero… te permite descargar toda la información»; listados a Excel/PDF de 303, 130, 131, 111, 115, 347 y 349 (el 347 con filtro por importes) | No | Página «calendario fiscal» con 303, 130/131, 111, 115, 180/190, 200, 347, 349, 390. **Fechas desfasadas**: según el subagente, la página muestra «abril de 2024» y «julio de 2024» en un calendario de 2026 (dos lecturas iguales) | `B/48672352206097`, `B/48672358189585`, `B/48672417078161` `[AYUDA]` ◐ · `BN/calendario-fiscal/` `[PRODUCTO]` ◐ | fuera |
| Contasimple | 303, 390, 130, 111, 115, 180, 190, 347, 349 (131 no) | **Genera el fichero y el usuario lo sube**: «Una vez descargado el fichero, entra en la página de la Agencia Tributaria y sube o carga el fichero generado.» | «Calendario Fiscal actualizado» y «alertas personalizadas que te recuerdan cada plazo». 303: «1 al 20 de abril» / «del 1 al 30 de enero» | `CS/modelos-tributarios-hacienda-aeat/` y `…/presentacion-modelo-303-iva/` `[PRODUCTO]` ◐ | fuera |
| FacturaDirecta | 111, 115, 130, 180, 190, 202, 303, 347, 349, 390 (el 131 no). «No es compatible con… autónomos en régimen de módulos» | **No**: «prepara la información para que puedas revisar el resultado y presentarlo donde corresponda»; «Debes rellenar el modelo 390 en la web de Hacienda» | Periodicidad («Trimestral o mensual»). Calendario con fechas y avisos: **no encontrado** | `FD/15123771-impuestos-y-modelos-aeat`, `FD/1070782-modelo-303-autoliquidacion-de-iva` `[AYUDA]` ◐ | fuera |
| Holded | Artículos de ayuda de 130, 200, 303, 347, 349, 369, 390, 190; el 115 solo dentro del 111. **347** con umbral «€3,005.06» y autorrelleno desde ventas/gastos | **Sí, con certificado del usuario**: botón «Presentar en AEAT» para «111, 115, 123, 130, 200, 202, 303 y 390» («sin tener que descargar o subir ningún archivo»); 347 y 349 no figuran. **Es una noticia de agosto de 2023: puede haber cambiado** | Panel **«Upcoming Taxes»** con calendario de «deadlines» y filtro por estado (filed, pending, omitted, not filed). 303: «Q4 return deadline: before 30 January» | `news.holded.com/27904-acelera-la-presentacion-de-tus-modelos` ✔ · `H/en/articles/6923150-what-can-you-do-in-the-tax-section`, `H/en/articles/6901005-model-347-…` `[AYUDA]` ◐ | fuera |
| Quipu | 303, 130, 111, 115, 180, 190, 390, 347 (131 y 349 no) | **No**: «en 1 sólo clic podrás tener el archivo .txt rellenado y descargado, listo para presentar en Hacienda»; «debes descargarte el TXT… para poder presentarlo telemáticamente» | No describe calendario ni alertas | `Q/7198438-preguntas-frecuentes-sobre-impuestos` `[AYUDA]` ✔ | fuera |
| Anfix | 303, 340, 347, 349, 390, SII, 111, 115, 130, 180 y 190 | **Sí para 303, 130 y 390**: «Presenta los modelos 303, 130 y 390 directamente desde Anfix y recibe el justificante oficial al instante»; exige **certificado electrónico** y no funciona en la prueba gratuita. **111 y 347: genera el fichero y el usuario registra la presentación** | **No encontrado** (5 artículos + `AW/impuestos`). Un matiz: el 390 exige el 303 en estado «Presentado» | `AW/impuestos/` `[PRODUCTO]` ✔ (volcado) · `A/generar-modelo-111` ✔ (volcado) · `A/generar-modelo-347`, `A/presentar-modelo-oficial` `[AYUDA]` ◐ | fuera |
| Sage | Starter: «no permite declarar el IVA ni presentar declaraciones»; Essentials: «permite preparar y enviar digitalmente la declaración de IVA (modelo 303)… no podrás presentar declaraciones»; las dos frases sobre presentar **se contradicen** en la misma página | Ver contradicción | **No encontrado** | `S/productos/sage-active/` `[PRODUCTO]` ✔ | fuera |

**Lo que se ve:** **seis de ocho preparan y no presentan** (Verifacturamos, Billin, Contasimple, FacturaDirecta, Quipu y Sage, que se contradice en su propia página). **Solo Holded y Anfix presentan**, y ambos exigen **el certificado electrónico del usuario**; Verifacturamos —el más parecido a nosotros— no. El **390** lo ofrecen cinco de ocho (Contasimple, FacturaDirecta, Holded, Quipu, Anfix); el **349**, cinco (Contasimple, FacturaDirecta, Holded, Anfix, Billin en listados); el **131**, dos (Anfix y Billin en listados; FacturaDirecta dice expresamente que no). El **calendario con avisos dentro del producto** es de **dos** (Contasimple y Holded). Tres competidores citan las mismas fechas del 303 (1-20 abril/julio/octubre y 1-30 enero: Contasimple, Holded y la guía de Verifacturamos): coinciden, pero **es dato de ellos, no verificado por nosotros** (Q-C8). El calendario de Billin es un contraejemplo: fechas de otro año.

**Recomendación (e):**
1. **Copiar tal cual el modelo como borrador sin presentar** (6 de 8; Quipu y FacturaDirecta lo dicen con más claridad): es la decisión **D2** y lo que ya hacen los tickets 1063-1067.
2. **No copiar presentar ante la AEAT** (Holded, Anfix): pide el certificado del usuario, el texto «presenta» es un claim fiscal (regla 7), y el competidor más parecido tampoco lo hace. Si el fundador lo quiere, es decisión propia y de otro bloque.
3. **Copiar con matiz el aviso de trimestre** (Contasimple: «alertas que te recuerdan cada plazo»): un aviso **dentro de la aplicación** que dice que el trimestre terminó y que el resumen está listo para el asesor, **sin fecha de presentación**. Así se copia el hábito sin afirmar ningún plazo. → **ticket nuevo SCRUM-1075: aviso de fin de trimestre**.
4. **Copiar con matiz el calendario con estado** (Holded: pendiente/presentado; Contasimple): las **fechas** solo tras citarlas de la norma (Q-C8, CON-03) y con **el año a la vista** (el calendario de Billin enseña otro año). El estado sería «pendiente / llevado a mi asesor», no «presentado». → **ticket nuevo SCRUM-1076: calendario de plazos** (modelos, J1, `esperando-asesor`).
5. **Copiar con matiz: añadir el 390** (5 de 8) como borrador tras el 303 completo. → **ticket nuevo SCRUM-1077: modelo 390**.
6. **No copiar ahora el 349 ni el 131.** El 349 es de operaciones con la UE; el 131, de autónomos en módulos (FacturaDirecta ni lo soporta). **Q-C8** debe decir si algún oficio de nuestro público está ahí; sin esa respuesta no hay víctima.
7. **Dato para el asesor, no para el código:** Holded cita un umbral de 3.005,06 € para el 347. SCRUM-1067 ya dice que el umbral no se escribe hasta citarlo; se anota en su comentario como dato de partida.
8. **Ya existe:** «carpeta Drive / sync con tu gestor» (Verifacturamos) = SCRUM-322 (envío al asesor); el «resumen acumulado del trimestre» que Verifacturamos da para el 130 refuerza 1048/1049.

## 7 · Tickets: qué existe y qué se abre

**Ya existe en las olas de SCRUM-1012** (no se duplica; se añade un comentario corto con la evidencia): 1050 exentas/no sujetas · 1051 inversión del sujeto pasivo · 1052 10 % con aviso del 40 % · 1053 retención al total · 1063/1064 303 · 1065 130 · 1066 111/115 · 1067 347 · 1048/1049 resumen del trimestre · 322 envío al asesor.

**Búsqueda de duplicados** (Jira, 21-sep, por palabra en el título: epígrafe, IAE, actividad, perfil fiscal, calendario, 390, plazos, fin de trimestre, reforma): 16 resultados, **ninguno** es de esto (son de otro tema: firma, plazos de red, semáforo de facturar, `390 px`, calendario de la agenda); el único de «reforma» es 1052 (control positivo: sale). La búsqueda ancha del principio (contabilidad, modelo, IRPF, retención, IVA: 62 resultados) tampoco encontró nada de perfil-actividad, calendario fiscal ni 390.

**Tickets nuevos** (creados el 21-sep-2026; el registro `docs/master/SCRUM-1012.md`, sección 1012b, los repite):

| # | título | dueño | por qué es nuevo |
|---|---|---|---|
| SCRUM-1072 (N1) | PERFIL · Preguntar la actividad (profesional o empresarial) y dejar la retención lista, sin afirmar qué corresponde | Luis (S2 + S1) | 1053 usa el perfil pero no pregunta la actividad |
| SCRUM-1073 (N2) | RETENCIÓN · Por cliente y por factura, con el perfil como valor de partida | **Javier (J1, emisión)** | 1053 solo lee el perfil |
| SCRUM-1074 (N3) | PRESUPUESTOS · Marcar «reforma de vivienda» y ver el aviso del 40 % de materiales al presupuestar | Luis (S2 + S1) | 1052 es solo de factura |
| SCRUM-1075 (N4) | INFORMES · Aviso de fin de trimestre dentro de la aplicación (sin fechas de presentación) | Luis (S2 + S4 texto) | 1049 es la pantalla, no el aviso |
| SCRUM-1076 (N5) | MODELOS · Calendario de plazos con estado, con fechas solo tras citarlas | **Javier (J1, modelos)** | ninguno de las olas |
| SCRUM-1077 (N6) | MODELOS · Borrador del modelo 390 | **Javier (J1, modelos)** | 1063-1067 no lo incluyen |

## 8 · Errores propios y lo que queda sin medir

- **Los subagentes se pasaron del tope** (40 llamadas): 102, 46, 56 y 73. Es coste, no daño; aun así, cada uno declaró su exceso.
- **Errores que ellos mismos corrigieron:** un resumen de buscador daba «0 % por defecto» de Contasimple sin fuente (era la calculadora, no el formulario); se descartó un resumen que llamaba «reverse charge» al recargo de equivalencia; se tomó una ayuda de otra marca (TeamSystem Factusol) por la de Billin y se descartó; una atribución a Sage Active de «presentación directa» era de Sage Despachos Connected; un resumidor dijo que Anfix «no presenta» el 390 y el texto solo dice qué contiene (Anfix lo anuncia como presentación directa en su web comercial, y su ayuda lo lista entre los modelos que se presentan por fichero + certificado: **incoherencia entre sus dos páginas, no resuelta**).
- **Error mío (A9):** la primera vez traté los datos de `B` como verificables con mi propia lectura; el navegador me devolvió el desafío anti-bot y no lo rodeé. Quedan ◐.
- **Sin medir:** el valor por defecto de la retención dentro de cada formulario real; el PDF que imprime cada competidor (todo es lo que dicen sus páginas); las páginas de 115/347/349/390 de FacturaDirecta y Contasimple una a una; los vídeos y las fichas de tienda.
- **Discrepancia sin resolver:** la página de retenciones de Contasimple cita «19,5 %» para alquileres y su calculadora «19 %».
- **Lo que este documento no prueba:** que la ley diga lo que ellos dicen. Todo lo fiscal sigue por citar (`CONTABILIDAD.md` §4 → asesor).

## 9 · Pasada por DENTRO — pendiente (la retoma la sesión siguiente)

El orquestador -06 comunicó el 21-sep, tras entregar la pasada por fuera, que el fundador autoriza entrar con Playwright en las cuentas de prueba ya abiertas (Contasimple, FacturaDirecta, Tradify, Verifacturamos) y abrir cuentas nuevas (Billin, Holded, Quipu, Anfix, Sage) **solo a mirar**: sin tarjeta, sin SMS, sin datos de pago, sin envíos a terceros, con un correo de alias por competidor. **Esa autorización vale para la sesión que la recibió; la nueva la pide otra vez (A19).** Si el clasificador deniega algo (contraseñas guardadas, login), no se rodea: se avisa al orquestador.

Qué mirar por dentro, en este orden de valor (cada hallazgo = una captura en `docs/competencia/capturas/<competidor>/` + una fila «dentro» en la tabla de su punto + un ticket si es nuevo):

1. **Verifacturamos** (cuenta abierta, parada en el paso 2 del asistente): valor por defecto de la retención en el perfil; el «sugiere IVA 10 %» al convertir un presupuesto con materiales y mano de obra; el selector «Exento de IVA» y su lista de motivos; si «no sujeto» es opción aparte; el cliente «intracomunitario» y qué imprime su PDF; el informe del 303.
2. **Contasimple** (prueba de 30 días): el desplegable de retención en la factura (¿por defecto?); las plantillas «Profesional Exenta»; cómo se marca la inversión del sujeto pasivo; la sección de modelos y su calendario fiscal.
3. **FacturaDirecta**: retención por defecto en una factura de venta; «Sin IVA / exento 0 %»; inversión del sujeto pasivo en una compra; la sección de modelos.
4. **Cuentas nuevas**, solo si el correo de verificación llega y no piden teléfono ni pago: Billin (su centro de ayuda está tras un desafío anti-bot: dentro del producto se ve más), Holded, Anfix, Quipu (falló una vez), Sage Active.

Al acabar: cada celda «NO ENCONTRADO» que dentro sí aparezca se corrige; la columna «dentro/fuera» pasa a decir cuántas de las 40 celdas se vieron por dentro; y se dan de baja o se anotan las cuentas abiertas.
