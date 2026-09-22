# SCRUM-523 · La declaración responsable del productor: qué exige, qué hay y qué falta

**Medido contra:** `origin/main` = `1331d5d45d029ebccb328f008935a2d63ec8df43` · 2026-09-16T06:48:11+01:00

**Carril:** normativa · censo · **Gate:** sin gate — no añade código de producto

**Tanda:** 6937 tests · 6827 pass · **0 fail** · 110 skipped (todos gateados por entorno y con su
motivo declarado) · **exit 0** · `guards:entrada` 26/26. Sin tests nuevos: el total no se mueve por
esta entrada.

> ## 🔴 ESTA ENTRADA MIDE Y ESCRIBE. NO CONSTRUYE NADA.
>
> No se ha tocado `src/`, ni el camino de emisión (regla 38), ni un solo texto que pueda ver un
> cliente o Hacienda (regla 30). **No se decide el carril A/B ni el NIF**: eso es del fundador y de
> su asesoría. Lo que hace esto es que la decisión deje de tomarse de memoria.
>
> ⚠️ **Y NO ES UNA FUENTE NORMATIVA.** Las citas de §① vienen de la descripción de SCRUM-523, no de
> una lectura propia del BOE ni de la sede de la AEAT. El límite exacto está en §④, y es lo primero
> que hay que leer antes de usar este documento para decidir nada.

---

## ① Qué exige la norma, citado — y de dónde sale cada cita

### El requisito, con sus dos anclajes

**Art. 13.2 RRSIF (RD 1007/2023)**, tal como lo transcribe SCRUM-523:

> «La declaración responsable deberá constar por escrito y **de modo visible en el propio sistema
> informático en cada una de sus versiones**, así como para el cliente y el comercializador en el
> momento de la adquisición del producto.»

**Art. 15.3 Orden HAC/1177/2024**, que lo convierte en requisito de interfaz:

> «La declaración responsable deberá encontrarse **disponible de manera legible e individualizada
> dentro del propio sistema informático** a que se refiere y **ser accesible por el usuario de forma
> rápida, fácil e intuitiva**. Asimismo, deberá ponerse a disposición del comercializador y del
> cliente, tanto en el momento de su adquisición como posteriormente, en papel o electrónicamente en
> un formato de uso ampliamente extendido y gratuito.»

**Art. 13.3 RRSIF:** el productor conserva las declaraciones de **todas** las versiones.

**Contenido mínimo — art. 15.1 Orden:** doce letras **a) a l), en ese orden**, cada dato **precedido
del texto que lo describe**, bajo el título fijo «DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE
FACTURACIÓN». Las doce, con lo que hoy existe de cada una, en la tabla de §②.

**Lo que NO hay que hacer** (FAQ AEAT según el ticket): no se presenta ante la AEAT, no hay
certificación externa ni registro previo — es una **autocertificación del productor**. No existe
modelo oficial; la AEAT publica ejemplos orientativos.

**Sanción propia:** 1.000 € **por sistema informático comercializado** sin certificación
(art. 201 bis.1.f LGT). Es distinta de la de 150.000 €.

### «Una por versión», para un producto que despliega varias veces al día

Esto es lo único de §① que no se contesta citando: hay que cruzarlo con cómo desplegamos.

**Lo que dice la norma** (vía ticket): art. 13.2 exige que conste «en cada una de sus versiones»;
art. 13.3, conservar todas; y la FAQ de la AEAT: «**cada versión, por pequeña variación que
introduzca, es un producto distinto** de los anteriores… es necesario que el productor… certifique
expresamente que dicha versión cumple».

**Lo que está medido aquí:**

