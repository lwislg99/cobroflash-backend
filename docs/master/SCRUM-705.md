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

Por eso cada eslabón de pantalla declara **dos** cosas y se exigen las dos:

* **pinta** → el gancho que dibuja;
* **vive** → la función que alguien tiene que **llamar desde FUERA** de su propio módulo.

---

## 2 · 🔴 Los hallazgos. Se NOMBRAN, no se arreglan

Declarados en `MUERTOS_DECLARADOS`, con **trinquete en los dos sentidos**: no puede crecer en
silencio, y una declaración que ya no corresponde a nada también cae.

| # | salto | hallazgo |
|---|---|---|
| **1** | abrir el parte | 🔴 **`renderParte` no tiene NI UN llamador**: `app.js` solo declara el caso `partes-oficina`. **La pantalla del parte del técnico no tiene entrada en el enrutador**, y los saltos 3, 4 y 5 cuelgan de ella. SCRUM-652 fase C |
| **2** | firmar | `firmarParte` sin llamador. SCRUM-652 fase C |
| **3** | dictar | `parteOrdenarDictado` sin llamador — **MÍO**, SCRUM-683 |
| 4 | (revisiones) | `pintarRevisiones` sin llamador — **MÍO**, SCRUM-655 fase C, y ya se dijo al entregarlo |

> ⚠️ **El hallazgo 1 se midió DOS VECES porque la primera engañó.** `grep window.renderParte` casa
> **dentro** de `window.renderPartesOficinaView`, así que la primera medición dijo «lo llama
> `app.js`». Con límite de palabra: **cero**. Un prefijo que casa es un falso positivo silencioso.

Y una que **no** era hallazgo: `parteOficinaView.js` no publica nada en `window` explícitamente, y
parecía muerta. **Ejecutándola** —no leyéndola— se ve que su `async function` de nivel superior sí
queda en `window` en un `<script>` clásico, y `app.js:327` la llama. **Estaba viva.**

---

## 3 · Verificación — y un rojo que NO cayó

**Commit de todo ANTES de inyectar: `cb45b1efc66e73526fddb67e82e2834ee71c1d3b`** (verde, 4.914 · 4.830).

| rojo | resultado |
|---|---|
| **pintado y muerto**: se le quita a «por valorar» su único llamador | 🔴 exit 1 — *«6 · aparecer en “por valorar” → nadie llama a `renderPartesOficinaView()`»* |
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

**Y cae con el mecanismo viejo**: hoy, con la pantalla del parte del técnico **inalcanzable desde el
enrutador**, la suite entera está en verde. Eso es lo que aprobaba el mecanismo de ayer.

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
