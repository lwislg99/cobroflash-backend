# RGPD — Tratamientos de Datos, Bases Jurídicas, Encargados, Política de Privacidad y Aviso de Firma

> **BORRADOR — bundle Y3 del master** (`docs/YAQU_MASTER.md`, Parte Y3: *"privacidad + DPA +
> cookies + plazos de conservación"*). Redactado por Claude Code a partir del análisis de
> RGPD/LOPDGDD/eIDAS aplicado a los tratamientos reales de YaQu (schema + integraciones).
> **No es asesoramiento legal.** Cada sección marcada **[VALIDAR ASESOR]** es una
> interpretación razonada, no una certeza jurídica — el asesor debe confirmarla o
> corregirla antes de publicar nada nuevo. Complementa (no sustituye) `PREGUNTAS_ASESOR.md`
> punto 9, que se actualiza al final de este documento con las preguntas concretas que deja
> abiertas este análisis.
>
> **⚠️ Hallazgo importante:** ya existe una política de privacidad **publicada y en
> producción** en `public/privacidad.html` (`yaqu.app/privacidad`, última actualización
> 3-jun-2026), sin marca de borrador ni de revisión pendiente — a pesar de que
> `PREGUNTAS_ASESOR.md` (13-jun-2026) sigue listando "¿el modelo actual de privacidad+DPA es
> suficiente?" como pregunta ABIERTA. Es decir: hay una política live que nunca fue validada
> por el asesor, y que además **no cubría** varios tratamientos reales (IBAN/NIF/teléfono del
> profesional, dirección del servicio del cliente final, evidencia de firma con base eIDAS,
> transferencias internacionales, derecho a reclamar ante la AEPD).
>
> **✅ Decisión del fundador (23-jul-2026): publicar ya.** Razón: una política más completa
> pendiente de revisión del asesor protege mejor que una incompleta ya vigente. El texto de
> la sección 3 quedó **publicado en `public/privacidad.html`** en la rama `scrum-93-rgpd`; el
> asesor revisa después y se corrige si hace falta.

---

## 0. Perfil y marco normativo aplicado

- **Jurisdicción:** España. **Perfil de práctica:** SaaS B2B (YaQu vende a profesionales de
  oficios), con un tercero no-usuario en cada operación (el cliente final del profesional).
- **Normativa aplicada:** RGPD (Reglamento UE 2016/679) · LOPDGDD (LO 3/2018) · LSSI-CE
  (cookies/comunicaciones electrónicas comerciales) · Reglamento eIDAS (UE 910/2014) y
  Ley 6/2020 de servicios electrónicos de confianza (valor probatorio de la firma) ·
  Ley 58/2003 LGT y RD 1007/2023 RRSIF solo donde se cruzan con datos personales (fuera de
  alcance el resto, cubierto en `DECLARACION_RESPONSABLE.md` / `PACK_GESTORIA.md`).
- **Sin clientes de pago todavía** → no hay urgencia de "primer pagante" (Y3: *"antes del
  primer pagante: privacidad+DPA publicadas"*), pero **sí hay tratamiento de datos reales
  ahora mismo** (demo, founding, discovery) con una política insuficiente ya publicada. La
  urgencia es cerrar el gap, no el plazo del primer cobro.

## 1. La pieza clave: YaQu tiene DOS roles distintos según el dato

Esto condiciona todo lo demás (a, b, d) y **es lo primero que debe confirmar el asesor**:

| Rol de YaQu | Sobre qué datos | Por qué |
|---|---|---|
| **RESPONSABLE del tratamiento** | Datos del **profesional** como usuario de YaQu: nombre, NIF, email, teléfono, IBAN | YaQu decide fines y medios: gestionar la cuenta, facturar la suscripción SaaS, dar soporte |
| **ENCARGADO del tratamiento** (art. 28 RGPD) | Datos del **cliente final** del profesional: nombre, teléfono, email, dirección del servicio; y la evidencia de firma | El profesional decide a quién presupuesta y factura — YaQu solo trata esos datos **siguiendo sus instrucciones** (enviar el presupuesto, cobrar, guardar la firma) para prestarle el servicio |

**Consecuencia práctica:** frente al cliente final, el **responsable legal es el
profesional**, no YaQu — es él quien necesita base jurídica para tratar los datos de SU
cliente (normalmente 6.1.b, relación precontractual/contractual del presupuesto/trabajo) y
quien debe informarle. YaQu, como encargado, necesita: (1) un **contrato de encargado de
tratamiento (DPA) YaQu↔profesional** (art. 28.3 RGPD, contenido mínimo abajo), y (2) poner a
disposición del cliente final un aviso breve en la página de firma — aunque el
responsable formal sea el profesional, YaQu es quien opera esa página, así que es quien debe
mostrarlo. **[VALIDAR ASESOR: confirmar este reparto de roles — es la premisa de todo lo
demás; si el asesor prefiere modelar a YaQu como responsable único con "sub-encargo" en vez
de dos responsables + encargado, cambia el texto de (c) y (d).]**

## 2. (a)+(b) Tabla de tratamientos: base jurídica, responsable/encargado y encargados de tratamiento necesarios

| Dato | Titular | Responsable / Encargado | Base jurídica (RGPD art. 6) | Encargado de tratamiento (proveedor) | DPA/transferencia a verificar |
|---|---|---|---|---|---|
| Nombre, email, teléfono del profesional | Profesional | YaQu = **responsable** | 6.1.b (ejecución contrato SaaS) | — | — |
| NIF del profesional | Profesional | YaQu = **responsable** | 6.1.c (obligación legal — facturación mercantil de la suscripción) | — | — |
| IBAN del profesional | Profesional | YaQu = **responsable** | 6.1.b si es para domiciliar SU suscripción; 6.1.f (interés legítimo: mostrarlo a sus propios clientes como método de cobro) si es el IBAN que él enseña para que le paguen — **son dos usos distintos, aclarar cuál aplica hoy en el producto** | Stripe / entidad bancaria si aplica | — |
| Nombre, teléfono, email, dirección del servicio del cliente final | Cliente final | **YaQu = encargado**, profesional = responsable | La aplica el PROFESIONAL frente a su cliente (6.1.b, presupuesto/relación de servicio) — YaQu no tiene base propia, actúa por instrucción | — | Requiere **DPA YaQu↔profesional** (ver §4) |
| Timestamp, IP, user-agent, hash del documento firmado (`evidenciaFirma`, `LegalAcceptance`) | Cliente final / profesional | YaQu = **encargado** por cuenta del profesional, con interés legítimo propio de acreditar la operación | 6.1.f (interés legítimo — poder probar la aceptación ante una disputa) apoyado en eIDAS 910/2014 + Ley 6/2020 (valor probatorio de firma electrónica simple reforzada con evidencias) | — | Dato ya aislado por diseño: `schema.prisma` marca IP/UA como "NUNCA se exponen" fuera de este registro — mantenerlo así en la política |
| Mensajes WhatsApp (teléfono + contenido) | Cliente final / profesional | YaQu = encargado; **Meta = responsable independiente** para sus propios fines (política propia de Meta) | 6.1.b (envío es parte del servicio) | **Meta Platforms** (Irlanda/EE. UU.) | Transferencia internacional — SCC de Meta / marco vigente EU-US |
| Emails transaccionales | Destinatario | YaQu = responsable; Resend = encargado | 6.1.b | **Resend** | Verificar región de procesamiento (histórico: infra en EE. UU.) → SCC |
| Datos en reposo (BD + app) | Todos los anteriores | YaQu = responsable; Railway = encargado | — | **Railway** | Verificar región de datos (EU vs. US) y DPA de Railway |
| Prompts a IA para redactar presupuestos | Contenido introducido por el profesional (puede incluir datos del cliente final) | YaQu = responsable; Anthropic = encargado | 6.1.b | **Anthropic** | Confirmar en el DPA/ToS vigente de Anthropic que no se usa para entrenar modelos (la política actual ya lo afirma; falta el papel que lo respalde) |
| Pagos (tarjeta/Bizum/MP) | Profesional (merchant-of-record) / cliente final pagador | Stripe / Mercado Pago = responsables independientes de los datos de pago; YaQu no almacena tarjetas | — | **Stripe**, **Mercado Pago** | Ya cubierto parcialmente en `ALCANCE_BETA.md` / Y3 (Stripe Connect) |

**(b) Resumen — encargados de tratamiento que YaQu necesita tener formalizados:** Meta,
Resend, Railway, Anthropic, Stripe, Mercado Pago. La mayoría ofrecen un DPA estándar
aceptable vía sus propios términos (art. 28.3 se puede cumplir así), pero hoy **no hay
constancia guardada** de haberlos aceptado explícitamente ni de las cláusulas de
transferencia internacional que aplican a cada uno. Acción concreta: localizar el DPA
estándar de cada proveedor, aceptarlo formalmente (o descargar el ya vigente si se aceptó
al crear la cuenta) y anotar la fecha/versión en un registro simple (puede vivir en este
mismo documento, sección de control de versiones). **[VALIDAR ASESOR: si con esto basta o
si alguno (p. ej. Meta por volumen, o Anthropic por el contenido de los prompts) requiere
un DPA negociado aparte.]**

## 3. (c) Texto de la política de privacidad — reemplazo propuesto para `public/privacidad.html`

El texto actual (§ leído en `public/privacidad.html`) es correcto en tono y estructura pero
le faltan: IBAN/NIF/teléfono del profesional, dirección del servicio del cliente final,
mención de la evidencia de firma con su base eIDAS, base jurídica explícita por finalidad,
transferencias internacionales, derecho a reclamar ante la AEPD y plazos de conservación
concretos. Texto de reemplazo (mismo HTML/CSS del archivo actual, solo cambia el `<div
class="card">`):

```html
<div class="card">
  <h1>Política de Privacidad</h1>
  <p class="updated">Última actualización: [FECHA] · Versión [N]</p>

  <p>En <strong>YaQu</strong> (<a href="https://yaqu.app">yaqu.app</a>) tratamos datos personales
  con dos roles distintos según de quién sean los datos — lo explicamos a continuación porque
  cambia quién responde de qué.</p>

  <h2>1. Quiénes somos y qué rol tenemos</h2>
  <p><strong>YaQu es responsable del tratamiento</strong> de los datos de las personas
  profesionales que usan la plataforma (nombre, email, teléfono, NIF y, en su caso, IBAN).
  Para los datos de los <strong>clientes finales</strong> de cada profesional (las personas a
  las que él presupuesta y cobra), <strong>YaQu actúa como encargado del tratamiento</strong>:
  el responsable de esos datos es el propio profesional, que decide para qué los usa. Titular
  de YaQu: [RAZÓN SOCIAL/NOMBRE], NIF [NIF]. Contacto: <a href="mailto:hola@yaqu.app">hola@yaqu.app</a>.</p>

  <h2>2. Qué datos recogemos y con qué base legal</h2>
  <ul>
    <li><strong>Del profesional (cuenta):</strong> nombre, email, teléfono, NIF/CIF, dirección
    fiscal e IBAN — necesarios para prestarte el servicio y facturar tu suscripción
    (ejecución del contrato, art. 6.1.b RGPD) y para cumplir obligaciones mercantiles/fiscales
    de facturación (art. 6.1.c).</li>
    <li><strong>De tus clientes finales:</strong> nombre, teléfono, email y dirección del
    servicio que tú introduces para enviarles presupuestos, partes de trabajo y facturas. Los
    tratamos <strong>por tu cuenta y siguiendo tus instrucciones</strong>, como encargados del
    tratamiento — la base legal frente a ellos la aplicas tú, como responsable de esos datos.</li>
    <li><strong>Evidencia de firma:</strong> cuando un cliente final firma un presupuesto o
    parte de trabajo, registramos fecha y hora, dirección IP, navegador/dispositivo y una
    huella (hash) del documento firmado, con la única finalidad de poder acreditar esa
    aceptación si hubiera una disputa (interés legítimo, art. 6.1.f RGPD, conforme al
    Reglamento eIDAS y la Ley 6/2020 de servicios electrónicos de confianza). Esta evidencia
    nunca se muestra públicamente ni se incluye en el PDF del documento.</li>
    <li><strong>Datos de pago:</strong> procesados por Stripe/Mercado Pago; YaQu no almacena
    números de tarjeta.</li>
    <li><strong>Datos técnicos:</strong> IP, tipo de navegador y registros de actividad para
    seguridad y diagnóstico (interés legítimo, art. 6.1.f).</li>
  </ul>

  <h2>3. Para qué usamos los datos</h2>
  <ul>
    <li>Prestar el servicio: crear y enviar presupuestos, partes de trabajo, facturas y
    recordatorios de cobro.</li>
    <li>Enviar mensajes por WhatsApp a tus clientes en tu nombre y procesar sus respuestas.</li>
    <li>Recoger y acreditar firmas digitales de aceptación.</li>
    <li>Procesar cobros y tu suscripción.</li>
    <li>Enviar emails transaccionales (acceso, notificaciones, resúmenes).</li>
    <li>Seguridad, prevención de fraude y mejora de la plataforma.</li>
  </ul>

  <h2>4. WhatsApp y Meta</h2>
  <p>Usamos la <strong>WhatsApp Business Cloud API</strong> de Meta para enviar y recibir
  mensajes relacionados con tus presupuestos y cobros. El número de teléfono y el contenido
  del mensaje se procesan a través de la infraestructura de Meta, que actúa como responsable
  independiente para sus propios fines conforme a su propia política. Esto implica una
  <strong>transferencia internacional de datos</strong> (Meta Platforms, Irlanda/EE. UU.),
  amparada en las cláusulas contractuales tipo de Meta. Solo enviamos mensajes en el contexto
  de la relación comercial entre el profesional y su cliente.</p>

  <h2>5. Con quién compartimos los datos</h2>
  <p>Compartimos datos únicamente con proveedores que nos permiten operar el servicio,
  actuando como encargados del tratamiento bajo contrato (art. 28 RGPD):</p>
  <ul>
    <li><strong>Meta Platforms</strong> — mensajería WhatsApp (transferencia internacional).</li>
    <li><strong>Stripe</strong> y <strong>Mercado Pago</strong> — procesamiento de pagos.</li>
    <li><strong>Resend</strong> — envío de emails (transferencia internacional).</li>
    <li><strong>Railway</strong> — alojamiento de la aplicación y base de datos.</li>
    <li><strong>Anthropic</strong> — asistencia de IA para redactar presupuestos (sin uso de
    tus datos para entrenar modelos; transferencia internacional).</li>
  </ul>
  <p>No vendemos tus datos ni los de tus clientes a terceros.</p>

  <h2>6. Conservación</h2>
  <p>Conservamos los datos de tu cuenta mientras esté activa. Los datos de facturación se
  conservan el plazo exigido por la normativa mercantil y fiscal ([N] años tras el cierre del
  ejercicio — <strong>[VALIDAR ASESOR: plazo exacto]</strong>). La evidencia de firma se
  conserva mientras pueda ser relevante para acreditar la operación correspondiente. Puedes
  solicitar la eliminación de tu cuenta en cualquier momento, sin perjuicio de lo que debamos
  retener por obligación legal.</p>

  <h2>7. Tus derechos</h2>
  <p>Tienes derecho a acceder, rectificar, eliminar, limitar u oponerte al tratamiento de tus
  datos, así como a la portabilidad. Para ejercerlos escríbenos a
  <a href="mailto:hola@yaqu.app">hola@yaqu.app</a>. Si consideras que no hemos atendido tu
  solicitud correctamente, puedes reclamar ante la <strong>Agencia Española de Protección de
  Datos (AEPD)</strong>, <a href="https://www.aepd.es">www.aepd.es</a>.</p>
  <p>Si eres cliente final de un profesional que usa YaQu y quieres ejercer tus derechos sobre
  tus propios datos, dirígete primero a ese profesional (es el responsable de tus datos); si
  no obtienes respuesta, puedes escribirnos también a nosotros.</p>

  <h2>8. Seguridad</h2>
  <p>Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito, autenticación
  sin contraseña (enlaces mágicos), aislamiento multi-tenant de la información de cada cuenta,
  y acceso restringido a la evidencia de firma (IP/navegador nunca se exponen públicamente).</p>

  <h2>9. Cambios en esta política</h2>
  <p>Podemos actualizar esta política. Publicaremos cualquier cambio en esta misma página,
  indicando la fecha y versión.</p>

  <h2>10. Contacto</h2>
  <p>Para cualquier duda sobre privacidad: <a href="mailto:hola@yaqu.app">hola@yaqu.app</a>.</p>
</div>
```

**[VALIDAR ASESOR antes de publicar]:** plazo de conservación exacto (§6), y si el reparto
responsable/encargado del §1 es el que se quiere sostener frente a terceros. **No he tocado
`public/privacidad.html` todavía** — decide si lo publico ya (cierra el gap real hoy, sin
esperar al asesor) o si esperamos su validación primero.

## 4. Contrato de encargado de tratamiento (DPA) YaQu ↔ profesional — contenido mínimo

Falta por redactar como documento aparte (`docs/legal/DPA_PROFESIONAL.md`, propuesto). Debe
cubrir el contenido obligatorio del art. 28.3 RGPD:

1. **Objeto y duración** del encargo: mientras dure la suscripción del profesional.
2. **Naturaleza y finalidad** del tratamiento: prestar el servicio SaaS (presupuestos, firma,
   cobro, facturación) sobre los datos de los clientes finales del profesional.
3. **Tipo de datos y categorías de interesados:** nombre, teléfono, email, dirección del
   servicio de los clientes finales del profesional (personas físicas o autónomos).
4. **Obligaciones de YaQu como encargado:** tratar solo según instrucciones documentadas del
   profesional; confidencialidad del personal con acceso; medidas de seguridad (art. 32);
   sub-encargados autorizados = la lista del §2 de este documento (con deber de informar de
   cambios); asistir al profesional en el ejercicio de derechos de sus clientes; borrar o
   devolver los datos al finalizar la relación; poner a disposición la información necesaria
   para demostrar cumplimiento del art. 28.
5. **Derechos del profesional:** auditar/inspeccionar el cumplimiento.

Este DPA debería aceptarse en el propio alta del profesional (checkbox en el registro o en
`ALCANCE_BETA.md`/ToS), no como documento firmado aparte. **[VALIDAR ASESOR: mecanismo de
aceptación y si conviene incorporarlo directamente en los ToS del bundle Y3 en vez de como
documento independiente.]**

## 5. (d) Aviso corto — página pública de firma

Texto propuesto para mostrar en la página donde el cliente final firma (presupuesto o parte
de trabajo, `/presupuesto/:token` o `/albaran/:token`), como capa 1 de un aviso RGPD por
capas (breve + enlace a la política completa):

```
Al firmar, [NOMBRE DEL PROFESIONAL/RAZÓN SOCIAL] tratará tus datos (nombre, contacto y
dirección del servicio) para gestionar este presupuesto/trabajo y su cobro. También
registramos la fecha, hora, IP y navegador de esta firma para poder acreditarla si fuera
necesario. [NOMBRE DEL PROFESIONAL] es responsable de tus datos; YaQu los trata en su nombre
como proveedor tecnológico. Puedes ejercer tus derechos escribiendo a [CONTACTO DEL
PROFESIONAL] — más información en la política de privacidad completa (yaqu.app/privacidad).
```

**✅ Decidido (fundador, 23-jul-2026): aviso PASIVO, sin casilla de aceptación, sin
`LegalAcceptance` para esto.** Razón jurídica, no de comodidad: la base legal para captar
IP/user-agent en la firma es la ejecución del contrato + interés legítimo de poder acreditarla
(§2, §5 arriba) — **no es el consentimiento**. El consentimiento es revocable (art. 7.3 RGPD);
si se modelara con una casilla, se estaría implicando esa base, y una firma ya prestada no se
puede "des-probar" retroactivamente si el cliente retirase un consentimiento después — la
evidencia perdería su función. Un aviso pasivo (texto visible, sin acción de aceptar/rechazar)
es tanto más simple como más correcto para esta base jurídica. Coherente con
`docs/YAQU_MASTER.md` Parte S4, que ya fijaba "interés legítimo/relación precontractual
(cliente final, SOLO transaccional)" como base, no consentimiento.

Queda pendiente solo la parte de **producto**: insertar este texto dinámicamente (nombre/
contacto del profesional, `Merchant` ya tiene los campos) en la página pública de firma. Es
una tarea aparte con su propia rama según AA1.2, no un cambio de "solo texto" — no incluida en
`scrum-93-rgpd`.

## 6. (e) Registro de Actividades de Tratamiento (RAT/ROPA, art. 30 RGPD)

**Sí hace falta.** La excepción del art. 30.5 (empresas <250 empleados) exige además que el
tratamiento sea **ocasional**, sin categorías especiales de datos y sin riesgo para los
derechos de las personas — el tratamiento de YaQu es su actividad principal y recurrente
(no ocasional), así que la excepción no aplica en la práctica. Esto es también la posición
habitual de la AEPD. **[VALIDAR ASESOR — confirmación formal.]**

Hacen falta **dos registros** (art. 30.1 como responsable, art. 30.2 como encargado — son
más simples), cada uno debe contener como mínimo:

**Como responsable (datos del profesional):**
- Nombre y contacto del responsable (y del representante/DPO si lo hay — probablemente no es
  obligatorio nombrar un DPO al tamaño actual, **[VALIDAR ASESOR]**).
- Fines del tratamiento (gestión de cuenta, facturación de la suscripción).
- Categorías de interesados y de datos (profesionales: identificativos, fiscales, bancarios).
- Categorías de destinatarios (los encargados del §2).
- Transferencias internacionales y garantías aplicadas.
- Plazos previstos de supresión.
- Descripción general de las medidas de seguridad (art. 32).

**Como encargado (datos de los clientes finales, por cuenta de cada profesional):**
- Nombre y contacto de YaQu (encargado) y, por categorías, de los responsables (profesionales).
- Categorías de tratamientos realizados por cuenta de cada responsable.
- Transferencias internacionales y garantías.
- Descripción general de las medidas de seguridad.

Este registro es un documento vivo interno (no se publica), pero **sí debe poder mostrarse a
la AEPD si lo requiere**. Propuesta: mantenerlo como tabla en un nuevo
`docs/legal/REGISTRO_ACTIVIDADES_TRATAMIENTO.md`, derivado directamente de la tabla del §2 de
este documento — no requiere trabajo nuevo de análisis, solo transcribirlo al formato exigido
una vez el asesor valide el §2. No lo he creado todavía para no duplicar antes de la validación.

## 7. Qué es borrador y qué necesita validación profesional antes de publicar — resumen

| Pieza | Estado | Bloqueante para publicar |
|---|---|---|
| Reparto de roles responsable/encargado (§1) | Análisis razonado, no validado | **Sí** — premisa de todo lo demás |
| Tabla de bases jurídicas y encargados (§2) | Borrador | Sí, antes de firmar DPAs formales |
| Texto de política de privacidad (§3) | **✅ Publicado (23-jul-2026, decisión del fundador)** en `public/privacidad.html` | Revisión del asesor recomendable pero no bloqueante — el gap anterior (política live incompleta) era el riesgo mayor |
| DPA YaQu↔profesional (§4) | Solo esquema de contenido, falta redactar | Sí |
| Aviso corto página de firma (§5) | Texto borrador; **✅ mecanismo decidido: pasivo, sin `LegalAcceptance`** (23-jul-2026) | Falta implementarlo en la página de firma (tarea de producto aparte) |
| Registro de actividades (§6) | Pendiente de crear (derivable de §2) | Sí, una vez validado §2 |

---

## Preguntas nuevas para `PREGUNTAS_ASESOR.md` (punto 9, ampliado)

1. ¿Confirmas el reparto de roles del §1 (YaQu responsable para datos del profesional,
   encargado para datos del cliente final), o prefieres otro modelo (p. ej. responsable único
   con corresponsabilidad)?
2. Plazo de conservación exacto de: datos de facturación, evidencia de firma, y datos de
   cuenta tras baja del profesional (la política ya publicada usa 6 años/Código de Comercio
   como valor por defecto — confirmar o corregir).
3. ~~¿El aviso de firma debe ser pasivo o casilla de aceptación?~~ **Resuelto por el
   fundador (23-jul-2026): pasivo, base = ejecución del contrato + interés legítimo, no
   consentimiento** — confirmar que esta interpretación es correcta.
4. ¿Hace falta nombrar un Delegado de Protección de Datos (DPO) al tamaño/actividad actual?
5. Para las transferencias internacionales (Meta, Resend, Anthropic — todos con infraestructura
   parcial en EE. UU.): ¿los DPA estándar de cada proveedor son suficientes o hace falta algo
   adicional (SCC firmadas aparte, evaluación de impacto de transferencia)?
6. ¿Confirmas que el uso del IBAN del profesional (§2) es correcto tal y como está descrito, o
   hay un uso distinto en el producto que deba documentarse diferente?
7. **Baja del profesional: qué se borra y qué se conserva** — supresión (art. 17) frente a
   conservación fiscal, con el detalle de por qué anonimizar *dentro* de una factura rompería la
   huella encadenada de VeriFactu. **Redactada como pregunta cerrada (a/b/c + plazo) en
   `PREGUNTAS_ASESOR.md` §E, punto 13**; bloquea SCRUM-244. La pregunta 2 de esta lista (plazos
   de conservación) es su otra mitad: conviene responderlas juntas.

---
*Creado el 23-jul-2026 a partir del análisis de `prisma/schema.prisma`, `public/privacidad.html`,
`docs/YAQU_MASTER.md` (Parte Y3) y `docs/legal/PREGUNTAS_ASESOR.md`. Ninguna parte de este
documento debe tratarse como asesoramiento legal definitivo.*
