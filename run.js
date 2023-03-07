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

app.listen(function(msg) {
	// const usage = app.memoryUsage();
	// for (var name in usage) console.log(usage, app.byteToMB(usage[name]), "mb");
	if (msg) {
		console.log("...", msg);
	}
});

app.close(function(error) {
	if (error) {
		console.log("...", error);
	}
	core.db.mysql.close();
});
