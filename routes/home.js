const app = require('../');
const routes = app.Router();
const {visits} = require('./classUtilities');

routes.get('/', function(req, res, next) {
  new visits(req.ip).init(res.locals).then(function(){
    res.render('home', { title: 'MyOrdbok' });
  })
});

module.exports = routes;