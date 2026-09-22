# Preguntas para asesores externos — agrupadas por especialista, listas para enviar

> **Origen:** SCRUM-1023 (J4), a partir de `docs/legal/PREGUNTAS_ASESOR.md` (835 líneas, 28 preguntas
> numeradas + 5 sub-preguntas del bloque 21 + P11-P17). Ese documento es el **expediente técnico**
> — cada pregunta ahí lleva el fichero, la línea y la medición que la motiva, y sigue siendo la
> fuente de verdad. Este documento es su **forma de envío**: la misma sustancia, reagrupada por a
> quién se le pregunta, redactada para que se entienda sin abrir el repositorio, y sin literales
> de código.
>
> **No se contesta ninguna pregunta aquí.** El valor de este documento es ser la lista, no un intento
> de respuesta — tal como pidió Javier. Tampoco se envía por su cuenta esta sesión: **la propone J4,
> la manda un jefe** (regla de puesto).
>
> **⚠️ Nota SCRUM-143, dicha por Javier hoy (22-sep-2026), literal:** "no te preocupes, lo vuelvo a
> preguntar" — sobre si el Convenio 017 de la AEAT exige sociedad mercantil. No se ha buscado la
> respuesta de julio: la pregunta entra en la lista como pendiente (ver **F1** abajo) y se sigue.

---

## Cómo leer esto

Cada pregunta lleva:
- **Para el asesor** — el enunciado, sin jerga de código.
- **Desbloquea** — qué ticket o qué pieza del producto se queda parada sin la respuesta.
- **Si no se contesta** — qué pasa (normalmente: el producto se queda conservador, no que algo se
  rompa; se dice cuándo NO es así).

Dentro de cada especialista, van **ordenadas por lo que desbloquean** — primero las que paran algo
grande o urgente, al final las que solo pulen un texto.

---

# 1 · Asesor FISCAL (AEAT / IVA / VeriFactu) — el bloque grande

## F1 · 🔴🔴 LA MÁS URGENTE DE TODO EL DOCUMENTO — ¿"fabricamos o comercializamos" ya un sistema de facturación?

**Para el asesor:** Nuestro software genera registros de facturación con el formato técnico de la
AEAT (huella encadenada, QR) desde hace semanas, pero **todavía no los envía** a la Agencia Tributaria
— eso está sin construir. Mientras tanto, no emitimos facturas fiscales reales a ningún profesional
español: a los que usan la app en España les emitimos un justificante de cobro, no una factura. Sí
emitimos facturas reales a los pocos usuarios que no son de España. La ley (RDL 15/2025 + art. 201 bis
LGT) exige que, desde el 29-jul-2025, cualquiera que "fabrique o comercialice" un sistema de
facturación lo tenga ya plenamente adaptado a la normativa VeriFactu, bajo sanción de hasta 150.000 €
por ejercicio — y ese plazo es independiente de cuándo les toque a los propios negocios usarlo
(2027). **¿Lo que acabamos de describir cuenta como "fabricar o comercializar" ese sistema hoy?** Y si
la respuesta es sí o depende: ¿qué habría que cambiar, retirar o completar para no estarlo, mientras
sigamos sin facturar a españoles?
**Desbloquea:** decide si el producto, TAL COMO ESTÁ HOY, expone a la empresa a una sanción — nada
técnico depende de esto, es la pregunta de riesgo legal más grande abierta.
**Si no se contesta:** el riesgo queda sin cuantificar y sin gestionar; es la única de todo el
documento marcada como la que se lee primero.

## F2 · Cómo nos representamos ante la AEAT para enviar las facturas

**Para el asesor:** Cada profesional que usa YaQu es, ante Hacienda, el responsable de sus propias
facturas. Cuando conectemos el envío automático a la AEAT, ¿lo hacemos con un único certificado
digital nuestro actuando como **colaborador social** en nombre de todos los profesionales (necesita
el Convenio 017), o con el certificado de **cada profesional individualmente**, actuando YaQu solo
como representante técnico? **Nota interna:** Javier ya se inclinó por la primera opción el
16-sep-2026, pero falta que el asesor confirme que es viable y cómo se tramita — no se ha cerrado el
trámite.
**Desbloquea:** el envío técnico a la AEAT no se puede programar sin saber contra qué modelo de
autenticación construirlo.
**Si no se contesta:** el envío a la AEAT sigue sin empezar a construirse (hoy: 0 líneas de código).

