import "mocha";
import assert from "assert";
import { query } from "../assist/index.js";

describe("Clue query", () => {
	it("web -> web", () => {
		const job = query("web");
		assert.strictEqual(1, job.sentence.length);
		assert.strictEqual("web", job.word);
	});
	// it("related%20words -> related", () => {
	// 	const job = query("related%20words");
	// 	assert.strictEqual(2, job.sentence.length);
	// 	assert.strictEqual("related", job.word);
	// });
	it("related words -> related", () => {
		const job = query("related words");
		assert.strictEqual(2, job.sentence.length);
		assert.strictEqual("related", job.word);
	});
	it("goat~0 -> goat", () => {
		const job = query("goat~0");
		assert.strictEqual(1, job.sentence.length);
		assert.strictEqual("goat", job.word);
	});
	it("goat~goat -> goat", () => {
		const job = query("goat~goat");
		assert.strictEqual(1, job.sentence.length);
		assert.strictEqual("goat", job.word);
	});
	it("goat me -> goat", () => {
		const job = query("goat me");
		assert.strictEqual(2, job.sentence.length);
		assert.strictEqual("goat", job.word);
	});
	it("goat me~me -> me", () => {
		const job = query("goat me~me");
		assert.strictEqual(2, job.sentence.length);
		assert.strictEqual("me", job.word);
	});
	it("i love you~love -> love", () => {
		const job = query("i love you~love");
		assert.strictEqual(3, job.sentence.length);
		assert.strictEqual("love", job.word);
	});
	it("let~us~crack~something~crack -> crack as word", () => {
		const job = query("let~us~crack~something~crack");
		assert.strictEqual(4, job.sentence.length);
		assert.strictEqual("crack", job.word);
	});
	it("web~must~crack~something~2 -> crack as index", () => {
		const job = query("web~must~crack~something~2");
		assert.strictEqual(4, job.sentence.length);
		assert.strictEqual("crack", job.word);
	});
	it("excuse me~something -> excuse as none", () => {
		const job = query("excuse me~something");
		assert.strictEqual(2, job.sentence.length);
		assert.strictEqual("excuse", job.word);
	});
});
