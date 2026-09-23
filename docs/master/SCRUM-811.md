# SCRUM-811 · El foco que nadie miraba: 105 de 114, y un solo culpable

**Fecha:** 7-sep-2026 · **Carril:** producto · accesibilidad — **MEDICIÓN** · **Gate:** sin gate — navegador, fuera de `npm test`
**Medido contra:** `origin/main` = `44562c332d1aed2c4ad4c7dfeaf71fd7bd59ce21` · 2026-09-07T03:57:21+01:00
**Tanda:** 5800 tests, 5698 pass, 0 fail, 102 skipped (salida 0) — corrida DESPUÉS de mezclar `main`, que trajo SCRUM-716 ya mergeado

> 🛑 **Esto MIDE. La decisión es del fundador.** No se ha tocado una línea de CSS, no se ha
> construido ningún guard y no se ha tocado ningún objetivo táctil.

## 0 · Obligación 0 · No estaba hecho

`ls-remote` completo (**539 refs**): ninguna rama de 811 ni de foco. No existe `docs/master/SCRUM-811.md`,
ni script de foco en `scripts/`, ni entrada en `package.json`. Sí existe
`scrum-368-anillo-foco-primario-rebasada`, **mergeada y con 0 commits vivos**: puso el anillo en
`.btn-primary` en agosto y su entrada está en `main`. No cubre esto.

## 1 · 🔴 La sonda, ANTES de ninguna cifra

Otra sesión midió esto con `.focus()` y declaró que su lectura no valía. Tenía razón:
**`:focus-visible` es una heurística del navegador sobre CÓMO llegó el foco**, y un foco
programático no la dispara igual. Aquí se pulsa **Tab** con `page.keyboard`, que produce eventos de
confianza.

La sonda son dos botones idénticos en una página servida con el CSS real: uno normal, y otro con el
anillo apagado **en línea** (un `style=` gana a la hoja, medido en SCRUM-764). Y se mide por **dos
caminos que tienen que coincidir**: estilo calculado (con `::before`/`::after`) y **píxeles**
(fotografía de la caja con margen, comparada byte a byte).

| | alcanzable | `:focus-visible` | (a) cambia el estilo | (b) cambian los píxeles |
|---|---|---|---|---|
| ✅ botón normal | sí (1 Tab) | `true` | **sí** | **sí** |
| 🔴 botón con el anillo apagado | sí (1 Tab) | `true` | **no** | **no** |

**Los dos métodos coinciden en los dos casos: la sonda distingue.** Y va montada **dentro de cada
página del censo**, no sólo en el laboratorio: si en una vista no distinguiera sus dos casos, esa
vista no se cuenta.

### 🔴 Y la sonda ya enseña por qué un censo «fácil» habría mentido

`:focus-visible` da **`true` también en el botón sin anillo**. Un censo que preguntara por esa
pseudo-clase habría dado **100 % de cumplimiento** sobre una pantalla con el anillo apagado. Lo que
se mide es si **cambia algo que se ve**, no si la regla aplica.

## 2 · El censo · **105 de 114**

Población: los interactivos **visibles** (`INTERACTIVOS` de `_medidor-de-toque.mjs`, el mismo
selector que usa el guard táctil) de las vistas que el banco monta, incluida Clientes por su helper.

| | de 114 |
|---|---|
| **CON anillo al tabular** | **105** |
| **SIN anillo** | **9** |
| **INALCANZABLES por Tab** | **0** |
| *(aparte)* dentro de un `<details>` cerrado, fuera de población | 7 |

**Por superficie**, sólo las que tienen algo que decir:

| vista | con / total | sin |
|---|---|---|
| `renderQuotesView` | 19 / 27 | **8** |
| `renderHomeView` | 3 / 4 | **1** |
| las otras 16 medidas | completo | 0 |

## 3 · ✅ El suelo · lo que NO se pudo medir (8 vistas), declarado

Una vista que no se pudo montar **no es una vista sin defectos**:

| vista | motivo |
|---|---|
| `renderCustomer360View`, `renderInvoiceDetailView`, `renderParteDetailView` | sólo **2 nodos** |
| `renderPlansView` | sólo 5 nodos |
| `renderLibroRegistroView` | sólo 9 nodos |
| `renderAlbaranesView`, `renderQuoteDetailView` | sólo 11 nodos |
| `renderTeamView` | sólo 14 nodos |

De las **26** vistas que publica el banco se midieron **18**. El «105 de 114» habla de esas 18.

## 4 · 🔴 Obligación 3 · SÍ hay patrón, y es UNA decisión de arquitectura

Los nueve tienen **la misma causa**. El anillo se declara así:

```css
:focus-visible { outline: none; box-shadow: var(--ring); }   /* línea 132 · especificidad (0,1,0) */
```

**Apaga el `outline` y pone el anillo SÓLO en `box-shadow`.** A partir de ahí, cualquier regla que
fije `box-shadow` sobre ese elemento se lo come, y no queda ningún otro canal:

| los que pierden el anillo | la regla que gana | por qué gana |
|---|---|---|
| **8 casillas** del editor de presupuesto | `.field input[type="checkbox"] { … box-shadow: none }` — línea **624** | (0,2,1) **>** (0,1,0) |
| **1** `.home-action.home-cta` | `.home-cta { box-shadow: 0 4px 14px … }` — línea **982** | misma especificidad, **va después** |

Medido en los dos: `box-shadow` sin foco y con foco son **idénticos**.

> **Para el fundador:** no son nueve defectos sueltos. Es **una línea de CSS** (la 132) que renuncia
> al `outline`, y dos sitios donde eso choca. Si el anillo viajara también por `outline`, los nueve
> se arreglarían sin tocar ninguno de los dos componentes.

## 5 · ⚠️ Tres veces se equivocó mi instrumento, y las tres se dicen

Porque la cifra sólo vale lo que valga la sonda:

1. **«6 inalcanzables por teclado» era FALSO.** Eran seis casillas dentro del `<details>`
   «Columnas», **plegado**. Comprobado abriéndolo: **5 de 11 con él cerrado, 11 de 11 con él
   abierto**. No es un defecto, es una sección plegada. Se sacaron de la población y se cuentan
   aparte.
2. **Leía el estilo a los 0 ms del Tab**, con la transición en marcha: una pestaña daba
   `rgba(0,0,0,0) 0px 0px 0px 0px` —un anillo transparente de tamaño cero— y el censo lo contaba
   como «cambia». Se espera a que asiente. Con eso, `.customers-tab` pasó de «sin anillo» a
   **19/19 con anillo**, y aparecieron las 8 casillas que sí lo pierden.
3. **«Cambia» no es «se ve».** Ahora se exige que el estado con foco tenga sombra **no
   transparente y de tamaño no nulo**, o un `outline` real.

Antes de esas tres correcciones la cifra era «114 de 121 y 6 inalcanzables». **Era ruido.**

## 6 · Obligación 4 · Recomendación (NO construida)

**Sí, es exigible en cada PR — pero no todavía, y no como está.** En este orden:

1. **Primero la decisión de la línea 132**, que es de una tarde: si el anillo viaja también por
   `outline` (con `outline-offset`), deja de poder comérselo cualquier `box-shadow` y los **9 de 9**
   caen de golpe. Es la palanca; todo lo demás es parchear.
2. **Después el guard**, y barato porque el instrumento ya existe: es el censo de arriba con un
   suelo. Coste medido: **~90 s** de navegador para 18 vistas — el mismo orden que
   `guard:objetivo-tactil`, que ya corre.
3. **Entra en verde, no en rojo.** Hoy pondría `main` en rojo por 9 casos, y un guard que nace
   rojo se desactiva. Se arregla la 132 primero y el guard entra cuando el número sea 0.

**Lo que NO recomiendo:** exigir las seis casillas de AB6 de golpe. Los targets tienen 75 casos
abiertos (SCRUM-786, en tu mesa) y el foco tendría 9: meter las dos a la vez deja el tablero en
rojo permanente, que es la forma más rápida de que nadie mire ninguna.

