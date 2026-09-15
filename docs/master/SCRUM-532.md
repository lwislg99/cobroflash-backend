# SCRUM-532 · DELIMITADOR-DE-ENTRADA: el guard 267 no veía dentro de un apéndice, y el 273 empuja a escribirlos

**Fecha:** 15-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `07ccd16c92e37350e785526232d03b7f0c637684` · 2026-09-15T08:48:29+01:00
**Tanda:** ver «Verificado en rojo»

> **Un guard que se satisface con el trabajo de otro no vigila el trabajo de nadie.**

## El defecto

Dos mecanismos correctos por separado abrían un hueco al combinarse:

| Guard | Qué hace |
| --- | --- |
| **SCRUM-273** | obliga a un fichero por ticket, así que un registro sobre un ticket viejo **va como apéndice** |
| **SCRUM-267** | exige que cada entrada declare su ancla de medición (sha de 40 + ISO con huso) |

El troceador del 267 cortaba por `^# SCRUM-\d+`. Los apéndices se encabezan `# APÉNDICE`, que no
casa ese patrón, **así que el fichero entero seguía contando como UNA sola entrada** y le bastaba
el ancla de la línea 3 —de otra medición, de otro trabajo— para dar por buenas todas las de abajo.

SCRUM-516 creyó cerrar esto el 19-ago-2026. Lo cerró **para los apéndices `# SCRUM-<n>`, no para
los `# APÉNDICE`**.

🔴 **Demostrado en ejecución el 8-sep-2026**, no supuesto: al escribir el apéndice de
`SCRUM-825.md` la sesión obtuvo 21/21 en verde, no se lo creyó, **abrevió su ancla a propósito** y
el guard **siguió en verde**. De las cinco anclas de ese fichero, el guard sólo miraba dos.

## Lo que se midió, antes de tocar nada

Sobre los **479 ficheros** de `docs/master/` (eran 226 cuando se escribió el comentario del 267),
contando encabezados de nivel 1 fuera de bloque cercado:

| | |
| --- | --- |
| encabezados `^# ` en total | **849** |
| los que el troceador **veía** | **634** |
| 🔴 los que le eran **INVISIBLES** | **215** |
| de esos 215, los que se anuncian **APÉNDICE** | **62** |
| de esos 215, **secciones internas** (`# PUNTO 1`, `# TRAMO 2`, `# FASE C`) | **153** |

Y la exposición real, medida aparte: **69 trozos escondían más de una medición**, y de las **733**
líneas `**Medido contra:**` del árbol **30 no casan la regex del guard** — la mayoría tapadas por
un ancla buena de su mismo trozo.

## La decisión, y por qué

**El delimitador pasa a ser `^# SCRUM-\d+` o `^# …APÉNDICE…`, fuera de bloque cercado.**

🔴 **Por qué NO se corta por cualquier `^# `**, que era el candidato obvio: esas 153 secciones
internas no son mediciones aparte, y exigirles ancla propia daría **153 rojos que no son fallos de
ancla**. Es el mismo error que el propio 267 ya midió con `---`, cometido otra vez y en mayor
escala. Se midió antes de apoyarse en él, que es lo que aquel comentario mandaba hacer.

Resultado medido: **634 → 696 entradas (+62)**, y **29 apéndices que hoy pasan quedan acusados**.
Las 27 exentas de SCRUM-516 **conservan su clave** `fichero#índice`.

### La vía que parecía cerrarlo del todo, y NO vale

La alternativa robusta era «que **todas** las líneas `Medido contra` de un trozo sean válidas»:
cerraría el hueco sin depender de acertar con el delimitador. **Medido, y se descarta**: acusaría a
`docs/master/SCRUM-267.md:25`, que no es un ancla sino **la plantilla del formato**
(`` `<sha de 40>` · <ISO-8601 con huso> ``). El documento que explica la regla contiene la regla —
es SCRUM-349 exacto, un guard de texto cazándose a sí mismo. Va como hallazgo, no se implementa.

