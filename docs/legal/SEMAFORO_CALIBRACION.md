# SEMÁFORO DE CALIBRACIÓN — validaciones VERI*FACTU → ROJO / ÁMBAR / VERDE

> **SCRUM-201 · RECON fiscal. Cero código.** Este documento **no cambia nada**: calibra, contra
> la fuente oficial, qué gravedad tiene cada validación de la AEAT. Es el instrumento con el que
> después se decide qué bloquea una emisión y qué solo avisa.
>
> **Ejecutado el 29-jul-2026.** No toca staging, no toca `main`, no toca el máster.
> Rama: `scrum-201-semaforo-calibracion`.

---

## 0. Fuentes (descargadas, no citadas de memoria — R1)

| Fuente | URL | Verificación |
|---|---|---|
| **PDF de validaciones** — *"Validaciones · Sistemas Informáticos de Facturación y Sistemas VERI\*FACTU"*, **versión 1.2.2**, 28 páginas | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` | HTTP 200 · 658.946 bytes · SHA-256 `426EB926FC098A36A163F66CA5F40D9E0847CA23300BBE5008979832D3513440` |
| **Listado oficial de códigos de error** (`errores.properties`), referenciado por el propio PDF en su §4.4 | `https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties` | HTTP 200 · 25.335 bytes · SHA-256 `152FEC330B97A1CC7E0579EADB58849C21CC2C7668E21C830ECD3EA7ADC6FEB3` · ISO-8859-1 · 248 códigos |

**Sobre el SSL:** no hizo falta ninguna degradación de cifrado. `curl` estándar sobre HTTPS
funcionó a la primera en los dos hosts (`agenciatributaria.es` y `prewww2.aeat.es`). No se usó
`-k` ni `--ciphers`, y por tanto **ningún certificado quedó sin verificar**.

> ⚠️ La URL que circulaba (`sede.agenciatributaria.gob.es/.../Validaciones_Errores_Veri-Factu.pdf`)
> devuelve **404 con cuerpo HTML** — es decir, `curl -o fichero.pdf` deja en disco un HTML de
> 4.928 bytes con nombre `.pdf` y **exit 0**. Es el patrón del incidente #10 de
> `ERRORES_ASESOR.md`: el comando dice que salió bien y el resultado no es lo que parece.
> Aquí lo cazó `file` (dijo *HTML document*, no *PDF document*). **Al descargar una fuente
> normativa, comprobar el tipo del fichero, no el código de salida del comando.**

---

## 1. El criterio (dado por el fundador, literal)

- **ROJO** = la AEAT lo **rechaza** (`Incorrecto`) **o** rompe cadena/registros.
- **ÁMBAR máximo** = la AEAT lo **acepta con errores** (`AceptadoConErrores`).

**Lo que el criterio no define, y aquí se asume (asunción declarada, revisable):**

- **VERDE** = validación que **YaQu no puede pisar hoy**, porque el campo que la dispara no se
  emite nunca en el XML que genera. Verde **no** significa "no aplica": significa
  "no aplica *mientras* el generador siga emitiendo lo que emite hoy". Cada fila VERDE de la
  §5 lleva la condición exacta que la mantiene verde.

**Y una colisión que el criterio contiene y que hay que resolver a mano:** las dos cláusulas de
ROJO son *o* rechazo *o* rotura de cadena. Hay validaciones que la AEAT **acepta** (techo ÁMBAR
por la segunda regla) y que **tocan la cadena** (ROJO por la primera). Esas no las decide este
recon: van a la §8.

---

## 2. La fuente ya viene clasificada: el semáforo es de la AEAT, no nuestro

El hallazgo estructural de este recon es que **no hay que inventar la calibración**.
`errores.properties` está partido por la propia AEAT en exactamente tres listas, con estas
cabeceras literales:

| # | Cabecera literal en `errores.properties` | Códigos | Cuántos | Color |
|---|---|---|---|---|
| 1 | *"Listado de códigos de error que provocan el **rechazo del envío completo**"* | `4102`–`4141`, `3500`–`3503` | **44** | 🔴 **ROJO** |
| 2 | *"Listado de códigos de error que provocan el **rechazo de la factura** (o de la petición completa si el error se produce en la cabecera)"* | `1100`–`1293`, `3000`–`3004` | **194** | 🔴 **ROJO** |
| 3 | *"Listado de códigos de error que producen la **aceptación** del registro de facturación en el sistema (posteriormente deben ser subsanados)"* | `2000`–`2009` | **10** | 🟠 **ÁMBAR** |

Y el PDF (§4.2) lo dice con las mismas palabras del criterio:

> *Errores **"No admisibles"**: […] Estos errores provocan el rechazo del registro de facturación.*
> *Errores **"Admisibles"**: son aquellos errores que **no provocan el rechazo** del registro.*

**Regla mecánica que sale de aquí — y es exacta, no aproximada:**

```
código 4xxx / 35xx  → ROJO (alcance: se cae el ENVÍO entero, arrastrando registros válidos)
código 1xxx / 30xx  → ROJO (alcance: se cae ESE registro; los demás del envío siguen)
código 2xxx         → ÁMBAR (aceptado; obliga a subsanar salvo excepción expresa)
sin código posible  → VERDE (ver §5 para la condición que lo sostiene)
```

**Consecuencia práctica del alcance:** un 4xxx y un 1xxx son los dos ROJO, pero no cuestan lo
mismo. Un `4113`/`4114` (límite de registros del bloque) tumba un envío de hasta 1.000 registros
**correctos**. Por eso el alcance va como columna propia en las tablas: es el dato que ordena la
cola de arreglos dentro del ROJO, sin necesidad de un cuarto color.

---

## 3. 🔴 ROJO de alcance ENVÍO COMPLETO (44 códigos)

Un solo fallo aquí y **no entra nada**. Son de cabecera, de certificado, de estructura y de
límites: casi todos son fallos de configuración o de cliente SOAP, no de una factura concreta.

*(Tabla agrupada por validación, no enumeración: los 44 códigos están en la fuente. Los técnicos
puros — `4103`, `4106`, `4118`, `4128`, `4132` — se omiten por no ser accionables desde el SIF.)*

| Validación (PDF) | Códigos | ¿Puede pisarla YaQu hoy? |
|---|---|---|
| El XML no cumple el esquema / falta campo obligatorio | `4102` | **Sí** — es el modo de fallo natural de un generador propio (§7) |
| NIF de `ObligadoEmision` no identificado en la AEAT (§3.1.1.1) | `4104`, `4107`, `4115`, `4116` | **Sí** — merchant con NIF mal tecleado o no censado |
| NIF de `Representante` no identificado (§3.1.1.2) | `4105`, `4117`, `4123`, `4124` | Solo si se opta por colaborador social (decisión abierta, `SIF_SPEC_NOTES` §3) |
| Titular del certificado no es Obligado / Colaborador / Apoderado / Sucesor | `4112` | **Sí** — es el riesgo central del modelo de representación |
| Errores técnicos de certificado / apoderamientos / trámite | `4108`, `4110`, `4111` | Sí (transitorios: reintentar, no subsanar) |
| Codificación distinta de UTF-8 | `4119` | Baja — Node emite UTF-8 por defecto |
| Superado el límite de registros del bloque / de facturas | `4113`, `4114` | **Sí** — el builder ya corta en 1.000 (`registros_fuera_de_rango`) |
| `FechaFinVeriFactu` / `Incidencia` mal informados (§3.1.1.3-4) | `4120`, `4121` | No — no se emiten |
| `RefRequerimiento` / `FinRequerimiento` (§3.1.1.5) | `4122`, `4125`–`4127`, `4129`–`4131`, `4133` | **No** — son del modo *No VERI\*FACTU*, y YaQu es VERI\*FACTU (`TipoUsoPosibleSoloVerifactu=S`) |
| Nodo `RegistroAlta`/`RegistroAnulacion` ausente o mal colocado | `4136`, `4137` | **Sí** — orden de elementos = orden del XSD |
| Petición vacía / encoding incorrecto | `4138` | Sí |
| Servicio no activo / no habilitado / acceso suspendido | `4134`, `4135`, `4139`, `4140`, `4141` | Sí (operativos, no de datos) |
| Errores técnicos de BD de la AEAT | `3500`, `3501` | Sí (transitorios) |
| Factura consultada inexistente / no pertenece al titular | `3502`, `3503` | Solo en la operación de **consulta** |

---

## 4. 🔴 ROJO de alcance REGISTRO (194 códigos) — las que YaQu puede pisar

El listado completo de 194 está en la fuente; reproducirlo entero aquí sería copiar un fichero
que ya es público y versionado. Lo que sigue es **la parte que le aplica a YaQu**, mapeada desde
las validaciones del PDF §3.1.3 y anclada a su código.

### 4.1 Identificación y fechas de la factura (PDF §3.1.3.1)

| Validación | Código | ¿YaQu? |
|---|---|---|
| `IDEmisorFactura` debe ser el mismo NIF que `ObligadoEmision` | `1108` | **Sí** — multi-tenant: un cruce de merchant aquí es un ROJO fiscal, no solo un bug |
| `FechaExpedicionFactura` no puede ser superior a la fecha actual | `1112` | **Sí** — reloj del servidor / huso |
| `FechaExpedicionFactura` **no puede ser inferior al 28-10-2024** | `1152` | **Sí** — cualquier reemisión de histórico entra aquí |
| `FechaExpedicionFactura` no inferior a hoy − 20 años | `1133` | Baja |
| `NumSerieFactura` solo ASCII 32-126 y **sin** `"` `'` `<` `>` `=` | `1130`, `1287` | **Sí** — la serie la compone YaQu; un carácter raro en el nombre de serie es ROJO |
| `FechaOperacion` superior a la actual salvo `ClaveRegimen` 14/15 | `1125`, `1173` | No — no se emite `FechaOperacion` |