**Y una advertencia sobre el alcance:** este censo cubre **18 de 26** vistas. Las 8 que faltan no
están limpias — están **sin medir**, y necesitan datos de muestra que hoy el banco no da.

## 7 · No tocado

Ni una línea de CSS · ni un token · `.btn-sm` ni ningún objetivo táctil (SCRUM-786) · ningún guard
construido · ningún literal nuevo · ningún árbol ajeno. Los tres scripts de medición viven en el
scratchpad: esta entrega es **la medición y el documento**.

---

# APÉNDICE · SCRUM-811b — La obligación que sólo vive en prosa: **2 de 222** y **0 de 5**

*17-sep-2026 · rama `scrum-811b-la-skill-que-nadie-carga`*

**Medido contra:** `origin/main` = `f52ff943e5a0ddff5c07aa760dbd8bc07a6acd8d` · 2026-09-17T19:46:23+01:00

> **Encargo:** medir las dos cifras (cuántas veces se declara la obligación, cuántas se cumple) y
> **PROPONER** mecanismo. No se ha escrito ninguna skill, no se ha cambiado lo que ninguna obliga
> (eso es gobierno, S0), y este PR no lleva una línea de código.

## 🔴 AVISO · ESTE FICHERO CONTIENE DOS TICKETS DISTINTOS CON EL MISMO NÚMERO

Lo de arriba —**«El foco que nadie miraba»**, accesibilidad, 7-sep— y lo de aquí abajo **no son el
mismo asunto**. En Jira, `SCRUM-811` es *«DOS SKILLS SE DECLARAN OBLIGATORIAS Y NINGUNA SESIÓN LAS
CARGA»* (leído hoy de la API, **En curso**, carril método). El registro del foco tomó ese número
para otra cosa.

**No es descuido de nadie, y las horas lo demuestran:**

    docs/master/SCRUM-811.md   «Medido contra» …  2026-09-07T03:57:21+01:00
    SCRUM-811 en Jira          created         …  2026-09-07T04:23:57+02:00   ← 26 min DESPUÉS

La sesión del foco hizo su Obligación 0 **bien** —`ls-remote` de 539 refs, `docs/master/`,
`scripts/`, `package.json`— y el número estaba libre en todos ellos. **Lo que no podía saber es que
Jira se lo iba a asignar a otro asunto media hora más tarde**, porque el número del registro se
elige mirando el repo y lo reparte Jira.

> **Un número que se elige en un sitio y se asigna en otro colisiona; es cuestión de tiempo.**

**Se anexa aquí en vez de abrir fichero nuevo, a propósito:** separarlos escondería la colisión, y
quien busque `SCRUM-811` tiene que tropezarse con ella. **Hallazgo de otro carril: se reporta, no se
arregla** (regla 9; el enlace ticket↔rama es de `npm run enlace:ticket-rama`, SCRUM-637).

---

## PASO 0 · ⚠️ La premisa NO está resuelta, pero su cifra es FALSA — y ya lo era al escribirse

El ticket es del 7-sep y hoy es el 17. Antes de gastar la tanda:

| lo que el ticket afirma | medido hoy | |
| --- | --- | --- |
| las dos skills se declaran obligatorias | **sí, sigue vivo** — 6 declaraciones en 3 ficheros | ✅ |
| `yaqu-premium-ui`: 1 commit, nunca modificada | **sí** (`b028bad6`, 11-jun-2026, 1 commit) | ✅ |
| 88 días en el árbol | **98 hoy** — el reloj corre | ⚠️ |
| skills en `.claude/skills/` | **9** | ✅ |
| **«NINGUNA sesión las carga»** | **FALSO. Son 2.** | 🔴 |

🔴 **Y no es que haya caducado en estos diez días: ya era falsa el día que se escribió.** El primer
caso de carga declarada es `SCRUM-580`, del **2-sep**, **cinco días ANTES** de que el ticket
naciera. El segundo, `SCRUM-590`, del **8-sep**, un día después.

