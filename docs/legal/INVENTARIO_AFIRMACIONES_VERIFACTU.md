# Inventario de afirmaciones sobre VeriFactu — qué dice el repo frente a lo que hay

**Medido:** 19-ago-2026 · **Contra:** `origin/main` = `2501bfac7cb007a78674f2406cd175eae858091a`
**Rama:** `scrum-528-inventario-afirmaciones-verifactu` · **SCRUM-528**
**Alcance:** solo lectura. **NO se corrige NADA.** Ni código, ni `docs/YAQU_MASTER.md`, ni un texto
de usuario. Este documento es la LISTA con la que el fundador decide qué corregir.
**Se apoya en:** `docs/legal/AUDITORIA_CAMINO_EMISION.md` (SCRUM-525) — comprobada su presencia en
`origin/main` antes de empezar.

> **Por qué existe.** Dos cosas cambiaron el 19-ago-2026 y el repo no se ha enterado:
> ① la auditoría del camino de emisión midió que **no hay envío a la AEAT — no es que esté
> apagado, es que no está escrito**; ② los fundadores eligieron la modalidad **VERI*FACTU** y
> descartaron el sistema dual, y en esa modalidad **no se firma electrónicamente el registro**
> (art. 16.3 RRSIF: la huella encadenada basta).
>
> **Regla de lectura:** si un documento y el código discrepan, **gana el código**. Toda afirmación
> va con fichero, línea y texto literal; lo que no tiene coordenada se marca **NO MEDIDO**.

---

## Los números, y cuadran

| Clase | Qué significa | Cuántas |
|---|---|---|
| **A** | Falsa por la auditoría — describe un envío, una cola o un interruptor que **no existen** | **19** |
| **B** | Falsa por la decisión solo-VeriFactu — firma del registro, XAdES, eventos, verificación presencial | **1** |
| **C** | Ambigua — admite dos lecturas y una es falsa | **16** |
| **D** | Correcta — se anota para que se vea qué se salva | **25** |
| | **TOTAL de afirmaciones encontradas** | **61** |

`19 + 1 + 16 + 25 = 61`. Si alguien añade o retira una entrada, este total tiene que moverse con
ella: una clasificación cuyas partes no suman su total no es una clasificación.

---

## Cómo se leyó, y qué vio cada instrumento POR SEPARADO

Son dos, y se declaran aparte a propósito: una afirmación puede ser falsa **sin usar ninguna
palabra clave** —describir un flujo con un paso de envío que no existe, sin nombrarlo— y por eso
la búsqueda de texto sola no basta.

**① Búsqueda de texto (sonda propia, `barrido.mjs`, escrita a fichero).** 104 ficheros barridos:
`docs/YAQU_MASTER.md`, los 12 de `docs/legal/`, el dominio de facturación y de fiscal en `src/`,
`src/lib/invoicing.ts`, `src/core/flags.ts` y los 80 de `public/dashboard/js/`. Ocho pasadas:
`remisi|remit|transmis` (70 aciertos) · `apagad|activar|encender|interruptor|kill-switch` (61) ·
`AEAT` (187) · `firm` (1.302) · la familia de firma en contexto fiscal (24) ·
`XAdES|sistema dual|registro de eventos|verificación presencial` (14) ·
`VfSubmission|cola|se envía` (45) · `VeriFactu|Hacienda` en la superficie del usuario (30).

> 🔴 **Un fallo del instrumento, medido y corregido, que conviene que conste.** La primera pasada
> se hizo con `grep -E "remisi[oó]n"` y devolvió **CERO**. Hay cinco. En este entorno una clase de
> corchetes con un carácter acentuado **no casa**, así que el patrón medía los escapes del shell y
> no el texto. Por eso la sonda se escribió a fichero y en Node, con UTF-8 de verdad. Un «cero» de
> un instrumento roto se lee exactamente igual que un «no lo hay».

