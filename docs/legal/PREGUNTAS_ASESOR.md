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
   comportamiento fiscal de los cobros parciales.)
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

---
*Generado el 13-jun-2026. Cuando vuelvas con respuestas: B y C desbloquean S1-C/S1-E,
A desbloquea S1-D. Estado vivo en `docs/PENDIENTES_FUNDADOR.md`.*
