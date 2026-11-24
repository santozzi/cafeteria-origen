# Reflexion Santiago De Dios 
- **No confiar en código generado sin revisión ("vibe coding"):** Las fallas de inyección SQL, falta de validación y contraseñas en texto plano surgieron por copiar código sin auditarlo. En un proyecto real debe haber revisión de código (*code review*) obligatoria antes de mergear.
- **Consultas parametrizadas y validación por defecto:** Usar siempre consultas parametrizadas (`$1`, `$2`) o un ORM/query builder seguro, y validar tipo, rango y listas blancas en el servidor (nunca confiar en el frontend) para evitar pedidos con montos negativos o filtros manipulables.
- **Almacenamiento seguro de credenciales:** Nunca guardar contraseñas en texto plano; usar algoritmos de hashing lento con *salt* por usuario (`bcrypt` o `argon2`) desde el primer día.
- **Pruebas automatizadas de seguridad en CI/CD:** Integrar análisis estático (`check:security`) y tests de seguridad (`test:seguridad`) en el pipeline de integración continua para detectar regresiones antes de llegar a producción.


# Reflexión Maitena Surop
- **Protección contra ataques de fuerza bruta:** Limitar los intentos de inicio de sesión mediante *rate limiting* para evitar que un atacante pueda probar contraseñas ilimitadamente. También es importante permitir nuevos intentos después del período de bloqueo.
- **Prevención de enumeración de usuarios:** Utilizar mensajes de error genéricos al iniciar sesión, sin indicar si el usuario no existe o si la contraseña es incorrecta. De esta manera se evita revelar información sobre las cuentas registradas.
- **Gestión segura de sesiones:** Utilizar identificadores aleatorios mediante `crypto.randomUUID()` en lugar de identificadores predecibles. Configurar cookies con `HttpOnly`, `Secure` y `SameSite`, además de establecer tiempos de expiración por inactividad y duración máxima.
- **Invalidación y cierre de sesiones:** Eliminar las sesiones anteriores al iniciar sesión y destruir la sesión almacenada en el servidor al cerrar sesión. No alcanza solamente con borrar la cookie del navegador.
- **Validación segura de contraseñas:** Comprendí la importancia de trabajar coordinadamente con el almacenamiento de credenciales mediante `bcrypt`. Mientras se utiliza `bcrypt.hash()` para guardar las contraseñas, el inicio de sesión debe utilizar `bcrypt.compare()` para verificar las credenciales sin almacenar contraseñas en texto plano.
- **Importancia de las pruebas de seguridad:** Realizar pruebas automatizadas permite comprobar que las medidas implementadas funcionan correctamente y detectar posibles vulnerabilidades antes de integrar los cambios en la rama principal.