### 4.2 Destinatario (PDF §3.1.3.13) — **el bloque más caliente para YaQu**

| Validación | Código | ¿YaQu? |
|---|---|---|
| Si `TipoFactura` es **F1**/F3/R1/R2/R3/R4, `Destinatarios` **tiene que estar cumplimentado** | **`1189`** | **Sí, y hoy se pisa** — ver §7.1 |
| Si `TipoFactura` es F2/R5, `Destinatarios` **no** puede estar cumplimentado | `1190` | Sí, si se pasa a emitir F2 |
| Destinatario por NIF: debe estar identificado y ser distinto del `ObligadoEmision` | `1193` | **Sí** — autofactura o NIF propio pegado por error |
| `CodigoPais`/`IDType` en `IDOtro` | `1126`, `1131`, `1232`–`1234` | No — solo se emite `NIF`, nunca `IDOtro` |

### 4.3 Desglose, tipos y cuotas (PDF §3.1.3.15)

| Validación | Código | ¿YaQu? |
|---|---|---|
| **Al menos uno de `OperacionExenta` o `CalificacionOperacion` debe ir informado** | **`1195`** | **Sí, y hoy se pisa** — ver §7.2 |
| `TipoImpositivo` fuera de {0; 2; 4; 5; 7,5; 10; 21} | `1124` | **Sí** — el IVA lo teclea el merchant |
| `TipoImpositivo` permitido solo en ventana temporal (5 %, 2 %, 7,5 %) | `1132`, `1194`, `1235`, `1236` | **Sí** — tipos reducidos COVID/energía en facturas con fecha vieja |
| `CuotaRepercutida` ≠ base × tipo / 100 (margen ±10 €) | `1142`, `1144` | **Sí** — redondeo por línea |
| `CuotaRepercutida` y base con **signos distintos** | `1140`, `1143` | **Sí** — abonos y R1 con líneas en negativo |
| `CuotaRepercutida` ≠ 0 sin `CalificacionOperacion` = S1 | `1207` | Sí |
| S1 sin `BaseImponibleACoste` → `TipoImpositivo` y `CuotaRepercutida` obligatorios | `1208` | Sí |
| Con **`Impuesto` informado o vacío, `ClaveRegimen` es obligatorio** | **`1245`** | **Sí, y hoy se pisa** — ver §7.2 |
| `ClaveRegimen` fuera de la lista L8A | `1246` | Sí |
| `ImporteTotal` ≠ Σ(base + cuota + RE) | `1210` | **Sí** — ver la ambigüedad de la §8.1 |
| `CuotaTotal` ≠ Σ(cuota + RE) | `1216` | **Sí** — ver §8.1 |
| `RecargoEquivalencia` incompatible con el tipo | `1127`, `1160`, `1162`–`1170`, `1277`, `1281`, `1284` | No — no se emite RE |

