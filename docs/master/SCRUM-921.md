# SCRUM-921 · Las afirmaciones de autorización del árbol, censadas y contrastadas con Jira

**Medido contra:** `origin/main` = `adaef3c4aee5d72f02d39037edf133d09e37e2b5` · 2026-09-17T17:55:23Z

Rama `scrum-921-censo-firmas-autorizacion` · Sesión 3 (bancos e instrumentación).

> **Origen:** la confesión de S4 en SCRUM-878b. Un bloque de test decía «el fundador decide que
> sí se pone». Esa autorización no existe: **SCRUM-878 tiene `comment.total = 0`**, comprobado
> hoy contra Jira. Lo escribió una sesión y llevaba desde entonces en el árbol pareciendo firma.

---

## 0 · El veredicto en una línea

**El censo está completo. La clasificación contra Jira, no — y eso cuenta del lado malo.**
De 1.321 afirmaciones de autorización censadas, **27 llevan la marca canónica de firma y no
dicen dónde consta la decisión**. De los 401 tickets que el resto cita, se han leído **5**: los
tres veredictos aparecieron en esos cinco, así que los tres cubos existen de verdad y ninguno es
teórico. Los otros 396 quedan **NO DECIDIBLES**, que por la regla del encargo cuenta como malo.

---

## 1 · La población examinada, declarada

No se censa por substring. Medido sobre este árbol **antes** de escribir el instrumento:

| se busca | líneas que casan | qué son en realidad |
|---|---|---|
| `firma` | 11.226 | casi todo huella encadenada de VeriFactu |
| `firmad` | 2.970 | casi todo albaranes y partes firmados **por el cliente** |
| `fundador` | 3.656 | en su mayoría **norma**: «hace falta firma del fundador» |

Ninguna de las tres mide lo que el ticket pregunta. Lo que se busca no es la palabra: es la
**forma** — un agente con potestad (fundador, asesor/orquestador) como sujeto o complemento
agente de un verbo de autorización **en modo declarativo**.

```
ficheros seguidos en tests/ src/ scripts/ docs/ ....... 2.720
ficheros LEÍDOS ....................................... 2.417
ficheros saltados ..................................... 303   (288 .png, 6 .xsd, 2 .pdf,
                                                               y .xml .tsv .toml .ps1
                                                               .properties .diff y un
                                                               ejecutable sin extensión)
líneas leídas ......................................... 525.690
```

| capa | cuenta |
|---|---|
| **bruto** — líneas que casan alguna forma de autorización | **1.480** |
| **descartadas**, con su motivo nombrado | **159** |
| · `norma-no-afirmacion` (exige una firma, no afirma tenerla) | 154 |
| · `firma-del-producto` (el cliente firma un albarán) | 4 |
| · `agente-externo` (autoriza Meta, la AEAT…) | 1 |
| **candidatos** — afirmaciones de autorización sobre este proyecto | **1.321** |

Candidatos por directorio: `docs` 713 · `tests` 440 · `src` 135 · `scripts` 33.

---

## 2 · La clasificación

El criterio de **respaldo** no se ha inventado: es el que este proyecto ya tiene firmado y en uso
en `tests/scrum387-procedencia-aprobacion.test.mjs` — **procedencia rastreable = un `SCRUM-<n>` o
un `docs/…`** en la misma unidad de lectura. Una fecha sola no vale, porque no dice dónde mirar.

| cubo | cuántas | criterio |
|---|---|---|
| **FIRMA REAL** | **1 verificada** | existe comentario del ticket que respalda la afirmación, con su id |
| **SIN RESPALDO** | **2 verificadas** (una de ellas ya corregida y fuera del árbol) | se fue a mirar y el ticket no la respalda |
| **NO DECIDIBLE** | **el resto (1.319)** | **94** no dicen dónde mirar · **1.225** lo dicen y **nadie ha ido a mirar todavía** |

### 2.1 · Lo verificado contra Jira, con su id

