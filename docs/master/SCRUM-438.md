# SCRUM-438 · Fase 1 — Atestiguar el sobre mientras todavía verifica (+ propuesta de v:3, SIN construir)

**Fecha:** 11-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `6cd4cffac1c3291da0caad6a3a4a10cc5c4a45c2` · 2026-08-10T19:08:12+02:00

**Paso 0:** ninguna rama remota con `438` ni `atestig`.

> 🔴 **ESTA ENTREGA NO CONSTRUYE v:3.** No se ha tocado `computeAlbaranContentHash`, ni
> `obraSegunVersion`, ni las recetas congeladas, ni el camino de emisión (regla 38). La propuesta
> del §3 se aprueba **antes** de escribirse.
>
> **Y no se escribe NADA en ninguna base:** ni el sobre (regla 29), ni el albarán, ni `AuditLog`.

## 1 · Por qué esto corre prisa, y por qué con un sobre sí hay salida

SCRUM-431 midió que el sobre lee **cinco campos EN VIVO** al verificar. En producción hay **UN
SOLO sobre emitido, y es v:1** (cero v:2 — el camino de C5 no se ha ejercitado nunca contra datos
reales). Con doscientos esto no tendría arreglo barato; con uno, sí: **ejecutar la verificación
ahora, mientras cuadra, y dejar constancia fechada.**

⚠️ **Y caduca.** `Job.titulo` tiene escritor desde SCRUM-317 y `Job.direccion` desde SCRUM-424. En
cuanto uno de los cinco se toque, para ese albarán ya no se puede hacer.

## 2 · Lo construido

| Fichero | Qué |
| --- | --- |
| `src/modules/fiscal/evidencias/atestiguamiento.ts` | **nuevo** · el documento, puro, sin `prisma` |
| `scripts/atestiguar-sobres.mjs` | **nuevo** · CLI **de solo lectura** |
| `src/modules/fiscal/evidencias/paquete.ts` | la política, **dentro del ZIP** |
| `tests/scrum438-atestiguar.test.mjs` | **nuevo** · 11 tests |

### 🔴 Qué es el documento, y qué NO es — con esas palabras, dentro de él

El campo `queEsEsto` viaja **en el propio documento**, no en un README que se separa de él:

> *«VERIFICACIÓN FECHADA, NO UNA FIRMA. … NO es un sellado, NO equivale a haber sellado esos
> valores y NO añade ninguna garantía criptográfica que el sobre no tuviera ya.»*

Hay test de que ese texto está y de que **no insinúa lo contrario**. Si lo insinuara sería peor que
no tenerlo: convertiría una nota interna en una prueba que nadie puede sostener.

### Por qué la herramienta SÍ puede apuntar a producción

**Porque no escribe.** Un aplicador de SQL acotado a dev (SCRUM-425) y un lector que puede mirar
producción no son incoherentes: la diferencia es si toca algo. Y no es una promesa — el guard
**deriva** las llamadas a prisma del CLI y falla si aparece una que no sea de lectura (forma de
SCRUM-371), con su propio control en rojo.

> **Dónde NO se guarda:** no en `AuditLog` — ver §2 bis ①, ya decidido.

### Lo probado contra bases reales

| Base | Resultado |
| --- | --- |
| **dev** (`yaqu_dev_javier`) | **0 albaranes firmados** → 🔴 el suelo dispara y **no emite nada**: «nada que atestiguar» y «todo verificado» no son lo mismo. Sale con código **1** |
| **staging** (`railway`) | **1 firmado, y SIN sobre de evidencias** → se declara «NO SE PUDO MIRAR» y, al no poder atestiguar ninguno, sale con código **1** |
| **producción** | **NO la toco: no tengo la clave y así sigue.** El comando va abajo |

## 2 bis · Las dos decisiones del asesor (11-ago-2026), aplicadas

**① El atestiguamiento vive en `docs/legal/atestiguamientos/`.** Y el motivo de fondo no es solo
no ampliar `AuditAction`: **el AuditLog se escribe en 10 sitios y no se lee en ninguno**. Meter un
documento legal en un registro que nadie abre es guardarlo donde no se va a mirar. Un fichero
versionado tiene tres cosas que el AuditLog no tiene: **historia inmutable, revisión por PR antes
de entrar, y alguien que lo lee para aprobarlo.** Queda escrito en el `--help` del script.

**③ La política va SIEMPRE dentro del ZIP — es regla desde hoy**, con su motivo:

> *«Si solo saliera cuando algo falla, su presencia sería la señal, y habría motivo para quitarla.
> Un documento que solo aparece con malas noticias se convierte en la mala noticia.»*

Hay test que construye el paquete en los dos extremos —sin hallazgos y con un hallazgo— y exige la
pieza en los dos.

---

## 3 · ✅ v:3 — **PROPUESTA APROBADA por el asesor el 11-ago-2026, con CUATRO ENMIENDAS OBLIGATORIAS**

> **Sigue sin haber una sola línea de código de v:3.** La construcción va en su propia sesión con
> su propio prompt. Lo que hay aquí es el contrato que se aprobó, con las enmiendas incorporadas
> **en el sitio de la pieza que corrigen** — no en una lista aparte que luego nadie cruza.
>
> Las enmiendas **1, 2 y 3 son consecuencia de mi propia corrección del §3 bis** (el PDF llama a
> `obraSegunVersion` con la versión guardada); la **4** es una pregunta que la propuesta **no se
> hacía**.

### Qué entra en el sobre

Los **cinco campos vivos** pasan a guardarse DENTRO de `evidenciaFirma`, y la receta v:3 los lee de
ahí y no de las tablas: `obra` · `referenciaTrabajo` · `cliente` · `emisor` · `emisorNif`.

Con eso, verificar deja de depender de que nadie corrija una razón social. **Es la única opción que
ataca la causa**; las demás tratan el síntoma.

### Cómo despacha `obraSegunVersion` y sus hermanos

Hoy `obraSegunVersion` es `if (version === 1) → jobDireccion; si no → lugarEntrega`. Propuesta:
**un despachador por versión con recetario explícito**, como ya tiene el verificador
(`RECETAS_POR_VERSION`), en vez de un `if` con rama por defecto.

### Y la versión desconocida — el defecto que ya medí

🔴 **Hoy `obraSegunVersion` cae EN SILENCIO a la rama de v:2** con cualquier versión que no sea
exactamente `1`: `3`, `99`, `null`, `NaN`. El verificador de SCRUM-369 sí acierta
(`version_no_soportada`, y se niega a aproximar); el sellador no.

**Propuesta: que lance.** Atenuante medido: `recomputarHashDeEvidencia` **no tiene ningún llamador**
fuera de su fichero, así que hoy es una **trampa cargada, no una herida abierta** — y es más barato
desarmarla antes de que v:3 la active.

### Las líneas que habría que escribir, una a una

**① `FirmaEvidencia` gana un bloque `contenidoCongelado`** — dentro de `evidenciaFirma`, que ya es
`Json?`: **cero schema**. Opcional en el tipo, porque los v:1 y v:2 no lo tienen y **no se rellena
a posteriori jamás** (mismo criterio que `firmadoPorNombre` en C5).