## F3 · ¿El Convenio 017 exige que YaQu sea una sociedad mercantil?

**Para el asesor:** Para actuar como colaborador social de la AEAT (ver F2), ¿hace falta que quien
presta el servicio esté constituido como sociedad mercantil, o vale con un autónomo? **Pendiente
desde julio — Javier ha pedido hoy que se vuelva a preguntar sin dar por buena la respuesta anterior.**
**Desbloquea:** si la respuesta es sí, condiciona si hay que constituir una SL antes de poder cerrar F2.
**Si no se contesta:** F2 no se puede cerrar del todo.

## F4 · Calificación de la operación: exenciones, no sujeción e inversión del sujeto pasivo

**Para el asesor:** Hoy el producto solo le pide al profesional un dato fiscal por línea: el tipo de
IVA (21/10/4/0 %). No distingue si una operación está **exenta** (con su causa legal), **no sujeta**,
o si aplica **inversión del sujeto pasivo** — y un 0 % hoy podría significar cualquiera de las tres.
Para el sector de fontanería/electricidad/reformas/mantenimiento en España:
1. ¿Se dan operaciones **exentas**? Si sí, ¿bajo qué causa legal?
2. ¿Se dan casos de **inversión del sujeto pasivo**? ¿Con qué se detectan (tipo de cliente, tipo de obra)?
3. ¿Se dan operaciones **no sujetas**? ¿Con qué dato se identifican?
4. Si ninguna se da en este sector: ¿debe el sistema **impedir** que se marque un 0 %, en vez de
   aceptarlo?
5. ¿Aplica **recargo de equivalencia** a algún cliente típico? ¿Y **retención de IRPF** en facturas a
   empresarios?
6. Los **suplidos** (tasas o permisos que el profesional adelanta por el cliente): ¿son línea de
   factura? ¿con qué calificación fiscal?
7. Si el dictamen dice que alguna factura YA EMITIDA estaba mal calificada, ¿qué se hace? (las
   facturas emitidas no se pueden editar ni borrar, solo rectificar).
**Desbloquea:** SCRUM-212. Si las tres primeras respuestas fueran "en este sector no se dan", el
ticket se cierra sin construir nada.
**Si no se contesta:** una factura con un solo tramo al 0 % queda hoy excluida ENTERA del registro
VeriFactu — no se nota porque la facturación fiscal está apagada, pero saltará el día que se encienda.

## F5 · El recargo de equivalencia: los tipos y si entra en el total sellado

**Para el asesor:**
1. Los tipos de recargo con los que está construido el cálculo son 21→5,2 %, 10→1,4 % y 4→0,5 %, sin
   respaldo documental nuestro. ¿Son los vigentes? ¿Falta algún tipo especial (p. ej. tabaco) o sobra
   alguno?
2. El importe total que hoy queda sellado en cada factura es base + IVA. Con recargo, el cliente paga
   base + IVA + recargo. **¿Ese total sellado debe incluir el recargo?**
3. El recargo solo debería aplicar a comerciantes personas físicas, nunca a sociedades. ¿Es correcto?
   ¿A quién le toca comprobarlo?
4. El IVA con recargo se devenga cuando se cobra (criterio de caja). Hoy solo sabemos CUÁNDO alguien
   marcó una factura como cobrada, no necesariamente la fecha real del cobro bancario. ¿Qué exigencia
   tiene esa fecha para este régimen?
**Desbloquea:** SCRUM-294. El cálculo ya está construido pero desconectado del total que se sella,
precisamente a la espera de esta respuesta.
**Si no se contesta:** sigue desconectado (clasifica y avisa, no liquida) — no hay riesgo mientras
tanto.

## F6 · Factura sin NIF del destinatario: ¿factura completa "sin identificar" o simplificada?

