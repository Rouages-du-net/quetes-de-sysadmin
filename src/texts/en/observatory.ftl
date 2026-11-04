### What the chapters of "The Observatory" share: the services' descriptions,
### the gallery's page and its code (Node.js). Paths, unit names and the
### tools' messages are not translated.

observatory-gallery-description = Astronomy club photo gallery (Node.js)
observatory-stacking-description = Stacking of the night's photos (stack-night)

observatory-gallery-page =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Astronomy club — gallery</title></head>
    <body>
    <h1>Our sky</h1>
    <p>The Geminids, 13–14 December: 214 meteors counted from the club's field.</p>
    <p>The Orion Nebula (M42), 3 h of exposure. Jupiter and its moons.</p>
    </body>
    </html>

observatory-server-js =
    // The club's gallery: a small Express app. Each page resizes the
    // photos it shows (sharp): it needs a CPU while members browse it.
    const express = require('express');
    const sharp = require('sharp');

    const app = express();
    app.use('/photos', express.static('/srv/skygallery/photos'));
    app.get('/', async (req, res) => {"{"}
      res.send(await page(await thumbnails('/srv/skygallery/photos')));
    {"}"});
    app.listen(8080, '127.0.0.1');
