# Inventario de afirmaciones sobre VeriFactu en `.claude/skills/` — la zona que se carga sola

**Medido:** 19-ago-2026 · **Contra:** `origin/main` = `b78a3b1f5e41ee40d009dfd6bee48c9637722280`
**Rama:** `scrum-536-inventario-skills` · **SCRUM-536**
**Alcance:** solo lectura. **NO se corrige NADA.** Ni una frase de ninguna skill. Este documento es
la LISTA con la que el fundador decide qué corregir.
**Se apoya en:** `docs/legal/AUDITORIA_CAMINO_EMISION.md` (SCRUM-525) para qué existe en el código,
y `docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md` (SCRUM-528) para el **criterio de
clasificación**, que no se reinventa aquí. Ambos comprobados en `origin/main` antes de empezar.

> **Por qué esta zona y por qué ahora.** SCRUM-528 inventarió cuatro zonas y encontró 61
> afirmaciones, 19 falsas. **No inventarió `.claude/skills/`**, y la diferencia no es de tamaño
> sino de mecanismo de entrega:
>
> | Zona | Cómo llega a una sesión |
> |---|---|
> | `docs/YAQU_MASTER.md` | alguien lo pega, o la sesión lo abre |
> | `docs/legal/` | sólo si el encargo lo manda |
> | **`.claude/skills/`** | **se carga sola, en toda sesión que arranque en el repo** |
>
> Una afirmación falsa en un documento **espera** a que alguien la lea. Una afirmación falsa en una
> skill **se le entrega** a cada sesión sin que nadie la pida.

> **Regla de lectura (heredada de SCRUM-528):** si un documento y el código discrepan, **gana el
> código**. Toda afirmación va con fichero, línea y texto literal; lo que no tiene coordenada se
> marca **NO MEDIDO**, con esas palabras.

---

## La respuesta a la hipótesis del encargo, antes que nada

El encargo la planteó como hipótesis que podía estar equivocada y pidió medirla, no confirmarla.
**No estaba equivocada.**

`yaqu-verifactu-sif` contiene **seis afirmaciones de clase A** — la misma familia que las 19 del
máster. Entre ellas, **la más expuesta de todo el repositorio**: su propio campo `description`
(`:3`), que nombra *"cola VfSubmission, envío AEAT"* y que **no se carga al invocar la skill, sino
en toda sesión** (§ *Superficie de exposición*).

Y la frase que el encargo pidió por escrito si la skill salía limpia **no se puede escribir**: no
está limpia.

---

## Los números, y cuadran

| Clase | Qué significa | Cuántas |
|---|---|---|
| **A** | Falsa por la auditoría — describe un envío, una cola o un interruptor que **no existen** | **7** |
| **B** | Falsa por la decisión solo-VeriFactu — firma del registro, XAdES, eventos, verificación presencial | **0** |
| **C** | Ambigua — admite dos lecturas y una es falsa | **5** |
| **D** | Correcta — se anota para que se vea qué se salva | **29** |
| | **TOTAL de afirmaciones encontradas** | **41** |

`7 + 0 + 5 + 29 = 41`. Si alguien añade o retira una entrada, este total tiene que moverse con ella.

**Reparto por skill, que es el dato que decide dónde hay que actuar:**

| Skill | A | B | C | D | Total | Veredicto |
|---|---|---|---|---|---|---|
| `yaqu-verifactu-sif` | **6** | 0 | **3** | 8 | 17 | 🔴 la zona caliente |
| `yaqu-release-check` | **1** | 0 | 0 | 0 | 1 | 🟠 una entrada |
| `cerebro-yaqu` | 0 | 0 | **1** | 1 | 2 | 🟡 remite al H2 |
| `verifactu` | 0 | 0 | **1** | 19 | 20 | 🟢 limpia (su única C es el H2) |
| `yaqu-sprint` | 0 | 0 | 0 | 1 | 1 | 🟢 limpia |
| `yaqu-fase-b` | 0 | 0 | 0 | 0 | 0 | 🟢 sin afirmaciones fiscales |
| `yaqu-premium-ui` | 0 | 0 | 0 | 0 | 0 | 🟢 sin afirmaciones fiscales |
| `yaqu-wa-templates` | 0 | 0 | 0 | 0 | 0 | 🟢 sin afirmaciones fiscales |
| `impeccable` (terceros) | 0 | 0 | 0 | 0 | 0 | 🟢 cero menciones reales |