**Para el asesor:** Cuando un profesional le hace una reparación a un particular y no le pide el NIF
(un ticket de 40 €), ¿el documento que corresponde es la **factura simplificada** o la **factura
completa sin identificar al destinatario**? ¿Depende del importe — y si sí, de cuál? ¿Cambia si el
cliente es una empresa que no dio su NIF? Y una rectificativa de una factura sin destinatario, ¿es un
tipo que hay que modelar aparte, o se puede seguir excluyendo como hoy?
**Desbloquea:** SCRUM-292. Hasta la respuesta, una factura sin NIF del cliente simplemente **no se
declara** — no se inventa el dato.
**Si no se contesta:** el producto sigue sin poder declarar esas facturas (el resto de casos ya se
arregla pidiendo el NIF antes de emitir).

## F7 · Los suplidos: ¿entran en el total sellado de la factura?

**Para el asesor:** Un suplido es un gasto que el profesional paga en nombre del cliente (una tasa,
un permiso) y no lleva IVA. ¿Debe aparecer en el **importe total** que se sella ante la AEAT, o queda
fuera por no ser parte de lo que se cobra por el servicio? Si entra en el total pero no en la base
del IVA, ¿cómo se declara? ¿Tiene que identificarse como suplido dentro del documento (concepto,
referencia del gasto)? ¿Hay que conservar y referenciar el justificante, que está a nombre del
cliente y no del profesional?
**Desbloquea:** SCRUM-293.
**Si no se contesta:** el mecanismo de suplidos sigue sin construirse; no hay ningún campo hoy que lo
soporte.

## F8 · Libros Registro: ¿el formato que entregamos es el que espera un despacho?

**Para el asesor:** Entregamos un CSV trimestral de facturas emitidas con once columnas (fecha,
serie/número, tipo, NIF y nombre del cliente, base, tipo de IVA, cuota, total, cobro, anulada). Lo
construimos con nuestro propio criterio, sin contrastarlo contra ningún formato oficial. Tres
preguntas: (1) ¿es ese el contenido/orden que espera un despacho, y podemos llamarlo "Libro
Registro" sin más? (2) Para el libro de compras, hoy solo guardamos si el IVA es deducible como
sí/no — pero hay deducciones parciales (vehículos) que un sí/no no puede expresar: ¿hace falta
guardar el importe deducible, no solo el booleano? (3) ¿Un libro de recibidas numera sus propios
asientos con un contador del receptor, distinto del número de factura del proveedor? Si es así, hay
que decidir su serie antes de construirlo.
**Desbloquea:** SCRUM-325 y SCRUM-426 (libro de recibidas, que se construye en paralelo sin esperar
esta respuesta porque es capa distinta).
**Si no se contesta:** el producto sigue sin llamar a ese documento "Libro Registro de la AEAT" en
ningún sitio, precisamente para no prometer un formato que no está confirmado.

## F9 · El tipo de factura que se declara: ¿F1 para todo lo que no sea R1 es correcto?

**Para el asesor:** Hoy, cualquier documento que no sea una rectificación se declara como factura
completa (F1) — incluidos los justificantes de cobro (que ni siquiera deberían llegar a declararse) y
los anticipos (que todavía no existen). Confirmar: (1) un justificante de cobro NO debe aparecer en
el registro de facturación de ninguna forma — ¿correcto excluirlo del todo? (2) cuando exista la
factura de anticipo, ¿se declara como F1? (3) la factura final que descuenta anticipos ya facturados,
¿sigue siendo F1 o es otra cosa del catálogo? (4) aparte de F1/R1, ¿hace falta usar alguno de los
otros tipos del catálogo oficial (F2, R2-R5) para un profesional de oficios?
**Desbloquea:** SCRUM-413. El diff que corrige el mapeo YA está escrito, esperando esta respuesta —
no se aplica sin ella porque toca el camino de emisión.
**Si no se contesta:** sigue el mapeo actual, ya medido con 5 casos reales en producción donde el
tipo interno y el número no coinciden entre sí (ninguno está sellado todavía, así que no hay factura
fiscal afectada).