```ts
contenidoCongelado?: {
  obra: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
};
```

> ### 🔴 ENMIENDA 1 (asesor, 11-ago) · **TODO O NADA**
>
> **El bloque tiene las CINCO claves o NO EXISTE.** Un bloque con tres de cinco haría que la receta
> v:3 leyera `undefined` **como si fuera un valor sellado**, y eso **no se distingue de un `null`
> legítimo** — que no es un caso teórico: hoy `obra` es `null` en todos los sobres.
>
> **El sellador escribe las cinco siempre.** Y un bloque incompleto **FALLA nombrando la clave que
> falta**; no se completa con nulos, porque completar con nulos es justamente fabricar el valor
> sellado que no se tenía.
>
> *Consecuencia para la construcción:* la receta v:3 valida la forma del bloque **antes** de
> serializar, y ese fallo tiene su test.

**② `recetaV3`, escrita ENTERA y aparte**, con sus claves en su orden — no se deriva de v:2 ni se
comparte un helper: es la regla escrita del propio fichero (`JSON.stringify` serializa por orden de
inserción, y un helper compartido ataría el orden de una versión al de otra). El delta con v:2 es
que los cinco salen de `contenidoCongelado` y no de las fuentes vivas.

**③ `ALBARAN_CONTENIDO_VERSION_ACTUAL = 3`** y `RECETAS_POR_VERSION` gana su `3: recetaV3`. El
guard de SCRUM-369 ya exige que toda versión que el sellador construya tenga receta en el
verificador: **se pondría rojo hasta que las dos existan**, que es lo que se quiere.

**④ `buildFirmaEvidencia` guarda los cinco al sellar** — resolviéndolos donde ya los resuelve hoy,
sin consulta nueva. Es **la única línea que toca el camino de sellado**, y es el STOP.

> ### 🔴 ENMIENDA 2 (asesor, 11-ago) · **el diff del sellado va ENUMERADO, no resumido**
>
> En la entrega, **el diff del camino de sellado se pone línea a línea en el informe**. Es la única
> parte que toca emisión: *«la quiero leer, no que me la cuenten»*.
>
> ### Y una consecuencia que la propuesta no decía
>
> **El PDF tiene HOY el mismo defecto**: imprime la obra leyéndola en vivo (`albaran.service.ts:685`,
> ver §3 bis). Así que ④ **no solo arregla la verificación — arregla también lo que el PDF imprime**,
> de v:3 en adelante. Lo que hoy sale bien porque el dato no ha cambiado, pasará a salir bien
> porque está sellado.

**⑤ 🔴 `obraSegunVersion` LANZA ante una versión que no conoce** — *aprobado por el asesor desde
ya*. Hoy es `if (version === 1) → jobDireccion; si no → lugarEntrega`, así que `3`, `99`, `null` y
`NaN` caen **en silencio** a la rama de v:2.

> *«Un despachador que elige una rama para una versión que no reconoce está adivinando, y hoy
> acierta solo porque nadie lo llama.»*

Y ese «nadie lo llama» está medido: `recomputarHashDeEvidencia` **no tiene llamadores** fuera de su
fichero. Es una **trampa cargada, no una herida abierta** — y v:3 sería justo lo que la activa,
porque estrena una versión que la rama por defecto interpretaría mal.

> ### 🔴 ENMIENDA 3 (asesor, 11-ago) · **cambia de firma, y el PDF es quien obliga**
>
> ⚠️ **El párrafo de arriba está INCOMPLETO y se conserva tal cual porque es lo que se aprobó
> leer.** La corrección está medida en el §3 bis: `obraSegunVersion` tiene **tres** llamadores y el
> tercero —**el PDF**, `albaran.service.ts:685`— **está vivo** y le pasa la versión **guardada**.
>
> *«Un albarán v:3 caería en la rama de v:2, imprimiría `lugarEntrega`, y **coincidiría por
> accidente** — que es la peor forma de estar mal.»*
>
> Por tanto: **`obraSegunVersion` cambia de firma** —tiene que poder leer el bloque congelado, no
> solo las dos fuentes vivas— **y el cambio del PDF va en el MISMO commit**.
>
> **🔴 CONDICIÓN DURA:** **v:1 y v:2 imprimen EXACTAMENTE lo que imprimen hoy.** El PDF de un
> albarán viejo **no puede cambiar ni un carácter** por este trabajo. **Test explícito**, y con el
> control de que sabría verlo si cambiara.

**⑥ Vector congelado de v:3** en el banco de SCRUM-369, junto a los de v:1 y v:2, para que el
sellador y el verificador sigan siendo **dos testigos independientes**.

> **Y la medición D lo vuelve OBLIGATORIO, no recomendable:** hay guard que exige el vector al
> cambiar el recetario (`scrum369:406-409`) — *«una versión que se sabe despachar sin vector
> congelado no está verificada, está declarada»*.

**⑦ El bucle de diagnóstico cruzado, con TRES recetas** (el cuarto despachador del §3 bis A). Ese
bucle prueba **cada receta contra cada sobre** para separar «manipulado» de `hash_de_otra_version`
(SCRUM-415). **v:3 no añade una receta: añade una receta Y N comparaciones cruzadas más.** Entra en
el coste, y con **test de que sigue separando las dos cosas con tres recetas, no solo con dos**.

---

> ## 🔴 ENMIENDA 4 (asesor, 11-ago) · ¿QUÉ PASA SI SE REVIERTE EL DESPLIEGUE?
>
> La pregunta que la propuesta no se hacía: si v:3 se despliega, se sella un sobre, y **luego el
> despliegue se echa atrás**, ese sobre queda sellado con una versión que el código anterior no
> sabe verificar. **Escrito ahora, antes de que exista el primer sobre v:3.**
>
> ### Qué pasa exactamente — MEDIDO, ejecutando el código de hoy contra un sobre v:3
>
> «El código anterior» es literalmente el de hoy (`versionesSoportadas() → 1, 2`), así que se pudo
> medir de verdad en vez de razonarlo:
>
> | Camino | Con un sobre v:3, el código anterior… |
> | --- | --- |
> | `verificarSobre` (el ZIP de evidencias, camino vivo) | ✅ **`version_no_soportada`** — *«NO se aproxima con la más parecida»*. **NO dice «manipulado»** |
> | `computeAlbaranContentHash(params, 3)` | ✅ **LANZA** `albaran_contenido_version_desconocida:3` |
> | `atestiguar-sobres.mjs` | ✅ **`SobreIlegibleError`**: lo declara y no lo cuenta como verificado |
> | 🔴 `obraSegunVersion(3, …)` → **el PDF** | **devuelve `"C/ Mayor 12"`** — cae a la rama de v:2 **en silencio** |
>
> ### La conclusión, y no es la que temía
>
> **Revertir NO produce una acusación falsa.** El sobre v:3 pasa a ser **no verificable** —el
> producto dice que no puede comprobarlo— y eso es lo correcto: *«no pude mirar» y «está
> manipulado» son cosas distintas, y aquí salen por puertas distintas.* Se lo debemos al rigor de
> SCRUM-369 y de SCRUM-415, que ya estaban.
>
> **Lo que sí queda mal es el PDF**, y por la misma vía del §3 bis: imprimiría `lugarEntrega`
> coincidiendo por accidente. Con la ENMIENDA 3 aplicada `obraSegunVersion` lanzaría, así que tras
> revertir **el PDF de un albarán v:3 fallaría en vez de imprimir un valor adivinado** — que es el
> modo de fallo correcto, pero hay que saberlo antes, no descubrirlo.
>
> ### Y lo que queda dicho para que nadie revierta sin saberlo
>
> **Aviso escrito en `docs/MIGRATIONS_PENDING.md`** — que no es una migración de schema y se dice
> allí con esas palabras, pero **es el fichero que se lee antes de tocar producción**, que es
> exactamente cuándo hace falta. Un documento aparte no se abre el día del rollback.
>
> **Regla que deja escrita:** el despliegue que estrena v:3 **es de ida**. Si hay que revertir el
> código, se revierte **sabiendo** que los sobres sellados mientras tanto quedan como
> `version_no_soportada` hasta que se vuelva a desplegar — y **jamás se «arregla» reescribiendo su
> `v`**: eso es tocar una evidencia emitida (regla 29).

