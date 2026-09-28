# SCRUM-1228 · El 302 «sin certificado» de la AEAT, pasado por `sif.client.ts` real

**Medido contra:** `origin/main` = `c57f745d0f9f8424abc90e8a591d10fd81a00cad` · 2026-09-28T15:08:43Z

Sesión J5 (`jv-j5`), 28-sep-2026, por encargo del orquestador de Javier. Mide el hallazgo que
SCRUM-1225 dejó como «leído y NO ejecutado». **Ahora está ejecutado.**

**No se ha modificado nada del repositorio:** ni `src/`, ni una firma, ni un export. Se compiló
`dist/` de `origin/main` y se llamó a las funciones que ya están exportadas (`enviarSobre`,
`decidirTrasEnvio`, `MAX_INTENTOS`). La regla 38 permite leer y ejercitar; no hizo falta nada de la 40.
**No se ha usado ningún certificado:** `validarEndpoint` admite `http:` hacia loopback (*«el servidor
falso de los tests»*), y por ahí entra la respuesta fabricada.

## ① La respuesta real

Capturada con `curl -i` contra `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`,
sin certificado de cliente, el 28-sep-2026 a las 15:07:03Z. Un `POST` con cuerpo vacío y un `GET` dan
los **mismos 153 bytes** (sha256 `eb57d30758bca8ec5798a817b5e823bfe1b090b36cc4a8f3556b62876034bd82`):

```
HTTP/1.0 302 Moved Temporarily\r\n
Location: https://sede.agenciatributaria.gob.es/Sede/errores/erro4033.html\r\n
Connection: Keep-Alive\r\n
Content-Length: 0\r\n
\r\n
```

**Corrige una palabra de SCRUM-1225:** allí se dijo «302 hacia una página HTML». La respuesta **no trae
cuerpo** (`Content-Length: 0`); el HTML es la página a la que apunta el `Location`, y el cliente no
la sigue.

## ② Qué sale, ejecutado

Un servidor TCP en loopback escribe cada respuesta **byte a byte**. El caso A son los bytes reales de
①; **todos los demás los hemos fabricado nosotros**. Cada resultado se pasa por `decidirTrasEnvio`
con el mismo registro, encadenando `intentosPrevios`, hasta que deja de estar en `pending`.
**Población: 11 casos, 11 filas.**

| caso | origen | `enviarSobre` → | la cola hace |
|---|---|---|---|
| **A · 302 sin certificado** | **REAL** (AEAT, ①) | `sin_respuesta` · `interpretar` · `http_302:no_es_xml` | `pending@60s → @120s → @240s → @480s → manual_review` |
| B · 403 con HTML | fabricado | `sin_respuesta` · `http_403:sin_sobre_soap` | la misma |
| C · 401 vacío | fabricado | `sin_respuesta` · `http_401:no_es_xml` | la misma |
| D · 500 con HTML | fabricado | `sin_respuesta` · `http_500:sin_sobre_soap` | la misma |
| E · 502 de proxy con HTML | fabricado | `sin_respuesta` · `http_502:sin_sobre_soap` | la misma |
| F · 503 vacío | fabricado | `sin_respuesta` · `http_503:no_es_xml` | la misma |
| G · 200 con HTML | fabricado | `sin_respuesta` · `http_200:sin_sobre_soap` | la misma |
| H · cierra sin mandar nada | fabricado | `sin_respuesta` · `esperar_respuesta` · `ECONNRESET` | la misma |
| I · no contesta (espera de 1,5 s) | fabricado | `sin_respuesta` · `esperar_respuesta` · `timeout_1500ms` | la misma |
| **K1 · CONTROL** 500 + SOAP `Fault` | fabricado | `rechazado` · `soap_fault` | `rejected` al 1.º intento |
| **K2 · CONTROL** 200 + SOAP `Fault` | fabricado | `rechazado` · `soap_fault` | `rejected` al 1.º intento |

Los controles salen `rechazado`, así que **el instrumento distingue**: no es que todo salga
`sin_respuesta` por construcción de la sonda.

## ③ Qué significa

1. **Se confirma:** el 302 real de «no hay certificado» sale `sin_respuesta`, y eso significa «no
   sabemos si llegó».
