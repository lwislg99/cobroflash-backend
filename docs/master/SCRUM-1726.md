# SCRUM-1726 · J1 · lo firmado el 12-nov: sello «(hora peninsular)», hoja de disputa y recordatorio con ventana

**Medido contra:** `origin/main` = `deab373d6a379fcbfc7ec1fce0428111156f49d3` · 2026-11-12T17:15:15Z

Firma: SCRUM-1656 c.21724 («Ok firmo todo») sobre la tanda c.21722. Sesión jv-j1dz. Jira: c.21754.

**Cabo ④ de SCRUM-1547 (sólo medido).** El handler real del paquete de disputa, con un doble de prisma
hecho de Proxy que registra cada campo leído y siembra centinelas: `toPhone` no se lee ni se imprime; del
mensaje sólo salen `createdAt, type, templateName, relatedType, relatedId, status` (control positivo:
`templateName`, ausente en el doble, aparece como centinela). Salen a propósito nombre, teléfono y email
congelados del cliente, y `ts, ip, ua, typedName` de la evidencia: quitarlos es decisión del fundador
(AA1.4) y no se toca aquí (orquestador J, por mensaje).

**Pieza 1 no es camino de emisión:** el sello vive en `generateQuotePdf` (AST) y `ambitoDeLaFactura`
no lo incluye. Construido: `invoicing/domain/selloTemporal.ts` (península → su zona y «(hora
peninsular)»; sin zona, zona rota o Canarias → «(hora del servidor)»), el pie 6 con «de la factura»
(«del justificante» sólo para `J-`), D1 (`fD` con `timeZone: zonaDelMerchant`) y D3 (`sendWhatsAppWindowFirst`
con el botón del automático byte a byte). El censo de fechas sin zona pasa `generateQuotePdf` y `fD` a
`RETIRADAS`. Pruebas: `tests/scrum1726-tanda-firmada-j1.test.mjs` y `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs`;
rojo primero en las cuatro piezas, 5/5 mutaciones vivas con `aplicarUna`, `tsc -p .` con tipos en 0.
NO medido: yaqu.app, la zona del proceso en Railway y la suite entera en local.

A9: aviso → cicatriz J1 «Crucé los 200k (277.528) al acabar el arnés de mutaciones: me medí al acabar el arranque y Jira, y no tras la tanda dirigida, el mismo fallo de SCRUM-1063k» — no se pudo comprobar: lo impediría un hook que mire el contexto en cada turno, y los hooks no son de este puesto

## SCRUM-1726-ci · el obligatorio de #3136 en rojo por un export sin llamador (jv-j1ei, 12-nov-2026)

**Medido contra:** `origin/main` = `29e862090a7bf0e0def63827244a49d7abe183e5` · 2026-11-12T18:14:11Z

Job 131357943241: 13.479 tests, 2 caen, los dos de `tests/scrum411-exports-inalcanzables.test.mjs`
(«CONTROL POSITIVO: los 190 de hoy…» y «las categorías SUMAN el total»: 245 declarados contra 246
medidos). El huérfano es `ZONA_PENINSULAR`, exportada por `invoicing/domain/selloTemporal.ts` y leída
sólo dentro de ese fichero. No era `isQuietHours` (la pista del encargo): ningún huérfano declarado ganó
lector. Arreglo de código, no de lista: la constante pierde el `export`. Rojo en local antes (25 tests,
2 caen, los mismos) y verde después (25/25).

Por qué la dirigida no lo vio: según c.21754 fue `scrum1470` + `scrum1093h` + `scrum1726` (45 casos), y
`scrum411` no estaba: barre todos los exports de `src/` sin nombrar ningún fichero, el mismo hueco que
`scrum622` en SCRUM-1336 (cicatriz J1 del 2026-10-01). Que `tests:que-cubren` lo liste o no: NO medido.
El defecto, en cambio, sí tiene quien lo pare antes de `main`, y lo paró:

A9: comprobación → `tests/scrum411-exports-inalcanzables.test.mjs`
