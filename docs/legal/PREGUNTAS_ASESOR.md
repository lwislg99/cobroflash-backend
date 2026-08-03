# ONE-PAGER — Preguntas para la cita con el asesor fiscal/legal

> Para llevar a la cita (bundle Y3 del master + decisiones nuevas de S1-C y S1-D).
> Objetivo: desbloquear SIF-1 y cerrar el alcance legal de la beta. Marca la respuesta
> al lado de cada punto; yo implemento según lo que traigas.

## A. Decisión que BLOQUEA S1-D (la más urgente para programar el envío a la AEAT)

1. **Modelo de representación ante la AEAT.** YaQu es un SaaS multi-tenant: cada
   profesional (merchant) es el obligado tributario. ¿Cómo remitimos sus registros?
   - (a) **Colaborador social**: YaQu remite con SU certificado en nombre de todos los
     merchants (apoderamiento). → Un solo certificado, gestión centralizada.
   - (b) **Certificado por merchant**: cada profesional aporta su certificado y YaQu
     remite "como representante". → Custodia de N certificados.
   - **Impacto técnico:** define cómo se autentica el cliente SOAP (mTLS) y dónde/cómo
     custodiamos el/los certificado(s). **Sin esta respuesta no se construye S1-D.**

## B. Las 3 nuevas de S1-C (estructura de los registros)

2. **Datos del PRODUCTOR del SIF** (van en cada registro y en la declaración responsable):
   nombre/razón social y NIF de quien "produce" YaQu. ¿Lo declaramos como
   **[tú autónomo]** o como **[una SL]**? (Hoy el código lleva placeholders.)
3. **NIF del cliente final.** El registro de factura completa (F1) exige identificar al
   destinatario con NIF. Nuestros clientes (particulares de oficios) muchas veces no lo
   dan. ¿Qué hacemos?
   - (a) Pedir y guardar el NIF del cliente al facturar (factura F1 siempre).
   - (b) Emitir **factura simplificada (F2)** cuando no hay NIF — recordar que el límite
     legal de la simplificada es **400 €** (¿suficiente para el ticket medio de obra?).
4. **Tipo de rectificativa.** Nuestras R1 (devoluciones/correcciones) llevan las líneas en
   negativo. ¿Confirmas **`TipoRectificativa = I` (por diferencias/incremental)** frente a
   `S` (sustitutiva, que exige declarar base+cuota rectificadas)?

## C. Bundle legal Y3 (lo que el master pide encargarte)

5. **Declaración responsable** del SIF (art. 13 RRSIF): nombre del SIF, versión,
   componentes, productor + NIF, fecha, conformidad. **Borrador ya redactado en
   `docs/legal/DECLARACION_RESPONSABLE.md`** — solo falta validar la cláusula de
   conformidad (C6), rellenar datos del productor (B2) y tu visto bueno. Es la S1-E,
   **versionada por release**.
6. **Términos del SaaS** con límites de responsabilidad: el merchant responde de la
   veracidad de los datos de sus facturas; YaQu, de la conformidad técnica del SIF.
7. **Condiciones económicas en los ToS**: suscripción, take rate 0,9 % en tarjeta,
   relación con Stripe Connect, figura de merchant-of-record del profesional.
8. **Anticipos / IVA (V3 del master)**: ¿la señal cobrada antes de empezar es
   **factura de anticipo con IVA**? ¿la factura final descuenta el anticipo? (Define el
   comportamiento fiscal de los cobros parciales.) **Expediente completo (10 preguntas P1-P10,
   anticipos + factura recapitulativa, con articulado y consultas DGT localizadas) en
   `docs/legal/EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA.md`** — la de mayor impacto es P6:
   si el vertical de oficios a domicilio de YaQu encaja en el umbral de factura simplificada
   de 3.000 € (art. 4.1 RD 1619/2012) en vez del general de 400 €, cambia mucho la fricción
   de pedir NIF al cliente final.
9. **Privacidad + DPA + cookies**: ¿el modelo actual (solo cookies técnicas first-party,
   banner mínimo) es suficiente? + plazos de conservación de datos (S4). **Análisis detallado
   y 6 preguntas concretas ya en `docs/legal/RGPD_TRATAMIENTO_DATOS.md`** (reparto
   responsable/encargado YaQu↔profesional, base jurídica por tratamiento, DPA con cada
   profesional, aviso de firma para el cliente final, y si hace falta Registro de
   Actividades de Tratamiento — sí, según ese análisis). **Urgente:** la política publicada
   hoy en `yaqu.app/privacidad` no cubre IBAN/NIF/teléfono del profesional, dirección del
   cliente final, ni la evidencia de firma — nunca fue validada por ti pese a estar live.