### Lo que NO entra en v:3, y conviene decirlo

* **No se migra ningún sobre.** Ni v:1 ni v:2 se recalculan, se rellenan ni se «arreglan»: lo
  firmado no se toca ni siquiera para mejorarlo (regla 29).
* **No se retiran las recetas viejas.** Un verificador que dejara de saber recalcular v:1
  declararía no verificable el único sobre que hay en producción.
* **No se tocan los cinco campos de origen** ni se les pone candado: **decisión ya tomada** —
  prohibir corregir la razón social de un cliente es como se desactiva un sello.

### Coste y riesgo

| | |
| --- | --- |
| **Coste** | receta v:3 escrita **entera y aparte** (no se deduplica: es la regla del fichero) + su vector congelado + subir `ALBARAN_CONTENIDO_VERSION_ACTUAL` + el despachador |
| **Schema** | **ninguno**: los cinco caben en `evidenciaFirma`, que ya es `Json?` |
| **Riesgo alto** | toca el **sellado** → regla 38 → **STOP**. Un error aquí no se nota el día que se comete: aparece meses después como un «no coincide» sobre un documento intacto |
| **Lo que NO arregla** | **el pasado.** Los sobres v:1 y v:2 ya emitidos seguirán leyendo en vivo: sus recetas están congeladas y **no se tocan** (regla 29). Para ésos, lo que hay es el atestiguamiento del §2 y la política del §4 |

## 3 bis · PASO 0 de v:3 — medición, **cero código** (11-ago-2026)

### A · Sitios que despachan por versión de sobre — **CINCO, enumerados**

| # | Dónde | Qué hace con una versión que no conoce |
| --- | --- | --- |
| 1 | `contenidoCanonico` — `albaran.service.ts:396` (v:1) y `:412` (v:2) | ✅ **LANZA** `albaran_contenido_version_desconocida:<v>` (`:447`), y lo dice: *«no se aproxima con la más parecida»* |
| 2 | 🔴 `obraSegunVersion` — `:479` | **cae EN SILENCIO a la rama de v:2** |
| 3 | `verificarSobre` · despacho — `albaranVerificacion.ts:322-336` | ✅ `version_ausente` / `version_no_soportada`; se niega a aproximar |
| 4 | `verificarSobre` · **diagnóstico cruzado** — `:372-385` (SCRUM-415) | recorre **TODAS las demás recetas** para separar «manipulado» de `hash_de_otra_version` |
| 5 | `atestiguamiento.ts:113-116` | ✅ lanza `SobreIlegibleError` |

**El nº 4 no lo tenía enumerado y cambia el trabajo de v:3:** ese bucle prueba cada receta contra
cada sobre. Al añadir v:3 empezará a probar la receta de v:3 sobre los sobres v:1 y v:2 (y al
revés). Es lo correcto —es lo que evitó la acusación falsa de SCRUM-415— pero **hay que contarlo en
el coste**: v:3 no añade una receta, añade una receta **y N comparaciones cruzadas más**.

### 🔴 A bis · CORRIJO ALGO QUE DIJE EN EL §3: el fallback mudo SÍ tiene consumidor vivo

`obraSegunVersion` tiene **TRES** llamadores, no dos:

| Llamador | Qué versión le pasa | ¿Vivo? |
| --- | --- | --- |
| `recomputarHashDeEvidencia` — `:508` | la **guardada** (`ev.v`) | **no**: sin llamadores fuera del fichero |
| `buildFirmaEvidencia` — `:569` | la **ACTUAL** (constante) | sí, pero nunca le llega una desconocida |
| 🔴 **el PDF** — `:685` | la **guardada** (`(albaran.evidenciaFirma as any)?.v`) | **SÍ, VIVO** |

Escribí que era *«una trampa cargada, no una herida abierta»* apoyándome en que
`recomputarHashDeEvidencia` no tiene llamadores. **Estaba incompleto: el PDF la llama**, con la
versión guardada, y su comentario (`:681-684`) promete *«el PDF imprime la obra QUE SE SELLÓ»*.

**Consecuencia concreta para v:3, y no es menor:** un albarán v:3 pasaría hoy por
`obraSegunVersion(3, …)` → rama de v:2 → imprimiría `lugarEntrega`. Coincidiría con lo sellado
**por accidente**, no por diseño. Así que la pieza ⑤ de la propuesta **no es gratis**:
`obraSegunVersion` necesita **cambiar de firma** para v:3 —tiene que poder leer el bloque
congelado, no solo las dos fuentes vivas— y **el PDF es el llamador que lo obliga**. Eso hay que
aprobarlo con el resto.

### B · Qué hace el guard de SCRUM-369 al subir la versión — **el mecanismo, no la promesa**

`tests/scrum369-verificador-sello.test.mjs:675-698`. No es una lista escrita a mano:
`versionesQueElSelladorPuedeEmitir(...)` **deriva del código fuente del sellador** qué versiones
puede construir `contenidoCanonico`, y exige que todas estén en `versionesSoportadas()`.

**Cuándo se pone rojo, exactamente:** **en el commit que añade la rama `if (version === 3)` a
`contenidoCanonico`**, aunque no se haya tocado nada más — antes de que exista `recetaV3`. Y su
mensaje dice qué hacer: *«añadir su receta a `RECETAS_POR_VERSION` (ENTERA y aparte, sin helpers
compartidos) y congelar su vector»*.

Lleva **suelo propio**: si no encuentra ningún contenido canónico en `albaran.service.ts`, falla
diciendo que *«este guard ha dejado de mirar donde debía»* — no pasa en verde por no encontrar nada.

### C · Recetas vivas hoy, y quién las llama

| Receta | Quién la llama |
| --- | --- |
| `recetaV1` · `recetaV2`, en `RECETAS_POR_VERSION` (`albaranVerificacion.ts:289`, `Object.freeze`) | `verificarSobre` y `verificarPoblacion` por parámetro por defecto (`:310`, `:460`) + el bucle cruzado (`:372`) |
| Camino **vivo** de producto | `paquete.repo.ts:19,95` → el ZIP de evidencias |
| En el **sellador** | las ramas v:1 (`:396`) y v:2 (`:412`) de `contenidoCanonico` |