**② Lectura del documento.** El máster se leyó entero por secciones: el cuerpo normativo
(PROJECT BRIEF y Partes A–U1.7, V, W, X, Y, Z, VISIÓN NORTE, AA, AB y los dos apéndices) **verbatim**;
en el tramo de registro de trabajo (líneas 1180-1650, entradas `✅ SCRUM-<n>` históricas) se leyeron
**verbatim las 60 líneas que llevan vocabulario fiscal**, extraídas por sonda, más los bloques
1325-1345 y 1488-1520 completos. Se leyeron enteros: `AUDITORIA_CAMINO_EMISION.md`,
`DECLARACION_RESPONSABLE.md`, `PACK_GESTORIA.md`, `ALCANCE_BETA.md`, `EMAIL_ASESOR.md`,
`modoVisible.ts` y el bloque fiscal de `settingsView.js` y `semaforoFiscal.js`.

**Qué aportó cada uno, y no es lo mismo:**

* Sólo el **texto** encontró: las cuatro de `PACK_GESTORIA.md`, las cuatro de
  `DECLARACION_RESPONSABLE.md`, las tres de `SEMAFORO_CALIBRACION.md` y la fila `SIF_ENABLED` de
  la Parte P — todas llevan `remit`/`apagad` dentro.
* Sólo la **lectura** encontró: la **máquina de estados de `VfSubmission` en la Parte L**
  (una FSM oficial de una entidad que no existe; no dice «envío» ni «apagado» en ninguna parte),
  el **badge verde «✓ VeriFactu»** del detalle de factura (una afirmación de conformidad hecha con
  dos palabras y un check), y el **rollback «SIF off (emisión local sigue)»** de la tabla U1.
* Los **dos** coincidieron en el guion H2 y en el runbook R7.

**La trampa de la firma, y cómo se evitó.** `firm` da **1.302 aciertos** y la inmensa mayoría son
legítimos: la firma del cliente en el albarán y en el presupuesto (`signaturePad.js`,
`colaDeFirmas.js`, `estadoFirma.js`, `INVESTIGACION_ALBARANES.md`, evidencias eIDAS), `confirm`, y
`firmante`. Contarlas habría sido ruido. Se leyó el contexto de cada acierto en zona fiscal, y **la
afirmación que el encargo esperaba encontrar —«YaQu genera Y FIRMA los registros»— NO EXISTE HOY EN
EL REPO**: `genera y firma`, `firma los registros`, `firma electrónica de los registros` y
`registro firmado` devuelven **cero** en `docs/`, `src/` y `public/`. La clase B tiene **una sola**
entrada, y se dice así en vez de rellenarla.

**Lo mismo, en la otra dirección, con «apagado».** `PREGUNTAS_ASESOR.md:251` y `:282` dicen «rama
apagada», pero se refieren a la rama de código `SIMPLIFICADA_F2` que espera un dictamen — **no** al
envío. No son hallazgo.

---

# CLASE A · falsa por la auditoría (19)

> No hay envío, no hay cola y no hay interruptor. Estas 19 describen alguna de las tres.
> Formato: **id · fichero:línea** → texto literal → por qué es falsa.

## En el máster (7)

**A1 · `docs/YAQU_MASTER.md:214` — el guion H2, y es el de más impacto**
> *"Te contesto como fabricante: la facturación VeriFactu **está construida** y en certificación —
> con declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no puedo
> **activarla** hasta cerrarla; por eso la beta es de presupuestos y cobros."*

La **regla 26 lo declara la ÚNICA respuesta autorizada** a «¿me vale para VeriFactu?». Afirma dos
cosas que la auditoría desmiente: que **está construida** (faltan los dos últimos eslabones, §1) y
que basta **activarla** (no hay nada que activar: no está escrito). Es la frase que se dice en
voz alta delante de un cliente.

**A2 · `docs/YAQU_MASTER.md:389` — la FSM de una entidad que no existe**
> `**VfSubmission:** pending → sent → accepted · sent → rejected(error) → pending(retry,
> attempts++) · attempts≥5 → manual_review. accepted terminal.`

La **Parte L se declara «FUENTE DE VERDAD (regla 27)»** y publica la máquina de estados de una
entidad que **no está en el esquema** (auditoría §1, eslabón 8: ningún modelo `Vf*`, `*Submission`
ni `*Verifactu`). Es la fuente de la que beben A4, A8 y el runbook R7. **La encontró la lectura, no
la búsqueda de texto**: no dice «envío» ni «apagado» en ninguna parte.

