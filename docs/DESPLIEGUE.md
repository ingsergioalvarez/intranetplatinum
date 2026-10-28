# Despliegue de Platinum (F4-04)

Platinum corre en el servidor de la oficina (`192.168.251.17`, SSH puerto 2255) como un proyecto de Docker
Compose llamado `platinum`, con nombres y volúmenes propios: no toca el escáner ni los demás contenedores.
Archivos en [deploy/](../deploy/). Decisión de la base de datos: D-008b.

| Contenedor | Qué es | Se ve desde fuera |
|---|---|---|
| `platinum-mysql-1` | MySQL 8.4, volumen `mysql-data` | No (solo la API lo alcanza) |
| `platinum-api-1` | API Node (tsx), volumen `uploads` con las fotos | No (solo el sitio web) |
| `platinum-web-1` | nginx con el build de la web; reenvía `/api` a la API | `127.0.0.1:5190` en el servidor |
| `platinum-tunnel-1` | `cloudflared` con el túnel propio `platinum` | `https://platinum.grupocomunicalo.mx` |

Túnel: `platinum` (id `fe51bf90-21ae-4768-9202-250300febaf3`, creado el 2026-10-28). El registro DNS
`platinum` debe ser un CNAME con proxy hacia `fe51bf90-21ae-4768-9202-250300febaf3.cfargotunnel.com`.
El archivo de credenciales (`~/.cloudflared/<id>.json`) es secreto: no va a git ni al chat.

## Primera vez

1. **En la PC** (después de hacer commit de lo que se quiere subir), desde la raíz del repositorio:
   `git archive --format=tar.gz -o platinum.tar.gz HEAD` y
   `scp -P 2255 platinum.tar.gz sergio@192.168.251.17:~/`
2. **En el servidor:** `mkdir -p ~/platinum && tar -xzf ~/platinum.tar.gz -C ~/platinum && rm ~/platinum.tar.gz`
3. `cd ~/platinum/deploy && cp .env.example .env`, y llenar `.env` (secretos con `openssl rand -hex 24`;
   `id -u` e `id -g` para `PLATINUM_UID` y `PLATINUM_GID`).
4. `docker compose up -d --build` (la primera vez tarda varios minutos).
5. Tablas y usuario administrador:
   `docker compose exec api npm run db:deploy` y `docker compose exec api npm run db:seed`
6. Revisar: `docker compose ps`; `curl -s http://127.0.0.1:5190/api`;
   `docker compose logs tunnel --tail 20` (debe decir que registró conexiones).
7. Quien administra Cloudflare apunta el CNAME `platinum` al target del túnel.

## Actualizar a una versión nueva

Repetir 1 y 2 (en la misma carpeta; el `.env` y los volúmenes se conservan: extraer encima), y
`cd ~/platinum/deploy && docker compose up -d --build`. Si hay migraciones nuevas:
`docker compose exec api npm run db:deploy`.

## Pendiente

- Respaldo automático de MySQL (`mysqldump`) y de las fotos (volumen `uploads`), con copia fuera del servidor.
- SMTP para correos y recuperación de contraseña.
