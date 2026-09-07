# SCRUM-766 · El `grep` que cuenta líneas — y el número que NO era falso

**Fecha:** 7-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `64b5d80ae3b11dcc34d736de21670eb6b5ce6dda` · 2026-09-07T07:01:07+01:00
**Tanda:** **5847 pruebas · 5745 en verde · 0 rojas · 102 saltadas** · 409,2 s · salida 0.
Las 102 saltadas declaran motivo y **suman 102**.

`npm run meta:mutaciones` → **146 vivas · 0 mudas · 0 ciegas · 0 ficheros muertos**, salida 0, con
las **dos** de este ticket entre las vivas: cada una tumba el test que declara, y el árbol quedó
restaurado byte a byte (`git status` sólo con esta entrada sin rastrear).

> **La primera tanda salió en ROJO por 2, y las dos eran mías**: `SCRUM-189` (una cita a «regla 18»
> que no existe) y `SCRUM-737` (una cifra del árbol sin ancla). Arregladas midiendo, no subiendo
> ningún congelado. Está contado abajo, porque son de la misma familia que el defecto del ticket.

---

## 🔴 LO PRIMERO, PORQUE CORRIGE AL ENUNCIADO Y NO AL ÁRBOL

El encargo decía, en mayúsculas y con un candado rojo:

> «una sesión reportó *la suite declara que 1.213 ficheros de texto del árbol llevan `\r`, de
> 1.992*. **ESE NÚMERO ES CASI CON CERTEZA FALSO**, y con él la conclusión de que había un
> problema de CR.»

**Medido: el número NO es falso. Es correcto, y el instrumento que lo produjo tampoco es `grep`.**

`tests/scrum480-fin-de-linea.test.mjs` no llama a `grep` en ninguna parte. Su censo es
`censoArbolDeTrabajo`, de `tests/_censo-eol.mjs`, y cuenta **bytes** con `fs.readFileSync` y un
bucle sobre `clasificarBlob` que compara contra `13` — exactamente el instrumento que la
Obligación 1 de este ticket pide usar. Ya lo era antes de que este ticket existiera.

Y el número se reproduce. Contado hoy con un bucle de bytes **escrito aparte**, sin importar nada
del árbol, sobre `cobroflash-backend` (el worktree veterano):

| árbol | rastreados | de texto | **con ≥1 CR** | CR totales |
|---|---|---|---|---|
| `cobroflash-backend` (veterano) | 2.370 | 2.147 | **1.213** | 273.055 |
| `cobroflash-b17` (recién materializado) | 2.382 | 2.159 | 21 (20 sólo en disco) | 3.355 |

**1.213, clavado.**

> 🔴 **Y AQUÍ CORRIJO UNA AFIRMACIÓN MÍA, que escribí antes de comprobarla.** Di por hecho que los
> 21 del árbol recién materializado llevaban CRLF **en el blob**, a propósito. **Medido contra
> `git cat-file`: sólo UNO.** Los otros **20 tienen el CR únicamente en disco** — `.gitignore`
> (192), los `.xsd` de la AEAT (1.392 el mayor), `.gitattributes` (61), `CODEOWNERS`, `LICENSE`,
> los `.toml` de una skill, un `.ps1`, un `.diff`, `sitemap.xml`. El motivo es exacto: **ninguna
> de esas extensiones está entre las 15 que `.gitattributes` promete en LF**, así que el
> `core.autocrlf=true` del sistema se las convierte en el checkout, incluso en un árbol nacido
> hoy. El único con CR en el blob es `docs/legal/fuentes/aeat-errores.properties`, que es la
> excepción declarada en `CR_PERMITIDO`.
>
> **Lo que esto le hace al encargo:** «EL ÁRBOL ES LF PURO. CR = 0» **tampoco es exacto por
> bytes** — un árbol nuevo trae 20 ficheros con CR y ~3.100 bytes 0x0D. Es LF puro **dentro de la
> población que `.gitattributes` promete**, que es justo la que mide la suite. Y ése es el fondo
> de todo el ticket: **«CR = 0» y «1.213» son respuestas a preguntas distintas sobre poblaciones
> distintas, y ninguna de las dos es falsa.** Lo falso era suponer que una desmentía a la otra.

