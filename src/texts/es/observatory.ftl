### Lo que comparten los capítulos de «El Observatorio»: las descripciones
### de los servicios, la página de la galería y su código (Node.js). Las
### rutas, los nombres de unidades y los mensajes de las herramientas no se
### traducen.

observatory-gallery-description = Galería de fotos del club de astronomía (Node.js)
observatory-stacking-description = Apilado de las fotos de la noche (stack-night)

observatory-gallery-page =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Club de astronomía — galería</title></head>
    <body>
    <h1>Nuestro cielo</h1>
    <p>Las Gemínidas, 13–14 de diciembre: 214 meteoros contados desde el campo del club.</p>
    <p>La nebulosa de Orión (M42), 3 h de exposición. Júpiter y sus lunas.</p>
    </body>
    </html>

observatory-server-js =
    // La galería del club: una pequeña aplicación Express. Cada página
    // redimensiona las fotos que muestra (sharp): necesita una CPU mientras
    // los socios la recorren.
    const express = require('express');
    const sharp = require('sharp');

    const app = express();
    app.use('/photos', express.static('/srv/skygallery/photos'));
    app.get('/', async (req, res) => {"{"}
      res.send(await page(await thumbnails('/srv/skygallery/photos')));
    {"}"});
    app.listen(8080, '127.0.0.1');
