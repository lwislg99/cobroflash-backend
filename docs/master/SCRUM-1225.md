# SCRUM-1225 · Cómo se prueba `sif.client.ts` si el certificado no entra en ninguna sesión

**Medido contra:** `origin/main` = `a59dc1e692bae683d2d035fe52534b5589d0c7b3` · 2026-09-28T15:03:25Z

Sesión J5 (`jv-j5`), 28-sep-2026, por encargo del orquestador de Javier. **Sólo lectura y citas.** No
toca `src/` ni el camino de emisión. **No se ha pedido, buscado ni tocado ningún certificado**, tampoco
de pruebas: donde la investigación llega a «hace falta uno», se dice y se para.

**El hueco que motiva el ticket:** los diez registros aceptados de S1-D los mandó Javier a mano desde
el navegador. Eso demuestra que **los registros son conformes**, pero no que
`src/modules/fiscal/verifactu/sif.client.ts` sepa mandarlos, porque no ha mandado ninguno.

## ⓪ Las fuentes

Todas se bajaron con `curl` el 28-sep-2026 entre las 14:59Z y las 15:02Z y se leyeron en su texto.
**Ninguna con WebFetch.** Las citas son copia literal.

| # | fuente | URL | versión / fecha | sha256 |
|---|---|---|---|---|
| W1 | AEAT, **descripción del servicio web** `Veri-Factu_Descripcion_SWeb.pdf` | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf` | v1.0.3, 28/07/2025 | `b3570f6a308ce98a5f52001a0dc427310ad6cf7bccd60a9ee98720a59e553c02` |
| W2 | AEAT, **WSDL del entorno de pruebas** `SistemaFacturacion.wsdl` | `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl` | sin versión | `05919120708ff7650612fa6683c9336eaf919335d9a4db10e86759190af48602` |
| W3 | AEAT, **Portal de pruebas externas** (portada) | `https://preportal.aeat.es` | sin fecha | `e311742a06bdf408ec6c00d0622d11554f57297795219bb0d837e84ec2c35957` |
| W4 | AEAT, **servicio de validación No VERI*FACTU** `Descripcion_ServicioWeb_ValidacionNoVerifactu.pdf` | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Descripcion_ServicioWeb_ValidacionNoVerifactu.pdf` | v0.2, 17/09/2025 | `747a9ce4fad2f3f51c6226bd9780f6515a971d3131f39886c60329cd3c662f22` |
| F5 | AEAT, **Aclaraciones a dudas de los desarrolladores** `FAQs-Desarrolladores.pdf` | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf` | v1.3 (pie: 4 de diciembre de 2025) | `73906dc8afbbb9da35f6cb489980352b42aed66d48828fd62a00168883c09d5e` |
| S1 | AEAT, sede, **FAQ «Colaboración social»** | `https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/colaboracion-social.html` | página viva | `8b0e3c7e955a553d1a95e8487b1444bd94af74f706cf84f06ff744e55a693ae6` |
| O1 | **Orden HAC/1177/2024**, arts. 4 y 5 | `https://www.boe.es/diario_boe/xml.php?id=BOE-A-2024-22138` | BOE 28-oct-2024 | `79a0b6b5dd58528e3917b42e267a1c090624c1198e5c5fcd3b8503ec7e177c19` |
| R2 | **RD 1007/2023** (RRSIF), texto consolidado, art. 13 | `https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840` | «Última actualización publicada el 03/12/2025» | `510a3731093e6e57f46589897139b5962e048bdf47a9a2a60469419383223b7a` |
| M1 | **Medición propia**: un `GET` sin certificado y sin cuerpo a los dos endpoints de pruebas | ver ①(c) | 28-sep-2026 15:01Z | — |

Además, para el Convenio 017 se cita la **respuesta de la AEAT por correo de jul-2026, tal como está
transcrita en SCRUM-143**. **No he visto el correo original**: es una fuente de segunda mano y se marca
así donde se usa.

## ① ¿Ofrece la AEAT alguna forma de probar el servicio web SIN el certificado real?

**Respuesta: no he encontrado ninguna.** El entorno de pruebas existe, pero pide certificado igual que
producción, y lo he medido.

**(a) Hay entorno de pruebas, con dos puertas.** W2 declara estos puertos, literal de sus comentarios:
- `SistemaVerifactuPruebas` → `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`
  (*«Entorno de PRUEBAS»*)
- `SistemaVerifactuSelloPruebas` → `https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`
  (*«Entorno de PRUEBAS para acceso con certificado de sello»*)