**A3 · `docs/YAQU_MASTER.md:434` — el runbook R7**
> `R7 · SIF rechaza registros: leer VfSubmission.lastError → dato de factura: corregir vía R1 si
> emitida; … la emisión local sigue y **la cola remite al reanudar**.`

Manda leer una columna de una tabla inexistente y describe una cola que se reanuda. Quien lo siga
durante una incidencia no encuentra nada que leer.

**A4 · `docs/YAQU_MASTER.md:450` — la fila `SIF_ENABLED` de la Parte P**
> Columna *Activa*: `admin tras pruebas AEAT` · columna *Desbloquea*: `remisión a AEAT` ·
> columna *Rollback*: `seguro: cola pausa, emisión local sigue`

Dice que un admin la enciende y que el rollback pausa la cola. Ni una cosa ni la otra: la bandera
**se lee y se guarda**, y **no hay ninguna rama del código que al ponerla en verdadero empiece a
transmitir** (auditoría §5).

**A5 · `docs/YAQU_MASTER.md:708`**
> `SIF_ENABLED **gobierna la remisión a AEAT**, un paso posterior e independiente`

No gobierna ninguna remisión: hoy solo **congela el modo fiscal en el registro de auditoría**
(`invoiceNumber.service.ts:310`, auditoría §5).

**A6 · `docs/YAQU_MASTER.md:956` — la casilla de rollback de SIF-1 en la tabla U1**
> `Rollback: **SIF off (emisión local sigue)**`

Promete un apagado que devuelve el sistema a «emisión local». Hoy **solo hay emisión local**: no
existe el estado del que se volvería.

**A7 · `docs/YAQU_MASTER.md:1547`**
> `(en el export de inspección, NO en remisión, **que está apagada**)`

«Apagada» presupone que existe. Es la frase de A9/A10 replicada dentro del máster al copiar la
conclusión del semáforo de calibración.

## En `docs/legal/` (12)

**A8 · `SEMAFORO_CALIBRACION.md:197`**
> `La cola VfSubmission (máster, Parte L) **es el sitio donde se gestionan**`

Presente de indicativo sobre un mecanismo inexistente, **citando como autoridad la Parte L**, que
es A2. Dos documentos sosteniéndose el uno al otro.

**A9 · `SEMAFORO_CALIBRACION.md:262-263`**
> `Además la remisión **está apagada** (INVOICING_ES_ENABLED=OFF, regla 7). **Nadie está enviando
> esto a la AEAT.**`

Dos defectos en una frase: «apagada» (no existe) y **la bandera equivocada** — la propia Parte P
asigna la remisión a `SIF_ENABLED`, no a `INVOICING_ES_ENABLED`. La conclusión («nadie está
enviando») es correcta; el motivo que da, no.

**A10 · `SEMAFORO_CALIBRACION.md:421`**
> `no en remisión, **que está apagada**, pero ponen código y color a pendientes que hoy son prosa`

Lo mismo, en el resumen ejecutivo del documento.

**A11 · `PACK_GESTORIA.md:13-14` — el documento que se entrega a la gestoría**
> `emite cada factura con una huella digital encadenada y la **remite automáticamente a la AEAT**
> en el momento.`

Se usa además en inspección (runbook R13). Afirma en presente una remisión automática que no
existe.

**A12 · `PACK_GESTORIA.md:18-19`**
> `Cada registro de facturación (alta, rectificativa y anulación) **se envía a la AEAT en tiempo
> real** a través de su servicio web.`

Con el detalle técnico del servicio web. **No hay ni una llamada de red a la AEAT en todo `src/`**
(auditoría §1, medido con los dos instrumentos y con control positivo).

**A13 · `PACK_GESTORIA.md:21`**
> `la huella SHA-256 encadenada + **la remisión autenticada** cumplen el requisito (RRSIF).`

La mitad de la frase que sostiene la conformidad es la remisión. (La otra mitad —«no se exige firma
electrónica»— es correcta: ver **D9**.)

