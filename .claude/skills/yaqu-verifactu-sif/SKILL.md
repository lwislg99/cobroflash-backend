---
name: yaqu-verifactu-sif
description: Obligatoria al tocar CUALQUIER cosa de VeriFactu/SIF (huella, QR, registros, cola VfSubmission, envío AEAT, R1/anulación). Impone la spec de docs/SIF_SPEC_NOTES.md, la modalidad VERI*FACTU del master (S1-B) y las reglas fiscales duras (reglas 7, 17, 29).
---

# yaqu-verifactu-sif — Guardarraíles del SIF

> Derivada del master U1.3 (SIF-1 v2) + `docs/SIF_SPEC_NOTES.md` (S1-0b). Si chocan,
> gana el master. Creada en S1-0b (12-jun-2026).

## Antes de tocar código SIF (obligatorio)

1. Leer `docs/SIF_SPEC_NOTES.md` (endpoints, XSD, flujo de control, decisión sin-XAdES).
2. Leer U1.3 del master: las 8 obligatorias S1-A..S1-H y su orden.
3. Si existe, leer `docs/AUDITORIA_RRSIF.md` (diff spec↔código de S1-A).

## Reglas duras

- **Modalidad VERI*FACTU (remisión) — S1-B.** NO implementar firma XAdES ni registro de
  eventos (`EventosSIF`): son del modo no-VERI*FACTU. Permanencia en la modalidad el año natural.
- **Una factura emitida JAMÁS se edita ni borra** (regla 29): corrección = R1 vinculada;
  duplicado = anulación CON su registro. El código nunca ofrece editar/borrar emitidas.
- **Huella encadenada intocable:** cualquier cambio en el cálculo (campos, orden, formato)
  exige re-validar contra `SuministroInformacion.xsd` y la Orden HAC/1177/2024, y NUNCA
  rompe la cadena de huellas ya persistida.
- **Flujo de control AEAT:** respetar `TiempoEsperaEnvio` de cada respuesta (mín. 60 s);
  máx 1.000 registros/envío; sin respuesta → reenviar los mismos registros.
- **FSM `VfSubmission` (Parte L):** `pending → sent → accepted` · `sent → rejected(error)
  → pending(retry, attempts++)` · `attempts≥5 → manual_review`. `accepted` es terminal.
- **`SIF_ENABLED` off = seguro:** la cola pausa, la emisión local sigue; al reanudar se
  remite lo pendiente. Jamás bloquear la emisión por un fallo de remisión (runbook R7).
- **Cero claims** hasta SIF-1 8/8 (regla 7): nada de "VeriFactu" en UI/copy de venta;
  la pregunta del cliente se responde SOLO con el guion H2.
- **Stop conditions AA1.4:** envío a PRODUCCIÓN AEAT, declaración responsable (S1-E) y
  todo lo legal/fiscal de cara al público → OK del fundador SIEMPRE.

## Stack (decidido en S1-0b — no re-litigar sin cambio de master)

- mTLS nativo de Node (`https.Agent` con cert/pfx) contra
  `prewww1.aeat.es/.../VerifactuSOAP` (pruebas) y `www1.agenciatributaria.gob.es/...` (prod).
- SOAP 1.1 document con plantillas XML propias; respuesta con `fast-xml-parser`.
- Sin `node-soap`, sin librerías de firma.

## QA mínimo por cambio (alimenta QA_MASTER §7)

- [ ] Registros alta/anulación/R1 validan contra los XSD del espejo.
- [ ] Rechazo forzado → retry con backoff → `manual_review` al 5º intento.
- [ ] `SIF_ENABLED=off` no rompe la emisión local.
- [ ] Evidencias de pruebas AEAT → `docs/VERIFACTU_EVIDENCIAS.md`.
