# Prueba en iPhone real · bloque H

**Duración:** ~30 min sin Mac · ~55 min con Mac · +2 min para arrancar el reloj de los 8 días

---

## Antes de nada: qué NO se puede probar hoy

**1 · Firmar sin cobertura no está construido.** Esta sesión no prueba el producto: **mide la plataforma y fotografía el estado de partida.** Eso no es un premio de consolación — es lo que hace que H2 y H1 se construyan sobre datos y no sobre suposiciones.

**2 · El desalojo a los 8 días no es un test, es un experimento con calendario.** No se puede hacer en una tarde. **Pero se ARRANCA en dos minutos**, y es lo que más valor tiene por minuto invertido de todo el documento. Está en el bloque C.

---

## La regla de oro para anotar

Cada prueba tiene **tres** respuestas posibles:

> **SÍ** · **NO** · **NO SUPE MIRAR**

La tercera es una respuesta legítima y en este proyecto es la que más veces nos ha salvado. **No la conviertas en «bueno, parece que no pasa nada».** Si no lo viste, no lo viste.

Y: **o hay foto, o no pasó.** Captura de pantalla de todo lo que sea visual.

---

## Qué hace falta

- **Un iPhone.** Anota **modelo y versión de iOS** — el dato importa, el comportamiento de almacenamiento cambia entre versiones.
- **Una cuenta de pruebas.** ⚠️ **Nunca un merchant real** (regla 24).
- **Un albarán de prueba ya creado y visible**, y con un trabajo asociado. **Prepáralo antes, con cobertura**, para no gastar la sesión creando datos.
- **Un portátil** para ir anotando.
- **Opcional, pero multiplica el valor: un Mac con cable.** Safari → menú Desarrollo → el iPhone → la página. Sin Mac, el bloque B no se puede hacer y hay que declararlo así.

---

# BLOQUE A · sin herramientas (~25 min)

Cualquier iPhone, sin Mac, sin nada.

### A1 · Línea base, con cobertura (2 min)
Abre `yaqu.app` en **una pestaña normal de Safari** e inicia sesión.
→ **¿Carga entero?** Si aquí ya falla algo, para y anótalo: todo lo demás sobra.

### A2 · Instalar en pantalla de inicio (3 min)
Botón Compartir → **Añadir a pantalla de inicio**. Ábrela **desde el icono**.
→ **¿Carga igual?** ¿Sale sin la barra de Safari (a pantalla completa)?
→ 📸 Foto de las dos: la pestaña y la instalada.

### A3 · 🔴 **LA PRUEBA IMPORTANTE — modo avión, desde el icono** (3 min)
Activa **modo avión de verdad** (no el simulador de nadie). Abre la app **desde el icono**.

→ **¿Se abre la aplicación, o sale la página de error de Safari?**