y sus dos gemelos de producción en `www1` y `www10`.

**(b) El entorno de pruebas exige certificado.**
- W3, literal: *«Este portal tiene por finalidad facilitar las pruebas de presentación y consulta de
  declaraciones tributarias a los usuarios externos de la Agencia Tributaria, de forma totalmente
  libre, con la única condición de autenticarse mediante un certificado electrónico.»* Y: *«Las
  declaraciones presentadas a través de este Portal se guardan en una Base de Datos del entorno de
  pruebas de la AEAT, sin que en ningún caso tengan trascendencia tributaria.»*
- W3, literal: *«https://prewww1.aeat.es equivalente en cuanto a requisitos a
  https://www1.agenciatributaria.gob.es»* y *«prewww10.aeat.es (pruebas de Web Services para
  Contribuyentes con certificado de sello) equivalente en cuanto a requisitos a
  https://www10.agenciatributaria.gob.es»*.
- W1 §4.3, literal: *«Certificado: Las aplicaciones que envían información a los servicios web deberán
  autenticarse con certificado electrónico cualificado reconocido.»*

**(c) Medido (M1): sin certificado, la AEAT no deja pasar.** Un `GET` sin certificado de cliente y sin
cuerpo a los dos endpoints de pruebas devuelve en ambos `HTTP/1.0 302 Moved Temporarily` con
`Location: https://sede.agenciatributaria.gob.es/Sede/errores/erro4033.html`. Esa página dice, literal:
*«Error de identificación. No se detecta certificado electrónico o no se ha seleccionado
correctamente.»* No se mandó ningún registro.

**(d) Lo que no hay, en lo leído:** ni sandbox sin mTLS, ni endpoint que acepte sin autenticar, ni
certificado de pruebas que entregue la AEAT. El servicio de validación No VERI*FACTU (W4), que es lo más
parecido a un «validador», **también** pide certificado (W4 §4.3: *«deberán autenticarse con certificado
electrónico de cliente»*), y además es para registros no verificables.

**⚠️ Visto de pasada, y NO investigado por orden del encargo:** los ejemplos de W4 usan una identidad
*«CERTIFICADO UNO TELEMATICAS»* con NIF `89890001Z`. Parece una identidad de pruebas de la AEAT, pero
**ninguna fuente leída dice que sea un certificado a disposición de terceros ni cómo obtenerlo**. No lo
he buscado: si interesa, lo mira Javier.

## ② Colaborador social: qué certificado, de quién, y qué hace falta

**(a) De quién: el del colaborador, no el del obligado.**
- W1 §4.1, literal: *«La remisión a través del servicio web podrá ser efectuada por el obligado
  tributario, un apoderado suyo a este trámite o un colaborador social, que deberá disponer de un
  certificado electrónico cualificado reconocido.»*
- O1 art. 5, literal: *«los sistemas informáticos deberán presentar ante esta la correspondiente
  identificación electrónica **del remitente** mediante el uso de los certificados electrónicos válidos
  en cada momento en la sede electrónica»*, y *«La remisión podrá ser efectuada por el propio obligado
  tributario o por un tercero que actúe en su representación»*.
- F5 §16.3, literal: *«el colaborador social 2 (empresa software que va a remitir **con su identidad**
  los RFs)»*.

**Consecuencia:** en el Modelo A **el certificado es de YaQu (la SL), no del profesional**. Es el
certificado que viviría en el servidor. La regla «el certificado no entra en ninguna sesión» sigue
valiendo, pero el certificado del que se habla ya no es el del obligado.

**(b) Qué tipo exactamente — SIN DETERMINAR.** Las fuentes dicen «certificado electrónico cualificado
reconocido» (W1) y «válidos en cada momento en la sede» (O1). La AEAT ofrece puertos específicos *«con
certificado de sello»* (W2, W3), pero **ninguna fuente leída dice** si un colaborador social 017 remite
con certificado de sello, con certificado de representante de persona jurídica, o con cualquiera de
los dos.

**(c) Qué hace falta para tenerlo.**
- **Ser colaborador 017.** F5 §16.1, literal: *«Pueden ser colaboradores sociales a este respecto tanto
  las empresas suministradoras de software que hayan suscrito el correspondiente Convenio de
  colaboración social como los profesionales de la gestión tributaria.»* S1: *«las empresas
  desarrolladoras de software pueden suscribir el acuerdo de colaboración social en la aplicación de
  los tributos Tipo 017»*.
