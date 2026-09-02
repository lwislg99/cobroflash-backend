# SCRUM-686 · `main` en rojo: la cabecera y el pie heredan — y viajan

**Fecha:** 2-sep-2026 · **Carril:** desbloqueo de `main` · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `e96ca273cabd4cbbea7f7151ca36d7afca16b4fb` · 2026-09-02T18:24:15Z

> **El trinquete de SCRUM-655b no se toca, no se relaja y no se salta.** Hizo exactamente su
> trabajo: cazó dos columnas nuevas sin clasificar. Lo que estaba mal no era el guard.

---

## 1 · PASO 0

### ENTRADA

**Doble, y las dos reales:**

* **Hoy, el equipo:** `main` en rojo bloquea a tres sesiones y a un cuarto compañero. Nadie puede
  cerrar con verde sobre el remoto. Reproducido antes de tocar nada:
  `tests/scrum655b-revision-con-llamador.test.mjs` → *«HAY 2 CAMPO(S) DE `Quote` QUE NADIE HA
  CLASIFICADO: docHeaderText, docFooterText»*.
* **El profesional, si esto se arregla mal:** un campo sin clasificar **no viaja**. La revisión
  nace sin la cabecera y el pie que él escribió, y no se entera hasta que su cliente le dice que
  faltan.

### MECANISMO · existe, y la lista COPIA — no es declarativa

Lo primero que había que medir, porque de ahí depende todo:

```
src/modules/quotes/domain/revision.ts:250
    for (const campo of REVISION_HEREDA) {
      if (campo in anterior) nueva[campo] = (anterior as Record<string, unknown>)[campo];
    }
```

**`REVISION_HEREDA` no declara: copia.** Así que clasificar sí hace que viajen… *siempre que el
llamador traiga el campo en el objeto*. El `if (campo in anterior)` es la grieta: un `select` de
Prisma que no lo pida, o un DTO que lo recorte, y el dato no llega **aunque esté clasificado**.

### Y una medición que cambia lo que se puede prometer

| función del módulo | ¿la llama alguien en `src/`? |
| --- | :-: |
| `vistaDeRevisiones` | **sí** — `src/modules/system/quoteAdmin.ts` |
| `numeroConRevision` | **sí** — `quoteAdmin.ts` |
| **`nuevaRevisionDe`** | **NO — nadie** |
| `vigenteUnicaDe`, `revisionesDe` | no |

**Se pueden VER revisiones y no CREARLAS**: el camino de creación no está cableado todavía. La
protección de este ticket es, por tanto, **preventiva** — el guard llega antes que el endpoint, que
es el orden bueno, pero conviene decirlo en vez de dejar creer que hay un viaje end-to-end.

---

## 2 · Qué se construyó

### La clasificación: se trae la del compañero, no se reescribe

Existía `origin/scrum-667b-clasificar-cabecera-pie` (commit `86009b8c`) con la clasificación ya
hecha y **correcta**. Se trae **por merge** en vez de escribir lo mismo otra vez: duplicarla habría
dado un conflicto seguro en `revision.ts` y le habría quitado la autoría a quien lo hizo.

Se le corrigen **dos cosas del comentario**, ninguna de fondo:

* decía **«PROVISIONAL hasta que Javier lo confirme»** — ya no lo es: la decisión está tomada.
* decía **«DECISIÓN DEL FUNDADOR»** — es **del ASESOR**. Una decisión no se le atribuye a quien no
  la tomó.

**Los dos campos HEREDAN.** Son CONTENIDO del documento que escribió el profesional, no un hecho de
la versión anterior (firma, token, envío, cobro). Una revisión es otra versión del mismo documento.
`albaranes.doc_header_text` **no entra**: no es campo de `Quote`.

### Lo que faltaba, y es el motivo del ticket

`tests/scrum686-cabecera-y-pie-viajan.test.mjs` — 6 pruebas que **ejercitan el copiado**, no la
lista:

| | qué |
| --- | --- |
| ① | **viajan** con valor real, y se recuperan **iguales** |
| ① | viajan **tal cual**: sin `trim`, sin `slice`, con saltos y comillas — el texto es del profesional |
| ① | un campo **ausente** en el anterior no se inventa, y no revienta |
| ② | **positivo**: se mutila la lista quitando `docHeaderText` y el control **cae nombrándolo**, con suelo propio (con la lista entera los dos llegan, para no pasar por el motivo equivocado) |
| ③ | **negativo**: los 11 campos de `REVISION_NO_HEREDA` no se cuelan, y ponerles valor **no** tumba el viaje de los que sí heredan |
| ④ | **suelo**: si `REVISION_HEREDA` se vaciara, «viajan» sería cierto sobre un conjunto vacío |

---

## 3 · Evidencia

Commiteado en verde antes de mutar; mutación con post-condición sobre **el fichero nombrado**.

**🔴 El rojo por el mecanismo, y su resultado es la tesis entera del ticket.** Se rompió el
**copiado** (`continue` sobre `docHeaderText` en el bucle) **dejando la clasificación intacta**:

* **caen 3 pruebas de este fichero**, y el mensaje nombra el campo: *«LA CABECERA NO VIAJA A LA
  REVISIÓN. El profesional la escribió una vez y la revisión nace sin ella…»*
* **los 15 de SCRUM-655b siguen en VERDE.**

Eso es exactamente lo que había que demostrar: **clasificar satisface el censo y no prueba que el
dato llegue**. Con el copiado roto, el trinquete que puso `main` en rojo habría dicho que todo
está bien.

Restaurado con `git status` vacío como post-condición. **Tanda completa después del último cambio:
4631 tests · 4548 pass · 0 fail · 83 skipped.** `guards:entrada` verde, worktree limpio, Prisma
regenerado y `dist/` reconstruido desde este worktree.

### Dos errores míos que cazaron guards de la casa, y quedan escritos

* **El suelo de este mismo fichero** cazó que yo trataba `REVISION_NO_HEREDA` como un array cuando
  es un `Record<campo, motivo>`. Sin ese suelo, mi control negativo habría pasado en verde sin
  comprobar nada.
* **El guard de SCRUM-409** cazó que mi fixture usaba el **merchant DEMO (id 1)**, donde la política
  de WhatsApp, el PDF y la pasarela se comportan distinto — un fixture ahí desactiva comprobaciones
  en silencio. Cambiado a `71`.

---

## 4 · Huecos declarados

* **No se prueba el viaje end-to-end, porque no existe**: `nuevaRevisionDe` no tiene llamador en
  `src/` (medido). Lo que se prueba es el copiado, que es el único camino que hay hoy. El día que
  se cablee el endpoint habrá que comprobar que **el `select` trae los dos campos** — si no, el
  `if (campo in anterior)` los dejará fuera y estos tests seguirán verdes.
* **No se ha verificado que los dos campos lleguen al PDF de la revisión.** `pdf.service.ts` los
  pinta (`docHeaderText` en su línea 718, `docFooterText` en la 979), pero eso es el PDF del
  documento, no el de una revisión creada por este camino — que no existe.
* **No se ha tocado el trinquete de 655b** ni se ha revisado si su censo tiene otros huecos: fuera
  de carril.

---

## Tests que introduce esta entrada

* `tests/scrum686-cabecera-y-pie-viajan.test.mjs` — 6 pruebas: el viaje con valor real, la
  literalidad del texto, el campo ausente, el control positivo con lista mutilada, el control
  negativo sobre `REVISION_NO_HEREDA` y el suelo de las listas.
