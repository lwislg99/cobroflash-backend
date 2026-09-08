# SCRUM-637 · La rama que nadie mira: del ticket a su rama, y de la rama terminada al merge

**Fecha:** 8-sep-2026 · **Carril:** B · **Gate:** sin gate
**Medido contra:** `origin/main` = `24f8cb4dcfd1dba2c9d9d857880952639273f214` · 2026-09-08T07:09:58+01:00
**Tanda:** 6148 tests, 6043 pass, 0 fail, 105 skipped

**Sesión S3 · rama `scrum-637-la-rama-que-nadie-mira`**
**Compare:** https://github.com/lwislg99/cobroflash-backend/compare/main...scrum-637-la-rama-que-nadie-mira?expand=1

> ⚠️ El rojo corrido y las dos primeras corridas de los scripts que se citan abajo se midieron
> sobre `origin/main` = `2f123b70`, unos commits antes que el ancla de esta entrada. Se dice en vez
> de re-redondear los números: `main` se movió mientras se trabajaba —de ahí que una corrida diga
> 86 ramas fuera y otra 84—, y precisamente por eso el instrumento congela su sha en cada corrida.

---

## PASO 0 · Lo que YA estaba en `main`, y no se ha reconstruido

Dos de los tres instrumentos existían antes de esta sesión, rotulados SCRUM-637:

| fichero | qué contesta |
|---|---|
| `scripts/verificacion-s5/enlace-ticket-rama.mjs` | cuándo **discrepan** las cuatro fuentes del enlace: nombre de rama, mensaje de commit, `docs/master/SCRUM-n.md` y el asunto de Jira |
| `scripts/verificacion-s5/ramas-borrables.mjs` | qué ramas **ya están** en `main` y se pueden tirar |

Se han leído antes de escribir nada. **Ninguno se ha reescrito**, y `ramas-borrables.mjs` no se ha
tocado ni una línea — que es lo que garantiza, por construcción, que las mergeadas se sigan
listando igual que antes.

---

## 🔴 Punto 3 del ticket · ¿Están Jira y GitHub ya conectados?

El ticket lo marca como lo primero: *«Compruébalo antes de escribir una línea y dilo en el
informe, porque cambia el ticket entero»* — el precedente es `normalizePhone` en SCRUM-578, donde
la pieza ya estaba y sólo faltaba cablearla.

**Comprobado. La respuesta es NO: no hay nada que cablear.** Tres medidas, ninguna heredada:

| qué se preguntó | cómo | resultado |
|---|---|---|
| ¿hay enlaces remotos Jira→GitHub en tickets con rama y PR? | API de Jira, `remoteIssueLinks` sobre **SCRUM-614**, **SCRUM-595** y **SCRUM-713** | `[]` en los tres |
| ¿algún workflow del repo habla con Jira? | los cuatro de `.github/workflows/` (`ci`, `claude`, `vigia-despliegue`, `zona-roja`) | **cero** menciones de `jira` o `atlassian` |
| ¿existe ya la obligación de publicar la rama? | `CLAUDE.md` | **cero** menciones de «compare» |

⚠️ **El límite de esta medición, dicho para que nadie lo lea como más de lo que es.**
`remoteIssueLinks` es la API de *enlaces remotos*. El *panel de desarrollo* de Jira —el que pinta
ramas y PRs cuando la app de GitHub está instalada— se alimenta por otra vía que **esta sesión no
puede inspeccionar** desde aquí. Lo que sí se puede afirmar: **por las tres vías observables no hay
ningún enlace**, y el ticket nace precisamente porque nadie pudo ir de un ticket a su rama. Quien
tenga acceso de administración a Jira puede cerrar el resquicio en un minuto; si resultara que la
app está instalada, lo que cambia es el punto 1, no el 2.

**Consecuencia para el tamaño del ticket: no se encoge.** Había que construir.

---

## Lo que faltaba, y ahora está

### 1 · La lista que no existía — `ramas-sin-mergear.mjs`

**El defecto, medido corriendo el instrumento de hoy** (`ramas-borrables.mjs`, 8-sep-2026):

```
ramas vivas en el remoto: 553 · mergeadas en main: 467 · sin mergear: 86
```

De las 466 borrables imprime **las 466 por su nombre**. De las 86 que están esperando a alguien
imprime **el número `86` y nada más**: cero fechas en toda su salida —comprobado con `grep`— y cero
apariciones de `scrum-614-censo-rutas-sin-rol`, que ese mismo día era una rama sin mergear con
trabajo vivo.

> **Lo que se puede tirar se ve con detalle. Lo que espera a alguien no se ve.**

Ahora sí, la más vieja primero, con su URL de compare copiable:

```
  59 d  2026-07-10  chore-flujo-pr
             https://github.com/lwislg99/cobroflash-backend/compare/main...chore-flujo-pr?expand=1
```