**No procede PARAR.** «Ninguna» era falso; **el defecto que el ticket describe sigue vivísimo**, y
lo dice mejor la cifra real que la exagerada: **2 de 222 es 0,9 %**. Lo que cambia no es el
veredicto, es que una cifra redonda y falsa se vuelve discutible, y una medida no.

---

## ① LAS DOS CIFRAS, con su población

### Cifra 1 · la obligación se DECLARA **6 veces, en 3 ficheros**

| fichero | línea | qué dice |
| --- | --- | --- |
| `.claude/skills/yaqu-premium-ui/SKILL.md` | `:3` | `description: Obligatoria ANTES de tocar cualquier UI` |
| `.claude/skills/yaqu-premium-ui/SKILL.md` | `:13` | `## Antes de tocar UI (obligatorio)` |
| `.claude/skills/yaqu-verifactu-sif/SKILL.md` | `:3` | `description: Obligatoria antes de tocar código de VeriFactu/SIF` |
| `.claude/skills/yaqu-verifactu-sif/SKILL.md` | `:32` | `## Antes de tocar código SIF (obligatorio)` |
| `CLAUDE.md` | `:161` | «`yaqu-premium-ui` — obligatoria antes de tocar UI» |
| `CLAUDE.md` | `:167` | «`yaqu-verifactu-sif` (obligatoria al tocar VeriFactu/SIF)» |

**SUELO:** el barrido encuentra 6 declaraciones. Si hubiera encontrado 0, este apéndice diría
**CIEGO** y no habría cifras debajo — un cero en el numerador con el denominador sin comprobar es
«no he mirado», no «no se declara».

### Cifra 2 · la obligación se CUMPLE **2 veces de 222**, y **0 de 5**

**Qué cuenta como «se cumple»:** que el registro de máster del ticket **diga** que la skill se
cargó. Es lo único que una sesión deja escrito; la carga en sí no toca el repo (ver ③).

**`yaqu-premium-ui` — población: los tickets que TOCARON `public/` desde que la skill existe:**

    870 commits en main tocan public/ desde el 11-jun-2026
    286 tickets DISTINTOS implicados
    222 de ellos tienen registro en docs/master/     ← el denominador
     64 no tienen registro                            ← no medibles, declarados

    de esos 222:
      69  mencionan «yaqu-premium-ui» o «AB6»
       5  nombran LA SKILL
      59  nombran el checklist AB6
       2  🔴 DECLARAN HABERLA CARGADO

**`yaqu-verifactu-sif` — población: los tickets que tocaron el camino VeriFactu:**

    14 tickets tocaron verifactu.service.ts o modules/fiscal/verifactu/ desde el 12-jun
     5 tienen registro en docs/master/                ← el denominador
     0 🔴 nombran la skill, ni una vez

> **«0 de 5» y «0 de 222» son noticias distintas, y por eso van con su denominador.** El de
> VeriFactu no es «nadie la carga nunca»: es que **hay muy poco trabajo que la dispare**, y en ese
> poco no se cargó una sola vez.

### 🔴 Los 5 literales, uno a uno — porque «menciona» no es «cumple»

Contar las 5 menciones como cumplimiento habría dado **5 de 222** en vez de 2. Leerlas da otra cosa:

| registro | fecha | literal | ¿cumple? |
| --- | --- | --- | --- |
| `SCRUM-580:266` | 2-sep | «`yaqu-premium-ui` **cargada antes de tocar**» | ✅ **SÍ** |
| `SCRUM-590:604` | 8-sep | «La skill `yaqu-premium-ui` **se cargó** antes de decidirlo» | ✅ **SÍ** |
| `SCRUM-284:118` | 16-sep | «`CLAUDE.md` **marca** `yaqu-premium-ui` como…» | ❌ cita la declaración |
| `SCRUM-581:345` | 2-sep | «**necesita** `yaqu-premium-ui`… **no se arregla aquí**» | ❌ dice que NO la tiene |
| `SCRUM-795:437` | 7-sep | «lleva **88 días en el árbol**…» | ❌ **es el hallazgo que abrió este ticket** |

