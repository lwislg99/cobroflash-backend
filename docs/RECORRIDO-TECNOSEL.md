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
