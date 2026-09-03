# El recorrido de Tecnosel, medido de punta a punta

**Medido contra:** el árbol de `scrum-tecnosel-tipo-y-precios` el 3-sep-2026 · **Medido en:** SCRUM-703

No es un recuento de filas: es **el camino que hace una persona**. Ocho saltos, y en cada uno las
tres preguntas — **¿existe la puerta? ¿llega el dato? ¿responde?**. Un salto sólo cuenta como
completo si las tres son que sí. Motor entero + pantalla ausente **no es medio salto: es cero**,
porque el técnico no llega.

> ⚠️ **Un fallo por columna que no está en la base NO es «roto»: es «FALTA EL ALTER».** Las
> columnas ya están en `prisma/schema.prisma` y ya están en `main` (comprobado con
> `git show origin/main:prisma/schema.prisma`); lo que falta es aplicarlas a las bases, que va
> hoy a mano por el orden de la casa (① decisión → ② ALTER → ③ PR). **Aquí no se afirma el estado
> de ninguna base de datos: no la he mirado.** Sólo se nombra de qué DDL depende cada salto.

## Los ocho saltos

| # | El salto | ¿Va? | Coordenada | Qué falta |
|---|---|---|---|---|
| 1 | Crear trabajo sin presupuesto, **con tipo** | ✅ | `jobNuevoModal.js:43` (el desplegable) → `:110` (lo manda) → `POST /admin/jobs` → `trabajoDirecto.ts` | Nada de código. Depende de `jobs.tipo_intervencion` (`schema.prisma:986`) |
| 2 | Asignarlo a **VARIOS** técnicos | 🔴 **NO EXISTE LA PUERTA** | motor: `jobs.routes.ts:791` (`escribirAsignados`, dentro del `PATCH /:id` de `:654`) · lectura: `jobs.routes.ts:500` | **La pantalla.** Ninguna vista del dashboard manda `asignados`. Depende además de `JobAssignee` (`schema.prisma:1213`) |
| 3 | El técnico entra al parte **desde el trabajo** | 🔴 **NO EXISTE LA PUERTA** | `parteDetailView.js` está cargado en `index.html` y **sin llamador** | **El enlace y el `case`.** Ni `jobDetailView.js` enlaza al parte, ni el enrutador tiene su `case`, ni nadie navega ahí |
| 4 | Lo rellena **dictando** | 🔴 **NO CONECTADO** | motor: `src/modules/jobs/domain/parteDictado.ts` (con su test) | **El botón.** La vista del parte no menciona la voz ni una sola vez |
| 5 | Lo firma **SIN COBERTURA** | ⚠️ **motor entero, puerta ausente** | `parteDetailView.js:243` → `/admin/partes/:id/firmar` · `colaDeFirmas.js:310` (`parte: '/admin/partes'`) | Nada del mecanismo: está medido y verde. Falta **llegar** — vive detrás del salto 3 |
| 6 | El jefe lo encuentra en **«Partes por valorar»** | ✅ | firmar deja `estado:'firmado'` (`partes.routes.ts:558`) · la lista filtra ese mismo estado (`:254`) · entrada en la barra lateral | Nada |
| 7 | Le pone **los precios** | ✅ | `PATCH /admin/partes/:id` con `precios[]` · permiso por campo **antes** de construir `data` · 409 `parte_locked` con campo y grupo | Nada |
| 8 | **Quedan guardados y los ve** | ✅ | el PATCH responde con `serializeParteParaLaOficina` si el rol ve todo · la pantalla repinta con lo que devuelve el **servidor** | Nada |

**Cuatro completos** (1, 6, 7, 8) · **uno con el motor entero y sin puerta** (5) · **tres sin puerta** (2, 3, 4).

## 🔴 El control que no puede caer en ningún punto: el móvil del técnico no ve un solo importe

**No cae. 24/24 verdes, ejecutados**, no leídos:

- lo que sale hacia el técnico **no tiene ni una clave de dinero** — `serializeParteParaElTecnico`
  está escrito campo a campo a propósito, y los precios **no cruzan el cable aunque estén en la fila**;
- **lo que se le enseña al firmante en el pad tampoco lleva dinero**;
- un importe en esa pantalla **la pone roja, y el rojo lo nombra**;
- firmar **no congela los precios** (siguen abiertos hasta facturar) y **el hash no se mueve** al tocar uno;
- sin red: se firma, se encola y sube al abrir la aplicación; `parte_locked` **es un éxito** al drenar.