### 4.4 Factura simplificada y rectificativa

| Validación | Código | ¿YaQu? |
|---|---|---|
| **F2 con Σ(base + cuota) > 3.000 €** (salvo acuerdo de facturación o art. 6.1.d) | **`1150`** | **Sí, en cuanto se emita F2** — un cliente sin NIF y un trabajo de 3.500 € es un caso real de oficios |
| Rectificativa sin `TipoRectificativa` / no rectificativa con él | `1114`, `1115` | **Sí** — R1 está implementado |
| Rectificativa por sustitución sin `ImporteRectificacion` / al revés | `1118`, `1119` | Sí — depende de S vs I (§8.4) |
| NIF del emisor de la factura rectificada no identificado | `1154` | Sí |
| `FacturasSustituidas` solo si F3 | `1116` | No — no se emite F3 |

### 4.5 Huella, encadenamiento y sistema informático

| Validación | Código | ¿YaQu? |
|---|---|---|
| Longitud de huella / tipo de huella / primer registro / tipo factura / cuotas / fecha-hora fuera de especificación | `1262`–`1268` | **Sí** — son las longitudes del registro |
| `HASH` no alfanumérico (actual y anterior) | `1291`, `1292` | Sí |
| Bloque `RegistroAnterior` mal informado | `1174`, `1175`, `1269` | **Sí** — `AUDITORIA_RRSIF` §4.2 ya registra que faltaban campos |
| **Huella del registro anterior igual a la del actual** | **`1278`** | **Sí** — ver la ambigüedad de la §8.2 |
| Error en bloque `Encadenamiento` | `1180` | Sí |
| `IdSistemaInformatico` incorrecto (2 posiciones, mayúsculas sin Ñ o dígitos) | `1177` | Sí — hoy `'01'`, conforme |
| `NombreSistemaInformatico` incorrecto | `1220` | No — constante `'YaQu'` |
| `TipoUsoPosibleSoloVerifactu` / `MultiOT` / `IndicadorMultiplesOT` distinto de N/S | `1212`, `1213`, `1226` | No — los tres son constantes `'S'` en ambos generadores |
| `IDVersion` incorrecto | `1251` | No — constante `'1.0'` |
| Bloque `SistemaInformatico`: NIF **o** `IDOtro`, nunca ambos ni ninguno | `1223` | Sí — depende de la declaración responsable (S1-E) |
| No existe el sistema informático en la AEAT | `1242` | **Sí** — hasta que el SIF esté dado de alta |

