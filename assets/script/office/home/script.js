// import { ref } from "vue";
import "firebase/compat/auth";
import {
	// fetchSignInMethodsForEmail,
	getAuth,
	// getAdditionalUserInfo,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	GoogleAuthProvider,
	GithubAuthProvider,
	OAuthProvider,
	signInWithPopup,
	// signInWithRedirect,
	// getRedirectResult,
	// signInWithCredential,
	// linkWithPopup,
	linkWithCredential,
	sendEmailVerification,
	sendPasswordResetEmail,
	onAuthStateChanged,
	reauthenticateWithCredential,
	reauthenticateWithPopup,
	updateProfile,
	updatePassword,
	updateEmail,
	deleteUser,
	signOut
} from "firebase/auth";

export default {
	name: "Home",
	data: () => ({
		ready: false,
		displayName: "",
		photoURL: "",
		enrollmentStep: 0,
		enrollmentName: "",
		enrollmentEmail: "",
		enrollmentPassword: "",
		enrollmentPasswordShow: false,
		enrollmentMessage: "",
		authCredential: null
	}),
	inject: ["root", "dataStore", "storageStore"],
	methods: {
		userName() {
			return this.dataStore.userInfo.displayName;
		},
		signOutHandle() {
			const auth = getAuth();
			signOut(auth).then(() => {
				// router.push("/");
				// console.log(router);
				this.$router.push("/");
			});
		},

		async signInHandle() {
			const auth = getAuth();
			signInWithEmailAndPassword(
				auth,
				this.enrollmentEmail,
				this.enrollmentPassword
			)
				.then(cred => {
					// console.log("signed in", auth.currentUser);
					// this.$router.push("/");
				})
				.catch(this.handleEnrollmentMessage);
		},

		/**
		 * auth/account-exists-with-different-credential
		 * @param {((arg0: any) => void) | undefined} [errorCallback]
		 */
		async signInWithGithub(errorCallback) {
			const auth = getAuth();
			const provider = new GithubAuthProvider();
			return new Promise((resolve, reject) => {
				signInWithPopup(auth, provider)
					.then(userCredential => {
						const credential = GithubAuthProvider.credentialFromResult(
							userCredential
						);
						// const user = userCredential.user;
						// const accessToken = authCredential?.accessToken;
						// const idToken = authCredential?.idToken;
						resolve({ userCredential, credential });
					})
					.catch(error => {
						const credential = GithubAuthProvider.credentialFromError(error);

						if (typeof errorCallback === "function") {
							errorCallback(error);
						} else {
							this.handleEnrollmentMessage(error);
						}
						reject({ error, credential });
					});
			});
		},

		/**
		 * @param {((arg0: any) => void) | undefined} [errorCallback]
		 */
		async signInWithGoogle(errorCallback) {
			const auth = getAuth();
			const provider = new GoogleAuthProvider();
			return new Promise((resolve, reject) => {
				signInWithPopup(auth, provider)
					.then(userCredential => {
						const credential = GoogleAuthProvider.credentialFromResult(
							userCredential
						);
						// const user = userCredential.user;
						// const accessToken = authCredential?.accessToken;
						// const idToken = authCredential?.idToken;
						resolve({ userCredential, credential });
					})
					.catch(error => {
						const credential = GoogleAuthProvider.credentialFromError(error);

						if (typeof errorCallback === "function") {
							errorCallback(error);
						} else {
							this.handleEnrollmentMessage(error);
						}
						reject({ error, credential });
					});
			});
		},

		/**
		 * @param {((arg0: any) => void) | undefined} [errorCallback]
		 * @return {Promise<{userCredential:any,credential:any},String>}
		 */
		async signInWithApple(errorCallback) {
			const auth = getAuth();
			const provider = new OAuthProvider("apple.com");
			provider.addScope("email");
			provider.addScope("name");
			return new Promise((resolve, reject) => {
				signInWithPopup(auth, provider)
					.then(userCredential => {
						const credential = OAuthProvider.credentialFromResult(
							userCredential
						);
						// const user = userCredential.user;
						// const accessToken = authCredential?.accessToken;
						// const idToken = authCredential?.idToken;
						resolve({ userCredential, credential });
					})
					.catch(error => {
						const credential = OAuthProvider.credentialFromError(error);

						if (typeof errorCallback === "function") {
							errorCallback(error);
						} else {
							this.handleEnrollmentMessage(error);
						}
						reject({ error, credential });
					});
			});
		},

		/**
		 * CreateAccount: with email & password
		 */
		async signUpHandle() {
			const auth = getAuth();
			createUserWithEmailAndPassword(
				auth,
				this.enrollmentEmail,
				this.enrollmentPassword
			)
				.then(cred => {
					// console.log("signed in", auth.currentUser);
					this.$router.push("/");
				})
				.catch(this.handleEnrollmentMessage);
		},

		/**
		 * Github: link and error handle
		 */
		linkAccountWithGithub() {
			const auth = getAuth();
			const previousUser = auth.currentUser;

			this.signInWithGithub().catch(e => {
				// @ts-ignore
				linkWithCredential(previousUser, e.credential)
					.then(cred => {
						this.handleEnrollmentMessage("Account linking success.");
						this.dataStore.userInfo = auth.currentUser;
						console.log("github", cred.user, auth.currentUser);
					})
					.catch(this.handleEnrollmentMessage);
			});
		},

		/**
		 * Google: link and error handle
		 */
		linkAccountWithGoogle() {
			const auth = getAuth();
			const previousUser = auth.currentUser;

			this.signInWithGoogle().catch(e => {
				// @ts-ignore
				linkWithCredential(previousUser, e.credential)
					.then(cred => {
						this.handleEnrollmentMessage("Account linking success.");

						console.log("google", cred.user, auth.currentUser);
						this.dataStore.userInfo = auth.currentUser;
					})
					.catch(this.handleEnrollmentMessage);
			});
		},

		/**
		 * Apple: link and error handle
		 */
		linkAccountWithApple() {
			const auth = getAuth();
			const previousUser = auth.currentUser;

			this.signInWithApple().catch(e => {
				// @ts-ignore
				linkWithCredential(previousUser, e.credential)
					.then(cred => {
						this.handleEnrollmentMessage("Account linking success.");
						console.log("apple", cred.user, auth.currentUser);
						this.dataStore.userInfo = auth.currentUser;
					})
					.catch(this.handleEnrollmentMessage);
			});
		},

		/**
		 * Send: Email verification
		 */
		handleEmailVerification() {
			const auth = getAuth();
			if (auth.currentUser) {
				if (auth.currentUser.emailVerified) {
					this.handleEnrollmentMessage("Email have been verified.");
				} else {
					sendEmailVerification(auth.currentUser)
						.then(() => {
							this.handleEnrollmentMessage(
								"Email verification link have been sent."
							);
						})
						.catch(this.handleEnrollmentMessage);
				}
			}
		},

		/**
		 * Send: Email reset password
		 */
		handleResetPassword() {
			const auth = getAuth();
			sendPasswordResetEmail(auth, this.enrollmentEmail)
				.then(() => {
					this.handleEnrollmentMessage(
						"Reset link for password have been sent."
					);
				})
				.catch(this.handleEnrollmentMessage);
		},

		/**
		 * enrollment
		 * auth/account-exists-with-different-credential
		 * @param {any} [res]
		 */
		handleEnrollmentMessage(res) {
			if (res) {
				if (typeof res == "string") {
					this.enrollmentMessage = res;
				} else if (res.code) {
					let ms = res.code.split("/")[1];
					this.enrollmentMessage = ms.replace(/-/g, " ");
				}
			} else {
				this.enrollmentMessage = "";
			}
		},

		/**
		 * handleUpdateName
		 */
		handleUpdateName() {
			const auth = getAuth();
			if (auth.currentUser) {
				updateProfile(auth.currentUser, {
					displayName: this.enrollmentName
				})
					.then(() => {
						this.dataStore.userInfo = auth.currentUser;
						this.handleEnrollmentMessage("Display name have been updated.");
						this.enrollmentStep = 0;
					})
					.catch(this.handleEnrollmentMessage);

				// console.log(this.dataStore.userInfo.providerData);
				// auth.currentUser.getIdTokenResult().then(idTokenResult => {
				// 	// let currentProvider = idTokenResult.signInProvider;
				// 	console.log(idTokenResult);
				// 	// The result will look like  'google.com', 'facebook.com', ...
				// });
			}
		},

		/**
		 * auth/invalid-email
		 *
		 */
		handleChangeEmail() {
			const auth = getAuth();

			if (auth.currentUser)
				updateEmail(auth.currentUser, this.enrollmentEmail)
					.then(() => {
						this.dataStore.userInfo = auth.currentUser;
						this.handleEnrollmentMessage("E-mail have been updated.");
						this.enrollmentStep = 0;
					})
					.catch(error => {
						console.log(error.code);
						if (error.code == "auth/requires-recent-login") {
							// const provider = new GoogleAuthProvider();
							// reauthenticateWithPopup(auth.currentUser, provider);
						} else {
							this.handleEnrollmentMessage(error);
						}
					});

			// reauthenticateWithPopup();

			// if (auth.currentUser) {
			// 	if (this.authCredential != null) {
			// 		updateEmail(auth.currentUser, this.enrollmentEmail)
			// 			.then(() => {
			// 				this.handleEnrollmentMessage("E-mail have been updated.");
			// 			})
			// 			.catch(this.handleEnrollmentMessage);
			// 	} else {
			// 		console.log("reauthenticateWithCredential");
			// 		reauthenticateWithCredential(auth.currentUser, this.authCredential)
			// 			.then(() => {
			// 				this.handleEnrollmentMessage("reauthenticateWithCredential.");
			// 			})
			// 			// .catch(this.handleEnrollmentMessage);
			// 			.catch(error => {
			// 				console.log("reauthenticateWithCredential", error);
			// 			});
			// 	}
			// } else {
			// 	this.handleEnrollmentMessage("Email required");
			// }
		},

		handleUpdatePassword() {
			const auth = getAuth();

			if (auth.currentUser)
				updatePassword(auth.currentUser, this.enrollmentPassword)
					.then(() => {
						this.dataStore.userInfo = auth.currentUser;
						this.handleEnrollmentMessage("Password have been updated.");
						this.enrollmentStep = 0;
					})
					.catch(error => {
						this.handleEnrollmentMessage(error);
					});
		},
		handleDeleteAccount() {
			const auth = getAuth();

			if (auth.currentUser)
				deleteUser(auth.currentUser)
					.then(() => {
						console.log("User deleted");
					})
					.catch(error => {
						this.handleEnrollmentMessage(error);
					});
		}
	},
	computed: {
		routes() {
			return this.$router.options.routes;
		},
		linkedWithGoogle() {
			return this.dataStore.userInfo.providerData.find(
				e => e.providerId == "google.com"
			);
		},
		linkedWithApple() {
			return this.dataStore.userInfo.providerData.find(
				e => e.providerId == "apple.com"
			);
		},
		linkedWithGithub() {
			return this.dataStore.userInfo.providerData.find(
				e => e.providerId == "github.com"
			);
		}
	},
	// created() {},
	mounted() {
		// const auth = getAuth();
		// console.log("mounted", this.dataStore.userInfo);
		// this.userPhoto = this.dataStore.userInfo.photoURL;
		// if (this.userPhoto) {
		// 	// dataStore.userInfo.providerData;
		// }
		// const auth = getAuth();
		// if (auth.currentUser) {
		// 	console.log("mounted", auth.currentUser);
		// 	this.userPhoto = auth.currentUser.photoURL;
		// 	console.log("photoURL 1", this.userPhoto);
		// 	let token = await auth.currentUser.getIdTokenResult();
		// 	// token.signInProvider;
		// 	console.log("signInProvider", token.signInProvider);
		// 	if (token.signInProvider) {
		// 		let abc = this.dataStore.userInfo.providerData.find(
		// 			e => e.providerId == token.signInProvider
		// 		);
		// 		if (abc && abc.photoURL) {
		// 			console.log("photoURL 2", abc.photoURL);
		// 			this.userPhoto = abc.photoURL;
		// 		}
		// 	}
		// 	let auth = getAuth();
		// 	// auth.currentUser.getIdTokenResult().then(idTokenResult => {
		// 	// 	// let currentProvider = idTokenResult.signInProvider;
		// 	// 	console.log(idTokenResult);
		// 	// 	// The result will look like  'google.com', 'facebook.com', ...
		// 	// });
		// }
		const auth = getAuth();
		onAuthStateChanged(auth, async user => {
			if (user) {
				this.photoURL = user.photoURL;
				this.displayName = user.displayName;
				let token = await user.getIdTokenResult();
				if (token.signInProvider) {
					let byP = user.providerData.find(
						e => e.providerId == token.signInProvider
					);
					if (byP) {
						if (byP.photoURL) {
							this.photoURL = byP.photoURL;
						}
						if (!this.displayName && byP.displayName) {
							this.displayName = byP.displayName;
						}
					}
				}

				if (!this.photoURL) {
					let sep = user.providerData.find(e => e.photoURL);
					if (sep) {
						this.photoURL = sep.photoURL;
					}
				}
				if (!this.displayName) {
					let sep = user.providerData.find(e => e.displayName);
					if (sep) {
						this.displayName = sep.displayName;
					}
				}
			}
		});
	}
	// setup() {}
};
