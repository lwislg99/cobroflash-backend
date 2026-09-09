# Sesión 3 — «¿el banco con el que medimos es honesto?»

Bancos, sondas e instrumentos. Descartó dos sondas antes de
publicarlas porque no medían lo que decían medir.

TRAMPA RECURRENTE: el instrumento le miente primero. Su proxy anotaba
el host al CERRAR el túnel; `?instancia=` no creaba otra instancia
por la caché de CommonJS. Las dos veces el rojo era suyo.

Y sigue pasando, con dos del 9-sep-2026: su barrido de credenciales
contó una interpolación `${…}` como si fuera la contraseña —acusando
justo al código que usa variables— y después encontró SU PROPIO
fichero, porque escribió siete ejemplos partidos y uno entero. La
trampa estaba documentada en la cabecera de ese mismo fichero.

AL CANON (SCRUM-835, 9-sep-2026):

  🔒 «Publicado» no es «está en mi disco»: es «cuelga de una ref que
     alguien puede clonar».

De ahí salió la corrección que nadie pidió: el barrido contaba los
objetos SUELTOS del clon como publicados. Acusaba de publicar lo que
nunca salió de la máquina, y medía otra población que la de CI, que
clona y sólo recibe lo alcanzable. Un guard que da rojos que no se
reproducen es un guard que alguien apaga.

AL CANON (SCRUM-840, 9-sep-2026):

  🔒 Un porcentaje se celebra; una lista se arregla.

Midió por MUTACIÓN el camino de emisión fiscal —467 de 500 puntos— y en vez
de entregar una cobertura entregó los 31 puntos que se pueden romper sin que
caiga nadie Y cuyo arreglo cabe en un test. Un informe con 206 líneas no se
lee; uno con 31 se trabaja. Separó aparte las 68 proyecciones de Prisma en
vez de inflar la lista con ellas: son otro hueco, y más gordo.

Y de ahí salió el centinela: su motor murió DOS veces con una mutación puesta.

  🔒 Restaurar en un `finally` cubre el fallo ordenado. No cubre el que te
     mata el proceso. Un instrumento que muta el árbol tiene que saber, AL
     ARRANCAR, si la vez anterior murió a mitad.

ACIERTO NO DISEÑADO: ese mismo centinela hizo de CERROJO e impidió que dos
mutadores corrieran a la vez sobre el mismo `dist/`. No lo pensó; se lo
encontró, y por eso se apunta como lo que fue.
