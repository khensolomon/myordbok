import "mocha";
import assert from "assert";
import { check } from "lethil";

// /**
//  * Replace all
//  * @param {string} str
//  * @returns {string}
//  */
// function simple_validation(str) {
// 	// NOTE: Simple validation: string
// 	// return str.replace(/(\<)(.*?)(\>)/g, "");

// 	// NOTE: Simple validation: encoded
// 	str = str.replace(/(\<|%3C)(.*?)(\>|%3E)/g, "");

// 	return str;
// }

describe("Query", () => {
	it("Simple validation: string", () => {
		const script_replaced = check.isValid("<script></script>");
		assert.strictEqual("", script_replaced);

		const img_replaced = check.isValid("<img></img>");
		assert.strictEqual("", img_replaced);

		const any_img_replaced = check.isValid("<img></img><button><script>");
		assert.strictEqual("", any_img_replaced);

		const no_attr_allow = check.isValid(
			"<img onerror=\"l.h='https://example.com/'\" src=x>"
		);
		assert.strictEqual("", no_attr_allow);
	});

	it("Simple validation: encoded", () => {
		assert.strictEqual(
			"",
			check.isValid(
				"%3Cimg+src%3Dx+onerror%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22%3E"
			)
		);
		assert.strictEqual(
			"",
			check.isValid(
				"<img+src%3Dx+click%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22>"
			)
		);
		assert.strictEqual(
			"",
			check.isValid(
				"<img src=x onerror=\"location.href='https://example.com/'\">"
			)
		);
		assert.strictEqual(
			"",
			check.isValid(
				"<img+src%3Dx+onerror%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22%3E"
			)
		);
		assert.strictEqual(
			"",
			check.isValid(
				"%3Cimg+src%3Dx+onerror%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22>"
			)
		);
	});
});
