import {config,route,parse} from 'lethil';
import {language} from './assist/index.js';

const routes = route();

if (config.development){
  import('./webpack.middleware.js').then(
    mwa => {
      routes.use(mwa.dev);
      routes.use(mwa.hot);
    }
  )
}

routes.use(
  /**
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  function(req, res, next){
    // res.setHeader( 'X-Powered-By', 'lethil' );
    const l0 = language.primary;
    var Id=l0.id;

    if (req.cookies.solId || req.cookies.solId != undefined) {
      Id=req.cookies.solId;
    } else {
      res.cookie('solId', Id);
    }

    const [name,solName] = req.url.split('/').filter(e=>e);
    if (name == 'dictionary' && solName) {
      var l1 = language.byName(solName);
      if (l1 && l1.id != Id) {
        Id = l1.id;
        res.cookie('solId', Id);
      }
    }
    // res.locals.app_locale = locale;

    res.locals.appName = config.name;
    res.locals.appVersion = config.version;
    res.locals.appDescription = config.description;

    if (req.headers.referer){
      var ref = parse.url(req.headers.referer);
      res.locals.referer = req.headers.host == ref.host;// || config.user.referer.filter((e)=>e.exec(ref.host)).length > 0;
      res.locals.host = ref.protocol+'//'+req.headers.host;
    }

    res.locals.sol=language.byId(Id)||l0;
    next();
  }
);

/**
 * org: restrictMiddleWare
 */
routes.use(
  '/api',
  /**
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  function(req, res, next){

    if (res.locals.referer) return next();
    res.status(404).end();
    // if (req.xhr || req.headers.range) next();
  }
);
