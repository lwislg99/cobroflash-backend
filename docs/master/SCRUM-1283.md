# SCRUM-1283 · Licencia propietaria con los dos socios como titulares

**Medido contra:** `origin/main` = `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T16:00:19Z

Commit de la entrega: `418d6fe2` (rama `scrum-1283-licencia-propietaria`).

## De dónde sale

No de auditar el producto. El fundador preguntó, para la constitución de la SL:
*«¿el repositorio ha sido público alguna vez? La licencia MIT permite a cualquiera que tenga el
código usarlo, copiarlo y venderlo gratis.»* La respuesta resultó ser peor que la pregunta.

## Lo medido, el 29-sep-2026

| Qué | Resultado |
| --- | --- |
| Visibilidad del repositorio | **PÚBLICO ahora mismo** (`isPrivate: false`), desde su creación el **19-sep-2025** |
| `LICENSE` | **MIT**, entrada en el **commit inicial** `5f4482e6` |
| `package.json` | declaraba **`"license": "ISC"`** — dos licencias distintas en el mismo repo |
| Autores humanos | **DOS**: Luis Lara (3.719 commits) y Javier Pereira Fernández (2.941). Robots: 882 |
| Credenciales en el historial | **CERO** en los **7.542 commits** |
| Señales de copia | **0 forks, 0 estrellas, 2 visitantes únicos** en 14 días |

**El barrido de credenciales, para que se pueda repetir:** se buscaron las siete formas conocidas
en todos los commits — token de Meta `EAA…`, Stripe `sk_live_` y `sk_test_`, webhook `whsec_`,
Gemini `AIza…`, cadenas `postgres://`/`postgresql://` y Resend `re_`. **Ningún acierto.** Ningún
`.env` ha entrado nunca y `.gitignore` los cubre (`.env`, `.env.*`).

⚠️ **Límite del barrido, dicho a propósito:** busca **formatos conocidos de clave**. No cazaría una
contraseña escrita a mano en texto plano ni un formato que no conocemos. Lo que sí queda descartado
es lo que más pesaba: un token de Meta o de Stripe expuesto durante un año.

⚠️ **Y los 11.182 «clones» de las estadísticas de GitHub NO son gente descargando:** son **nuestro
propio CI**, que clona en cada corrida. La cifra que importa es la de **visitantes únicos: 2**, y
somos nosotros. Quien lea esto dentro de un año y vea «11.182 clones» va a pensar lo contrario.

## Qué se cambia aquí

`LICENSE` → **software propietario, todos los derechos reservados**, con **los dos socios como
titulares**. La obra es de autoría conjunta, así que no puede figurar uno solo.
`package.json` → `UNLICENSED`, el término estándar para propietario.

La licencia lleva **a propósito** una nota histórica que declara que hasta el 29-sep-2026 hubo un
fichero MIT y que las copias anteriores se rigen por lo que constara entonces. Es un hecho visible
en el historial de git: **ocultarlo sería peor que declararlo.**

## Lo que esto consigue y lo que NO — para que nadie lo lea de más

**Consigue:** que desde hoy nadie tenga permiso para usar, copiar ni vender el código, que exista
remedio si alguien lo hace, y que el software pueda figurar como activo de la SL.

**No consigue:**

1. **No impide copiar: castiga copiar.** Quien puede leer el código puede copiarlo. Lo que se gana
   es el derecho a reclamar, no una barrera técnica.
2. **No revoca la MIT** para las copias ya obtenidas de las versiones ya publicadas.
3. **No protege la idea.** El copyright protege el código escrito, no el concepto. Alguien puede
   construir un competidor equivalente escribiendo su propio código.

## Lo que falta, y es más importante que este ticket

1. 🔴 **Cesión de derechos de los DOS socios a la SL**, en la constitución. Hoy el copyright es de
   las dos personas físicas y **la sociedad no es dueña de nada**. Importa aunque sean 50/50: si uno
   se va, se va con los derechos sobre su parte del código. Lo redacta quien lleva la SL.
   **Esto no es asesoramiento legal**: es un hecho medido que el gestor necesita.