- **Documentación** (F5 §16.2), literal y entre otros: *«Copia del artículo de los estatutos de la
  entidad en el que se haga referencia al objeto social»* y *«certificado (en formato pdf) expedido por
  el secretario de la entidad acerca del nombramiento del representante»*. Pide estatutos y secretario:
  presupone una **entidad**.
- **Sociedad mercantil**: correo de la AEAT transcrito en SCRUM-143 (**segunda mano**, ver ⓪): *«los
  acuerdos de colaboración social se suscriben con entidades con personalidad jurídica y carácter
  mercantil (sociedades anónimas, sociedades de responsabilidad limitada, cooperativas, etc)»*.
- **🔴 Para PROBAR como colaborador, también hace falta el convenio.** Correo de la AEAT, SCRUM-143
  punto 5 (**segunda mano**): *«En tanto que no se obtenga la condición de colaborador social NO SE PODRÁ
  ACTUAR COMO TAL EN EL ENTORNO DE PRUEBAS de VERI*FACTU remitiendo información de registros de
  facturación correspondientes a terceras personas.»*
- **La representación de cada cliente** (S1), literal: *«Para otorgar la representación en
  colaboración social no se admitirán modalidades de aceptación de condiciones del servicio u otras
  alternativas que no permitan acreditar el otorgamiento»*. F5 §16.4 admite formularios web o pop-ups
  *«siempre [que] deberán exigir la cumplimentación y firma (incluyendo electrónica) del
  otorgamiento»*.

## ③ La frontera: qué se comprueba sin red y qué sólo se sabe mandando

Hoy `sif.client.ts` recibe las opciones TLS «opacas, de fuera» y no lee certificados (cabecera del
fichero, líneas 10–11). La frontera está exactamente ahí.

| qué | ¿sin red? | contra qué |
|---|---|---|
| El sobre SOAP 1.1 *document/literal* | **sí** | W1 §4.2 (*«se utilizará siempre el modo "document" (style = "document") sin ningún tipo de codificación (use = "literal")»*) y W2 (`style="document"`, `soapAction=""`) |
| El cuerpo contra `SuministroLR.xsd` / `SuministroInformacion.xsd` | **sí** | los XSD de W1 §7.2 (vendorizados en el repo) |
| Que la URL es la del WSDL | **sí** | W2 |
| Máximo 1.000 registros por envío | **sí** | W1: *«El número máximo de registros por envío es de 1.000.»* |
| Control de flujo (`TiempoEsperaEnvio`, 60 s de salida) | **sí**, con respuestas fabricadas | W1 §6.4.4.1, que cita el art. 16.2 de O1 |
| Que un `Fault` se lee como rechazo | **sí**, con respuestas fabricadas | W1 §5.1 (*«utilizando el elemento "Fault"»*, `soapenv:Client` / `soapenv:Server`) |
| Que la respuesta real se interpreta bien | **sólo en parte**: se puede validar contra `RespuestaSuministro.xsd`, pero **W1 no trae NINGÚN ejemplo de respuesta** (0 apariciones de `RespuestaRegFactuSistemaFacturacion` en todo el PDF; sus ejemplos son de peticiones). Cualquier respuesta de prueba la escribimos nosotros | W1 §7.3 (XSD); **no hay muestra oficial** |
| Que el apretón TLS con cliente sale bien con el certificado real (cadena, formato de la clave, versión TLS) | **no** | sólo mandando |
| Que la AEAT acepta ESE certificado para ESE NIF, en nombre propio o como colaborador | **no** | sólo mandando |
| Lo que la AEAT devuelve de verdad cuando algo falla en el transporte | **no**, salvo lo medido en M1 | sólo mandando |

**🔴 Un dato de M1 que afecta al cliente, sólo leído y no probado.** Sin certificado, la AEAT no contesta
con un `Fault`: contesta **HTTP 302 hacia una página HTML**. Leyendo `sif.client.ts` en `origin/main`
(líneas 486–490), un estado fuera de 2xx sin `Fault` reconocible se cierra como `sin_respuesta` (*«el
sobre SÍ salió entero y no sabemos qué pasó»*, línea 22). Es decir, **un certificado ausente o rechazado
se clasificaría como «no sabemos», no como «rechazado»**. No lo he ejecutado. Si se confirma, es un
defecto del camino de emisión y **es STOP** (regla 40): lo decide quien construye S1-D.

## ④ ¿Dice algo la AEAT sobre acreditar un SIF sin haber remitido?

**No existe una acreditación por la AEAT: la declaración responsable la firma el productor. Ninguna
fuente exige haber remitido antes, pero sí exige que el sistema pueda remitir.**