| hecho | dónde |
|---|---|
| la versión que viaja en cada registro es una **constante escrita a mano** | `src/modules/fiscal/verifactu/productor.ts:48` → `VERIFACTU_VERSION = "1.0.0"` |
| **nada del despliegue la toca** — cero referencias desde `scripts/`, `.github/` o `package.json` | censo §D2, con su control |
| coincide con `package.json` (1.0.0) — pero **nada lo ata**: es coincidencia vigilada por nadie | censo §D3 |
| **no existe archivo histórico** de declaraciones por versión | censo §D4, con su control |
| el despliegue es **automático en cada merge a `main`** | `CLAUDE.md` (Railway auto-deploy desde `main`) |

**La consecuencia, dicha sin adornos:** hoy se despliega varias veces al día y el identificador de
versión que se declararía —y que viaja dentro de cada registro de facturación— no cambia. Así que
«una por versión» **no está definido hoy en ningún sitio**, y no es un problema de papeleo: es que
el dato que la norma usa para identificar el producto no distingue dos despliegues.

⚠️ **No decido aquí qué cuenta como «una versión»**: es mitad jurídico (qué es «variación» a efectos
del art. 13.2) y mitad de diseño. Lo que sí se puede decir es **qué opciones hay y qué cuesta cada
una**, y está en el bloque ③-4.

---

## ② Qué existe HOY en el código — con fichero y línea en cada afirmación

**El censo y su población:** 2183 ficheros de `src/`, `public/`, `scripts/`, `tests/`, `prisma/` y
`docs/`, **excluida `docs/master/evidencias/`** (por qué, abajo). Reproducible:
`docs/master/evidencias/SCRUM-523/censo-523.mjs`, con su salida al lado.

🔴 **Cada cero lleva su control**, y no es adorno: **el control cazó dos cegueras mías**.

**① Los acentos.** El primer intento con `grep` dio **cero** para «declaración responsable» en `src/`
teniendo **dos**. Un instrumento que no ve lo que busca da un cero muy creíble. El censo busca sobre
texto normalizado (NFD, sin diacríticos) y antes de afirmar nada comprueba que **ve** un caso
conocido y **no ve** una cadena inventada.

**② El censo se leyó a sí mismo.** Al dejar el script y su salida dentro de
`docs/master/evidencias/`, el censo pasó a escanear su propio fuente y **encontró su cebo** — el
control salió en **rojo** y el censo **se negó a afirmar nada**, que es exactamente lo que tenía que
hacer. Es la trampa de autorreferencia de SCRUM-693/694: un censo que se cuenta a sí mismo mide su
propia sombra. Arreglado excluyendo esa carpeta, **declarado en el script**, y con la población
bajando de 2211 a 2183. Ninguna conclusión cambió al excluirla — los seis ceros siguen siendo los
mismos seis.

### Lo que SÍ existe

| qué | dónde | veredicto |
|---|---|---|
| **borrador de la declaración**, con el título fijo del art. 15.1 y las doce letras en sustancia | `docs/legal/DECLARACION_RESPONSABLE.md` (104 líneas) | **existe, es borrador, y él mismo lo dice** |
| está **previsto** en el máster como S1-E | `docs/YAQU_MASTER.md:1040` | **previsto** |
| las **cinco constantes del productor** — letras a), b), c), h), i) como dato | `src/modules/fiscal/verifactu/productor.ts:39,42,45,48,51` | **existe** |
| el bloque `SistemaInformatico` que viaja en cada registro | `registro.builder.ts:376` · `verifactu.service.ts:757` y `:852` | **existe, en TRES sitios** |
| auditoría de las afirmaciones falsas del borrador (A16–A19) | `docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md:200-221` | **ya medido por SCRUM-537/538** |
| el patrón de página legal pública ya montado | `src/app.ts:288-289` (`/privacidad`, `/terminos`) | **existe, reutilizable** |

🔴 **Por eso «no está construido ni previsto» —el título del ticket— no es exacto hoy.** El
**documento** existe como borrador y está previsto en el máster. Lo que no existe es el **requisito
de interfaz**, que es justo lo que el propio título identifica bien. La distinción importa porque
cambia el trabajo: no hay que redactar de cero, hay que **corregir, ordenar y publicar**.

### Lo que NO existe — ceros medidos, cada uno con su control