**El «de 1.992» no lo puedo clavar, y lo digo en vez de estirarlo.** Es la otra mitad del mensaje
de ese test (`… de ${r.textos} de texto`), pero el par (1.213, 1.992) no sale **a la vez** en
ningún árbol de hoy: el veterano da 1.213 sobre 2.147 de texto, y el árbol cuyo censo lee 1.992 es
`b14`, que está a cero. Eso no contradice nada — **la copia de trabajo de un árbol veterano no se
puede reconstruir**, y los árboles crecen: `cobroflash-backend` tenía menos ficheros hace unas
semanas. El par es consistente con ese mismo árbol en una fecha anterior, y hoy da 1.192 sobre
2.125: mismo orden, misma causa. Lo que sí está clavado es el 1.213 y que **no lo produjo `grep`**.

Censando los **18 árboles de esta máquina** con el censo propio de la suite:

| árbol | leídos | con CR | | árbol | leídos | con CR |
|---|---|---|---|---|---|---|
| `cobroflash-backend` | 2.129 | **1.192** | | `b9`…`b13`, `b15`, `b16` | 1.943–2.131 | 0 |
| `b2` | 2.141 | **1.180** | | `b14` | 1.992 | 0 |
| `b3` | 2.141 | **1.124** | | `b17` (el mío) | 2.141 | 0 |
| `b1` | **2** | 0 (**ciego**) | | `b4`…`b8` | 1.486–2.135 | 0 |

`b1` es el caso que hay que mirar dos veces: lee **2 ficheros de 1.545** porque su rama arrastra un
`.gitattributes` anterior a `eol=lf` y salen 1 extensión vigilada en vez de 15. Su cero **no es
limpieza, es ceguera** — y lo dice su propio suelo, que por eso está dentro del caso y no en un
test aparte.

Cuatro árboles veteranos entre 1.124 y 1.213; trece a cero; uno ciego. **El número no es un
artefacto: es una propiedad del árbol que lo mide**, y ya está explicada desde SCRUM-533 —git no
reescribe retroactivamente la copia de trabajo cuando cambian los atributos, así que un checkout
viejo conserva el CRLF que le metió el `core.autocrlf=true` del sistema, y uno nuevo nace limpio
**en la población vigilada** (fuera de ella nace con los 20 de arriba, y eso no lo arregla ningún
checkout: lo arreglaría ampliar `.gitattributes`, que es otro ticket y no éste).

**Qué se retira, entonces:** no el número. **La acusación contra él.** Queda escrita aquí encima,
que es lo que pedía la Obligación 2 — un número retirado en silencio vuelve, y una acusación
retirada en silencio también.

> ⛔ **NO se ha tocado `censoArbolDeTrabajo` ni el test de SCRUM-480.** Retirarlos habría quitado
> del árbol el único instrumento que sí mide bien esto. La única edición sobre ellos es un aviso
> AÑADIDO, y se explica más abajo.

---

## OBLIGACIÓN 0 · comprobado que no estaba hecho

`git ls-remote --heads origin` en listado completo → **ninguna rama de 766** (los dos únicos aciertos
de «766» son SHAs, `scrum-283` y `scrum-284`). `origin/main` no tiene `docs/master/SCRUM-766.md` ni
ningún test de 766. Rama propia `scrum-766-el-grep-que-cuenta-lineas` sobre worktree **nuevo**
(`cobroflash-b17`): los 16 existentes tienen dueño y no se toca ninguno.

---

## EL HECHO DEL ENCARGO: reproducido, y es DOBLE

El encargo sí acierta en lo esencial: **`grep` miente sobre los CR en este entorno, y se lee
perfectamente bien.** Pero tiene dos caras con mecanismos distintos, y la casa sólo tenía anotada
una. Medido el 7-sep-2026, GNU grep 3.0 sobre bash de MSYS, contra un fichero **fabricado** con
respuesta conocida — 50 líneas, EXACTAMENTE 3 con CR:

| instrumento | 3cr.txt | lf.txt | veredicto |
|---|---|---|---|
| node, contando el byte `0x0D` | **3** | **0** | ✅ la verdad |
| `grep -c $'\r' F` (directo) | 0 | 0 | 🔴 falso NEGATIVO |
| `grep -Uc $'\r' F` (directo) | **3** | **0** | ✅ |
| `n=$(grep -c $'\r' F)` | **50** | **50** | 🔴 falso POSITIVO = `wc -l` |
| `n=$(grep -Uc $'\r' F)` | **50** | **50** | 🔴 `-U` NO salva esta cara |
| `wc -l F` | 50 | 50 | |