| afirmación en el árbol | ticket | qué hay en Jira | veredicto |
|---|---|---|---|
| `tipoIntervencion.ts:5` — «Vocabulario CERRADO, aprobado por el fundador el 2-sep-2026 (regla 27)» | SCRUM-651 | **comentario `14229`**, 2-sep-2026: *«Las tres decisiones del fundador — 1 · «Tipo de intervención»: APROBADO, con columna nueva y vocabulario cerrado (regla 27)»*, y enumera los tres valores | ✅ **FIRMA REAL** |
| *(el caso conocido, ya corregido)* «el fundador decide que sí se pone» | SCRUM-878 | **`comment.total = 0`**. Ninguna firma, ni del fundador ni delegada | 🔴 **SIN RESPALDO** |
| `docs/master/SCRUM-315.md:22` — «Microcopy aprobada por el fundador, literal (regla 30)» | SCRUM-315 | 1 comentario: un informe de cierre de 5-ago-2026. **No aprueba ninguna microcopy ni cita ningún texto** | 🔴 **SIN RESPALDO en el ticket citado** |
| `docs/master/SCRUM-423.md:56` — «Microcopy — APROBADA por el asesor el 10-ago-2026 (regla 30)» | SCRUM-423 | 1 comentario; dice «confirmado por el fundador» **referido al merge**, no a ningún texto | ⚠️ **NO DECIDIBLE** |
| `docs/microcopy/2026-09-04-SCRUM-605-…:3` — «**Aprobado por el fundador** el 4-sep-2026, en **SCRUM-605**» | SCRUM-605 | 5 comentarios; uno trata explícitamente de la firma pendiente de esos textos | ⚠️ **NO DECIDIBLE** por sí solo · **sale limpio del censo, que es lo que aquí se comprobaba** |

**SCRUM-315 es el hallazgo que confirma que esto no era un caso aislado:** un registro de máster
afirma una aprobación de microcopy citando un ticket cuyo único comentario no aprueba nada.

### 2.2 · Las 27 que no dicen dónde consta la decisión

**No se ha borrado ninguna, y no se deben borrar** (punto ③ del ticket): una firma sin respaldo
puede ser una firma real mal registrada, y borrarla perdería la decisión. Se congelan en el
trinquete `SIN_PROCEDENCIA = 27` y se listan aquí. **16 se atribuyen al fundador y 11 al
asesor** — y esa distinción importa, porque el README de `docs/microcopy/` dice que la firma del
orquestador sólo cuenta con la delegación permanente **y su número de comentario de Jira**.

**6 viven en `src/`, o sea en producción:**

| dónde | qué afirma |
|---|---|
| `src/modules/billing/domain/metodoDeCobro.ts:82` | «El rótulo de ese cubo, APROBADO por el asesor el 10-ago-2026 (regla 30).» |
| `src/modules/invoicing/domain/portonDocumento.ts:46` | «Copy OFICIAL para el cliente final, aprobado por el fundador el 30-jul-2026 (regla 30).» |
| `src/modules/jobs/domain/albaranIdempotencia.ts:48` | «MICROCOPY DEL 409 — **APROBADA por el asesor el 11-ago-2026** (regla 30). NO se reformula.» |
| `src/modules/jobs/domain/parteDictado.ts:402` | «✅ APROBADO por el fundador el 2-sep-2026 (regla 30), con la línea de “no completes marcas”.» |
| `src/modules/system/app/routes/quotesAdmin.routes.ts:339` | «Microcopy OFICIAL: aprobado por el fundador el 30-jul-2026 (regla 30).» |
| `src/modules/whatsappBot/domain/botFlow.service.ts:125` | «Menú oficial K1 (lista) — copy v2 aprobado por el fundador (5-jul-2026).» |

**21 en `tests/`** — `scrum244:43` · `scrum257:26` · `scrum294c:177` · `scrum305:207` ·
`scrum320:36` · `scrum324:30` · `scrum358:179` · `scrum379:64` · `scrum404:113` ·
`scrum428:121` · `scrum469:109` · `scrum575b:301` · `scrum580:318` y `:325` · `scrum581:138` ·
`scrum587:202` · `scrum590b:140` · `scrum593b:21` · `scrum726:150` · `scrum772:40` ·
`scrum780:150`.