**A14 · `PACK_GESTORIA.md:39`**
> `Al cobrar, YaQu emite la factura, calcula su huella y **la remite a la AEAT**.`

Es el paso 3 de «Cómo funciona en el día a día de tu cliente». El paso no ocurre.

**A15 · `PACK_GESTORIA.md:65`**
> `es el sistema de **facturación** que **genera y remite** los registros`

Define el producto ante la gestoría por una función que no tiene.

**A16 · `DECLARACION_RESPONSABLE.md:11-12` — documento que se FIRMA (art. 13 RRSIF)**
> `Los valores del sistema DEBEN coincidir con el bloque SistemaInformatico que **YaQu remite en
> cada registro de facturación**`

Instrucción de cumplimentación que da por hecha una remisión inexistente.

**A17 · `DECLARACION_RESPONSABLE.md:39-40`**
> `**Tipología:** sistema informático de facturación en modalidad **VERI*FACTU** (**remisión de los
> registros de facturación a la AEAT**).`

Es el contenido que se declara bajo responsabilidad. Firmado hoy, declararía una tipología que el
sistema no cumple. (La frase que sigue, «No opera en modo no verificable», sí es correcta: **D11**.)

**A18 · `DECLARACION_RESPONSABLE.md:48-49`**
> `…con huella **SHA-256 encadenada** (art. 12 RRSIF) y **remisión telemática al servicio web de la
> AEAT**.`

La primera mitad existe y está medida (auditoría §1, eslabones 4 y 5); la segunda, no.

**A19 · `DECLARACION_RESPONSABLE.md:53`**
> `**Remisión inmediata a la AEAT** (modalidad VERI*FACTU), **con control de flujo**.`

Declara además el **control de flujo**, que la auditoría §4 marca explícitamente **INEXISTENTE**
(«no hay envío que gobernar»).

> ⚠️ **Atenuante que hay que decir, y no anula nada.** `PACK_GESTORIA.md` y
> `DECLARACION_RESPONSABLE.md` llevan los dos en su cabecera la marca **PLANTILLA / BORRADOR — no
> distribuir hasta SIF-1 8/8**, y ninguno está publicado. Lo que se inventaría aquí es que **el
> texto que se publicará ese día ya afirma hoy cosas que el sistema no hace**: quien lo revise
> leerá afirmaciones ya escritas, no las escribirá de nuevo.

---

# CLASE B · falsa por la decisión solo-VeriFactu (1)

**B1 · `docs/YAQU_MASTER.md:434` — la cláusula de firma del runbook R7**
> `estructural (**XSD/firma**): SIF_ENABLED=false + avisar asesor`

En modalidad VERI*FACTU **el registro no se firma electrónicamente** (art. 16.3 RRSIF), y el propio
máster lo dice en S1-B (`:1023`): la modalidad *«evita firma por registro y registro de eventos del
modo no-remisión»*. Un rechazo de la AEAT «estructural de firma» **no puede ocurrir** en la
modalidad elegida: el runbook prepara al operador para un fallo inexistente. Es una afirmación
distinta de A3, escrita en la misma línea.

> 🔴 **El hallazgo de esta clase es su TAMAÑO.** El encargo daba por supuesto que habría varias
> («genera y firma», XAdES, registro de eventos, verificación presencial reforzada). **Hay una**, y
> los dos instrumentos coinciden:
>
> * `genera y firma`, `firma los registros`, `firma electrónica de los registros`, `registro
>   firmado`, `firmamos` → **cero aciertos** en `docs/`, `src/` y `public/`.
> * `XAdES` aparece **tres veces en el máster** (`:945`, `:1021`, `:1023`) y **las tres dicen que NO
>   se exige**; `SIF_SPEC_NOTES.md:7-13` lo razona con fuente AEAT.
> * `registro de eventos` / `EventosSIF` solo aparecen **para excluirlos** (modo no-VERI*FACTU).
> * `verificación presencial` **no aparece en ningún fichero del repositorio**.
>
> **La decisión solo-VeriFactu ya está bien reflejada en la documentación.** Lo que está mal
> reflejado es el envío.

