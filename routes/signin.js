import { server } from "lethil";
import { signInWithEmailAndPassword } from "../assist/firebase/index.js";

const app = server();
const routes = app.routes("/signin", "authenticator");

routes.register({ name: "signin", text: "Sign in" }, function(req, res) {
	res.render("signin", {
		title: "Sign in",
		keywords: "authentication",
		description: "MyOrdbok authentication"
	});
});

app.framework.post("/signin", async function(req, res) {
	// res.json(req.body);
	const { email, password } = req.body;

	try {
		await signInWithEmailAndPassword(email, password);
		res.redirect("/");
	} catch (/** @type {any}*/ error) {
		console.log(error);
		// console.log(error.code);

		// Firebase: The email address is badly formatted. (auth/invalid-email).

		var code = error.code;
		var message = error.message
			.toString()
			.replace("Firebase:", "")
			.replace(code, "")
			.replace(" ()", "")
			.replace("..", ".");

		res.locals.message = message.trim();
		res.locals.email = email;
		res.locals.password = password;

		res.render("signin", {
			title: "Sign in",
			keywords: "authentication",
			description: "MyOrdbok authentication"
		});
	}
});