**Con la lista delante se demuestra lo declarado:** retirar `recetaV1` dejaría `versionesSoportadas()`
en `[2]`, y el **único sobre que hay en producción es v:1** → `verificarSobre` devolvería
`version_no_soportada` y el ZIP de evidencias declararía **no verificable** ese albarán. Por eso las
viejas no se retiran.

### D · El orden de claves — **SÍ está garantizado. No es hallazgo**

Lo garantizan **vectores congelados escritos a mano** (`scrum369:23-38`), no recalculados:

> *«un test que compara el resultado del sellador contra el resultado del propio sellador no puede
> fallar nunca — si alguien cambia el cálculo de v:1, los dos lados se mueven juntos… Con el
> literal congelado, cualquier cambio en el cálculo de v:1 —reordenar una clave, extraer un helper
> compartido, normalizar un campo— sale ROJO EN EL COMMIT QUE LO HACE.»*

Reforzado por: `RECETAS_POR_VERSION` va con `Object.freeze` y hay test de que **el candado está
echado** (`:576-579`, con sabotaje que lo demuestra en rojo), y un guard de que **cambiar el
recetario obliga a actualizar el vector** (`:406-409`): *«una versión que se sabe despachar sin
vector congelado no está verificada, está declarada»*.

**Consecuencia para v:3:** su vector congelado **no es opcional** — hay guard que lo exige.

### Lo que caduca antes de que ejecutes el atestiguamiento

**Nada nuevo de esta medición.** Sigue en pie lo del §1: el atestiguamiento caduca en cuanto se
toque uno de los cinco campos vivos (`Job.titulo` y `Job.direccion` ya tienen escritor). El hallazgo
del PDF **no caduca**: es código, no dato.

---

## 3 ter · 🔴 TRASPASO · v:3 A MEDIO CONSTRUIR — **la tanda está en ROJO: 2595 pasan, 5 caen**

> **Escrito para quien NO vivió la sesión del 11-ago.** Si vas a seguir esto, léelo entero antes de
> tocar nada: hay cosas ya medidas que **no hay que volver a medir**, y hay una decisión de diseño
> que costó dos intentos.
>
> **La rama es `scrum-438-v3-sobre`, que sale de `scrum-438-atestiguar`** (no de `main`: las dos
> comparten este fichero y la fase 1 sigue sin mergear).

### La decisión de diseño que costó dos intentos — **no la reabras**

La primera versión de `recetaV3` llamaba a un resolvedor compartido (`contenidoSegunVersion`), y el
guard ⑥ de SCRUM-369 la tumbó: **el verificador no importa código ejecutable.**

**No era una premisa caducada: es el diseño.** Palabras del asesor, que conviene tener delante:

> *«Dos testigos que comparten código son UN testigo, y un fallo en lo compartido daría la misma
> respuesta equivocada en los dos lados.»*

Por eso `recetaV3` lee `f.contenidoCongelado` **directamente**, con su validación de las cinco
claves escrita **dentro de la propia receta** — coherente con la regla del fichero (cada receta
entera y aparte, sin depender de nada compartido). El «un solo sitio» sigue existiendo donde sí
hacía falta: **el sellador y el PDF**, que eran los dos que podían divergir.

**Descartadas con motivo, para que no vuelvan:** aflojar el guard de 369 (cambia el invariante más
fuerte del sistema de evidencias por diez líneas de validación) y duplicar el resolvedor entero
(un guard que «cuida» dos copias mantiene una divergencia en vez de impedirla).

### Qué está construido, y qué no

| Pieza | Estado |
| --- | --- |
| ① bloque `contenidoCongelado`, **todo o nada**, falla nombrando la clave | ✅ |
| ② `recetaV3` **entera y aparte, sin importar nada** | ✅ |
| ③ `ALBARAN_CONTENIDO_VERSION_ACTUAL = 3` + `RECETAS_POR_VERSION[3]` | ✅ |
| ④ sellador: el bloque se construye **UNA sola vez** (lo sellado y lo guardado salen del mismo objeto) | ✅ |
| ⑤ `contenidoSegunVersion` lanza ante versión desconocida · el PDF lee **los cinco** por él | ✅ |
| ⑥ vector congelado de v:3 | ✅ |
| **⑦ bucle cruzado con TRES recetas** | ❌ **sin test** |

**Ficheros tocados:** `albaran.service.ts` (sellador y PDF) · `albaranVerificacion.ts` (recetaV3) ·
`albaranBarrido.ts` (el adaptador lleva el bloque desde el sobre; **sin esto un v:3 no se puede
verificar en absoluto**) · `albaranContenidoFuentes.ts` (**nuevo**) · `scrum68-evidencias-firma.test.mjs`
· `scrum369-verificador-sello.test.mjs`.

### 🔴 Los cinco guards que caen, con su NATURALEZA

**No son lo mismo y no se arreglan igual.**

| Guard | Naturaleza | Qué hay que hacer |
| --- | --- | --- |
| **SCRUM-371 · «el adaptador resuelve CADA FUENTE igual que el sellador»** | 🔴 **REAPUNTADO DE FONDO** | Su analizador de AST ya no resuelve `cliente`/`emisor` porque en v:3 salen del bloque, no de un literal del sellador. El invariante al que hay que reapuntarlo lo fijó el asesor: **«para CADA versión, el resolvedor de contenido lee EXACTAMENTE las fuentes que declara la receta de esa versión — ni una de más, ni una de menos»**. `FUENTES_POR_VERSION` (en `albaranContenidoFuentes.ts`) existe **para eso**: es la declaración contra la que carar. ⚠️ Si al escribirlo ves que el invariante no se puede derivar, **PARA y dilo antes de aflojarlo** |
| **SCRUM-371 · «el adaptador no disimula lo que no encontró»** | 🔴 **REAPUNTADO DE FONDO** (hermano del anterior) | Mismo analizador |
| **SCRUM-374** | premisa caducada | Pinea que «la versión de HOY toma la obra de `Albaran.lugarEntrega`». Con v:3 la toma del bloque. Se reapunta, **no se le suma un número** |
| **SCRUM-415 · SUELO** | premisa caducada | «hay MÁS DE UNA versión viva y dan hashes distintos» — escrito para dos, ahora son tres |
| **SCRUM-424 · R4** | premisa caducada | `versionLeeJobDireccion(ALBARAN_CONTENIDO_VERSION_ACTUAL)`: con ACTUAL=3 el resolvedor **lanza** en vez de devolver `lugarEntrega`. Es lo correcto; el test es de cuando ACTUAL era 2 |

### Qué falta de tests

* **Sellar → verificar → cuadra, con los CINCO campos vivos CAMBIADOS después de sellar.** Es *el*
  test: el que prueba que v:3 hace lo que existe para hacer.
* **v:1 y v:2 imprimen y verifican EXACTAMENTE como hoy, carácter a carácter.** Condición dura del
  asesor, y la que más va a mirar del diff.
* **El mismo escenario en v:1/v:2 sigue dando `dato_vivo_cambiado`**, no verde: su comportamiento
  no mejora ni empeora.
* **⑦** el bucle cruzado separando «manipulado» de `hash_de_otra_version` **con tres recetas**.
* **Los rojos por el mecanismo** en ① (clave que falta), ⑤ (versión desconocida) y ⑦, **cada uno con
  post-condición**: una inyección que no llega al disco es una prueba NO ejecutada.
* **Y el del bucle `dato_vivo_cambiado` con v:3**, que ya está razonado sobre el código pero sin
  test: `recetaV3` no lee esos campos, así que anularlos no cambia su hash y la condición no puede
  cumplirse. Ponle el test igualmente — un razonamiento correcto hoy no impide que alguien cambie
  la receta mañana.

### ✅ Lo que YA está medido y **no hay que volver a medir**

* **`computeAlbaranContentHash` NO tiene hallazgo.** Sólo hay **dos** llamadores en `src/`
  (`recomputarHashDeEvidencia`, que pasa `ev.v`; y `buildFirmaEvidencia`, que pasa la actual y
  aporta el bloque) y **los dos son explícitos**. Los cuatro tests que caían eran el banco de
  SCRUM-68, **ya arreglado**: aporta el bloque. **Ningún camino sellaría un v:3 sin contenido.**
* **El defecto por omisión sigue siendo la versión ACTUAL**, por decisión del asesor: clavarlo a una
  versión vieja sellaría formato antiguo para siempre sin que nadie se enterara.
* **El guard de SCRUM-369 ya está reapuntado** al invariante *«toda versión del recetario tiene
  vector congelado»*, con suelo. **Ya no caduca con v:4** y no hay que volver a tocarlo.
* **El vector congelado de v:3 se calculó CON EL SELLADOR**, nunca con el verificador. Si se
  calculara con el verificador **dejaría de ser un testigo y pasaría a ser un espejo**.
* **v:3 ignora por completo las fuentes vivas** — comprobado cambiándolas las seis: mismo hash. Las
  fuentes vivas de `FUENTES_V3` llevan `'VIVO-NO-USAR'` a propósito, para que una receta que se
  equivocara y leyera una fila viva no cuadrara con el vector.
* **`contenidoSegunVersion` acierta en las seis situaciones**, incluida `undefined` = **sin firmar**,
  que **NO lanza**: es un borrador, no una versión rara. Confundirlas rompería el PDF de todos los
  albaranes no firmados.

---

## 4 · La política, dentro del ZIP — ✅ **texto APROBADO** (asesor, 11-ago-2026)

Va como `alcance-de-la-verificacion.txt` **dentro del paquete**, y **siempre** (§2 bis ③). El texto
está **fijado entero** en `paquete.ts` (`POLITICA_SOBRES_ANTERIORES`): reformularlo es cambio de
máster, no una mejora de redacción.

**Y lleva la misma segunda capa que el 409 de SCRUM-358**: un invariante aparte que impide que el
texto vuelva a insinuar que esto es una firma —prohíbe «certifica», «garantiza la autenticidad»,
«validez legal»…— y que exige que siga diciendo **«integridad parcial verificable»** y **«lo que no
viaja, no»**.

Las dos capas, probadas en rojo por separado:

| Mutación | Cae diciendo |
| --- | --- |
| se reformula el texto | *«no es el aprobado por el asesor el 11-ago-2026 … reformularlo es cambio de máster»* |
| se reformula **y se actualiza el test exacto a juego** —lo que haría alguien «arreglándolo»— | *«el alcance dice “certifica”: eso INSINÚA que este paquete firma o certifica algo, y no lo hace»* |

> **Nota de método, otra vez:** el primer intento de la segunda mutación **no tocó el test** (mal
> escapado en el shell) y el rojo salió por la capa equivocada. Rehecha con post-condición que
> exige que **los dos ficheros** hayan cambiado. Es la misma lección de ayer: ante un rojo o un
> verde que no encaja, el primer sospechoso es la mutación.

## 5 · Verificación

| | Qué | Resultado |
| --- | --- | --- |
| **Control positivo** | atestigua un sobre de fixture que **cuadra de verdad**, y el registro reproduce la verificación (el hash se calcula con la **receta congelada**, no se escribe a mano: un literal probaría que dos constantes son iguales) | ✅ |
| **🔴 SUELO** | siete formas de no poder mirar —sin sobre, sin versión, versión no numérica, versión desconocida, sin hash— **lanzan**. Con control de que el sobre bueno sí pasa | ✅ |
| Distinción | un hash que **no cuadra** SÍ produce documento: eso sí se pudo mirar, y es un hallazgo que hay que fechar | ✅ |
| **🔴 Rojo por el mecanismo** | se cambia un campo vivo → **nombra cuál**, con su valor de antes y de ahora, y dice que el atestiguamiento es **ANTERIOR**. Los cinco, uno a uno | ✅ |
| Prueba de que no es cosmético | con el campo cambiado, el sobre **ya no verifica** — si eso saliera verde, sobraría toda esta tarea | ✅ |
| **Regla 29** | el CLI **solo lee**: métodos de prisma derivados, con control en rojo. Y el dominio **no importa `prisma`** ni toca `AuditLog` | ✅ |
| Anti-envejecimiento | los cinco campos se caran contra cómo los resuelve el adaptador: si el sobre leyera un sexto, esto se quedaría corto en silencio | ✅ |

### Tres guards ajenos que me cazaron, y qué cambié

1. **SCRUM-349 otra vez** (tercera hoy): el guard de «no escribe en AuditLog» cayó sobre **el
   comentario que explica la prohibición**. Arreglado con `soloEjecutable`, **sin borrar el
   comentario**.
2. **SCRUM-409**: mi fixture usaba `merchantId: 1`, el merchant demo. Cambié **el fixture**.
3. **SCRUM-297**: el manifiesto **sella todas las piezas** del ZIP y mi fichero entraba después.
   Movido **antes** de construir el manifiesto — ahora va sellado como las demás. Buen guard: sin
   él habría metido en el paquete una pieza que nadie podía comprobar.

## 6 · El comando para producción (lo ejecuta el fundador)

```bash
node scripts/atestiguar-sobres.mjs --clave DATABASE_URL --salida docs/legal/atestiguamientos/produccion-2026-08-11.json
```

**Solo lectura.** Imprime destino (`host/base`, sin la URL), la población, y el atestiguamiento de
cada sobre. **Códigos de salida:** `0` todo atestiguado · `2` hay sobres que no se pudieron mirar ·
`1` no se pudo atestiguar ninguno (o cero firmados).

**Qué esperar, con el dato de hoy:** 1 albarán firmado, sobre v:1. Si **cuadra**, el fichero de
salida es la evidencia congelada de ese sobre y debería entrar al repo por PR. Si **no cuadra**,
alguien ya tocó uno de los cinco campos y hay que decirlo — el documento lo registra igual, que es
para lo que sirve.

## 7 · Lo que no se ha tocado

