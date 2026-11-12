// @ts-check
/**
 * Before written text is sent (a comment, a suggestion, a message): a field
 * that is surely Zawgyi (shared/zawgyi) is not sent; its Unicode is shown
 * with a button that puts it in the field, to be checked and sent again.
 * The Worker refuses Zawgyi as well; this saves the round trip and offers
 * the fix. The detector is loaded only when a field has Myanmar in it.
 */
import { detectLang } from '#shared/validate.js';
import { h } from './dom.js';
import { t } from '../i18n/index.js';

/**
 * @param {Array<HTMLInputElement | HTMLTextAreaElement>} fields
 * @param {HTMLElement} out  Where the offer is shown (the form's status line).
 * @returns {Promise<boolean>}  true: none is Zawgyi, send it.
 */
export async function noZawgyi(fields, out) {
	const myanmar = fields.filter((f) => detectLang(f.value) === 'my');
	if (!myanmar.length) return true;
	const { unicodeIfZawgyi } = await import('#shared/zawgyi/index.js');
	const found = /** @type {Array<[HTMLInputElement | HTMLTextAreaElement, string]>} */ (myanmar.map((f) => [f, unicodeIfZawgyi(f.value)]).filter(([, as]) => as !== null));
	if (!found.length) return true;

	const use = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'zawgyi-use' }, t('Use the Unicode')));
	use.addEventListener('click', () => {
		for (const [field, as] of found) {
			field.value = as;
			field.dispatchEvent(new Event('input', { bubbles: true }));
		}
		out.replaceChildren(t('Changed to Unicode. Check it, then send it again.'));
		found[0][0].focus();
	});
	out.replaceChildren(
		h(
			'span',
			{ class: 'zawgyi-offer' },
			h('span', null, t('This looks like Zawgyi, which the dictionary cannot read. In Unicode it is:')),
			...found.map(([, as]) => h('span', { class: 'zawgyi-as', lang: 'my' }, as)),
			use,
		),
	);
	return false;
}