### 4.6 Estado del registro en la AEAT (`3000`–`3004`) — la cláusula "rompe registros"

Estos cuatro son la **segunda mitad del criterio ROJO**: no fallan por el contenido del
registro, sino por su **relación con lo que la AEAT ya tiene guardado**. Salen de las tablas del
anexo 6.1 / 6.2 del PDF (`ERROR (2)`, `ERROR (3)`, `ERROR (6)`, `ERROR (10)`).

| Situación (anexo PDF) | Código | Lectura |
|---|---|---|
| Alta normal de un registro que **ya existe** en la AEAT — `ERROR (2)` | `3000` (duplicado) | 🔴 Reenviar sin `Subsanacion=S` duplica |
| Alta por rechazo (`Subsanacion=S`,`RechazoPrevio=X`) cuando **no existía** registro previo — `ERROR (3)` | `3002` | 🔴 Secuencia de envío incorrecta. El PDF dice que **basta con reenviar** cuando entre el registro previo — es el único de la familia que se cura solo |
| Anulación de un registro que **no existe** — `ERROR (6)` | `3002` | 🔴 |
| "Anulación sin registro previo" cuando **sí** hay registro en la AEAT — `ERROR (10)` | `3000`/`3001` | 🔴 |
| Registro ya dado de baja | `3001` | 🔴 |
| Sin permisos para actualizar el registro | `3003` | 🔴 |
| Factura dada de alta vía formulario, no modificable | `3004` | 🔴 |

> **Por qué esta familia importa más de lo que parece:** son los únicos ROJO que **no** se
> evitan validando el XML antes de enviarlo. Dependen del estado remoto. La cola `VfSubmission`
> (máster, Parte L) es el sitio donde se gestionan, y `Subsanacion` / `RechazoPrevio` /
> `SinRegistroPrevio` son las tres banderas que deciden cuál de las ocho operativas admisibles
> del anexo se está pidiendo. **Elegir mal la bandera convierte una subsanación en un duplicado.**

