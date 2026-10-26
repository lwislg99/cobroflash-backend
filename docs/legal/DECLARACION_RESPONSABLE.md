# Declaración Responsable del Sistema Informático de Facturación

> 🔴 **BORRADOR SIN FIRMA.** Es un texto legal propuesto por una sesión (J4, SCRUM-523c); lo
> firman los fundadores (regla 39) y nada de lo que dice vale hasta entonces.
>
> **PLANTILLA — S1-E (master U1.3).** Borrador con placeholders `[…]` y marcas
> **[VALIDAR ASESOR]**. **NO publicar ni entregar a merchants hasta:** (1) SIF-1 8/8 ✅,
> (2) revisión del asesor fiscal (S1-F), (3) datos reales del productor rellenados.
> Documento exigido por el **art. 13 del RD 1007/2023 (RRSIF)** — el productor declara
> que el sistema cumple el art. 29.2.j) de la Ley 58/2003 (LGT), el RRSIF y la Orden
> HAC/1177/2024. **Versionada por release**: cada versión publicada del SIF lleva la suya;
> el productor conserva todas las versiones (art. 13 RRSIF).
>
> Cumplimentar todos los `[…]` antes de firmar. Los valores del sistema DEBEN coincidir
> con el bloque `SistemaInformatico` que YaQu remitirá en cada registro una vez conectado el envío a la AEAT
> (ver `src/modules/fiscal/verifactu/registro.builder.ts`).
>
> **Cómo está ordenada (SCRUM-523c):** los apartados 1 a 6 siguen las doce letras del art. 15.1
> de la Orden HAC/1177/2024 **en su orden**, y cada dato lleva delante el texto que lo describe y,
> entre paréntesis, su letra. Lo que **no es identidad** está rellenado con el valor que hoy escribe
> el código, citado en la tabla del final; lo que **es identidad** (la SL y sus dos
> administradores) sigue en hueco. El productor será **la SL, con el NIF definitivo de después de
> inscribirla** (SCRUM-870 c.20864, respuestas ② y ⑤); hasta entonces este documento no se firma.

---

## DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN

(conforme al artículo 13 del Real Decreto 1007/2023, de 5 de diciembre, y al artículo 15 de la
Orden HAC/1177/2024)

### 1. Identificación del sistema informático — letras a), b) y c)

- **(a) Nombre del sistema informático (`NombreSistemaInformatico`):** YaQu
- **(b) Código identificador del sistema (`IdSistemaInformatico`):** 01
- **(c) Identificador completo de la versión a la que se refiere esta declaración (`Version`):**
  `[VERSIÓN — se fija al decidir qué es «una versión»]`
- **Fecha de puesta a disposición de esta versión:** `[FECHA]`
- **Número de instalación (`NumeroInstalacion`):** no es un valor único del sistema. Cada
  comercio que factura con YaQu es una instalación distinta, y su número es el identificador
  interno de ese comercio, que no se reutiliza nunca.

### 2. Componentes y funcionalidades — letra d)

- **(d) Componentes hardware y software:** aplicación web en modalidad de software como servicio
  (SaaS), alojada en Railway; backend Node.js; base de datos PostgreSQL. El productor no
  suministra hardware: el obligado tributario accede mediante navegador, sin instalación local en
  su equipo. **[VALIDAR ASESOR: descripción de instalación para SaaS]**
- **Qué hace:** generación de los registros de facturación de **alta**, **rectificativa (R1)** y
  **anulación** con huella **SHA-256 encadenada** (art. 12 RRSIF).
- **Funcionalidades principales a efectos del Reglamento:**
  - Registro de facturación de alta por cada factura emitida, con huella y encadenamiento.
  - Registro de anulación y factura rectificativa (R1) con su propio registro y huella.
  - Remisión a la AEAT (modalidad VERI*FACTU), una vez construido el envío.
  - Código QR de cotejo y leyenda "Factura verificable en la sede electrónica de la AEAT"
    en cada factura.
  - Conservación e inalterabilidad de los registros; trazabilidad.

### 3. Modalidad de uso — letras e), f) y g)

- **Tipología:** sistema informático de facturación en modalidad **VERI*FACTU**
  (remisión de los registros a la AEAT, una vez completado el envío telemático). **No** opera en modo "no
  verificable".
- **(e) El sistema sólo puede funcionar exclusivamente como VERI*FACTU (`TipoUsoPosibleSoloVerifactu`):**
  **Sí** — el sistema solo opera en modalidad VERI*FACTU.
  **[VALIDAR ASESOR: P14, la modalidad del sistema entero, sin contestar]**
- **(f) El sistema permite ser usado por varios obligados tributarios (`TipoUsoPosibleMultiOT`):**
  **Sí** — cada comercio es un obligado tributario distinto dentro del mismo sistema.
- **(g) Tipos de firma utilizados:** no aplica. Esta letra sólo se exige a los sistemas que no
  funcionan como VERI*FACTU (art. 15.1.g de la Orden); depende de que se confirme la letra e).
- **Nota — `IndicadorMultiplesOT` no es un dato de esta declaración:** describe a cada usuario,
  no al sistema, y el sistema lo calcula por usuario en cada registro. Hoy cada cuenta de YaQu
  lleva una sola facturación, y por eso su registro lleva **N**.

