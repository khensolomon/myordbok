import "mocha";
import assert from "assert";
import thesaurus from "word-thesaurus";

describe("Thesaurus", function() {
	it("from", () => {
		const res = thesaurus.find("from");
		assert.ok(res.length == 0);
	});

	it("wait", () => {
		const res = thesaurus.find("wait");
		assert.ok(res.length > 0);
	});
});
