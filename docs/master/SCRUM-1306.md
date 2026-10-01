# SCRUM-1306 · Una firma superada sigue contando como aprobada — censo y dos salidas

**Medido contra:** `origin/main` = `0e86f5def492e4a7dea3cffaca6704de513db149` · 2026-09-30T22:07:18Z

Sesión J5, por encargo del orquestador del equipo de Javier: **medir y proponer, no construir.**
`tests/_microcopy-aprobada.mjs` es compartido con el equipo de Luis y **no se ha tocado**; tampoco se ha
borrado ningún registro de aprobación. Todo lo de abajo se midió sobre una copia de `origin/main` sacada
con `git archive` (el helper, `docs/microcopy/`, el registro congelado y `limites-del-fundador.md`),
llamando al helper real, no a una reimplementación.

## ① ¿Cuánto alcanza? Quién pregunta «¿consta en alguno?»

Población: los ficheros de `tests/`, `scripts/` y `src/` que llaman a `constaAprobado(` o a
`aprobacionesDeMicrocopy(`, sin contar el propio helper. `constaAprobado` aparece en **29**; en 8 de
ellos sólo en comentarios (`scrum402`, `514`, `586`, `587`, `607`, `631`, `641` y
`src/modules/jobs/domain/albaranSinPresupuesto.ts`). Quedan **22 que lo llaman**, más los tres que
leen el barrido directamente. Clasificados por **qué preguntan**:

| Forma | Qué pregunta | Guards | ¿Ve una firma superada? |
|---|---|---|---|
| **Laxa** | `constaAprobado(t).length > 0` / `notDeepEqual([], …)`: «¿en alguna ficha?» | 9 · `1022c`, `1108b`, `1116`, `1199`, `1239`, `650d`, `688`, `713`, `832` | **No**, venga de la ficha que venga |
| **Por ticket** | `constaAprobado(t).some((r) => r.includes('SCRUM-n'))` | 6 · `1126` (caso de textos, :287), `1133`, `1135`, `1136`, `1247`, `1257` | **No** si la firma nueva es del **mismo ticket**, que es justo el caso de J2 |
| **Por ticket, sobre el barrido** | `aprobacionesDeMicrocopy().find((a) => a.ruta.includes('SCRUM-n') …)` | 2 · `1154`, `1196` (Cloudflare, el mío) | **No**, y peor: `.find` devuelve la ficha **más antigua** del ticket (el barrido va por nombre, y el nombre empieza por la fecha) |
| **Ficha concreta** | la ruta exacta (`.includes(FICHA)`) o ticket **y ranura** (`registro1126(ranura)`) | 4 · `600g`, `769`, `917g`, `1126` (caso nuevo) | **Sí** |
| **Del instrumento** | prueban el propio helper | 4 · `709`, `715`, `726`, `861` | no aplica |

**Cuenta: 17 guards de producto no distinguen una firma vigente de una superada; 4 sí.** Es deuda del
instrumento más que un agujero, por ② (hoy no hay víctima), pero la proporción es la contraria de la
que se suponía.

🔴 **Corrección a una premisa:** el ticket y el encargo daban por hecho que los guards de 1154 y 1196
«leen el registro concreto». **No lo hacen:** eligen la ficha por ticket y se quedan con la primera.
Hoy aciertan porque cada uno tiene una sola ficha. El día que se firme un texto nuevo para Google o
para Cloudflare en una ficha del mismo ticket, seguirán validando el viejo. `1126` sí elige por
ticket **y ranura**, y es el único de los tres que caza.

## ② ¿Hay hoy algún literal superado que siga pasando?

**Uno: el de la fusión.** Ningún otro.

