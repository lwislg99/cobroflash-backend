# SCRUM-859 · 59 entradas con ancla propia eran invisibles — y la lista que se movía sola

**Medido contra:** `origin/main` = `e8510c9c4ff7d6afab45c5e43c24ec641345b9d3` · 2026-09-15T14:45:57Z

**Carril:** instrumentos · registro · **Gate:** sin gate — corre en `npm test`

---

## Los seis números, re-medidos aquí y no heredados

| | el ticket | medido aquí | |
|---|---|---|---|
| ficheros de `docs/master/` | 495 | **496** | |
| encabezados `^# ` fuera de cercado | 878 | **882** | |
| entradas que veía el troceador | 725 | **729** | |
| **invisibles** | 153 | **153** | ✅ |
| **invisibles con ancla propia** | 59 | **59** | ✅ |
| **de ésas, con el ancla mal** | 8 | **8** | ✅ y fichero por fichero |

🔴 **Lo que prueba que no había discrepancia de criterio:** cuadraron EXACTOS los tres que
dependen del criterio —153, 59 y 8— y se movieron sólo los tres que dependen del **tamaño** de
`main`, que creció hoy (12 entradas nuevas en `docs/master/`, dos de esta misma sesión). El
crecimiento está entero en entradas **visibles**: los invisibles siguen en 153.

## 1 · El criterio derivado

Un `^# ` fuera de cercado es entrada **si su cuerpo trae `**Medido contra:**`**. No por cómo se
titule. Las seis formas que quedaban —`# TRAMO 2`, `# FASE B`, `# ═══ SEGUNDA ENTREGA`,
`# 10-ago-2026 · …`, `# ✅ PASO ③`, `# SESIÓN 4`— entran sin nombrarlas, y la séptima que alguien
invente también.

**Y no se traga las secciones internas:** los **94** encabezados sin ancla siguen invisibles. Si
el criterio se los tragara, el troceador partiría por cualquier sección de 496 ficheros y alguien
lo relajaría en dos semanas.

### 🔴 Un corte no puede dejar huérfano lo que cierra

El criterio, tal cual, causaba tres regresiones que el ticket no podía prever. `SCRUM-242.md`
abre con un **título de fichero** y el ancla vive en el encabezado siguiente; `SCRUM-356` y
`SCRUM-358` igual, con un preámbulo en medio. Cortar ahí partía el título de su propio cuerpo y
dejaba sin ancla a tres entradas que sí la tenían.

Se deriva del principio que el troceador ya declaraba —que nada quede fuera de alguna entrada—:
**el corte por ancla propia sólo se aplica si el trozo que se cierra ya trae la suya.** Un
`# SCRUM-<n>` o un APÉNDICE siguen cortando siempre.

## 2 · Los cuatro formatos que el guard aprende

`RE_ANCLA` **no baja el listón**: sigue exigiendo sha de 40 e instante con huso. Cambia dónde
acepta que estén escritos:

1. el ancla no abre la línea (va tras `**Fecha:** · `) — SCRUM-296, 297;
2. el instante va en la línea siguiente — las mismas dos;
3. hay un inciso entre el sha y el instante (`(mezclado dentro de la rama, AA2)`) — SCRUM-674,
   728, 814 ×2;
4. hay un inciso **después** del instante (`(anclado con ls-remote…)`) — SCRUM-296, 297.

Con eso, **dos entradas que estaban exentas dejan de necesitarlo**: `SCRUM-313#SEGUNDA ENTREGA`
y `SCRUM-745#APÉNDICE · FASE B` ya tenían su ancla, sólo que en un formato que el patrón no veía.
Los censos bajan: **27 → 26** (SCRUM-516) y **28 → 27** (SCRUM-532). Que un censo baje por una
mejora es lo que ese guard pide que se anote.

## 3 · Lo que se completó, y lo que NO

**Sólo dos expansiones de sha** — `SCRUM-358` (`7f826e6…` → 40) y `SCRUM-674` (`7bdb3a90` → 40).
Es lo que la cabecera de la lista bendice: *«lo que SÍ se puede recuperar sin inventar, SE
RECUPERA»*. El texto de las entradas no se toca.

🔴 **Ni una hora fabricada.** Llegué a derivarlas del commit del sha y **me corregí al medir
SCRUM-674**: allí el instante escrito es `17:10` y el del commit `16:16`. La convención es la
hora de **medir**, no la del commit — habría fabricado cinco mediciones, que es justo lo que este
guard existe para impedir.

