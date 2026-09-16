# SCRUM-549 · el guard vigilaba lo marcado — y al marcar el bloque de contacto apareció que YA se publica

**Medido contra:** `origin/main` = `a5170bea899693ba96243e7434b5995c2dc1949b` · 2026-08-20T09:32:49+01:00

**20-ago-2026** · **Carril:** B (landing) · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** el mecanismo del bloque F vigila que **lo marcado** no se publique. Nadie vigilaba
que **todo lo publicable** estuviera marcado — y lo que se le olvida a alguien marcar se publica
sin que ningún guard diga nada.

---

## ① 🔴 El hallazgo es peor de lo que decía la ficha: no es que «se habría publicado». **Se publica.**

La ficha decía que el titular del bloque de contacto (F7-1) *se habría publicado sin aprobar* y que
lo cazó un extractor por casualidad. **Al ponerle el marcador que le faltaba, aparece lo que estaba
tapado.** Medido **en el navegador** (Edge, 390 px), no leyendo el código:

```
contacto-publico   hidden=false   display:block   VISIBLE
   texto: «¿Tienes una duda antes de empezar? Escríbenos por correo»
```

Frente a las otras tres, que sí están donde deben:

```
heroe-f4  hidden=true  display:none    gremios  hidden=true  display:none
comparativa  hidden=true  display:none
```

**Están publicados hoy F7-1 y F7-4** —dos de los 51 textos pendientes de aprobación— y el enlace
`mailto:hola@yaqu.app`.

**La causa, medida:** el comentario del HTML dice que sin `data-whatsapp` el bloque *«no aparece»*.
**No es lo que hace el código.** `public/js/contacto-publico.js:68-71` desoculta en cuanto hay **UN**
canal configurado —`if (!pintados) return; … caja.hidden = false`— y `data-email` trae
`hola@yaqu.app`, que cuenta como canal. Está igual en `origin/main` desde que SCRUM-334 entró hoy.

> 🔴 **Y explica por qué ningún guard lo vio:** los de F4, F5 y F6 leen **el fuente**, y el fuente
> dice `hidden`. Quien decide es el **DOM**. Es la lección de SCRUM-515 repitiéndose en otra
> pantalla.

## ② El mecanismo, y la regla es DERIVADA

Se censa **todo elemento con el atributo `hidden`** en la landing —no una lista de las cuatro
secciones— y se le exige una de las dos explicaciones que se derivan del propio fichero:

| | condición | qué significa |
|---|---|---|
| ① | lleva marcador (`data-microcopy` / `data-propuesta`) **y ningún script lo desoculta** | espera aprobación, y está protegido |
| ② | no lleva marcador **y un script lo desoculta** | copy ya aprobado que se enseña cuando hay dato |

Lo que no encaja en ninguna es el hallazgo. **La invariante que lo sostiene todo:** *marcado ⇒
ningún script puede desocultarlo*, porque desocultarlo es publicar copy sin aprobar.

**El censo de hoy — 6 elementos:**

| elemento | marcado | ¿lo desoculta un script? | clase |
|---|---|---|---|
| `announce` | no | sí | oculto-por-dato |
| `founding-banner` | no | sí | oculto-por-dato |
| `heroe-f4` | sí | no | marcado-y-oculto |
| `gremios` | sí | no | marcado-y-oculto |
| `comparativa` | sí | no | marcado-y-oculto |
| **`contacto-publico`** | **sí** (puesto aquí) | **sí** | 🔴 **MARCADO-PERO-SE-PUBLICA** |

**Antes de marcarlo, `contacto-publico` salía como `oculto-por-dato`: idéntico a los legítimos.**
Ése era el escondite — y por eso marcarlo no es cosmética, es lo que hace visible el defecto.

## ③ La trampa que la ficha avisó, hecha mecanismo

🔴 **El censo NO busca la cadena «PROPUESTA» en el texto, y hay un test que lo impide.** El propio
F5-1 dice «PROPUESTA · La diferencia» **dentro del copy**: un guard que la buscara daría rojo
permanente sobre un texto legítimo, o alguien la excluiría y con ella excluiría a las de verdad. Se
mira la **estructura** (el atributo), no el vocabulario.

## ④ Cuarentena declarada, con tope 1

`contacto-publico` queda declarado con su **ticket**, su **motivo** y su **dueño**. No es una
excepción muda: hay un test que exige que **siga siendo una infracción** — el día que se arregle, la
entrada sobra y el test lo dice, en vez de quedarse ahí para siempre.

**Lo decide el fundador (alcance 4), y son dos caminos:** vaciar `data-email` hasta que el canal
esté decidido, o aprobar los textos de F7. **Ninguno lo elige una sesión.** *(Y no es solo estética:
un correo en una página pública se recolecta, y hay que decidir quién lo lee — la misma pregunta
que el WhatsApp de SCRUM-334.)*

## ⑤ La propuesta de F5-1 — se propone, no se publica

El texto de F5-1 es **«PROPUESTA · La diferencia»**. La propuesta es quitarle el prefijo:

> **PROPUESTA · La diferencia** → **La diferencia**

**No se aplica aquí** (regla 30: la línea la fija el fundador, aunque quitar un marcador colado no
sea redactar). Entra en el documento de aprobación cuando se desbloquee — ver ⑦.

## ⑥ Verificación

* **9 tests, sin gate.**
* **SUELO** — sin elementos ocultos, el censo **lanza** declarándose ciego. La landing tiene seis:
  un cero significa que el detector dejó de reconocerlos.