El corte entre el técnico y la oficina es **de ruta, no de un `if`**: dos serializadores distintos y
`requireRole('admin')` en las dos puertas de oficina.

## Los saltos que NO he podido completar, dichos con esas palabras

**No he podido completar el salto 2 (asignar a varios), el salto 3 (del trabajo al parte) ni el
salto 4 (dictar).** No es que fallen: **no hay por dónde entrar**. El motor de los tres está escrito
y en dos de ellos probado, pero ninguna pantalla alcanzable lleva hasta él, así que no hay nada que
medir del lado del usuario. Los declaro sin medir en vez de suponerlos.

**El salto 5 lo he medido por dentro pero no de punta a punta**: la firma sin cobertura está probada
(12 controles verdes), pero se entra por una vista sin puerta, así que hoy **ninguna persona lo
recorre**.

> El salto 2 es del carril de la sesión 1 y aquí sólo se mide, no se toca.

---

# Segunda medición · 3-sep-2026, con las ocho puertas dentro

**Medido contra:** `origin/main` = `4e9e114d1620386c76982efbc4eeae1e9d55fc06` (PR #942, la puerta al
parte) · **Medido en:** SCRUM-703

La primera medición se hizo con tres saltos sin puerta. Entre una y otra entraron
`scrum-684-cablear-dictado` y `scrum-652-puerta-al-parte`, **y Javier aplicó los seis ALTER de
SCRUM-674 en dev, staging y producción**: ya no hay ninguna columna pendiente, así que aquí no cabe
la respuesta «falta el ALTER». La medición de arriba **no se toca**: la diferencia entre las dos es
lo que enseña qué desbloqueó cada merge.

**🔴 Esta vez se RECORRE la puerta, no basta con que exista.** Un botón pintado sin nadie que lo
escuche deja la suite entera en verde y al técnico pulsando la nada. Por cada puerta: ¿se pinta?
¿alguien escucha? ¿la escucha lleva a algún sitio? Y el listener se buscó en sus **dos** formas
—`addEventListener` y `onclick`—: la primera versión de este medidor daba por muertas tres pantallas
vivas porque sólo miraba una, y por usar una ventana fija alrededor del ancla.

| # | El salto | ¿Va? | Coordenada del recorrido |
|---|---|---|---|
| 1 | Crear trabajo con tipo | ✅ | `#tn-crear` pinta + escucha → `/admin/customers` y `POST /admin/jobs`; el servidor manda los rótulos (`app.ts`), el modal los lee de `window.appTiposIntervencion` |
| 2 | Asignar a **varios** | ✅ | casillas con `change` → `PATCH /admin/jobs/:id` con `assignedUserIds` (la lista, no `operarioId`) → `refresh()`; si falla, **deshace la casilla** |
| 3 | Del trabajo al parte | ✅ | `data-abrir-parte` (`jobDetailView.js:1155`) con `addEventListener` → abre el que haya o `POST /admin/partes` → `renderAppView('parte-detail')` → `case` en `app.js:352` → `renderParteDetailView` |
| 4 | Rellenar **dictando** | 🔴 **PINTADO Y MUERTO** | el botón `data-dictado-ordenar` se pinta en `parteDetailView.js:240` y **no aparece en ningún otro sitio**; sin delegación en el fichero |
| 5 | Firmar **sin cobertura** | ✅ | `data-parte-firmar` pinta (`:203`) → `querySelector` (`:455`) → `addEventListener` (`:457`) → `firmarParte` (`:458`); `colaDeFirmas.js` conoce `parte: '/admin/partes'` |
| 6 | El jefe lo encuentra | ✅ | firmar deja `estado:'firmado'`; la lista de oficina filtra ese mismo estado; entrada en la barra lateral con rótulo firmado |
| 7 | Le pone los precios | ✅ | filas con `click` (`:84`), casillas con `input` (`:190`), **`guardar.onclick` (`:201`)**; permiso por campo antes de construir `data` |
| 8 | Quedan guardados y los ve | ✅ | el PATCH responde con `serializeParteParaLaOficina` si el rol ve todo; la pantalla repinta con lo que devuelve el servidor |

**Siete de ocho, recorridos.** La primera medición daba cuatro.

## 🔴 El salto que no se completa, y por qué