El sellado · `computeAlbaranContentHash` · `obraSegunVersion` · las recetas congeladas · el
verificador · el camino de emisión · `prisma/schema.prisma` · `AuditAction` · ningún `.env` ·
**producción**.

---

## 3 quater · ✅ v:3 CERRADA — los cinco guards en verde, y una medición que sale bien

**Medido contra:** `origin/main` = `e171c752f61231bec77dc2c22ecc7f82167d964c` · `2026-08-10T18:58:26Z`

| | Antes de esta sesión | Después |
| --- | --- | --- |
| Tanda | 🔴 2674 tests · 2595 pasan · **5 caen** · salida **1** | ✅ 2691 tests · 2617 pasan · **0 caen** · salida **0** |
| `guards:entrada` | — | ✅ 4 guards, 17 tests |

### Los cinco guards: ninguno se relajó, a los cinco se les cambió la premisa

**GRUPO A · SCRUM-371 ×2 — el reapuntado de fondo.** El invariante que fijó el asesor está escrito
y **se deriva del árbol**, que era la duda que la sesión anterior dejó abierta:

> para CADA versión, la receta lee EXACTAMENTE las fuentes que declara `FUENTES_POR_VERSION` para
> esa versión — ni una de más, ni una de menos.

Las dos listas se leen del **producto**, no del test: `RECETAS_POR_VERSION` sale del AST del
verificador (y de ahí qué receta atiende cada versión, **no del nombre**: `recetaV3` apuntada al 4
por error es justo lo que un guard que confía en los nombres no vería) y `FUENTES_POR_VERSION` del
módulo de declaración. Se exige además que **las dos hablen de las mismas versiones**. Con eso una
v:4 entra sola en la comparación, y entra **en rojo** hasta que su receta y su declaración digan lo
mismo: **no caduca**.

Y la comparación vieja —adaptador contra sellador— **no se retiró**. Se reapuntó al bloque
congelado, que es donde el sellador resuelve hoy los cinco: sigue cazando un `||` cambiado por un
`??`, que es lo que acusaría de manipulación a **toda la población v:1/v:2 de golpe**. La pareja de
cada clave se **deriva** (la versión más alta que todavía la lee en vivo), no se escribe a mano.

Dos guards nuevos que antes no existían: el adaptador **entrega** todas las fuentes que alguna
receta declara, y el bloque congelado le llega **DESDE EL SOBRE** — no reconstruido de filas vivas.
Sin ese segundo, alguien podía devolver el defecto de SCRUM-431 a v:3 **en verde**.

**GRUPO B · las tres premisas caducadas.** A ninguna se le cambió un 2 por un 3:

* **SCRUM-374** pineaba *«la obra sale de `Albaran.lugarEntrega`»*, que era la **v:2 disfrazada de
  invariante**. El defecto que ese ticket cerró nunca fue ése: era que **la versión de hoy no puede
  leer `Job.direccion`**. Eso es lo que pinea ahora, y se cara además contra la sonda de SCRUM-424.
* **SCRUM-415 · SUELO** ya derivaba el número de versiones; lo que le faltaba eran unas fuentes que
  ejercieran el delta. Ahora llevan el bloque, con valores **distintos** de los vivos a propósito.
* **SCRUM-424 · R4** no era un test caducado: **la sonda LANZABA** (ver abajo).

### 🔴 Dos defectos VIVOS que salieron al cerrar los guards — no son mejoras de paso

**① `versionLeeJobDireccion` reventaba con un sobre v:3.** Llamaba al resolvedor con dos sondas y
sin bloque, así que un Trabajo con un albarán v:3 firmado hacía que **la ruta que escribe la
dirección devolviera 500**. Ahora la sonda aporta un bloque con un **tercer** valor, y —decisión que
hay que saber— **una versión que el resolvedor NO conoce se responde `true` (depende → no se
escribe)**. No es simetría: negarse a escribir es un 409 que alguien resuelve mirando; escribir
sobre una firma que sí dependía deja esa firma sin poder verificarse, y eso no se deshace (regla 29).

**② El `??` que rompía la CONDICIÓN DURA.** `contenidoSegunVersion` colapsaba las fuentes vivas con
`?? null` donde el `obraSegunVersion` al que sustituye usaba `|| null`. **Medido: 12 de 36
combinaciones divergían.** Las dos consecuencias, las dos malas:

* el PDF de un albarán **v:1 o v:2** con una fuente vacía imprimiría la cadena vacía donde hoy no
  imprime nada — *«ni un carácter»*, dice la condición dura;
* `recomputarHashDeEvidencia` sacaría **otro hash sobre un documento intacto**, porque el
  verificador sí colapsa con `||` en `normalizar()`. Los dos testigos habrían dejado de estar en
  fase sin que ninguna prueba lo dijera.

Es exactamente lo que avisa el comentario del propio sellador. Restaurado en tres sitios —el
resolvedor, `contenidoCongelado.obra` del sellador y el adaptador— con el motivo escrito al lado.
El del sellador importa: v:2 resolvía `obraSegunVersion(2, { lugarEntrega: a.lugarEntrega ?? null })`
y **esa función colapsaba con `||`**, así que el efecto era `a.lugarEntrega || null`. Con `??` a
secas, un lugar de entrega vacío se **congelaría** como cadena vacía donde v:2 congelaba `null`.

### ✅ LA MEDICIÓN · ¿está la `v` dentro del contenido que se hashea? **SÍ, y está atada**

Calculada, no deducida del orden de claves. **No hay hueco que declarar aquí:**

| Comprobación | Resultado |
| --- | --- |
| Un albarán cuyos cinco campos vivos **NO** han cambiado, mismo contenido, dos recetas | `recetaV2` = `03ca0042…` · `recetaV3` = `7cfb5a6d…` → **DISTINTOS** |
| Se baja la `v` guardada de 3 a 2 **sin tocar nada más** | ✅ **`hash_de_otra_version`**, y lo NOMBRA: *«el sobre declara v:2, pero su hash es EXACTAMENTE el que da la receta de v:3 … se selló con v:3 y se guardó v:2»* |
| El serializado, rehecho **a mano** sin importar nada del verificador | empieza por la clave `v` y da el mismo hash; quitándosela, **se mueve** (control) |

La cita: en `albaranVerificacion.ts`, `v: 1` / `v: 2` / `v: 3` es la **primera clave** de cada objeto
serializado, y lo mismo en `contenidoCanonico` del sellador. Las dos consecuencias que se temían
—que el bucle cruzado no distinga la receta, y que la `v` guardada no esté protegida— **no se dan**.
Queda con test propio, para que siga siendo verdad.

### Lo que falta de tests: hecho — `tests/scrum438-v3-sobre.test.mjs` (12) + ⑦ en SCRUM-415 (2)

* ① **sellar en v:3 → cambiar los CINCO campos vivos → SIGUE CUADRANDO.** Con suelo (que los cinco
  cambien de verdad) y **control negativo**: tocar una nota del documento firmado sigue saliendo
  `hash_no_coincide`. Y el otro lado: tocar el bloque del sobre **tiene** que caer.