| qué | medida |
|---|---|
| **ubicación INTERNA** (art. 15.3): la declaración dentro del producto | **CERO** menciones en `public/` (censo §A1) |
| un menú «Ayuda» / «Acerca de», el patrón que sugiere la AEAT | **CERO** (censo §A3) |
| **ubicación EXTERNA** para cliente y comercializador | **CERO** en la landing (§B2); y `docs/` **no se sirve por web** — sólo `public/` (`src/app.ts:261`), así que el borrador **no es accesible por nadie** |
| **archivo histórico** por versión (art. 13.3) | **CERO** (censo §D4) |
| letra **g)** (tipos de firma) | **CERO** en `src/` — y es **correcto**: sólo se exige si NO se opera como VERI\*FACTU |

### Las doce letras, una por una

| | contenido | hoy |
|---|---|---|
| a) | Nombre del sistema | **existe**, cableado: `verifactu.service.ts:760` y `:855` → `YaQu` |
| b) | Código identificador (2 car.) | **existe**: `productor.ts:45` = `"01"`, con guard de formato (`scrum247…:120`) |
| c) | Identificador completo de la versión | **existe**: `productor.ts:48`, pero ver «una por versión» |
| d) | Componentes hardware y software | **sólo en el borrador** (§3). No es un dato del código |
| e) | Sólo VERI\*FACTU (S/N) | **cableado a `S`**: `verifactu.service.ts:764` y `:859` · parametrizado en `registro.builder.ts:383` |
| f) | Varios obligados tributarios (S/N) | **cableado a `S`**: `:765` y `:860` |
| g) | Tipos de firma | **ausente, y así debe ser** si se opera sólo VERI\*FACTU |
| h) | Nombre / razón social del productor | **existe**: `productor.ts:39` — 🔴 ver el defecto de abajo |
| i) | NIF del productor | **existe**: `productor.ts:42`, de **persona física**; con guard de longitud (`scrum247…:98`) |
| j) | Dirección postal | **sólo placeholder** en el borrador |
| k) | Constancia de cumplimiento | **sólo texto** en el borrador (§4) |
| l) | Fecha y lugar de suscripción | **sólo placeholder** en el borrador (§6) |

### 🔴 Tres hallazgos que no son «falta por construir», sino algo que ya está y no cuadra

**①  El nombre del productor lleva los corchetes de la plantilla dentro del valor.**

```
src/modules/fiscal/verifactu/productor.ts:39
export const VERIFACTU_PRODUCTOR_NOMBRE = "<Luis Lara Granado>";
```

Y **nada comprueba su forma**: el guard de SCRUM-247 sólo exige que no esté vacía
(`tests/scrum247-productor-constante.test.mjs:68`, `!String(...).trim()`), y comprueba la longitud
del NIF y el formato del id — **pero no el nombre**. Ese valor es la letra h) y viaja dentro de cada
registro que se emita, escapado a `&lt;…&gt;`. **No lo toco** (es `src/`, es el camino de emisión y
es identidad fiscal): se declara para que lo decida quien puede.

**② `IndicadorMultiplesOT` está cableado a `S`** (`verifactu.service.ts:766` y `:861`). El
comentario de SCRUM-523 sostiene, citando la FAQ de desarrolladores de la AEAT (v1.3, 04-12-2025),
que en SaaS **se calcula POR USUARIO**, no a nivel global. Si eso es correcto, un literal global no
puede ser correcto para todos los merchants. **No lo verifico** (§④) y no lo cambio: se declara.

**③ El bloque `SistemaInformatico` se construye en TRES sitios**, dos de ellos con literales
(`verifactu.service.ts:757` y `:852`) y uno parametrizado (`registro.builder.ts:376`). Es materia de
regla 2, y para esta obligación importa por una razón concreta: **la declaración tiene que coincidir
con lo que se remite**, y con tres emisores hay tres sitios donde puede dejar de coincidir.

---

