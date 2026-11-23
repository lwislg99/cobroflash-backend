# SCRUM-1778a · literal PROPUESTO para MEDIA-1 (`docs/YAQU_MASTER.md:660`) — SIN APLICAR

**Medido contra:** origin/main `b0b7cf9970e7b4202f547a11e1d09add4ffca971` (20-nov-2026), puesto J2, sesión `jv-j2de`.

Es una PROPUESTA (reglas 27 y 35: el máster solo lo cambia el fundador). `docs/YAQU_MASTER.md` NO se
toca en esta rama. Cuando Javier firme A o B en SCRUM-1778, el PR solo del máster lo hace 1778b, que
escribe también el tramo de `docs/master/SCRUM-1778.md`. Decisiones de origen: SCRUM-1005 c.22140
(topes, tipos, borrado con el cliente) y c.22192 (✅ al cambio de máster).

## 1 · ANTES (literal de `origin/main`, línea 660 entera)

Sacado con `git show origin/main:docs/YAQU_MASTER.md | sed -n '660p'`: 539 B con el salto de línea,
sha256 `a17ded309bfcc495ee7680a6c413194d84ba2bd550ed439ba34e3e95ae6c3454` (de la línea con su `\n`).
La línea es el párrafo entero de MEDIA-1 (la 659 es el título `## MEDIA-1 · Foto y audio`); el trozo
que cambia es solo la frase «Modelo: …».

