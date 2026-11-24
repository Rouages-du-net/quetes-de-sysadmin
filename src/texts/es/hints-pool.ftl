### Pistas graduales de La Piscina (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el comando
### exacto) y .solution (casi la respuesta).

## Capítulo 1 — El pod que no arranca

hint-wont-start-pods =
    .lead = Lista los pods de la aplicación de reservas, en su namespace (la nota de Rui lo dice), y mira su STATUS (man kubectl).
    .solution = kubectl get pods -n swim
hint-wont-start-pull-error =
    .lead = Pregunta a Kubernetes por qué no arranca el pod nuevo: lo dicen los Events al final de su descripción.
    .solution = kubectl describe pod NOMBRE -n swim (el pod en ImagePullBackOff)
hint-wont-start-tag-fixed =
    .lead = El registro no conoce la etiqueta que pide el Deployment: corrige la imagen en el manifiesto de Rui (su nota lista las versiones), y luego aplica el archivo.
    .solution = nano ~/manifests/booking.yaml (image: registry.pool.example/booking:2.3.1), luego kubectl apply -f ~/manifests/
hint-wont-start-crash =
    .lead = Vuelve a mirar el pod nuevo, unos segundos después: ¿funciona?
    .solution = kubectl get pods -n swim
hint-wont-start-logs =
    .lead = El contenedor se para solo: lee lo que mostró antes de pararse (man kubectl: logs, --previous).
    .solution = kubectl logs NOMBRE -n swim --previous
hint-wont-start-env-fixed =
    .lead = La aplicación pide una variable que la plantilla no le da: renombra la variable en el manifiesto, conservando su valor del ConfigMap, y aplica.
    .solution = nano ~/manifests/booking.yaml (- name: DATABASE_HOST en lugar de DB_HOST), luego kubectl apply -f ~/manifests/
hint-wont-start-rolled-out =
    .lead = Sigue el despliegue hasta que los pods nuevos sustituyan a los antiguos.
    .solution = kubectl rollout status deployment/booking -n swim
hint-wont-start-end =
    .lead = Todo lo que se ejecuta debe estar en los archivos (un segundo apply dice unchanged), y no puede quedar en el namespace ningún pod que nadie gestione.
    .solution = kubectl apply -f ~/manifests/ (todo unchanged), kubectl get pods -n swim (borra un pod tuyo con kubectl delete pod NOMBRE -n swim)

## Capítulo 2 — La recepción

hint-front-desk-not-found =
    .lead = Pide el sitio como lo haría un visitante, desde calle: Traefik escucha en el puerto 80, y distingue los sitios por la cabecera Host (man curl).
    .solution = curl -H 'Host: booking.pool.example' http://localhost/
hint-front-desk-ingress-port =
    .lead = Mira el Ingress en detalle: ¿a qué Service y a qué puerto envía? El registro de Traefik dice lo que opina de él.
    .solution = kubectl describe ingress booking -n swim, kubectl logs -n kube-system deploy/traefik
hint-front-desk-port-fixed =
    .lead = Un Ingress nombra un puerto del Service (port:), no el de los pods (targetPort:). Corrige ingress.yaml y aplícalo.
    .solution = nano ~/manifests/ingress.yaml (number: 80), luego kubectl apply -f ~/manifests/
hint-front-desk-no-endpoints =
    .lead = ¿Envía el Service a alguien? Sus endpoints son los pods que selecciona.
    .solution = kubectl get endpoints booking -n swim
hint-front-desk-selector-fixed =
    .lead = Compara el selector del Service con las etiquetas de los pods, y corrige el Service (no los pods).
    .solution = kubectl get pods -n swim --show-labels; nano ~/manifests/service.yaml (selector app: booking), luego kubectl apply -f ~/manifests/
hint-front-desk-not-ready =
    .lead = Los pods están Running pero no listos (0/1): sus Events dicen por qué.
    .solution = kubectl describe pod NOMBRE -n swim
hint-front-desk-probe-fixed =
    .lead = Encuentra la ruta a la que responde de verdad la aplicación (pruébala en la dirección de un pod, puerto 8080), corrige la sonda de disponibilidad en el manifiesto, aplica.
    .solution = curl http://IP_DEL_POD:8080/health; nano ~/manifests/booking.yaml (path: /health), luego kubectl apply -f ~/manifests/
hint-front-desk-end =
    .lead = El sitio a través de Traefik, una sonda de disponibilidad que pasa, ningún NodePort, y los archivos iguales a lo que se ejecuta.
    .solution = kubectl rollout status deployment/booking -n swim, luego curl -H 'Host: booking.pool.example' http://localhost/

## Capítulo 3 — El vestuario

