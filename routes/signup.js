import { server } from "lethil";

import { createUserWithEmailAndPassword } from "../assist/firebase/index.js";

const app = server();
const routes = app.routes("/signup", "authenticator");

routes.register({ name: "signup", text: "Sign up" }, function(req, res) {
	res.render("signup", {
		title: "Sign up",
		keywords: "authentication",
		description: "MyOrdbok authentication",
		message: "hello"
	});
});

// test@myordbok.com testings
app.framework.post("/signup", async function(req, res) {
	// res.json(req.body);
	const { email, password } = req.body;

	try {
		await createUserWithEmailAndPassword(email, password);
		res.redirect("/signin");
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

		// res.redirect("/signup");
		res.render("signup", {
			title: "Sign up",
			keywords: "authentication",
			description: "MyOrdbok authentication"
		});
	}
});