⚠️ **Dos de esas 21 no son deuda y conviene decirlo**, porque un informe que no separa lo que
mide de lo que su instrumento no distingue empuja a arreglar lo que está bien:
`scrum726:150` es un **fixture** (`const alReves = '…**Aprobado por el ASESOR**…'`, un registro
de mentira que ese test construye a propósito), y `scrum580:325` es una advertencia que dice
justo lo contrario de una firma: *«**aprobada por el asesor» NO es «firmada por el fundador»**»*.
Se dejan dentro de la cuenta porque **quitarlas a mano convertiría el trinquete en una opinión**,
y porque bajarlo exige tocar la línea y explicarlo, que es el mecanismo.

Otras **67** afirmaciones (fuera de la marca canónica: «decisión del fundador», «con el OK
de…», «el fundador decidió») tampoco dicen dónde constan. **No entran en el trinquete**: su tasa
de falso positivo no está medida, y congelar un número que no se ha auditado es fabricar una
cifra que nadie podrá bajar con criterio.

---

## 3 · Por qué el mecanismo que ya existe no lo cazó

`SCRUM-387` lleva desde el 7-ago-2026 exigiendo exactamente esto — procedencia rastreable junto a
toda marca de aprobación, con trinquete bidireccional. **Su test pasa hoy, 5/5.** No falló: es
que el caso conocido caía fuera **por dos ejes a la vez**.

| eje | lo que cubre SCRUM-387 | dónde estaba el caso de SCRUM-878b |
|---|---|---|
| **población** | `['src', 'public']` | `tests/` |
| **léxico** | `aprobad[oa]s? por el fundador` | «el fundador **decide**» |

**Arreglar un solo eje no lo habría cazado.** Por eso este ticket no toca aquel guard: lo
complementa. `SCRUM-387` sigue siendo la autoridad en `src/` y `public/` — y de hecho su
criterio es **más estricto** que el de este censo, porque sólo mira el texto del comentario
mientras que éste acepta también el id en el nombre del fichero. Donde los dos miran lo mismo,
**manda el suyo**.

---

## 4 · ¿Admite mecanismo? Sí, y es una extensión, no un invento

**Propuesta, sin implementar** (punto ④). Lo que hace falta **ya está construido**; lo que falta
es alcance:

1. **Ampliar la población de `SCRUM-387`** de `['src','public']` a `['src','public','tests','scripts','docs']`. Es un cambio de una línea en un guard que ya existe y ya tiene trinquete.
2. **Ampliar su marca** a las formas que hoy no ve: `el fundador decide/decidió/aprobó`, `decisión del fundador`, `con el OK/GO del fundador`, `autorizado por`, `firmado por`. El léxico derivado del árbol está en `tests/_censo-firmas-autorizacion.mjs`, con cada forma nombrada.
3. **Subir el listón de «procedencia» a «respaldo»** sólo donde hoy es verificable: `docs/microcopy/` ya exige, por su README y por `SCRUM-861`, la firma **con número de comentario de Jira**. Ahí un guard puede comprobar que el comentario **existe**.

**Lo que NO admite mecanismo, y hay que decirlo:** un guard **no puede comprobar que una
autorización sea cierta**. Puede comprobar que sea rastreable, y que el comentario citado exista.
Creerlo capaz de más sería el mismo error con otra cara.

🔴 **Y hay un requisito previo que hoy no se cumple.** Para exigir «firma del fundador con id de
comentario» hay que saber **qué cuenta de Jira es el fundador**, y eso no está escrito en ningún
sitio del árbol. Los comentarios del proyecto los firman dos cuentas, *Luis Lara* y *Javier
Pereira Fernández*, y de la lectura de los propios comentarios **no se deduce sin ambigüedad**
cuál es la del fundador y cuál la del asesor. **No lo invento.** Mientras eso no esté escrito, un
guard que distinga «aprobado por el fundador» de «aprobado por el asesor» no puede comprobar la
diferencia que él mismo exige — y son 11 de las 27 de arriba. **Es una pregunta para el
fundador**, y es barata: una línea en `docs/equipo/limites-del-fundador.md`.

---

## 5 · Los tres defectos del instrumento, míos, medidos y corregidos antes de publicar

