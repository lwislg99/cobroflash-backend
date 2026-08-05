# SCRUM-317 · G2: el Trabajo se llama por su nombre

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `5ae48e836ec439d6c7d1bccd9ebe0836c9a2e141` · 2026-08-05T10:18:38+02:00

## El defecto, y por qué no era de rótulo

El detalle del Trabajo se titulaba `Presupuesto #2 · Francisco Jiménez`: **el objeto central del
producto presentándose como una fase del presupuesto**. No es cosmética — es la tesis del
producto contradicha en la primera línea de su propia pantalla.

## Lo que hizo barato este ticket fue medirlo antes (G0)

`Job.titulo` **ya existía** y se autogeneraba en `job.service.ts:58`; **ninguna ruta lo
escribía**. O sea que G2 no necesitaba schema —el único freno duro del proyecto— sino **dejar de
autogenerar y abrir la escritura**. El ticket lo daba como `[SUPUESTO]` y G0 lo convirtió en dato.

## Los seis puntos

1. **El Trabajo ya no nace con título** (`job.service.ts`): se quita la autogeneración.
2. **El `PATCH /admin/jobs/:id` acepta `titulo`** (`jobs.routes.ts`), normalizando vacío a `null`.
3. **El título es el CLIENTE** (`h2`), que es el único dato que no puede faltar — `customerId` es
   NOT NULL. El nombre del trabajo va al subtítulo.
4. **Desaparece** «Detalle del trabajo, cobros y documentos.»: describía la pantalla, no el
   trabajo, y dónde estás ya lo dicen las migas.
5. **Migas `Trabajos ›`**, sustituyendo al botón «← Volver a Trabajos».
6. **Campo para ponerle nombre**, en «Datos», con la microcopy aprobada.

### El separador solo se pinta si hay algo al otro lado

`unirCon(sep, ...partes)` filtra nulos, `undefined` y cadenas de espacios, y es **la única forma
de componer estas líneas en esta vista**. No es una utilidad: es la ausencia del camino que
produce `Francisco Jiménez · undefined` o un `·` colgando. El guard comprueba las dos mitades —
que la función haga lo que dice **y** que la vista la use en vez de concatenar a mano.

### La fecha del subtítulo es NEUTRA

`<nombre del trabajo> · 24 jun`, **sin «desde el»**. El Trabajo tiene **cinco** estados
(medido en G0) y «desde el» suena a abierto en uno `terminado` o `cerrado`. La fecha sola es
verdad en los cinco. Hay un test que lo prohíbe.

## Microcopy (regla 30)

Aprobada por el fundador el 5-ago-2026 y usada literal: migas `Trabajos ›` · subtítulo
`<nombre> · <fecha>` · etiqueta `Nombre del trabajo` · marcador `Ej. Reforma baño`. **Cero texto
inventado.**

## Lo que NO se ha construido, y por qué

**El rail no existe.** Medido: cero coincidencias de `rail`/`aside`/`sidebar` en la vista, y G1
no está en main. El ticket declara G1 dependencia y deja el contenido del rail a **G3**. Mover
allí el presupuesto habría sido **hacer G1 y G3 de paso, sin sus tickets ni su diseño**.

Por decisión del fundador, **el presupuesto se queda como fila de `DOCUMENTOS`** (donde ya
estaba, `jobDetailView.js:1498`) y G3 lo moverá cuando el rail exista. No se ha tocado.

**Sin backfill de títulos viejos** (decisión del fundador). Los Trabajos ya creados conservan su
`Presupuesto #N · Cliente` guardado: es una columna con datos, no un cálculo. Coherente con la
regla fechada del 2-ago — lo que importa es que los registros NUEVOS nazcan bien.

## Verificado en rojo, cuatro veces

1. **Vuelve la autogeneración** del título → cae nombrando el defecto entero.
2. **El separador se concatena a mano** → cae: es el camino por el que vuelve el `· undefined`.
3. **Las migas dicen «Presupuestos»** → cae.
4. **La miga deja de truncar** → cae por el caso de nombres largos.

Revertidas, verde después. **Suite ungated: 1472 tests, 0 fallos.**

### Dos errores míos en el propio guard, y los dos son de la misma familia

- **El guard se cazó a sí mismo.** Los tests que PROHÍBEN `Presupuestos ›` y «Detalle del
  trabajo…» daban rojo contra **mis propios comentarios**, que necesariamente contienen el texto
  que prohíben. Arreglado con `soloEjecutable` de `_guard-texto.mjs`, que existe justo para esto:
  **para vigilar código hay que leer código, no prosa.** Los tests que EXIGEN pueden leer el
  fichero entero; los que PROHÍBEN, solo lo ejecutable.
- **La cuarta inyección no dio rojo, y el guard tenía razón.** Sustituí
  `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` con un `replace` global, y
  esa secuencia aparece ANTES en `styles.css`: `String.replace` cambió **otra regla**, no la
  miga. El caso caía fuera del mecanismo (`ERRORES_ASESOR.md` #12). Acotando la inyección al
  bloque `.detail-miga-actual`, el rojo salió a la primera.

## AB6

Capturas antes/después: **[PENDIENTE]** — no se han producido en esta sesión.
**La matriz de dispositivos es humana y queda declarada como hueco pendiente**, tal como exige
el ticket. Lo que sí está cubierto por test es el caso que más falla en ese pase: nombres largos
truncando en la miga en vez de empujar el título y el chip.

## 🔴 Hallazgo reportado y NO arreglado (regla 9)

**La lista y el detalle no coinciden en la acción principal**, y el motivo es estructural:

| dónde | de dónde sale la acción |
|---|---|
| detalle | `jobNextAction(job, !isTecnico)` — escalera de 6 niveles, `jobDetailView.js:46` |
| lista | `'✅ Marcar terminado'` **escrito a mano**, `jobsView.js:265` |

`jobNextAction` está **definida dentro de `jobDetailView.js`**, así que `jobsView.js` no puede
usarla aunque quiera. Con un albarán en estado `emitido`, el detalle propone `Enviar para firmar`
(nivel 3) y la lista sigue diciendo `Marcar terminado`: **dos fuentes para la misma pregunta y
nada que las ate** — la familia de defectos que este repo lleva la semana desmontando.

**No se arregla aquí, y es a conciencia:** el ticket declara explícitamente que G2 **no toca el
listado de Trabajos ni sus tarjetas**, y el arreglo correcto es extraer la escalera a un módulo
compartido y rehacer la acción de la lista — con su propio rojo. Meterlo aquí doblaría la
superficie de un PR que ya toca backend, vista y CSS.
