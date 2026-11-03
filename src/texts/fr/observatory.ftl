### Ce que partagent les chapitres de « L'Observatoire » : la description
### des services, la page de la galerie et son code (Node.js). Les chemins,
### les noms d'unités et les messages des outils ne sont pas traduits.

observatory-gallery-description = Galerie photo du club d'astronomie (Node.js)
observatory-stacking-description = Empilement des photos de la nuit (stack-night)

observatory-gallery-page =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Club d'astronomie — galerie</title></head>
    <body>
    <h1>Notre ciel</h1>
    <p>Les Géminides, 13-14 décembre : 214 météores comptés depuis le terrain du club.</p>
    <p>La nébuleuse d'Orion (M42), 3 h de pose. Jupiter et ses lunes.</p>
    </body>
    </html>

observatory-server-js =
    // La galerie du club : une petite appli Express. Chaque page
    // redimensionne les photos qu'elle montre (sharp) : il lui faut un
    // processeur pendant que les membres la parcourent.
    const express = require('express');
    const sharp = require('sharp');

    const app = express();
    app.use('/photos', express.static('/srv/skygallery/photos'));
    app.get('/', async (req, res) => {"{"}
      res.send(await page(await thumbnails('/srv/skygallery/photos')));
    {"}"});
    app.listen(8080, '127.0.0.1');
