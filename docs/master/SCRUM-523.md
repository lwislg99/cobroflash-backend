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

---

# SCRUM-523d · El guard: no se cambia el camino de emisión sin subir la versión del SIF

**Medido contra:** `origin/main` = `11324d271372ee6e689aeeea1c90d096b6043696` · 2026-10-26T15:51:09Z

Puesto J6 (sesión `jv-j6cj`). Construye la mitad «guard» de la **V2** de la decisión del fundador
(SCRUM-523 c.20878), con la V1 como definición: una versión es un cambio de lo que el sistema HACE
con los registros de facturación, no cada despliegue. Es de **solo lectura** (regla 38): `src/` no se
ha tocado y el test no importa `dist/`.

## 1 · Qué hace

`tests/scrum523d-version-del-sif.test.mjs` congela `VERIFACTU_VERSION` (`"1.0.0"`) y una huella por
fichero del camino. Si el camino cambia y la versión es la congelada → ROJO, nombrando el fichero y
diciendo que la versión la sube un PR con el OK del fundador y una declaración nueva firmada por los dos
administradores. Si la versión cambia → ROJO hasta que ese mismo PR recongele (si no, tras la primera
subida el guard quedaría mudo). Las huellas nuevas no se eligen: el mensaje de error las trae
recalculadas para pegarlas.

**La base no es un commit.** CI prueba el merge y no siempre trae `origin/main`; la base es lo congelado
dentro del propio test.

**La huella es del código, no del texto:** sin comentarios, reimpreso por el impresor de TypeScript y con
CRLF normalizado. Un comentario, un salto de línea o un checkout de Windows no cuentan; renombrar una
variable sí.

## 2 · La población, derivada y no escrita a mano

No es un censo nuevo. La frontera es la que ya existe del camino de emisión, `MODULOS_FISCALES` de
`scripts/puerta-avisador-rojo.mjs` (regla 38). Dentro de ella, por los `import` de cada fichero
(`ts.preProcessFile`, no texto): raíces = lo que vive en `src/modules/fiscal/verifactu/`, lo que lo
importa y lo que importa `verifactu.service.ts`; miembros = las raíces y lo que importan,
transitivamente, sin salir de la frontera.

Medido sobre 339 ficheros `.ts` de `src/`: **9 raíces, 15 ficheros en el camino, 7 en la frontera.**
El camino son los seis de `fiscal/verifactu/` (`instalacion`, `productor`, `registro.builder`,
`sif.client`, `sif.cola`, `sif.procesador`) y nueve de `invoicing/domain/` (`clienteCongelado`,
`emisorCongelado`, `emission.service`, `encolarRemision`, `invoiceNumber.service`, `selladoEstado`,
`tipoDocumento`, `vat.service`, `verifactu.service`). El test imprime la lista entera en cada pasada.

**Lo que NO mira, a sabiendas:**
- La frontera (`src/core/config/env.ts`, `core/db/prisma.ts`, `core/documentos/formatoNumero.ts`,
  `core/flags.ts`, `core/utils/utils.ts`, `core/zonaDelMerchant.ts`, `system/audit.service.ts`): el camino
  las importa, pero no entran en la huella. Un cambio de redondeo en `core/utils` no cae aquí.
- Quién llama al sellado desde fuera de la frontera (rutas de `jobs/`, `quotes/`, `system/`,
  `exports/`).
- Que la versión nueva sea mayor, o que la declaración esté firmada: eso es el OK del fundador.
- Una subida de versión de TypeScript que cambie cómo reimprime el código daría ROJO en los 15 a la vez.
  No lo he medido.

## 3 · Controles, corridos

Sembrados por el propio test sobre una copia en memoria del árbol (comparan contra la base recalculada
de hoy, así que un camino ya cambiado tumba sólo el test principal):
- 🔴 tocar `registro.builder.ts`, `verifactu.service.ts` o `vat.service.ts` sin subir la versión → ROJO
  nombrando exactamente ese fichero.
- 🔴 un fichero nuevo que el camino empieza a importar → ROJO «entra en el camino».
- 🔴 subir la versión sin recongelar → ROJO; subirla y recongelar → VERDE.
- 🟢 un fichero de `src/modules/quotes/`, un comentario y CRLF con líneas en blanco → VERDE, con el
  positivo de la misma siembra sobre el camino al lado.
