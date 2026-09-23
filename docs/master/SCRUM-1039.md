# SCRUM-1039 · CONTABILIDAD — Completar las citas oficiales que faltan y llevar las Q-C al asesor

**Medido contra:** `origin/main` = `524ba73fac05904b9a50eb77282140a9a1f53e79` · 2026-09-22T09:09:06Z
**Puesto:** S0 + J4 · 22-sep-2026

Solo lectura y documentación (STOP fiscal declarado en el ticket, no bloqueante). Alcance: las
citas que `docs/producto/CONTABILIDAD.md` §4 marcaba NO VERIFICADO: los plazos trimestrales (el
art. 71 RIVA no los contiene), las órdenes ministeriales de los modelos, los arts. 7 y 20 LIVA, y
las retenciones del 2 % y 1 % que admite `retencionIrpf.ts:54`.

## Qué se hizo

1. Se bajaron de nuevo las cinco fuentes de §8 (GET público, 22-sep) + una fuente NUEVA: **Orden
   EHA/3786/2008** (aprueba el modelo 303), única orden ministerial localizada y citada en esta
   pasada. Método: descarga directa (no vía LLM — el resumidor de WebFetch tiene un tope de 125
   caracteres por cita y no sirve para transcribir texto legal literal), conversión a texto plano
   con la MISMA normalización que el comprobador, y búsqueda del artículo por offset. Scripts de
   evidencia: `docs/master/evidencias/scrum1039/`.
2. **10 citas nuevas** añadidas a `docs/producto/CONTABILIDAD.md` §3 (RIRPF art. 95.4-6, LIVA arts.
   7 y 20.Uno, Orden EHA/3786/2008 art. 7.2). El comprobador (`docs/verificacion/comprobar-citas-contabilidad.mjs`,
   con `ORDEN303` añadida a `FUENTES`) corre **26/26 citas literales, control negativo OK, exit 0**
   — ver `docs/master/evidencias/scrum1039/comprobador-26-26.txt`.
3. `docs/producto/CONTABILIDAD.md` §4: **Q-C5 y Q-C9 quedan RESPONDIDAS por cita** (pendientes solo
   de la confirmación de J4); **Q-C8 parcialmente** (modelo 303 sí, 130/131/111/115/347/390 no).
4. `docs/legal/PREGUNTAS_ASESOR.md`: nueva sección «Q-C1…Q-C9 · Contabilidad para un autónomo de
   oficio», con las 9 preguntas, marcada explícitamente como **propuesta de S0 pendiente del visto
   bueno de J4** (dueño del fichero).

## Hallazgo no pedido por el ticket, con víctima hoy

El RIRPF art. 95.6.2º lista los epígrafes IAE a los que se aplica el 1 % de retención en módulos, y
coincide CASI EXACTAMENTE con los oficios que YaQu tiene como target (`trade` enum: electricista,
fontanero, reformista, pintor, cerrajero, climatización): 504.2/3 fontanería-frío-calor, 501.3
albañilería, 505.5 carpintería/cerrajería, 505.6 pintura. Esto responde de fondo a Q-C5 y es un dato
de producto, no solo fiscal: si una parte relevante de los profesionales de YaQu factura en módulos,
el 1 % no es un caso residual.

## Sin código de producto

Solo `docs/` (CONTABILIDAD.md, PREGUNTAS_ASESOR.md — dueño J4, en revisión) y
`docs/verificacion/comprobar-citas-contabilidad.mjs` (una línea: añadir la fuente nueva a la lista).

## Pendiente (no cerrado por esta tanda)

Órdenes ministeriales de 130/131, 111, 115, 347 y 390 — no localizadas. Art. 20.Uno de la LIVA
revisado solo parcialmente (encabezado + 5 primeros apartados de ~35): si el asesor confirma que no
hay más candidatos para un oficio, no hace falta completar el resto.

## SCRUM-1039b · Localización de las 6 órdenes + casillas de 303 y 390 (J5, 23-sep-2026)

**Medido contra:** `origin/main` = `78ef063c0b35b0e3e2f72dde60a97321cc44143d` · 2026-09-23T16:15:56Z

Encargo del orquestador: de los seis modelos que cita Q-C8 (303, 130/131, 111, 115, 347, 390),
localizar su orden vigente en el BOE y, sobre todo, **qué casilla es qué** (no el plazo — eso sigue
siendo Q-C8 aparte). Empezar por el 303, que desbloquea más tickets (1063 → 1064 → 1076 → 1077).

### Método y su límite, declarado

Descarga directa por `curl` (GET público) — no vía WebFetch, que resume y trunca citas legales.
Conversión a texto con el script YA existente de esta misma carpeta
(`docs/master/evidencias/scrum1039/convertir-a-texto.mjs`), para el articulado. **Para las
casillas, lectura VISUAL de la imagen del formulario**: el Anexo I/III/IV de estas órdenes es un PNG
escaneado, no texto — comprobado (0-2 apariciones de "casilla" en el texto plano del articulado de
48.793 caracteres de EHA/3786/2008; las dos que hay son notas de modificación de OTRO modelo, no el
303). Esto es un límite del instrumento, no una interpretación: el comprobador automático de citas
no puede verificar mecánicamente una lectura de imagen contra el HTML descargado, a diferencia de
las citas de artículo. Cada casilla de abajo lleva su URL exacta para recotejo por cualquiera.
Ningún juicio fiscal: solo transcripción de lo que el formulario oficial imprime.

### 1 · Modelo 303 — casillas confirmadas

