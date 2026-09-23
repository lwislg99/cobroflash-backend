# Bitácora del orquestador del equipo de Javier

**Dueño: `jv-orquestador`.** Lo pidió Javier el 23-sep-2026: *«quiero que te crees un archivo donde
guardes un reporte con tus acciones que funcionan, tus errores, y lo vayas actualizando y analizando
para mejorar tu performance»*.

**Qué NO es, para que no se duplique con lo que ya existe:**

- No es [`afirmaciones-verificadas-javier.md`](afirmaciones-verificadas-javier.md), que es de **J6** y
  mide si lo que yo afirmo **sobre el código** es cierto. Eso son hechos del repositorio.
  **Esto son hechos sobre cómo trabajo yo.**
- No es un traspaso. El traspaso dice **dónde está el trabajo**; esto dice **qué sé hacer y qué me
  sale mal**, y sobrevive a los traspasos.
- No es el máster ni deriva de él: no crea reglas para nadie. Sólo me obliga a mí.

## Cómo se actualiza

**Al cerrar cada tanda**, y sólo con cosas que pasaron de verdad en ella. Tres condiciones para que
una entrada valga:

1. **Con fecha y con el caso concreto.** «A veces cierro tickets a medias» no vale; «cerré SCRUM-665
   habiendo mirado una de cuatro salidas, el 22-sep» sí.
2. **Con la consecuencia medida, no la temida.** Qué llegó a pasar, o qué habría pasado si nadie lo
   hubiera cazado — y **quién lo cazó**.
3. **Con la regla que deja detrás**, si la deja. Un error sin regla es una anécdota.

⚠️ **Las entradas no se borran ni se suavizan.** Un error que se reescribe más benigno seis meses
después es peor que no haberlo apuntado: convierte la bitácora en un currículum.

---

# 1 · Lo que funciona

Cosas que he hecho más de una vez y han evitado un daño medible. Ordenadas por cuánto evitan.

## 1.1 · Verificar POR EFECTO, no por el informe de la sesión

Antes de dar nada por hecho, ir al repositorio y mirar: un `grep`, un `git show`, correr el guard.
No el mensaje de la sesión, no el PR, no el ticket.

**Casos:** el emisor congelado pasó de 1 a 11 ficheros que lo usan (22-sep) · las tres frases de
«certificación» → 0 en `main` · el reloj: comprobé que `formatFechaHoraHuso(d, zona)` recibe la zona y
que **los cuatro llamadores se la pasan**, en vez de leer el PR (23-sep) · los tres commits varados de
SCRUM-1092: comprobé con `git merge-base --is-ancestor` los tres, uno por uno.

**Por qué funciona:** el informe de una sesión es su interpretación de lo que hizo. Casi siempre
coincide. Cuando no coincide, el error viaja hasta que alguien mira.

## 1.2 · No rodear un permiso denegado

Cuando el clasificador de una sesión le deniega algo, **no se le da a otra sesión**. Se sube al dueño
de los permisos.

**Caso (23-sep):** a J4 le denegaron editar `PACK_GESTORIA.md` y `DECLARACION_RESPONSABLE.md`
(«Real-World Transactions»), los dos, probados por separado. Tenía cinco sesiones más a las que
pedírselo. Se lo llevé a Javier, que instruyó aplicarlo desde aquí.

**Por qué importa más de lo que parece:** «reparto» y «rodeo» se ven idénticos en el resultado. La
diferencia es sólo la intención, y por eso la regla tiene que ser mecánica: si a una sesión se lo
deniegan, **nadie más lo intenta** hasta que lo autorice quien manda sobre los permisos.

## 1.3 · Decirle a cada sesión, por escrito, cuándo PARAR

En cada encargo, qué la haría parar y traérmelo. No «ten cuidado»: el caso concreto.

**Disparó tres veces el 23-sep, y las tres tenía razón la sesión:**

| quién | qué paró | de quién era el error |
|---|---|---|
| **J5** | un reparto que contradecía un comentario de Jira | **mío** |
| **J4** | una instrucción mía que se contradecía a sí misma sobre A17 | **mío** |
| **J4** | un permiso denegado, sin buscar otra herramienta | del entorno |

**Por qué funciona:** las sesiones no pueden verificar mis decisiones, pero sí pueden ver cuándo dos
cosas que les digo no encajan. Eso sólo sirve si tienen permiso explícito para frenar. **Dos de mis
tres errores del día los cazó una sesión parando**, no yo releyendo.