`6+1 = 7` A · `3+1+1 = 5` C · `8+1+19+1 = 29` D. Cuadra con la tabla de arriba.

### La clase B es CERO, y se dice así en vez de rellenarla

**Ninguna skill afirma que YaQu firme los registros.** No es que no se haya buscado: la pasada
`xades | sistema dual | registro de eventos | EventosSIF | verificacion presencial` dio **9
aciertos** y **los nueve dicen lo contrario de lo que la clase B castiga** — que esas piezas
**no** se implementan. `yaqu-verifactu-sif:19-20` lo prohíbe explícitamente, y coincide con
`verifactu:142-148`. En la única zona donde las dos skills del tema podían chocar, **no chocan**.

---

## Cómo se leyó, y qué vio cada instrumento POR SEPARADO

**① Recorrido y barrido del directorio (sonda propia en Node, escrita a fichero).** Recorre
`.claude/skills/` entero —no la lista del lock— y hace **ocho pasadas** de vocabulario fiscal sobre
los 93 ficheros. Resultado por pasada: `verifactu|sif` 54 · `fiscal generico` 31 ·
`envio|cola|remision` 31 · `aeat|hacienda` 25 · `huella|qr|xsd` 21 · `claims|certificacion` 18 ·
`interruptor` 11 · `firma fiscal` 9.

> 🔴 **Por qué la sonda no usa `grep` con acentos, y no es una precaución teórica.** El encargo
> avisó de una medición de hoy: `grep -E "remisi[oó]n"` devolvió **CERO** donde hay **CINCO** — en
> este entorno una clase de corchetes con un carácter acentuado no casa. La sonda **normaliza el
> texto** (NFD, se retiran los diacríticos) antes de comparar, así que *remisión*, *remision* y
> *REMISIÓN* son el mismo acierto, y **el acento deja de decidir si algo existe**. Lleva dos
> controles que abortan declarándose ciega: uno **positivo** (`VfSubmission` tiene que aparecer en
> `yaqu-verifactu-sif`) y uno **de acentos** (`remisión` tiene que casar con `remision`).

**② Lectura verbatim.** Se leyeron **enteros y línea a línea** los 8 `SKILL.md` locales:
`cerebro-yaqu` (56), `verifactu` (299), `yaqu-fase-b` (36), `yaqu-premium-ui` (41),
`yaqu-release-check` (58), `yaqu-sprint` (36), `yaqu-verifactu-sif` (50) y `yaqu-wa-templates` (43).
De `impeccable` (85 ficheros, 42.978 líneas, terceros) se leyó sólo el resultado del barrido.

**Qué aportó cada uno, y no es lo mismo:**

* Sólo el **barrido** encontró la entrada de `yaqu-release-check:47` — un documento fiscal
  inexistente citado de pasada en una lista de ejemplos, dentro de una skill que nadie asocia con
  VeriFactu.
* Sólo la **lectura** encontró que el `description` de `yaqu-verifactu-sif` es una afirmación en sí
  mismo, y no una etiqueta: el barrido lo cuenta como una línea más del fichero y **no sabe que esa
  línea concreta tiene un mecanismo de entrega distinto al resto**. Ese es el hallazgo principal de
  este inventario y **ningún instrumento de texto lo habría jerarquizado**.
* Sólo la **lectura** estableció que `verifactu` y `yaqu-verifactu-sif` se contradicen (§
  *Contradicciones*): las dos usan el mismo vocabulario y el barrido las puntúa igual de "densas en
  VeriFactu". **La densidad no distingue afirmar de desmentir.**