### ✅ CONTROL NEGATIVO — el que tenía que salir verde, y salió

Una mención que **no** es declaración de obligación no puede contarse. El barrido bruto de
`obligatori*` daba **3 skills**, no 2: entraba `verifactu` con tres aciertos. Leídos:

    verifactu/SKILL.md:179   «ds:Signature … obligatorio en EventosSIF»
    verifactu/SKILL.md:181   «Bloque SistemaInformatico — obligatorio en cada alta»
    verifactu/SKILL.md:219   «1189 — Destinatarios obligatorio en F1, F3 y R1–R4»

Son **obligaciones de la AEAT**, contenido de la skill, no obligación de cargarla. Descartadas.
Igual `yaqu-verifactu-sif:35` («las 8 obligatorias S1-A..S1-H»), y las citas de
`docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md:388-389`, `docs/master/SCRUM-534.md:369` y
`docs/verificacion/asuntos-jira.tsv:809`, que **citan** la obligación en un inventario.
**Sin este filtro, el numerador de la cifra 1 sería 15 en vez de 6.**

---

## ② LAS TRES COSAS QUE SE PARECEN — y la cuarta que apareció midiendo

| | ¿aplica? | evidencia |
| --- | --- | --- |
| **(a)** la skill no existe | **NO** | las dos están en `.claude/skills/`, con contenido y `description` |
| **(b)** existe y nadie la invoca | **SÍ, es el caso dominante** | 220 de 222 · 5 de 5 |
| **(c)** se invoca y no cambia nada | 🔴 **NO DECIDIBLE** | ver abajo |

### (c) no se puede decidir, y lo declaro en vez de suponerlo

Sólo hay **dos** casos de carga. En los dos, lo escrito sugiere que cargarla **sí** cambió algo:
`SCRUM-580` pasa a pintar con `.badge .badge-slate` (las clases del sistema) y `SCRUM-590` declara
que **no** tocó `public/` tras cargarla — o sea, cambió la decisión, no el CSS.

**Pero con n=2 eso no es una medición, es una anécdota**, y ninguno de los dos tiene contrafactual:
nadie sabe qué habrían producido sin cargarla. **Decidir (c) exigiría lo que el repo no guarda: qué
habría hecho la misma sesión sin la skill.** Queda declarado como no decidible, no como descartado.

### 🔴 (d) LA QUE NO ESTABA EN LA LISTA: la obligación llega, pero NO por la skill

**5 registros nombran la skill. 59 nombran el checklist AB6.** Y AB6 no vive en la skill: vive en
el **máster, Parte AB**, que la skill *impone* pero no *contiene*.

> **La obligación se cumple —o se intenta— leyendo el máster, no cargando la skill.** La skill es
> un intermediario que el ejecutor se salta, y que por eso no aparece.

Esto cambia la pregunta del ticket. No es «¿por qué nadie carga la skill?» sino **«¿aporta la skill
algo que el máster no dé ya?»**. Y esa es decisión de gobierno, no mía.

---

## ③ ¿ADMITE MECANISMO? · Sí para la declaración, no para la carga — y la prueba está en casa

### ✅ CONTROL POSITIVO · una obligación que SÍ se cumple, y por qué

El encargo pedía que una obligación cumplida saliera del lado bueno. La hay, y es demoledora:
`**Medido contra:**` en cada entrada del registro — **obligación declarada Y con guard**
(`tests/scrum267-ancla-de-medicion.test.mjs`, uno de los cuatro de `npm run guards:entrada`).

| obligación | mecanismo | se cumple |
| --- | --- | --- |
| **ancla «Medido contra»** | 🔧 **guard en la tanda** | **572 de 574 · 99,7 %** |
| `yaqu-premium-ui` | ✍️ sólo prosa | **2 de 222 · 0,9 %** |
| `yaqu-verifactu-sif` | ✍️ sólo prosa | **0 de 5 · 0 %** |