## F10 · Datos del productor del SIF: ¿se declaran a nombre de una persona física o de una sociedad?

**Para el asesor:** La declaración responsable del sistema de facturación (art. 13 RRSIF) exige el
nombre y NIF de quien "produce" el software. Hoy el código lleva un hueco (`[…]`). ¿Se declara a
nombre del fundador como autónomo, o hace falta una sociedad? **Relacionado con F3** — si el Convenio
017 exige sociedad mercantil, la respuesta a F3 puede resolver ésta también.
**Desbloquea:** S1-C / S1-E (la propia declaración responsable no se puede rellenar sin esto).
**Si no se contesta:** la declaración responsable sigue en borrador con placeholders.

## F11 · Tipo de rectificativa: ¿por diferencias o sustitutiva?

**Para el asesor:** Nuestras correcciones de factura (R1) llevan las líneas corregidas en negativo,
nunca reescriben la factura entera. ¿Eso encaja con el tipo "por diferencias" del catálogo oficial, o
con el tipo "sustitutivo" (que exige declarar base y cuota ya rectificadas)?
**Desbloquea:** S1-C.
**Si no se contesta:** sigue asumido "por diferencias" sin confirmar.

## F12 · Anticipos e IVA: ¿la señal cobrada antes de empezar es una factura de anticipo?

**Para el asesor:** Cuando el cliente paga una señal antes de que empiece el trabajo, ¿eso obliga a
una factura de anticipo con IVA en ese momento, y la factura final la descuenta? Hay un expediente
aparte con 10 preguntas más detalladas (con artículos y consultas de la DGT ya localizadas) en
`docs/legal/EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA.md` — la de mayor impacto ahí es si el sector
de oficios a domicilio entra en el umbral de factura simplificada de 3.000 € en vez del general de
400 €, porque cambia mucho la fricción de pedirle el NIF al cliente.
**Desbloquea:** define el comportamiento fiscal de todos los cobros parciales.
**Si no se contesta:** el comportamiento actual (factura al final, sin anticipo fiscal) sigue igual.

## F13 · Microcopy del aviso "este ticket no da derecho a deducir el IVA"

**Para el asesor:** Cuando un profesional registra un gasto con un ticket (no una factura), el
sistema detecta que le falta algo para poder deducir el IVA. Antes de decírselo, necesitamos
confirmar dos cosas: (1) ¿basta con que la factura del proveedor lleve el NIF del profesional y el
IVA desglosado para que sea deducible, o hace falta además el número de la factura del proveedor y su
NIF? (2) de tres frases candidatas — "Este ticket no permite deducir el IVA. Pide factura con tu
NIF.", una versión más larga con el motivo, o una tercera que evita la palabra "deducir" — ¿cuál no
dice nada incorrecto? Un ticket SÍ puede ser gasto deducible en IRPF aunque no lo sea a efectos de
IVA, así que "no te lo puedes deducir" a secas podría ser una afirmación excesiva.
**Desbloquea:** SCRUM-324 (el aviso hoy no se pinta con ningún texto, precisamente para no arriesgar
un texto incorrecto).
**Si no se contesta:** el aviso sigue sin aparecer al profesional.

## F14 · Los cinco avisos del Libro Registro sobre si el libro está completo

**Para el asesor:** Cinco avisos de la pantalla del Libro Registro (de 21 en total; los otros 16 ya
los aprobó Javier) quedaron pendientes porque afirman algo sobre si el libro está **completo o
fiable**, y eso es dictamen fiscal, no decisión de producto. Los cinco casos, cada uno solo aparece en
una situación de excepción medida (nunca en un libro que cuadra):
1. **El libro no cuadra** (se revisaron N facturas y no salió ningún asiento): ¿debe el producto
   AFIRMAR que no cuadra, o solo decir que no se pudo construir y remitir al asesor? La frase actual
   añade "no lo tomes como que no has facturado" — ¿se queda, se cambia o se retira? ¿debe este aviso
   impedir algo (descargar, presentar) o solo avisar?