* Los **dos** coincidieron en las cuatro entradas del núcleo de `yaqu-verifactu-sif` (`:26-31`).

### 🔴 El ruido que hubo que descartar, y cómo

El barrido dio **8 aciertos de `sif` en `impeccable`**, una skill de diseño frontend. **Los ocho son
falsos positivos por subcadena:** `sif` dentro de `clas`**`sif`**`y`, `clas`**`sif`**`ication` e
`Inten`**`sif`**`ication`. Comprobado con una segunda pasada que extrae la palabra completa. Búsqueda
directa de `verifactu` en los 85 ficheros de `impeccable`: **cero**.

Lo mismo, más discreto, dentro de casa:

* `yaqu-fase-b:8` y `:29` — *"los envíos"*, *"un envío de"*: son mensajes de **WhatsApp**, no AEAT.
* `yaqu-release-check:26` y `:28` — *"Está APAGADO a propósito"* se refiere a `ACTIVO = false` de
  `scripts/_evidencia-tanda.mjs`, **no** al envío. Es el mismo caso que `PREGUNTAS_ASESOR.md:251` en
  SCRUM-528: no es hallazgo.
* `yaqu-release-check:57` y `yaqu-sprint:13` — *"la cola U"*, *"cola única"*: es el **Sprint
  Registry**, no la cola de remisión.
* `yaqu-wa-templates:16` — *"reclasifica"*, otra vez la subcadena. `:31-32` son plantillas de cobro
  que dicen *"nº factura"*.

**Sin esta pasada de descarte, este inventario habría reportado 8 falsos y cuatro zonas calientes
que no lo son.** Un acierto de subcadena y una afirmación falsa se cuentan igual de bien.

---

# CLASE A · falsa por la auditoría (7)

> No hay envío, no hay cola y no hay interruptor (auditoría §1, eslabones 8 y 9: **NO EXISTE**).
> Verificado además aquí, de primera mano y no heredado: `VfSubmission` **no aparece** en
> `prisma/schema.prisma`, y el único acierto de
> `prewww1 | VerifactuSOAP | https.Agent | mTLS | fast-xml-parser` en todo `src/` es
> `modoVisible.ts:21`, **un comentario que dice justamente que no existe**.
> Formato: **id · fichero:línea** → texto literal → por qué es falsa.

## En `yaqu-verifactu-sif` (6)

**A1 · `.claude/skills/yaqu-verifactu-sif/SKILL.md:3` — el `description`, y es la de más impacto de todo el repo**
> `description: Obligatoria al tocar CUALQUIER cosa de VeriFactu/SIF (huella, QR, registros, cola`
> `VfSubmission, envío AEAT, R1/anulación).`

Nombra **dos cosas que no existen** —la cola `VfSubmission` y el envío AEAT— y las nombra en el
único campo de una skill que **no requiere invocación para llegar a la sesión**: el `description`
viaja en el catálogo de skills de **todas** las sesiones abiertas en este repo (§ *Superficie de
exposición*, donde está medido cómo se comprobó). Las otras cinco de esta skill hay que ir a
buscarlas; **ésta se entrega sola**.

**A2 · `:26-27` — el protocolo de un envío que no está escrito**
> *"**Flujo de control AEAT:** respetar `TiempoEsperaEnvio` de cada respuesta (mín. 60 s); máx 1.000
> registros/envío; sin respuesta → reenviar los mismos registros."*

Tres reglas operativas de una conversación con la AEAT que **el código no mantiene** (auditoría §1,
eslabón 9). Quien las lea concluye que hay un cliente que espera, trocea y reintenta.