- ⚫ sin `productor.ts`, sin la versión, con un mapa vacío o con una raíz que no existe → CIEGO.

**En rojo de verdad, sobre `src/` del árbol** (commit LOCAL `8ed7bfc844242de25aff31b39c779098a1dc7a24`, no empujado, antes de
inyectar; cada inyección con su `git diff --numstat`, restaurada con `git restore --source=HEAD` y
`git status --porcelain` vacío al final):

| inyección | numstat | resultado |
|---|---|---|
| `MAX_REGISTROS_POR_ENVIO` 1000 → 999 en `registro.builder.ts` | 1 1 | ROJO, cae sólo el principal (6/7), nombra `registro.builder.ts — cambia` |
| un comentario en la línea 1 de `verifactu.service.ts` | 1 0 | VERDE 7/7 |
| una línea nueva en `src/modules/quotes/domain/apartados.ts` | 1 0 | VERDE 7/7 |
| `VERIFACTU_VERSION` "1.0.0" → "1.0.1" sin recongelar | 1 1 | ROJO, cae sólo el principal (6/7), «ha pasado de "1.0.0" a "1.0.1"» |
| quitar la línea de `VERIFACTU_VERSION` | 0 1 | ROJO con «CIEGO: no encuentro VERIFACTU_VERSION…» (1/1: la base no se puede calcular) |

Base sin mutar: 7/7, ~2 s.

## 4 · 🔴 Hallazgo (A23 #1): la prohibición ya está rota hoy, y el guard congela ese estado

`VERIFACTU_VERSION` vale `"1.0.0"` desde el merge de #356 (2-ago-2026). Desde el 2-ago han entrado en
`main` **30 merges** (en primer padre, de 2.438) que tocan alguno de los 15 ficheros: el propio #356 y
**29 después, sin subirla**. En los
últimos 7 días, **2 de 245**. Control positivo de la consulta: con `productor.ts` solo, salen #2695,
#1729 y #356.

Así que `"1.0.0"` no describe el camino de hoy, sino el del 2-ago. El guard congela **el de hoy** bajo
`"1.0.0"`. No ha salido ningún registro real (regla 24, `INVOICING_ES_ENABLED` OFF para merchants ES
reales), ni hay declaración firmada. Si eso basta para que el estado de hoy sea la «1.0.0» que se
declare, lo decide el fundador (pregunta en Jira).

**PR abiertos que caerían al entrar esto:** 0 de 13. Los 13 traen su lista de ficheros, así que el
cero no es un control vacío.

## 5 · Lo que NO se hizo

- `src/` intacto: `productor.ts` y el camino de emisión sólo se leyeron. Nada exportado para medir.
- No se sube la versión ni se escribe ningún texto de la declaración (regla 39).
- Ningún workflow. El test entra en la tanda por su nombre (`tests/*.test.mjs`).
- **Suite entera en local: NO CORRIDA** (lo pide el encargo, hay 10 sesiones a la vez). Los guards
  dirigidos, en la entrega de Jira.

A9: comprobación → `tests/scrum523d-version-del-sif.test.mjs`
A9: aviso → cicatriz J6 «Sembré como reformateo inocuo duplicar los saltos de línea, y dentro de una plantilla multilínea eso es código distinto: lo cazó el propio instrumento» — no se pudo comprobar: el negativo se corrigió en este test, pero ningún meta-guard comprueba que el «cambio inocuo» de un negativo nuevo no cambie el AST

# SCRUM-523e · La «1.0.0» es el camino de HOY, por decisión del fundador

**Medido contra:** `origin/main` = `f94908a532b9768abbf9ea7bd395a401c10d3a3b` · 2026-10-26T22:24:18Z

Puesto J6 (sesión `jv-j6ct`). Solo docs: deja escrito lo que el tramo 523d no decía (lo avisó `jv-j6co`
en SCRUM-523 c.20934). `src/`, el guard (`tests/scrum523d-version-del-sif.test.mjs`) y
`VERIFACTU_VERSION` (`src/modules/fiscal/verifactu/productor.ts`) no se han tocado.

