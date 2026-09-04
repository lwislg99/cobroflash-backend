# SCRUM-705 · la cadena de Tecnosel, recorrida como MECANISMO

**Medido contra:** `origin/main` = `4e9e114d1620386c76982efbc4eeae1e9d55fc06` · 2026-09-03T13:20:39+02:00

---

## 0 · PASO 0, y el barrido de LA COSA

```
árbol → docs/EVIDENCIAS_E2E.md · scripts/e2e-critico.mjs
        tests/scrum173-cadena-verifactu-serializada · scrum324-cadena-hasta-el-libro
        tests/scrum183-consola-e2e                                        [exit 0]
ramas → tres aciertos, TODOS falsos: son shas que empiezan por «e2e»
```

**Existen cadenas, y ninguna es ésta:**

| qué | qué encadena | ¿es la de Tecnosel? |
|---|---|---|
| `scrum324-cadena-hasta-el-libro` | gasto → se guarda → **aparece en el libro** | no, y usa base desechable |
| `scrum173-cadena-verifactu-serializada` | el encadenado fiscal | no |
| `scripts/e2e-critico.mjs` | registro → presupuesto → firma → pago → PDF | la del **dinero**, y **es un script fuera de `npm test`** |
| `tecnosel-precios-tras-firmar` | un solo eslabón (el permiso por campo), a fondo | no es una cadena |

Mi primer barrido dio «5 eslabones» en `scrum402` — **falso positivo**: es un censo que **nombra**
todos los ficheros. Medir menciones no es medir encadenado.

**No es la decimotercera.**

---

## 1 · Lo que vigila, y no es «que los ficheros existan»

```
crear trabajo → asignar a varios → abrir el parte → dictar → firmar
  → aparecer en «por valorar» → poner precios → verlos guardados
```

Ocho saltos, **sin base de datos**, y el rojo **nombra el salto**. El fallo que lo motiva es
**PINTADO Y MUERTO**: una pantalla que se dibuja entera, con su botón, y **nadie escucha ese
botón**. Todo lo demás pasa —el módulo existe, exporta, se registra en el índice y se precachea— y
el profesional pulsa y no ocurre nada.

Por eso cada eslabón de pantalla declara **tres** cosas —y son preguntas distintas, cosa que este
fichero aprendió a golpes; el detalle está en §2(b)—: el gancho que **pinta**, la **puerta** pública
que llama el enrutador, y la función que **ata** ese gancho.

---

## 2 · 🔴 Los hallazgos — CORREGIDOS, y tres de los cuatro eran MÍOS y falsos

> ⚠️ **Esta sección decía otra cosa.** La primera versión declaró cuatro pantallas «pintadas y
> muertas», entre ellas la puerta del parte. **Tres eran falsas, y la culpa era de mi detector.**
> Se deja escrito el camino porque vale más que el resultado.

### (a) La alarma del salto 3 se disuelve: la puerta ESTÁ

Medido en `origin/main` con límite de palabra y control positivo:

```
git grep -nE '\brenderParteDetailView\b' origin/main
  app.js:354-355          ← el enrutador la llama
  parteDetailView.js:435  ← la define      :467 ← la publica          5 coincidencias
CONTROL POSITIVO renderAlbaranDetailView → 5 coincidencias

git log -S'renderParteDetailView' origin/main
  107846d3 · 2-sep · SCRUM-652 (fase D)   padre: 0 → 5   ← ENTRÓ AQUÍ
  f88e6c85 · su entrada de máster          padre: 5 → 5   ← no la quita, la nombra
```

**Entró y nunca se quitó. Ningún merge se ha comido nada.** Mi medición fue **anterior** a que la
PR 942 llegara a mi árbol.

### (b) Y mi detector medía mal, que es el hallazgo de verdad

Preguntaba *«¿alguien llama a esta función desde FUERA del módulo?»*. Pero **un módulo bien hecho
tiene UNA puerta pública y ata sus botones POR DENTRO**: `app.js` llama a `renderParteDetailView`,
y ésa ata el botón a `firmarParte` en el mismo fichero. Con mi medida los dos salían muertos.

Peor: cuando la puerta **ya estaba** en mi árbol, mi trinquete **siguió en verde** porque
`renderParte` seguía sin llamador externo. **Verde por el motivo equivocado**, que es el peor.

Ahora cada salto declara **tres** cosas y son preguntas distintas:

| clave | qué pregunta | qué pasa si falta |
|---|---|---|
| `pinta` | el gancho que dibuja | mide un fantasma |
| `puerta` | la función PÚBLICA que llama el enrutador | la pantalla no se abre nunca |
| `ata` | la función que atiende el gancho, llamada en algún sitio (**dentro vale**) | botón muerto |

### Lo que queda, tras remedir

| salto | estado |
|---|---|
| 3 · abrir el parte | ✅ **vivo** — `renderParteDetailView`, SCRUM-652 fase D |
| 5 · firmar | ✅ **vivo** — lo ata `renderParteDetailView` por dentro |
| **4 · dictar** | 🔴 **muerto de verdad**: el botón se pinta (`parteDetailView.js:240`) y `parteOrdenarDictado` **no se llama en ninguna parte**, ni dentro ni fuera. **MÍO**, SCRUM-683 |

