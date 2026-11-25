# SCRUM-1778b · Aplicado en el máster el literal A FIRMADO de MEDIA-1 (`docs/YAQU_MASTER.md:660`): `kind:'document'` y `entityType` `customer`

**Medido contra:** `origin/main` = `7f5ea0138d9c7ca683ec903114940cff37613a60` · 2026-11-20T17:58:03Z

A9: sin fallo que generalice — el riesgo era teclear el literal o mover líneas que otros citan por fichero:línea. El guion copia el texto de la evidencia y se niega a escribir si la 660 no es la de §1; el recuento da 1 línea cambiada y 0 movidas. Mi único tropiezo fue pasarle a Jira el nombre del sitio en vez de su cloudId, y la herramienta lo rechazó con error

Carril J2 (solo documentos). Encargo del orquestador J (`cobroflash-backend-c7`), 20-nov-2026. Sesión `jv-j2dl`, rama `scrum-1778b-master-media-1`. La hora del ancla es la cabecera `Date:` de GitHub (`gh api -i zen`).

## 0 · Tramo a (sin registro propio)

La propuesta la hizo `jv-j2de` como SCRUM-1778a: el comentario SCRUM-1778 c.22209 y el fichero `docs/master/evidencias/SCRUM-1778/1778a-literal-propuesto.md` (PR #3267, merge `283c8c87a`). 1778a dejó dicho que el tramo de este registro lo escribía 1778b, después de la firma, y por eso el fichero nace aquí.

## 1 · La firma

SCRUM-1778 c.22238 (publicada por el orquestador J, no por el fundador): respuesta literal de Javier **«1-La que recomiendes»**, que es **A**. Queda firmado el literal A del fichero de evidencia, §2, con la fecha de la firma **20-nov-2026**. El mismo comentario autoriza una sola adaptación: la cláusula sobre SCRUM-1005b se ajusta a lo que sea cierto en la fecha de la firma, sin cambiar nada más del literal, y hay que decirlo.

## 2 · La única adaptación: la cláusula de 1005b, medida

El literal A dice «el código lo cumplirá con SCRUM-1005b: hasta entonces solo se escriben `photo` y `audio`». Esa frase se escribió cuando 1005b no estaba en main. Lo medido sobre `7f5ea0138`:

- `git log origin/main --grep=1005b`: está el merge del PR #3262 (`94e5b9183a7e23a0f9feb756cf4fbd3d7381db50`, `mergedAt` 2026-11-20T07:18:07Z según `gh pr view 3262`).
- **Se escribe:** en `src/modules/system/customerAdmin.ts:573` hay un `tx.attachment.create({ data: { ...where, … } })`, donde `where` es `whereDocumentosDe(...)`, que devuelve `{ merchantId, entityType: 'customer', entityId, kind: 'document' }` (`:484`).
- **Se llega por una ruta:** `POST /:id/documentos` (`customersAdmin.routes.ts:594`), que se monta en `/admin/customers` (`src/app.ts:599`).
- Control positivo del `git grep`: `entityType: 'albaran'` sale 5 veces en `albaranes.routes.ts`.
- **Sin medir:** si se llega desde una pantalla. 1005b se entregó «sin pestaña» (su commit `87c1a2a26` lo dice), y el máster habla del modelo, no de la pantalla.

Por eso la cláusula pasa a «el código lo cumple desde SCRUM-1005b (20-nov-2026)». La fecha es la del merge de #3262. Nada más del literal cambia.

## 3 · El diff del máster y los controles

Lo aplica `docs/master/evidencias/SCRUM-1778/1778b-aplica.mjs` (`node <guion> <raíz>`). El literal no se ha tecleado: el guion lo COPIA del bloque `text` de §2 de la evidencia, y antes de escribir comprueba cuatro cosas. Si cualquiera falla, sale con 1 y no escribe:

- el sha256 de la 660 con su `\n` es el de §1 (`a17ded30…3454`), y la línea es igual al bloque ANTES de §1;
- la frase vieja «Modelo: …» sale UNA vez en la línea;
- la cláusula de 1005b y `<fecha de la firma>` salen UNA vez en A.

Resultado: 1 línea distinta, 0 añadidas y 0 quitadas (`git diff --numstat` da `1 1`). `wc -l` da 1950 antes y después. CR = 0. El prefijo y el sufijo de la línea, fuera de la frase «Modelo: …», quedan byte a byte iguales (el guion lo comprueba). El sha256 de la 660 nueva es `9d5ed2052a66e34a5e575c8bc6f8792efaf1b2621fc5ea01fcc775505c14ab11`.

Control rojo: el mismo guion sobre el máster ya aplicado sale «PARA: sha256 de la 660 no es el de §1», con salida 1, y `cmp` dice que el fichero queda intacto. Una segunda pasada no puede aplicar el literal dos veces.

## 4 · Lo que NO se toca aquí

Los siete puntos que 1778a §6 dejó sin redactar siguen igual: el título «Foto y audio», el punto (d) del alcance, la privacidad de los documentos, «Job» frente a `albaran`, la parte S (RGPD y permisos) y la duda del art. 30 del CCom. Cada uno pide su propio literal y su propia firma. Ningún código y ningún guard.

**Sin medir:** yaqu.app (es el máster, no hay superficie que ver); el check obligatorio de este PR, porque lo abre y lo arma el bot después del empujón.

## SCRUM-1778a · J2 · literal propuesto (A y B) para MEDIA-1, sin aplicar (escrito a posteriori en 1839c)

**Medido contra:** `origin/main` = `123311beb24600b1db04371f83e3a67113e58de1` · 2026-11-25T01:51:45Z

Lo escribe J4 en SCRUM-1839c, por encargo del orquestador del equipo de Javier. El tramo «0 · Tramo a (sin registro propio)» de este registro ya cuenta de dónde salió la propuesta, pero su cabecera no nombra «1778a» y la regla de Jira SCRUM-1839 c.22677 no la cuenta. Esta cabecera junta lo que dicen git y la entrega; no añade medición.

- **Qué entró:** el commit `1235598d7799ea94f9cd17c9c0b5695fb157b188`, con un solo fichero: `docs/master/evidencias/SCRUM-1778/1778a-literal-propuesto.md` (+82).
- **Con qué PR:** #3267, merge `283c8c87ae78212e0b83eae35ec3dad746106d66` (Jira, SCRUM-1778 c.22247).
- **Qué se midió** (entrega en Jira, SCRUM-1778 c.22209, 2026-11-20 07:02:17Z, jv-j2de): «Guards 1294, 267, 273, 525d y 854: 38 de 38, sin fallos ni saltos.»
- **Lo que 1778a NO hizo:** aplicar el literal. Lo dice su commit: «El máster no se toca: lo firma Javier y lo aplica 1778b.» Lo aplicó 1778b, el tramo que abre este registro.

A9: comprobación → `tests/scrum1839-letra-con-tramo.test.mjs`
