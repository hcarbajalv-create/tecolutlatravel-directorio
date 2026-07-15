# Plan de emergencia: qué hacer si el sitio se ve comprometido

Sigue estos pasos en orden si notas algo sospechoso: contenido cambiado que tú no publicaste, alertas de inicio de sesión desconocidas de Netlify/GitHub, o cualquier señal de que alguien más tiene acceso.

## 1. Detener la publicación

- Entra a [app.netlify.com](https://app.netlify.com/projects/tecolutla-travel) → pestaña **Deploys**.
- Ahí puedes revertir al instante a cualquier deploy anterior conocido como limpio (cada deploy pasado queda guardado — solo hay que volver a publicarlo).
- Si el problema parece venir de un cambio automático o de una integración conectada, revisa y desconecta esa integración desde **Site settings**.

## 2. Cambiar todas las contraseñas

- Cuenta de Netlify (y el correo/Google con el que entras: hcarbajalv@gmail.com).
- Cuenta de GitHub (donde vive el código: github.com/hcarbajalv-create/tecolutlatravel-directorio).
- El registrador del dominio, una vez que `tecolutlatravel.mx` esté comprado.
- Revisa también las sesiones activas / dispositivos conectados en cada una de esas cuentas y cierra las que no reconozcas.

## 3. Contactar al proveedor de hosting

- Soporte de Netlify: panel de ayuda dentro de app.netlify.com, o [answers.netlify.com](https://answers.netlify.com).
- Repórtales la actividad sospechosa — ellos pueden ver actividad a nivel de su infraestructura que nosotros no vemos desde aquí.

## 4. Restaurar desde el respaldo limpio más reciente

- **Código fuente**: está en GitHub (github.com/hcarbajalv-create/tecolutlatravel-directorio, rama `main`). Usa `git log` para ubicar el último commit confirmado como limpio, y trabaja desde ahí.
- **Sitio publicado**: en Netlify → Deploys, vuelve a publicar el deploy anterior conocido como bueno (ver paso 1).

## 5. Antes de reabrir todo con normalidad

- Trata de entender cómo entró el problema (¿contraseña filtrada?, ¿alguien más tenía acceso?) antes de solo "arreglarlo y seguir" — si no se cierra la puerta de entrada, puede repetirse.

---

Con respaldos automáticos (código en GitHub + historial de deploys en Netlify) en su lugar, todo esto se resuelve en horas, no en días.