## 1.4 · Medir el contexto desde fuera

`sesion.mjs contexto <nombre>` desde la copia instalada, no lo que la sesión estime.

**Caso (23-sep):** J4 estimó ~97k e iba por **359k**. J6 dijo «lejos de 200k» e iba por **244k**. No es
culpa suya: la puerta de integridad les responde `DESDE-UN-ARBOL` y no pueden medirse.

**Regla:** el contexto se mide en cada punto de control, no cuando me acuerdo.

## 1.5 · Preguntar la pregunta mejor, no aprobar la propuesta

Cuando una sesión trae una propuesta razonable, mirar si resuelve el problema o sólo el síntoma.

**Caso (23-sep):** J5 propuso sincronizar la skill duplicada y poner un guard que vigile la sincronía.
Razonable. Pero eso nos compromete a mantener **dos copias para siempre**. La pregunta que faltaba era
**quién lee la segunda**. Resultó que nadie en este repositorio.

**Regla:** antes de aprobar un mecanismo de mantenimiento, preguntar si lo mantenido sirve.

## 1.6 · Un hallazgo que se queda en un comentario, se pierde

Si algo no cabe en el ticket que se cierra, **abre ticket**. Un comentario no es una cola.

**Caso (23-sep):** SCRUM-735 arregló 20 de 23 ocurrencias; las otras 3 eran de otros carriles. Iban a
quedarse en el comentario 16587. Abrí **SCRUM-1093**.

---

# 2 · Mis errores

Con fecha, con quién lo cazó, y con lo que habría costado.

## 2.1 · 🔴 Cerrar un ticket de varias partes verificando sólo la primera — DOS veces en dos días

| ticket | qué verifiqué | qué quedaba vivo |
|---|---|---|
| **SCRUM-665** (22-sep) | el emisor congelado publicado | era **la opción B de cuatro**, y su propio enunciado decía de ella «no arregla el cambio por código» |
| **SCRUM-534** (23-sep) | el guion H2 aplicado | **nueve afirmaciones falsas** en documentos que se entregan a terceros, y la Parte L publicando `VfSubmission`, que tiene **0 apariciones** en el esquema |

**Lo cacé yo las dos veces, releyendo el enunciado después de cerrar.** No me lo cazó nadie, y ése es
el problema: en Jira nadie vuelve a mirar un ticket cerrado.

**La regla que deja:** antes del cierre, **contar las partes del enunciado** y verificar cada una por
efecto. Si una no se puede verificar, el ticket no se cierra: se comenta qué queda.
→ memoria `un-ticket-con-partes-no-se-cierra-por-la-primera`.

## 2.2 · 🔴 Escribir en el mismo comentario la firma del jefe y mi reparto

**Caso (23-sep):** registré el GO de Javier al reloj citando sus palabras, y terminé con una frase mía
—«lo coge J1»— y luego se lo di a J5. J5 lo leyó, vio que «Javier» había escrito que era de J1, y
**paró sin tocar nada**.

**Lo que lo hace peligroso:** Jira publica **todos** los comentarios bajo la cuenta de Javier, los
escriba él o yo por la MCP. Una sesión **no puede distinguir por el autor** su firma de mi reparto.
El riesgo simétrico es el malo: que alguien trate una firma suya como sugerencia mía.

**La regla:** línea de autoría al principio · palabras del jefe **entrecomilladas y literales** · el
reparto bajo su propio encabezado. → memoria `jira-no-dice-quien-escribio-el-comentario`.

## 2.3 · 🔴 Afirmar por escrito cosas que no había medido

**El patrón que me sale peor.** Cuatro casos en dos días, todos de la misma forma: **una afirmación
concreta, escrita con seguridad, que no había comprobado en ese momento.**

| qué afirmé | qué era | quién lo cazó |
|---|---|---|
| un sha de 40 caracteres en un mensaje de commit (22-sep) | **inventado** | yo, releyendo |
| «55 y 7 facturas» para distinguir bases (22-sep) | cifras de **agosto**; las reales eran 9/5/2 | yo, al medir en vivo |
| «la ventana del reloj es de 1-2 horas **cada día**» (23-sep) | es **anual**: lo que se deriva ahí es el año | **J1**, midiendo antes de construir |
| «la décima no está en las nueve» (23-sep) | eran **dos líneas**: una era A17, que sí estaba | **J4**, en su PASO 0 |

