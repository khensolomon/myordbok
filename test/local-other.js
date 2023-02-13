import "mocha";
import assert from "assert";

describe("Thesaurus", function() {
	// Sunday, May 12, 2013
	// 05 / 12 / 2013;
	it("from", () => {
		let date_ob = new Date();
		console.log("date", date_ob);
		var d = new Date()
			.toString()
			.replace(/\S+\s(\S+)\s(\d+)\s(\d+)\s.*/, "$2-$1-$3");
		console.log("regex", d);
		assert.ok(true);

		var today = new Date().toLocaleDateString("en-GB", {
			weekday: "long",
			day: "2-digit",
			month: "long",
			year: "numeric"
		});
		console.log("today", today);
	});
});
