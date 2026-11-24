### ufw (cortafuegos): sus mensajes siguen la traducción española de ufw
### (Launchpad). Las palabras clave (allow, deny, incoming…) y los nombres de
### las acciones (ALLOW, DENY…) se quedan en inglés, como en el ufw real.

ufw-usage =
    Uso: ufw ORDEN (mira man ufw)
      enable | disable                 activar o desactivar el cortafuegos
      reload                           volver a leer /etc/default/ufw y las reglas
      default allow|deny|reject        política por defecto (entrante)
      allow|deny|reject|limit REGLA    añadir una regla (p. ej. ufw allow 22/tcp)
      delete REGLA|NÚMERO              borrar una regla
      status [verbose|numbered]        estado y reglas
      app list                         perfiles de aplicaciones
ufw-root = ERROR: Necesita ser root para ejecutar este script
ufw-missing = ERROR: ufw no está instalado en esta máquina
ufw-syntax = ERROR: Sintaxis no válida
ufw-idle = Estado: inactivo
ufw-status-active = Estado: activo
ufw-journalisation = Registro: activado (bajo)
# { $incoming }, { $outgoing }: allow, deny o reject (no se traducen)
ufw-defaults = Por defecto: { $incoming } (entrante), { $outgoing } (saliente), disabled (enrutado)
ufw-profiles = Perfiles nuevos: omitir
# Cabeceras de las columnas de ufw status
ufw-to = Hasta
ufw-action = Acción
ufw = Desde
ufw-everywhere = Cualquiera
ufw-question = El comando puede interrumpir las conexiones ssh existentes. ¿Continuar con la operación (s|n)?
# { $rule }: la regla, p. ej. «allow 22/tcp»
ufw-question-deletion =
    Borrando:
     { $rule }
    ¿Continuar con la operación (s|n)?
ufw-abandon = Abortado
ufw-active = El cortafuegos está activo y habilitado en el arranque del sistema
ufw-already-active = El cortafuegos está activo y habilitado en el arranque del sistema
ufw-disabled = El cortafuegos está detenido y deshabilitado en el arranque del sistema
ufw-default-incoming =
    La política entrante por defecto cambió a '{ $policy }'
    (asegúrese de actualizar sus reglas consecuentemente)
ufw-default-outgoing =
    La política saliente por defecto cambió a '{ $policy }'
    (asegúrese de actualizar sus reglas consecuentemente)
ufw-rules-updates = Reglas actualizadas
ufw-existing = Omitiendo la adición de una regla existente
ufw-rule-deleted = Regla eliminada
ufw-nonexistent = No se pudo eliminar una regla inexistente
ufw-number = ERROR: No se pudo encontrar la regla '{ $number }'
ufw-reloaded = Cortafuegos recargado
ufw-reload-skipped = El cortafuegos no está activado (omitiendo la recarga)
ufw-applications = Aplicaciones disponibles:
