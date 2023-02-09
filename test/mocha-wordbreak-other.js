import "mocha";
import assert from "assert";
import { wordbreak } from "../assist/index.js";

describe("wordbreak", function() {
	it("Adjective", function() {
		const lovable = wordbreak("lovable");

		assert.strictEqual(2, lovable.length);
		assert.strictEqual("love", lovable[0].word);
	});

	it("lovable", function() {
		// @ts-ignore
		let title = this.test.title;
		const lovable = wordbreak(title);
		assert.strictEqual(2, lovable.length);
		assert.strictEqual("love", lovable[0].word);
	});

	it("zoogeographically", function() {
		// @ts-ignore
		let title = this.test.title;
		const lovable = wordbreak(title);
		assert.strictEqual(2, lovable.length);
		assert.strictEqual("zoogeographic", lovable[0].word);
	});

	it("deserving", function() {
		// @ts-ignore
		let title = this.test.title;
		const lovable = wordbreak(title);
		assert.strictEqual(2, lovable.length);
		assert.strictEqual("deserve", lovable[0].word);
	});

	it("reaction", function() {
		// @ts-ignore
		let title = this.test.title;
		const lovable = wordbreak(title);
		assert.strictEqual(3, lovable.length);
		assert.strictEqual("re", lovable[0].word);
		assert.strictEqual("act", lovable[1].word);
		assert.strictEqual("action", lovable[2].word);
	});

	it("reactivated", function() {
		// @ts-ignore
		let title = this.test.title;
		const lovable = wordbreak(title);
		assert.strictEqual(3, lovable.length);
		assert.strictEqual("re", lovable[0].word);
		assert.strictEqual("activate", lovable[1].word);
		assert.strictEqual("activated", lovable[2].word);
	});

	it("reactive -> re active", function() {
		// @ts-ignore
		let param = this.test.title.split("->").filter(e => e.trim());
		let title = param[0];
		const lovable = wordbreak(title);
		assert.strictEqual(2, lovable.length);
		assert.strictEqual("re", lovable[0].word);
		assert.strictEqual("active", lovable[1].word);
	});
});