2. **Importes que no se pudieron leer** en alguna factura: la frase actual promete "escríbenos y los
   revisamos" — ¿se mantiene esa promesa? ¿qué validez tiene el libro mientras haya importes sin leer?
3. **Facturas descartadas por no ser de este negocio**: esto debería ser imposible (significaría que
   la consulta trajo datos de otro obligado tributario). ¿Debe verlo el profesional, o es un fallo
   interno que solo debe avisarnos a nosotros?
4. **Facturas sin número** (no cuentan como asiento fiscal): ¿basta con decir cuántas son, o hay que
   decir también cuánto dinero suman?
5. **Albaranes firmados después de que la factura ya estaba sellada**: ¿qué significa fiscalmente?
   ¿es una anomalía a señalar como tal, o una situación normal (una segunda visita) que solo se
   informa?
**Desbloquea:** las 5 últimas ranuras de la pantalla del Libro Registro (16 de 21 ya aprobadas).
**Si no se contesta:** los cinco avisos siguen marcados `[PENDIENTE microcopy oficial]` en pantalla.

## F15 · Coste y plazo de la revisión fiscal externa — *logística, no pregunta legal*

**Para el asesor:** ¿Coste estimado y plazo para una revisión fiscal externa completa del sistema
(el máster presupuesta 300-600 €)? ¿Algún requisito previo para el alta en el entorno de pruebas de
la AEAT, además del certificado FNMT?
**Desbloquea:** presupuesto y calendario de S1-F.
**Nota:** esto no necesita dictamen legal, es logística de la propia cita — se puede preguntar al
concertarla, no hace falta tratarlo como bloqueo.

## F16 · Los datos del EMISOR en una factura rectificativa, cuando han cambiado desde la original

**Para el asesor:** Un autónomo emite en enero; en marzo cambia su domicilio fiscal (o constituye
una sociedad, o cambia de denominación); en octubre emite una rectificativa sobre la de enero.
(1) ¿Qué datos del expedidor deben figurar en la rectificativa: los de la fecha original o los
vigentes al rectificar? (2) ¿Cambia la respuesta si lo que cambió fue el NIF (p. ej. constituyó una
SL) frente a domicilio o denominación? Si la rectificativa lleva un NIF distinto al de la factura
que rectifica, ¿sigue siendo válida como rectificativa de aquella? (3) Al reimprimir una copia de la
factura original años después, ¿debe salir con los datos de expedidor de entonces? (4) ¿Hay
obligación de conservar el historial de datos identificativos del expedidor, más allá del dato que
figuró en cada factura? El programa ya congela los datos del emisor al emitir (SCRUM-665), y el
camino de la rectificativa se dejó sin decidir a propósito hasta esta respuesta.
**Desbloquea:** SCRUM-665, la ruta de emisión de rectificativas (R1).
**Si no se contesta:** una R1 sigue usando los datos vigentes del merchant al rectificar, no los de
la factura original.

---

# 2 · Asesor MERCANTIL / SOCIETARIO (contratos, consumo, estructura de empresa)

## M1 · Términos del SaaS: reparto de responsabilidad

**Para el asesor:** Necesitamos unos Términos de Servicio que dejen claro que el profesional
responde de que los datos de SUS facturas sean veraces, y YaQu responde de que el sistema (el SIF)
sea técnicamente conforme. ¿Es ésa la separación correcta, y qué cláusulas hacen falta para que se
sostenga?
**Desbloquea:** el bundle legal Y3 completo (Términos de Servicio).
**Si no se contesta:** seguimos sin Términos de Servicio publicados con esa cobertura.

## M2 · Condiciones económicas en los Términos de Servicio

**Para el asesor:** Necesitamos que los Términos de Servicio recojan correctamente: la suscripción,
la comisión del 0,9 % que se cobra solo cuando el cliente paga con tarjeta, la relación con Stripe
Connect como procesador, y la figura del profesional como "merchant of record" (quien legalmente
vende, no YaQu).
**Desbloquea:** el mismo bundle Y3.
**Si no se contesta:** igual que M1.

## M3 · Revisión del alcance legal de la oferta Founding

