import { route } from "lethil";
import { thuddar } from "../assist/index.js";

const routes = new route.gui("navPage", "/grammar");

routes.get({ url: "/", route: "grammar", text: "Grammar" }, async function(
	req,
	res
) {
	// var grammar = await assist.grammarMain();
	var result = await thuddar.main();
	res.render("grammar", {
		title: result.context.name,
		description: result.context.desc,
		keywords: result.pos.map(e => e.root.name).join(","),
		grammar: result
	});
});

routes.get("/:id", function(req, res) {
	thuddar
		.pos(req.params.id)
		.then(function(result) {
			if (Object.keys(result).length) {
				var keywords = result.kind.map(e => e.root.name);
				keywords.unshift(result.root.name, result.info.name);

				res.render("grammar-pos", {
					title: result.root.name,
					keywords: keywords.join(","),
					description: result.root.desc.replace(/'/g, ""),
					grammar: result
				});
			} else {
				res.status(404);
			}
		})
		.catch(function() {
			res.status(404);
		});
});

/*
const app = require('..');
const assist = require('../assist');
const routes = app.Router();

routes.get('/pos-:id', async function(req, res) {
  res.redirect(301, '/grammar/' + req.params.id.toLowerCase())
});
routes.get('/:id', async function(req, res) {
  var id = req.params.id;
  assist.grammarPos(id).then(function(grammar){
    if (Object.keys(grammar).length) {
      var keywords = grammar.kind.map(e=>e.root.name);
      keywords.unshift(grammar.root.name,grammar.info.name);

      // for (const parent of grammar.kind) {
      //   if (parent.hasOwnProperty('word')) parent.word=[];
      //   if (parent.hasOwnProperty('exam')) parent.exam=[];
      //   if (parent.hasOwnProperty('kind')) {
      //     for (const child of parent.kind) {
      //       if (child.hasOwnProperty('word')) child.word=[];
      //       if (child.hasOwnProperty('exam')) child.exam=[];
      //     }
      //   }
      // }
      // grammar.word=[];
      // grammar.exam=[];

      res.render('grammar-pos', {
        title: grammar.root.name,
        keywords: keywords.join(','),
        description: grammar.root.desc.replace(/'/g,""),
        grammar: grammar
      });
      // res.send(res.locals)
    } else {
      res.send('404-');
      // res.redirect('/grammar');
    }
  }).catch(function(){
    res.send('404+');
    // res.redirect('/grammar');
  });

});

routes.get('/pos-:id', async function(req, res) {
  var id = req.params.id;
  var grammar = await assist.grammarPos(id);
  if (Object.keys(grammar).length) {
    // var pos = grammar.pos[id];
    res.render('grammar-pos', {
      title: grammar.root.name,
      keywords: '0, 1'.replace(0,id).replace(1,grammar.root.name),
      description: grammar.root.desc,
      grammar: grammar
    });
  } else {
    res.send({'pos-not-found':id});
  }
  // var grammar = await assist.grammarPos(id);
  // res.send({'pos-not-found':grammar});

  // var grammar = await assist.grammar();
  // if (grammar.pos.hasOwnProperty(id)) {
  //   var pos = grammar.pos[id];
  //   res.render('grammar-pos', {
  //     title: pos.root.name,
  //     keywords: '0, 1'.replace(0,id).replace(1,pos.root.name),
  //     description: pos.root.desc,
  //     grammar: pos
  //   });
  // } else {
  //   res.send({'pos-not-found':id});
  // }
});

routes.get('/', async function(req, res) {
  var grammar = await assist.grammarMain();
  res.render('grammar', {
    title: grammar.context.name,
    description: grammar.context.desc,
    keywords: grammar.pos.map(e=>e.root.name).join(','),
    grammar: grammar
  });
});
*/