> **La distancia entre 99,7 % y 0,9 % no la explica la disciplina de quien ejecuta: la explica que
> una lleva guard y la otra no.** Y el guard no es más severo — es que *existe*.
>
> **Una prohibición sin mecanismo es una frase**, dice el canon de la casa. Esto es la misma frase
> medida sobre una obligación, con las dos cifras al lado.

Yo misma soy la prueba: este apéndice lleva su `**Medido contra:**` porque **el guard me puso en
rojo** en SCRUM-880 esta misma tarde y tuve que arreglarlo. Nadie me recordó ninguna skill.

### 🔴 Lo que NO es comprobable, y conviene no prometerlo

**Que una sesión CARGÓ una skill no se puede comprobar desde el repositorio.** La carga ocurre
dentro del agente y no deja rastro en git: no hay fichero que cambie, ni commit, ni marca. Cualquier
guard que dijera comprobarlo estaría comprobando **otra cosa** — y esa confusión es exactamente el
defecto que esta casa mide una y otra vez: *mencionar no es hacer*, y *comprobar la declaración no
es comprobar el hecho*.

### Lo que SÍ se puede comprobar — tres propuestas, NO implementadas

**(1) La DECLARACIÓN, con un quinto guard de entrada.** A todo registro cuyo PR toca `public/`,
exigirle una línea que diga si se cargó `yaqu-premium-ui` **y, si no, por qué no**.
· *Cuesta:* poco; el andamio de `guards:entrada` ya existe y sabe leer entradas.
· *Honestidad:* **mide la declaración, no la carga** — igual que el ancla mide que pusiste el sha,
  no que midieras contra él. Eso lo hace útil, no falso, **siempre que se llame por su nombre**.
· *Riesgo real:* una casilla que se rellena sola. Un «sí» escrito por costumbre no vale más que el
  silencio de hoy, y encima parece cumplimiento.

**(2) El EFECTO, casilla por casilla — la que de verdad muerde.** De las seis de AB6, la casa ya
comprueba dos (contraste y targets, vía `guard:objetivo-tactil`). Las otras cuatro —capturas,
matriz V0-5, estados, textos largos— **no las mira nada**. Un guard por casilla comprobable vale
más que cualquier guard sobre la skill, porque **mide el resultado y no la intención**.
· *Y no hace falta inventarlo:* `SCRUM-811` (el del foco, arriba en este mismo fichero) ya demostró
  que el foco visible **sí** se puede medir en navegador — 105 de 114 — y que hacía falta pulsar
  Tab de verdad, no llamar a `.focus()`.

**(3) Lo más barato de todo: que el arranque la cargue, en vez de que el fichero lo declare.** La
pregunta 1 del propio ticket ya lo apunta. Hoy `CLAUDE.md` **nombra** las skills en una lista; no
hay paso de arranque que las abra. *Si la skill se declara obligatoria, lo obligatorio tiene que
estar en el camino de arranque, no en el destino.* **Cambiar eso es gobierno (S0) y no se toca
aquí.**

### La pregunta que las tres propuestas dejan viva

Si **59 registros citan AB6** y **5 la skill**, quizá el mecanismo correcto no sea empujar hacia la
skill, sino **aceptar que la obligación viaja por el máster** y poner el guard ahí. Medir eso exige
decidir antes qué se quiere: que se cargue la skill, o que se cumpla la checklist. **No son lo
mismo, y hoy el documento pide lo primero mientras la casa hace lo segundo.**

---

## 🔴 Mis errores, esta tanda — y el primero me incrimina

1. **🔴 YO SOY EL CASO 223.** En esta misma sesión, antes de esta tanda, trabajé SCRUM-880 **leyendo
   el camino de emisión de VeriFactu entero** y SCRUM-924 **midiendo una pantalla de pago**.
   `yaqu-verifactu-sif` se declara *«Obligatoria antes de tocar código de VeriFactu/SIF»* y
   `CLAUDE.md:167` lo repite. **No la cargué.** Ni se me ocurrió: la lista de skills estaba delante
   y la obligación, escrita en dos sitios. Se puede alegar que sólo LEÍ y no toqué —y es cierto, y
   es justo la clase de matiz con el que una obligación se evapora—. **El ejecutor que mide este
   defecto lo acababa de cometer, y eso es el dato más fuerte del informe**, más que las cifras.