```text
Alcance: (a) foto de la avería adjunta a QuoteRequest (desde bot y portal); (b) audio del cliente por WhatsApp → STT → `description` del QuoteRequest [VALIDAR proveedor: Whisper/Deepgram, ~0,01 €/min]; (c) fotos antes/después ancladas a Job. Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`. Gates: credenciales R2 + `BOT_INBOUND_ENABLED` (para b). Privacidad: fotos solo de la avería/trabajo (no personas); audio se borra ≤30 días tras transcribir; retención fotos 12 meses salvo Job activo.
```

## 2 · DESPUÉS — A (recomendada)

Sustituye SOLO la frase «Modelo: …». Lo demás de la línea queda byte a byte. Copia la forma de
SCRUM-1770b (`YAQU_MASTER.md:766-782`): texto nuevo con decisión, fecha y ticket; «el código la
cumplirá con …: hasta entonces …»; y la frase vieja anotada entre `*[…]*` con su fecha.
`<fecha de la firma>` lo rellena 1778b con la fecha del comentario de firma; no se inventa aquí.

```text
Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio'|'document', createdAt}`; `entityType` admite también `customer`, para los documentos de un cliente (`kind:'document'`: PDF, JPEG o PNG, 10 MB por fichero y 100 MB por cliente, y se borran con el cliente; decisión del fundador, 19-nov-2026, SCRUM-1005 c.22140 y c.22192; el código lo cumplirá con SCRUM-1005b: hasta entonces solo se escriben `photo` y `audio`). *[Modelo ampliado el <fecha de la firma> por SCRUM-1778. Decía: «Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`.»]*
```

## 3 · DESPUÉS — B (más corta)

```text
Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio'|'document', createdAt}`; `kind:'document'` va con `entityType:'customer'` (documentos del cliente; SCRUM-1005 c.22140 y c.22192, SCRUM-1778). *[Ampliado el <fecha de la firma>. Decía: «`kind:'photo'|'audio'`».]*
```

B no repite topes ni tipos (viven en c.22140 y en el código de 1005b) y no dice que hoy main aún no lo
escribe: más corta, pero el lector del máster no sabe que la línea va por delante del código.

## 4 · Diff unificado (A), sobre la línea 660

La línea es una sola; el diff la muestra entera. Lo único que cambia es la frase «Modelo: …».

```diff
--- a/docs/YAQU_MASTER.md
+++ b/docs/YAQU_MASTER.md
@@ -660 +660 @@
-Alcance: (a) foto de la avería adjunta a QuoteRequest (desde bot y portal); (b) audio del cliente por WhatsApp → STT → `description` del QuoteRequest [VALIDAR proveedor: Whisper/Deepgram, ~0,01 €/min]; (c) fotos antes/después ancladas a Job. Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`. Gates: credenciales R2 + `BOT_INBOUND_ENABLED` (para b). Privacidad: fotos solo de la avería/trabajo (no personas); audio se borra ≤30 días tras transcribir; retención fotos 12 meses salvo Job activo.
+Alcance: (a) foto de la avería adjunta a QuoteRequest (desde bot y portal); (b) audio del cliente por WhatsApp → STT → `description` del QuoteRequest [VALIDAR proveedor: Whisper/Deepgram, ~0,01 €/min]; (c) fotos antes/después ancladas a Job. Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio'|'document', createdAt}`; `entityType` admite también `customer`, para los documentos de un cliente (`kind:'document'`: PDF, JPEG o PNG, 10 MB por fichero y 100 MB por cliente, y se borran con el cliente; decisión del fundador, 19-nov-2026, SCRUM-1005 c.22140 y c.22192; el código lo cumplirá con SCRUM-1005b: hasta entonces solo se escriben `photo` y `audio`). *[Modelo ampliado el <fecha de la firma> por SCRUM-1778. Decía: «Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`.»]* Gates: credenciales R2 + `BOT_INBOUND_ENABLED` (para b). Privacidad: fotos solo de la avería/trabajo (no personas); audio se borra ≤30 días tras transcribir; retención fotos 12 meses salvo Job activo.
```

## 5 · Lo medido que sostiene la frase «hasta entonces»

- `git grep` en `origin/main` (`src/`): `Attachment` se escribe con `entityType: 'albaran'`
  (`albaranes.routes.ts:831`); ninguna línea de main escribe `entityType 'customer'` ni un adjunto
  `kind 'document'` (el único `kind: 'document'` de main es `whatsapp.ts:1138`, un `dryRunRecord` de
  envío de WhatsApp, no un `Attachment`). El control positivo es `'albaran'`, que sale.
- SCRUM-1005b (rama `scrum-1005b-documentos-cliente-servidor` @ `87c1a2a266a671991112a9b2379cfb9886dfa0e5`,
  PR #3262) **no está en main** el 20-nov-2026 (rojo de CI leído por el orquestador en SCRUM-1005 c.22201).
  Si 1005b entra antes que la firma, la cláusula «hasta entonces…» de A sobra y 1778b la quita.

## 6 · Lo que debería decirlo también y NO se propone tocar aquí (sin redactar)

1. MEDIA-1, título «Foto y audio» (línea 659): ya no cubre los documentos.
2. MEDIA-1, «Alcance» (a)-(c): no tiene un punto (d) para los documentos del cliente.
3. MEDIA-1, «Privacidad»: «fotos solo de la avería/trabajo (no personas)» y «retención fotos 12 meses»
   no dicen nada de documentos con datos personales ni de su retención.
4. MEDIA-1, destinos reales de `entityType`: el código escribe `albaran` (no `job`; SCRUM-1005 c.22125),
   y el máster dice «Job».
5. Parte S (RGPD): que la supresión de un cliente (RGPD-1, SCRUM-244) borra sus adjuntos `customer`
   (decisión c.22140), y su sitio en el registro de actividades de tratamiento, si lo hay.
6. Parte S (permisos): «ver y subir, todo el equipo; borrar, solo admin» (c.22192).
7. Pregunta abierta de SCRUM-1005a (c.22125, punto 4): si el art. 30 CCom alcanza a los documentos del
   cliente final. Sin respuesta del asesor; no se afirma.

## 7 · A9

A9: sin fallo que generalice — propuesta de documentos; mis dos tropiezos (un cloudId de Jira mal y el
contexto a 127.662 al acabar de leer Jira, al borde del tope de 130k del encargo) no tienen una
comprobación que añadir aquí: el primero se resuelve con la herramienta de recursos y el segundo ya lo
vigila el hook de contexto.
