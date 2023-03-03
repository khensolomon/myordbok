// NOTE: Please mind the reserved keywords (sql,mongo,Config,args,etc) in module.exports
// node command myordbok
// node run myordbok test
// node run  myordbok
// npm run myordbok
// process.argv.splice(2),__dirname
import core from "./core.js";
import "./assist/command.js";

const app = core.command();
app.environment();

// NOTE: on error
app.on("error", e => console.log("...", e));

// NOTE: on success
app.listen(e => {
	// const mus = app.memoryUsage();
	// for (var k in mus) console.log(`${k} ${Math.round(mus[k] / 1024 / 1024 * 100) / 100} MB`);
	// app.exit();
	console.log("...", e);
});