**A3 · `:28-29` — la FSM de una entidad que no existe**
> *"**FSM `VfSubmission` (Parte L):** `pending → sent → accepted` · `sent → rejected(error) →
> pending(retry, attempts++)` · `attempts>=5 → manual_review`. `accepted` es terminal."*

Gemela de **A2 del máster** (`YAQU_MASTER.md:389`), y aquí pesa más: allí es una sección de un
documento que hay que abrir; aquí es una **regla dura** de una skill que se carga al tocar el tema.
`VfSubmission` no está en el esquema — medido arriba.

**A4 · `:30-31` — el interruptor que no interrumpe nada**
> *"**`SIF_ENABLED` off = seguro:** la cola pausa, la emisión local sigue; al reanudar se remite lo
> pendiente. Jamás bloquear la emisión por un fallo de remisión (runbook R7)."*

Gemela de **A4 y A3 del máster**. Describe un rollback de una cola inexistente y un *"al reanudar se
remite"* que no puede ocurrir: la bandera hoy sólo **congela el modo fiscal en el registro de
auditoría** (auditoría §5). Es, además, la afirmación que `verifactu:23` desmiente palabra por
palabra (§ *Contradicciones*).

**A5 · `:47` — el QA de una cola que no hay**
> *"- [ ] Rechazo forzado → retry con backoff → `manual_review` al 5º intento."*

Un checklist marcable para un mecanismo inexistente. Nadie puede marcarlo, y quien lo intente
buscará durante un rato.

**A6 · `:49` — evidencias de unas pruebas que no se han podido hacer**
> *"- [ ] Evidencias de pruebas AEAT → `docs/VERIFACTU_EVIDENCIAS.md`."*

Doble: **no hay pruebas contra la AEAT** (no hay envío), y **el documento no existe** — comprobado:
`ls docs/VERIFACTU_EVIDENCIAS.md` → *No such file or directory*, mientras que `docs/EVIDENCIAS_E2E.md`,
citado a su lado en otra skill, **sí** existe.

## En `yaqu-release-check` (1)

**A7 · `.claude/skills/yaqu-release-check/SKILL.md:47`**
> *"marcar el done de la fila con motivo/evidencias (capturas, IDs, docs de evidencia que pida la
> tarea, p. ej. `EVIDENCIAS_E2E.md`, **`VERIFACTU_EVIDENCIAS.md`**)."*

El mismo documento inexistente que A6, en la skill de **cierre de sprint** — es decir, en el momento
del proceso en que alguien va a buscarlo de verdad para dar un sprint por cerrado. **Es la única
entrada de este inventario que vive fuera de las dos skills del tema**, y la encontró el barrido, no
la lectura: nadie habría ido a auditar VeriFactu dentro del checklist de release.

---

# CLASE B · falsa por la decisión solo-VeriFactu (0)

**Ninguna.** Y no por no buscarla: ver § *La clase B es CERO*. Las nueve menciones de la familia de
firma dicen lo contrario de lo que esta clase castiga.

---

# CLASE C · ambigua, dos lecturas y una es falsa (5)

**C1 · `yaqu-verifactu-sif:39-42` — un stack "decidido" que se lee como "montado"**
> *"## Stack (decidido en S1-0b — no re-litigar sin cambio de master) · mTLS nativo de Node
> (`https.Agent` con cert/pfx) contra `prewww1.aeat.es/.../VerifactuSOAP` (pruebas) y
> `www1.agenciatributaria.gob.es/...` (prod). · SOAP 1.1 document con plantillas XML propias;
> respuesta con `fast-xml-parser`. · Sin `node-soap`, sin librerías de firma."*

**Lectura verdadera:** es la decisión de arquitectura tomada en S1-0b, y como decisión sigue en pie.
**Lectura falsa:** que ese cliente exista. **No existe ni una línea:** el único acierto de esos
términos en `src/` es el comentario de `modoVisible.ts:21` que dice que no hay clientes SOAP/mTLS.
Un endpoint de producción escrito con nombre y ruta se lee como algo que ya se usa.

**C2 · `yaqu-verifactu-sif:32-33` · C3 · `cerebro-yaqu:53-54` · C4 · `verifactu:229-231` — las tres remisiones al guion H2**
> `yaqu-verifactu-sif:32-33` — *"**Cero claims** hasta SIF-1 8/8 (regla 7): nada de «VeriFactu» en
> UI/copy de venta; la pregunta del cliente se responde SOLO con el guion H2."*
>
> `cerebro-yaqu:53-54` — *"VeriFactu se responde SOLO con el guion H2"*
>
> `verifactu:229-231` — *"**Regla 26 del máster: la pregunta de VeriFactu se contesta SÓLO con el
> guion oficial H2.** Ni con esta skill, ni con la auditoría, ni con una versión propia que suene
> mejor."*

**Se cuentan como tres entradas porque son tres ficheros distintos**, pero son **un solo defecto con
tres bocas**. **Lectura verdadera:** las tres citan bien la regla 26 (`YAQU_MASTER.md:245`), que
existe y dice exactamente eso. **Lectura falsa:** que seguirlas sea seguro. El guion H2 es **A1 de
SCRUM-528** — *"la facturación VeriFactu **está construida** y en certificación"* — y la auditoría lo
desmiente. **Obedecer estas tres líneas al pie de la letra produce hoy una afirmación falsa delante
de un cliente.**

> 🔴 **Y la tercera es la que más dice.** `verifactu` es la skill limpia, la escrita **después** de
> la auditoría y **contra** ella: desmiente el H2 en su propia tabla (`:23`) y aun así **manda usar
> el H2** doce líneas más abajo, blindándolo (*"ni con esta skill, ni con la auditoría"*). No es un
> descuido: es que **corregir el guion H2 no está al alcance de una skill** —es microcopy del máster,
> regla 30— así que hasta la skill que sabe que es falso tiene que remitir a él. **Ninguna de las
> tres se arregla en `.claude/skills/`; las tres se arreglan arreglando el H2.**

**C5 · `yaqu-verifactu-sif:48` — el `off` que da por hecho un `on`**
> *"- [ ] `SIF_ENABLED=off` no rompe la emisión local."*

**Lectura verdadera:** literalmente cierto hoy, y es un buen control. **Lectura falsa:** que exista
un `on` con comportamiento propio que probar en el otro lado. Se distingue de A4 a propósito: A4
**describe** el mecanismo inexistente; C5 sólo lo **presupone**.

---

# CLASE D · correcta, se anota para que se vea qué se salva (29)

> Se anotan porque el saldo importa: **de las 41 afirmaciones, 29 son correctas, y 19 de ellas están
> en una sola skill.**

## `yaqu-verifactu-sif` — lo que sí se sostiene (8)

| id | línea | Afirmación | Por qué es correcta |
|---|---|---|---|
| D1 | `:13` | leer `docs/SIF_SPEC_NOTES.md` | el fichero **existe** (comprobado) |
| D2 | `:14` | leer U1.3 y las 8 obligatorias S1-A..S1-H | existen: `YAQU_MASTER.md:945` |
| D3 | `:15` | *"**Si existe**, leer `docs/AUDITORIA_RRSIF.md`"* | existe — y va condicionado, que es la forma correcta de nombrar un documento que puede no estar |
| D4 | `:19-20` | modalidad VERI*FACTU: **no** XAdES, **no** `EventosSIF` | coincide con `verifactu:142-148` y con el art. 16.3 RRSIF |
| D5 | `:21-22` | regla 29: una emitida no se edita ni borra; corrección = R1 vinculada | verificado en el código en SCRUM-308 |
| D6 | `:23-25` | la huella encadenada no se toca sin re-validar contra el XSD | la huella **existe** (auditoría §1, eslabón 4) |
| D7 | `:34-35` | stop conditions AA1.4 (producción AEAT, declaración responsable, legal público) | vigentes |
| D8 | `:46` | registros alta/anulación/R1 validan contra los XSD | el XML existe (eslabón 7); `S1-C ✅` en `YAQU_MASTER.md:945` |

## `cerebro-yaqu` (1) y `yaqu-sprint` (1)

| id | fichero:línea | Afirmación |
|---|---|---|
| D9 | `cerebro-yaqu:35-36` | «Fiscal» es un STOP que exige GO del fundador |
| D10 | `yaqu-sprint:22` | stop condition AA1.4: claims fiscales/VeriFactu |

## `verifactu` — la skill que ya está corregida (19)

Se anotan porque **son el material con el que se corrigen las demás**, y porque el encargo pidió que
la skill nueva no tuviera trato de favor: se leyó entera, línea a línea, y **no se le encontró
ninguna A ni ninguna B**.

| id | línea | Afirmación |
|---|---|---|
| D11 | `:23` | *"No está construido. No hay envío a la AEAT ni lo ha habido nunca"* |
| D12 | `:24` | en VeriFactu **no se firma**: art. 16.3 RRSIF dispensa, basta la huella |
| D13 | `:25` | **no existe** la certificación de VeriFactu; el régimen es declaración responsable (art. 13) |
| D14 | `:26` | no somos colaboradores sociales |
| D15 | `:27` | 1-ene-2027 sociedades · **1-jul-2027 autónomos**, que es nuestro cliente |
| D16 | `:33-46` | los nueve pasos: siete existen, la cola y el envío no |
| D17 | `:48-49` | *"ese XML se descarga. No se transmite."* |
| D18 | `:51-53` | *"entre hoy y el envío no hay «encender», hay **construir**"* |
| D19 | `:55-67` | carril A / carril B, y **el código no contempla ninguno** |
| D20 | `:69-71` | validación **4112**: el titular del certificado debe ser Obligado, Colaborador Social, Apoderado o Sucesor |
| D21 | `:85-91` | los tres semáforos, y **ninguno mira antes de enviar** |
| D22 | `:100-107` | la normativa con su BOE (RD 1007/2023, Orden HAC/1177/2024, RD-ley 15/2025, DGT V2484-24) |
| D23 | `:136-152` | modalidad VeriFactu y lo que hace caer (arts. 6.b–f, 7, 8 y 9 de la Orden) |
| D24 | `:187-192` | con clave `I` **no** se rellena `ImporteRectificacion` (validaciones 1118/1119) |
| D25 | `:194` | *"`verifactu.service.ts:673` tiene un comentario que **miente**"* |
| D26 | `:198-215` | las tres categorías de error de la AEAT (4xxx/35xx · 1xxx/30xx · 2xxx) |
| D27 | `:221-231` | la declaración responsable **no se presenta ante la AEAT**: es requisito de interfaz |
| D28 | `:247-250` | `INVOICING_ES_ENABLED` está **AUSENTE** de Railway, que no es lo mismo que `false` |
| D29 | `:285-287` | remite a la auditoría SCRUM-525 como estado del código |

> **D25 se confirma de forma independiente.** El mismo comentario obsoleto de
> `verifactu.service.ts:673` se reportó en la medición de rectificativas de SCRUM-308 (17-ago), sin
> conocer esta skill. **Dos mediciones separadas, el mismo defecto, la misma línea.**

---

# Contradicciones entre skills — la pregunta que las otras zonas no tenían

**Sí las hay, y son frontales.** `verifactu` y `yaqu-verifactu-sif` **se cargan las dos ante la misma
tarea** —cualquier cosa de facturación española— y dicen lo contrario. Ninguna advierte de la otra:
`yaqu-verifactu-sif` es de **12-jun-2026** y no puede citar a `verifactu`, que es de **19-ago-2026**;
y `verifactu` **no nombra a `yaqu-verifactu-sif` ni una vez** (comprobado: cero aciertos de
`yaqu-verifactu-sif` en su texto).

| # | `yaqu-verifactu-sif` dice | `verifactu` dice | Quién tiene razón |
|---|---|---|---|
| 1 | `:30` *"`SIF_ENABLED` off = seguro: **la cola pausa**… al reanudar **se remite** lo pendiente"* | `:23` *"«Está construido y apagado, hay que activarlo» → 🔴 **No está construido**"* · `:51-53` *"no hay «encender», hay **construir**"* | **`verifactu`** (auditoría §1) |
| 2 | `:28-29` la **FSM de `VfSubmission`** como regla dura | `:45` *"⛔ La **cola de envío**"* — entre los dos pasos que **no existen** | **`verifactu`** |
| 3 | `:26-27` *"**Flujo de control AEAT:** respetar `TiempoEsperaEnvio`… máx 1.000 registros/envío"* | `:48` *"**No hay ni una sola llamada** del código hacia la Agencia Tributaria"* | **`verifactu`** |
| 4 | `:39-42` stack mTLS contra `prewww1.aeat.es/…/VerifactuSOAP` | `:46` el envío y la lectura de la respuesta ⛔ **no existen** | **`verifactu`** |

**Las cuatro son la misma contradicción vista desde cuatro sitios**, y las cuatro se resuelven a
favor de `verifactu`, que es la posterior y la que trae la auditoría detrás.

> 🔴 **Por qué esto es peor que una skill equivocada a solas, y no es retórica.** Las dos declaran
> autoridad sobre el mismo tema y **ninguna cede ante la otra**: `yaqu-verifactu-sif:8` dice *"Si
> chocan, gana el máster"* y `verifactu:10-11` dice *"Si una afirmación de esta skill contradice a
> `docs/YAQU_MASTER.md`, **gana el máster**"*. **Las dos remiten al máster como árbitro — y el
> máster es la zona donde SCRUM-528 encontró las 19 falsas.** El desempate apunta a la fuente menos
> fiable de las tres. Una sesión que cargue ambas elige sin saber que está eligiendo, y el criterio
> que tiene a mano para desempatar la manda al sitio equivocado.

### Una contradicción más, fuera del tema fiscal pero con víctima medida

`cerebro-yaqu:48` ordena: *"**Entrada en `YAQU_MASTER.md` al final.** Conflicto ahí = conservar AMBAS
entradas por nº de ticket."* El guard de **SCRUM-273** (`tests/scrum273-registro-por-fichero.test.mjs`)
**prohíbe exactamente eso** — *"ninguna entrada de trabajo NUEVA se escribe en `YAQU_MASTER.md`"* — y
manda `docs/master/SCRUM-<n>.md`. **La skill que se carga en toda sesión ordena lo que el CI bloquea.**
No es hipotético: pasó el 17-ago en SCRUM-308/ROAD-39, con el PR ya abierto. Se anota aquí porque el
encargo preguntó por contradicciones; **no es una afirmación sobre VeriFactu y por eso no entra en
los 41**.

---

# Superficie de exposición — qué se carga solo y qué no

**La distinción que importa no es «skill cargada / no cargada», sino que cada skill tiene DOS
superficies con exposición distinta**, y el inventario habría sido engañoso sin separarlas:

| Superficie | Qué es | Cuándo llega a la sesión |
|---|---|---|
| **`description`** (frontmatter) | 1-4 líneas | **SIEMPRE.** Va en el catálogo de skills de toda sesión abierta en el repo, para que el modelo sepa cuándo invocarla |
| **Cuerpo del `SKILL.md`** | el resto | **sólo al invocarla** (por el modelo o con `/nombre`) |

**Cómo se comprobó, y es medición del entorno, no lectura del repo:** el catálogo de skills de
**esta misma sesión** lista las nueve con su `description` **completa**, incluida la de
`yaqu-verifactu-sif` con *"cola VfSubmission, envío AEAT"* — sin que ninguna se haya invocado. La de
`verifactu` apareció en el catálogo **a mitad de sesión**, al añadirse la skill, con el mismo
tratamiento.

**Consecuencia directa para la clase A:** de las 7 afirmaciones falsas, **A1 tiene exposición
permanente** y las otras 6 son condicionales. A1 no es «una de siete»: es la única que ya se ha
entregado a cada sesión abierta desde el 12-jun-2026 sin que nadie la pidiera.

**Y por invocación, las nueve se reparten así:**

| Se invoca sola (su `description` lo ordena) | Sólo por invocación explícita |
|---|---|
| `cerebro-yaqu` — *"Usar **SIEMPRE** al arrancar cualquier tarea"* | `yaqu-sprint` — *"o cuando el usuario invoque `/yaqu-sprint`"* |
| `verifactu` — *"**Úsala SIEMPRE** que la tarea toque facturación española"* | `yaqu-release-check` — *"o el usuario invoque `/yaqu-release-check`"* |
| `yaqu-verifactu-sif` — *"**Obligatoria** al tocar CUALQUIER cosa de VeriFactu/SIF"* | `yaqu-fase-b` — *"o cuando el usuario invoque `/yaqu-fase-b`"* |
| `yaqu-premium-ui` — *"**Obligatoria ANTES** de tocar cualquier UI"* | `yaqu-wa-templates` — *"o cuando el usuario invoque `/yaqu-wa-templates`"* |
| `impeccable` — *"Use when the user wants to design…"* (terceros) | |

> **Las dos skills que se contradicen están las dos en la columna de la izquierda**, y sus
> disparadores se solapan: *"facturación española"* y *"CUALQUIER cosa de VeriFactu/SIF"*. **No hay
> escenario realista en que se cargue una sin la otra.**

---

# `impeccable` — terceros, y se dice aparte

**Cero afirmaciones sobre VeriFactu.** 85 ficheros, 42.978 líneas; los 8 aciertos del barrido son
falsos positivos por subcadena (`clas`**`sif`**`y`), verificados uno a uno.

Viene de fuera (`pbakaus/impeccable`) y está gobernada por `skills-lock.json` con hash contra el
origen: **modificarla rompería la verificación**, y por eso **aquí sólo se anota**. No hay nada que
anotar salvo que está limpia.

> ⚠️ **Y el lock no sirve para censar esta zona:** `skills-lock.json` lista **sólo `impeccable`**.
> Las **ocho skills locales no están en el lock**, así que un censo basado en él habría devuelto
> **una** skill y habría parecido una respuesta. Por eso el instrumento ① **recorre el directorio** y
> aborta declarándose ciego si encuentra menos de ocho.

---

# Lo que NO se pudo medir, con esas palabras

* **El contenido de `docs/SIF_SPEC_NOTES.md` y `docs/AUDITORIA_RRSIF.md`.** Las skills mandan
  leerlos (D1, D3) y **existen**, pero **no se han inventariado**: no son `.claude/skills/` y no
  estaban en las cuatro zonas de SCRUM-528. `SIF_SPEC_NOTES.md` es especialmente probable que
  contenga afirmaciones de clase A —`yaqu-verifactu-sif:13` promete que trae *"endpoints"* y *"flujo
  de control"*, que es justo el vocabulario de las falsas. **Zona pendiente, no zona limpia.**
* **Si alguna sesión ha actuado sobre estas afirmaciones.** Se ha medido lo que las skills **dicen**,
  no lo que se ha **hecho** con ello. Haría falta leer transcripciones, que no están en el repo.
* **El `description` real que recibe el modelo, byte a byte.** Se ha medido lo que hay en el
  frontmatter del fichero y lo que aparece en el catálogo de esta sesión; **no se ha instrumentado el
  harness** para capturar el prompt exacto. La conclusión de exposición permanente descansa en esa
  observación, no en un volcado.
* **`impeccable` no se leyó verbatim.** 42.978 líneas. Se barrió con la sonda y se verificó el ruido;
  **no se descarta al 100% una afirmación fiscal que no use ninguno de los términos de las ocho
  pasadas**, aunque en una skill de diseño frontend escrita en inglés es muy improbable.

---

*Instrumentos: sonda propia en Node (recorrido + 8 pasadas normalizadas, con control positivo y
control de acentos) y lectura verbatim de los 8 `SKILL.md` locales. Estado del código: auditoría
SCRUM-525. Criterio de clasificación: SCRUM-528. **No se modificó ninguna skill.***
