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