---

# CLASE C · ambigua (16)

> Admiten dos lecturas y una es falsa. No se corrigen: se señalan para que el fundador decida si
> la lectura falsa importa en ese sitio concreto.

**C1 · `docs/YAQU_MASTER.md:39` — el flujo core del PROJECT BRIEF**
> `→ se genera justificante no fiscal — **o factura VeriFactu si INVOICING_ES_ENABLED** (post SIF-1)`

Lectura buena: la bandera decide qué DOCUMENTO sale. Lectura falsa, y es la literal: que con la
bandera puesta el flujo produce «factura VeriFactu» — que en esta modalidad significa registrada y
remitida. Con la bandera puesta hoy sale una factura sellada **en local** y nada más.

**C2 · `docs/YAQU_MASTER.md:51` — A1, la definición del producto**
> `con el gate fiscal cerrado (SIF-1, regla 24) **la factura VeriFactu se emite sola**`

Condicional a un gate futuro (lectura buena); pero «se emite sola» describe automatismo completo
sin decir que el envío hay que construirlo (lectura falsa).

**C3 · `docs/YAQU_MASTER.md:155` — Parte D2, capas y fase**
> `src/modules/fiscal/verifactu/ ← SIF-1 (F1): **sif.client.ts + cola VfSubmission**`

Es un mapa de capas por fase (lectura buena: está por construir). Leído como inventario de
arquitectura —que es como se lee un árbol de directorios— nombra dos piezas que no existen.

**C4 · `docs/YAQU_MASTER.md:384` — Parte L, FSM de `Invoice`**
> `Deshacer un paid erróneo: **SOLO si no remitida al SIF**; si remitida → R1 (runbook R5).`

La regla es correcta *para el día que haya remisión*; hoy establece una distinción operativa entre
dos estados de los que uno **no puede darse nunca**.

**C5 · `docs/YAQU_MASTER.md:432` — runbook R5**
> `factura **NO remitida a SIF** → "Deshacer pago" (admin, auditado). **Remitida** → R1 + nueva
> factura si procede.`

Misma bifurcación imposible, ahora en un procedimiento que alguien ejecuta con un cliente delante.

**C6 · `docs/YAQU_MASTER.md:496` — la excepción de The Pioneer (19-ago-2026)**
> `**Encender el flag** para que The Pioneer facture (**Modelo C: cada merchant remite con su
> propio certificado**) | ¿Necesita a la AEAT? **NO** | Cuándo: **Septiembre de 2026**`

Lectura buena: encender la bandera no necesita convenio con la AEAT. Lectura falsa: que en
septiembre The Pioneer facture **bajo Modelo C**, donde «cada merchant remite con su propio
certificado» — el carril merchant **no existe** (auditoría §2: no hay lectura de certificado, ni
mTLS, ni campo que distinga en nombre de quién se remite). Es la afirmación más **reciente** de
toda esta lista y la que tiene fecha más próxima.

**C7 · `docs/YAQU_MASTER.md:959` y `:190` — PRECIOS-1**
> `Done: **activación facturación** + 2 entitlements…` · `Semanas 6-7 · PRECIOS-1 (**activación
> facturación a founding**)`

«Activación» describe un interruptor. Es cierto para `INVOICING_ES_ENABLED` (que existe) y falso
para «facturación VeriFactu» entendida como el sistema completo. Dos coordenadas, una afirmación.

**C8 · `docs/YAQU_MASTER.md:1021` — el enunciado de S1-0b**
> `spec técnica AEAT (servicio web, XSD, **firma**) + decidir **librería XAdES en Node** [VALIDAR;
> … **microservicio mínimo Java/.NET SOLO para la firma**]`

La primera mitad describe trabajo que la modalidad elegida excluye. **La misma línea lo desmiente**
a continuación con su `✅ DONE 12-jun-26` (ver **D4**), así que solo engaña a quien lea media línea.

**C9 · `docs/legal/ALCANCE_BETA.md:28-29` — contrato del cliente founding**
> `La **facturación con sistema VERI*FACTU se activará al cerrar la certificación** del sistema,
> **sin cambio de precio** para ti.`

