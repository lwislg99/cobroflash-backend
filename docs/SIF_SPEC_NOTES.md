# SIF_SPEC_NOTES — Investigación técnica VERI*FACTU (S1-0b)

> Entregable de **S1-0b** (master U1.3). Investigado el 12-jun-2026 sobre fuentes AEAT.
> Lo marcado **[VALIDAR]** viene de fuente secundaria o requiere confirmación contra el
> XSD/entorno de pruebas en S1-D. Audita lo ya construido contra esto en **S1-A**.

## 1. Decisión principal: NO necesitamos XAdES (ni microservicio Java/.NET)

**En modalidad VERI*FACTU (remisión inmediata — la nuestra, S1-B) NO se exige firma
electrónica de los registros de facturación**: la huella SHA-256 encadenada + la remisión
autenticada con certificado cualificado cumplen el requisito. La firma **XAdES Enveloped**
solo es obligatoria en sistemas **NO** VERI*FACTU (modo local), que además llevan registro
de eventos (`EventosSIF.xsd`).

→ **Arquitectura confirmada: 100 % Node, sin dependencias de firma.** La "excepción
justificada" del master (microservicio solo-firma) NO hace falta. Fuente: FAQ oficial AEAT
"Firma" (sede.agenciatributaria.gob.es → SIF/VERI*FACTU → FAQ → Firma).

## 2. Servicio web AEAT

- **Protocolo:** SOAP 1.1 modo *document*, HTTPS, respuestas **síncronas**.
- **WSDL:** `SistemaFacturacion.wsdl`
  (`https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl`)
- **Operaciones:**
  - `RegFactuSistemaFacturacion` — remisión de registros (alta, anulación y subsanación
    van DENTRO del cuerpo `SuministroLR`).
  - `ConsultaFactuSistemaFacturacion` — consulta de registros ya remitidos.
- **XSD** (espejo en repo github.com/hectorsipe/aeat-verifactu): `SuministroInformacion.xsd`
  (tipos comunes), `SuministroLR.xsd` (envío), `RespuestaSuministro.xsd`, `ConsultaLR.xsd`,
  `RespuestaConsultaLR.xsd`, `EventosSIF.xsd` (solo modo no-VERI*FACTU), `xmldsig-core-schema.xsd`.

### Endpoints
| Entorno | Certificado estándar | Certificado de sello |
|---|---|---|
| **Pruebas** | `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` | `https://prewww10.aeat.es/.../VerifactuSOAP` |
| **Producción** | `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` | `https://www10.agenciatributaria.gob.es/.../VerifactuSOAP` |

(Existe también el endpoint `RequerimientoSOAP` para sistemas no-VERI*FACTU — no nos aplica.)

## 3. Autenticación

- **mTLS con certificado electrónico cualificado** (FNMT del obligado/representante, o
  **colaborador social** — relevante: YaQu remite COMO colaborador o con certificado del
  merchant **[VALIDAR con asesor en S1-F: modelo de representación]**).
- En Node: nativo — `https.Agent({ cert, key })` (PEM) o `{ pfx, passphrase }`. Sin librerías.

## 4. Reglas operativas del envío

- **Máx 1.000 registros por envío.**
- **Flujo de control:** cada `RespuestaSuministro` trae `TiempoEsperaEnvio` (mínimo 60 s);
  el SIF DEBE esperar ese tiempo antes del siguiente envío. La cola `VfSubmission` del
  master debe persistir/respetar este valor.
- **Sin respuesta = reenviar:** si no llega respuesta, se reenvían los mismos registros
  hasta obtenerla (FAQ oficial) → idempotencia del lado AEAT por id de registro.
- **Plazo de remisión:** la generación y remisión deben ser inmediatas; **[VALIDAR]**
  tolerancia ~240 s desde la generación (fuente secundaria; si se supera → registro
  "AceptadoConErrores"). Diseñar el cron de la cola con periodo ≤60 s en activo.
- **Estados** (`RespuestaSuministro`): global `EstadoEnvio` = Correcto ·
  ParcialmenteCorrecto · Incorrecto; por registro `EstadoRegistro` = Correcto ·
  AceptadoConErrores · Incorrecto + código/descripción de error.
- **Subsanación:** los registros rechazados se reenvían con el indicador de subsanación
  del XSD (`Subsanacion`/`RechazoPrevio` en `SuministroLR` **[VALIDAR nombres exactos
  contra el XSD en S1-D]**). Mapea limpio a nuestra FSM `VfSubmission`
  (`rejected → pending(retry)`).

## 5. Contenido del registro de alta (lo que audita S1-A)

Campos de la Orden HAC/1177/2024 ya implementados en `verifactu.service.ts` (huella:
NIF, número y fecha de factura, tipo, cuota, importe total, huella anterior, fecha-hora);
**S1-A debe comparar campo a campo, orden y formato** contra `SuministroInformacion.xsd`
(p. ej. `IDEmisorFactura`, `NumSerieFactura`, `FechaExpedicionFactura`, `TipoFactura` F1/R1,
`CuotaTotal`, `ImporteTotal`, `Huella`, `TipoHuella=01`, `FechaHoraHusoGenRegistro`) y la
URL del QR de cotejo (`https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?...`
ya implementada). Diff spec↔código → `docs/AUDITORIA_RRSIF.md`.

## 6. Stack elegido para `src/modules/fiscal/verifactu/sif.client.ts` (S1-D)

- **HTTP:** `https` nativo de Node con agente mTLS (cert del merchant/colaborador en env
  o storage cifrado **[decisión de custodia con el asesor]**).
- **SOAP:** plantillas XML propias (solo 2 operaciones; escapado con `esc()` ya existente).
  **Descartado** `node-soap` (pesado, parsea WSDL en runtime, sin valor para 2 llamadas).
- **Parseo de respuesta:** `fast-xml-parser` (pequeño, puro JS) — única dependencia nueva.
- **Validación XSD:** en CI/tests con los XSD del repo espejo (script con `xmllint` donde
  exista o validación estructural propia); la validación REAL la da el entorno de pruebas
  (S1-D exige ≥10 registros alta/anulación/R1 aceptados consecutivos).
- **Cola:** tabla `VfSubmission {invoiceId,status,attempts,lastError}` + `tiempoEspera`
  persistido; FSM de la Parte L (`pending→sent→accepted | sent→rejected→pending(retry)`,
  `attempts≥5 → manual_review`).

## 7. Bloqueado por el fundador (PENDIENTES_FUNDADOR)

- S1-0: certificado FNMT + alta/acceso al entorno de pruebas + cita asesor (bundle Y3).
- Decisión de representación (¿colaborador social vs certificado por merchant?) — asesor.

## Fuentes

- WSDL oficial: prewww2.aeat.es (...)/SistemaFacturacion.wsdl (endpoints y operaciones).
- Sede AEAT — SIF/VERI*FACTU: descripción del servicio web (`Veri-Factu_Descripcion_SWeb.pdf`),
  FAQ "Firma", FAQ "Sistemas VERI*FACTU" (rev. 5-dic-2025).
- Espejo XSD/WSDL: github.com/hectorsipe/aeat-verifactu.
- Flujo de control/240 s **[VALIDAR]**: billtonic.com (secundaria).