**Para el asesor:** Tenemos un borrador (`docs/legal/ALCANCE_BETA.md`) que le explica a cada cliente
Founding qué incluye la beta HOY y qué llegará después, incluida la cláusula sobre cuándo se activa
la facturación VeriFactu. Necesitamos que se revise antes de usarlo con ningún cliente, y en
concreto que se confirme que cobrar la suscripción Founding ANTES de tener la facturación fiscal
operativa es correcto tal como está planteado.
**Desbloquea:** poder cobrar a los primeros clientes Founding con alcance por escrito, en vez de con
una reserva sin cargo.
**⚠️ Relacionado con el censo de hoy (SCRUM-534h):** la cláusula de VeriFactu de ese borrador cita
literalmente "se activa al cerrar la certificación" — la misma frase que hoy se ha propuesto corregir
en el máster porque no existe una "certificación" de VeriFactu (es una declaración responsable). Si
el asesor revisa el borrador antes de que esa corrección esté firmada, puede estar revisando una
frase que ya sabemos que hay que cambiar — conviene decírselo al mandarlo.
**Si no se contesta:** los primeros Founding se cobran solo con reserva firmada sin cargo, opción
más conservadora ya prevista.

## M4 · Presupuesto adicional: ¿basta la firma digital que ya tenemos?

**Para el asesor:** Cuando en obra aparece trabajo que NO estaba en el presupuesto original, vamos a
generarle al cliente un presupuesto adicional que firma por WhatsApp — la misma firma digital que
usamos para el presupuesto inicial (el cliente firma con el dedo en su móvil, con sello de tiempo e
IP registrados). Para un cliente particular (consumidor), la ley exige que acepte por escrito los
trabajos añadidos que no estaban pactados. **¿Esa firma digital basta para acreditar esa aceptación
por escrito? Si no basta, ¿qué le falta?**
**Desbloquea:** SCRUM-290, y es la más urgente de este bloque — si la firma vale, el mecanismo ya
está construido y solo falta conectarlo.
**Si no se contesta:** no se construye nada de este flujo todavía.

## M5 · Presupuesto adicional: contenido mínimo y diferencias por tipo de cliente

**Para el asesor:** (1) ¿Qué tiene que llevar ese presupuesto adicional para que valga como
aceptación de trabajo nuevo — referenciar el presupuesto original, desglosar precio por unidad, decir
expresamente que el cliente puede rechazarlo, llevar plazo de validez? (2) Si el cliente es empresa o
autónomo en vez de consumidor particular, la ley permite una autorización verbal o tácita para cobrar
lo añadido — ¿aceptamos eso, o conviene exigir firma siempre por prudencia? (3) Si la línea nueva es
en realidad repetir algo que salió mal (no se puede cobrar aparte): ¿debe preguntárselo el sistema al
profesional, o es responsabilidad suya sin más?
**Desbloquea:** la microcopy y las reglas de SCRUM-290 (junto con M4).
**Nota:** el punto (3) puede decidirlo un jefe una vez estén M4 y M5(1) contestadas — es más una
elección de producto que una pregunta legal.
**Si no se contesta:** igual que M4.

---

# 3 · Asesor de PROTECCIÓN DE DATOS (RGPD)

## P1 · Baja de un profesional: qué se borra y qué se conserva

**Para el asesor:** Cuando un profesional pide que borremos sus datos (derecho de supresión, art. 17
RGPD) y ya le hemos emitido facturas, ¿qué hacemos con esas facturas y sus registros VeriFactu?
Tres opciones sobre la mesa: **(a)** conservar íntegro el rastro fiscal (facturas, registros
VeriFactu, log de auditoría) durante el plazo legal y borrar todo lo demás — nuestra lectura del
art. 17.3.b RGPD; **(b)** anonimizar los datos identificativos DENTRO de esos documentos — que
técnicamente rompería la huella encadenada de VeriFactu, así que si es ésta la respuesta necesitamos
que se diga sobre qué datos exactamente se puede aplicar; **(c)** borrado total, incluidas facturas y
registros fiscales. **Y el plazo de conservación: ¿4 años (prescripción tributaria) o 6 años (Código
de Comercio)?** La política de privacidad publicada dice 6; si es otro, hay que corregirla.
**Desbloquea:** SCRUM-244 (supresión + portabilidad) — el software ya sabe borrar un merchant entero,
pero no se activa sin esta respuesta porque hoy la lista de borrado incluye facturas.
**Si no se contesta:** ningún profesional puede ejercer su derecho de supresión todavía.

