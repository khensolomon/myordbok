import firebase from "firebase-admin";
// import firebase from "firebase/compat/app";
// import { initializeApp } from "firebase/app";
// import "firebase/compat/auth";

// https://dev.to/deepakshisood/authentication-using-firebase-for-expressjs-2l48

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyCnqrfzlqIPzEmODfZRudYXlz7MSJjaSzc",
	authDomain: "myordbok-app.firebaseapp.com",
	projectId: "myordbok-app",
	storageBucket: "myordbok-app.appspot.com",
	messagingSenderId: "75095486220",
	appId: "1:75095486220:web:1a29b88abfb0e80eb72329",
	measurementId: "G-4JM6R8RWSP"
};

/**
 * typedef {firebase.auth.UserCredential}  UserCredential
 */

// Initialize Firebase
export const app = firebase.initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
// export const auth = firebase.auth(app);

// const firebase = require("./firebase/admin");

/**
 * @param {{ headers: { authorization: any; }; }} req
 * @param {{ send: (arg0: { message: string; }) => { (): any; new (): any; status: { (arg0: number): void; new (): any; }; }; }} res
 * @param {() => any} next
 */
export function authMiddleware(req, res, next) {
	const headerToken = req.headers.authorization;
	if (!headerToken) {
		return res.send({ message: "No token provided" }).status(401);
	}

	if (headerToken && headerToken.split(" ")[0] !== "Bearer") {
		res.send({ message: "Invalid token" }).status(401);
	}

	const token = headerToken.split(" ")[1];
	firebase
		.auth()
		.verifyIdToken(token)
		.then(() => next())
		.catch(() => res.send({ message: "Could not authorize" }).status(403));
}
