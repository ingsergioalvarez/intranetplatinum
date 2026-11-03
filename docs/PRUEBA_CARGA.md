# Prueba de rendimiento y carga (A-62)

Mide cuántos usuarios simultáneos aguanta el servidor de la oficina (16 hilos, 60 GB de RAM, compartido con Odoo,
los servicios `cmc-*`, `pdr-*`, etc.). **Nunca toca la base de producción**: levanta una copia aparte
(`platinum-carga`, con su propio MySQL, red y volúmenes y tope de 4 núcleos por contenedor) y se borra al terminar.

## Qué simula

- Hasta **300 usuarios simultáneos** (máximo), por escalones de 25, 50, 100, 150, 200 y 300; 2 minutos por escalón.
- Reparto: 80 % guardias, 10 % supervisores, 2 % admin, 8 % clientes. Datos ficticios: 5 admin, 30 supervisores,
  240 guardias, 25 usuarios de cliente, 5 clientes y 30 sitios (`carga_*@carga.local`, contraseña `Carga2026xx`).
- Cada usuario virtual inicia sesión (bcrypt, el paso más caro) y repite lo que su pantalla consulta: avisos, estado
  de asistencia, sitios, tablero, lista del día, emergencias, usuarios, reportes. **Consulta cada 4 a 8 s** (la app real,
  cada 30 a 60 s): cada usuario virtual pesa como ~6 personas reales, así que 300 virtuales equivalen a una carga
  mucho mayor que 300 personas.
- Se detiene sola si más del 10 % de las peticiones fallan.

## Qué NO simula (hay que decirlo)

- Checadas con foto y verificación de rostro, subida de fotos de reportes y descarga de PDF.
- Envío real de push ni la sirena (eso corre en el celular).
- La emergencia en sí: el API limita a 10 alertas por minuto por IP, así que se prueba aparte con pocas.

## Pasos

1. **En la PC:** hacer commit y subir (`git archive --format=tar.gz -o platinum.tar.gz HEAD`,
   `scp -P 2255 platinum.tar.gz sergio@192.168.251.17:~/`).
2. **En el servidor:**
   ```
   tar -xzf ~/platinum.tar.gz -C ~/platinum && rm ~/platinum.tar.gz
   cd ~/platinum/deploy/carga
   docker compose up -d --build
   docker compose exec api npm run db:deploy
   docker compose exec api npm run db:seed
   docker compose exec api npx tsx prisma/carga.ts
   ```
   (`docker compose up --build` usa la caché de la imagen que ya existe: es rápido. No toca producción.)
3. **Prueba corta de humo** (25 usuarios, ~3 min). Debe terminar con `fallos` en 0 %:
   ```
   docker run --rm --network platinum-carga_default -v "$PWD/k6:/scripts" grafana/k6 run \
     -e BASE=http://api:4000 -e PICO=25 -e PASO_SEG=60 /scripts/escenario.js
   ```
4. **Prueba completa** (hasta 300, ~14 min). En **otra terminal** vigilar el servidor mientras corre:
   ```
   docker run --rm --network platinum-carga_default -v "$PWD/k6:/scripts" grafana/k6 run \
     -e BASE=http://api:4000 -e PICO=300 /scripts/escenario.js | tee ~/resultado-carga.txt
   ```
   ```
   docker stats platinum-carga-api-1 platinum-carga-mysql-1 platinum-api-1 platinum-mysql-1 odoo cmc-edge-agent
   ```
   Cada escalón dura 140 s (20 s de subida + 120 s sostenido): el minuto de la prueba dice en qué escalón se saturó
   (0-2:20 = 25 usuarios, 2:20-4:40 = 50, 4:40-7:00 = 100, 7:00-9:20 = 150, 9:20-11:40 = 200, 11:40-14:00 = 300).
   Si `platinum-api-1` (producción) o algún sistema ajeno se ve afectado, cortar con Ctrl+C.
5. **Borrar todo** al terminar:
   ```
   docker compose -p platinum-carga down -v
   docker image rm platinum-carga-api
   ```

## Cómo leer el resultado

- `fallos`: porcentaje de peticiones con error (debe ser < 2 %).
- `http_req_duration p(95)`: el 95 % de las respuestas tardó menos que esto (meta: < 1.5 s).
- Por endpoint: `login`, `g_estado`, `avisos`, `s_dia`, `s_tablero`, `a_usuarios`.
- `login_ms`: el inicio de sesión es el paso más pesado (bcrypt); importa sobre todo en el cambio de turno.
- Saturación = el escalón donde `fallos` o los tiempos pasan la meta. Con `docker stats`, se ve si el cuello es el
  procesador del API, el de MySQL o la memoria.

## Resultado (2026-11-03)

Servidor: Ryzen 7 7700X (16 hilos), 60 GB, compartido con otros sistemas. Copia aparte con tope de 4 núcleos y 8 GB.

- **300 usuarios virtuales** (≈ 1,800 personas reales en cuanto a consultas) durante ~14 min: **93,046 peticiones, 0 fallos**, ~107 peticiones/s sostenidas.
- **Consultas** (p95): avisos 11 ms, estado del guardia 110 ms, lista del día 52 ms, tablero 55 ms, usuarios 16 ms. Todas dentro de la meta.
- **Inicio de sesión: único punto fuera de meta.** p95 3.32 s (meta 3 s), promedio 1.0 s, máximo 3.95 s. Cada login cuesta ~200-350 ms de procesador (bcrypt de costo 12 en JavaScript puro, `bcryptjs`), y el API los atiende en un solo hilo.
- **Picos aislados** de 5 a 9 s en algunas consultas (máximos), mientras su p95 es de decenas de ms: coinciden con las subidas de usuarios, cuando muchos inician sesión a la vez. Es la hipótesis más probable; no se aisló con una prueba propia.
- Producción y los demás sistemas del servidor no se afectaron.
- **Límites:** base casi vacía (sin meses de checadas, bitácora ni reportes), sin checadas con foto/rostro, sin subida de fotos ni PDF.
- **Pendiente:** prueba de ráfaga de cambio de turno (240 logins en 10 s) y repetir con una base con datos de varios meses.
