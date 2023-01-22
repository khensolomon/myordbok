export const setting = {
	name: "MyOrdbok-?",
	// description: 'package.description',
	// version: 'package.version',
	locale: [
		{ id: "en", name: "English", default: true }
		// {id:'no',name:'Norwegian'},
		// {id:'my',name:'Myanmar'},
		// {id:'zo',name:'Zolai'}
	],

	table: {
		senses: "list_sense",
		other: "ord_0",
		synset: "list_word",
		synmap: "map_derive",
		thesaurus: "map_thesaurus"
	},
	dictionaries: [
		{
			name: "International",
			my: "အပြည်ပြည်ဆိုင်ရာ",
			lang: [
				{ id: "en", name: "English", my: "အင်္ဂလိပ်", default: true },
				{ id: "iw", name: "Hebrew", my: "ဟေဗြဲ" },
				{ id: "el", name: "Greek", my: "ဂရိ" },
				{ id: "pt", name: "Portuguese", my: "ပေါ်တူဂီ" },
				{ id: "fr", name: "French", my: "ပြင်သစ်" },
				{ id: "nl", name: "Dutch", my: "ဒတ်ချ်" },
				{ id: "ar", name: "Arabic", my: "အာရဗီ" },
				{ id: "es", name: "Spanish", my: "စပိန်" }
			]
		},
		{
			name: "Europe",
			my: "ဥရောပ",
			lang: [
				{ id: "no", name: "Norwegian", my: "နော်ဝေ" },
				{ id: "fi", name: "Finnish", my: "ဖင်လန်" },
				{ id: "ro", name: "Romanian", my: "ရိုမေးနီးယား" },
				{ id: "pl", name: "Polish", my: "ပိုလန်" },
				{ id: "sv", name: "Swedish", my: "ဆွီဒင်" },
				{ id: "da", name: "Danish", my: "ဒိန်းမတ်" },
				{ id: "de", name: "German", my: "ဂျာမန်" },
				{ id: "ru", name: "Russian", my: "ရုရှ" }
			]
		},
		{
			name: "Asia",
			my: "အာရှ",
			lang: [
				{ id: "ja", name: "Japanese", my: "ဂျပန်" },
				{ id: "zh", name: "Chinese", my: "တရုတ်" },
				{ id: "ko", name: "Korean", my: "ကိုရီးယား" },
				{ id: "ms", name: "Malay", my: "မလေးရှား" },
				{ id: "tl", name: "Filipion", my: "ဖိလစ်ပိုင်" },
				{ id: "vi", name: "Vietnamese", my: "ဗီယက်နမ်" },
				{ id: "th", name: "Thai", my: "ယိုးဒယား" },
				{ id: "hi", name: "Hindi", my: "ဟိန္ဒီ" }
			]
		}
	],
	/**
	 * @type {{name: string;shortname: string;}[]}
	 */
	synset: [
		{ name: "Noun", shortname: "n" },
		{ name: "Verb", shortname: "v" },
		{ name: "Adjective", shortname: "adj" },
		{ name: "Adverb", shortname: "adv" },
		{ name: "Preposition", shortname: "prep" },
		{ name: "Conjunction", shortname: "conj" },
		{ name: "Pronoun", shortname: "pron" },
		{ name: "Interjection", shortname: "int" },
		{ name: "Abbreviation", shortname: "abb" },
		{ name: "Prefix", shortname: "" },
		{ name: "Combining form", shortname: "" },
		{ name: "Phrase", shortname: "phra" },
		{ name: "Contraction", shortname: "" },
		{ name: "Punctuation", shortname: "punc" },
		{ name: "Particle", shortname: "part" },
		{ name: "Post-positional Marker", shortname: "ppm" },
		{ name: "Acronym", shortname: "" },
		{ name: "Article", shortname: "" },
		{ name: "Number", shortname: "tn" }
	],
	/**
	 * @type {{id:number;type:number;name: string;}[]}
	 */
	synmap: [
		{ id: 0, type: 1, name: "past and past participle" }, //er/ly??
		{ id: 1, type: 0, name: "plural" },
		{ id: 2, type: 1, name: "3rd person" },
		{ id: 3, type: 1, name: "past tense" },
		{ id: 4, type: 1, name: "past participle" },
		{ id: 5, type: 1, name: "present participle" },
		{ id: 6, type: 2, name: "comparative" },
		{ id: 7, type: 2, name: "superlative" },
		{ id: 8, type: 1, name: "1st person" },
		{ id: 9, type: 1, name: "2nd person" },
		{ id: 10, type: 1, name: "plural past" }
	],
	glossary: {
		word: "glossary/EN.json",
		sense: "glossary/sense.json", // definition
		usage: "glossary/usage.json", // example
		synset: "glossary/synset.json", // words
		synmap: "glossary/synmap.json", //derives
		zero: "glossary/zero.EN.csv", //no result
		info: "glossary/info.EN.json",
		thesaurus: "glossary/thesaurus.json",
		sqlite: "glossary/tmp-sqlite.db"
	},
	grammar: {
		live: "grammar/_live.json",
		pos: "grammar/pos-*.json",
		structure: "grammar/structure.json"
		// context:'grammar/*.json'
	},
	orthography: {
		character: "orthography/character.json",
		word: "orthography/word.json",
		sense: "orthography/sense.json"
	}
};

export default { setting };