**El salto 4, dictar.** No es que falte el motor ni la puerta: **faltan unidos**. La ruta existe
(`POST /admin/partes/:id/dictado`), la función que la llama existe y está entera
(`ordenarElDictado`, con su fallo que no bloquea), el botón se pinta con su texto y su hueco para la
propuesta. Lo único que no existe es el cable entre el botón y la función: `ordenarElDictado` sólo
se cuelga de `window.parteOrdenarDictado` (`:469`), que es como lo alcanzan los tests — **y por eso
la suite está verde**. Quien dicte y pulse ahí no verá pasar nada.

Medido con suelo: el mismo buscador **sí** encuentra el cable de la firma —`data-parte-firmar`
pintado, consultado y enlazado—, así que su silencio sobre el dictado no es ceguera.

## 🔴 El dinero, en los ocho puntos: no cae

- `serializeParteParaElTecnico`, **leído sin comentarios**: ni una clave de dinero.
- `parteDetailView.js`: la única aparición de «importe» está **en un comentario** que dice que lo que
  ve el firmante se arma sin importes. La primera pasada la contó como código; se volvió a mirar.
- Las puertas de oficina siguen pidiendo `requireRole('admin')`, y el PATCH decide por el **rol**,
  no por lo que traiga la petición.

---

# Tercera medición · 3-sep-2026, tras el merge de SCRUM-652e y la firma de la microcopy

**Medido en:** SCRUM-703 · las dos mediciones anteriores **no se tocan**: la diferencia entre las
tres es lo que enseña qué desbloqueó cada merge.

## 🔴 SIETE DE OCHO. No son ocho de ocho.

El salto 4 —dictar— **sigue sin completarse**, y por lo mismo que en la medición anterior: el cable.
La sesión que lo estaba cableando **todavía no ha entrado en `main`**, comprobado con
`git merge-base --is-ancestor` y no con `ls-remote`, y con suelo en las dos direcciones (el
instrumento dice «sí» de algo que sí está y «no» de algo que no).

| # | El salto | ¿Va? | Lo que se recorrió |
|---|---|---|---|
| 1 | Crear trabajo con tipo | ✅ | `#tn-crear` se pinta (`:60`), se consulta (`:74`) y se enlaza con **`btn.onclick` (`:99`)** |
| 2 | Asignar a **varios** | ✅ | `sel.casillas.forEach` → `addEventListener('change')` (`:875-876`) → `PATCH` con `assignedUserIds` → `refresh()` |
| 3 | Del trabajo al parte | ✅ | `parteBtn` con `addEventListener` → abre el que haya o crea → `case 'parte-detail'` → `renderParteDetailView` |
| 4 | Rellenar **dictando** | 🔴 **PINTADO Y MUERTO** | `data-dictado-ordenar` sólo aparece en `parteDetailView.js:240`. **La ruta existe y la función existe entera**: falta el cable |
| 5 | Firmar **sin cobertura** | ✅ | `data-parte-firmar` pintado (`:203`), consultado (`:455`), enlazado (`:457`) y llamando a `firmarParte` (`:458`) |
| 6 | El jefe lo encuentra | ✅ | `fila.addEventListener('click')` (`:84`) → `pintarParte`; el estado que deja firmar es el que filtra la lista; entrada en la barra |
| 7 | Le pone los precios | ✅ | casillas con `input` (`:190`) y **`guardar.onclick` (`:201`)**; permiso por campo antes de construir `data` |
| 8 | Quedan guardados y los ve | ✅ | el PATCH responde con la vista de oficina si el rol ve todo; la pantalla repinta con lo del servidor |

## Y mi medidor volvió a mentir, por tercera vez

Dio por muertos los saltos **1, 2 y 6**, que están vivos. El motivo es el mismo defecto de siempre
con una cara nueva: **quité la ventana fija alrededor del ancla y la reintroduje alrededor de la
consulta**. `#tn-crear` se consulta en la línea 74 y se enlaza en la 99 — veinticinco líneas, y mi
ventana eran doce. Los saltos 2 y 6 fallaron por otra razón: sus elementos nacen de
`createElement`, así que **nunca pasan por un `querySelector`** y mi heurística los daba por no
buscados.

**Los tres se verificaron a mano antes de creer el veredicto**, que es la única razón por la que
esta tabla dice la verdad. Un medidor con ventana no mide: tolera.

## 🔴 El dinero, en los ocho puntos: no cae

- `serializeParteParaElTecnico`, leído **sin comentarios**: limpio.
- `parteDetailView.js`, la pantalla del móvil, leída **sin comentarios**: limpia.
- Las **dos de dos** puertas de oficina piden `requireRole('admin')`.
- El PATCH decide por el **rol**, no por lo que traiga la petición: quien llama no elige su permiso.
