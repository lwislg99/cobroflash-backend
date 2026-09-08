# SCRUM-701 · El sellado de estáticos ve las dos comillas y no cuenta lo comentado

**Medido contra:** `origin/main` = `2d826de6d18f7a76be0ef2509c2e469e7b383f54` · 2026-09-04T11:35:11+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-701-sellar-referencias-por-ast`

## PASO 0 (regla 39) — el defecto existe, pero hoy no rompe nada

**No estaba arreglado:** `git log -S` sobre el mecanismo devuelve **un solo commit**, el que lo creó
(SCRUM-274), y el mismo comando con otra aguja devuelve resultados, así que el vacío no era del
comando.

**Y es real:** la regex de producción era `/\b(src|href)\s*=\s*"([^"]*)"/gi` — sólo comillas dobles,
y sin saltar comentarios.

**Pero el alcance de hoy es CERO, y eso cambia la urgencia, no la decisión.** `sellarReferencias`
tiene **un solo sitio de llamada en producción** (`src/app.ts:225`) y sella **un solo documento**:
`public/dashboard/index.html`. Ahí hay **85 referencias, todas con comillas dobles y ninguna
comentada** — con **52 comentarios** en el fichero, así que ese cero es una medición y no una
ceguera.

Las comillas simples **sí existen en el HTML de la casa**: 2 casos, en `login.html` y
`register.html`. Esos ficheros no pasan por el sellado, así que la divergencia es **cuestión de
tiempo, no de laboratorio**: el día que alguien escriba `href='./js/x.js'` en el dashboard, ese
fichero se queda sin huella y sin `immutable`, y se vuelve a bajar en cada despliegue.

**Regla 38: NO aplica.** Esto es el servido de estáticos del dashboard, no el camino de emisión
fiscal. Se puede modificar sin GO.

## La lista de formas sale del árbol, no de mi cabeza

Es el punto débil que declaré ayer —un vocabulario cerrado a mano se queda corto— y aquí se evitó
midiendo: sobre los **9 HTML de `public/`** aparecen **163 con comillas dobles, 2 con simples y 0 sin
comillas**. Se reconocen las tres.

## El arreglo

**Un solo sitio decide qué es una referencia.** `hallazgosDeReferencia` lo usan tanto `referenciasDe`
(el guard) como `sellarReferencias` (producción): dos regex para el mismo hecho se separan el día que
alguien arregla una sola, y ese día el guard aprueba lo que producción sella mal.

Reconoce las tres formas de comilla, **conserva la que venía** —normalizarla sería reescribir el HTML
por gusto, y con un valor que llevara `"` dentro rompería la etiqueta— y **salta los comentarios**
recorriendo el documento entero, sin ventanas. Un `<!--` sin cerrar comenta hasta el final, como hace
el navegador.

## Verificación

- **🔴 Los dos casos, corridos:** una referencia con comillas simples que ahora **sí** se sella, y una
  etiqueta comentada que ahora **no** se toca ni se cuenta.
- **🔴 Y cae con el mecanismo viejo:** los dos casos se pasan por la regex de antes y hacen justo lo
  contrario. Un caso que pasara con los dos mecanismos no probaría ninguno.
- **✅ CONTROL POSITIVO, el más fuerte que había:** el documento **real** se sella **byte a byte igual
  que antes**. En `dashboard/index.html` no hay comillas simples ni comentarios con etiquetas, así que
  el arreglo no puede cambiar ni un byte de su salida — si cambiara, se habría perdido o ganado una
  referencia por el camino. Y enumerado: **ninguna** referencia local se queda sin huella.
- **SUELO:** si el extractor devolviera menos de 80 referencias, comparar dos cadenas sin sellar daría
  verde; se declara ciego en vez de aprobar.