Lectura buena: se te dará cuando esté lista. Lectura falsa, y es la que sugiere el verbo: que la
certificación es el único paso que falta y después se «activa». Va **firmado por el cliente**.

**C10 · `docs/legal/EMAIL_ASESOR.md:22-23`**
> `La facturación con **VeriFactu** la **activaré** cuando tenga el sistema certificado`

Lo mismo, dicho al asesor fiscal, que es quien juzgará si el alcance es correcto.

**C11 · `docs/legal/SEMAFORO_MAPA_EMISION.md:312`**
> `Esto hay que decidirlo **antes de encender el envío**, no después.`

En un documento que dos párrafos antes dice, correctamente, que el envío no está construido
(**D13**). «Encender» contradice a su propio texto.

**C12 · `public/dashboard/js/invoiceDetailView.js:114` — lo que ve el profesional en pantalla**
> `badge.textContent = '✓ VeriFactu';`

🔴 **La afirmación más visible del inventario, y no usa ninguna palabra clave.** Se pinta —en verde
de marca, con un check— **cada vez que la factura tiene `vfHash`**, es decir, cuando está **sellada
en local**. Lectura buena: «esta factura tiene su huella VeriFactu». Lectura falsa, que es la que
hace cualquiera: «esta factura está registrada en Hacienda». La encontró la lectura, no el barrido.

**C13 · `public/dashboard/js/invoiceDetailView.js:651`**
> `setStatus('success', d.veriFactu ? '✓ PDF regenerado **con VeriFactu**.' : '✓ PDF regenerado.');`

Mismo problema en un mensaje de éxito.

**C14 · `public/dashboard/js/invoiceDetailView.js:643`**
> `btnRegen.title = 'Regenera el PDF **aplicando VeriFactu** si el merchant tiene NIF configurado';`

«Aplicando VeriFactu» describe el sellado local con el nombre del régimen completo.

**C15 · `public/dashboard/js/semaforoFiscal.js:42`**
> `// ── ROJOS: **la AEAT lo rechazaría**, o rompería la cadena. No se negocia.`

Es un comentario, no copy, y el condicional lo salva; pero califica de «rechazo de la AEAT» algo
que hoy la AEAT no puede rechazar porque no lo recibe. El mismo fichero declara con honestidad, en
`:10`, que «el endpoint del freno todavía NO existe».

**C16 · `public/dashboard/js/jobDetailView.js:2510`**
> `showToast(d && d.veriFactu === false ? '⚠️ Factura emitida, **revisa su registro**' : '✓ Factura
> emitida.');`

«Revisa su registro» sugiere un registro remoto consultable. Lo que falló es el **sellado local**.

---

# CLASE D · correcta (25)

> Se anotan porque el encargo lo pide: **qué se salva**. Y salva más de lo que parece — el código
> es, con diferencia, la parte del repo que dice la verdad sobre esto.

## En el máster (8)

* **D1 · `:123`** — `Factura + VeriFactu local (hash, QR, R1, series, 303, XML) | ✅ **emisión
  local** · **envío SIF ⏳ SIF-1** · conformidad por AUDITAR (S1-A)`. La tabla de estado del
  producto separa exactamente lo que existe de lo que falta.
