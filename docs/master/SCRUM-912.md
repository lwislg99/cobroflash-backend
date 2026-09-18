# SCRUM-912 · Leer con IA la foto del ticket de gasto (mitad de SERVIDOR)

**Fecha:** 18-sep-2026 · **Carril:** S1 (servidor; la pantalla de gastos es de S2, y reducir la foto antes de subirla es SCRUM-947, también de S2)
**Medido contra:** `origin/main` = `972b51b384e0b21e0265787392eb5c865b98cc4a` · 2026-09-18T11:38:29Z (hora de GitHub)
**Tanda:** 7690 tests, 7575 pass, 4 fail, 111 skipped, sobre 910 ficheros de `tests/` — corrida sobre la rama con `origin/main` = `34d06bb4f4e306b11745cf34fbbc85233c5a3299` mergeado (18-sep-2026, turno exclusivo de la Sesión 1). Rojos: 3 de `scrum939b`, conocidos y ajenos (Windows, sobre main puro), y 1 mío (`scrum864c`: `mide.mjs` creaba un temporal sin borrarlo), arreglado y 4/4 verde corrido solo.
**Condición del fundador que no se negocia:** Gemini GRATIS, sin coste nuevo, **sin respaldo con Claude** (SCRUM-934 cerrado, Jira 15883).

---

## PASO 0 (Jira 15928)

1. **Imagen: sí, misma clave y mismo endpoint.** Petición ≤ 20 MB; JPEG/PNG/WEBP/HEIC/HEIF; 258 tokens por trozo de 768×768 px.
2. **Gratis solo sin facturación enlazada** («Tier 1: link an active billing account» → se cobra). El fundador lo comprobó en AI Studio: proyecto «Default Gemini Project», **nivel gratuito, sin facturación**.
3. **Cupos reales del proyecto** (captura de AI Studio del fundador, 18-sep, nivel gratuito; por minuto / tokens por minuto / por día):

   | modelo | cupo |
   |---|---|
   | gemini-3.5-flash-lite y gemini-3.1-flash-lite | 15 / 250K / **500** cada uno |
   | gemini-2.5-flash-lite | 10 / 250K / **20** |
   | gemini-2.5-flash (el de los presupuestos), 3, 3.5, 3.6, 3.7 y 3.8 Flash | 5 / 250K / **20** cada uno |
   | Gemma 4 26B y 31B | 30 / **16K** / 14,4K |
   | gemini-2-flash, 2-flash-lite, 2.5-pro, 3.1-pro | **0** |

   Google cuenta la cuota **por proyecto Y por modelo**. La medición pública del 2-sep-2026 (500/día para los Flash-Lite) resultó cierta para los 3.x y **no** para 2.5 Flash-Lite (20). Ids de API comprobados en la ficha de cada modelo (estables; imagen y salida estructurada, sí).
4. **Tamaño, medido en staging sin credenciales** (sonda de solo lectura, cuerpos de 1 KB / 1,9 MB / 2,2 MB / 5 MB): `/admin/expenses` y cualquier ruta nueva debajo dan 401 / 401 / **413** / **413**. El parser global de 2 MB corta ANTES de la auth. `/admin/albaranes` (8 MB) da 401 en los cuatro. → **El servidor no necesita nada más para SCRUM-947**: la lectura recibe la misma foto que el panel reducirá para guardarla.
5. **Hallazgo previo, NO de 912:** `public/privacidad.html` §5 nombra a Anthropic como encargado de la IA y **no nombra a Google**, que la hace desde el 6-jul. Lo abre el orquestador como ticket legal aparte.

---

## Lo que se construye