Y `pintarRevisiones` (SCRUM-655 fase C, mío) sigue sin puerta, como se dijo al entregarlo: su
pantalla no es un salto de esta cadena y no entra en el trinquete.

> 🔴 **La colisión de prefijo, tercera del día**: `window.renderParte` casa **dentro** de
> `window.renderPartesOficinaView`. Me dio primero un falso «tiene llamador» y después un falso
> «está muerto». Todo el detector usa ya `\b` — un prefijo no es un nombre, y en un producto los
> nombres parecidos son los relacionados, o sea los que más se cruzan.

## 3 · Verificación — tres rojos, y uno que NO cayó a la primera

**Commit de todo ANTES de inyectar: `cb45b1efc66e73526fddb67e82e2834ee71c1d3b`** (verde, 4.914 · 4.830).

| rojo | resultado |
|---|---|
| **pintado y muerto**: se le quita a «por valorar» su único llamador | 🔴 exit 1 — *«6 · aparecer en “por valorar” → nadie llama a `renderPartesOficinaView()`»* |
| **quitar la PUERTA** de la pantalla del parte (la llamada de `app.js`) | 🔴 exit 1 — *«3 · abrir el parte: nadie llama a `renderParteDetailView()`… La pantalla no tiene puerta»* |
| **quitar la puerta**: se comenta `mountAdmin(app, '/admin/partes')` | ⚠️ **NO CAYÓ** a la primera |

### 🔴 Y el segundo rojo es el hallazgo más útil del ticket, contra mi propio test

Comentar el montaje **dejó el texto en el fichero**, y mi comprobación leía el fuente **crudo**: dio
la ruta por montada. El instrumento decía medir «la ruta está montada» y medía «el texto aparece».

Es exactamente la trampa que ha mordido cuatro veces estos dos días, y esta vez me mordió a mí
**dentro del test que vengo a escribir contra ella**. Arreglado: **ocho** comprobaciones pasan a
leer el CÓDIGO con `soloCodigo` (SCRUM-693). Reinyectado, ahora cae:

```
🔴 LA CADENA DE TECNOSEL ESTÁ ROTA EN:
    3 · abrir el parte → `/admin/partes` no está montado
```

**Y cae con el mecanismo viejo**: hoy, con el botón «Ordenar en líneas» **pintado y sin nadie que lo
atienda**, la suite entera está en verde. Eso es lo que aprueba el mecanismo de ayer, y es
exactamente el defecto que este recorrido viene a impedir.

⚠️ Esta frase decía otra cosa —que la pantalla del parte era inalcanzable— y **era falsa**: ver
§2(a). Se corrige en vez de borrarse, porque el error importa más que la conclusión.

**Suelo:** si no se recorre ni un salto, se declara ciego — ocho saltos y cero recorridos es un
instrumento roto, no una cadena rota. **Control positivo del detector**: `openSignaturePad` es un
cable vivo y no se cuenta como muerto; un nombre inventado no encuentra llamadores.

---

## 4 · Lo que NO se tocó

Los ficheros de las dos firmas (sesión 3) · el recorrido a mano (sesión 4) · `apiRequest`
(sesión 1) · `prisma/schema.prisma`. **Ningún eslabón roto se ha arreglado**: el test los nombra y
el reparto es del fundador.

⚠️ `jobs.tipo_intervencion` **no está aplicada a las bases**, y ningún salto de este recorrido
depende de esa columna: no hay nada que declarar como «falta el ALTER».


---

# El máster apuntaba al arma cargada · procedimiento único contra producción

**Medido contra:** `origin/main` = `2c161c38cfba4ad81479dd302a933412d496f58c` · 2026-09-04T12:55:17+02:00
**Rama:** `scrum-705-procedimiento-unico`

## PASO 0 (regla 39) · la contradicción seguía viva

`main` se movió desde la medición anterior. Recomprobados los cuatro sitios: **intactos, nadie los
había corregido.**

El máster decía, literal (`docs/YAQU_MASTER.md:240`):

> «Prisma sin TTY: `db push` (**procedimiento canónico** `scripts/db-push-prod` —
> host-check→preview→GO→push→documentar, SCRUM-40), nunca `migrate dev`»

Y el propio script decía lo contrario (`scripts/db-push-prod:10`):

> «🔴 `db push` **NO ES EL MÉTODO DE ESTA CASA** CONTRA PRODUCCIÓN (SCRUM-685)»

Por **regla 35** el máster es la fuente de verdad. Así que la fuente de verdad apuntaba al arma
cargada: ese script, desde un checkout **1.933 commits por detrás**, propuso `DROP TABLE
job_assignees`, `DROP TABLE email_messages` y ~30 columnas **de producción**. Lo pararon el GO
explícito y que la shell no tenía `stdin` — **la segunda fue suerte**.

## Los cuatro sitios, corregidos