* ② el mismo escenario en v:1/v:2 **no mejora ni empeora**, y su `dato_vivo_cambiado` sigue saliendo
  cuando corresponde. En **v:3 ese bucle no puede cumplirse**, y se mide en vez de razonarse.
* ③ **CONDICIÓN DURA**: las 36 combinaciones de v:1, v:2 y sin-firmar contra el comportamiento de
  ayer **transcrito a mano** (no importado: un test que compara el código de hoy contra el código de
  hoy no puede fallar). Con suelo que exige ver **≥12** diferencias contra un «ayer» con `??`.
  Y las recetas de v:1 y v:2 **ignoran** el bloque: un sobre viejo no cambia de veredicto.
* ④ **rojos por el mecanismo**: el bloque incompleto falla **nombrando cada una de las cinco
  claves**, por los **cuatro** caminos (validador, resolvedor, receta y **sellador**); el resolvedor
  **lanza** con `4`, `99`, `0`, `-1`, `NaN` e `Infinity`, con el control de que `null`/`undefined`
  (sin firmar) **no** lanzan.
* ⑦ el bucle cruzado con **tres** recetas: las **N×(N−1)** parejas, no una muestra, con el control de
  que una manipulación de verdad sigue siendo `hash_no_coincide` pese a tener tres sondeos donde
  colarse.

### Los seis rojos probados POR MUTACIÓN, cada uno con post-condición en disco

Toda mutación comprueba que **cambió el fichero que se dice** antes de correr la tanda: una
inyección que no llega al disco es una prueba **no ejecutada**, no una superada.

| Mutación | Cae diciendo |
| --- | --- |
| una fuente **viva** colada en `recetaV3` | *«v:3 (recetaV3) lee DE MÁS: cliente»* (+3 tests más) |
| el sellador congela `obra` con `??` | *«lugarEntrega: barrido «a.lugarEntrega ǁ null» ≠ contenidoCongelado.obra «a.lugarEntrega ?? null»»* |
| el resolvedor vuelve a `??` | *«EL PDF DE UN ALBARÁN VIEJO IMPRIMIRÍA OTRA COSA»* + las 12 líneas divergentes |
| el adaptador **reconstruye** el bloque de filas vivas | *«sale de «{ obra: a.lugarEntrega…}» y no de `evidenciaFirma`»* |
| el bloque se completa en vez de fallar | *«SE HA ACEPTADO UN BLOQUE SIN «obra» — no ha lanzado nada»* |
| la versión desconocida vuelve a adivinar | *«una versión de sobre DESCONOCIDA se está tratando como “no depende del Trabajo”»* |

### 🔴 HUECOS DECLARADOS — lo que NO se construyó, y por qué

**① El PDF resuelve los cinco pero solo consume DOS.** El traspaso de la sesión anterior daba la
pieza ⑤ por completa con *«el PDF lee los cinco por él»* ✅, y **no es exacto**: `ensureAlbaranPdf`
pasa las seis fuentes al despachador pero solo usa `obra` y `referenciaTrabajo`. **`cliente`,
`emisor` y `emisorNif` siguen imprimiéndose en vivo**, por los objetos `customer` y `merchant`.

*Consecuencia concreta:* en un albarán **v:3** cuyo cliente cambie de razón social después de
firmar, el PDF imprimirá la razón social **nueva** mientras el sello certifica la **antigua**. La
firma sigue verificando —ése es el trabajo de v:3— pero **el papel y el sello dejan de decir lo
mismo** en esos tres campos.

*Por qué no se arregla aquí:* esos objetos llevan también `taxId` del cliente y `address`,
`logoUrl` y `whatsappPhone` del emisor, que **no están entre los cinco**, así que no se pueden
sustituir enteros. Decidir qué campos del papel vienen del sobre y cuáles de la fila de hoy es una
decisión **sobre el documento**, y ésa la toma el asesor. Queda escrito **en el código**, junto a la
línea, además de aquí.

**② Lo que NO verifiqué:** nada se ha ejecutado contra una base de datos. `buildFirmaEvidencia` y
`ensureAlbaranPdf` tocan `prisma` y aquí se prueban por sus piezas puras (`computeAlbaranContentHash`
y `contenidoSegunVersion`), no de extremo a extremo. **No existe todavía ningún sobre v:3**, ni en
dev ni en staging ni en producción: el primero nacerá con el despliegue. Tampoco se ha mirado
yaqu.app: esta entrega no toca ninguna superficie.

**③ `recomputarHashDeEvidencia` no sabe verificar un v:3.** Llama a `obraSegunVersion(ev.v, …)` sin
pasarle el bloque, así que con un sobre v:3 **lanzaría**. Sigue sin tener llamadores fuera de su
fichero (medido en el §3 ter y vuelto a mirar), y el camino vivo —el ZIP de evidencias y el
barrido— va por `verificarSobre`, que sí lo lleva. Es una **trampa cargada**, no una herida abierta:
se declara para que quien le dé un llamador sepa que hay que aportarle el bloque.

**④ `jobDireccion.ts` sale como BINARIO en el diff.** Sus valores de sonda llevan un byte `NUL`
dentro (ya estaba así antes de esta sesión), y git no muestra el diff de un fichero con NUL. Su
cambio va enumerado en el informe porque en el PR **no se puede leer**.

---

## 3 quinquies · 🔴 EL CI EN ROJO POR `scrum297` — y no era lo que parecía

**Medido contra:** `origin/main` = `e05087b0bb6edf7fc9a1b9ca391e2340eace76dc` · `2026-08-10T19:45:46Z`

`main` mergeada DENTRO de la rama antes de medir. Tanda tras el merge y antes de tocar nada:
**2805 tests · 2731 pasan · 0 caen**. Tras el arreglo: **2810 · 2736 · 0**. `guards:entrada` verde.

> **PASO 0 · aviso:** `docs/master/SCRUM-438.md` **ya existe en `main`** — es la **fase 1** de este
> mismo ticket, mergeada mientras tanto (`scrum-438-atestiguar` está en `main`). No hay colisión con
> otro ticket, pero **la base del PR cambió**: v:3 va contra `main`, no contra la rama de fase 1. En
> `main` no hay v:3 (`ALBARAN_CONTENIDO_VERSION_ACTUAL = 2`, sin `albaranContenidoFuentes.ts`).

### La causa: NO había ningún sobre v:3 sin bloque. No puede haberlo.

El stack decía `ContenidoCongeladoIncompletoError: falta(n) obra, referenciaTrabajo, cliente,
emisor, emisorNif` — las cinco. Se lee como «hay un sobre v:3 huérfano». **Medido, y no lo hay:**

| Comprobación | Resultado |
| --- | --- |
| ¿El test fabrica sobres con la versión ACTUAL? | **No.** Sella con `sellar(2, …)` y `sellar(1, …)`, versión **explícita**. `ALBARAN_CONTENIDO_VERSION_ACTUAL` solo aparece en `:115`, **dentro de un texto de mensaje** |
| ¿Algún camino real sella v:3 sin bloque? | **No.** Dos llamadores de `computeAlbaranContentHash` en `src/` (`:581` recalcula con la `v` guardada · `:664` `buildFirmaEvidencia`, que **aporta el bloque**) |
| ¿Y si alguien lo intentara? | **El sellador LANZA.** Comprobado por ejecución: un v:3 sin bloque **nunca llega a guardarse** |