2. **Estuve a punto de contar «menciona» como «cumple».** Mi primer cruce dio **69 de 222** y era un
   número presentable. Sólo al abrir los literales aparecieron los 5 reales, y de esos 5 **tres no
   eran cumplimientos** — uno de ellos era el propio hallazgo que abrió el ticket, que se habría
   contado a sí mismo como prueba de que la obligación se cumple. De 69 a 2 hay dos filtros, y los
   dos hubo que aplicarlos a mano.
3. **Me comí un redirect y el comando salió con 1.** Escribí un `... > /tmp/x || ... > "$SP/x"` con
   una ruta del scratchpad sin crear, y el encadenado se llevó el código de salida por delante.
   Salió a la vista porque iba solo; dentro de una tubería habría dado 0 con el fichero vacío, y un
   fichero vacío aquí se lee como «cero tickets», que es un veredicto.
4. **Confié primero en el censo local de Jira** (`docs/verificacion/asuntos-jira.tsv`) para resolver
   la colisión de número. Acertaba, pero es del **7-sep** —diez días— y la lección de la fase b de
   SCRUM-880 es exactamente que las afirmaciones con sello «medido» caducan. Fui a la API y ahí
   quedó confirmado. **Acertar con un instrumento caducado sigue siendo no haber medido.**

---

## Lo NO tocado

Ninguna skill escrita, modificada ni borrada · **nada de lo que las skills obligan a hacer**
(gobierno, S0) · `CLAUDE.md` y `.claude/*` intactos (regla 35: derivados del máster) · ningún guard
construido — las tres propuestas de ③ están **escritas y sin implementar** · ninguna dependencia
(36) · ningún estado ni flag (27) · `src/`, `public/`, `tests/` y `prisma/` sin una línea · el
registro del **foco** que abre este fichero: **no se ha tocado ni una palabra**, sólo se ha anexado
debajo · Jira: SCRUM-811 **leído**, no modificado (sigue *En curso*) · la colisión de número se
REPORTA, no se arregla.
**Producción y staging: no tocados, ni para mirar.**

---

# SCRUM-811 · APENDICE · 22-sep-2026 · el guard, construido (decisión 16268)

**Fecha:** 22-sep-2026 · **Carril:** S5 (método) · **Gate:** sin gate, corre en `guards:entrada` y `npm test`
**Medido contra:** `origin/main` = `389954adc670fb1cd925e7daa5a67e562b3dc80a` · 2026-09-22T09:06:44Z
**Tanda:** 8064 tests, 7936 pass, 3 fail, 125 skipped (salida 1)

## El defecto

Comentario 16268 (21-sep-2026): «guard de entrada que exija "skill cargada / por qué no" en
registros que toquen public/ (mide declaración, no carga)» + «poner yaqu-premium-ui en el
arranque de S2/S4 (sesion-N.md y prompt de relevo)». Las dos propuestas de SCRUM-811b (comentario
15828) estaban «escritas y sin implementar»; esto las implementa.

## La decisión, y por qué

**Guard nuevo, `tests/scrum811c-skill-ui-declarada.test.mjs`**, en vez de un hook `SessionStart` o
tocar `settings.json` — la decisión 16268 reserva eso al fundador (punto 4). Reutiliza
`entradasTroceadas()` de `scrum267-ancla-de-medicion.test.mjs` (igual que ya hacen `scrum649` y
`scrum859`), sin duplicar troceador. Exige un campo `**Skill UI:**` en toda entrada NUEVA (fechada
después del 22-sep-2026) que nombre una ruta `public/*.{js,css,html}` en cualquier parte de su
cuerpo — no sólo en «## Ficheros», porque SCRUM-391 ya midió que esa sección sólo la usan 58 de
104 entradas y acotar ahí cegaría al detector en el resto.

