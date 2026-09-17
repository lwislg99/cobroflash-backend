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
