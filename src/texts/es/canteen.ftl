### Lo que comparten los capítulos de «El Comedor»: la descripción de la
### unidad de la aplicación, su página y su código (Node.js). Las rutas, los
### nombres de unidades y los mensajes de systemd no se traducen.

canteen-menu-description = Menú y reservas del comedor (Node.js)

canteen-menu-page =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>El Comedor — el menú del día</title></head>
    <body>
    <h1>El Comedor</h1>
    <p>Hoy: sopa de lentejas, cuscús de verduras, crumble de manzana.</p>
    <p>Paga lo que puedas. Reserva tu sitio antes de las 11:00.</p>
    </body>
    </html>

canteen-server-js =
    // El menú y las reservas del Comedor: una pequeña aplicación Express.
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL {"}"});
    const app = express();

    app.get('/', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT dish FROM menu WHERE day = CURRENT_DATE');
      res.send(page(rows));
    {"}"});

    // La aplicación necesita su base de datos: sin ella, se para.
    db.connect()
      {"."}then(() => app.listen(Number(process.env.PORT), '127.0.0.1'))
      {"."}catch((err) => {"{"} console.error(err); process.exit(1); {"}"});
    db.on('error', (err) => {"{"} console.error(err); process.exit(1); {"}"});
