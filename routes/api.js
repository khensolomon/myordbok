import {route} from 'lethil';
import {config,search,speech,suggestion} from '../assist/index.js';

const routes = route('_','/api');

routes.get('/',
  /**
   * @param {any} req
   * @param {any} res
   */
  (req, res) => {
    res.send({
      name:config.name,
      version:config.version,
      development:config.development
    })
  }
);

routes.get('/search',
  /**
   * @param {any} req
   * @param {any} res
   * @param {any} next
   */
  (req, res,next) => {
    search(req).then(
      raw=> res.send(raw)
    ).catch(next)
  }
);

routes.get('/speech',
  /**
   * @param {any} req
   * @param {any} res
   */
  (req, res) => {
    res.set({
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Transfer-Encoding": "binary",
      "Pragma": "cache"
    });
    // res.setHeader("Content-Type", "audio/mpeg");
    // res.setHeader("Accept-Ranges", "bytes");
    // res.setHeader("Content-Transfer-Encoding", "binary");
    // res.setHeader("Pragma", "cache");
    speech(req.query).then(
      e => e.pipe(res)
    )
  }
);

// req.cookies.solId
routes.get('/suggestion',
  /**
   * @param {any} req
   * @param {any} res
   */
  (req, res) => {
    suggestion(req.query.q,res.locals.sol.id).then(
      raw => res.json(raw)
    ).catch(
      (e)=>res.status(404).end(e.message)
    )
  }
);

// routes.get('/grammar', (req, res) => {
//   assist.getGrammar().then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });

// // /orths-:name
// routes.get('/orth', (req, res) => {
//   // req.params.name req.query.name
//   assist.orthCharacter(req.query.name).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// // orthword orthord orthnse orthble ortheak
// routes.get('/orth-word', (req, res) => {
//   assist.orthWord(req.query.ord).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.get('/orth-sense', (req, res) => {
//   assist.orthSense(req.query.ord).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.get('/orth-syllable', (req, res) => {
//   assist.orthSyllable(req.query.str).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.get('/orth-break', (req, res) => {
//   assist.orthBreak(req.query.str).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });