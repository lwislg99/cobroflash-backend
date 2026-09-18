# SCRUM-939 · Qué afirman las skills obligatorias, y cuánto de eso es comprobable

**Medido contra:** `origin/main` = `a863416b5d303b4016e68a6134eac2908627679f` · 2026-09-17T21:25:40+01:00
**Rama:** `scrum-939-afirmaciones-de-las-skills` · **Instrumento:** `scripts/censo-afirmaciones-de-skills.mjs`

Una skill obligatoria no es documentación: es una **instrucción que se ejecuta sin que nadie la
revise**. `cerebro-yaqu` —que se carga SIEMPRE— «corrigió» a una sesión diciendo que `gh` está en
`C:\Program Files\GitHub CLI\gh.exe`. No existe.

> ⛔ **Este ticket MIDE Y LISTA. No se ha tocado ninguna skill.**

---

## ① LAS OBLIGATORIAS · el léxico se DERIVA, no se escribe

El censo de anoche contó `obligatori*` y se le escaparon las que obligan diciendo «SIEMPRE». Aquí
los marcadores se prueban **contra el corpus**, uno a uno (`obligatori`, `siempre`, `hay que`,
`debe`, `no se toca`, `antes de`, `nunca`, `imprescindible`, `exigid`), y sólo dos atan:

| skill | obliga por |
|---|---|
| `cerebro-yaqu` | «Usar **SIEMPRE** al arrancar cualquier tarea» |
| `verifactu` | «Úsala **SIEMPRE** que la tarea toque facturación española» |
| `yaqu-premium-ui` | «**Obligatoria** ANTES de tocar cualquier UI» |
| `yaqu-verifactu-sif` | «**Obligatoria** antes de tocar código de VeriFactu/SIF» |

**4 de 9 carpetas de skill.** No 2.

> ⚠️ **Y se mira SÓLO la descripción del frontmatter, no el cuerpo.** `yaqu-wa-templates` dice
> «leer SIEMPRE antes de dictar nada» **en su cuerpo**: eso obliga a quien ya abrió la skill, no
> obliga a abrirla. Contarla habría dado **5 donde hay 4** — el mismo inflado que este censo evita
> después en las afirmaciones. `antes de` casa con 5 skills y no ata ninguna: es una preposición,
> no una obligación.

**SUELO:** 4 > 0. Con cero, el censo aborta declarándose CIEGO.

---

## ② LAS DOS CIFRAS

| | | |
|---|---|---|
| líneas con contenido en las 4 skills | **371** | |
| de ellas **con** afirmación comprobable | **42** | 11 % |
| líneas **sin nada comprobable** | **329** | 89 % ← **del lado malo** |

**El 89 % de lo que dicen las skills obligatorias no lo puede verificar nadie.** No significa que
sea falso: significa que **no hay forma de saberlo**, y por eso cuenta del lado malo. Son criterio,
proceso y juicio — legítimos en una skill, pero fuera del alcance de cualquier comprobación.

### De lo que sí se puede comprobar

| | | |
|---|---|---|
| afirmaciones comprobables extraídas | **49** | |
| **CIERTAS** | **42** | 86 % |
| 🔴 **FALSAS** | **3** | 6 % |
| **NO COMPROBABLES** | **4** | 8 % ← **del lado malo** |

**Qué cuenta como comprobable:** sólo tokens con dueño — una RUTA del repo, un `npm run <x>`, una
ruta absoluta de disco, una `regla <n>` del máster. Lo demás es redacción.

---

## LAS TRES FALSAS, CON SU EVIDENCIA

**1 · `cerebro-yaqu:79` — `C:\Program Files\GitHub CLI\gh.exe`**
→ **NO existe en el disco.** Es el defecto que abre el ticket, y lo peor de los tres: está en la
skill que se carga SIEMPRE, y la línea afirma que `gh` está instalado. Una sesión que la crea
intentará abrir el PR con `gh` y no podrá.

**2 · `verifactu:163` — `EventosSIF.xsd`**
**3 · `verifactu:164` — `RespuestaValRegistNoVeriFactu.xsd`**
→ **No existe ningún fichero con ese nombre en el árbol.** La skill los presenta bajo «**Ficheros:**»
junto a otros cinco que **sí** están en `src/modules/fiscal/verifactu/xsd/`.

> ⚠️ **Con su matiz, que no me toca resolver:** esos dos pueden ser nombres de esquemas oficiales
> de la AEAT que nunca se descargaron, y entonces la skill no miente sobre el árbol sino que cita
> el catálogo oficial. Lo que el censo afirma es lo que puede afirmar —**no están en el árbol**—;
> si eso es un defecto de la skill o un matiz de redacción lo decide quien la gobierna.

## LAS CUATRO NO COMPROBABLES

| | motivo |
|---|---|
| `cerebro-yaqu:84` · `docs/master/SCRUM-<n>.md` | es una **plantilla con hueco**, no una ruta concreta |
| `yaqu-verifactu-sif:58` · `prisma/schema.prisma` | **la línea NIEGA** y este censo no lee polaridad |
| `yaqu-verifactu-sif:64` · `audit.service.ts` | idem |
| `yaqu-verifactu-sif:88` · `docs/VERIFACTU_EVIDENCIAS.md` | idem |

Las tres últimas son frases del tipo «**no existe** X, cítese Y». **La skill acierta y mi
instrumento no sabe verlo**: leer la polaridad de una frase ya no es «el árbol dice sí o no», es
interpretar castellano. Van del lado malo en vez de acusar a quien tiene razón.

---

## CONTROLES, ejecutados en cada pasada

| | |
|---|---|
| 🔴 **POSITIVO** | la ruta de `gh` sale **FALSA por el eje de la ruta**, no por mencionar «gh»: el control exige que se extraiga un `RUTA_ABS` y que ESA ruta no exista |
| ✅ **NEGATIVO** | una línea cierta (`docs/YAQU_MASTER.md` + `npm run build`) sale **CIERTA** — un instrumento que marca todo falso no verifica, acusa |
| 🔴 **SEGUNDO NEGATIVO** | tres frases de criterio («Prefiere lo simple», «Cuando dudes, para», «El microcopy se propone y se para») **no entran** en el denominador |

El tercero es el que sostiene la cifra: sin él, meter criterio en el denominador bajaría el
porcentaje de falsas sin que nada mejorara.

---

## ④ ¿ADMITE MECANISMO? SÍ — pero como TRINQUETE, no como prohibición

**Sí admite.** La extracción es decidible (tokens con dueño), los controles demuestran que no acusa
al criterio, y el coste es de milisegundos: no hay navegador ni red.

**Pero un guard que exigiera «cero falsas» nacería ROJO** por el caso de los `.xsd`, cuya
ambigüedad no la resuelve el árbol. Y un guard que nace rojo lo apaga alguien en una hora — es
exactamente lo que le pasó a `scrum722` antes de convertirse en trinquete.

**La forma que sí se sostiene**, y es la que esta casa ya usa en `scrum402` y `scrum722`:

* **censo declarado**: las 3 falsas de hoy entran con su motivo y quién las retira;
* **el trinquete sólo baja**: falla si el número SUBE o si aparece una falsa **nueva**;
* **suelo**: cero skills obligatorias o cero afirmaciones = CIEGO, no verde;
* **los tres controles dentro**, corriendo en cada pasada.

⛔ **No lo implemento**: el encargo pide proponer, y además un guard sobre el contenido de las
skills toca gobierno (S0). La decisión de si esto se vigila —y quién responde de las 3 falsas— no
es mía.

---

## Errores propios (A9)

**① Mi primera pasada dijo «20 falsas · 41 %» y 19 eran inflado mío.** El extractor trataba
`verifactu.service.ts` —un nombre citado en prosa— como una ruta desde la raíz del repo, y
`docs/master/SCRUM-<n>.md` —una plantilla— como un fichero que debería existir. Publicar ese 41 %
habría sido acusar a tres skills de decir falsedades que no dicen. **Lo cacé leyendo la lista
entera antes de creérmela**, no por un control.

**③ Escribí en mi propio instrumento el defecto que venía a medir.** Un comentario del censo citaba
la ruta entera del documento de evidencias que `yaqu-verifactu-sif` declara inexistente — y
`scrum242-scripts-no-prometen-documentos` me cazó: **un script no puede nombrar un documento que no
está en el árbol, ni siquiera para decir que no está.** El arreglo fue en mi comentario, nunca en
la lista del guard. Es la tercera vez hoy que un instrumento mío se cuela en la población que mide.

**② El heredoc se comió las barras de mi propio control positivo.** Escribí el caso de `gh` con
`\\` y el fichero quedó con `\`, así que en JS `\P` es `P` y la ruta perdió sus barras: el control
falló diciendo «no se extrae la RUTA_ABS», que era cierto pero por un motivo que no era el suyo.
**Tengo esa trampa anotada desde hace semanas y volví a caer en ella.** El control me salvó de
publicar un positivo que pasaba por casualidad.

---

## Lo que NO se ha hecho

⛔ **Ninguna skill tocada.** Su contenido es gobierno (S0) y algunas obligan sobre materia fiscal o
microcopy — corregir una sin saber quién la firmó repetiría el defecto de SCRUM-921.
⛔ **No se instaló `gh` ni nada**: su ausencia es a propósito.
⛔ Ningún secreto escrito, impreso ni inventado. Ningún estado ni flag nuevo (27). Ninguna
dependencia (36).

---

# SCRUM-939b · El trinquete: las skills obligatorias no ganan ni una falsa más

**Medido contra:** `origin/main` = `41bad7c83d84ba2cddcf267480bbd7bcd9bc0b2c` · 2026-09-18T08:38:20Z
**Rama:** `scrum-939b-el-trinquete-que-solo-baja` · **Trinquete:** `tests/scrum939b-trinquete-de-las-skills.test.mjs`
· **Instrumento:** `scripts/censo-afirmaciones-de-skills.mjs`

El ④ de la fase a, construido con la forma que se propuso allí: **censo declarado con su motivo ·
sólo baja · suelo de ceguera · los controles dentro.** Trinquete, no prohibición: un guard que
exigiera cero falsas nacería rojo por los `.xsd`, y un guard que nace rojo lo apaga alguien en una
hora.

> ⛔ **Ninguna skill se ha tocado**, tampoco para corregir la ruta de `gh`.

## PASO 0 · la premisa seguía viva

Corrido sobre `41bad7c8` antes de escribir: el censo da **3 falsas · 4 no comprobables · 49
afirmaciones**, y **ningún test lo consumía**. No había trinquete.

## ① EL TRINQUETE, en 3

| | | |
|---|---|---|
| `cerebro-yaqu` | `C:\Program Files\GitHub CLI\gh.exe` | no existe en el disco |
| `verifactu` | `EventosSIF.xsd` | no está en el árbol · **con su duda** |
| `verifactu` | `RespuestaValRegistNoVeriFactu.xsd` | no está en el árbol · **con su duda** |

Cae en los dos sentidos, y por **identidad** (skill, tipo, valor), nunca por número de línea:

* **aparece una falsa no declarada** → rojo, nombrando skill, línea y evidencia. Con el mismo
  número también: una falsa cambiada por otra deja la cuenta en 3 y sale igual;
* **una declarada deja de salir** → rojo hasta que se borra del censo. Un hueco que se queda en un
  censo es un permiso para que la misma falsa vuelva.

## ② LAS DOS DEL `.xsd`: declaradas con su duda, no resueltas

Cada una lleva en el censo, escrito: *pueden ser nombres de esquemas oficiales de la AEAT que nunca
se descargaron.* Es materia VeriFactu y **no la resuelve este ticket**. Siguen contando: sacarlas
del numerador sería opinión. Un test exige que toda `.xsd` declarada lleve su duda, y que todas
lleven motivo y quién la retira.

## ③ LAS CUATRO NO COMPROBABLES: siguen del lado malo

No entran en el trinquete, y tampoco pasan a ciertas. Tres **niegan** («no existe X, cítese Y»): la
skill acierta y el censo no lee polaridad. Meterlas en el trinquete tumbaría la tanda por una frase
correcta; contarlas como ciertas sería fiarse de una lectura que el censo no hace. Un caso congelado
en un literal exige que una línea que niega salga NO COMPROBABLE: si alguien le enseña polaridad
al censo, cae, y lo que pasa con las tres se decide a la vista.

## LOS CONTROLES, y cada uno visto caer

| | lo que exige | visto en rojo con |
|---|---|---|
| 🔴 **POSITIVO** | la ruta de `gh` sale FALSA **por el eje de la ruta** (se extrae un `RUTA_ABS`), no por mencionar `gh` | mutación E (el extractor deja de ver rutas absolutas) |
| ✅ **NEGATIVO** | una afirmación cierta sale CIERTA | mutación F (todo `npm run` sale FALSA) |
| ✅ **SEGUNDO NEGATIVO** | tres frases de criterio no entran en el censo | mutación G (la prosa entra como afirmación) |
| 🔴 **EL QUE DECIDE** | una falsa sembrada en una **COPIA** de `cerebro-yaqu` sube el número de 3 a 4 y tumba el trinquete, nombrando la sembrada; el original, byte a byte igual | mutación B (`juzgar` deja de apuntar las nuevas) y C (el censo da por existente toda ruta) |
| **SÓLO BAJA** | una declarada que ya no sale lo tumba; la misma falsa dos veces con una declaración es una nueva | mutación B |
| **SUELO** | sin una de las cuatro obligatorias, CIEGO — y un censo ciego no da verde | mutación D (el suelo desactivado) |

Y el trinquete de verdad, con una declarada cambiada (mutación A): cae con los dos mensajes a la
vez, «una falsa nueva con el mismo número» y «tiene que bajar». **7 de 7 mutaciones caen**, sobre
copias hermanas del test y del censo (nombre sin `.test.mjs`, borradas al acabar); el árbol,
limpio después.

**Las cinco que mutan el CENSO (C a G) quedan en git** como `MUTACIONES_QUE_ME_TUMBAN` del test, y
se corrieron por el camino del propio meta-guard (`mutacionesDeclaradas` → `correr` →
`aplicarUna`, que restaura y verifica byte a byte): **vivas 5 · no vivas 0**, línea base con 8
pasados y el árbol quieto. Las dos que mutan el TEST (A y B) **no se declaran**: su ancla aparecería
dos veces en el fichero que las declara, y acertar la buena dependería del orden de las líneas.

Los tres primeros son los de la fase a y siguen **congelados en literales**: si midieran la línea
79 de la skill de verdad, morirían el día que alguien la arregle — justo el día que tienen que
hablar.

## LO QUE CAMBIA EN EL INSTRUMENTO

* **`censar({ dirSkills, raiz })`**: el barrido pasa a ser una función. La corren el script y el
  trinquete **por el mismo camino**, y `dirSkills` es lo que deja sembrar en una copia.
* **El árbol es el índice de git, no el disco.** Un fichero sin añadir daba CIERTA en mi disco y
  FALSA en CI. Medido al cambiarlo: **0 veredictos distintos** en las 34 afirmaciones RUTA de hoy.
* **El suelo pasa de «cero obligatorias» a «las cuatro conocidas»**: con tres, un «0 falsas» sería
  «no he mirado una».
* La salida del script a mano es **idéntica byte a byte** a la de `origin/main`, con el mismo
  código de salida.

## TRINQUETES AJENOS · medidos antes de empujar

| | antes | después |
|---|---|---|
| `scrum522` (guards de navegador fuera de la tanda) | 25 | **25**: no se añade ningún `guard:` ni se toca `package.json` |
| `scrum702` (ficheros que leen el entorno, tope 17) | — | **sin cambio**: ni el script ni el test leen una señal; la única coincidencia es un `process.platform` en un **comentario** de la fase a, que su censo descarta |
| `scrum846c` (instrumentos sin caso fabricado) | — | `censar` entra en su población **con caso propio** (la copia sembrada); sin caso: **0** |

## LO QUE ESTO NO VE, DECLARADO

* **La ruta de `gh` es de disco, y el CI es ubuntu.** Allí cualquier `C:\…` no existe por
  construcción: la de `gh` sale FALSA igual que en Windows, pero sin discriminar, y una ruta de
  Windows **cierta** saldría falsa. Hoy hay **una** RUTA_ABS en las cuatro skills y es la falsa.
  Distinguirlo exige leer la plataforma y eso sube `scrum702`: **se avisa aquí, no se hace de
  paso.** Convertirla en NO COMPROBABLE en Linux habría dado un veredicto distinto en cada sitio,
  que es exactamente lo que ese tope vigila.
* **Sólo cuenta lo comprobable.** El 89 % de las líneas es criterio y proceso. Un verde aquí dice
  que las rutas, comandos y reglas que citan las skills no han empeorado; no dice que las skills
  sean ciertas.
* Las skills se **leen** del disco (así se siembra en una copia): una carpeta de skill sin añadir
  la vería aquí y no en CI.

## Errores propios (A9)

**① El primer rojo que escribí mentía en su rótulo.** Decía «EL TRINQUETE SUBE: 3 → 3» cuando lo
que había era una falsa cambiada por otra: la cuenta no sube, el conjunto sí cambia. Es el caso
exacto que la casa manda vigilar («he perdido una y he ganado otra»), y mi mensaje lo contaba como
lo que no era. **Lo cacé leyendo el rojo de la mutación A antes de commitear**, no por un control:
ahora distingue los dos casos.

**② Volví a caer en la trampa del shell con las barras invertidas** —la tercera vez anotada—: una
sustitución con `sed` sobre la ruta de `gh` no casó y dio una salida vacía que parecía un
resultado. El script de mutaciones ya estaba escrito a fichero; el atajo de después, no.

**③ Estuve a punto de esquivar `scrum702` sin tocarlo.** La primera idea para la ruta de `gh` en
Linux era mirar si existe la raíz `C:\` en vez de leer la plataforma: no habría sumado nada a su
censo y habría dado veredictos distintos en CI y en Windows, que es lo que ese tope existe para
ver. Lo paró leer `scrum702` antes de escribir, no después. Cumplir la letra de un guard ajeno
violando su motivo es peor que subirle el tope a la vista.

## Lo que NO se ha hecho

⛔ **Ninguna skill tocada**, ni para la ruta de `gh`. ⛔ Jira sin tocar: SCRUM-939 sigue En curso y
asignado. ⛔ SCRUM-936 sin tocar. ⛔ Ningún tope ajeno subido. ⛔ Ningún secreto, estado, flag ni
dependencia nuevos.