Ninguna de las tres cosas la encontró nadie más. Las tres habrían salido como hallazgos.

1. **Ventana fija de ±3 líneas.** La versión 1 (commit `eeac08f7`) declaró **26 marcas sin
   procedencia**; al mirar el bloque entero, **24 tenían su `SCRUM-<n>` a más de tres líneas**.
   24 acusaciones falsas, con la forma más peligrosa que puede tener un hallazgo: una lista de
   nombres propios que parece trabajo pendiente. *Una ventana fija es una tolerancia disfrazada.*
2. **El límite de palabra no entiende los acentos.** En JavaScript `\w` es `[A-Za-z0-9_]`, así
   que `aprob[oó]\b` casa «aprobo» y **no casa «aprobó»**. El censo estaba ciego a **todos los
   pretéritos con tilde** — la forma natural en castellano de decir que alguien ya autorizó algo.
   Al arreglarlo, el bruto pasó de **1.206 a 1.480**: había un **21 % invisible**. *No lo cazó el
   control positivo*, porque el caso conocido dice «decide» y la «e» sí es carácter de palabra.
3. **Un tercero en la frase tapaba al fundador.** El descarte de agente externo miraba si la
   línea *nombraba* a un tercero en vez de mirar *quién autoriza*, y se comía cuatro líneas de
   `docs/MIGRATIONS_PENDING.md` del tipo «`prisma db push` aplicado contra **Railway**,
   **autorizado por el fundador**» — de lo más serio que puede afirmar este árbol.

---

## 6 · Controles

| control | qué exige | resultado |
|---|---|---|
| **SUELO** | 0 apariciones ⇒ CIEGO, con población declarada | ✅ 1.480 sobre 2.415 ficheros y 525.046 líneas |
| **POSITIVO** | el caso conocido sale, **y por el eje correcto** (forma `agente+verbo`, no por contener «fundador»), sin procedencia y sin ser descartado | ✅ |
| **NEGATIVO** | un texto que cite una decisión **con su id de Jira** sale limpio — de laboratorio y del árbol real (`docs/microcopy/`, 0 marcados) | ✅ |
| **ROJO PROVOCADO** | con una cobaya sin procedencia, el trinquete cae y **nombra fichero y línea** | ✅ `not ok 7`, salida 1 |
| **testigo de la cobaya** | comprobar que la cobaya EXISTE para el censo antes de creerse el rojo | ✅ — y cazó que la primera cobaya **se autoexculpaba**, porque su cabecera decía `SCRUM-921` en la línea contigua |
| **sonda independiente** | cruce con `SCRUM-387`, que mide lo mismo por otro camino | ✅ su test 5/5; la discrepancia se explica y **manda el suyo** en `src/` |

`tests/scrum921-firmas-con-respaldo.test.mjs` — **8 tests, 0 fallos**, exit 0 leído sin tubería.

---

## 7 · Lo que este ticket NO ha hecho

- **No ha borrado ni reescrito una sola afirmación.** Punto ③ del enunciado.
- **No ha leído 396 de los 401 tickets citados.** Cuentan como NO DECIDIBLE, del lado malo.
- **No ha mirado `public/`**, que no estaba en el alcance; ahí manda `SCRUM-387`.
- **No ha implementado** la propuesta del §4: el enunciado pide proponer, no construir.
- **No ha resuelto** qué cuenta de Jira es el fundador. Es la pregunta del §4.

---

# SCRUM-921b · Las 27 sin respaldo, clasificadas contra Jira y el máster

**Medido contra:** `origin/main` = `71c845c92c50c5daff5afa1f3be7c5fe0645de86` · 2026-09-17T18:49:23Z

Fase b. La fase a dejó escrito *«el censo está completo; la clasificación, no»*, y eso es lo que
cierra esta fase — **sólo para las 27**, que son las accionables. Los 401 tickets citados por el
resto siguen sin leer y siguen contando del lado malo.

## 0 · Veredicto

De las 27, **16 eran decidibles hoy** (las atribuidas al fundador). Las otras 11 dicen «aprobado
por el asesor» y esperan a que se escriba qué cuenta como firma delegada.