* **✅ CONTROL POSITIVO** — los dos bloques que se ocultan **por dato** no se acusan, y el copy
  publicado sin `hidden` **ni entra en el censo**. Sin esto, «vigila lo nuevo» y «se queja de todo»
  dan el mismo rojo, y un guard que exige marcar copy ya aprobado acaba desactivado.
* **AUTOPRUEBA** — un bloque nuevo, oculto y sin marcar, sí se ve y se clasifica como tal.
* **Atributos en cualquier orden** (SCRUM-553) — cuatro formas distintas de escribir el `hidden`, y
  un control negativo: la palabra «hidden» dentro del valor de otro atributo **no** cuenta.

### 🔴 Los tres rojos, con su SHA — y uno es un hueco que se declara

Con la rama **ya commiteada** en `cf73d9ae` y el árbol limpio:

| inyección | resultado |
|---|---|
| **A** · sección nueva, oculta y **sin marcar** | 🔴 **cae nombrándola**: `aviso-nuevo (línea 746): OCULTO-SIN-MARCAR-Y-SIN-QUIEN-LO-ENSENE` |
| **B** · texto nuevo **dentro** de una sección marcada | 🟢 verde — **y es correcto**: el marcador es de sección, así que ese texto está cubierto |
| **C** · texto nuevo **publicado directamente**, fuera de todo bloque oculto | 🟢 verde — 🔴 **HUECO DECLARADO** |

**El hueco C, y la ficha pedía medirlo:** *«hay que medir cómo se sabe hoy [distinguir el copy nuevo
del aprobado], si es que se sabe»*. **Medido: hoy no se sabe.** No hay ninguna señal en el fichero
que distinga copy publicado y aprobado de copy publicado y nuevo — el único signo que existe es
nacer `hidden` + marcado. Por eso este guard cubre **todo lo que nace oculto** y **no puede** cubrir
lo que alguien añada ya visible, salvo marcando el HTML entero, que la propia ficha prohíbe porque
se convierte en ruido y acaba desactivado. Queda escrito para que el siguiente no lo descubra por
sorpresa.

## ⑦ 🛑 Lo que NO se ha hecho, y por qué

**Las cuatro sustituciones aprobadas del 20-ago no se han aplicado. La aprobación no se ha
registrado.** Los cuatro textos «antes» que cita la aprobación **no son los del documento**:

| | texto citado como «antes» | qué hay medido |
|---|---|---|
| F4-3 | «lo firma **con el dedo**» | F4-3 dice *«lo firma **desde el móvil**»* — **ya dice lo que pide el cambio**. «con el dedo» existe una sola vez en el fichero, en `public/index.html:559`, dentro de «Cómo funciona»: **copy publicado y aprobado, fuera del bloque F** |
| F5-8 | «Firma con el dedo en el móvil y queda guardada con fecha y hora.» | F5-8 dice *«Tu palabra contra la suya.»* · **0 commits** en toda la historia del repo contienen esa frase |
| F5-11 | «Un presupuesto con tus conceptos y tu logo, igual siempre.» | F5-11 dice *«O llamas tú, o no llama nadie.»* · **0 commits** en toda la historia |
| F6-1 | «Tu oficio, tu forma de cobrar» | F6-1 dice *«Tu oficio»* · **0 commits** en toda la historia |

**Tres de los cuatro textos no han existido nunca en este repositorio** (`git log --all -S`, cero
commits). El cuarto existe, pero es **copy ya publicado y aprobado fuera del bloque F**, y el F4-3
real ya está en el estado que el cambio pide.

**Por eso se para, y no se improvisa:**

* aplicar la de F4-3 significaría **editar copy publicado y aprobado** (`:559`), que es cambiar el
  máster (A22 + regla 30) y nadie lo ha pedido;
* las otras tres significarían **inventar la frase** sobre la que se sustituye;
* y los tres avisos de redacción («propón la variante mínima») **no se pueden contestar**: no se
  puede proponer el mínimo cambio de una frase que no se ve;
* **«el resto perfe y aprobado» tampoco se puede registrar**: sin saber cuáles son los cuatro que
  cambian, no se sabe cuáles son los 47 que se aprueban. Marcar 47 como aprobados adivinando cuáles
  es exactamente lo que un registro de aprobación no puede hacer.

**Lo que hace falta para desbloquearlo:** contra qué documento se hizo la aprobación. Si hay una
versión con otra numeración u otros textos, se compara y se aplica; si los identificadores son los
de `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md`, hacen falta los cuatro cambios expresados sobre los
textos que ese documento sí tiene. **Ni un `data-microcopy` retirado hasta entonces.**

*(Y una observación de vocabulario que se anota y no se corrige, del aviso 3: en el producto
«Trabajo» con mayúscula es una entidad; en «tu trabajo» sería lenguaje natural. Roce, no error.)*

## ⑧ Ficheros

`scripts/_censo-microcopy-sin-marcar.mjs` (nuevo) · `tests/scrum549-nada-publicable-sin-marcar.test.mjs`
(nuevo, 9) · `public/index.html` (**solo** el marcador que le faltaba a `#contacto-publico`, con el
mismo valor que ya usan `#heroe-f4` y `#gremios` — sin inventar vocabulario).

**Lo que NO se toca:** ni un `hidden`, ni un `data-propuesta`, ni una palabra de copy ·
`scripts/guard-a11y-comparativa.mjs` (lo lleva S2, SCRUM-550) · los textos nuevos de F6-8, F6-16 y
F4-3 (SCRUM-551) · `package.json` — este ticket **no declara ningún script nuevo**, así que no
entra en el conflicto de SCRUM-548.

Guards de publicación, verdes y sin tocar: F4+F6+F5+F7 → **38/38**.

## ⑨ Tanda

**3.774 tests · 3.697 pass · 0 fail · 77 skipped.**
