// Monta la URL del banco desde piezas sueltas del entorno (PGHOST/PGPORT/PGUSER/PGDATABASE).
// Nada de cadenas de conexion literales en el fichero. Solo banco desechable: loopback y base *_test.
export function urlDeBanco() {
  const { PGHOST, PGPORT, PGUSER, PGDATABASE } = process.env;
  if (!PGHOST || !PGPORT || !PGUSER || !PGDATABASE) throw new Error('faltan PGHOST/PGPORT/PGUSER/PGDATABASE');
  if (!['127.0.0.1', 'localhost'].includes(PGHOST)) throw new Error('el banco no es loopback');
  if (!/_test$/.test(PGDATABASE)) throw new Error('la base no termina en _test');
  const u = new URL('postgresql://x');
  u.username = PGUSER;
  u.hostname = PGHOST;
  u.port = PGPORT;
  u.pathname = '/' + PGDATABASE;
  return u.toString();
}