**CARA A — la lectura.** GNU grep abre en modo texto y quita el CR antes de casar. Da 0 donde hay
3. Ya estaba escrita en `tests/scrum480-fin-de-linea.test.mjs:132` desde el 19-ago-2026, y sigue
siendo cierta. `-U` la cura.

**CARA B — el patrón. Es la del encargo, y la peligrosa.** Dentro de una sustitución de órdenes el
bash de MSYS se come el byte CR del texto de la orden, así que `$'\r'` llega a grep como **cadena
vacía**, y un patrón vacío casa con **todas** las líneas. Aislado sin ambigüedad posible:

```
len($'\r') FUERA de $()  = 1     ← el patrón existe
len($'\r') DENTRO de $() = 0     ← el patrón ha desaparecido
len($'\t') DENTRO de $() = 1     ← al TAB no le pasa: es el CR, no la sustitución
```

Y `-U` **no** la salva: cura la lectura, y aquí lo que falta es el patrón.

🔴 **La cara B es la que sale al escribir un censo**, porque `n=$(...)` es *la* forma de capturar
un recuento en shell. Por eso el encargo la vio y el aviso viejo no: quien escribió el aviso midió
a mano, en la terminal, sin sustitución.

### Corrección al control positivo que pedía el encargo

El encargo decía: «un fichero LF puro da 0 en los dos — que es POR LO QUE LA SUSTITUCIÓN PASA
DESAPERCIBIDA en el caso fácil». **Medido, eso vale para una cara y no para la otra**, y conviene
que quede claro porque invierte cuál es la sigilosa:

- **cara A**, LF puro → **0 = la verdad**. El control positivo pasa y no delata nada. Es
  exactamente el caso que describe el encargo.
- **cara B**, LF puro → **50 ≠ 0**. El control positivo **no** pasa: da `wc -l` también ahí. O sea
  que la cara B es **más fácil** de cazar de lo que decía el encargo.

Lo que sí es cierto de las dos, y es el fondo del ticket: **sobre un árbol de verdad las dos
devuelven números plausibles**, porque nadie sabe de antemano la respuesta correcta. Por eso el
control que decide no puede ser un fichero del árbol —su respuesta saldría del propio instrumento
que se juzga— sino uno **fabricado**.

### Un error de método propio, y lo dejo escrito porque es del mismo tipo

La primera sonda que escribí para medir esto **se colgó**. Al escribirla a través de capas de
comillas, el `\\r` colapsó a un CR *real* dentro del texto del script: grep se quedó sin patrón y
sin fichero, y se puso a leer la entrada estándar. La sonda buena se escribe **en disco**, se
auditan sus bytes con node (`CR reales dentro = 0`) antes de ejecutarla, y redirige `< /dev/null`.
Es la misma familia de defecto que el ticket persigue: **la herramienta transformó lo que escribí
y el resultado se leía igual de bien.**

---

## LA IRONÍA, QUE ES EXACTA — y una cita del encargo que NO he podido verificar

La herramienta con la que se iba a vigilar el CR **transforma lo que escribes, y su resultado se
lee igual de bien**. Es el defecto que persigue, aplicado a sí misma. Y no una vez: la cara B **le
pasó a mi propia sonda** mientras la construía.

> 🔴 **LA CITA, EN CAMBIO, LA RETIRO.** El encargo atribuía esa idea a «la regla 18 de la casa, con
> el CR como primera de sus cinco caras», y yo la copié tal cual a un comentario del código.
> **Buscada en `docs/YAQU_MASTER.md`, en `docs/QA/SUITE_REGRESION.md` y en `CLAUDE.md`: no existe
> ninguna regla con ese contenido.** Lo único numerado 18 es un paso de escenario E2E
> (`SUITE_REGRESION.md:946`, «Ir a Trabajos → abrir el Trabajo…») y, en las reglas duras de
> `CLAUDE.md`, «tarjeta real solo con Stripe Connect activo».
>
> **No lo encontré leyendo: lo encontró el guard de SCRUM-189**, que me puso la tanda en rojo por
> escribir «regla 18 de» sin nombrar su fichero. Su doctrina es exactamente la de este ticket, un
> escalón más arriba: *«una cita cierta que dirige al sitio equivocado gasta más confianza que una
> cita vaga: la vaga te hace buscar, la falsamente precisa te hace descartar.»* Un número de regla
> es también un valor plausible.
>
> **La IDEA se queda** —está medida en este mismo ticket, dos veces—; **la CITA se va.**