**Es un fichero nuevo y no una sección más del otro, por tres razones:** aquél tiene `--ejecutar` y
**borra ramas de verdad** (mirar no debería obligar a ejecutar la herramienta que destruye); su
suelo está calibrado para la pregunta contraria; y un fichero que no se toca no puede regresionar.

**🔴 La clasificación NO se ha vuelto a escribir.** Es `instantanea()` + `alcanzabilidadDe()` de
`scripts/_censo-alcanzabilidad.mjs`, el motor de SCRUM-804, que ya resolvió el sha congelado (el
desajuste 454/453), la consulta a granel (0,30 s frente a 52,6 s) y el tercer valor «no se sabe».

**Y no duplica el censo de SCRUM-804:** aquél da un veredicto **por TICKET** cruzando ramas,
`docs/master/` y números; esto es una lista **por RAMA**. Una rama sin número —hay **18** hoy— no
tiene veredicto en 804 y sí sale aquí. Se comparte el clasificador, no la pregunta. Un test lo fija:
si este script empieza a mirar tickets o `docs/master/`, cae.

### 2 · La obligación, que era el punto 1 del ticket

`CLAUDE.md` § AA1.3bis: el informe de cierre lleva **el nombre exacto de la rama y su URL de
compare, copiada**. El ticket ya decía que esto *«ya se puede empezar hoy — lo que falta es que sea
obligatorio, no casualidad»*.

### 3 · 🔴 La red, que no existía

Los tres instrumentos **no tenían ni una línea de test**: ningún `tests/scrum637-*`, nada en
`package.json`. Un instrumento de medición sin red no se rompe ruidosamente — **empieza a devolver
listas vacías, y una lista vacía se lee igual que «no hay nada pendiente»**, que es exactamente el
estado que este ticket existe para hacer visible.

`tests/scrum637-la-rama-que-nadie-mira.test.mjs`: **18 casos, sin red y sin `fetch`**. Y los tres
scripts pasan a ser invocables (`npm run ramas:sin-mergear` · `ramas:borrables` · `enlace:ticket-rama`).

---

## Verificación

**🔴 ROJO CORRIDO** — corriendo el script de hoy, como pedía el encargo: `ramas-borrables.mjs` dice
`sin mergear: 86`, **cero fechas** en su salida y **cero** apariciones del nombre de una rama sin
mergear real. Hoy una rama de hace una semana no aparece con su edad en ningún sitio.

**🔴 Y EL TEST NO NACE VERDE** — dos defectos inyectados, dos rojos, restaurado byte a byte
(`Buffer.compare === 0`) las dos veces:

| inyección | cae |
|---|---|
| la URL se construye con el número del ticket (`…/compare/main...scrum-614`) — **el defecto original** | 🔴 «la URL lleva el NOMBRE REAL, no el número» |
| una fecha ilegible devuelve `0` en vez de `null` | 🔴 «una fecha ilegible da `null`, NUNCA 0» |

⚠️ **Y la primera inyección hubo que hacerla dos veces.** El primer intento perdió una barra al
escapar y dejó el patrón en `scrum-d+`, que no casa con nada: el script siguió correcto y el test
pasó en verde. **Un caso no está escrito hasta que se le ve caer** — el verde de un defecto mal
inyectado es indistinguible del verde de una red que funciona.

**✅ POSITIVO** — las mergeadas se siguen listando igual: `ramas-borrables.mjs` no se ha tocado, y
un test fija sus tres rasgos (deriva de las mergeadas, imprime por nombre, conserva `--ejecutar`).

**✅ NEGATIVO** — una rama que SÍ está en `main` no aparece como sin mergear: comprobado contra el
árbol real cruzando los dos conjuntos, con suelo por los dos lados (`>10` dentro, `>0` fuera) para
que «filtra bien» no se confunda con «no hay nada que filtrar».

**SUELO** — lista vacía ⇒ **ciego** y salida con 2, nunca «ya no queda trabajo pendiente». Con su
control negativo: con datos normales **no** se declara ciego, para que un suelo que siempre grita no
pase por bueno.

---

## Lo que queda fuera, y por qué

* ⬜ **El punto 1 completo** —que la rama se publique **en Jira**— sigue sin resolverse: se ha
  cerrado la mitad barata (la obligación en el informe). La otra mitad depende de si se instala la
  app de GitHub en Jira, que **no es decisión de una sesión**.
* ⬜ **Un aviso automático** cuando una rama pasa de N días. El ticket dice explícitamente *«esto es
  visibilidad, no automatización»* y *«no tocar el CI»*. La lista existe; quien quiera engancharla a
  un cron lo decide fuera.
* ⬜ **Las 18 ramas sin número de ticket** salen en la lista y nadie las reclama. Es el defecto que
  describe el comentario de Luis del 3-sep desde el otro lado. No es de este ticket.