## 4 · `INVISIBLE_HASTA_859`: un motivo que se cierra solo

Las cinco sin hora entran con **motivo propio**, no con `SIN_HORA`: el porqué no es que les falte
la hora, es que **el troceador nunca las vio**, así que nadie pudo pedírsela.

> 🔒 **Y el motivo es un conjunto CERRADO en cinco: un sexto uso tumba el guard.** Después de
> SCRUM-859 ya nada es invisible hasta SCRUM-859, así que nada escrito a partir de hoy puede
> alegarlo. Un límite declarado y no cerrado deja de ser advertencia y pasa a ser permiso.

Lo vigila `TOPE_INVISIBLE_HASTA_859`, no la memoria de nadie.

### ⛔ La opción descartada, escrita para que no vuelva

Convertir «falta la hora» en **aviso** en vez de rojo vale para estas 5 y **regala el permiso a
todas las de mañana**. Descartada explícitamente por el asesor. No se vuelve a proponer.

## 5 · El re-clavado por identidad

`EXENTAS` estaba indexada por **posición** (`SCRUM-242.md#5`). Las 59 entradas nuevas desplazaron
las 55 claves a la vez y tiraron cuatro tests del propio guard. Es la **sexta** vez que esta casa
se come lo mismo:

> 🔒 Referenciar por posición caduca. Referenciar por identidad no.

Las 55 pasan a `fichero#<título>`, traducidas **mecánicamente** (no a mano). Dos detalles medidos:

- **el título que devolvía el troceador venía recortado a 80** para los mensajes. Usarlo como
  identidad habría hecho que dos entradas con los mismos 80 primeros caracteres compartieran
  clave. La identidad usa la línea entera; el recorte se queda para el mensaje.
- **el título no es único siempre**: `SCRUM-300.md` repite dos. Se desempata con `~2`, `~3`… en
  el orden dentro de su fichero, y sigue siendo estable ante una inserción en otro sitio.

## Verificación

| control | resultado |
|---|---|
| 🔴 las 59 pasan de invisibles a vistas | ✅ ejecutado contra el troceador real |
| ✅ los 94 sin ancla siguen invisibles | ✅ |
| ✅ cada clave exenta apunta a una entrada real, **una por una** | ✅ 58/58 |
| 🔴 **insertar una entrada en medio no mueve ninguna clave** | ✅ ejecutado sobre `SCRUM-244.md`, en memoria |
| 🔴 y su control: por **posición** sí se habrían desplazado | ✅ |
| 🔴 una **sexta** que alegue el motivo hace caer el guard, **nombrándola** | ✅ ejecutado |
| 🔴 mutación: tope a 99 → vuelve el verde a la sexta | ✅ **2 rojos** |
| 🔴 mutación: volver a indexar por posición | ✅ **4 rojos** — los mismos cuatro |

Las dos mutaciones van declaradas en `MUTACIONES_QUE_ME_TUMBAN`; el fuente se restauró **byte a
byte**, verificado.

## 🔴 Dos cosas que quedan ESCRITAS y no se arreglan aquí

**a) La taxonomía del propio guard miente.** Las dos entradas etiquetadas `ANTERIOR_AL_GUARD`
—`SCRUM-231` y `SCRUM-264`— **no tienen ancla en absoluto**, así que no son «anteriores» a nada en
ese sentido: son `SIN_DATO` como las otras 33. Tocar esas etiquetas es otro carril (regla 9).

**b) El inventario que no existía, y el criterio que NO sirve.** Desglose de las 55 exentas por
motivo declarado: **35 `SIN_DATO` · 10 `SIN_HORA` · 6 `SIN_HORA_Y_SHA_CORTO` · 2 `OTRA_BASE` ·
2 `ANTERIOR_AL_GUARD`**.

Y se probó un criterio para derivar la lista en vez de enumerarla: *«exenta = ancla escrita antes
de que el guard empezara a exigir la hora»*. **Cubre 0 de 60.** El guard exige la hora **desde su
primer commit** (`b8487dbd`, 2026-08-03T13:15:27+02:00), así que no hay un «antes» que apadrinar:
33 de las 60 no tienen ancla siquiera, y las 27 restantes se escribieron después. Estas entradas
no están exentas por viejas, sino porque **el guard nunca las vio** — uno de los dos censos se
llama literalmente `TAPADAS_POR_EL_TROCEADOR`.

