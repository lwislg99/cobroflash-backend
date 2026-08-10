# SCRUM-338 · La carga del catálogo deja de fallar en silencio

**Fecha:** 9-ago-2026 · **Carril:** producto (onboarding) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `227657b227e1223d3e4f1b6f6306533c76fb8213` · 2026-08-09T20:55:14+02:00

## 🔴 PASO 0: del título del ticket, casi nada seguía vivo

El ticket decía «quien salta el wizard se queda **SIN OFICIO PARA SIEMPRE** y no puede cargar el
catálogo — **callejón sin salida**». Medido contra main, dos de las tres partes ya estaban
arregladas **por otros tickets**:

| lo que decía el título | estado medido | ancla |
|---|---|---|
| «sin oficio para siempre» | **FALSO hoy** | `productsView.js`: `cargarCatalogoDeGremio` ramifica por `e.code === 'trade_required'` y llama a `pedirOficio` — **te pregunta el oficio** en vez de fallar (SCRUM-364) |
| «callejón sin salida» | **FALSO hoy** | el botón de Productos existe y funciona con `{}` cuando hay oficio guardado |
| el mensaje engañoso | **arreglado** en SCRUM-313 | `already_has_products` ya no se cuenta como error |

**Quedaba una cosa, y es la que se arregla aquí:** el `catch` **vacío** del wizard.

```js
} catch (_) { /* no bloquear el onboarding por esto */ }
```

Si la carga fallaba durante el onboarding, el profesional terminaba **creyendo que tenía
catálogo**, y la lista vacía que veía después era **indistinguible** de «mi gremio no tiene
catálogo predefinido». `lifecycle.service.ts` lo tenía escrito como el cuarto motivo, «el que
FALLA EN SILENCIO», y decía que no se arreglaba allí. Aquí es donde tocaba.

## Lo que se entrega, y lo que se para

**NO BLOQUEAR SIGUE SIENDO CORRECTO** — un catálogo que no carga no puede impedir empezar a
trabajar. Lo que se arregla no es el flujo: es el silencio. Ahora el fallo **se marca**
(`state.catalogFallo = true`) y deja de perderse.

### ⚠️ PARADA POR REGLA 30 — y el guard de otro ticket me dio la razón

Mi primera versión **pintaba** un aviso con el marcador puesto. El guard de **SCRUM-402** lo cazó:

> 🔴 HAY MARCADORES NUEVOS QUE PUEDEN PINTARSE: onboardingView.js (+1)

Y tiene razón: un `[PENDIENTE …]` en la pantalla de un profesional es peor que el silencio. Así
que **el aviso no se pinta**. El dato queda; decirlo es **una línea** el día que haya texto.

**PROPUESTA DE MICROCOPY, para aprobar** (no está escrita en el código):

> «No hemos podido cargar el catálogo de tu gremio. Puedes cargarlo cuando quieras desde Productos.»

Lo que tiene que decir, sea cual sea el texto final: **que no se cargó**, **que no pasa nada**, y
**dónde está el botón** — mandarle a comprobar sin decirle dónde es mandarle a una pared, que es
justo el defecto que este ticket cierra.

## El guard

* el `catch` vacío original **no puede volver** (se busca literal);
* el fallo **se marca dentro del catch** — comprobado por posición relativa al `catch`, **no por
  una ventana de N caracteres**: eso sería otra vez un guard atado a la posición (familia de
  SCRUM-353), y de hecho mi primer intento falló justo por ahí;
* **sigue sin bloquear**: el bloque no puede tener `throw` ni `reject`;
* **no se pinta ningún marcador** en esa superficie;
* y **la salida de SCRUM-364 sigue en pie** (`trade_required` → `pedirOficio`): sin eso, el aviso
  mandaría a Productos a alguien que volvería a chocarse.

## Lo que NO cubre

* **El profesional sigue sin enterarse** hasta que se apruebe el texto. Es una decisión tuya, no
  un olvido: está en la propuesta de arriba.
* **No se persiste** el fallo en servidor: vive en el estado del wizard. Si recarga, se pierde.
  Persistirlo sería un campo de schema.
* **No se reintenta** la carga. El botón de Productos ya lo permite.