**Por qué el corte por fecha y no una lista de exentas**: 294 entradas ya tocan `public/` sin este
campo (recontado hoy; eran 222 el 17-sep). Una lista de 294 excepciones no es mantenible y exigir
el campo con retroactividad castigaría a quien siguió el formato vigente cuando escribió — el
mismo argumento que ya usa el README para las tres anclas exentas de SCRUM-267.

**Arranque de S2/S4**: en vez de tocar el prompt de relevo compartido (`orquestador-autonomo.md`
§5bis.3, que usan LOS SEIS puestos), la instrucción va en `docs/equipo/sesion-2.md` y
`sesion-4.md` — que el propio ARRANQUE BARATO (SCRUM-996, paso 3) YA lee en cada relevo de
cualquier puesto. No hace falta un canal nuevo: el que ya existe llega. Juicio propio, no pedido
explícitamente en el comentario 16268 — lo declaro por si el fundador prefiere además una mención
en el prompt compartido.

## Lo que se midió

* `entradasTroceadas()` sobre el árbol real: **1068 entradas**, **294** mencionan una ruta
  `public/*.{js,css,html}` (SUELO ≥300 y ≥50 respectivamente, con margen).
* Autoprueba sobre texto fabricado (CEBO): fecha con mes en español, ruta `public/`, y las dos
  formas del campo (`cargada` / `no cargada · <motivo>`) — acierta los 4 casos, incluido que «no
  cargada» SIN motivo no basta.
* Real: `entradasSinDeclarar(entradasTroceadas())` da **0** hoy — nada dated después del corte
  toca `public/` todavía, que es lo esperado el mismo día en que el guard nace.
* `npm run guards:entrada`: **12/12 guards, 112 tests, 10,0 s de 90** (antes: 11 guards, ~90 s con
  la máquina cargada). El duodécimo no compila ni toca BD: añade ~0,3 s.
* `npm run build`: limpio.
* **Los 3 fail de la tanda son AJENOS**, confirmados en `tests/scrum939b-trinquete-de-las-skills.test.mjs`
  (censo de `cerebro-yaqu` sobre la ruta de `gh.exe`) y verificados también sobre un `origin/main`
  limpio (worktree aparte, sin mi rama): fallan igual ahí. Dependen del ENTORNO —esta máquina
  Windows tiene `gh.exe` en `C:\Program Files\GitHub CLI\gh.exe`, y el censo lo declara «no
  existe» (calibrado para el runner Linux de CI)—, no de este cambio. No tocado (regla 9, es de
  otro carril).

## Verificado en rojo

Dentro de la autoprueba (`entradasSinDeclarar`, tests fabricados, no el árbol real): una entrada
con fecha posterior al corte, ruta `public/` y sin el campo CAE; la misma entrada con el campo, con
fecha en el corte mismo, o sin ruta `public/`, NO cae (control negativo, tres variantes).

## Lo que NO cubre

* No comprueba que la skill se CARGÓ de verdad — eso no toca el árbol (mismo límite que la ancla
  `**Medido contra:**`, que tampoco comprueba que el sha se copió de un `git rev-parse` real).
* No toca `yaqu-verifactu-sif` (la otra skill obligatoria del ticket original): su población no es
  `public/`, y el comentario 16268 sólo decidió la de UI. Queda fuera a propósito.
* No retira ni relaja el checklist AB6 de seis casillas del máster; sólo exige la declaración de
  si se cargó la skill, no que se cumplan sus seis puntos.
* No toca `settings.json` ni ningún hook — reservado al fundador (16268, punto 4).

## Ficheros

`tests/scrum811c-skill-ui-declarada.test.mjs` (nuevo) · `scripts/guards-entrada.mjs` (GUARDS +1,
MINIMO 11→12) · `docs/master/README.md` (campo documentado) · `docs/equipo/sesion-2.md` ·
`docs/equipo/sesion-4.md`.

**Skill UI:** no cargada · este apéndice no toca ninguna vista, componente ni CSS: añade un guard
de texto sobre `docs/master/` y dos líneas de prosa en fichas de equipo. `public/` no aparece en
el diff.
