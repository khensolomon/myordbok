/**
* NOTE: scan-secondary?font=KANNAKA_.TTF
* scan-external -> scan-{type}
* type -> primary, external, secondary
* $fontName -> add or remove from restriction
*/
// gsutil cp -r gs://storage.lethil.me/media/fonts
// gsutil cp -r gs://storage.lethil.me/media/fonts .
// gsutil -r gs://storage.lethil.me/media/fonts

import * as fs from 'fs';
import {seek,route} from 'lethil';
import fonts from '../assist/fonts.js';

// const {media} = core.config();
const routes = route('navPage','/myanmar-fonts');

routes.get(
  {url: '/:type?',route: 'fonts', text: 'Fonts'},
  /**
   * @param {*} req
   * @param {*} res
   */
  async function(req, res) {
    var fontType =  req.params.type;
    var fontName = req.query.font;

    const context = {title:'Myanmar fonts',description:'Myanmar Unicode and fonts',keywords:'Myanmar fonts'};
    try {

      var o = new fonts(fontType);
      await o.view(fontName).then(function(e){
        if (e instanceof Object){
          // context = e;
          Object.assign(context,e);
          if (context.unrestrict){
            context.type=fontType;
            context.download=fontName;
          }
        }
      });
      context.secondary = await o.read('secondary');
      context.external = await o.read('external');
    } catch (error) {
      console.log(error);
    }

    res.render('fonts', context);
  }
);

routes.get(
  '/download/:type?',
  /**
   * @param {*} req
   * @param {*} res
   */
  function(req, res) {

    var fontType = req.params.type;
    var fontName = req.query.font;

    new fonts(fontType).download(fontName).then(function(file){
      if (file && seek.exists(file)){
        res.setHeader('Content-disposition', 'attachment; filename=' + fontName);
        res.setHeader('Content-Type', 'application')
        fs.createReadStream(file).pipe(res);
      } else {
        res.status(500).end();
      }
    }).catch(function(e){
      res.status(404).end(e.message);
    });
  }
);

// routes.get('/scan-:type', function(req, res) {
//   var fontType = req.params.type;
//   var fontName = req.query.font;
//   new fonts(fontType).scan(fontName).then(function(e){
//     res.send(e);
//   });
// });