2. **No es un bucle infinito, y se corrige el encargo en eso.** La cola reintenta 4 veces con
   backoff (60 + 120 + 240 + 480 s, **15 minutos**) y al 5.º intento pasa a `manual_review` con
   `requierePersona: true` (`MAX_INTENTOS = 5`, `sif.cola.ts`). Para siempre, no; pero hasta que para
   hace **cuatro envíos que no pueden salir bien**.
3. **Lo que llega a la persona no dice «certificado».** El `lastError` es
   `sin_respuesta:interpretar:http_302:no_es_xml`. El dato está (el `302`), pero la clasificación dice
   «red». Y **lo sufre cada registro por separado**: con un certificado caducado, cada factura nueva
   del merchant hace sus 5 intentos antes de llegar a una persona.
4. **Toda respuesta no SOAP cae en el mismo saco.** Las nueve filas de A a I, de «no tienes permiso»
   (302, 401, 403) a «la red falló» (reset, timeout) pasando por «el servidor falló» (500, 502, 503),
   toman **la misma decisión**. El código HTTP sobrevive en el `motivo` y en `httpStatus`, pero la cola
   no lo mira.
5. **Una nota sobre el entorno de pruebas**, que sólo vale para él: W3 de SCRUM-1225 (portada del
   Portal de pruebas) avisa, literal: *«Si se detectan usos que se consideren abusivos se podrán
   adoptar medidas para bloquear el acceso.»* Reintentar contra un 302 conocido es justo lo que no hace
   falta hacer allí.

## ④ Lo que NO se ha podido medir

- **Qué contesta la AEAT con un certificado PRESENTE pero inválido** (caducado, revocado, o de otro
  titular). Hace falta un certificado, y eso no se toca en una sesión. Puede ser un 302 como éste, un
  fallo en el apretón TLS (`etapa: tls`) o un SOAP `Fault`. La lista de errores de producción
  (`errores.properties`, sha256 `06519ceb…`, ver SCRUM-1211) tiene tres códigos de certificado:
  *«4108 = Error técnico al obtener el certificado.»*, *«4110 = Error técnico al comprobar los
  apoderamientos.»*, *«4112 = El titular del certificado debe ser Obligado Emisión, Colaborador
  Social, Apoderado o Sucesor.»* **SIN DETERMINAR** si llegan como `Fault` (y entonces el cliente ya los
  trata como `rechazado`, como K1 y K2) o de otra forma.
- **Las filas B a K2 son respuestas nuestras.** Ninguna sale de la AEAT: como anotó SCRUM-1225, su
  especificación no trae ni un ejemplo de respuesta. Miden qué hace nuestro código con esa forma, no
  que la AEAT la mande.

## ⑤ Para quien construya (S1-D) — no lo hace J5

Es el camino de emisión, regla 40: **STOP para esta sesión.** Lo que hay que decidir, sin proponer la
forma:
- qué códigos HTTP significan «no vuelvas a intentarlo, avisa a una persona» (el 302 medido; y
  probablemente 401 y 403) frente a «inténtalo luego» (reset, timeout, 502, 503);
- y qué texto le llega a esa persona. Si lo ve el profesional, es texto de cara al usuario → firma
  (regla 39).

## ⑥ La sonda, para repetirla

Sobre `dist/` compilado (`npm run build`) de un árbol en `origin/main`. Se lanza con
`node sonda302.mjs <ruta del repo> <carpeta con real302-post.raw>`. Script sha256
`4e9b13aa8172ad4b5625678a4b0f913de64d4bbb139c15be900e7598cd62f967`, fuera del repositorio. Lo esencial:

```js
const cli = await import(pathToFileURL(`${REPO}/dist/modules/fiscal/verifactu/sif.client.js`).href);
const cola = await import(pathToFileURL(`${REPO}/dist/modules/fiscal/verifactu/sif.cola.js`).href);
// por cada caso: net.createServer que, al recibir datos, hace s.end(bytes) (A = real302-post.raw);
// H destruye el socket; I no contesta nunca.
const res = await cli.enviarSobre({ endpoint: `http://127.0.0.1:${port}/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`,
  cuerpoSoap: '<sonda/>', traza: () => {}, timeouts: { esperarRespuestaMs: 1500 } });
let previos = 0;
for (let i = 0; i <= cola.MAX_INTENTOS; i++) {
  const d = cola.decidirTrasEnvio([{ registro: REG, intentosPrevios: previos }], res).registros[0];
  if (d.estado !== 'pending') break;
  previos = d.intentos;
}
```

Salida: `exit=0`, `"poblacion": 11`, once filas (las de ②).
