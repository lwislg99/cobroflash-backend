# AUDITORÍA RRSIF — diff spec ↔ código (S1-A)

> Entregable de **S1-A** (master U1.3): conformidad de lo YA construido contra la Orden
> HAC/1177/2024 y los docs técnicos AEAT (especificaciones de huella y de QR).
> Ejecutada el 12-jun-2026. Regla aplicada: **"si no casa → se regenera"** — las no
> conformidades de huella y leyenda se corrigieron en el MISMO commit de esta auditoría.

## 1. Huella SHA-256 (`computeVeriFactuHash`)

| Aspecto (spec AEAT) | Antes | Veredicto | Ahora |
|---|---|---|---|
| Cadena `campo=valor` unida por `&` con nombres (`IDEmisorFactura=…&NumSerieFactura=…`) | valores unidos por `\|`, sin nombres | ❌ | ✅ regenerado al formato oficial |
| `Huella=` **VACÍA** en el primer registro del emisor | `'0'` | ❌ | ✅ `''` |
| `FechaHoraHusoGenRegistro` ISO 8601 **con huso** (`2024-01-01T19:20:30+01:00`) | `DD-MM-YYYY HH:MM:SS` local sin huso | ❌ | ✅ `formatFechaHoraHuso()` |
| Valores con trim (sin espacios en extremos) | sin trim | ⚠️ | ✅ trim |
| SHA-256 sobre UTF-8 → 64 hex MAYÚSCULAS | igual | ✅ | ✅ |
| `FechaExpedicionFactura` en `dd-mm-aaaa` | igual | ✅ | ✅ |
| `CuotaTotal`/`ImporteTotal` punto decimal, 2 decimales | igual | ✅ | ✅ |
| `TipoFactura` del catálogo AEAT (F1/R1) | igual | ✅ | ✅ |

**Prueba de conformidad:** el **vector oficial del documento AEAT** de especificaciones
de huella (cadena de ejemplo con NIF `89890001K` → `3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60`)
pasa en `tests/verifactu.test.mjs` — la implementación reproduce el ejemplo oficial bit a bit.

**Cadena histórica:** las huellas calculadas ANTES de esta corrección (solo facturas del
merchant demo) quedan como histórico no conforme; **no se remitirán nunca a la AEAT**
(la remisión empieza post-SIF con `SIF_ENABLED` y solo para registros nuevos). La cadena
conforme empieza con la primera factura posterior a este commit. El export XML maneja
ambos convenios de primer registro (`''` y el viejo `'0'`).

## 2. URL del QR de cotejo (`buildVeriFactuQrUrl`)

| Aspecto | Estado |
|---|---|
| Base de PRODUCCIÓN `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR` | ✅ conforme |
| Parámetros `nif`, `numserie`, `fecha` (dd-mm-aaaa), `importe` URL-encoded | ✅ conforme (test) |
| QR ISO/IEC 18004, lado 30-40 mm | ✅ el PDF lo pinta a 90 pt ≈ 31,75 mm |
| ⚠️ Entorno de PRUEBAS: el QR de cotejo en pruebas usa base `prewww2.aeat.es` | pendiente S1-D (parametrizar base por entorno al activar pruebas) |

## 3. Leyenda en la factura

- Spec: la factura de un sistema VERI*FACTU debe llevar la leyenda literal
  **«Factura verificable en la sede electrónica de la AEAT»** o **«VERI*FACTU»**.
- Antes: "Factura Verificable — VeriFactu" (no literal) → ❌.
- Ahora: ✅ leyenda exacta junto al QR + "VERI*FACTU" en la línea de apoyo.

## 4. Export XML RRSIF (`/admin/exports/verifactu.xml`) — hallazgos para S1-C

El export actual (pack inspección R13) está CERCA de `SuministroLR.xsd` pero NO es aún el
payload de remisión. Para S1-C/S1-D:

1. **`FechaHoraHusoGenRegistro` incoherente:** el export emite `invoice.createdAt.toISOString()`
   (UTC, momento de la factura), pero la huella usa el momento de GENERACIÓN del registro
   con huso. **Acción S1-C:** persistir el timestamp exacto usado en la huella (columna
   aditiva `invoices.vf_timestamp`) y emitirlo en XML; sin esto la huella no es verificable
   por terceros.
2. **`Encadenamiento/RegistroAnterior`:** el XSD exige IDEmisorFactura + NumSerieFactura +
   FechaExpedicionFactura + Huella del registro anterior; hoy solo emitimos `Huella`.
3. **`SistemaInformatico` incompleto:** faltan NombreRazon/NIF del productor,
   `IdSistemaInformatico`, `Version`, `NumeroInstalacion`,
   `TipoUsoPosibleSoloVerifactu/MultiOT/IndicadorMultiplesOT` (ligado a la declaración
   responsable S1-E).
4. **Registros de ANULACIÓN:** no implementados (solo alta). S1-C los añade
   (`RegistroFacturacionAnulacion`, con su propia huella).
5. Validar todo contra los XSD del espejo (github.com/hectorsipe/aeat-verifactu) antes
   del entorno de pruebas.

## 5. Otras notas

- `applyVeriFactu` toma como "anterior" la última factura con huella por `createdAt` —
  con la cola S1-D conviene encadenar por el registro REALMENTE último generado
  (orden de generación de registros, no de facturas). Revisar en S1-D.
- El guard V0-0 (justificantes jamás entran en la cadena) es conforme: los J- no son
  facturas y no generan registro.

**Resultado S1-A: huella, QR y leyenda CONFORMES tras regeneración (test oficial en verde).
Los puntos 4.1-4.5 quedan asignados a S1-C/S1-D.**