**Por qué es la prueba importante:** esto contesta en el mundo real la pregunta de [SCRUM-453](https://yaqu.atlassian.net/browse/SCRUM-453). Si **no** se abre, el precache no está sirviendo nada y **todo el bloque H se está diseñando encima de arena**. Es la única prueba de esta sesión que puede invalidar trabajo ya hecho.

### A4 · Modo avión, desde una pestaña normal (2 min)
Lo mismo pero abriendo `yaqu.app` en **una pestaña de Safari**, no desde el icono.
→ **¿Se comporta igual o distinto que A3?** Los dos casos son distintos a propósito y necesitamos saber si hoy ya lo son.

### A5 · Navegar sin cobertura (8 min)
Con modo avión puesto y la app abierta, entra en: **Inicio · Trabajos · Cobros · un albarán · Facturas**.

Para cada una anota **exactamente qué se ve**, y en particular:

| lo que puede pasar | cómo se anota |
|---|---|
| se ve el contenido | ✅ y foto |
| pantalla en blanco | 🔴 y foto |
| mensaje de error claro | ⚠️ y **copia el texto literal** |
| **afirma algo falso** (p. ej. «Todavía no hay cobros registrados») | 🔴🔴 y foto — **es el defecto de [SCRUM-448](https://yaqu.atlassian.net/browse/SCRUM-448)/[451](https://yaqu.atlassian.net/browse/SCRUM-451) en carne real** |
| se queda cargando para siempre | 🔴 y anota **cuánto esperaste** |

→ 📸 **Una foto por pantalla.** Esto es el «antes» de H2 y vale para el resto del bloque.

### A6 · Intentar firmar sin cobertura (5 min)
Con modo avión, abre el albarán de prueba e **intenta firmarlo**.
→ **¿Qué le dice hoy el producto a un profesional?** Copia el texto literal y haz foto.
→ ¿Le deja dibujar la firma y luego falla, o le impide empezar?

**Esto es el estado de partida de H2.** Sea cual sea, no se juzga: se anota.

### A7 · Volver (2 min)
Quita el modo avión.
→ **¿Se recupera sola la aplicación, o hay que recargar a mano?**

---

# BLOQUE B · con Mac y cable (~30 min)

En el Mac: Safari → **Desarrollo** → `[el iPhone]` → la página de YaQu. Se abre la consola.

> Si el menú Desarrollo no aparece: Safari → Ajustes → Avanzado → «Mostrar funciones para desarrolladores web». Y en el iPhone: Ajustes → Safari → Avanzado → Inspector web.

Pega estas líneas **una a una** en la consola y anota lo que devuelve **literalmente**.

### B1 · ¿Instalada o pestaña? (5 min)
```js
matchMedia('(display-mode: standalone)').matches
navigator.standalone
```
Hazlo **dos veces**: abierta desde el icono, y abierta en pestaña.
→ **Los cuatro valores.** Es lo que `entornoDeLaApp()` usa para decidir, y necesitamos saber si acierta en un iPhone real.

### B2 · ¿Qué hay en la caché? (5 min)
```js
await caches.keys()
```
y luego, con el nombre que salga:
```js
(await (await caches.open('NOMBRE_QUE_SALIO')).keys()).length
```
→ **¿Salen 54 entradas?** Es el número que se midió en el repo el 10-ago-2026, contando las entradas declaradas en el precache del service worker. Si sale otro, el número del repo ha cambiado y hay que volver a contarlo antes de llamarlo divergencia.

### B3 · 🔴 La prueba de SCRUM-453 (10 min)
```js
!!(await caches.match('/dashboard/js/api.js'))
!!(await caches.match('/dashboard/js/api.js?v=cualquiercosa'))
```
→ **Si el primero da `true` y el segundo `false`, la hipótesis de 453 es CIERTA** y el precache no sirve los ficheros tal como los pide la página.

Y en la pestaña **Red** del inspector, recarga y mira: **¿los `<script>` se piden con `?v=` o desnudos?** 📸 foto.

### B4 · Almacenamiento (5 min)
```js
await navigator.storage.estimate()
await navigator.storage.persisted()
```
→ Cuánto espacio hay y si el origen es persistente. **`persisted()` en `false` significa que iOS puede borrarlo.**

### B5 · IndexedDB (5 min)
```js
await indexedDB.databases()
```
→ **Debería salir vacío.** H0 midió cero ficheros de IndexedDB en el producto. Si sale algo, es un hallazgo.

---

# BLOQUE C · arrancar el reloj de los 8 días (2 min) ⭐

**Esto es lo que más vale por minuto de todo el documento**, y con un iPhone prestado solo se puede hacer si su dueño colabora ocho días.

1. Deja **la app instalada en la pantalla de inicio, con sesión iniciada**.
2. Deja **también una pestaña normal** de Safari con `yaqu.app` cargado, y ciérrala.
3. **Anota fecha y hora exactas.**
4. Pide tres cosas, explícitamente:
   - **Que NO se abra YaQu durante 8 días.**
   - **Que se use Safari con normalidad** para otras cosas — eso es lo que hace correr el reloj.
   - **Que NO se borren datos ni historial de Safari** en esos 8 días. Si se borran, el experimento se cae y hay que repetirlo.
5. **A los 8 días**, abrir las dos: **el icono** y **la pestaña**.

→ **Lo esperado:** la instalada conserva todo; **la pestaña ha perdido el origen entero** (service worker, caché y todo).

**Por qué importa:** es lo único que puede confirmar o desmentir el hallazgo que dimensiona [SCRUM-360](https://yaqu.atlassian.net/browse/SCRUM-360) (H5) **entero**. Si se confirma, «instala la app» deja de ser una sugerencia y pasa a ser una condición para que el offline funcione — y hay que decírselo al profesional con esas palabras.

---

# Lo que este documento NO cubre

Se nombra aquí para que la ausencia sea un hueco declarado y no un hueco que nadie ve.

- **La muerte del proceso.** Que iOS mate la aplicación en segundo plano y el profesional la reabra con firmas sin subir dentro. No se puede provocar de forma fiable a mano y este procedimiento no lo intenta.
- **Android y Chrome.** Todo lo de aquí es Safari sobre iOS. El comportamiento de almacenamiento y de desalojo es distinto en Android y no se puede extrapolar ni un dato.

---

# Plantilla para anotar

Copia esto y rellénalo sobre la marcha, no de memoria después.

```
iPhone: modelo ................  iOS ................  Safari ................
Fecha y hora: ................
¿Es un iPhone muy lleno de apps? SÍ / NO   (afecta a la presión de almacenamiento)

A1 instalada base .............. SÍ / NO / NO SUPE MIRAR   →
A2 añadir a inicio ............. SÍ / NO / NO SUPE MIRAR   →
A3 🔴 avión desde icono ........ SÍ / NO / NO SUPE MIRAR   →
A4 avión desde pestaña ......... SÍ / NO / NO SUPE MIRAR   →
A5 navegar sin red ............. (una línea por pantalla, con el texto literal)
      Inicio     →
      Trabajos   →
      Cobros     →
      Albarán    →
      Facturas   →
A6 intentar firmar ............. texto literal →
A7 volver de avión ............. SÍ / NO / NO SUPE MIRAR   →

B1 display-mode / standalone ... icono: ....... / ....... · pestaña: ....... / .......
B2 entradas en caché ...........
B3 🔴 match sin query / con query ....... / .......
B4 estimate / persisted ........
B5 indexedDB.databases() .......

C  reloj arrancado el ..........  →  revisar el ..........
```

---

# Lo que NO se hace

- **No borrar datos de Safari a mitad** de la sesión. Invalida todo lo anterior.
- **No usar VPN.** Cambia el comportamiento de red y no sabremos qué medimos.
- **No probar con un merchant real.** Cuenta de pruebas, sin excepción.
- **No dar por bueno un «parece que va».** O hay foto y texto literal, o la respuesta es **NO SUPE MIRAR**.
- **No arreglar nada sobre la marcha.** Aquí se mide. Lo que salga se convierte en tickets después.