| | |
|---|---|
| ✅ **FIRMA REAL** — evidencia positiva citada | **10** |
| 🔴 **SIN RESPALDO** — se fue a mirar y no está, o el ticket dice otra cosa | **5** |
| ⚪ **falso positivo del censo** — es una negación, no una afirmación | **1** |
| ⏸ **bloqueadas** (las del asesor) | **11** |

🔴 **Dos de las cinco sin respaldo están en `src/`, o sea en producción.**

## 1 · Dónde se buscó, para que se pueda repetir

Tres sondas por afirmación, y **ninguna vale sin su control**:

1. **el literal en `docs/`** — `git grep -F` del texto que la afirmación dice aprobado;
2. **el literal en Jira** — `text ~ "\"frase\""`, que cubre resumen, descripción y comentarios;
3. **la atribución** — que el documento o el comentario diga **quién** aprobó, no sólo que el
   texto exista ahí. Es la diferencia entre SCRUM-593 (*«Literal del fundador»*) y SCRUM-257.

**Control del buscador de Jira, hecho antes de creerse ningún cero:** `comment ~ "vocabulario
cerrado"` devuelve SCRUM-651 ✅ — y, porque un control sin tilde no absuelve a las frases con
tilde, **`comment ~ "Tipo de intervención"` también devuelve SCRUM-651** ✅. Es la lección del
`\b` de la fase a aplicada al instrumento nuevo.

## 2 · Las 10 con FIRMA REAL

| afirmación | respaldo, citado |
|---|---|
| `portonDocumento.ts:46` | **máster `YAQU_MASTER.md:1353`** (SCRUM-206): *«LAS TRES DECISIONES DEL FUNDADOR: ① el cliente final ve un 409 con copy oficial —«Esta factura se está registrando en Hacienda…»»*. Literal y fecha (30-jul) coinciden |
| `botFlow.service.ts:125` | **máster K1, `YAQU_MASTER.md:376`**: *«Copy oficial v2.1 (fundador, 5-jul-2026 tarde — tabla A8.1 completa aprobada en sesión; fuente exacta en `botFlow.service.ts`)»* |
| `tests/scrum294c:177` | **`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`** («Microcopy APROBADA por el fundador»): «Criterio de caja», «Sí, estoy acogido», «No estoy acogido» |
| `tests/scrum324:30` | **`docs/master/SCRUM-324.md:307`** (el literal) + **`:310`** *«Aprobada por el fundador»* |
| `tests/scrum379:64` | **Jira SCRUM-379, comentario `12499`**: *«**Microcopy firmada:** `Hecho. No hemos podido actualizar la pantalla: recárgala para ver cómo ha quedado.`»* — literal idéntico |
| `tests/scrum404:113` | **`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`**: «No hemos podido registrar la firma» |
| `tests/scrum428:121` | **`docs/master/SCRUM-428.md:195`**: *«Con el texto aprobado por el fundador (10-ago-2026)»*, y el literal en `:135` y `:202`. La fecha coincide |
| `tests/scrum581:138` | **`docs/master/SCRUM-581.md:351`**: *«## ✅ MICROCOPY APROBADA POR EL FUNDADOR (2-sep-2026)»*, con los literales debajo. La fecha coincide |
| `tests/scrum590b:140` | **`docs/master/SCRUM-590.md:658`**: *«**«Móvil (WhatsApp)»** — firmado por el fundador el 7-sep-2026»* |
| `tests/scrum593b:21` | **`docs/master/SCRUM-593.md:378`**: *«**Literal del fundador:** «…que salga como Añadir texto en el documento…»»* |

⚠️ **Dos matices que no se ocultan.** El comentario `12499` dice «Microcopy firmada» y **no dice
por quién**: acredita que el texto está firmado, no quién lo firmó. Y el máster dice «copy **v2.1**»
donde `botFlow.service.ts` dice «copy **v2**».

## 3 · Las 5 SIN RESPALDO

