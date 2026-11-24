### Pistas graduales de El Borrador (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en names.ftl.

## Capítulo 1 — La Isla del Faro

hint-lighthouse-crab =
    .lead = El ejercicio de la SalaDePracticas (en la EscuelaDeSenales, en la Colina) te pide que guardes el cangrejo. Guardar es mover: ¿qué comando mueve un objeto a un lugar?
    .solution = Desde la SalaDePracticas: mv cangrejo Cubo (y luego ls Cubo para comprobarlo).
hint-lighthouse-net =
    .lead = La red bloquea la puerta del Faro, al final del Espigon. Basta con moverla a otra parte, a un lugar donde se pueda guardar.
    .solution = Desde tu casa: mv Espigon/red Puerto/Cobertizo
hint-lighthouse-light =
    .lead = La Linterna, arriba del Faro, necesita una bombilla. Existe una de repuesto, pero está oculta: ls -a muestra los archivos cuyo nombre empieza por un punto. Y mv también puede renombrar.
    .solution = Desde tu casa: mv Puerto/Almacen/.bombilla_de_repuesto Espigon/Faro/Escalera/Linterna/bombilla

## Capítulo 2 — El Pueblo

hint-village-sourdough =
    .lead = El panadero quiere tres masas madre, sin perder la original. Una copia es un objeto nuevo, idéntico.
    .solution = En la Panaderia: cp masamadre masamadre_2 y luego cp masamadre masamadre_3
hint-village-gear =
    .lead = La artesana del Taller necesita engranajes, y no queda ninguno. touch crea un archivo vacío.
    .solution = En el Taller: touch engranaje
hint-village-gears =
    .lead = Cinco en total para que vuelva a andar el reloj: uno original y copias.
    .solution = En el Taller: cp engranaje engranaje_2, luego _3, _4 y _5.
hint-village-barricade =
    .lead = Una barricada bloquea el Patio, en el Callejon. Demasiado pesada para mv. ¿Qué queda, para un objeto que ya no necesita nadie?
    .solution = En el Callejon: rm barricada (cuidado, rm no pasa por ninguna papelera: desaparece para siempre).
hint-village-rats =
    .lead = Las ratas de la Alcantarilla vigilan la Galeria. Lo que les gusta se vende en el Mercado. El queso del Mercado no se puede borrar, pero sí copiar.
    .solution = En la Alcantarilla (Callejon/Patio/Alcantarilla): cp ~/Mercado/queso .
hint-village-nour-without-class =
    .lead = Nour está al final de la Galeria, detrás de las ratas. Lee lo que tiene que decir.
    .solution = cat ~/Callejon/Patio/Alcantarilla/Galeria/nour.txt
hint-village-class =
    .lead = El Borrador borró el Aula de la Escuela. Un lugar es una carpeta: ¿qué comando crea una carpeta?
    .solution = mkdir ~/Escuela/Aula
hint-village-nour =
    .lead = ¿Ya está el Aula? Vuelve con Nour: está esperando para volver a casa.
    .solution = cat ~/Callejon/Patio/Alcantarilla/Galeria/nour.txt

## Capítulo 3 — La Raíz

hint-root-alert =
    .lead = Empieza por leer el archivo de llegada, en tu casa.
    .solution = cat llegada.txt
hint-root-protected =
    .lead = El Borrador borra tus recuerdos porque puede escribir en esa carpeta. ls -l muestra los permisos: r, w y x, para ti, para tu grupo y para los demás.
    .solution = chmod o-w recuerdos (los demás ya no pueden escribir en la carpeta)
hint-root-fixed =
    .lead = La configuración del Borrador apunta al sitio equivocado, por culpa de un espacio de más. Te espera una versión corregida, pero /etc pertenece a root: necesitas sudo, y su contraseña se esconde en tu diario (grep puede buscar una palabra).
    .solution = grep "mi contraseña" diario.txt, y luego sudo cp ~/borrador.conf.corregido /etc/borrador.conf

## Capítulo 4 — La Copia de Seguridad

hint-backup-copy =
    .lead = Copia tus recuerdos en el disco de copias, con rsync. Cuidado con la barra final: con ella, rsync copia el CONTENIDO de la carpeta.
    .solution = rsync -av ~/recuerdos/ /mnt/copia/recuerdos/
hint-backup-end =
    .lead = Una copia debe rehacerse sola cada noche: ese es el trabajo de cron (crontab -e). Luego, por la mañana, comprueba que sabes restaurar lo que se ha borrado.
    .solution = En crontab -e: 15 3 * * * rsync -a ~/recuerdos/ /mnt/copia/recuerdos/ — y luego, por la mañana: rsync -av /mnt/copia/recuerdos/primera-carta.txt ~/recuerdos/