---

## OBLIGACIÓN 3 · el censo de instrumentos, con control positivo

`npm run censo:cuenta-de-control-con-grep` — recorre los **2.159 ficheros de texto rastreados** (de
2.384; 223 binarios) y busca invocaciones de `grep`/`rg`/`findstr` cuyo patrón sea un carácter de
control. Clasifica en tres, y la diferencia decide qué se hace con cada uno:

| clase | qué es | qué se hace | **medido** |
|---|---|---|---|
| **INSTRUMENTO** | línea ejecutable que cuenta | retirar | **0** |
| **RECETA** | doc o comentario que MANDA hacerlo | retirar | **0** |
| **AVISO** | comentario que documenta el defecto | **conservar** | **1** |

**El árbol está limpio: nadie cuenta caracteres de control con `grep` aquí.** El único acierto es
`tests/scrum480-fin-de-linea.test.mjs:132`, que es el aviso viejo — y es justo el que la Obligación
3 exigía como control positivo: *«tiene que encontrar el grep que ya sabemos que está mal»*. Lo
encuentra, y lo clasifica bien: como memoria del defecto, no como defecto.

Una **RECETA** cuenta como instrumento a propósito. Un runbook que prescribe el idioma malo tiene
**más** alcance que un script —lo ejecuta cualquiera, a mano, y no sale en ningún censo de código—
y es exactamente la forma en que este defecto se propagaría a la siguiente sesión.

🔴 **El control positivo se ejecuta SIEMPRE, no sólo cuando el censo da cero.** Un cebo con las dos
caras que el detector tiene que cazar, más una línea benigna (`grep -c "TODO" f`) que no debe
marcar. Si no cambia de respuesta, el censo sale por «no supe mirar» con código 2 en vez de
publicar un cero. Y hay **suelo**: menos de 500 ficheros leídos es ceguera, no limpieza.

> **Un fallo del detector que encontré probándolo, y que era del tipo que este ticket persigue:**
> marcaba el aviso de `scrum480:132` como «[EN `$( )` → wc -l]». Falso: ahí las comillas son de
> markdown, no sustitución. El recuento era correcto y **la explicación del mecanismo no**, que se
> lee igual de bien. Ahora `enSustitucion` no cuenta comillas en líneas de comentario.

---

## LA CORRECCIÓN, ESCRITA DONDE VIVE EL INSTRUMENTO

No basta con esta entrada: quien tropiece con esto estará leyendo el código, no `docs/master/`.

- **`tests/scrum480-fin-de-linea.test.mjs`** — el aviso viejo **no se borra ni se corrige**: era
  cierto. Se le añade encima la cara B, que le faltaba, con su medida y su fecha. Sin eso, el aviso
  como estaba **empuja a la conclusión equivocada**: «grep se come los CR, luego cuenta de menos»,
  de donde sale que *un número alto de grep es de fiar*. Es exactamente al revés.
- **`scripts/censo-cr-en-disco.mjs`** — su `contarCR` ya decía «con BYTES, nunca con `grep`». Se le
  añade **por qué no basta esa mitad**: «normaliza al leer» produce un cero, que asusta y se
  investiga; la otra cara produce un número grande y plausible, que **se publica**.

---

## LA REGLA GENERAL QUE SALE DE AQUÍ

> **Un instrumento que devuelve un número PLAUSIBLE no está verificado hasta que se le enseña un
> caso de RESPUESTA CONOCIDA.**

`wc -l` y «ficheros con CR» son números del mismo orden de magnitud sobre el mismo árbol. **Nada en
la salida delata la sustitución.** Contra un valor ilegible se puede programar una barrera; contra
uno plausible no hay síntoma — no hay excepción que capturar, ni rango que validar, ni forma que
comprobar. Sólo queda el caso fabricado.

Y el corolario, que es lo que este ticket demuestra **en las dos direcciones**: la sospecha tampoco
es prueba. El encargo dio por falso un número correcto porque atribuyó a un instrumento roto un
resultado que había producido otro. **Contra un número plausible, la única respuesta es medir —
también cuando lo que se quiere es desmentirlo.**

