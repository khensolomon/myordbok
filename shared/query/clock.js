// @ts-check
/**
 * The time and date from the device's clock, in English and in Myanmar.
 */
import { toMyanmarDigits } from './digits.js';

const MONTHS_MY = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'ဩဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
const DAYS_MY = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'];

/**
 * Part of the day as said with a 12-hour time.
 * @param {number} hour  0–23
 */
function partOfDay(hour) {
	if (hour < 12) return 'မနက်';
	if (hour < 16) return 'နေ့လယ်';
	if (hour < 19) return 'ညနေ';
	return 'ည';
}

/**
 * @param {Date} d
 * @returns {{ en: string, my: string }}
 */
export function timeWords(d) {
	const h = d.getHours();
	const m = d.getMinutes();
	const h12 = h % 12 || 12;
	const en = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
	const my = `${partOfDay(h)} ${toMyanmarDigits(String(h12))} နာရီ${m ? ` ${toMyanmarDigits(String(m))} မိနစ်` : ''}`;
	return { en, my };
}

/**
 * @param {Date} d
 * @returns {{ en: string, my: string }}
 */
export function dateWords(d) {
	const en = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	const my = `${toMyanmarDigits(String(d.getFullYear()))} ခုနှစ်၊ ${MONTHS_MY[d.getMonth()]}လ ${toMyanmarDigits(String(d.getDate()))} ရက်၊ ${DAYS_MY[d.getDay()]}နေ့`;
	return { en, my };
}
