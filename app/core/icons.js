// @ts-check
/**
 * MyOrdbok icon set: 24 grid, 2px safe area, 1.1 line, round ends,
 * separate strokes never touch. Stroke width and colour come from CSS (.icon).
 */
export const ICONS = Object.freeze({
	search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l4 4"/><path d="M7.6 9.4a3.2 3.2 0 0 1 2-2"/>',
	dictionary: '<path d="M12 6.8C10.2 5.3 7.8 4.8 4 4.8v12.6c3.8 0 6.2.5 8 2 1.8-1.5 4.2-2 8-2V4.8c-3.8 0-6.2.5-8 2z"/><path d="M12 8.4v9.4"/>',
	grammar: '<path d="M6.5 4H17a1.5 1.5 0 0 1 1.5 1.5V20H7a2 2 0 0 1-2-2V5.5A1.5 1.5 0 0 1 6.5 4z"/><path d="M5 17.5a2 2 0 0 1 2-2h11.5"/><path d="M9.5 4v5.5l1.75-1.2L13 9.5V4"/>',
	account: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/>',
	thumbUp: '<path d="M7.5 10.5v9H4.8a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M7.5 10.5 10.9 4.4a1.7 1.7 0 0 1 3.2 1.1L13.4 9h5a2 2 0 0 1 2 2.4l-1.2 6.4a2 2 0 0 1-2 1.7H7.5"/>',
	thumbDown: '<g transform="matrix(1 0 0 -1 0 24)"><path d="M7.5 10.5v9H4.8a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M7.5 10.5 10.9 4.4a1.7 1.7 0 0 1 3.2 1.1L13.4 9h5a2 2 0 0 1 2 2.4l-1.2 6.4a2 2 0 0 1-2 1.7H7.5"/></g>',
	// Support: a heart in an open hand (giving), not the like of a meaning.
	like: '<path d="M12 10.6C10.2 9.3 8.8 8.1 8.8 6.6c0-1 .8-1.8 1.8-1.8.6 0 1.1.3 1.4.8.3-.5.8-.8 1.4-.8 1 0 1.8.8 1.8 1.8 0 1.5-1.4 2.7-3.2 4z"/><path d="M3.5 14.2h2.8l3.4 1.1h3.2a1.3 1.3 0 0 1 0 2.6H9.8"/><path d="M12.9 17.9l4.9-2.4a1.4 1.4 0 0 1 1.6 2.2l-4.4 3.2a2.2 2.2 0 0 1-1.6.4l-6.2-.8H3.5"/>',
	suggest: '<path d="M16.6 3.9a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L9 18.5l-4.5 1 1-4.5z"/><path d="M14.5 6l3.5 3.5"/>',
	document: '<path d="M5.5 4.5h9l4 4v11h-13z"/><path d="M14 4.5v4.5h4.5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
	sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
	moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
	contrast: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
	chart: '<path d="M5 19.5h14"/><path d="M7.5 16v-4M12 16V8M16.5 16v-6"/>',
	overview: '<rect x="4" y="4.5" width="7" height="9" rx="1.5"/><rect x="13" y="4.5" width="7" height="5" rx="1.5"/><rect x="4" y="15.5" width="7" height="4" rx="1.5"/><rect x="13" y="11.5" width="7" height="8" rx="1.5"/>',
	tools: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m7.5 10 2.5 2-2.5 2"/><path d="M12.5 14.5h4"/>',
	question: '<circle cx="12" cy="12" r="8"/><path d="M9.7 9.7a2.4 2.4 0 0 1 4.7.7c0 1.6-2.4 2-2.4 3.4"/><circle cx="12" cy="16.8" r=".7" fill="currentColor" stroke="none"/>',
	vote: '<path d="M4.5 12.5h15v6a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8 12.5v-7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7"/><path d="m10 8.7 1.5 1.5 2.7-2.8"/><path d="M8.5 16.2h7"/>',
	history: '<path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3"/><path d="M4.5 4.5V8H8"/><path d="M12 8.2v4.1l2.8 1.7"/>',
	inbox: '<path d="M4 13.5 6.6 5.6A1.6 1.6 0 0 1 8.1 4.5h7.8a1.6 1.6 0 0 1 1.5 1.1L20 13.5"/><path d="M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5h-4.5a3.5 3.5 0 0 1-7 0z"/>',
	settings: '<path d="M12.0 3.4L12.6 3.5L13.1 3.6L13.6 4.0L14.0 4.7L14.3 5.3L14.6 5.7L14.9 6.0L15.3 6.3L15.7 6.5L16.1 6.6L16.7 6.7L17.4 6.6L18.1 6.6L18.7 6.9L19.1 7.2L19.4 7.7L19.7 8.2L19.8 8.8L19.7 9.4L19.3 10.0L18.9 10.6L18.7 11.1L18.6 11.6L18.6 12.0L18.6 12.4L18.7 12.9L18.9 13.4L19.3 14.0L19.7 14.6L19.8 15.2L19.7 15.8L19.4 16.3L19.1 16.8L18.7 17.1L18.1 17.4L17.4 17.4L16.7 17.3L16.1 17.4L15.7 17.5L15.3 17.7L14.9 18.0L14.6 18.3L14.3 18.7L14.0 19.3L13.6 20.0L13.1 20.4L12.6 20.5L12.0 20.6L11.4 20.5L10.9 20.4L10.4 20.0L10.0 19.3L9.7 18.7L9.4 18.3L9.1 18.0L8.7 17.7L8.3 17.5L7.9 17.4L7.3 17.3L6.6 17.4L5.9 17.4L5.3 17.1L4.9 16.8L4.6 16.3L4.3 15.8L4.2 15.2L4.3 14.6L4.7 14.0L5.1 13.4L5.3 12.9L5.4 12.4L5.4 12.0L5.4 11.6L5.3 11.1L5.1 10.6L4.7 10.0L4.3 9.4L4.2 8.8L4.3 8.2L4.6 7.7L4.9 7.2L5.3 6.9L5.9 6.6L6.6 6.6L7.3 6.7L7.9 6.6L8.3 6.5L8.7 6.3L9.1 6.0L9.4 5.7L9.7 5.3L10.0 4.7L10.4 4.0L10.9 3.6L11.4 3.5z"/><circle cx="12" cy="12" r="3"/>',
	download: '<path d="M12 4.5v10"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
	members: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="8" r="2.6"/><path d="M16 13.2a4.6 4.6 0 0 1 5 4.8"/>',
	copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
	play: '<path d="M8 5.5v13l10-6.5z"/>',
	check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
	info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5"/><path d="M12 8.1v.1"/>',
	notice: '<path d="M4.5 10v4a1 1 0 0 0 1 1H8l6 4V5L8 9H5.5a1 1 0 0 0-1 1z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
	clock: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5l3 1.8"/>',
	calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
	// The search field's lead (reader/search-box.js): a sum, a number.
	equals: '<path d="M6 9.5h12M6 14.5h12"/>',
	hash: '<path d="M9.5 4.5 8 19.5M16 4.5l-1.5 15M4.5 9.5h16M3.5 14.5h16"/>',
	back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
	chevron: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
	close: '<path d="M7 7l10 10M17 7 7 17"/>',
	// Three paths: the cone, then the near and the far wave, moved one by one (app.css, .pronounce).
	speaker: '<path d="M4.5 9.5h2.8l4.2-3.4v11.8l-4.2-3.4H4.5z"/><path d="M14.8 9.4a3.6 3.6 0 0 1 0 5.2"/><path d="M17.4 6.9a7.2 7.2 0 0 1 0 10.2"/>',
	// Practice: a stack of cards, the top one ticked.
	practice: '<rect x="3.5" y="7.5" width="13" height="12.5" rx="2.2"/><path d="M8 4h10.3c1.2 0 2.2 1 2.2 2.2v9.3"/><path d="m7 13.8 2 2 3.6-3.8"/>',
	comment: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z"/>',
});
