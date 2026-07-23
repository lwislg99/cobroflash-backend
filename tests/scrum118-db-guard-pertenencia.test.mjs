// SCRUM-118 — el guard anti-prod verifica PERTENENCIA (allowlist de host, parseado de
// verdad con new URL()), no un descarte de cadena (.includes()). Puro, sin BD — corre
// siempre en `npm test`. El caso que importa de verdad es el 2º: una URL de prod que NO
// contiene la cadena "autorack" (host rotado/pooler/IP) debe seguir siendo rechazada —
// exactamente el agujero que describe el ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeStagingUrl, STAGING_HOST, PROD_HOST } from '../scripts/_db-guard.mjs';

const STAGING_URL = `postgresql://user:pass@${STAGING_HOST}:40802/railway`;
const PROD_URL = `postgresql://user:pass@${PROD_HOST}:40654/railway`;

test('assertSafeStagingUrl: host de staging conocido → safe', () => {
  assert.equal(assertSafeStagingUrl(STAGING_URL, PROD_URL).safe, true);
});

test('assertSafeStagingUrl: host de prod real → rechazado', () => {
  const r = assertSafeStagingUrl(PROD_URL, PROD_URL);
  assert.equal(r.safe, false);
});

test('assertSafeStagingUrl: EL AGUJERO DEL TICKET — prod con un host DISTINTO (sin "autorack") también se rechaza', () => {
  // Simula exactamente lo que el ticket describe: Railway rota el host, o alguien usa un
  // pooler/IP/alias. La cadena "autorack" nunca aparece — un guard por .includes() habría
  // dejado pasar esto limpio. El allowlist por pertenencia lo rechaza igual, porque el
  // host no es el ÚNICO permitido, sin importar si "parece" prod o no.
  const otroHostDeProd = 'postgresql://user:pass@algun-otro-host.rlwy.net:5432/railway';
  const r = assertSafeStagingUrl(otroHostDeProd, PROD_URL);
  assert.equal(r.safe, false);
  assert.match(r.reason, /no está en la allowlist/);
});

test('assertSafeStagingUrl: URL malformada → rechazada, nunca "probablemente segura"', () => {
  assert.equal(assertSafeStagingUrl('esto-no-es-una-url', PROD_URL).safe, false);
  assert.equal(assertSafeStagingUrl('', PROD_URL).safe, false);
  assert.equal(assertSafeStagingUrl(undefined, PROD_URL).safe, false);
});

test('assertSafeStagingUrl: staging IDÉNTICA a la URL de prod configurada → rechazada (defensa en profundidad)', () => {
  assert.equal(assertSafeStagingUrl(PROD_URL, PROD_URL).safe, false);
});

test('assertSafeStagingUrl: sin prodUrl (parámetro opcional) el allowlist solo ya basta', () => {
  assert.equal(assertSafeStagingUrl(STAGING_URL).safe, true);
  assert.equal(assertSafeStagingUrl(PROD_URL).safe, false);
});

test('assertSafeStagingUrl: multi-BD en el MISMO host de staging (SCRUM-84) sigue siendo safe — el criterio es el host, no el nombre de la base', () => {
  const otraBaseMismoHost = `postgresql://user:pass@${STAGING_HOST}:40802/otra_base_scrum84`;
  assert.equal(assertSafeStagingUrl(otraBaseMismoHost, PROD_URL).safe, true);
});