---

## LO QUE SE CONSTRUYE

| fichero | qué |
|---|---|
| `scripts/censo-cuenta-de-control-con-grep.mjs` | **nuevo.** El censo, el contador por bytes (`contarCR`), el fabricante de controles (`fabricarControl`) y el detector. CLI con suelo, control positivo y tres salidas (0/1/2). |
| `tests/scrum766-el-grep-que-cuenta-lineas.test.mjs` | **nuevo.** 9 casos: el que decide (3 CR en 50 líneas), el positivo (LF puro), los dos sentidos del grep pegados, el control positivo del detector, que el filtro de velocidad no se adelante al criterio, el suelo, el trinquete del árbol, la permanencia del aviso y la autorreferencia. |
| `tests/scrum480-fin-de-linea.test.mjs` | aviso ampliado con la cara B. **Nada retirado.** |
| `scripts/censo-cr-en-disco.mjs` | el `contarCR` explica por qué «normaliza al leer» es la mitad tranquilizadora. |
| `package.json` | `censo:cuenta-de-control-con-grep`, con su `//` pegado. |

**Sin dependencias nuevas** (sólo builtins de node), **sin tocar `schema.prisma`**, sin `npx`, sin
literales nuevos de producto, y **sin convertir un solo byte del árbol**: el árbol ya está bien —lo
que estaba mal era el instrumento, y lo que estaba peor era la acusación contra el que no lo estaba.

### LA TANDA ME PUSO EN ROJO DOS VECES, Y LAS DOS TENÍA RAZÓN

Ninguno de los dos rojos era de mi mecanismo: los dos eran **guards de la casa cazando lo que yo
había escrito**, y los dos son de la familia exacta de este ticket — texto plausible que se lee
perfectamente bien.

| guard | qué me cazó | cómo se arregló |
|---|---|---|
| **SCRUM-189** · citas con destino | «regla 18 de» en un comentario, sin fichero que la identifique | fui a comprobarla y **no existe**. Retirada la cita, conservada la idea. |
| **SCRUM-737** · cifras sin ancla | «Lee 2.159 ficheros de texto» — un recuento del árbol que caduca con el commit de otro | **opción ② del propio guard**: reformulado sin número. El recuento lo DERIVA y lo publica el censo en `leidos`. |

🔴 **Lo que NO se hizo con el segundo, y el guard lo dice él mismo:** subir `CENSO_CONGELADO` a 82.
Eso habría puesto la tanda en verde reproduciendo el defecto mañana. El orden que impone —derivar,
reformular, atar, anclar, retirar— tiene «actualizar el número» fuera de la lista a propósito.

Y hay un tercer error de método mío, más arriba: **la afirmación sobre los 21 ficheros con CR del
árbol nuevo la escribí antes de comprobarla**, y al comprobarla eran 20 sólo en disco y 1 en el
blob. Los tres son el mismo patrón: escribir algo que se lee bien antes de medirlo.

### El caso que NO se pudo hacer portátil, y se declara

`SCRUM-766 · 🔴 el grep de este entorno NO reproduce la respuesta conocida` mide una propiedad
**del entorno**, no del código. En una máquina sin `bash` se declara `NO APLICA` con motivo escrito
y sale como saltado — nunca en verde silencioso. Y si algún día `grep` acierta las dos caras, el
caso **cae a propósito**, con un mensaje que manda releer los avisos antes de tocarlos: si el
defecto deja de existir hay que escribirlo **encima** de lo viejo, no borrarlo.


---

# ✅ ENMIENDA (7-sep-2026) · EL CASO CAYÓ EN CI, Y EL ROJO ERA EL CORRECTO

El caso del entorno **se puso rojo en CI** con su propio mensaje:

> *«EL `grep` DE ESTE ENTORNO ACIERTA LAS DOS CARAS, y eso contradice lo que este árbol tiene
> escrito. No es un fallo del código: es que el entorno ha cambiado.»*

**Y tenía razón.** El defecto —el CR comido dentro de `$( )`— es del **bash de MSYS en Windows**,
que es donde corren las sesiones. En `ubuntu-latest`, que es donde corre CI, el `grep` de GNU
**acierta las dos caras**. Lo que faltaba en el árbol no era el defecto: era **dónde** pasa.

## ⛔ Lo que NO se hizo, y por qué