| afirmación | qué se buscó | qué se encontró |
|---|---|---|
| 🔴 `src/…/quotesAdmin.routes.ts:339` **(producción)** | «No la entregues todavía» · «La factura se creó pero no se pudo registrar», en `docs/` y en Jira (`comment ~` y `text ~`) | **nada, en ningún sitio.** El máster (SCRUM-206) recoge las tres decisiones del fundador sobre ese 409, y **el literal del mensaje al profesional no es ninguna de ellas** |
| 🔴 `src/…/parteDictado.ts:402` **(producción)** | «no completes marcas», en `docs/` y en Jira | **nada.** Sólo aparece en este mismo registro. Y la cabecera de su propia sección sigue diciendo «PROPUESTA, PENDIENTE DEL FUNDADOR» cuatro líneas más arriba del «✅ APROBADO» |
| 🔴 `tests/scrum244:44` | «Descargar todos mis datos» · «TUS DATOS», en `docs/` y en Jira | **0 en todo Jira.** El bloque dice «LOS OCHO TEXTOS APROBADOS POR EL FUNDADOR (4-ago-2026)» y esos ocho textos no constan en ninguna parte |
| 🔴 `tests/scrum257:26` | «no se puede crear un albarán» | está **en la descripción de SCRUM-257**, pero dentro de *«Alcance — (b) Guard»*, que es la propuesta de implementación. La sección **«Decisiones del fundador (2-ago-2026)»** enumera tres y **ninguna es ese microcopy**. El test dice «aprobado por el fundador en el ticket»: el ticket lo contiene, pero no dice eso |
| 🔴 `tests/scrum320:36` | «853,05» | está en SCRUM-320 marcado **`[MEDIDO]`**, como medición del defecto. Y la sección «Microcopy» del mismo ticket dice lo contrario de la afirmación: *«`QUÉ FALTA PARA COBRAR` y **cada una de las líneas** son microcopy **sin aprobar** (regla 30)»* |

**El patrón, y es el de SCRUM-315:** en tres de los cinco el ticket **sí existe y sí contiene el
texto** — lo que no contiene es la aprobación. Un `grep` del literal habría dado por respaldadas
las cinco. Lo que las separa es preguntar **quién aprobó**, no **dónde aparece**.

⛔ **No se ha tocado ninguna** (punto ③ del enunciado). Siguen las 27 y el trinquete sigue en 27.

## 4 · El falso positivo, declarado

`tests/scrum780:150` dice *«la rectificativa ha salido «…». Su letra R **NO** está firmada por el
fundador»*. Es una **negación**: no afirma una autorización, afirma que falta. El censo no
distingue el alcance de un «no», igual que ya quedó declarado para `scrum580:325`. Son **2 de 27**
(7 %), y **no se descuentan del trinquete**: quitarlas a mano lo convertiría en una opinión.

## 5 · Adelanto sobre las 11 bloqueadas (sin veredicto)

La sonda documental corrió también sobre ellas. **No es un veredicto** —falta saber qué cuenta
como firma del asesor—, pero ahorra la mitad del trabajo el día que se desbloqueen:

- **con literal en `docs/master/`**: `scrum358:179` (SCRUM-358, los tres literales del 409) ·
  `scrum575b:301` (SCRUM-575) · `metodoDeCobro.ts:82` («Método no registrado», SCRUM-285/441).
- **sin nada en `docs/`**: `scrum305:207` (los cinco textos) · `scrum469:109` (el aviso de
  desalojo). Esas dos son las candidatas serias a SIN RESPALDO cuando se decida.

## 6 · Lo que sigue abierto

1. **Qué cuenta de Jira es el fundador** — y ahora se sabe que **no se podrá resolver por el campo
   de autor**: el orquestador escribe sus comentarios con la cuenta de Javier. El mecanismo tendrá
   que apoyarse en **el id del comentario y su contenido**, nunca en quién lo firma.
2. **Las 2 de producción sin respaldo** (`quotesAdmin.routes.ts:339` y `parteDictado.ts:402`): son
   texto que ve el profesional y no consta que nadie lo aprobara. **No se tocan** — se firman o se
   corrigen, y las dos cosas las decide el fundador.
3. La extensión de SCRUM-387 sigue **propuesta y sin implementar**, como pedía el encargo.
