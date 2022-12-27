if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/sw.js")
		.then(function(registration) {
			console.log("sw", registration);
		})
		.catch(function(err) {
			console.log("sw", err);
		});
}