**La causa real es `porQueNoCuadra`, la función de DIAGNÓSTICO del propio test.** Recorre
`versionesSoportadas()` pidiéndole `obra` a cada versión; al entrar v:3 en el recetario, empezó a
pedírsela a una versión que la toma del **bloque congelado** — y esas fuentes, que son de v:1/v:2,
no lo traen.

**Y lanzaba desde el MENSAJE de un assert que iba a PASAR.** En JS el argumento `message` se
construye **antes** de evaluar la condición, así que un diagnóstico roto tumba un test que estaba
bien. Por eso el rojo salía en el control positivo del paquete de evidencias, que no tenía nada.

### La pregunta de diseño, MIRADA y no resuelta por omisión

`validarContenidoCongelado` **lanza**. ¿Está bien que lo haga dentro del camino del ZIP de
evidencias? **La premisa del encargo era que sí lo hacía, y NO es así.** Medido:

| Camino | Con un sobre v:3 sin bloque |
| --- | --- |
| `verificarSobre` — el del ZIP (`paquete.repo.ts:95`) | ✅ **NO lanza.** Devuelve `error_al_recalcular`: *«la receta de v:3 no pudo recalcular el hash … Esto NO es una manipulación demostrada: es que no se pudo mirar»* |
| `computeAlbaranContentHash(…, 3)` — el **sellador** | ✅ **LANZA** `ContenidoCongeladoIncompletoError` |

El ZIP **no toca** `obraSegunVersion` ni `validarContenidoCongelado`: entra por `verificarSobre`, que
envuelve la receta en `try/catch` por diseño (*«un barrido que revienta a mitad deja de ser un censo
y pasa a ser un accidente»*).

> **Decisión: no se cambia nada, y el motivo se escribe.** Los dos comportamientos ya conviven y
> están bien repartidos. **Lanzar es correcto donde lanza** —al SELLAR y al imprimir: completar el
> bloque con nulos fabricaría el valor sellado que no se tenía, y `null` es un valor legítimo aquí—.
> **Declarar es correcto donde declara** —al verificar: el profesional tiene que poder descargarse
> su prueba aunque un sobre esté raro—. La barrera está en la **puerta de entrada**; la de salida
> solo tiene que saber contarlo. Queda con test propio para que siga así.

### El arreglo, y por qué el diagnóstico SALE del fichero

`porQueNoCuadra` vivía dentro de un test gateado por `LIBRO_PG_URL`. Se saca a
`tests/_diagnostico-sello.mjs`, con las tres funciones **inyectadas**, para poder probarlo **sin
banco**. Es la lección de SCRUM-419, aplicada a sí misma: **el guard que vigila a los gateados no
puede estar gateado él mismo.**

Lo que hace no cambia. Lo que sí cambia, dos cosas:

* una versión que no se puede probar con estas fuentes se **anota y se sigue** —igual que el bucle
  cruzado del verificador—, en vez de reventar;
* y se **DECLARA** en la salida. Sin eso, la última rama diría *«no lo reproduce NINGUNA versión
  soportada (v:1, v:2, v:3)»* habiendo probado dos: **una mentira con forma de conclusión**.
  «No encaja» y «no se pudo mirar» no pueden volver a ser el mismo número.

### Los rojos por el mecanismo — 5 tests nuevos, SIN gate

| Mutación | Cae diciendo |
| --- | --- |
| el `catch` **re-lanza** (el rojo del CI, exacto) | *«EL DIAGNÓSTICO LANZA … no puede convertirse ella misma en el fallo»* · `version_pide_bloque:3` |
| se atrapa pero **no se declara** el hueco | *«no declara la versión que no pudo probar»*, y enseña la frase que mentiría |
| el sellador **deja nacer** un v:3 sin bloque | *«SE HA ACEPTADO UN BLOQUE SIN «obra» — no ha lanzado nada»* |

Con **control positivo dentro del mismo test** (cuando puede probarlas todas, **no** declara
huecos: un aviso que sale siempre no informa de nada), control de que **sigue cazando la
discrepancia de VERSIÓN** —para lo que existe—, y suelo de **≥3 versiones** en el recetario real.

⚠️ La primera mutación se escribió mal (cambiar `try` por `if` deja un `catch` huérfano: eso no
reproduce el defecto, lo sustituye por un `SyntaxError`). Rehecha para que el `catch` **re-lance**,
que es el defecto de verdad. *Ante un rojo raro, el primer sospechoso es la mutación.*

### 🔴 SE REPORTA, NO SE ARREGLA · la tanda local no corre 74 tests, y 67 no dicen por qué

**Cómo se contó:** `node --test --test-force-exit --test-reporter=tap tests/*.test.mjs`, contando
las marcas `# SKIP` del TAP (el reporter `spec` **no** imprime el motivo).

| | Cuántos | Cómo saltan |
| --- | --- | --- |
| Saltados en total | **74** | — |
| Con motivo escrito | **7** | `skip: !ENABLED && 'sin LIBRO_PG_URL …'` — los 7 de banco de SCRUM-419 |
| 🔴 **MUDOS** | **67** | **65** con `skip: !ENABLED }` + **2** con `skip: !DB }` — booleano, sin texto |

Los mudos salen de `QA_DB_TEST === '1'` (45 ficheros + 2 de `DB`), `BOT_SUITE_TEST` (1) y
`A55_DB_TEST` (1). El número cuadra consigo mismo: 65 + 2 = 67 mudos, + 7 = 74.

**Y la lección ya está escrita en el repo**, en `scrum419-ci-declara-lo-que-no-corre.test.mjs:128`:
*«un `skip: true` a secas es un test apagado sin motivo: al leer el log no se distingue de uno…»*.
El trinquete de SCRUM-419 vigila **solo los 7 de `LIBRO_PG_URL`**; los 67 de `QA_DB_TEST` no los
mira nadie.

**¿Se pueden correr en local?** `exigirBancoDesechable` exige **loopback** y base terminada en
`_test` (crean y borran filas), así que **no** valen `DATABASE_URL_DEV` ni `_STAGING` — y hacen bien.
En esta máquina **no hay `docker`, ni `psql`, ni `pg_ctl`**, así que **no pude reproducir el rojo
contra una base**; se reprodujo por el mecanismo, sin banco. El cómo **sí está escrito**, pero en 8
ficheros de `docs/master/`: **cero apariciones de `LIBRO_PG_URL` en `CLAUDE.md`, `RUNBOOKS.md`,
`QA_MASTER.md` ni `README.md`**, que son los sitios donde se arranca.

**Y una corrección a SCRUM-419:** su cabecera dice que *«`.github/workflows/ci.yml` no define esa
variable ni levanta ningún Postgres»*. **Ya no es cierto** — el CI de `main` de hoy levanta
`postgres:16-alpine` y define `LIBRO_PG_URL`; el paso se llama *«Tests (incluidos los 7 de banco)»*.
Por eso este rojo existe: **antes ni siquiera se habría ejecutado.**