* `src/integrations/gemini.ts` — **aditivo**. `GeminiParams.images` (partes `inline_data`, delante del texto), `GeminiParams.models` (lista propia de quien llama) y `geminiCompleteConModelo` (dice QUÉ modelo contestó). `GeminiError.quotaIds` lee `error.details[].violations[].quotaId` de un 429. **Sin `images` ni `models`, la petición sale exactamente igual que antes**: lo prueba el test «lo aditivo» y siguen verdes los 25 de `scrum683`/`scrum683b`, que exigen que el dictado viaje SOLO como texto.
* `src/modules/expenses/domain/lecturaTicket.ts`:
  - `MODELOS_LECTURA = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']`: solo modelos con cupo **medido y distinto de 0**, cada uno con el suyo (500 + 500 + 20 al día). **Nunca** `gemini-2.5-flash`, ni como último recurso: sus 20 diarias son de los presupuestos (decisión del orquestador). Gemma 4 no entra: con 16K tokens/min puede no caber una foto; queda como candidato a medir.
  - `LECTURAS_TICKET_POR_DIA = 5` por merchant y día natural de Madrid, en memoria como el tope de `ai.routes.ts` (un despliegue lo pone a cero). **El número lo decide el fundador.**
  - `sanearLectura`: devuelve una propuesta con los nombres del `POST /admin/expenses`. **Lo que no cuadra se descarta y se dice** (`descartados: [{campo, motivo}]`). No se arregla: un 0,21 no pasa a 21 y un «12,10» no pasa a 12.10. El tipo de IVA sale del mismo `TIPOS_IVA_ES_BP` de la puerta del presupuesto, y además tiene que ser **entero**, porque `Expense.vatRate` es `Int`. Base + cuota tiene que dar el total con el céntimo de `TOLERANCIA_CENTIMOS`. Las fechas futuras (calendario de Madrid) y el NIF con el dígito de control mal (`validarNifEspanol`) se descartan: una letra mal leída en la foto acabaría en la ficha del proveedor.
  - `leerTicket`: llama a `geminiCompleteConModelo` **directo**. Nunca `ai.service.aiComplete`, que cae a Claude. El proveedor se propone **solo por NIF** y solo si casa con UNA ficha del merchant (filtrada por `merchantId`). `clasificarJustificante` con `vatDeducible: null`: **la IA nunca da un ticket por deducible**, como mucho «falta confirmar».
* `POST /admin/expenses/leer-ticket` `{ imagen: data-URL }` → `{ ok, propuesta, descartados, justificante, modelo }`:
  - **LEE y NO GUARDA** nada, y ni la foto ni lo leído van al log (el log solo lleva el código).
  - Mismo permiso que el alta (el técnico, en el almacén).
  - Solo **códigos**, ninguna frase (regla 30): `ai_not_configured` · `imagen_*` · `lecturas_agotadas` (nuestro tope) · **`ai_cuota_diaria_agotada`** («mañana sí») · **`ai_cuota_por_minuto`** · `ai_cuota_agotada` (Google no dijo cuál: no se adivina) · `ai_bad_key` · `ai_provider_error` · `ai_could_not_parse`.

## Cómo se ha probado

`tests/scrum912-leer-ticket-gasto.test.mjs`: 21 tests, **sin red y sin base**. Google se simula con `globalThis.fetch` y los proveedores con un doble. El test más importante: **sin `GEMINI_API_KEY` y CON `ANTHROPIC_API_KEY`, la ruta da 503 y no sale ni una petición.**

**Mutación** (`docs/master/evidencias/SCRUM-912/mutacion-912.mjs`, sobre el JS compilado; aborta si un texto a mutar no aparece exactamente una vez; restaura `dist/` y comprueba que queda byte a byte): **17 mutantes, 17 muertos**, cada uno por el test que le toca. Entre ellos: un respaldo que llama a Anthropic sin clave de Gemini; la lista de la lectura cayendo a `gemini-2.5-flash`; la lista propia ignorada; el `quotaId` sin leer; la diaria sin prioridad sobre la del minuto; el tope global en vez de por merchant; lo leído escrito en el log; la IA marcando deducible; el proveedor elegido entre dos fichas; la búsqueda sin `merchantId`.

### Lo que cazó la suite, y cómo se arregló (sin tocar un solo guard)

La primera tanda completa **no llegó a arrancar**: con 909 ficheros, la línea de comandos de Windows es demasiado larga, y el comando salió con código 0 igualmente. La segunda (patrón entre comillas, lo expande node) la paró Claude Code por falta de memoria del sistema, con 6.874 ok / 10 rojos medidos. De esos rojos, cinco guards eran por 912. Los rojos de 837 y 853 salieron verdes corriendo solos.

| guard | qué vio | arreglo |
|---|---|---|
| SCRUM-55 y SCRUM-365 | `POST /admin/expenses/leer-ticket` abierto al técnico y sin declarar | declarada en `TECNICO_ALLOWED` (`adminRouteDeclarations.ts`) con su motivo: es el permiso del alta, aprobado en el plan |
| SCRUM-627 | `t * 100` en `lecturaTicket.ts`: aritmética de IVA en un fichero nuevo | la regla va a `justificante.ts` (ya censado), con `tipoIvaDeGastoAdmitido` y `baseMasCuotaCuadra`; la lectura solo pregunta |
| SCRUM-411 | 6 exports huérfanos | 3 sin `export` (solo los usaba su módulo); 3 declarados en `_huerfanos-declarados.mjs` (`sanearLectura` como pieza interna; `MODELOS_LECTURA` y `ESQUEMA_LECTURA` como vocabulario) |
| SCRUM-237 | «la foto no está en el log» sin respaldo | positivo hermano: la foto SÍ viajó a Google en esa misma prueba |