## ③ Qué haría falta, en bloques — y cuál depende de la decisión A/B

**El entregable es esta separación.** «A/B» = operar **sólo VERI\*FACTU** o en **modo dual**
(VERI\*FACTU + no verificable). ⚠️ Sobre su estado hay una contradicción medida, en §④.

### 🟢 Bloques que NO dependen de A/B — se pueden hacer con la decisión parada

| # | bloque | por qué no depende |
|---|---|---|
| **1** | **Ubicación INTERNA**: la declaración accesible dentro del panel, «rápida, fácil e intuitiva» (patrón AEAT: «Ayuda» / «Acerca de») | La pantalla hay que tenerla en los dos carriles. Lo que cambia con A/B es **una línea del contenido** (letra e), no que exista |
| **2** | **Ubicación EXTERNA**: página pública en formato ampliamente extendido y gratuito | Igual. Y el patrón ya está montado: `src/app.ts:288-289` |
| **3** | **Archivo histórico** de todas las versiones (art. 13.3) | El deber de conservar no cambia con la modalidad |
| **4** | **Decidir qué es «una versión»** y automatizar emisión + archivo en cada despliegue | Es cadencia de despliegue, no modalidad. **Es el bloque con más diseño dentro** |
| **5** | **Reordenar el borrador a las doce letras a)–l)** con su texto descriptivo delante | El orden lo fija el art. 15.1, no la modalidad |
| **6** | **Test de coherencia** declaración ↔ registro remitido (`Version`, `IdSistemaInformatico`, nombre) | La coherencia es exigible en los dos carriles. Y es comprobable: lo dice el propio ticket |
| **7** | **Retirar del borrador las afirmaciones ya inventariadas** (A16–A19) | Son falsas hoy en cualquier carril |

### 🔴 Bloques que SÍ dependen de A/B

| # | bloque | qué cambia exactamente |
|---|---|---|
| **8** | **Letra e)** y el campo `TipoUsoPosibleSoloVerifactu` | `S` si sólo VERI\*FACTU; `N` si dual. Hoy está cableado a `S` en dos sitios |
| **9** | **Letra g)** — tipos de firma | **Sólo aparece si NO es VERI\*FACTU.** En dual hay que declararla, y eso arrastra XAdES y `EventosSIF.xsd` (11 eventos, 16 anomalías, según el ticket) |
| **10** | El **alcance de la constancia** de la letra k) | Lo que se certifica cumplir es distinto en cada carril |

### 🟠 Bloques que dependen del NIF / ROAD-4 — y NO de A/B

Van aparte porque es **otra** decisión, y mezclarlas es lo que hace que una espere a la otra sin
motivo.

| # | bloque | qué |
|---|---|---|
| **11** | **Letras h), i), j)** y el valor de `VERIFACTU_PRODUCTOR_NOMBRE`/`_NIF` | Persona física hoy vs SL en constitución. `productor.ts:11-12` ya dice que «ese NIF va a cambiar» |
| **12** | **Firma y letra l)** (fecha y lugar) | No se firma hasta saber quién firma |

### ⛔ Y la precedencia que el propio ticket impone, que manda sobre todo lo anterior

**Nada de esto se firma antes de que el sistema cumpla.** El ticket lo dice: «declarar que se cumple
sin cumplir es peor que no declarar». Y está medido en el repo: **el envío a la AEAT no existe**
(`docs/SIF_SPEC_NOTES.md`, cabecera: «Hoy no existe el envío a la AEAT… no está escrito», auditoría
`docs/legal/AUDITORIA_CAMINO_EMISION.md`, eslabones 8 y 9).

Así que el orden es: **construir y medir → corregir el borrador → publicarlo en las dos
ubicaciones**. Los bloques 1–7 se pueden **construir** antes; lo que no se puede es **firmar y
distribuir**.

---

## ④ Lo que NO he podido determinar — declarado, no supuesto

Es un requisito legal: aquí una suposición con buena letra es peor que un hueco.