## P2 · El cliente final frente a sus propios datos ya congelados en una factura

**Para el asesor:** Para el PROFESIONAL que pide borrar su cuenta (ver P1), ya aplicamos el criterio
de conservar el rastro fiscal y anonimizar el resto. **¿Aplica el mismo criterio, con la misma base
legal, cuando quien pide el olvido es el CLIENTE FINAL sobre SUS PROPIOS datos** (nombre, NIF, email,
teléfono, ya congelados dentro de una factura emitida a nombre de OTRO — el profesional)? ¿Cambia el
análisis por ser el propio titular quien lo pide, y no un tercero? Si la respuesta es "se aplica
igual, se anonimiza la ficha viva y la factura se queda", ¿hay que decírselo al cliente en algún
texto oficial — por ejemplo al pie de la factura?
**Desbloquea:** cualquier flujo futuro de supresión para clientes finales (hoy no existe ninguno) y
la decisión pendiente sobre qué datos de clientes puede ver la gestoría del profesional.
**Si no se contesta:** ningún cliente final tiene hoy manera de ejercer este derecho.

## P3 · ¿Es suficiente el modelo de privacidad y cookies actual?

**Para el asesor:** Hoy solo usamos cookies técnicas de origen propio (sin rastreo de terceros) y un
banner mínimo. Hay un análisis con 6 preguntas concretas ya preparado en
`docs/legal/RGPD_TRATAMIENTO_DATOS.md` (reparto responsable/encargado entre YaQu y el profesional,
base jurídica de cada tratamiento, si hace falta un DPA con cada profesional, aviso de firma para el
cliente final, plazos de conservación, y si hace falta Registro de Actividades de Tratamiento).
**Urgente dentro de este bloque:** la política de privacidad que está publicada HOY en
`yaqu.app/privacidad` no cubre el IBAN/NIF/teléfono del profesional, la dirección del cliente final ni
la evidencia de firma — y nunca fue validada por un asesor pese a estar ya visible al público.
**Desbloquea:** que la política publicada sea correcta (hoy tiene un hueco activo) + el resto del
bundle Y3.
**Si no se contesta:** la política sigue publicada con ese hueco.

---

## Resumen de lo que NO se manda al asesor (puede decidirlo un jefe)

- **F15** (coste/plazo de la revisión externa): es logística de la cita, no una pregunta legal — se
  pregunta al concertarla.
- **M5, punto 3** (si el sistema debe preguntarle al profesional "¿esto es trabajo nuevo o reparar lo
  anterior?"): una vez resuelto el fondo legal de M4/M5, es elección de producto.
- **F2 / F10** (modelo de representación / entidad del productor): la elección estratégica ya la hizo
  Javier el 16-sep-2026 (colaborador social); lo que falta del asesor es solo CONFIRMAR que es viable
  y CÓMO se tramita — no elegir de nuevo entre las opciones.

## Contador — para que cuadre con `PREGUNTAS_ASESOR.md`

**16 preguntas fiscales** (F1-F16, dos de ellas agrupan varias sub-preguntas del original: F4 agrupa
las preguntas 14-24 de la sección F, y F14 agrupa las cinco del bloque 21; F16 es P18 del expediente,
añadida el 22-sep-2026) + **5 mercantiles** (M1-M5) + **3 de protección de datos** (P1-P3) = **24
preguntas de envío**, que cubren las ~40 preguntas y sub-preguntas numeradas del expediente original.
Los números no coinciden a propósito: el expediente original numera cada matiz técnico por separado;
este documento agrupa por la decisión legal real que hay debajo, que es lo que un asesor necesita ver
de una vez.
