# SCRUM-1042 · Foto del técnico, opcional (mitad FRONT: el ajuste on/off del comercio)

**Medido contra:** `origin/main` = `dab4262758f519db649dfbb6ce2cf964af3e7966` · 2026-09-22T10:16:14Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1042-ajuste-foto-tecnico`.
**Microcopy:** ✅ **textos firmados** por el orquestador por delegación del fundador (22-sep-2026, comentario de Jira en SCRUM-1042): rótulo «Enseñar la foto del técnico al cliente», hint «La verá en su portal del trabajo — nunca en la factura.»

## Alcance de ESTA mitad (S2, front) — lo que falta es de S1

Puesto explícito del ticket: «S1 servidor + S2 front». Esta entrega es **solo** el ajuste on/off del comercio en Configuración, apagado por defecto. La foto en sí (subir/cambiar/quitar, recorte, tope de tamaño, columna nueva con su ALTER, ruta de servido con token de cliente) es la otra mitad y NO se construye aquí — queda un `TODO(SCRUM-1042, mitad de S1)` en el código.

## Por qué NO se usó `merchants.flags` (corrección de una instrucción inicial)

La primera indicación fue «va en el JSON `flags` existente, sin ALTER». PASO 0 antes de tocar código: `core/flags.ts` es la tabla CERRADA de la Parte P del master —su propio comentario dice «prohibido añadir flags aquí que no estén en la tabla (regla 5)»— y además «escritura SOLO manual/fundador por ahora» (no existe ninguna ruta que la escriba). Meterlo ahí habría pedido DOS cosas que no están: dar de alta el flag en el master y construir una ruta de escritura. Reportado al orquestador, que decidió **`Merchant.homePrefs`** (JSONB, ya escribible por el propio comercio vía `PUT /admin/merchant` → `updateMerchantProfile`) — aditivo, sin ALTER, sin tocar el master. Se documenta en el código que `homePrefs` se usa aquí como preferencias GENERALES del comercio, no solo de la Home (A6.7), para no confundir a la próxima sesión que lo lea.

## El riesgo real de reutilizar `homePrefs`, y cómo se evitó

`homePrefs` también guarda qué bloques de la Home ve el comercio. La pantalla de Configuración no editaba ese campo hasta hoy: si el guardado mandara `{showTechPhotoToClient: x}` a secas, **borraría los bloques de Home que el comercio ya había elegido** la próxima vez que tocara Configuración — un efecto secundario silencioso en una pantalla que no tiene nada que ver con la Home. Se carga `homePrefsCargados = merchant.homePrefs || {}` al abrir la pantalla y se guarda con `Object.assign({}, homePrefsCargados, {showTechPhotoToClient})`: fusión, nunca reemplazo.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/settingsSubmenus.js` | `showTechPhotoToClient: 'equipo'` en `ASIGNACION_SUBMENU` (es sobre a quién ve el cliente del EQUIPO, no una notificación al propio profesional). |
| `public/dashboard/js/settingsView.js` | El toggle (mismo `createToggle` que ya usan los tres avisos por email), cargado desde `homePrefsCargados.showTechPhotoToClient` (apagado si falta la clave), colocado en el submenú «Equipo», y fusionado al guardar. |
| `tests/scrum1042-ajuste-foto-tecnico.test.mjs` (nuevo, 7 pruebas, AST/texto) | El campo está en el mapa de submenús; el toggle lleva los tres literales firmados; está `colocar()`ado; se carga apagado por defecto (con control positivo de que `!!undefined === false`); el guardado FUSIONA (con su mutación real verificada) y `homePrefsCargados` se rellena antes de poder guardar. |

## Por qué es AST/texto y no el banco de vistas

`renderSettingsView` se mide en este repo con guards de NAVEGADOR reales (precedente citado en `scrum515-aviso-bizum-render.test.mjs`: `scripts/guard-aviso-bizum.mjs`), no con el banco de vistas — es una pantalla grande y con mucho estado compartido. Se siguió ese mismo patrón: AST/texto para lo estructural (que exista, que fusione, que cargue apagado), navegador para lo visual (fuera del alcance de esta mitad, que no tiene nada visual nuevo que enseñar todavía).

## Verificado en rojo

Mutación real: quité la fusión (`homePrefs: {showTechPhotoToClient: …}` a secas, sin `Object.assign`) → caen 2 de 7 pruebas; restaurado, vuelve a 7/7.

## Pendiente

La mitad de S1 (columna + ruta de la foto). Verificar en yaqu.app que el toggle se ve en Configuración → Equipo, apagado por defecto, y que guardar Configuración no borra las preferencias de la Home de un comercio que ya las hubiera elegido (control manual: fijar un bloque de Home, luego tocar solo este ajuste, comprobar que el bloque sigue).