**1. 🔴 Ninguna cita normativa de §① está verificada por mí contra fuente primaria.** Todas salen de
la descripción de SCRUM-523, que declara su procedencia (BOE consolidado + sede AEAT, 19-ago-2026) y
remite a `claude/GUIA-SIF-VERIFACTU-PRODUCTOR-2026-08-19.md`. **Ese documento no está en el árbol, y
no es que se haya borrado: nunca se commiteó** — medido con `git log --all --diff-filter=A` sobre ese
patrón: vacío; y la carpeta `claude/` no existe. Así que el texto literal de los artículos 13.2
RRSIF y 15.1/15.3 de la Orden, las FAQ y el art. 201 bis.1.f **son de segunda mano**. Antes de
firmar nada hay que contrastarlos con el BOE y la sede.

**2. 🔴 No he podido determinar si la decisión A/B está abierta o cerrada, y las dos fuentes del
repo se contradicen.**

- `docs/YAQU_MASTER.md:1037` la da por **cerrada y hecha**: «S1-B · Modalidad documentada: YaQu opera
  como SIF en modalidad **VERI\*FACTU (remisión)** … **✅ DONE 12-jun-26** … `TipoUsoPosibleSoloVerifactu=S`».
- SCRUM-523, **dos meses después** (19-ago-2026), la da por abierta: «no se decide aquí si YaQu opera
  sólo VERI\*FACTU o en modo dual… la decisión tiene que existir antes que el documento».
- Y el código está cableado a `S` en dos sitios, coherente con el máster.

**No lo resuelvo**: o el máster afirma cerrada una decisión que el fundador tiene parada, o el ticket
arrastra un párrafo caducado. Es exactamente la clase de afirmación que SCRUM-528 inventarió.

**3.** **Qué cuenta como «una versión»** a efectos del art. 13.2 con despliegue continuo. Es
jurídico antes que técnico y no lo decido.

**4.** Si `IndicadorMultiplesOT` **debe** calcularse por usuario. La fuente que lo afirma (FAQ de
desarrolladores AEAT v1.3, 04-12-2025) la cita el comentario del ticket y **no la he leído**.

**5.** Si los corchetes angulares de `VERIFACTU_PRODUCTOR_NOMBRE` son deliberados. Lo único que
afirmo es lo medible: **están en el valor, viajan al registro, y ningún guard mira la forma del
nombre**.

**6.** Si la sanción de 1.000 € «por sistema informático comercializado» aplica por merchant, por
producto o por versión. Es interpretación jurídica.

---

## Lo que NO se hizo

- **`src/` intacto.** Ni una línea del camino de emisión (regla 38): se ha leído, no modificado.
- **Ningún texto que vea un cliente o Hacienda** (regla 30). Esta entrada es interna y **no contiene
  redacción de la declaración**: el borrador sigue siendo el de `docs/legal/`, sin tocar.
- **No se decidió el carril A/B ni el NIF**, y los tres defectos de §② **se listan, no se arreglan**
  (regla 9): dos son identidad fiscal y el tercero toca el emisor.
- Cero dependencias (36) · cero estado o flag de producto (27).

> ⚠️ **Nota de tanda:** esta entrada **no añade ni un test**, así que el total de la tanda no se
> mueve por ella. La evidencia (`docs/master/evidencias/SCRUM-523/censo-523.mjs`) es un script que se
> ejecuta a mano y **no se importa desde ningún test**, justamente para no meter ejecución nueva en
> `npm test`.

---

# APÉNDICE · ¿Se construye hoy el bloque `SistemaInformatico`?

**Medido contra:** `origin/main` = `9c90cc89044a20a85defdc0c93feb032e6544ca5` · 2026-09-16T11:35:09+01:00

Medición corta pedida por el fundador porque de ella depende que una frase de
`docs/legal/DECLARACION_RESPONSABLE.md` **se corrija o se caiga entera**. Testigo esperado:
`construirSobreRegFactu`. **Ese fichero legal NO se toca aquí: sólo se mide.**