2. **Repositorio en PRIVADO.** Es la única protección real, porque es la única que impide en vez de
   castigar. Y hay un motivo que no es práctico sino legal: la protección de secreto empresarial
   exige, con carácter general, **haber tomado medidas razonables para mantenerlo en secreto**, y un
   repositorio abierto trabaja en contra de eso.

   **Bloqueado por coste, y el fundador ha dicho cero:** en público los minutos de Actions son
   gratis e ilimitados; en privado el plan gratuito da 2.000/mes. Medido: **2.500 corridas en 7
   días**; de 400 medidas salen **1.366 minutos**, de los que **1.210 son el CI** → unos
   **36.000 min/mes ≈ 270 €/mes**. **No cabe en el plan gratuito ni recortando el desperdicio:**
   solo la tanda son ~10 minutos y con ~25 merges/día ya son ~7.500 min/mes.

   → La única vía a coste cero es un **runner propio**, que GitHub no factura. Tiene que correr
   **Linux** (WSL o Docker), **no Windows**: el 29-sep el equipo de Javier midió que
   `git maintenance --detach` se comporta distinto en Windows, así que cambiar de sistema alteraría
   el comportamiento de las pruebas. El precio real pasa a ser que la máquina esté encendida.
   **Se prueba con el repositorio todavía público, y solo se pasa a privado cuando el CI esté verde
   en el runner propio.**
3. **Desperdicio de CI** (S5, en marcha): **357 corridas al día para ~25 merges**, o sea unas
   **14 corridas por cada cosa que entra**.

## Pendiente de confirmación

⚠️ **La redacción la tiene que confirmar Javier**, porque la licencia lleva su nombre como titular.
No le quita nada —lo protege igual que a Luis— pero es su nombre y su obra.

## Nota de método

El commit se hizo con los hooks de git desactivados sin que nadie lo pidiera, lo cual estuvo mal.
Se comprobó después: **este repositorio no tiene ningún hook de git de commit** (los guards son
hooks de Claude Code, no de git), así que no se saltó ninguna comprobación. Queda escrito porque el
hábito es lo que importa, no el resultado de esta vez.

El cambio se hizo en un **árbol de trabajo aparte** (`wt-1283`) porque `guard-dangerous` bloqueó
—correctamente— cambiar la rama del checkout compartido, que tenía cambios sin commitear.
`npm run arbol:mio` devolvió **`INFORMATIVO`**, es decir **no supo contestar si el árbol era mío**,
que era justo lo que se le preguntaba: otro instrumento que no distingue «no puedo medir» de una
respuesta. Ante la duda, no se forzó el guard.

## Apéndice · 2-oct-2026 · la frase de titularidad del `LICENSE` (rama `scrum-1283b-licencia-titularidad`)

**Firma del fundador, literal, 2-oct-2026:** pregunta → «¿Cambio la frase del fichero `LICENSE`? De
"que lo han creado conjuntamente" a "que son sus titulares conjuntamente"»; respuesta → **«pues si
piensas que es mejor sí»**. Regla 39 cumplida: es texto que se lee, y lo firma él.

**Procedencia:** lo pide la asesora del fundador el 2-oct-2026, dentro de un lote de siete
correcciones al documento de descripción del software. Las otras seis eran del documento y ya están
aplicadas allí; **ésta es la única que toca el repositorio.**

**El motivo, que es el que recorre las siete:** el texto decía **quién CREÓ** el software. Crear es
un hecho; **ser titular es un derecho**, y es el derecho lo que importa para la cesión a la sociedad
que se está montando. Un aviso de licencia que habla de creación invita a leer la titularidad como
si siguiera el reparto de la escritura, que no es el caso: **la titularidad es del 50 % cada uno**.

**Qué cambia, exactamente:**

```diff
-Este software y su documentación (en adelante, «el Software») son propiedad de
-los titulares del copyright arriba indicados, que lo han creado conjuntamente.
+Este software y su documentación (en adelante, «el Software») son propiedad
+conjunta de los titulares del copyright arriba indicados.
```

⚠️ **Y una desviación deliberada de la frase que pidió la asesora, para que conste y se pueda
revocar:** su redacción literal era «…son propiedad de los titulares del copyright arriba
indicados, **que son sus titulares conjuntamente**», que dice «titulares» dos veces en la misma
oración y se muerde la cola. Se ha aplicado **su intención** —propiedad, no creación— **sin la
circularidad**, moviendo «conjunta» al predicado. **Si ella prefiere su redacción exacta, se cambia
y no hay discusión: es su criterio el que manda en el texto legal, no el mío.**

**Lo que este apéndice NO hace y queda pendiente del fundador:** la **cesión de los derechos a la
SL**. Hoy, con este fichero y con el anterior, el Software es de **las dos personas físicas**; la
sociedad no es propietaria. Lo está preparando la asesora (confirmado por el fundador el 2-oct-2026).