**Lo que tienen en común:** ninguno fue un error de decisión. Los cuatro fueron **asertos**, escritos
en un ticket o en un encargo, sobre algo comprobable en un minuto. Y dos de ellos se convirtieron en
instrucciones para otra sesión.

**La regla:** antes de escribir un **número, un sha, una línea o un recuento** en Jira o en un
encargo, **medirlo en ese mismo turno**. Si no se puede, se escribe como pregunta, no como hecho.
Es exactamente lo que `afirmaciones-verificadas-javier.md` pide, y yo lo estaba aplicando al código
pero no a mis propias frases.

## 2.4 · Dejar correr sesiones muy por encima del umbral

**Caso (23-sep):** dejé a J1 llegar a **689k**, más de tres veces el umbral de 200k. Lo hice a
propósito —estaba a medio construir el camino de emisión con un GO firmado— y salió bien: entregó el
PR en verde. **Pero fue la segunda vez el mismo día**, y la decisión de dejar correr no tenía criterio
escrito, sólo intuición.

**La regla que me pongo:** dejar pasar el umbral **sólo** con trabajo en vuelo que se pierde al
relevar, **diciéndoselo a la sesión** («termina esto y paras»), y **una sola vez por sesión**. Si
vuelve a pasar el umbral, se releva aunque cueste rehacer contexto.

## 2.5 · Bajar una orden que yo mismo había objetado

**Caso (22-sep):** le pasé a J4 una instrucción con la que yo no estaba de acuerdo (etiquetar texto
generado como «respuestas del asesor»), sin bajar mi objeción con ella. J4 se negó, con razón.

**La regla:** mi objeción baja **con** la orden. Y si el ejecutor la rechaza, se vuelve al jefe —
**no se busca otro ejecutor**. → memoria `no-bajar-una-orden-que-yo-mismo-discuti`.

## 2.6 · 🔴 Anunciar un arreglo antes de probarlo ENTERO — y el mismo día que apunté ese patrón

**Caso (23-sep, por la tarde).** J6 midió que el lanzador **no fija el directorio de trabajo en ningún
sitio**, así que cada sesión hereda el mío y las seis comparten árbol. Monté el arreglo obvio —un
worktree por sesión—, medí el coste de arranque (`npm ci`, **17,8 s**, cierto y verificado) y **le dije
a Javier que estaba «montado y probado»**.

**No lo estaba.** Lo probado era el `npm ci`. **Nunca llegué a lanzar una sesión desde ese árbol.**
Al intentarlo de verdad, con control:

| prueba | resultado |
|---|---|
| lanzar desde el worktree propio, 3 intentos | **no arranca**: se registra y se queda sin proceso |
| parar una sesión y reintentar | no arranca |
| parar otra y reintentar | no arranca |
| **mismo prompt, mismo lanzador, desde el árbol de siempre** | **arranca a la primera** |

**Lo que costó:** paré **dos sesiones** (J4 y J5) como parte de comprobar una hipótesis que resultó
falsa. Iban a pararse igual —las dos por encima del umbral y con dos peticiones de traspaso
ignoradas—, así que el daño real es cero, pero **la razón que di para pararlas no era la buena**.

**Lo que se ganó, y no es poco:** el lanzador llevaba días diciendo que esto *«puede ser un límite de
sesiones concurrentes (SIN CONFIRMAR, SCRUM-1011)»*. **Queda desmentido por medición**: se pararon dos
y siguió sin arrancar. Un «sin confirmar» escrito hace días es una hipótesis que nadie ha ido a matar;
ésta ya está muerta.

**Por qué esta entrada importa más que las otras:** es **exactamente** el patrón que el §3.1 de este
mismo documento identifica —afirmar sin medir del todo— repetido **el mismo día que lo escribí**, y
sobre el documento que lo escribía. Nombrar un patrón no lo desactiva.

**La regla que deja, más estrecha que la del 2.3:** cuando lo que se anuncia es **un arreglo**, la
medición que vale es **la del efecto que el arreglo promete**, no la de un paso intermedio. Medir que
se instalan las dependencias no es medir que una sesión arranque. Si sólo se ha probado el paso
intermedio, se dice así: *«montado, falta probarlo de punta a punta»*.

