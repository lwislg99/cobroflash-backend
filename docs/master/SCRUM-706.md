# SCRUM-706 · el cable del dictado — la cadena de Tecnosel, OCHO DE OCHO

**Medido contra:** `origin/main` = `3047b2c9f98e44f2a69ac7dd1ab8f0997e6fb9d2` · 2026-09-03T14:05:00+02:00

---

## 0 · El rojo ANTES de tocar nada

La cadena estaba **verde**, y no porque el salto funcionara: porque estaba **declarado**.

```
node --test tests/scrum705-cadena-tecnosel.test.mjs   → 5/5, exit 0
   ↑ lo mantiene verde: MUERTOS_DECLARADOS, línea 210
```

Quitando esa declaración, el trinquete canta:

```
🔴 HAY PANTALLA PINTADA Y MUERTA EN LA CADENA:
    4 · dictar → nadie llama a `parteOrdenarDictado()`
                                                        exit 1
```

**Eso es lo que tenía que decir, y lo dijo.** El mecanismo no ocultaba el fallo: lo tenía anotado
con su motivo, que es la diferencia entre una deuda declarada y un fallo mudo.

---

## 1 · Lo que faltaba no era la función: era el `addEventListener`

`ordenarElDictado` estaba **escrita, probada y colgada de `window`** —que es como la alcanzaban sus
propios tests— y **entre el botón que se pinta y ella no había NADA**. Por eso la suite entera
pasaba y el técnico dictaba, pulsaba y no ocurría nada.

Es el mismo hueco que SCRUM-652 fase D cerró para firmar, así que se ata **en la misma función y con
la misma forma**: dentro de `renderParteDetailView`, que es la puerta que llama el enrutador.

> ⚠️ **El botón de confirmar se ata DESPUÉS de pintar la propuesta**, porque nace con ella. Atarlo
> antes sería atar algo que todavía no existe — y volveríamos a tener un botón pintado y muerto,
> que es justo el defecto que este ticket cierra.

**Lo que el técnico confirma entra en el parte, y nada más.** Las líneas se leen de los **campos**,
no de la propuesta: si se leyeran de la propuesta, corregir una cantidad no cambiaría nada y se
guardaría lo que dijo la máquina. Y se mandan **las que ya había MÁS las nuevas**, porque el `PATCH`
reemplaza la lista entera: enviar solo las nuevas le borraría en silencio lo que tenía apuntado.

---

## 2 · 🔴 Dos agujeros de mi propio trinquete, encontrados al cablear

Los dos son de la misma familia que el de ayer —**medir el nombre equivocado**— y ninguno habría
salido si no llego a cablear:

**① `ata` apuntaba al ALIAS.** Vigilaba `parteOrdenarDictado` (el nombre de `window`) y no
`ordenarElDictado`, que es la que atiende el botón. Cablée, y **el trinquete inverso no cantó**: la
declaración de «muerto» habría envejecido mintiendo. Se mide la función, no su escaparate.

**② Al corregirlo, la declaración quedó HUÉRFANA.** Su clave ya no correspondía a ningún `ata` de la
cadena, y el trinquete inverso solo recorre los saltos: **nadie la revisaba**. Una declaración así se
queda para siempre diciendo que algo está muerto cuando ni siquiera es algo que este recorrido
vigile. Guard nuevo: *«una declaración HUÉRFANA no puede esconderse»*.

`MUERTOS_DECLARADOS` **queda vacía**, y el mecanismo se queda: una lista vacía aquí no es un adorno,
es la afirmación de que hoy no hay ninguno.

---

## 3 · Verificación

**Commit de todo ANTES de inyectar el rojo: ver el informe** (verde, 4.976 · 4.892).

Los tests **no llaman a la función**: montan la pantalla, buscan el botón y **lo pulsan**.

| qué | resultado |
|---|---|
| pulsar «Ordenar en líneas» | llama a `POST /admin/partes/7/dictado`, una vez |
| **el botón sin `addEventListener`** | 🔴 *«EL BOTÓN DEL DICTADO ESTÁ PINTADO Y MUERTO: nadie le ha puesto un `addEventListener`»* |
| lo retirado | se pinta **una vez, en su línea**, con `Falta la cantidad — ponla tú` |
| **sin red** | el modelo falla → **no lanza** y el parte **sigue pintado** |
| ⛔ importes en la pantalla del técnico | **cero** (`€`, `precioUnitario`, `tipoIva`) |

### 🔴 Y la cadena NO cayó con este rojo — los dos guards son COMPLEMENTARIOS

Al quitar el `addEventListener`, `scrum705` **siguió verde**. No es un fallo: es lo que mide. Su
`estaAtado` pregunta *«¿se llama a esta función en algún sitio del código?»*, y una llamada dentro
de un `if (false)` **sigue siendo una llamada**. El código muerto la satisface.

| guard | qué mide | qué se le escapa |
|---|---|---|
| `scrum705` (cadena) | que la función esté **llamada** en el código | una llamada inalcanzable |
| `scrum683b`/706 (cable) | que **pulsar el botón** haga algo, ejecutándolo | solo cubre los saltos que monta |

Es la misma pareja que los dos detectores de dinero de SCRUM-652c: **uno mira el texto y el otro
ejecuta**, y ninguno sobra. Quien venga a retirar «el que sobra» destapa el hueco del otro.

**Y un fallo del doble, no del producto:** el primer intento del test de «lo retirado» dio 0 avisos
porque mi DOM falso no reflejaba el `innerHTML` del subnodo donde `pintarPropuesta` escribe. Se
arregló el doble; el producto no se tocó.

---

## 4 · Microcopy PROPUESTA, sin aprobar (regla 30)

| ranura | rótulo propuesto |
|---|---|
| `noSeGuardo` | `No se han podido guardar las líneas — vuelve a intentarlo` |

Voz pasiva y raya larga, como los seis ya firmados de esta pantalla. **Se pinta solo si el `PATCH`
falla**, y entonces la propuesta **no se repinta como si se hubiera guardado**: el técnico creería
que ya está apuntado y no lo está.

Va con el marcador ya factorizado del fichero, así que el censo de SCRUM-402 no se mueve.

---

## 5 · El recorrido

**La cadena de Tecnosel está OCHO DE OCHO.**

Con este cable, el último salto roto de los ocho queda cerrado: crear trabajo → asignar a varios →
abrir el parte → **dictar** → firmar → aparecer en «por valorar» → poner precios → verlos guardados.