---

## 5. 🟢 VERDE — lo que YaQu no puede pisar hoy, y la condición que lo sostiene

Verde **caduca**. Cada fila es verde *porque* el generador no emite ese campo. El día que lo
emita, la fila cambia de color sin avisar.

| Familia | Códigos que quedan fuera de alcance | Condición que lo mantiene verde |
|---|---|---|
| **IGIC / IPSI / Otros impuestos** | `1218`, `1257`, `2009`, toda la rama L8B | El generador emite `Impuesto` fijo a `01` (IVA). Rompe el día que entre un merchant canario, ceutí o melillense |
| **Tercero / expedición por tercero** | `1151`, `1155`, `1158`, `1159`, `1178`, `1186`–`1188`, `1211` | No se emite `EmitidaPorTerceroODestinatario` ni el bloque `Tercero` |
| **`IDOtro` (pasaporte, NIF-IVA, no censado)** | `1101`–`1103`, `1111`, `1121`, `1122`, `1126`, `1131`, `1156`, `1222`, `1232`–`1234`, `1254`, `1255` | El destinatario se emite **solo** con `NIF`. Rompe con el primer cliente extranjero |
| **Operación exenta** | `1182`, `1196`, `1199`, `1238`, `1286`, `1289` | No se emite `OperacionExenta`. ⚠️ Ojo: no emitirla **ni** emitir `CalificacionOperacion` es el ROJO `1195` (§7.2) |
| **Recargo de equivalencia** | `1127`, `1135`, `1160`, `1162`–`1170`, `1277`, `1281`, `1284` | No se emite `TipoRecargoEquivalencia` |
| **Macrodato** (≥ 100.000.000 €) | `1137`–`1139` | No se emite. Un presupuesto de fontanería no llega; formalmente sigue siendo obligatorio si llegara |
| **Cupón** | `1157` | No se emite |
| **F3 / facturas sustituidas** | `1116`, `1117` | Solo se emiten F1, F2 y R1 |
| **Claves de régimen especiales** (REBU, oro, grupo, caja, AAPP…) | `1200`, `1201`, `1202`, `1203`, `1205`, `1206`, `1252`, `1293` | Solo `ClaveRegimen` `01` (régimen general) |
| **Generador de anulación** | `1224`, `1225`, `1227`–`1231`, `1258`, `1259`, `1273` | El registro de anulación no emite `GeneradoPor`/`Generador` |
| **Acuerdos de facturación** | `1128`, `1129` | No se emiten `NumRegistroAcuerdoFacturacion` ni `IdAcuerdoSistemaInformatico` |
| **Consulta** (`ConsultaFactuSistemaFacturacion`) | `1248`, `1249`, `1250`, `1261`, `1270`–`1272`, `1285`, `3502`, `3503` | La operación de consulta no está implementada (S1-D) |

> ⚠️ **Los códigos `1xxx` NO son un rango continuo:** faltan `1113`, `1141`, `1204`, `1279` y
> `1280`, entre otros. Por eso las listas de arriba son **explícitas** donde hay hueco: escribir
> `1200`–`1206` habría afirmado un `1204` que no existe. Tres códigos que sí parecerían encajar
> en estas familias están fuera a propósito porque **YaQu sí los emite** (como constante, no como
> verde): `1226` (`IndicadorMultiplesOT`) y `1251` (`IDVersion`) están en la §4.5, no aquí.

---

## 6. 🟠 ÁMBAR — los 10 códigos, completos

Esta lista **sí** va entera: es el techo del criterio y son solo diez. La AEAT **registra** el
registro; el sistema queda obligado a subsanar, salvo las dos excepciones que el propio PDF
(§4.3.1) exime expresamente.