hint-locker-room-config-read =
    .lead = Encuentra dónde está escrita la contraseña: en los ajustes de la aplicación, en el clúster y en los archivos.
    .solution = cat ~/manifests/config.yaml, o kubectl get configmap booking-config -n swim -o yaml
hint-locker-room-secret-created =
    .lead = Crea un Secret en el namespace swim con la nueva contraseña (el archivo de Kemal), sin escribirla en un archivo del repositorio (man kubectl: create secret generic).
    .solution = kubectl create secret generic booking-db -n swim --from-literal=password=LA_NUEVA_CONTRASENA
hint-locker-room-decoded =
    .lead = Mira lo que contiene realmente el Secret: sus datos están en base64. ¿Eso está oculto? (man base64)
    .solution = kubectl get secret booking-db -n swim -o jsonpath='{"{"}.data.password{"}"}' | base64 -d
hint-locker-room-referenced =
    .lead = Haz que el Deployment tome DATABASE_PASSWORD del Secret en lugar del ConfigMap, en booking.yaml (man kubectl: los ejemplos de env).
    .solution = nano ~/manifests/booking.yaml (valueFrom: secretKeyRef: name: booking-db, key: password), luego kubectl apply -f ~/manifests/
hint-locker-room-config-cleaned =
    .lead = Saca la contraseña del ConfigMap, pero conserva el ConfigMap: la aplicación sigue leyendo ahí su database_host.
    .solution = nano ~/manifests/config.yaml (quita database_password), luego kubectl apply -f ~/manifests/
hint-locker-room-restarted =
    .lead = Todos los pods en marcha deben haber arrancado con la nueva contraseña: un contenedor lee sus variables al arrancar.
    .solution = kubectl rollout restart deployment/booking -n swim, luego kubectl rollout status deployment/booking -n swim
hint-locker-room-committed =
    .lead = Los archivos de ~/manifests son un repositorio git: registra los archivos corregidos en un commit (man git).
    .solution = cd ~/manifests; git status; git commit -am "Contraseña de la base de datos en un Secret"
hint-locker-room-pushed =
    .lead = Kemal hace pull del repositorio compartido: envía tu commit allí.
    .solution = git push (en ~/manifests)
hint-locker-room-end =
    .lead = La nueva contraseña en un Secret que usan los pods, ninguna contraseña en el ConfigMap ni en los archivos, los archivos iguales a lo que se ejecuta, el commit subido.
    .solution = kubectl apply -f ~/manifests/ (todo unchanged), git status, git log -p (la contraseña antigua se queda en el historial: por eso se cambió)

## Capítulo 4 — La parte honda

hint-deep-end-oom =
    .lead = Los pods no paran de reiniciarse: pregunta a Kubernetes cómo terminó el último contenedor (su Last State).
    .solution = kubectl get pods -n swim, luego kubectl describe pod NOMBRE -n swim
hint-deep-end-top =
    .lead = Mide cuánta memoria usan ahora mismo los pods y el nodo (man kubectl: top).
    .solution = kubectl top pod -n swim, kubectl top node
hint-deep-end-history =
    .lead = ¿Qué ha cambiado desde la última competición? El Deployment conserva sus revisiones.
    .solution = kubectl rollout history deployment/booking -n swim
hint-deep-end-leak =
    .lead = Dale un poco de tiempo a la 2.4.0, y observa su memoria y lo que registra.
    .solution = kubectl top pod -n swim (dos veces, con un minuto de diferencia), kubectl logs deploy/booking -n swim --tail=5
hint-deep-end-rolled-back =
    .lead = Vuelve a la versión que aguantó la última competición, la 2.3.1: en el archivo (y kubectl rollout undo puede hacerlo enseguida, a la revisión correcta).
    .solution = kubectl rollout undo deployment/booking -n swim --to-revision=N, o nano ~/manifests/booking.yaml (image …:2.3.1) y kubectl apply -f ~/manifests/
hint-deep-end-limit-raised =
    .lead = Pon el límite de memoria por encima del pico que midió Rui (su nota), con margen, pero lejos del nodo entero.
    .solution = nano ~/manifests/booking.yaml (limits: memory: 320Mi), luego kubectl apply -f ~/manifests/
hint-deep-end-requests =
    .lead = Pon las requests de memoria en lo que usa habitualmente la aplicación con carga (kubectl top pod), por debajo del límite.
    .solution = nano ~/manifests/booking.yaml (requests: memory: 256Mi), luego kubectl apply -f ~/manifests/ y kubectl rollout status deployment/booking -n swim
hint-deep-end-end =
    .lead = La 2.3.1 desplegada con la carga de la competición, requests y limits razonables, y los archivos iguales a lo que se ejecuta.
    .solution = kubectl apply -f ~/manifests/ (todo unchanged), kubectl get pods -n swim, kubectl top pod -n swim