## Lo que NO está medido, y lo que queda

* **Una lectura real**: no hay `GEMINI_API_KEY` en local. Después del despliegue, hasta 5 lecturas en staging (permiso del orquestador; la clave de staging es la de producción, así que gastan cupo real).
* **El cuerpo real de un 429 de Google**: el reparto diaria/minuto sigue el formato documentado (`QuotaFailure.violations[].quotaId`). Si Google no lo trae, sale `ai_cuota_agotada`, no una suposición.
* 🔴 **ENCENDERLO para usuarios reales espera al ticket de privacidad** (Google como encargado; lo firma el fundador). La ruta no tiene pantalla: la llama la de S2 cuando exista.
* Hallazgo para un PASO 0 propio, **no arreglado aquí**: el 2.º modelo de la lista por defecto de los presupuestos (`gemini-2.0-flash`) tiene cupo 0 en el proyecto. El día que los presupuestos pasen de 20, no tienen respaldo. Según la tabla, ese respaldo se puede hacer sin coste: la familia Flash tiene seis modelos de 20/día, cada uno con su cupo, y los dos Flash-Lite 3.x tienen 500.

---

## SCRUM-912b · Las lecturas reales en staging: NO llegaron al modelo

**Medido:** 18-sep-2026 ~12:32:50Z (hora de GitHub; el reloj local va ~5,5 min por delante y el JSON dice 12:38:21Z) · `origin/main` = staging `/version` = `effc107e047d34a5bc7d2f1cfc1c000952c2de19` · Sesión 1 (relevo) · rama `scrum-912b-lecturas-staging`.
**Turno:** POR EL CANAL, exclusivo, dado por el orquestador (cobroflash-backend-1c; su mensaje dice «~13:36Z», que no casa con la hora de GitHub de ~12:32Z). **SIN el lock de base**: `scripts/turno-staging.mjs` sale 2 por falta de `DATABASE_URL_STAGING` en este árbol, y buscar el fichero de credenciales lo denegó el clasificador; no se rodeó. `mide.mjs` va solo por HTTP.
**Queda en staging:** 1 `authSession` del `test-login` de `qa@staging.yaqu`.

### Resultado

| ticket | HTTP | ms | error | modelo |
|---|---|---|---|---|
| t1-completo-21 | 503 | 333 | `ai_not_configured` | — |
| t2-dos-tipos | 503 | 274 | `ai_not_configured` | — |
| t3-solo-total | 503 | 256 | `ai_not_configured` | — |

**Staging NO tiene `GEMINI_API_KEY`.** El 503 sale de la primera línea de la ruta (`if (!isGeminiConfigured())`, `expenses.routes.ts`), antes de contar el tope y antes de salir a Google: **cero cupo gastado, cero lecturas del tope de 5**. Lo que se sabía de antes («la clave de staging es la de producción», arriba y en el traspaso) **era falso o ha dejado de ser verdad**: no se había medido.

Lo que SÍ queda probado, por efecto y no por test: en el entorno desplegado sin clave la ruta contesta el código y no cae a Claude (staging no dio ni un 500 ni una lectura).

Lo que NO está medido y sigue abierto: **si Gemini lee bien importe, IVA y NIF**. Para medirlo hace falta una de dos, y las dos son del fundador: poner `GEMINI_API_KEY` en el servicio de staging de Railway (regla 9: directo en Railway), o permiso para las 3 lecturas contra yaqu.app con un merchant de prueba.

Evidencia: `docs/master/evidencias/SCRUM-912/lecturas-staging-18sep-sin-clave.json`.

### Dos defectos del instrumento, míos, arreglados en esta rama

1. **`tickets.mjs` escribía al importarse.** Su modo CLI miraba `process.argv[2]` a secas, y cuando lo importa `mide.mjs` ese argumento es el SHA: creó una carpeta `effc107e…/` con los tres HTML **dentro del árbol**. Borrada (la creé yo). Ahora solo actúa si es el script principal. Rojo visto en vivo (la carpeta apareció); verde medido: importado con un argumento no crea nada, y como CLI sigue escribiendo 3 ficheros.
2. **`mide.mjs` decía «3 lecturas gastadas»** con tres 503 que no llegaron a ningún modelo: una operación que no se ejecutó se leía como hecha. Ahora cuenta las que contestó un modelo y sale con 1 si son cero.