### Las 28 exentas, y por qué van en un censo APARTE

Al ensanchar el delimitador quedaron a la vista 28 entradas que llevaban ahí desde siempre. **No se
añaden a `HEREDADAS_SIN_ANCLA`**: aquella lista está cerrada por decisión del fundador del
19-ago-2026 y su propiedad declarada es que **no puede crecer**. Engordarla de 27 a 55 borraría esa
propiedad. Separadas, cada una conserva su número, su fecha y su causa, y cada una cae por su lado.

**Una SÍ se recuperó:** `SCRUM-814.md#2` traía sha de 40, fecha, hora y huso completos y sólo el
formato no era ISO (`2026-09-07 21:34:56 +0100` → `2026-09-07T21:34:56+01:00`). Comprobado antes:
el sha existe, `cat-file -t` dice commit y es ancestro de `origin/main`. Ni un dato inventado.

Las 28 restantes: **14** no declaran ancla (el dato no existe), **6** traen sha abreviado *y además*
sin hora, **6** declaran fecha sin hora, y **2** miden contra otra base a propósito y lo dicen
(`630#2` contra «esta misma rama», `821#2` contra el `merge-base`) — reescribirlas como
`origin/main` sería falsear una medición bien hecha.

⚠️ **Esta exención está pendiente de la firma del fundador**, igual que lo estuvieron las 27.

## Verificado en rojo

El control que decide **rompe un ancla de verdad y exige que el guard caiga nombrando esa entrada**,
sobre `SCRUM-825.md` —el fichero real donde el defecto se demostró— y sin tocar el disco.

**① La demostración del hueco**, sobre el apéndice puro de la línea 231:

```
DELIMITADOR VIEJO : 2 entradas · acusa 0  ← 🕳️ EL HUECO: el ancla rota PASA
DELIMITADOR NUEVO : 5 entradas · acusa 1  ← 🔴 CAE
   → línea 231: el sha está ABREVIADO (hacen falta las 40 posiciones)
```

**② El rojo real, cadena completa** (`npm run guards:entrada` con el ancla rota en disco):

```
SCRUM-825.md#5 (línea 586) — el sha está ABREVIADO (hacen falta las 40 posiciones)
    # SCRUM-825 · APÉNDICE · 8-sep-2026 · FASE 2 · El expediente de retirada
🔴 Algún guard de entrada está en rojo.
```

**③ El aserto NO es tautológico.** Con `motivoSinAncla` mutilado para que nunca encuentre motivo:

```
🔴 se ha roto UNA ancla y el guard acusa a 0 entradas: []
```

**④ Con el delimitador revertido al viejo**, el control cae y el censo nuevo cae con él: `pass 6,
fail 4`. Con el delimitador nuevo: `tests 10, pass 10, fail 0`.

## Lo que NO cubre

* **El hueco no queda cerrado del todo, y se declara con su número.** Quedan **40 trozos** que
  siguen escondiendo más de una medición (eran 69) y **26 líneas `Medido contra` mal escritas** que
  ningún trozo acusa. Un delimitador sólo ve lo que alguien se acordó de encabezar.
* **No se toca el guard 273** ni su empuje hacia los apéndices: es correcto y su función es ésa.
* **No se toca `RE_ANCLA`.** Lo que cambia es la UNIDAD que se mira, no el listón.
* Las 28 exentas **no se van a rellenar**: reconstruir hoy contra qué `main` se midió algo en
  agosto sería inventarlo, que es justo el daño que este guard existe para prevenir.

## Ficheros

* `tests/scrum267-ancla-de-medicion.test.mjs` — delimitador, censo `TAPADAS_POR_EL_TROCEADOR`, el
  control que rompe.
* `docs/master/README.md` — un apéndice es una entrada y lleva su propia ancla.
* `docs/master/SCRUM-814.md` — ancla recuperada al formato ISO.