- R2 art. 13.1, literal: *«Corresponderá a la persona o entidad productora del sistema informático
  certificar, mediante una declaración responsable, que el sistema informático cumple con lo dispuesto
  en el artículo 29.2.j) de la Ley 58/2003, General Tributaria, así como con lo dispuesto en este
  Reglamento y en las especificaciones que, en su desarrollo, se aprueben mediante orden ministerial.»*
- En R2, O1 y F5 no aparece «homolog» ni una sola vez. «Prueba» sólo sale en el RRSIF dentro de
  «aprueba».
- **Lo que se declara** (O1 art. 4), literal: *«La capacidad de remisión […] implica que el sistema
  informático deberá poder realizar cada una de las siguientes acciones: a) Conectarse a Internet […]
  b) Gestionar certificados electrónicos. Los certificados electrónicos serán utilizados para
  autenticarse en la conexión con la Agencia Estatal de Administración Tributaria […] c) Remitir los
  registros de facturación, con la estructura, formato y codificación requeridos, usando para ello
  protocolos seguros de comunicación […] d) Recibir y procesar adecuadamente las respuestas generadas
  por la Agencia Estatal de Administración Tributaria ante los envíos realizados.»*
- F5 §11, literal: *«si se desea poder probar el SIF, deberá ser con el certificado electrónico
  cualificado válido y admitido instalado (porque, si no es así, el SIF no puede estar operativo y ser
  usado).»* (Habla de probar el SIF en producción con facturas reales que luego se anulan, en una serie
  aparte del tipo *«PRU 25 XXXX»*.)

**Consecuencia para el orden de fases del máster:** la norma no impone que D (remitir) vaya antes que G
(declarar). Pero la declaración responsable **certifica** las letras b), c) y d) del art. 4. Firmarla
sin que `sif.client.ts` haya mandado nunca un registro sería certificar una capacidad no comprobada.
**Que el orden D → G esté bien o mal no lo dice ninguna fuente: lo dice qué quiere firmar Javier.**

## ⑤ Veredicto

**Qué se puede probar hoy, sin certificado y sin SL:** todo lo que queda por encima del transporte. Es
decir: el sobre, el XSD, la URL, el límite de 1.000, el control de flujo y la lectura de `Fault` y de
respuestas fabricadas (③, filas «sí»). No prueba que la AEAT conteste lo que suponemos: W1 no trae
ninguna respuesta de muestra.

**Qué no se puede probar sin un certificado:** que el cliente sabe mandar. La AEAT no ofrece ninguna
vía sin certificado, ni siquiera en pruebas (① (b), medido en (c)).

**¿Es la SL el bloqueo real? Sólo para el Modelo A.**
- **Probar el cliente como colaborador (Modelo A)** exige la SL, el Convenio 017 y el certificado de la
  SL. Según la AEAT, sin el convenio no se puede ni en pruebas (② (c), segunda mano). **Para esto, la SL
  sí es el bloqueo.**
- **Probar el cliente en nombre propio no exige la SL.** O1 art. 5 y S1 admiten *«el propio obligado
  tributario»*, y el entorno de pruebas es *«de forma totalmente libre, con la única condición de
  autenticarse mediante un certificado electrónico»*, *«sin que en ningún caso tengan trascendencia
  tributaria»* (W3). Es decir: **un obligado con su propio certificado puede mandar sus propios registros
  a `prewww1` con nuestro cliente**. Eso prueba el transporte de `sif.client.ts`, que es lo que falta.
  Para eso el certificado tiene que estar donde corre el cliente, **no en una sesión**: lo corre Javier en
  su máquina. Si quiere hacerlo, cómo y con qué certificado lo decide él; esta sesión no lo toca.
- Lo que la vía en nombre propio **no** prueba: que la AEAT acepte a YaQu **como colaborador** (el
  certificado de la SL, la representación, el tipo de certificado de ②(b)). Eso sigue esperando a la SL.

**Queda SIN DETERMINAR**, sin fuente leída:
1. Qué tipo de certificado usa exactamente un colaborador 017: sello, representante de persona jurídica
   o cualquiera de los dos (② (b)).
2. Si existe un certificado de pruebas que la AEAT ponga a disposición de terceros (① (d); no buscado por
   orden del encargo).
3. La forma real de las respuestas de la AEAT: W1 no trae ninguna muestra (③).
4. Que un 302 se clasifique como `sin_respuesta` en `sif.client.ts` está leído, no ejecutado (③).