## 1 · La decisión

**SCRUM-523 c.20898** (el orquestador J transcribe la decisión de Javier, por cuestionario, sobre la P1
de c.20897): ✅ **la «1.0.0» es la de HOY.** Todavía no se ha entregado a nadie ninguna declaración
responsable con la 1.0.0, así que no hay nada que corregir hacia atrás. El guard de 523d congela el
camino de emisión de hoy como 1.0.0, y desde que entró en `main` (#2888) cualquier cambio de ese camino
obliga a subir la versión (V2 de c.20878).

Por tanto: **los merges que cambiaron el camino desde el 2-ago entran en la 1.0.0 por esta decisión, no
por un olvido.** La P1 que la pidió es la de `jv-j6cj` en **c.20897**, que los contó como 29.

## 2 · El recuento, recalculado: son 28, no 29

Población: los **15 ficheros del camino** que imprime hoy el propio guard (corrido sobre el árbol de este
tramo: 339 `.ts` leídos, 9 raíces, 15 en el camino, 7/7 verde; la misma lista que en §SCRUM-523d.2).
Rango: `be48da784^..origin/main` en primer padre (`be48da784` = merge de #356, 2-ago-2026 17:10+02:00).

| medida | resultado |
|---|---|
| commits en primer padre desde #356, incluido | 2.440 |
| de ellos, tocan alguno de los 15 (`git log --first-parent -- <15>`) | **29 = #356 + 28 después** |
| sonda independiente: `git diff --quiet <c>^1 <c> -- <15>` por cada uno de los 2.440 | 29, los mismos (corrida sobre `9dc1b9e7`, tres commits antes; esos tres no tocan el camino, fila de abajo) |
| control positivo: sólo `productor.ts` | #2695, #1729, #356 (los mismos tres que en 523d) |
| los 3 merges entre `9dc1b9e7` y `f94908a5` que tocan el camino | 0 (el único `src/` es `invoicing/infra/pdf/pdf.service.ts`, fuera) |

Los 28, del más nuevo al más viejo: #2836, #2695, #2296, #2056, #2053, #2048, #2018, #2014, #1940,
#1920, #1895, #1784, #1715, #1729, #1710, #1680, #1608, #1425, #1348, #1225, #1154, #799, #770, #627,
#572, #550, #372, #362. (#1680 y #1608 son squash, no merge: cuentan igual, cambian el camino.)

**Por qué difiere de 523d (30 con #356, 29 después, «de 2.438»):** no lo he reproducido. Con el mismo
rango sobre la base que declara 523d (`11324d27…`) también salen **29 con #356 → 28 después**, y el
total en primer padre desde #356 sale **2.426**, no 2.438. Como `main` sólo puede añadir commits, el 30
de entonces no baja a 29 por moverse `main`: la diferencia es de método, y cuál no lo sé. Una trampa
medida que da un número DISTINTO (y no explica el 30): `git log --since=2026-08-02` lo toma como el 2-ago
a la hora actual y deja fuera el propio #356. Lo que manda es el recalculado: **28 merges después de
#356 quedan dentro de la 1.0.0 por la decisión de c.20898.** El «29» de c.20897 y c.20898 es el mismo
conjunto contado con un merge de más; la decisión no depende del número.

## 3 · Lo que NO se hizo

- No se toca el guard, ni la constante de versión, ni ninguna declaración (regla 39: la firman los dos
  fundadores; el borrador vive en la rama `scrum-523c-declaracion-dos-firmantes`).
- No he medido QUÉ cambió cada uno de los 28 en el registro de facturación: sólo que tocan un fichero
  del camino (la huella del guard es del código, sin comentarios).
- **Suite entera en local: NO CORRIDA** (lo pide el encargo). Guards dirigidos, en la entrega de Jira.

A9: aviso → cicatriz J6 «Lancé un bucle de 2.440 `git diff` sin cronometrar uno antes, y el arnés lo mandó a segundo plano: la cuarta vez de la misma familia» — no se pudo comprobar: ningún hook multiplica iteraciones por duración antes de lanzar, y las tres cicatrices anteriores de esta familia no lo impidieron
