# Declaración Responsable del Sistema Informático de Facturación

> **PLANTILLA — S1-E (master U1.3).** Borrador con placeholders `[…]` y marcas
> **[VALIDAR ASESOR]**. **NO publicar ni entregar a merchants hasta:** (1) SIF-1 8/8 ✅,
> (2) revisión del asesor fiscal (S1-F), (3) datos reales del productor rellenados.
> Documento exigido por el **art. 13 del RD 1007/2023 (RRSIF)** — el productor declara
> que el sistema cumple el art. 29.2.j) de la Ley 58/2003 (LGT), el RRSIF y la Orden
> HAC/1177/2024. **Versionada por release**: cada versión publicada del SIF lleva la suya;
> el productor conserva todas las versiones (art. 13 RRSIF).
>
> Cumplimentar todos los `[…]` antes de firmar. Los valores del sistema DEBEN coincidir
> con el bloque `SistemaInformatico` que YaQu remite en cada registro de facturación
> (ver `src/modules/fiscal/verifactu/registro.builder.ts`).

---

## DECLARACIÓN RESPONSABLE

(conforme al artículo 13 del Real Decreto 1007/2023, de 5 de diciembre)

### 1. Productor del sistema informático

- **Nombre / Razón social:** `[NOMBRE O RAZÓN SOCIAL DEL PRODUCTOR]` **[VALIDAR ASESOR: autónomo vs SL]**
- **NIF:** `[NIF DEL PRODUCTOR]`
- **Domicilio:** `[DOMICILIO COMPLETO]`
- **Datos de contacto:** `[EMAIL]` · `[TELÉFONO]` · `[WEB: https://yaqu.app]`

### 2. Identificación del sistema informático

- **Nombre comercial del sistema:** YaQu
- **Nombre del sistema informático (`NombreSistemaInformatico`):** YaQu
- **Identificador del sistema (`IdSistemaInformatico`):** `[ID 2 CARACTERES, ej. 01]`
- **Versión a la que se refiere esta declaración (`Version`):** `[VERSIÓN, ej. 1.0.0]`
- **Número de instalación (`NumeroInstalacion`):** `[ID INSTALACIÓN — SaaS: 1]`
- **Fecha de puesta a disposición de esta versión:** `[FECHA]`

### 3. Tipología, composición y funcionalidades

- **Tipología:** sistema informático de facturación en modalidad **VERI*FACTU**
  (remisión de los registros de facturación a la AEAT). **No** opera en modo "no
  verificable".
- **Modalidad de uso** (coherente con los registros remitidos):
  - `TipoUsoPosibleSoloVerifactu`: **Sí** — el sistema solo opera en modalidad VERI*FACTU.
  - `TipoUsoPosibleMultiOT`: `[Sí/No]` **[VALIDAR: SaaS multi-tenant → Sí]**
  - `IndicadorMultiplesOT`: `[Sí/No]`
- **Composición / arquitectura:** aplicación web SaaS alojada en `[INFRAESTRUCTURA, ej.
  Railway]`; backend Node.js; base de datos PostgreSQL. Generación de los registros de
  facturación de **alta**, **rectificativa (R1)** y **anulación** con huella **SHA-256
  encadenada** (art. 12 RRSIF) y remisión telemática al servicio web de la AEAT.
- **Funcionalidades relevantes a efectos del Reglamento:**
  - Registro de facturación de alta por cada factura emitida, con huella y encadenamiento.
  - Registro de anulación y factura rectificativa (R1) con su propio registro y huella.
  - Remisión inmediata a la AEAT (modalidad VERI*FACTU), con control de flujo.
  - Código QR de cotejo y leyenda "Factura verificable en la sede electrónica de la AEAT"
    en cada factura.
  - Conservación e inalterabilidad de los registros; trazabilidad.
- **Características de la instalación:** software como servicio (SaaS) multi-cliente; el
  obligado tributario accede mediante navegador; sin instalación local en el equipo del
  usuario. **[VALIDAR ASESOR: descripción de instalación para SaaS]**

### 4. Declaración de conformidad

`[NOMBRE/RAZÓN SOCIAL DEL PRODUCTOR]`, con NIF `[NIF]`, en calidad de **productor** del
sistema informático identificado en el apartado 2, **DECLARA BAJO SU RESPONSABILIDAD** que
dicho sistema, en la versión indicada, **cumple** con:

- el artículo **29.2.j) de la Ley 58/2003**, de 17 de diciembre, General Tributaria;
- el **Reglamento aprobado por el RD 1007/2023** (RRSIF); y
- las especificaciones técnicas aprobadas por la **Orden HAC/1177/2024** y normativa de
  desarrollo.

**[VALIDAR ASESOR: redacción literal de la cláusula de conformidad y eventuales
limitaciones de responsabilidad coherentes con los ToS — pregunta C6 del one-pager.]**

### 5. Disponibilidad de la declaración

Conforme al art. 13 RRSIF, esta declaración se mostrará **de modo visible en el propio
sistema** (en cada versión) y se pondrá a disposición del **cliente** (cada merchant) y, en
su caso, del comercializador, así como de la Administración tributaria cuando la requiera.
El productor **conserva** las declaraciones de todas las versiones.

> **Pendiente de implementación (post 8/8):** publicar esta declaración en la UI de YaQu
> (p. ej. `yaqu.app/legal/declaracion-responsable`, versionada) y enlace de descarga desde
> la Configuración de cada merchant. Hasta entonces, este documento es solo borrador interno.

### 6. Lugar, fecha y firma

En `[LUGAR]`, a `[FECHA]`.

Firma del productor / representante legal: ______________________________

`[NOMBRE Y CARGO DEL FIRMANTE]`

---

## Control de versiones de esta declaración

| Versión SIF | Fecha | Cambios relevantes | Estado |
|---|---|---|---|
| `[1.0.0]` | `[FECHA]` | Versión inicial (modalidad VERI*FACTU) | **BORRADOR — no publicada** |

*Plantilla creada el 13-jun-2026 (S1-E). Fuente: art. 13 RD 1007/2023; FAQ AEAT
"Certificación de los sistemas informáticos: declaración responsable". Preguntas abiertas
al asesor en `docs/legal/PREGUNTAS_ASESOR.md` (C5, C6 y datos del productor B2).*