Las **dos preguntas van separadas a propósito**: «el módulo lo tiene» y «se ejecuta al emitir» no son
la misma pregunta, y confundirlas es lo que produce una declaración que afirma un comportamiento que
no ocurre.

## ¿EXISTE? Sí — y en DOS implementaciones

| qué | dónde |
|---|---|
| `construirSobreRegFactu` (el testigo) | `src/modules/fiscal/verifactu/registro.builder.ts:558` |
| el bloque, **parametrizado** | `registro.builder.ts:375` (`xmlSistema`), usado por `buildRegistroAlta:442` y `buildRegistroAnulacion:510` |
| el bloque, **cableado** | `src/modules/invoicing/domain/verifactu.service.ts:757` (alta) y `:852` (anulación) |

## ¿SE EJECUTA EN LA EMISIÓN REAL? NO — y se mide en tres pasos

1. **El camino de emisión no lo construye.** Es `applyVeriFactu` (`verifactu.service.ts:194`) y
   `applyVeriFactuAnulacion` (`:375`), llamados desde `src/modules/invoicing/domain/selladoEstado.ts:47`
   y `src/lib/invoicing.ts:11`. **En el rango 194–375: CERO menciones** de `SistemaInformatico`,
   `construirSobre` o `buildRegistro`. Al emitir se calcula la huella y la cadena; el bloque **no**.
2. **El bloque cableado sólo corre al EXPORTAR.** Vive dentro de `buildVerifactuRegistrosXml`
   (`:536`), y su **único** llamador en `src/` son las rutas de exportación —
   `src/modules/exports/app/routes/exports.routes.ts:252` y `:556` — o sea el ZIP para la gestoría.
3. **El bloque parametrizado no lo alcanza `src/` en absoluto.** `buildRegistroAlta` y
   `buildRegistroAnulacion` **no se importan en ningún fichero de `src/`** (medido). Sólo los usan
   `tests/scrum240-sobre-unico.test.mjs` y `scripts/gen-registros-sample.mjs`.

## Lo que esto le hace a la frase legal

`DECLARACION_RESPONSABLE.md:11-12` dice que los valores del sistema «DEBEN coincidir con el bloque
`SistemaInformatico` que **YaQu remite en cada registro de facturación**».

Ya estaba inventariada como **A16** por dar por hecha una remisión inexistente. Lo que añade esta
medición es que **falla por un segundo motivo, independiente del primero**: aunque hubiera remisión,
el bloque **no se construye al emitir** — se construye **al exportar**. «En cada registro de
facturación» no describe nada de lo que ocurre hoy en ningún camino.

**Y eso decide entre las dos salidas que planteaba el fundador:** la frase no se puede *corregir*
cambiando «remite» por «construye», porque tampoco construye al emitir. Lo que describe con verdad es
«el bloque que YaQu incluye en el fichero de registros que exporta», y decidir si eso sirve para una
declaración responsable **no es técnico**: es de la asesoría.

⚠️ **Lo que no he podido determinar:** si el ZIP de exportación es el artefacto que la asesoría
considera «el registro de facturación» a estos efectos. No se decide desde el código.

---

# SCRUM-523b · Recomprobado el 22-sep: nada cambió en el código, hay corroboración nueva del
asesor, y el cruce con SCRUM-870 queda CONFIRMADO — no supuesto

**Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3` · 2026-09-22T16:24:54Z

**Carril:** normativa · censo · **Gate:** sin gate — no añade código de producto. Encargo recibido
hoy porque llegaron las respuestas de SCRUM-1079 y cambian el sitio del ticket en el mapa. PASO 0:
el título del ticket dice «no está construido ni previsto» — **eso ya era inexacto el 16-sep** (ver
§② de arriba) y sigue siéndolo hoy. Este bloque no repite esa medición: la recomprueba y añade la
parte nueva.

## 1 · El código no se movió, solo las LÍNEAS — recomprobado, no supuesto

`SCRUM-665` mergeó hoy a las 13:00 (`6d0451d0`, PR #1680) y tocó
`src/modules/invoicing/domain/verifactu.service.ts` (49 líneas, +20 antes del bloque que aquí
importa). Es del **emisor** (identidad del profesional que factura), no del **productor**
(identidad de YaQu como fabricante del software): son dos bloques distintos del mismo registro y
`SCRUM-665` no tocó el segundo. Recomprobado línea a línea porque las citas de §② ya no apuntan al
sitio correcto:

| qué | cita de §② (16-sep) | hoy (22-sep) | ¿cambió la sustancia? |
|---|---|---|---|
| bloque `SistemaInformatico` cableado, alta | `verifactu.service.ts:757` | `:795` | no — mismo `productor.nombre` interpolado |
| bloque `SistemaInformatico` cableado, anulación | `verifactu.service.ts:852` | `:890` | no |
| guard fail-closed del productor | `verifactu.service.ts:593` (citado en Jira SCRUM-870) | `:619-633` | no — sigue comprobando solo que no esté VACÍO (`!productor.nombre`), no la FORMA |
| `productor.ts` | sha distinto de HEAD | **byte a byte igual**: `VERIFACTU_PRODUCTOR_NOMBRE = "<Luis Lara Granado>"` | no |

Y el censo de `public/` para «declaración» (normalizado, acentos incluidos): repetido a mano hoy
sobre los mismos patrones de §②, **sigue en CERO** — los únicos usos de la palabra en `public/` son
de otro dominio (firma de albaranes, comentarios de código), ninguno es el documento legal.

## 2 · Corroboración nueva: SCRUM-1079 (22-sep), segunda fuente — con la misma reserva

`docs/legal/PREGUNTAS_ASESOR.md`, bloque **C5** (añadido hoy por SCRUM-1079): confirma, de forma
independiente, art. 13 RRSIF + art. 15 Orden HAC/1177/2024, título fijo, contenido mínimo, orden, se
emite **antes** de la primera factura real, se versiona por release. Coincide palabra por palabra
con lo que ya decía §① de arriba.

⚠️ **No sube el nivel de verificación de §④.1.** El propio `docs/master/SCRUM-1079.md` declara su
procedencia: «una sesión de IA de este equipo… **no las ha revisado un asesor humano**». Sigue
siendo una segunda fuente de IA, no una fuente primaria ni un humano colegiado. Lo que sí aporta:
dos sesiones distintas, en días distintos, leyendo el mismo artículo, llegan al mismo texto — eso
reduce el riesgo de una alucinación puntual, no lo elimina.

`PREGUNTAS_ASESOR.md:916` además dice, literal, lo que este documento ya sabía: «el borrador de
`DECLARACION_RESPONSABLE.md` ya apunta a esos artículos; lo que le falta son los datos del
productor (B2)» — mismo diagnóstico que §② y §③ de arriba, de forma independiente.

## 3 · B2 (SCRUM-1079): el productor interino, mientras no exista la SL

`PREGUNTAS_ASESOR.md:901`, literal: «Con la SL decidida, el productor será la SL (NIF de persona
jurídica); **mientras no exista, el único productor posible es la persona física**. Si se emite
alguna factura real antes de constituirla, la declaración responsable y los registros llevarían al
autónomo como productor, y habría que reemitirla al cambiar de productor (art. 13 RRSIF: versionada,
se conservan todas)».

Esto **no estaba resuelto** en la entrada del 16-sep (§④.5 lo dejaba abierto). Ahora hay una
respuesta citada: el bloque 11 de §③ («depende del NIF / ROAD-4») **no depende del todo de la SL**
— la persona física es una opción válida HOY, no solo un parche temporal. Ver §5 para lo que esto
cambia.

## 4 · El cruce con SCRUM-870 — CONFIRMADO por Jira, no por parecido

Leído el ticket completo (`getJiraIssue SCRUM-870`, estado **«Acción del fundador»**, etiquetas
`area-j1`, `decision-jefe`, `equipo-javier`): **es el mismo agujero que el hallazgo ① de §② de
arriba, visto desde otra puerta.**

| | SCRUM-523 (hallazgo ①, 16-sep) | SCRUM-870 (medido 16-sep, ampliado 18-sep) |
|---|---|---|
| objeto que señala | `productor.ts:39` → viaja a la letra h) de la declaración | el mismo `productor.ts:39` → viaja al XML `SistemaInformatico > NombreRazon` |
| defecto | corchetes de plantilla dentro del valor, sin guard de forma | mismo valor, con el dato nuevo del 18-sep: `<` y `>` son dos de los **cinco caracteres que la validación 1287 de la AEAT rechaza explícitamente** |
| por qué no se toca | «es identidad fiscal, lo decide quien puede» | STOP explícito, regla 38 y regla 26, medido y no tocado |
| bloqueo declarado | ninguno propio — depende del bloque 11 de §③ | «espera al NIF de la SL» (el propio ticket) |

**No son dos hallazgos parecidos: es literalmente la misma línea de código**, encontrada dos veces
por dos medición distintas (16-sep declaración responsable, 18-sep catálogo de validaciones
SCRUM-524) con dos consecuencias que se suman: la declaración firmaría un nombre inválido por forma
*y* ese mismo nombre es rechazable por la AEAT en el `SistemaInformatico` de cada registro que se
llegue a remitir.

## 5 · Lo que esto cambia — pregunta para el fundador, no decisión mía

SCRUM-870 fija su disparador así: «en cuanto exista el NIF y la razón social de la SL, este ticket
se hace». **§3 de este documento (B2, 22-sep) pone en duda que ese disparador sea el correcto**: si
hoy el único productor válido es la persona física, y `VERIFACTU_PRODUCTOR_NOMBRE` ya contiene un
nombre de persona física real dentro de los corchetes (`Luis Lara Granado`) — no ha esperar a la SL
para quitar los ángulos y comprobar la forma; **esperaría a la SL únicamente para cambiar el NIF y
la razón social cuando ésta exista**, momento en el que además habría que reemitir la declaración
(art. 13.3, versionada).

**No lo decido aquí**, por dos motivos que son STOP y no interpretación mía:

1. Es identidad fiscal (`productor.ts`, camino de emisión) — regla 38/40.
2. No puedo confirmar que «Luis Lara Granado» sea efectivamente el nombre de la persona física
   productora de registro, ni que el criterio jurídico de «una versión» (§① de arriba, sin cerrar)
   permita corregir un carácter no válido sin que cuente como nueva versión a efectos del art. 13.2.
   Es exactamente lo que el propio SCRUM-870 dejó como plan (`productorLegible.ts`, ~15 líneas,
   guard nuevo, código `verifactu_productor_con_marcador`) a la espera de esta decisión.

**Lo que sí puedo decir, medido:** el riesgo hoy es cero en la práctica —
`INVOICING_ES_ENABLED` sigue OFF para merchants ES reales y no hay ningún registro real que remitir
(regla 24; SCRUM-870 lo dice igual) — así que no hay urgencia operativa, solo la de dejar la
pregunta bien planteada antes de que alguien la resuelva de memoria.

## Lo que NO se hizo (igual que arriba, repetido porque aplica también a esta entrada)

- **`src/` intacto.** No se tocó `productor.ts` ni `verifactu.service.ts`: solo se leyeron.
- **Ningún texto legal ni de producto escrito ni firmado.** No se decide el disparador de SCRUM-870
  ni el carril A/B (siguen abiertos, §④ de arriba).
- **No se comentó en Jira SCRUM-870**: la lectura fue de solo consulta (`getJiraIssue`); la
  actualización del ticket, si procede, la decide quien lo cierra (A13).
- Cero dependencias nuevas (36) · cero estado o flag de producto (27) · cero `schema.prisma`.