* **D2 · `:245`** — regla 24: `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1
  completo. Es una regla, no una descripción de mecanismo, y sigue en pie.
* **D3 · `:945`** — `S1-D ⏸ **PAUSA** (espera decisión de representación del asesor)`. El estado de
  ejecución **sí** dice que el envío está sin hacer.
* **D4 · `:1021`** — `✅ DONE 12-jun-26: … en modalidad VERI*FACTU **NO se exige XAdES** (solo en
  no-VERI*FACTU): 100 % Node con mTLS nativo, sin microservicio.`
* **D5 · `:1023`** — S1-B: `YaQu opera como SIF en modalidad **VERI*FACTU (remisión)** (evita firma
  por registro y registro de eventos del modo no-remisión)`. Es la decisión ② escrita correctamente.
* **D6 · `:1025`** — S1-D descrito como **lo que hay que construir**: `sif.client.ts + cola
  VfSubmission {invoiceId,status,attempts,lastError} + retry backoff`. Aquí la cola aparece en su
  sitio: una tarea, no un hecho.
* **D7 · `:1030`** — `**Solo con 8/8 ✅:** claim VeriFactu + INVOICING_ES_ENABLED a reales + GTM-1
  etapa 2.`
* **D8 · `:1495`** — SCRUM-145: `el «Modelo C» tal como se planteó **no existe** — la AEAT **no
  tiene canal de subida de XML** en la Sede`. Medido contra fuente y escrito sin adornos.

## En `docs/legal/` (8)

* **D9 · `PACK_GESTORIA.md:20`** — `Al operar en esta modalidad, **no se exige firma electrónica**
  de los registros`. La decisión ② dicha al gestor, y correcta.
* **D10 · `PACK_GESTORIA.md:64`** — `YaQu **no presenta** modelos ante la AEAT ni lleva la
  contabilidad`.
* **D11 · `DECLARACION_RESPONSABLE.md:40`** — `**No** opera en modo "no verificable"` +
  `TipoUsoPosibleSoloVerifactu: **Sí**`. Coherente con la modalidad elegida.
* **D12 · `SEMAFORO_MAPA_EMISION.md:295`** — `**¿Qué contestó la AEAT?** 🔴 **No existe.** No hay
  tabla ni columna de respuesta | Sin VfSubmission en el schema`.
* **D13 · `SEMAFORO_MAPA_EMISION.md:300-301`** — `no hay rastro de envío **porque no hay envío**. La
  remisión al SIF (S1-D) **no está construida** y VfSubmission es un modelo del máster que aún no
  existe en el schema.`
* **D14 · `AUDITLOG_FISCAL_CONTRATO.md:300`** y **D15 · `:777`** — `**La remisión a la AEAT no
  existe** (SIF_ENABLED=false, sin VfSubmission en el schema)`. Correcto en el hecho; el paréntesis
  atribuye a la bandera un papel que no tiene, igual que A9, pero la afirmación principal es
  verdadera.
* **D16 · `PREGUNTAS_ASESOR.md:463-464`** — cita literal del código: `«**"se envía" NO EXISTE.**
  Cero clientes SOAP/mTLS contra la AEAT, VfSubmission no está en el schema, no hay cola de
  remisión»`.

## En el código y en la pantalla (9)

* **D17 · `src/modules/invoicing/domain/modoVisible.ts:20-27`** — el texto más exacto del repo:
  `El ticket pedía además un modal de dos caminos («se guarda» / «se envía»). **No se construye**, y
  el motivo está medido, no supuesto: **«se envía» NO EXISTE**. … **Hoy todo es «se guarda».**`
* **D18 · `public/dashboard/js/settingsView.js:189-190`** — lo mismo en el front, con la
  consecuencia dicha: `una salida inerte … le diría al profesional que puede elegir remitir a la
  AEAT, y no puede.`
* **D19 · `public/dashboard/js/settingsView.js:36-45`** — los rótulos que ve el profesional
  (`Se emiten facturas` / `Cuenta de demostración` / `Se emiten justificantes de cobro` y sus
  detalles) **no prometen envío ni nombran a la AEAT**, por decisión expresa de la regla 26.
* **D20 · `verifactu.service.ts:527-528`** — `ENVÍO telemático real al SIF requiere certificado
  digital del emisor — **pendiente** (tarea usuario), **esto es el registro, no la remisión**.`
* **D21 · `verifactu.service.ts:568`** — `(lo hará **la cola de remisión, S1-D**)` — futuro
  explícito, con su tarea.
* **D22 · `verifactu.service.ts:764`** — `Ninguna de esas filas se remitirá: **la remisión empieza
  post-SIF** y solo con registros nuevos.`
* **D23 · `registro.builder.ts:579`** — `PRESENTACIÓN «CUERPO SOAP», **para el envío a la AEAT de
  S1-D**` — nombra el destinatario y la fase.
* **D24 · `verifactu.service.ts:667-680`** — 🔴 **corrige la premisa del encargo:** el comentario que
  mentía sobre las rectificativas **ya está arreglado**. Hoy esa coordenada contiene la corrección
  de SCRUM-513, incluida la explicación de por qué se corrige en vez de borrarse. Ver abajo.
* **D25 · `docs/SIF_SPEC_NOTES.md:7-13`** *(fuera de las cuatro zonas del encargo; se anota porque
  es la fuente de la decisión ②)* — `En modalidad VERI*FACTU … **NO se exige firma electrónica** de
  los registros de facturación … La firma XAdES Enveloped solo es obligatoria en sistemas **NO**
  VERI*FACTU.`

---

# Tres correcciones a la premisa del encargo

Se dicen porque el encargo pide medir antes de creer, y las tres cambian lo que había que buscar.

1. **`verifactu.service.ts:673` ya NO miente.** El encargo lo daba por vivo («ya se sabe que tiene
   un comentario que MIENTE sobre las rectificativas»). Medido sobre este `main`: SCRUM-513 entró y
   esa coordenada contiene hoy **la corrección**, con su propia explicación de por qué se corrigió
   en lugar de borrarse. No hay nada que anotar ahí salvo que la premisa caducó (**D24**).

2. **La clase B es casi vacía, y no por falta de mirada.** El encargo esperaba varias afirmaciones
   de firma/XAdES/eventos. Los dos instrumentos, por separado, encuentran **una**. El repo tiene la
   decisión ② bien escrita en seis sitios distintos.

3. **El grueso de la clase A no está en el máster: está en `docs/legal/`.** 7 en el máster frente a
   **12** en los documentos legales, y **8 de esas 12 viven en los dos que se entregan a un tercero**
   —el pack de la gestoría y la declaración responsable—. El máster describe mal un mecanismo; esos
   dos **afirman ante terceros** que el mecanismo funciona.

---

# Qué NO se ha medido

1. **El valor de las banderas en producción.** Este trabajo no toca producción, ni leyendo. Se
   hereda de la auditoría (§5) que están sin definir en el entorno y que el `false` del código es
   una decisión escrita.
2. **`docs/` fuera de las cuatro zonas del encargo.** Se barrieron el máster, los 12 de
   `docs/legal/`, el camino de emisión y la superficie del usuario. **No** se han inventariado
   `docs/COMO_FUNCIONA_YAQU.md`, `docs/RUNBOOKS.md`, `docs/QA_MASTER.md`, `docs/AUDITORIA_RRSIF.md`
   ni `docs/master/SCRUM-*.md` (110+ ficheros). `SIF_SPEC_NOTES.md` se leyó por ser la fuente de la
   decisión ② y salió correcto (**D25**), pero **el resto está NO MEDIDO** y es el sitio natural del
   siguiente barrido.
3. **`public/index.html` y la landing comercial.** La Parte AB5 manda que la sección VeriFactu sea
   *solo post-SIF, o pre-SIF con el wording del guion H2* — y el guion H2 es **A1**. No se ha
   inventariado la landing: **NO MEDIDO**, y hereda el defecto de A1 si lo usa.
4. **Las descripciones de tickets de Jira**, por instrucción expresa del encargo.
5. **El tramo 1180-1650 del máster** se leyó por extracción de sus 60 líneas con vocabulario fiscal,
   no verbatim entero. Son entradas de registro de trabajo históricas. Si alguna afirmación de esas
   entradas no lleva ni una de esas palabras, **este inventario no la ha visto**, y se dice.

---

# Lo que este documento NO hace

**No corrige nada.** Ni una línea de código, ni del máster, ni de un texto de usuario, ni una
propuesta de redacción alternativa. Dos motivos, los dos del encargo:

* el máster es la fuente de verdad y **lo corrige el fundador**, no una sesión;
* la **regla 26** dice que la pregunta de VeriFactu se responde **solo** con el guion H2 — y el
  guion H2 es precisamente **A1**. Escribir aquí el reemplazo sería inventar copy fiscal, que es lo
  que esa regla existe para impedir.

El único fichero creado por este trabajo es este mismo. `git diff --stat` contra `origin/main` lo
demuestra: un fichero, cero modificados.