- Orden EHA/3786/2008 (`https://www.boe.es/buscar/act.php?id=BOE-A-2008-20953`): su Anexo I fue
  **sustituido** por el Anexo III de la **Orden HAC/27/2026, de 22 de enero**
  (`https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1761`) — nota a pie verificada en la propia
  consolidación del BOE. Es la orden CORRIENTE del formulario, no la de 2008.
- Formulario actual (6 páginas): `https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png`
  a `..._12.png`.

| Concepto | Casilla | Fórmula impresa en el formulario |
|---|---|---|
| IVA repercutido (total, régimen general) | **27** | «Total cuota devengada (152+167+03+155+06+09+11+13+15+158+170+18+21+24+26)» |
| IVA soportado (total a deducir) | **45** | «Total a deducir (29+31+33+35+37+39+41+42+43+44)» |
| Resultado régimen general | **46** | «Resultado régimen general (27-45)» |
| Resultado final (caso simple: sin importación/simplificado/rectificativa) | **64→66→69→71** | 64 «Suma de resultados (46+58+76)» → 66 (atribuible al Estado) → 69 «Resultado de la autoliquidación (66+77-78+68+108)» → **71 «Resultado (69-70+109-112)»**; con las demás casillas a 0, 71 = 46 |
| A compensar / a devolver / a ingresar | 72 / 73 / I | tras el 71 |

### 2 · Modelo 390 — misma orden (Anexo IV), casillas confirmadas

- La propia Orden HAC/27/2026 nombra, en su preámbulo, la orden que aprueba el 390: **«la Orden
  EHA/3111/2009, de 5 de noviembre, por la que se aprueba el modelo 390 de Declaración-resumen anual
  del Impuesto sobre el Valor Añadido»** — cita literal de HAC/27/2026, no de la EHA/3111/2009 en sí
  (esa orden NO se descargó por separado esta pasada; pendiente si J4 necesita citar su articulado
  además del formulario).
- Formulario actual (9 páginas): `https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_13.png`
  a `..._21.png`.

| Concepto | Casilla |
|---|---|
| Total bases y cuotas IVA devengado (régimen general) | **33/34** |
| Suma de deducciones | **64** |
| Resultado régimen general (47-64) | **65** |
| Resultado régimen simplificado (79-82) | **83** |
| Suma de resultados (65+83+658) | **84** |
| Resultado de la liquidación anual, territorio común (84+659-85-112) | **86** |
| Total resultados a ingresar en las autoliquidaciones del ejercicio (informativo) | **95** |

### 3 · Los otros cuatro — LOCALIZADOS y citados; casillas SIN extraer todavía

No confundir con «no localizada» (así seguían en el punto anterior de este ticket): la orden se
abrió, se leyó y se cita abajo; lo que falta es la lectura visual de su anexo-imagen, que esta
tanda no llegó a hacer.

| Modelo | Orden vigente | URL | Cita literal (art. 1 o equivalente) |
|---|---|---|---|
| 130/131 | EHA/672/2007, 19-mar (mod. HAP/258/2015) | `https://www.boe.es/buscar/act.php?id=BOE-A-2007-6032` | «Se aprueba el modelo 130. Impuesto sobre la Renta de las Personas Físicas. Actividades económicas en estimación directa. Pago fraccionado. Autoliquidación.» |
| 111 | EHA/586/2011, 9-mar (deroga EHA/30/2007) | `https://www.boe.es/buscar/act.php?id=BOE-A-2011-4948` | «Se aprueba el modelo 111 "Retenciones e ingresos a cuenta del Impuesto sobre la Renta de las Personas Físicas. Rendimientos del trabajo y de actividades económicas, premios y determinadas ganancias patrimoniales e imputaciones de renta. Autoliquidación".» |
| 115 | Orden de 20-nov-2000 (mod. HAC/1276/2020, posición 114 del registro tipo 2) | `https://www.boe.es/buscar/act.php?id=BOE-A-2000-21430` | «Se aprueban los modelos 115 en pesetas y en euros "(…) Retenciones e ingresos a cuenta sobre determinadas rentas o rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles urbanos. Declaración-documento de ingreso".» |
| 347 | EHA/3012/2008, 20-oct (mod. HAC/1431/2025) | `https://www.boe.es/buscar/act.php?id=BOE-A-2008-16973` | «Se aprueba el modelo 347 "Declaración anual de operaciones con terceras personas", de formato electrónico (…).» |

Control hecho en las seis (303, 390 y estas cuatro): ninguna lleva el banner de derogación total que
usa el BOE («ha dejado de estar vigente») — están vigentes hoy, 23-sep-2026.

### Lo que NO se hizo

- Q-C8 (los plazos) sigue sin responder: es tarea aparte, ya en curso, y esto no la sustituye.
- No se ha tocado `docs/producto/CONTABILIDAD.md` ni `docs/legal/PREGUNTAS_ASESOR.md` (dueño J4, en
  revisión): esto es evidencia para que J4 la incorpore, no una respuesta fiscal ni una cita
  propagada por mí.
- No se han extraído las casillas de 130/131, 111, 115 y 347 (quedan sus anexos-imagen por leer).
- Ningún fichero de código tocado.

### Suelo

Descarga de 6 órdenes + lectura visual completa de los 2 formularios que más tickets desbloquean
(15 páginas de imagen, 303 + 390), desde el BOE público, 23-sep-2026 ~16:00-17:00Z. Esta máquina no
tiene Postgres/Docker (no aplica aquí: todo el trabajo fue lectura de fuentes públicas). Ninguna
interpretación fiscal: todo lo de arriba es lo que el formulario o el artículo dicen literalmente,
con su URL para que J4 lo recoteje sin rehacerlo.
