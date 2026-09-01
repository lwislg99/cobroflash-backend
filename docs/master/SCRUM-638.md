# SCRUM-638 · ¿De quién es el rojo del guard de navegador? — **de ninguna rama**

**Fecha:** 1-sep-2026 · **Carril:** B · **Gate:** medición — NO se ha arreglado nada
**Medido contra:** `origin/main` = `775bf7e04e4c0f55ca23ad4c9bfe58a0b365c3dc` · 2026-09-01T00:00:00+02:00
**Rama:** `scrum-638-de-quien-es-el-rojo`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> **🕳️ HUECO DECLARADO:** el MCP de Atlassian sigue caído; no he podido leer SCRUM-638 ni los
> PR #878 / #874 en Jira ni en GitHub. **No he visto el log del runner**: todo lo de abajo es
> medición LOCAL. Eso limita lo que puedo afirmar, y está dicho en «lo que NO puedo concluir».

---

## LA RESPUESTA, EN UNA LÍNEA

**El guard pasa en LOCAL en las tres configuraciones que se pueden probar aquí — main limpio, mi
rama, y forzando el camino de CI. Sólo cae en el runner.** Es el caso ya fichado como **SCRUM-626**,
así que este ticket **se une a aquél en vez de duplicarlo**.

---

## 1 · LAS TRES EJECUCIONES, CON CÓDIGO DE SALIDA

| Configuración | Código de salida | Resultado |
|---|---|---|
| **`main` limpio** (`775bf7e0`, detached) | **`EXIT=0`** | 9 guards · 51,5 s · verdes 9 · no verdes 0 |
| **`scrum-625-formato-importe`** | **`EXIT=0`** | 9 guards · 49,3 s · verdes 9 · no verdes 0 |
| **`CI=1 npm run guards:visuales`** | **`EXIT=0`** | 9 guards · 48,1 s · verdes 9 · no verdes 0 |

Los tres imprimen la misma última línea: `✅ los 9 guards de navegador están verdes.`

> `main` se midió en **detached** (`git checkout --detach origin/main`) para no mover la rama
> local: otra sesión puede tenerla.

## 2 · LOS DOS TEXTOS COMPARADOS, no los dos veredictos

`diff` de las salidas íntegras de main y de la rama: **20 líneas distintas, TODAS de cronómetro**.

```
<    ✔ guard:contraste              9.8 s   arranque   0.4 s   verde
>    ✔ guard:contraste              7.0 s   arranque   0.3 s   verde
<    9 guards · 51.5 s en serie   ·   verdes: 9 · no verdes: 0
>    9 guards · 49.3 s en serie   ·   verdes: 9 · no verdes: 0
```

**Ni una diferencia de contenido.** Ningún guard cambia de veredicto, ninguno cambia de mensaje.

Y hay un dato que lo hace más limpio de lo esperado: **`origin/main` está en `775bf7e0`, que es
exactamente el SHA del que salió mi rama.** O sea que la única diferencia entre las dos
ejecuciones es **mi único commit** (formato de importes en el PDF + su test). Comparación sin
ruido.

## 3 · LO QUE QUEDA DESCARTADO, con la medición delante

* **No es el contenido de ninguna rama.** Main limpio da el mismo texto que la rama.
* **No es el flag `--no-sandbox`.** `argsDeAislamiento` (`_navegador.mjs:125`) los añade sólo con
  `env.CI`; forzando `CI=1` en local **también sale verde**. El camino de CI se ejecuta y pasa.
* **No es que mi rama toque algo del navegador.** SCRUM-625 sólo cambia cómo se escriben números
  en dos PDF; no toca `public/`, ni la landing, ni ningún guard.

## 4 · SOBRE LA HIPÓTESIS DEL ASESOR — **no cae, pero tampoco queda demostrada**

La hipótesis era `_servidor.mjs` (SCRUM-620), estrenándose en el runner. Medido:

* **`_servidor.mjs` YA ESTÁ en `775bf7e0`**, o sea en main y en las tres ramas afectadas. No es una
  diferencia entre ellas — pero **sí puede ser una diferencia entre el runner y lo de antes**.
* **Los NUEVE guards lo importan.** Medido: `guard-a11y-comparativa`, `guard-a11y-landing`,
  `guard-aviso-bizum`, `guard-caja-avisos`, `guard-cls-barra-anuncio`, `guard-contraste`,
  `guard-objetivo-tactil`, `guard-primera-pantalla`, `guard-vias-de-cobro`.
* Entró en main con `7eef46cc` (1-sep-2026), *«SCRUM-620 (1/2 · DIAGNOSTICO): codigo 4 y sitio
  unico para levantar el servidor»*.

> **Que los nueve pasen por él explicaría por qué tres PR de contenidos que no se tocan fallan
> igual.** Es la vía más plausible que he encontrado. **Pero no la puedo confirmar**: en local
> arranca bien, y sin el log del runner no sé con qué código sale allí.
>
> Así que la hipótesis **sobrevive a esta medición y sigue siendo hipótesis**. No la convierto en
> dato, que es exactamente lo que pediste.

## 5 · EL VOCABULARIO DE CÓDIGOS, para poder leer el log del runner

Es lo que hace falta para que el rojo de CI signifique algo. Cada número es un diagnóstico:

| Código | Significa | Dónde se decide |
|---|---|---|
| **0** | todos los guards verdes | `guards-visuales.mjs` |
| **1** | **un guard encontró un defecto de verdad** | `guards-visuales.mjs:169` |
| **2** | «NO SUPE MIRAR» — no hay navegador, o la lista de guards salió vacía | `guards-visuales.mjs:101,108` · `SALIDA_NO_ENCONTRADO` (`_navegador.mjs:98`) |
| **3** | el navegador **no arranca** | `SALIDA_NO_ARRANCA` (`_navegador.mjs:100`) |
| **4** | **no se pudo levantar el servidor** | `SALIDA_SIN_SERVIDOR` (`_servidor.mjs:39`) |

🔴 **La pregunta que resuelve el ticket es: ¿con qué código sale el runner?**

* Si sale **1**, hay un defecto real que en Windows no se reproduce.
* Si sale **2, 3 o 4**, el guard **no llegó a medir** — y entonces el rojo no es de nadie, es de
  infraestructura. **El 4 apuntaría directo a `_servidor.mjs`** y confirmaría la hipótesis.

Ese número está en el log de CI y **yo no lo tengo**. Con él, esto se cierra en un minuto.

## Lo que NO puedo concluir, y por qué

* **No sé por qué falla en el runner.** No he visto su log ni tengo acceso a él.
* **No puedo descartar un defecto real específico de Linux.** Local es Windows + Edge; el runner es
  `ubuntu-latest` y `_navegador.mjs` resuelve otro binario. Un defecto que sólo se dé allí pasaría
  invisible en las tres mediciones de arriba.
* **No he reproducido el entorno del runner.** Haría falta Linux; no lo hay aquí.

## Lo que NO se ha hecho

* **No se ha relajado ni un guard.** Ni excepción, ni `skip`, ni umbral tocado.
* **No se ha arreglado nada.** Es una medición, y el arreglo —si el guard resulta estar midiendo
  mal— es otro ticket con esto delante.
* **No se ha tocado `main`**: `main` se midió en detached, sin mover la rama.

## Lo siguiente, concreto

1. **Coger el código de salida del job `guards de navegador` en cualquiera de los tres PR** y
   leerlo con la tabla del punto 5. Es un número y decide el ticket.
2. Si es **2, 3 o 4** → esto es SCRUM-626 (y probablemente SCRUM-620), no es de ninguna rama, y las
   tres se desbloquean juntas.
3. Si es **1** → hay un defecto real que sólo se da en Linux, y entonces sí hace falta reproducir
   el entorno del runner.