- **NO se convirtió en un `skip`.** Un skip esconde el día que CI se mueva a una plataforma que
  SÍ tenga el defecto, y entonces no se entera nadie. La diferencia entre un veredicto y un skip
  es que el veredicto **se imprime y se puede leer**; un skip es un silencio con forma de verde.
- **NO se retiró el aviso.** Sigue siendo cierto para las máquinas donde se trabaja. Es lo que el
  propio mensaje del caso mandaba hacer: si el defecto ya no existe en un entorno, se dice
  **ENCIMA** de lo viejo. Un aviso retirado en silencio vuelve a morder.

## Lo que se hizo: AFIRMAR POR PLATAFORMA

| plataforma | qué afirma el caso |
|---|---|
| **MSYS/Windows** (`uname -o` = `Msys`) | **REPRODUCE** el defecto, exactamente como hasta hoy, con las dos caras nombradas |
| **GNU/Linux** (`ubuntu-latest`) | lo declara ausente como **VEREDICTO IMPRESO** — y lo **afirma**: si esa plataforma lo ganara, rojo igual |
| **cualquier otra / no se sabe** | 🔴 **CIEGO**: ni reproduce ni absuelve |

🔴 **La clasificación NO mira la medida** —eso sería un test que siempre pasa—: sale de `uname -o`
y de `$MACHTYPE`, **dos** señales que existen antes de medir nada y que tienen que estar de
acuerdo. Si se contradicen, la respuesta es `null`, no la que convenga.

⚠️ **`grep --version` no sirve para esto** y por eso no se usa: el de MSYS **también** es GNU grep
(3.0 medido en esta máquina). Lo que distingue no es el binario: es el bash y qué hace con el CR.

## 🔴 EL SUELO, que es lo que impide que esto se vuelva un apagado

*«No sé en qué plataforma estoy» no es «aquí no pasa».* Si `clasificarEntorno` devuelve `null`,
el caso falla **como ceguera** y con un mensaje distinto del de «no cuadra» — son dos averías
distintas y el arreglo no es el mismo.

## Verificación, los DOS sentidos

**En esta máquina (MSYS/Windows), medido:**

```
plataforma: uname -o = "Msys" · MACHTYPE = "x86_64-pc-cygwin" → MSYS_WINDOWS
  n=$(grep -c $'\r' F)   = 50      (wc -l = 50)
  grep -c $'\r' F directo = 0
VEREDICTO · MSYS/Windows: el defecto SE REPRODUCE aquí, tal como está escrito.
```

Sigue reproduciendo las dos caras **exactamente como antes de la enmienda**.

**La rama de Linux no es código muerto**, y no se afirma: se ejercita. Dos vías, porque aquí no
hay Linux con el que correrla de verdad y **eso se dice**:

1. un caso PURO ejercita `clasificarEntorno` y `veredictoDelEntorno` con los valores **reales** de
   las dos plataformas y con los dos desenlaces de cada una (acierta / no acierta), más la ceguera;
2. **por MUTACIÓN**, forzando que esta máquina se clasifique como `GNU_LINUX`: el caso se pone
   **rojo** con *«GNU/Linux ha DEJADO de acertar las dos caras… el defecto habría llegado a la
   plataforma donde corre CI»*. O sea que esa rama está cableada a una aserción de verdad.
   Forzando `null`, cae por **CEGUERA**, con su mensaje propio.

🕳️ **Hueco declarado:** en esta máquina no hay Linux (ni WSL ni Docker, comprobado), así que el
verde de CI es lo único que confirma la rama de GNU/Linux **de extremo a extremo**. Lo de arriba
prueba la decisión y su cableado, no la ejecución en esa plataforma.

## Los dos avisos, AMPLIADOS y sin perder una línea

`tests/scrum480-fin-de-linea.test.mjs` y `scripts/censo-cr-en-disco.mjs` ganan el dato nuevo
—qué plataforma tiene el defecto y cuál no— **debajo** de lo que ya decían. Comprobado con
`git diff --numstat`: **13 y 10 líneas añadidas, 0 borradas** en cada uno.

🔴 **Y la regla práctica no cambia ni un pelo:** aquí se cuenta en BYTES con node, nunca con
`grep`. Que una plataforma acierte no convierte a `grep` en el instrumento — significa que en ESA
plataforma el defecto no se manifiesta, y el código se escribe una vez para todas.