| Código | Texto oficial (abreviado) | ¿Obliga a subsanar? | Toca la cadena | ¿YaQu? |
|---|---|---|---|---|
| `2000` | El cálculo de la huella suministrada es incorrecta | Sí | **Sí** | Sí → §8.2 |
| `2001` | El NIF de `Destinatarios` no está identificado en el censo | Sí | No | **Sí, y será el más frecuente** → §8.3 |
| `2002` | La longitud de la huella del registro **anterior** no cumple especificaciones | Sí | **Sí** | Sí → §8.2 |
| `2003` | El contenido de la huella del registro **anterior** no cumple especificaciones | Sí | **Sí** | Sí → §8.2 |
| `2004` | `FechaHoraHusoGenRegistro` posterior a la hora de la AEAT (margen no publicado) | **No** — eximido expresamente | No | Sí (deriva de reloj) |
| `2005` | `ImporteTotal` ≠ Σ(base + cuota + RE) | Sí | No | **Sí** → §8.1 |
| `2006` | `CuotaTotal` ≠ Σ(cuota + RE) | Sí | No | **Sí** → §8.1 |
| `2007` | Marcado `PrimerRegistro=S` existiendo ya registros para ese SIF y NIF | Sí | **Sí** | **Sí** → §8.2 |
| `2008` | La huella del registro anterior debe ser distinta de la del actual | Sí | **Sí** | Sí → §8.2 |
| `2009` | `Impuesto`=IPSI sin `ClaveRegimen` | **No** — eximido expresamente | No | No (VERDE, §5) |

**Dato del margen:** el texto de `2004` termina en *"admitiéndose un margen de error de:"* —
**el valor se rellena en tiempo de respuesta y no está publicado en el fichero estático.**
No se puede calibrar el umbral de reloj desde la documentación; solo midiéndolo en el entorno
de pruebas (S1-D). Anotado como pendiente, no inventado.

---

## 7. Aplicación al código de hoy — tres ROJO que el generador actual ya produce

> **Encuadre, para no dar una alarma falsa (R4):** lo que sigue **no es una incidencia en
> producción**. El XML afectado es el del **pack de inspección** `/admin/exports/verifactu.xml`,
> y `AUDITORIA_RRSIF.md` §4 ya dice que *"NO es aún el payload de remisión"*. Además la remisión
> está apagada (`INVOICING_ES_ENABLED=OFF`, regla 7). **Nadie está enviando esto a la AEAT.**
> El valor de anotarlo es que la calibración convierte tres *"pendientes"* redactados en prosa
> en tres códigos concretos con color: dejan de ser dudas y pasan a ser trabajo medible para S1-C/S1-D.

Hay **dos generadores distintos**, y no coinciden:
`src/modules/fiscal/verifactu/registro.builder.ts` (S1-C, puro, con tests) y
`src/modules/invoicing/domain/verifactu.service.ts` (el export que existe y corre hoy).

### 7.1 🔴 `1189` — F1 sin `Destinatarios`