| Sitio | Antes | Ahora |
|---|---|---|
| `docs/YAQU_MASTER.md:240` | «procedimiento canónico `scripts/db-push-prod`» | «**NUNCA `db push` contra PRODUCCIÓN**… el procedimiento ÚNICO es ①→②→③, nunca ③ sin ②» |
| `docs/MIGRATIONS_PENDING.md:66` | «**Procedimiento canónico (SCRUM-40):** `bash scripts/db-push-prod`» | el procedimiento entero, con sus reglas y el caso fechado |
| `docs/QA/SUITE_REGRESION.md:791` | «Prod va aparte: su propio preview y su propio GO (`bash scripts/db-push-prod`)» | «Prod va aparte, y **NO con `db push`**» + el ①②③ |
| `docs/FLUJO_DE_TRABAJO.md:85` | sólo hablaba de staging | entrada propia para **producción**: nunca `db push`, y dónde está el procedimiento |

En los cuatro, `scripts/db-push-prod` queda declarado para lo que sí sirve: **staging y
diagnosticar deriva**.

## El procedimiento único, escrito

```
① decisión
② ALTER ADITIVO en las TRES bases:  dev → staging → producción
③ UN SOLO PR con esquema + código + tests

NUNCA ③ sin ②.
```

Con las cuatro reglas que van pegadas —y un guard que exige que las cuatro estén escritas—:

* **Nunca `db push` contra producción** — reconcilia el esquema *entero*, y producción puede ir por
  delante de `main` en columnas aplicadas a mano: propondría tirarlas.
* **El DDL sale de `prisma migrate diff`**, nunca a mano ni adivinando el tipo. `schemaDrift`
  comprueba que la columna **existe**, no de qué tipo es: un `TEXT` donde tocaba `JSONB` arranca
  verde y se pudre semanas.
* **La verificación lleva dos controles DE TIPOS DISTINTOS más `current_database()`.** «He usado
  dos variables» no prueba que sean dos bases: un catálogo que devolviera `text` para todo daría
  los números correctos.
* **Mergear no es acabar:** un ticket no está cerrado hasta que su despliegue está verde.

Y una quinta, la que salió de SCRUM-716:

* **La verificación distingue «no medido» de «cero».** Un `0` sin control positivo al lado no dice
  «la columna no está»: dice que no se ha podido comprobar. Ese mismo defecto vivía dentro del
  vigilante de despliegue, que decía «al día» sin haber resuelto `main` — y salía **verde**.

## El guard, y las dos veces que se cazó a sí mismo

**El rojo:** si un documento vivo vuelve a prescribir `db-push-prod` como procedimiento, cae
nombrando fichero y línea.

**Control positivo:** se le da la frase original del máster y tiene que cazarla. Sin eso, el verde
no dice «la documentación está bien»: dice «no sé buscar».

🔴 **Y ahí falló dos veces, las dos por autorreferencia:**

1. La primera versión miraba una vecindad de ±3 líneas y **descontaba si aparecía un «nunca»**
   cerca. La frase original del máster **termina** en «nunca `migrate dev`» → el descuento apagaba
   justo el único ejemplo que tenía. Un detector que se desactiva solo en su propio caso no vigila.
2. La segunda exigía la coincidencia **en la misma línea**. Pero `YAQU_MASTER.md:240` es **una sola
   línea de más de mil caracteres**: el texto **ya corregido** salía rojo, porque dice «el
   procedimiento ÚNICO es ①→②→③» en un extremo y «`scripts/db-push-prod` queda para STAGING» en
   el otro.

**El arreglo: se mide la DISTANCIA.** Una prescripción es una *frase*, no una coincidencia: la
palabra que prescribe tiene que estar **pegada** al nombre del script —«procedimiento canónico
`scripts/db-push-prod`», 22 caracteres— y no a cien.

### Control negativo, enumerado

| Documento | Por qué no sale rojo |
|---|---|
| `docs/master/SCRUM-480.md` | registro por ticket, fechado y cerrado (SCRUM-273) |
| `docs/master/SCRUM-685.md` | ídem: cuenta el incidente, era cierto al escribirse |
| `docs/historico/prisma-migrations-frozen-2026-03/README.md` | archivo explícito, con la fecha en el nombre |
| `docs/MIGRATIONS_PENDING.md:1383` | **narración fechada dentro de un documento VIVO** — entrada de SCRUM-102, aplicado en prod el 2026-07-23 |

Los tres primeros van por ruta. **El cuarto no podía ir por ruta**: está dentro del documento que
más hay que vigilar, así que se declara **línea a línea, con su motivo, en una allowlist visible**.
Una excepción por fichero entero habría dejado pasar también las prescripciones **nuevas** de ese
fichero, que es justo lo que hay que cazar.

Y el control negativo no se limita a comprobar que no salen: exige que **el barrido SÍ los vea**.
Si no los encuentra, no está demostrando que los perdona — está demostrando que no los mira.

**Suelo:** si el barrido ve menos de 100 documentos, o si ninguno nombra el script, falla
declarándose ciego. Son 447.

## ⛔ No tocado

`scripts/db-push-prod` · producción · ninguna base · el `continue-on-error` de los dos vigías ·
`prisma/schema.prisma` · la rama `scrum-653-dos-firmas`, que sigue bloqueada esperando el ALTER.