El único criterio que las cubriría a todas sería «el troceador no la veía», y ése **exentaría
automáticamente a las 59 que este ticket acaba de hacer visibles** y a todas las del próximo
ensanche: sería usar la exención para anular el trabajo. Queda escrito para que dentro de tres
meses nadie vuelva a proponer exactamente esto.

## Lo que NO se hizo

- **Ni una hora escrita que nadie midió**, ni derivada del commit.
- **No se reescribió el texto de ninguna entrada de máster**: sólo dos líneas de ancla, y sólo
  para expandir su sha.
- **No se subió ningún tope ni se relajó ningún guard** (regla 41): los dos censos **bajan**.
- **No se reabrió SCRUM-532**: su promesa sigue cumplida.
- **`src/` intacto** · cero dependencias (36) · cero estado o flag de producto (27).

> ⚠️ **Nota de tanda:** `scrum859-…` importa las funciones del troceador de
> `scrum267-…test.mjs`, que es donde se exportan. Importar un fichero de tests **ejecuta sus
> tests**, así que los 10 de SCRUM-267 corren también dentro de éste y el total de la tanda sube
> en 10. Se dice en vez de dejar que alguien lo descubra contando.

---

# APÉNDICE · SCRUM-859 (16-sep-2026) · Arreglo de paso en la rama SCRUM-839e: la mutación #2 apuntaba al fichero equivocado

**Medido contra:** `origin/main` = `e7f155755446b2a848688cd59ba25c8d9bb9fb26` · 2026-09-16T19:03:49Z

**Rama:** `scrum-839e-solo-pr-armados` (commit `9f396783`). El trabajo de esa rama es la pieza A de
SCRUM-839 (ver `docs/master/SCRUM-839.md`, apéndice 839e); esta entrada existe sólo porque el
guard SCRUM-854 exige expediente de cualquier ticket cuyo número abra el asunto de un commit de la
rama, y ese commit empieza por `SCRUM-859:` al nombrar el fichero que toca. Norma A7: se escribe
la entrada, no se relaja el guard.

## Qué pasó

El CI de `scrum-839e-solo-pr-armados` avisó en rojo en el job `meta-guard · los guards caen cuando
deben`: el test «SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave» (en
`tests/scrum859-identidad-y-motivo-cerrado.test.mjs`) quedaba MUDO frente a su propia mutación
declarada.

## Por qué

La mutación #2 de `MUTACIONES_QUE_ME_TUMBAN`, en ese mismo fichero, apuntaba a
`fichero: 'tests/scrum267-ancla-de-medicion.test.mjs'` y mutaba `entradasTroceadas()`. Pero el
test que dice cazar (`cae`) no llama a esa función: usa su propia reimplementación local
(`claves()`), declarada dentro del propio fichero. Mutar `entradasTroceadas()` no tocaba el camino
que el test ejercita, así que el guard quedaba verde sobre el defecto que dice vigilar.

## Qué se cambió

- `tests/scrum859-identidad-y-motivo-cerrado.test.mjs`: la mutación #2 re-apunta a
  `fichero: 'tests/scrum859-identidad-y-motivo-cerrado.test.mjs'`, sobre la línea real que
  `claves()` ejercita. Como `const id = identidadDeEntrada(e.tituloCompleto);` se repite tal cual
  en `entradasReales()` (mismo fichero), el `de` amplía el contexto a dos líneas (incluye la
  llamada a `trocearEntradas` justo antes) para que `.replace()` — que solo sustituye la primera
  coincidencia — no mute la ocurrencia equivocada.

No es un caso de «relajar el guard» (regla 41 del máster): la mutación apuntaba al fichero/línea
equivocados, no exigía de menos. Verificado por lectura de código en la sesión que hizo el
cambio (sin ejecución local de `node --test`, sin aprobación de sandbox para invocarlo con
argumentos); lo confirmó la propia CI al re-lanzarse con el push del commit `9f396783`.

## Lo que NO se hizo

- No se tocó `MUTACIONES_QUE_ME_TUMBAN` en ningún otro fichero ni ninguna otra mutación.
- No se relajó ningún guard ni se bajó ningún umbral.
- `src/` intacto.