| Búsqueda | Población | Resultado |
|---|---|---|
| **Control positivo**: el `todoPasa` del 29-sep, superado por el del 30-sep | 1 literal | `constaAprobado` devuelve `2026-09-29-SCRUM-1126-fusion-de-clientes.md`: **el defecto se reproduce** |
| La misma ranura (nombre de fichero) en dos fichas | 98 fichas | 0 repetidas |
| La misma clave de fila (`` `clave` `` en la primera celda) en dos fichas, con literales distintos | 81 claves | 0. **Ciega al caso de 1126**, porque la ficha nueva lo escribe como cita y no como fila |
| Prosa «Sustituye a la ranura `X`» | 98 fichas | 1: `2026-09-30-SCRUM-1126-fusion-direcciones-de-obra.md` → `todoPasa`. **El conocido** |
| Celdas de columnas «qué sustituye», con cada «…» o `…` citado comparado por identidad contra lo aprobado | 30 celdas | 0 |
| Citas «…» y tachados `~~…~~` en párrafos que dicen sustituir, reemplazar, retirar o superar, comparadas por **subcadena** contra los 499 literales aprobados | 98 fichas | 15 candidatos, leídos uno a uno: **ninguno es una sustitución**. Son el mismo literal reutilizado en otra pantalla (`1220`/`1257`, `915`), una palabra suelta («factura», «Guardar», «Descripción»), o un texto que se acota sin retirarse (`1239` sobre el genérico de `1199`) |
| Una retirada escrita dentro de la propia ficha: `993`, el literal tachado | 1 literal | `constaAprobado` devuelve `[]`: **no cuenta**. Retirar en la misma ficha, bien escrito, ya funciona hoy |

**Suelo:** sólo ve sustituciones que alguien **escribió** en `docs/microcopy/`. Una firma que sustituye a
otra y sólo lo dice en Jira o en `docs/master/` no la ve ninguna de estas búsquedas. Y el registro
congelado (`MICROCOPY_APROBADA_SIN_APLICAR.md`) no se puede anotar: si una ficha nueva lo supera y no lo
dice, tampoco sale.

## ③ Las dos salidas, con su coste (sin elegir)

### A · `constaAprobado` devuelve sólo lo vigente

Hay que decidir **cómo se declara la sustitución** para que la lea el instrumento. La forma que no cae en
la trampa: **la declara la ficha NUEVA**, en una línea con formato fijo, y **no se toca la vieja**:

    **Sustituye a:** `docs/microcopy/<fichero viejo>` · «<literal viejo, entero>»

El helper quita ese literal de lo aprobado de la ficha vieja, y **comprueba la declaración**: que el
fichero existe, que el literal está en él tal cual, que la ficha nueva es posterior y que cuenta como
aprobada. Si falla cualquiera de las cuatro, rojo.

- **Coste:** cambiar el helper compartido (acuerdo con el equipo de Luis), una línea en la ficha del
  30-sep de 1126 y los casos de prueba del propio helper. Los 17 guards no se tocan: se endurecen solos.
  Medido en ②, no debería romper nada aplicado: el único literal superado no está en el código.
- **Riesgo:** una sustitución que nadie declare sigue contando como hoy. No empeora nada, pero tampoco
  lo detecta.

### B · Se deja como está, y se escribe que «¿consta en alguno?» no vale para un texto sustituible

La regla va en el JSDoc de `constaAprobado` y en el README de `docs/microcopy/`: un texto que se puede
volver a firmar se comprueba contra **la ficha concreta, por ticket y ranura** (la forma de `1126`), no
preguntando si consta en alguna.

- **Coste:** casi cero en código. Si además se quiere que **no sea sólo una nota**, un trinquete como
  `scrum553`: las llamadas laxas y por ticket no pueden **subir** de 17.
- **Riesgo:** los 17 siguen igual. La próxima sustitución repite el caso de J2, salvo que quien escriba
  el guard lea la regla. El trinquete impide que crezca, pero no arregla lo que ya hay.

### La trampa que pedía valorar