10. **Alcance Founding** (`docs/legal/ALCANCE_BETA.md`): revisa el borrador, sobre todo la
    cláusula de "VERI*FACTU se activa al cerrar la certificación, sin cambio de precio" y
    que cobrar la beta antes de tener facturación fiscal sea correcto.

## D. Calendario / coste

11. Revisión fiscal externa (S1-F): coste estimado y plazo (el master presupuesta 300-600 €).
12. ¿Algún requisito previo para darnos de alta en el **entorno de pruebas de la AEAT**
    (además del certificado FNMT)?

## E. Baja de un profesional: qué se borra y qué se conserva (bloquea SCRUM-244)

> Añadido el 3-ago-2026. **Es la pregunta más cerrada de esta hoja: basta con marcar (a), (b) o
> (c) y el plazo.** Todo lo demás es contexto para que no tengas que reconstruirlo.

13. **Cuando un profesional ejerce el derecho de supresión (RGPD art. 17) y hemos emitido
    facturas suyas, ¿qué hacemos con esas facturas, con sus registros VeriFactu y con el
    registro de auditoría?**

    - **(a) Conservar íntegro el rastro fiscal** —facturas emitidas, sus registros VeriFactu y
      el `AuditLog`— durante el plazo legal de conservación, y borrar **todo lo demás** (cuenta,
      clientes, presupuestos, trabajos, mensajes, adjuntos). Amparo: **art. 17.3.b RGPD**, que
      excluye del derecho de supresión los datos necesarios para cumplir una obligación legal.
    - **(b) Anonimizar los datos identificativos dentro de esos documentos** conservando el
      asiento. ⚠️ **Necesitamos que valores esto sabiendo lo que cuesta técnicamente**, porque no
      es un `UPDATE` inocuo: ver el recuadro de abajo.
    - **(c) Borrado total**, incluidas facturas y registros fiscales.

    **Y la pregunta de plazo, que es la que hace ejecutable la respuesta:** ¿**4 años**
    (prescripción tributaria, art. 66 LGT) o **6 años** (art. 30 Código de Comercio)? La política
    de privacidad ya publicada dice **6 años**; si es otro, hay que corregirla.

    > **⚠️ Por qué (b) no es "simplemente anonimizar": rompería la prueba.** Nuestras facturas
    > llevan una **huella encadenada** (VeriFactu): cada registro incorpora la huella del
    > anterior, y esa huella se calcula **sobre el contenido de la factura**. Cambiar un dato
    > dentro de una factura ya emitida deja la huella almacenada sin corresponder con el
    > contenido, y **recalcularla rompe la cadena de todas las posteriores**. Es también lo que
    > prohíbe nuestra regla interna nº 29 (*una factura emitida jamás se edita ni se borra*:
    > corrección = rectificativa R1, nunca edición). O sea que (b), aplicada **dentro** de la
    > factura, destruiría justo el valor probatorio que la conservación busca. Si aun así (b) es
    > tu criterio, necesitamos que nos digas **sobre qué datos exactamente** se puede aplicar
    > (¿solo los de la ficha de cliente fuera de la factura? ¿los de contacto?) y **cuáles no se
    > tocan nunca**.

    **Contexto de por qué preguntamos y no decidimos:** las dos obligaciones apuntan en
    direcciones opuestas —suprimir datos personales frente a conservar el registro de
    facturación— y el software ya sabe borrar un merchant entero (está construido y probado). Lo
    que **no** vamos a hacer es exponer ese borrado antes de tener tu respuesta: hoy la lista de
    borrado incluye facturas y `AuditLog`, así que darle un botón sería incumplir por el otro
    lado. **Sin esta respuesta, SCRUM-244 no se construye.**

    **Un apunte que quizá cambie tu respuesta:** el profesional **no es un tercero** en sus
    facturas — su nombre y su NIF son parte del documento fiscal como emisor. Conservar la
    factura implica conservar su identidad; no hay versión de la factura sin él.

---
*Generado el 13-jun-2026. Cuando vuelvas con respuestas: B y C desbloquean S1-C/S1-E,
A desbloquea S1-D, **E desbloquea SCRUM-244 (supresión + portabilidad)**. Estado vivo en
`docs/PENDIENTES_FUNDADOR.md`.*