---

# 3 · Análisis

## 3.1 · Dónde se concentran mis errores

De los siete apuntados, **cinco son asertos escritos sin medir** (2.1 y 2.3). **Ninguno es una
decisión de reparto equivocada, ni un ticket mal priorizado, ni un GO mal pedido.**

Eso dice dónde mirar: no en cómo decido, sino en **la distancia entre lo que sé y lo que escribo**.
Cuando escribo rápido para no frenar a seis sesiones, relleno huecos con lo que recuerdo. Y lo que
recuerdo tiene fecha.

## 3.2 · El patrón del proyecto, que también es el mío

**Algo escrito dice una cosa y el repositorio dice otra.** Lo vi seis veces el 23-sep: el documento de
migraciones que bloqueaba cinco funciones desde agosto · SCRUM-1039 asignado al equipo equivocado
durante dos días · «55 preguntas» que eran 35 · «9 de 9» que era de otro ticket · SCRUM-537 en
«Finalizada» con el hueco vivo · la skill duplicada congelada desde junio.

**Mis propios errores son ese mismo patrón**, sólo que yo soy el que escribe. Por eso la regla de 2.3
no es higiene: es el centro.

## 3.3 · Lo que me salva no soy yo

Dos de mis tres errores del 23-sep los cazó **una sesión parando**, no una relectura mía. Eso tiene
dos consecuencias:

1. **La instrucción de parar es el instrumento más rentable que reparto.** Cuesta tres líneas en cada
   encargo y hoy ha evitado aplicar mal un documento que se firma ante Hacienda.
2. **Cuando una sesión para, casi siempre tiene razón.** Las tres de hoy la tenían. Mi reflejo de
   «resolverlo rápido para que siga» es el que hay que vigilar: lo que hay que hacer primero es
   **mirar si el que está mal soy yo**.

## 3.4 · Lo que todavía no sé hacer bien

- **Decidir cuándo relevar.** 2.4 no tiene criterio, tiene instinto. La regla que me puse es nueva y
  no está probada.
- **Mantener puestos parados sin ansiedad.** J2 lleva horas apagada porque sus tres tickets esperan a
  Javier. Es lo correcto —lanzar sin cola real se inventa trabajo— pero tiendo a buscarle encargo.
- **Medir mi propio gasto.** Sé medir el de las sesiones y no aplico lo mismo a esta.

---

# 4 · Registro por tandas

## 23-sep-2026

**Publicado con firma:** el lote de literales de cobro de la web (A, C, D y el demo cortado en la
firma) · las nueve correcciones de los documentos a terceros · el arreglo del reloj en el camino de
emisión fiscal (**el primer cambio del camino fiscal construido con firma**) · la categoría de la
Parte H2 del máster. **17 PR a `main`.**

**Desbloqueado:** SCRUM-1039, que tenía detrás 14 tickets de contabilidad parados — y que llevaba dos
días asignado en mi cabeza al equipo equivocado.

**Escalado al equipo de Luis:** SCRUM-1090 (un guard impide publicar una frase verdadera) y
**SCRUM-1091** (un guard que **falla abierto**: no ve las redirecciones que truncan cuando el comando
lleva `cd` a una ruta POSIX, que es como trabajan todas las sesiones).

**Errores:** 2.1 (SCRUM-534) · 2.2 · 2.3 (dos de los cuatro) · 2.4.

**Cazado por sesiones:** 4 paradas, 4 aciertos. La cuarta: J1 leyó «no puedo confirmar que esto esté
a salvo» donde un `ls-remote` decía «no existe», y paró en vez de dar por perdido un commit que ya
estaba en `main`.

**Decisiones del fundador recogidas:** el titular · el lote de cobro entero · las nueve de los
documentos a terceros · el GO al reloj · NO construir SCRUM-1050 · GO acotado a SCRUM-1051 · la
dependencia para leer Excel · franja y nombre en el portal · la enmienda del máster (opción B) · el
espejo de `.agents/` es de Luis, se sincroniza · **Javier es el productor de pruebas**.

**Dos cifras mías que corrigió una sesión:** dije «43 censos caídos» y eran **21** —el log contaba
cada fallo dos veces— · dije «ventana de 1-2 horas cada día» y es **anual**.

**Errores de la tarde:** 2.6.
