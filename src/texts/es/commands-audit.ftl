### Comandos de auditoría (src/engine/commands/nmap.ts y lynis.ts): nmap y
### lynis responden en inglés, como las herramientas reales; aquí solo están
### los mensajes propios del juego.

nmap-none-target = WARNING: No targets were specified, so 0 hosts scanned.
lynis-without-root = Lynis necesita ser root para leer toda la configuración (prueba: sudo lynis audit system).
lynis-usage = Uso: lynis audit system  (mira man lynis)
lynis-audit-target = Aquí Lynis solo puede auditar «audit system» (recibido: «audit { $target }»).
lynis-command-unknown = lynis: «{ $command }» no es un comando que este juego conozca (mira man lynis).
