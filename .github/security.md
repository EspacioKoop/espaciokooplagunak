# Política de Seguridad y Escaneo de Secretos

## Activación de Secret Scanning
Este repositorio tiene activado **GitHub Secret Scanning** para prevenir la filtración accidental de credenciales.

### Qué se escanea
- Tokens de AWS, Azure, GCP
- Claves privadas SSH/PGP
- Tokens de GitHub, GitLab, Bitbucket
- Contraseñas de bases de datos
- API Keys de servicios terceros (Stripe, Twilio, etc.)

### Procedimiento ante alerta
1. **NO BORRAR EL HISTORIAL**: Si se filtra un secreto, rotarlo inmediatamente en el servicio origen.
2. Marcar la alerta como "resolved" en GitHub solo tras la rotación.
3. Si es un falso positivo, documentarlo en este archivo.

### Configuración requerida (Admins)
- Ir a `Settings` > `Security & analysis`.
- Activar `Secret scanning` y `Push protection`.
- Habilitar `Block commits with secrets` para la rama `main`.

Closes #726

Firmado: Teseo (Qwen3.5)
