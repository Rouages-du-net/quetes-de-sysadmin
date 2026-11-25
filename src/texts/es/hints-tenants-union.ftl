### Pistas graduadas de El Sindicato de Inquilinos (ver src/engine/hints.ts):
### un mensaje por paso, hint-<capítulo>-<evento>, con .lead (una
### dirección, sin el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — Fuera de la vista

hint-out-of-the-open-history-seen =
    .lead = Antes de arreglar nada, mira lo que pudieron ver quienes visitaron la forja: cada versión de .env, en el historial del repositorio (man git).
    .solution = cd /srv/repairline; git log -p
hint-out-of-the-open-key-made =
    .lead = Para cifrar para ti, necesitas tu propia clave age, en el sitio donde sops la lee (man sops, man age-keygen).
    .solution = mkdir -p ~/.config/sops/age; age-keygen -o ~/.config/sops/age/keys.txt
hint-out-of-the-open-rule-written =
    .lead = Un .sops.yaml en la raíz del repositorio dice qué archivos se cifran, y para qué claves públicas: la del servidor (en el README) y la tuya.
    .solution = nano .sops.yaml: creation_rules:, luego - path_regex: \.env$ y age: CLAVE_DEL_SERVIDOR,TU_CLAVE (age-keygen -y ~/.config/sops/age/keys.txt muestra la tuya)
hint-out-of-the-open-encrypted =
    .lead = Cifra el archivo en el sitio: sops encuentra solo la regla en .sops.yaml.
    .solution = sops --encrypt --in-place .env; luego cat .env
hint-out-of-the-open-rotated =
    .lead = La contraseña antigua está en el historial para siempre: cámbiala donde se comprueba, en PostgreSQL, con su cuenta de administración.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'una-nueva-contrasena-larga'"
hint-out-of-the-open-deployed =
    .lead = Pon la contraseña nueva en el .env cifrado con sops, luego haz que deploy.sh descifre .env con la clave del servidor, y ejecútalo.
    .solution = sops set .env '["DB_PASSWORD"]' '"una-nueva-contrasena-larga"'; en deploy.sh: export SOPS_AGE_KEY_FILE=/etc/repairline/age.key y sops --decrypt .env > /etc/repairline/env; sudo ./deploy.sh
hint-out-of-the-open-committed =
    .lead = Confirma lo que los demás necesitan: el .env cifrado, .sops.yaml y deploy.sh. Nunca la contraseña en claro.
    .solution = git add .env .sops.yaml deploy.sh; git commit -m "Cifrar .env con sops y age"
hint-out-of-the-open-pushed =
    .lead = El voluntariado clona desde origin.
    .solution = git push
hint-out-of-the-open-end =
    .lead = Comprueba cada parte: la aplicación funciona, la configuración desplegada es solo de root, .env está cifrado para el servidor y para ti, origin tiene lo mismo.
    .solution = systemctl status repairline; ls -l /etc/repairline/env; sops -d .env; git log --stat -1; git status

## Capítulo 2 — Las llaves cambian de manos

hint-keys-change-hands-config-updated =
    .lead = Quién recibe los archivos nuevos lo decide .sops.yaml: pon la clave pública de Ikenna (en su mensaje), quita la de Makoa.
    .solution = nano .sops.yaml: cambia el age1… de Makoa por el de Ikenna
hint-keys-change-hands-keys-updated =
    .lead = Los archivos ya cifrados no siguen la regla solos: sops puede poner cada uno de acuerdo con ella (man sops).
    .solution = sops updatekeys .env, responde y; sops updatekeys mail.env, responde y
hint-keys-change-hands-data-rotated =
    .lead = La clave de Makoa podía abrir la clave de datos de los dos archivos: esa clave también tiene que cambiar.
    .solution = sops rotate --in-place .env; sops rotate --in-place mail.env
hint-keys-change-hands-rotated =
    .lead = Makoa leía la contraseña de la base de datos cuando desplegaba: cámbiala en PostgreSQL.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'otra-contrasena-larga'"
hint-keys-change-hands-deployed =
    .lead = La contraseña nueva va al .env cifrado, sin salir nunca de sops, y luego el despliegue.
    .solution = sops edit .env (o sops set .env '["DB_PASSWORD"]' '"otra-contrasena-larga"'); sudo /srv/repairline/deploy.sh
hint-keys-change-hands-committed =
    .lead = Confirma la regla y los dos archivos.
    .solution = git add .sops.yaml .env mail.env; git commit -m "Entra Ikenna, sale Makoa, claves nuevas"
hint-keys-change-hands-pushed =
    .lead = Ikenna clonará desde origin.
    .solution = git push
hint-keys-change-hands-end =
    .lead = Comprueba que la clave de Makoa ha desaparecido de todas partes, y que tu propia clave nunca salió de tu keys.txt.
    .solution = grep age1 .sops.yaml; sops filestatus .env; systemctl status repairline; ls -l ~/.config/sops/age/keys.txt
