# SCRUM-821 · La lista que decide qué se mira era la única que nadie miraba

**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T19:09:57+02:00
**Rama:** `scrum-821-la-lista-que-decide-que-se-mira`

---

## 1 · Lo medido, antes de tocar nada

| | |
|---|---|
| el menú **OFRECE** | **17** pantallas |
| el barrido **FOTOGRAFÍA** | **12** (once del menú + `quotes-new`) |
| **sin fotografiar** | `jobs` · `albaranes` · `partes-oficina` · `cobros` · `libro-registro` · `plans` |

Son **la cadena Tecnosel entera** —trabajo, albarán, parte por valorar, cobro, libro de registro—:
el recorrido del único usuario real que tiene el producto.

🔴 **Y eso explica SCRUM-720**, que costó un día entero: la pantalla del parte llegó a producción
sin CSS y con 26 marcadores a la vista **con el recorrido diciendo 8/8**. Con seis pantallas fuera
del barrido, ese 8/8 no podía haber sido otra cosa.

### ⚠️ Y no eran seis: eran OCHO

`AUTH_VIEWS` se comparó también contra `HASH_VIEWS` —la lista que ya tiene cinco ficheros de tests
vigilándola— y aparecieron **dos más que el hallazgo no nombraba: `export` y `templates`**.

## 2 · El arreglo: derivar, no mantener

`AUTH_VIEWS` era **la cuarta lista mantenida a mano del árbol, y la que decide qué se mira**.
`HASH_VIEWS` tiene cinco guards; ésta tenía **cero**.

Ahora `capture-demo.mjs` **deriva** su lista de `HASH_VIEWS` (`scripts/_vistas-del-barrido.mjs`):

```
fotografía: 12 → 20     ·     pantallas del menú sin foto: 6 → 0
```

Los nombres de fichero también salen derivados (`01-home`, `02-cobros`, …): ni la lista ni la
numeración se mantienen a mano. **Nadie dependía de los nombres viejos** — comprobado: la única
mención estaba en el propio `capture-demo.mjs`.

⛔ `HASH_VIEWS` y sus cinco tests **no se tocan**: funcionan, y son el ejemplo que se copia.

## 3 · El guard · CONJUNTOS, no cuentas

`tests/scrum821-…` compara las dos poblaciones **por identidad**, que es la lección de SCRUM-727:
doce y doce puede ser doce aciertos o seis y seis. Se prueba con poblaciones inventadas **del mismo
tamaño** para que sólo pueda pasar comparando nombres.

| control | resultado |
|---|---|
| 🔴 **el rojo del mecanismo viejo** | con la lista a mano, el cotejo nombra **exactamente las seis**. Fijado como test con la lista vieja **como dato**: un guard que ya no puede ponerse rojo ante su propio caso es un comentario |
| ✅ **positivo enumerado** | las **17** una a una, más las seis y las dos nombradas por su nombre |
| ✅ **el contrapeso** | el barrido no visita nada que no sea navegable — si no, «no falta ninguna» se conseguiría fotografiando de más |
| ✅ **negativo** | quitando `partes-oficina` el cotejo cae **nombrándola**; quitando dos, salen **las dos** |
| ✅ **SUELO** | menos de 17 destinos y se declara ciego. Los suelos **lanzan**, y se prueba que lanzan |

## 4 · 🔴 El segundo agujero, que apareció al intentar el control por hash

El encargo pedía comprobar que **las que ya se fotografiaban salen igual, comparando por hash**.
Al medirlo apareció otra cosa:

**De las 12 antiguas, sólo 7 son DETERMINISTAS.** Capturadas tres veces cada una, con página
fresca y el mismo servidor:

```
✅ deterministas (7)   customers · invoices · reports · expenses · providers · team · settings
🔴 NO deterministas (5) home · quotes-new · quotes-list · products · quote-requests
```

Las cinco dan **hashes distintos entre capturas idénticas de sí mismas**. Y la primera vez que lo
medí saqué dos culpables distintos (`products` y `reports`), lo que me hizo mirar el instrumento
en vez de creerme el resultado: **la diferencia no venía del cambio, venía de la vista**.

> 🔒 **El barrido visual produce imágenes que nadie puede comparar.** No sólo faltaban ocho
> pantallas: de las que sí se fotografiaban, cinco no se pueden diferenciar de sí mismas. Un
> diff de capturas las marcaría en rojo cada vez, y en dos semanas nadie miraría el diff.

Las 7 deterministas salen **byte a byte idénticas** antes y después: derivar la lista cambia
**qué** se fotografía, nunca **cómo** se pinta. Y de las 8 nuevas, siete pintan contenido; `plans`
sale con 2 nodos en el banco local por falta de datos de plan — **eso es lo que `HUECOS_DECLARADOS`
existe para recoger** el día que se confirme contra el despliegue real.

**No se arregla aquí**: la no-determinación de esas cinco vistas es otro ticket. Se declara, que es
la mitad del encargo — *un hueco declarado se ve; uno callado no*.

## 5 · Los huecos, declarados en vez de callados

`HUECOS_DECLARADOS` nace **vacío y a propósito**. Si mañana una pantalla no se puede barrer, va ahí
con su razón y el guard la cuenta como conocida en vez de enrojecer. Y hay control de las dos
direcciones: un hueco declarado **no** enrojece —si no, nadie declararía ninguno— y un hueco que
**ya no lo es** se nombra, para que la declaración no se pudra.

## ⛔ No tocado

`HASH_VIEWS` ni sus cinco tests · ningún rótulo · `prisma/schema.prisma` · el camino de emisión ·
las cinco vistas no deterministas (se declaran, no se arreglan aquí).