**Una marca «RETIRADO» en la ficha vieja sí es una lista de excepciones con otro nombre.** Edita el
historial, que no se debe tocar, y la puede escribir cualquiera sin que nada compruebe a qué apunta.
**A no cae en eso si, y sólo si, cada declaración se verifica** (las cuatro condiciones de arriba) y
vive en la ficha que trae la firma nueva: es la consecuencia de un acto firmado, no una excepción
suelta. Si A se construyera sin esa verificación, **sí** caería en la trampa. `993` enseña que la
retirada **dentro de la misma ficha** ya funciona sin mecanismo nuevo; A sólo hace falta cuando la
sustitución cruza de ficha.

**Un dato para decidir:** en 98 fichas y casi un mes de firmas, **una** sustitución entre fichas.

## Lo que no se ha hecho

- No se ha tocado `tests/_microcopy-aprobada.mjs` ni ningún guard. **Tampoco el mío de 1196**: pasarlo
  a ticket y ranura es un cambio pequeño, pero depende de lo que se decida aquí.
- No se ha borrado ningún registro.

A9: aviso → cicatriz J5 «Un guard de texto firmado eligió su ficha por ticket (`.find` sobre `SCRUM-1196`), no por ticket y ranura» — no se pudo comprobar: la comprobación es la decisión de SCRUM-1306 sobre el helper compartido, que no está tomada.

## Vuelta 2 · la decisión: B con trinquete, y 1154 y 1196 a ticket y ranura

**Medido contra:** `origin/main` = `7042852f5f400b6719925c5bdbfbe9a403260aef` · 2026-09-30T22:21:42Z

El orquestador eligió **B con trinquete** (SCRUM-1306, comentario 17656, que corrige la premisa de la
descripción con el censo de la vuelta 1). Lo decidió el número: **una** sustitución entre fichas en
98. A queda escrita arriba, con sus cuatro verificaciones, para el día que haya más.

**Lo construido** (el helper compartido NO cambia de comportamiento; sólo su comentario):

1. **1154 y 1196 eligen su ficha por ticket y ranura** (`FICHA_VIGENTE`), no la primera del ticket.
   Cada uno lleva un control nuevo: en una carpeta temporal, la ficha vigente más una **más antigua
   del mismo ticket**, firmada y con otro literal. El guard tiene que seguir leyendo la vigente.
   **Rojo visto en los dos:** devolviendo la selección a `ruta.includes('SCRUM-n')`, el control cae
   con «ha pasado a leer la ANTIGUA». Restaurados y comprobados por sha256.
2. **El trinquete:** `tests/scrum1306-consta-en-alguno.test.mjs`, tope **15**. Cuenta los guards de
   producto con al menos una pregunta débil (laxa, o por ticket sin ranura). Los tests del propio
   instrumento se reconocen solos: importan del helper algo más que las dos funciones de producto.
   - Lo que mide coincide fichero a fichero con el censo a mano de la vuelta 1: 15 débiles (los 9
     laxos y los 6 por ticket), 21 guards de producto y 4 del instrumento.
   - Primera medida: 16. El que sobraba era `scrum631`, que **cita** `constaAprobado()` dentro de un
     mensaje. Arreglado en el clasificador, no en el tope: lo de dentro de una cadena no es una
     llamada, y va en los controles.
   - **Rojo visto:** deshaciendo el arreglo de 1154, sube a 16 y cae.
   - **Límite declarado:** mira la sentencia de la llamada. Si el resultado se guarda en una variable
     y se filtra por ticket en la siguiente (`1247`, `1257`), lo cuenta como laxo. Cuenta igual como
     débil, así que el tope no cambia; lo que cambia es la etiqueta.
3. **La regla escrita:** en el JSDoc de `constaAprobado` y en `docs/microcopy/README.md`. Un texto
   que se puede volver a firmar se comprueba contra **su** ficha, por ticket y ranura. La ficha vieja
   no se toca, ni se borra ni se marca.

El #2019 (vuelta 1, sólo documentos) se mergeó antes de que llegara la decisión. Por eso esto va en
un PR aparte y no en el mismo.

A9: comprobación → `tests/scrum1306-consta-en-alguno.test.mjs`