[verifactu.service.ts:673](../../src/modules/invoicing/domain/verifactu.service.ts#L673) emite
siempre `F1` (o `R1`), y [:622](../../src/modules/invoicing/domain/verifactu.service.ts#L622)
omite `Destinatarios` cuando el cliente no tiene NIF. La combinación **F1 sin destinatario** es
exactamente el `1189`: *"Si TipoFactura es F1 o F3 o R1 o R2 o R3 o R4 el bloque Destinatarios
tiene que estar cumplimentado"*.

El comentario del propio código ya marca esto como **⚠️ PENDIENTE FISCAL (asesor)** y registra la
disyuntiva: o `FacturaSinIdentifDestinatarioArt61d` o emitir **F2**. La calibración añade lo que
faltaba: **la opción de no elegir es ROJO**, no ámbar. Y añade el precio de la salida F2: activa
el techo de **3.000 €** (`1150`, §4.4), que en oficios se alcanza.

### 7.2 🔴 `1245` y `1195` — `Impuesto` sin `ClaveRegimen`, y desglose sin calificación

[verifactu.service.ts:558](../../src/modules/invoicing/domain/verifactu.service.ts#L558) y
[:677](../../src/modules/invoicing/domain/verifactu.service.ts#L677) emiten `<Impuesto>01</Impuesto>`
seguido de `TipoImpositivo`, base y cuota — **sin `ClaveRegimen` y sin `CalificacionOperacion`**:

- `1245` — *"Si el campo Impuesto está vacío o tiene valor IVA(01)… el campo ClaveRegimen debe
  de estar cumplimentado"* (PDF §3.1.3.15.6).
- `1195` — *"Al menos uno de los dos campos OperacionExenta o CalificacionOperacion deben estar
  informados"*.

El builder de S1-C **sí** emite `CalificacionOperacion` siempre, y `ClaveRegimen` de forma
condicional: [registro.builder.ts:116](../../src/modules/fiscal/verifactu/registro.builder.ts#L116)
solo escribe `Impuesto` + `ClaveRegimen` **si** `claveRegimen` viene informado, y la interfaz lo
declara **opcional** (`claveRegimen?: string`). Hoy los dos únicos llamadores (el test y
`scripts/gen-registros-sample.mjs`) pasan `'01'`, así que **está latente, no vivo** — verificado
llamador a llamador, no supuesto. Un llamador futuro que lo omita produce un registro que la
AEAT rechaza con `1245`.

---

## 8. ⚖️ CASOS DUDOSOS — los decide el fundador, no este recon

Cuatro decisiones. Las tres primeras son la misma colisión del criterio: **la AEAT dice ÁMBAR y
la cláusula "rompe cadena/registros" dice ROJO.** La cuarta es fiscal pura.

### 8.1 El mismo error de importes tiene DOS códigos, uno ROJO y otro ÁMBAR

Comparando los textos de los 248 códigos, **exactamente tres** aparecen literalmente en las dos
listas — la de rechazo y la de aceptación:

| Rechazo (🔴) | Aceptación (🟠) | Texto compartido |
|---|---|---|
| `1210` | `2005` | `ImporteTotal` ≠ Σ(base + cuota + RE) |
| `1216` | `2006` | `CuotaTotal` ≠ Σ(cuota + RE) |
| `1278` | `2008` | La huella del registro anterior debe ser distinta de la del actual |

*(Comprobado sobre el fichero, no de memoria: las otras coincidencias de texto — `4107`/`1109`
/`1110` y `4109`/`1123` — son el mismo error a nivel de cabecera y a nivel de registro, que es
lo esperable y no una contradicción.)*

**El problema:** ni el PDF ni el `.properties` dicen **cuándo** dispara el ROJO y cuándo el ÁMBAR.
El PDF §16/§17 solo dice que un desajuste *"no generará rechazo"* dentro de **±10 €**. La lectura
razonable es *dentro del margen → 2005/2006 (ámbar), fuera del margen → 1210/1216 (rojo)*, **pero
eso es una inferencia mía, no está escrito en ninguna de las dos fuentes.**

**Y aquí YaQu tiene una regla propia más estricta que la AEAT.** El margen de ±10 € es enorme
comparado con la ventana de ±0,05 € de `reconcileToTarget`, y el incidente #12 de
`ERRORES_ASESOR.md` documenta el caso exacto: un desfase de **3 céntimos** hace que el código
malo toque el precio de una línea para cuadrar con una cifra vieja, y **eso queda sellado en la
huella**, corregible solo con una R1 (regla 29).

> **Decisión pendiente:** un descuadre de importes, ¿es ÁMBAR (lo que dice la AEAT) o ROJO
> interno (bloquear la emisión antes de sellar la huella)?
> *Lectura del recon, no vinculante:* la AEAT tolera ±10 €; YaQu no debería tolerar 1 céntimo,
> porque el coste de dejarlo pasar no es el aviso de la AEAT, es la huella inmutable.

### 8.2 Los ÁMBAR que rompen la cadena (`2000`, `2002`, `2003`, `2007`, `2008`)

Cinco de los diez ÁMBAR son de **huella y encadenamiento**. La AEAT los **acepta y registra**
(techo ÁMBAR por el criterio) y a la vez son literalmente *"romper cadena"* (ROJO por el criterio):

- `2000` — nuestra huella no coincide con la que calcula la AEAT: la cadena que guardamos no es
  verificable por un tercero, que es el punto entero del RRSIF.
- `2002` / `2003` — el eslabón anterior está mal formado.
- `2008` — dos eslabones consecutivos con la misma huella: la cadena no avanza.
- `2007` — declaramos `PrimerRegistro=S` cuando la AEAT ya tiene registros de ese SIF+NIF:
  creemos estar empezando una cadena que ya existe.

Un `2000` no se queda quieto: **el registro siguiente encadena sobre esa huella**, así que un
solo fallo contamina todos los posteriores. Es la diferencia entre un aviso y una cadena entera
que hay que reconstruir.

> **Decisión pendiente:** ¿la cláusula "rompe cadena" **sobrescribe** el techo ÁMBAR para estos
> cinco, o se respeta el techo porque la AEAT los da por registrados?
> *Lectura del recon, no vinculante:* separar `2001` y `2004` (que no tocan la cadena) del resto,
> y tratar los cinco de cadena como ROJO de emisión aunque la AEAT los acepte.

### 8.3 `2001` — el NIF del cliente no censado: ámbar de manual, plaga en la práctica

`2001` es ÁMBAR limpio: no toca la cadena, la AEAT registra la factura, y la subsanación es un
reenvío. El PDF (§4.3.1) lo lista como el primer error admisible.

Lo que lo hace decisión y no clasificación: **YaQu es para oficios**, y el NIF del cliente lo
teclea el fontanero desde el móvil. Un ámbar que aparece en un porcentaje alto de facturas deja
de ser un aviso y se convierte en una cola de subsanaciones permanente. Eso es una decisión de
producto (¿se valida el NIF **antes** de emitir? ¿se bloquea? ¿se avisa y se deja pasar?), no
una de calibración fiscal.

> **Decisión pendiente:** ¿ÁMBAR que solo se registra, o gate en la UI antes de emitir?
> Este es el único dudoso que **no** es fiscal: es producto y fricción.

### 8.4 `TipoRectificativa`: `S` (sustitución) o `I` (diferencias)

No es una colisión del criterio; es una calificación fiscal que **cambia qué validaciones
aplican**, y por eso entra aquí:

- Con **`I`**: `ImporteRectificacion` **no** debe emitirse (`1119` si se emite).
- Con **`S`**: `ImporteRectificacion` es **obligatorio** (`1118` si falta).

El builder de S1-C **elige `I` por defecto**
([registro.builder.ts:53](../../src/modules/fiscal/verifactu/registro.builder.ts#L53)) con un
`[VALIDAR asesor S1-F]` al lado, y el export **no emite ninguno de los dos**
([verifactu.service.ts:564](../../src/modules/invoicing/domain/verifactu.service.ts#L564)),
con su `⚠️ PENDIENTE FISCAL` explicando que elegir es una calificación fiscal, no de
implementación. **Los dos hacen lo correcto al no decidirlo.** Queda anotado aquí porque la
elección determina cuál de los dos códigos puede dispararse.

> **Decisión pendiente:** es del asesor fiscal (bundle Y3 / S1-F), no del recon ni del código.

---

## 9. Cómo se mantiene esto

1. **La fuente se mueve.** El PDF va por la **1.2.2** y su histórico de revisiones registra 20
   ediciones desde 2022 — incluida *"eliminación de la categorización de errores admisibles
   subsanables y no subsanables"*, que es justo el eje de este semáforo. **Antes de fiarse de esta
   tabla, comprobar el SHA-256 de la §0.** Si cambió, la calibración se rehace.
2. **`errores.properties` es la fuente ejecutable**, no el PDF: viene ya clasificado en las tres
   listas y es un fichero plano de 25 KB. Cuando S1-D construya el parseo de `RespuestaSuministro`,
   **el color debe salir del rango del código** (`4xxx`/`35xx` → envío, `1xxx`/`30xx` → registro,
   `2xxx` → ámbar), no de una tabla copiada a mano que se desincroniza.
3. **El VERDE de la §5 caduca solo.** Cada fila lleva su condición. Un merchant canario, un
   cliente extranjero o el primer recargo de equivalencia mueven filas enteras de verde a rojo
   sin que nadie toque este documento.
4. **Fecha de este recon: 29-jul-2026.** Todo lo que dice sobre el código está verificado contra
   `origin/main` en `0b6e8d3`.

---

## 10. Resumen en cinco líneas

- La AEAT **ya publica el semáforo**: `errores.properties` está partido en rechazo-de-envío (44),
  rechazo-de-registro (194) y aceptado-con-errores (10). El color sale del rango del código.
- **ROJO** = 4xxx/35xx (tumba el envío entero) y 1xxx/30xx (tumba ese registro).
- **ÁMBAR** = los diez 2xxx, de los que **dos** están eximidos de subsanar (`2004`, `2009`).
- **Tres ROJO ya se producen hoy** en el export de inspección (`1189`, `1245`, `1195`) — no en
  remisión, que está apagada, pero ponen código y color a pendientes que hoy son prosa.
- **Cuatro decisiones quedan para el fundador** (§8), y las tres primeras son la misma pregunta:
  cuando la AEAT dice ámbar y la cadena dice rojo, **¿quién gana?**