### 4. Productor del sistema informático — letras h), i) y j)

- **(h) Nombre o razón social del productor:** `[DENOMINACIÓN SOCIAL DE LA SL, como en la escritura]`
- **(i) NIF del productor:** `[NIF DEFINITIVO DE LA SL, tras la inscripción]`
- **(j) Dirección postal completa del productor:** `[DOMICILIO SOCIAL COMPLETO]`
- **Datos de contacto:** `[EMAIL]` · `[TELÉFONO]` · web: https://yaqu.app

### 5. Declaración de conformidad — letra k)

`[DENOMINACIÓN SOCIAL DE LA SL]`, con NIF `[NIF DE LA SL]`, representada por sus dos
administradores mancomunados, que firman conjuntamente al pie, en calidad de **productor** del
sistema informático identificado en el apartado 1, **DECLARA BAJO SU RESPONSABILIDAD** que
dicho sistema, en la versión indicada, **cumple** con:

- el artículo **29.2.j) de la Ley 58/2003**, de 17 de diciembre, General Tributaria;
- el **Reglamento aprobado por el RD 1007/2023** (RRSIF); y
- las especificaciones técnicas aprobadas por la **Orden HAC/1177/2024** y normativa de
  desarrollo.

**[VALIDAR ASESOR: redacción literal de la cláusula de conformidad y eventuales
limitaciones de responsabilidad coherentes con los ToS — pregunta C6 del one-pager.]**

### 6. Lugar, fecha y firma — letra l)

**(l) Lugar y fecha de la suscripción:** en `[LOCALIDAD]`, `[PAÍS]`, a `[DÍA] de [MES] de [AÑO]`.

Firman conjuntamente, como administradores mancomunados del productor:

| | Administrador mancomunado 1 | Administrador mancomunado 2 |
|---|---|---|
| Nombre y apellidos | `[NOMBRE DEL FIRMANTE 1]` | `[NOMBRE DEL FIRMANTE 2]` |
| NIF | `[NIF DEL FIRMANTE 1]` | `[NIF DEL FIRMANTE 2]` |
| Cargo | `[CARGO DEL FIRMANTE 1]` | `[CARGO DEL FIRMANTE 2]` |
| Firma | ______________________ | ______________________ |

**[VALIDAR ASESOR: si la firma es manuscrita o electrónica, y cómo se acredita el cargo de cada
administrador]**

### 7. Disponibilidad de la declaración

Conforme al art. 13 RRSIF, esta declaración se mostrará **de modo visible en el propio
sistema** (en cada versión) y se pondrá a disposición del **cliente** (cada merchant) y, en
su caso, del comercializador, así como de la Administración tributaria cuando la requiera.
El productor **conserva** las declaraciones de todas las versiones.

> **Pendiente de implementación (post 8/8):** publicar esta declaración en la UI de YaQu
> (p. ej. `yaqu.app/legal/declaracion-responsable`, versionada) y enlace de descarga desde
> la Configuración de cada merchant. Hasta entonces, este documento es solo borrador interno.

---

## Control de versiones de esta declaración

| Versión SIF | Fecha | Cambios relevantes | Estado |
|---|---|---|---|
| `[VERSIÓN]` | `[FECHA]` | Versión inicial (modalidad VERI*FACTU), productor la SL | **BORRADOR SIN FIRMA — no publicada** |

Cada cambio de productor obliga a una declaración nueva (art. 13.3 RRSIF): la primera que se firme
será ya la de la SL.

---

## De dónde sale cada dato que no es identidad (para quien revise, no forma parte de la declaración)

| letra | valor | lo escribe |
|---|---|---|
| a) | YaQu | `src/modules/invoicing/domain/verifactu.service.ts:1061` y `:1171`; `registro.builder.ts:22` |
| b) | 01 | `src/modules/fiscal/verifactu/productor.ts:45` (2 posiciones exactas, error AEAT 1177) |
| c) | hoy el código escribe `1.0.0` | `productor.ts:48`, escrita el 2-ago-2026 y sin cambios desde entonces |
| — | número de instalación = `id` del comercio | `src/modules/fiscal/verifactu/instalacion.ts:26-28`; antes era «1» para todos (`productor.ts:50-53`, SCRUM-524g) |
| d) | Railway · Node.js · PostgreSQL | `src/core/config/env.ts:37-38` · `package.json` · `prisma/schema.prisma:6` |
| e) | S | `verifactu.service.ts:1065` y `:1175`; master S1-B |
| f) | S | `verifactu.service.ts:1066` y `:1176`; `registro.builder.ts:27` |
| — | `IndicadorMultiplesOT` = N | `instalacion.ts:37` y `:40-42` |
| h) i) j) | la SL | SCRUM-870 c.20864 ② y ⑤ (hueco hasta el NIF definitivo) |
| firma | dos administradores mancomunados | SCRUM-870 c.20864 ③ |

*Plantilla creada el 13-jun-2026 (S1-E). Fuente: art. 13 RD 1007/2023; FAQ AEAT
"Certificación de los sistemas informáticos: declaración responsable". Preguntas abiertas
al asesor en `docs/legal/PREGUNTAS_ASESOR.md` (C5, C6 y datos del productor B2).*
