const prefix_pattern = /^(^:?over|un|non|re|dis)(.{2,})/;
// re lation location
const prefix_pattern_skip = /^(?:disru|dist|re(p|v|q|c|t|s|w|f|l(?!o))|uni)/;
const suffix_pattern = /(.*)(ly|tory|ful|ness|less|able|ed|ing|tion)s?$/;
var test = /(re)/;
/*
amiable
comply family apply daily holy imply jolly only empty molly
king ding ling ping ring ting wing zing something

word seperator
download upload freeload reailroaded
nl el fl rl
*/
const suffix_pattern_skip = /^(^:?fam|am|com|vi|mon|hi|or|aw|ap|eq|h|im|jo|mo|o|k|d|l|p|r|s|t|w|z).?(ly|tory|able|ful|ing)$/;
// Mosty adjective and adverb
const suffix_root = [
	// NOTE: noun ness
	{
		w: /ness$/,
		s: [
			// [/(f|n|g|t|r|k|m)i$/,'$1y']
			[/([a-z])i$/, "$1y"],
			// pythoness
			[/(ho)$/, "$1n"]
		],
		skip: []
	},
	// NOTE: adjective ly
	{
		w: /ly$/,
		s: [
			// -fully -nally
			[/(ful|nal)$/, "$1"],
			// -cally
			[/(c)al$/, "$1"],
			// demonstrably demonstrable demonstrate
			// sympathetically sympathetical sympathetic
			// acoustically acoustical acoustic
			// notably notable note
			// [/(etic)al$/,'$1'],
			// practicably
			// [/(rfu)$/,'$1l'],
			// powerfuly
			[/(rfu)$/, "$1l"],

			[/(tic)al$/, "$1"],
			// amiably amiab amiable ??
			// [/(iab)$/,'$1le'],
			// comfortably, audibly multiply
			[/(ab|ib|mb|ip)$/, "$1le"],
			// curly
			[/(ur)$/, "$1l"],
			// daintily dainty
			[/(t|r|s|a|h|d|z)i$/, "$1y"],
			[/(m)i$/, "$1"],
			// unluckily unluckely
			[/k(e|i)$/, "kly"]
		],
		// zoogeographically
		skip: [
			// ally bully
			// /(al|bul|jel)$/,
			// /([a|b|j])l$/
			/^(a|bu|je)l$/
		]
	},
	{
		w: /able$/,
		s: [
			// appreciate
			[/(ic|eci|str)$/, "$1ate"],
			[/(oti)$/, "$1ate"],
			[/(por)$/, "$1ate"],
			// sublimable
			[/(lor|put|not|lac|liz|lim|eiv|mov)$/, "$1e"],
			[/(par)$/, "$1ate"],
			// liquefiable - liquefy
			[/([a-z])i$/, "$1y"]
		],
		skip: []
	},
	{
		w: /ful$/,
		s: [
			// beautiful
			// [/(t)i$/,'$1y'],
			// [/^\d*$/,'full'],
			[/i$/, "y"]
		],
		skip: []
	},
	{
		w: /less$/,
		s: [
			// beautiful
			[/(t)i$/, "$1y"]
		],
		skip: []
	},
	{
		w: /tory$/,
		s: [
			[/(m)ma$/, "$1e"],
			[/ta$/, "te"],
			// inhibitory
			[/(di|bi|en|ma|si)$/, "$1t"],
			// introductory introduce
			[/(duc)$/, "$1e"],
			// justificatory justify
			[/(f)ica$/, "$1y"],
			// ambulatory
			// innovatory
			// anticipatory
			// interrogatory
			// celebratory celebrate
			[/(ec|bu|la|ova|pa|ga|bra|da|ia)$/, "$1te"],
			// [/([a-z])i$/,'$1ty']
			// benedictory benedicite
			[/(dic)$/, "$1ite"],
			// satisfactory - satisfice
			[/(f)ac$/, "$1ice"],
			// observatory observe
			[/(v)a$/, "$1e"]
		],
		skip: []
	},
	{
		w: /tion$/,
		s: [
			// constatation constatare
			[/(tata)$/, "$1re"],
			// suppletion
			[/(ppl)e$/, "$1y"],
			// diction
			[/(dic)$/, "$1tate"],
			// abstention abstain distention?
			[/([b]st)en$/, "$1ain"],
			// acetification acetify
			// ?: certification certify certificate
			[/(f)ica$/, "$1y"],
			// // zonation
			// [/(zon)a$/,'$1e'],
			// attention attend
			[/(tten)$/, "$1d"],
			// en: contention content contestation?
			// mi: vomition vomit
			// edi: edition
			[/(en|mi|edi)$/, "$1t"],
			// nt: explantation explant
			// experimentation experiment
			// orientation orient
			// ept: acceptation
			// est: contestation
			[/(nt|ept|est)a$/, "$1"],
			// composition
			[/(os)i$/, "$1e"],
			// acquisition acquire
			[/(i)si$/, "$1re"],
			// flotation float =! connotation connote
			// [/(o)t(a)$/,'$1$2t'],
			[/(?<!n)(o)t(a)$/, "$1$2t"],
			// pil: compilation compile
			// zon: zonation zone
			// lg: divulgation divulge
			// xamin: examination examine != contamination contaminate
			// nnot: connotation connote =! notation notate
			[/(pil|zon|lg|xamin|nnot)a$/, "$1e"],
			// academization academize
			// academisation academise
			[/(i[sz])a$/, "$1e"],
			// a: abacination abacinate bloviation reactivation
			// i: unition
			// u: prostitution
			// e: accretion
			// o: devotion
			// [/([vni]a)$/,'$1te'],
			[/([auieo])$/, "$1te"],
			// c: confliction connection
			// p: scription exception adoption
			// r: portion port
			// s: digestion
			[/([cprs])$/, "$1t"]
		],
		// acception acceptation  accommodation accretion divulgation divulge
		// examination examine
		// abstention abstain
		// connotation connote
		// constatation
		skip: [
			// Nation ration action notion
			// /^(?=.{0,2}$)/,
			// mo: motion emotion != accommodation
			/^((?:e)?mo)$/,
			// escrip: description
			// ndi: condition
			// ump: consumption assumption
			// lu: solution revolution !=  evolution  absolution?
			// ques: question
			// posi: position != composition
			// ap: caption
			// lo: lotion
			// dormit: dormition
			// voca: vocation
			// nip: conniption
			/(escrip|ndi|ump|(?<!abs|ev).lu|\bm?posi|ques|ap|lo|dormit|voca|nip)$/
		]
	},
	// NOTE: verb (past tense) ed,regular or adjective
	// ?: -ibed -ybed -obed
	{
		w: /ed$/,
		s: [
			// belied requited required
			[/(beli|quit|quir)$/, "$1e"],
			// springed spring, stringed string
			// impinged pinged
			[/(^(str|spr|r|t|b|d|p)ing)$/, "$1"],
			// [/((?=p).r[i]g)$/,'$1'],
			// syringed syringe, infringed infringe, fringed fringe, cringed cringe, constringed constringe, astringed astringe
			// TODO: g: may be moved to SingleEnd
			[/([rhp]ing)$/, "$1e"],

			// NOTE: ed hed, ted
			// ached bellyached avalanched breathed cached clothed douched soothed sunbathed wreathed writhed unsheathed
			// a: wreathed != bequeathed
			// e: teethed
			// i: writhed tithed != pithed
			// y: scythed
			// o: clothed != quothed
			// soothed scythed swathed
			// [/((a|e|ri|ti|lo|y|so.)th)$/,'$1e'],
			// !: bequeathed
			[/(((?!u)..a|lo|y|so.)th)$/, "$1e"],
			// ached bellyached cached avalanched
			// [/((^a|ca|ya|avalan)ch)$/,'$1e'],
			// (?:neck|cross|hog|aun)?
			// bellyached douched clothed cached psyched
			[/((^a|ca|ya|sy|^dou)(?:valan)?[c]h)$/, "$1e"],
			// [/(ast)$/,'$1e'],
			// NOTE: SingleEnd
			// z: apologized boozed
			// s: annualised used composed confused cursed released based responsed
			// v: achieved observed solved caved loved arrived removed grooved
			[/([zsv])$/, "$1e"],
			// !: cook look book hook fool cool room loop
			// [/(oo)/,'$1'],
			// m: homed
			// n: cloned
			// k: invoked joked
			// [/(o[mnk])$/,'$1e'],
			[/((?!o).o[mnk])$/, "$1e"],
			// as: released based
			// ac: replaced
			// rc: resourced
			// am: ashamed
			// ud: included
			// tl: battled
			// dl: candled
			// ad: graded != loaded goaded
			[/(pl|rc|nc|am|ac|ud|tl|(?<!o)ad|dl)$/, "$1e"],
			// charged messaged aged
			// infringed
			[/((?![0]).[ar]g)$/, "$1e"],
			// ar: bracketed bracket
			// [/(ar|ket)$/,'$1'],
			// a: hated validated created
			// e: completed bracketed?
			// u: computed attributed
			// o: devoted
			// i: infinited?
			// !eik: tested tasted wasted!=existed listed
			// ! aborted coated incrusted gusted unexhausted untrusted baited benefited cited
			// abbreviated alleviated allocated
			// accentuated created
			[/([ucie]at)$/, "$1e"],
			// confuted
			[/([f]ut)$/, "$1e"],
			// [/([u]it)$/,'$1'],
			// [/([uci][ai]t)$/,'$1e'],
			[/((?![eikouafcbd]).[aueios]t)$/, "$1e"],
			// [/((?=[c]).[i]t)$/,'$1y'],
			// cited
			// !: circuited recruited conceited debited edited elicited
			// [/([c]uit)$/,'$1'],
			// [/([u][i]t)$/,'$1'],
			// [/([i]t)$/,'$1y'],
			[/((?![uebdc]).[i]t)$/, "$1y"],
			// postpone prepone
			// [/([p].[o]n)$/,'$1e'],
			[/([p].on)$/, "$1e"],
			// a: cared != appeared=appear?
			// e: answered
			// o: explored stored
			// u: measured
			[/((?!e).[aou]r)$/, "$1e"],
			// [/(ut)$/,'$1e'],
			// i: cried tried specified hurried replied babied
			// !: died lied gied tied
			// [/^([dlpghtv]i)$/,'$1e'],
			[/^([a-z]i)$/, "$1e"],
			// abyed dyed eyed obeyed
			// [/([bde]y)$/,'$1e'],
			[/((ab|d|^e)y)$/, "$1e"],
			// spaed
			[/((p)a)$/, "$1e"],
			// -ibed
			// y: gybed
			// [/([iy]b)$/,'$1e'],
			// i: bribed
			// o: conglobed robed
			// !: boobed
			[/((?!o).(i|o|y)b)$/, "$1e"],
			[/[i]$/, "y"],
			// [/^(?=.{,1})[i]$/,'y'],
			// clapped
			// [/(p)p$/,'$1'],
			// // banned
			// [/(n)n$/,'$1'],
			// // cubbed clubbed
			// [/(b)b$/,'$1'],
			// // cancelled
			// [/(l)l$/,'$1'],
			// // committed
			// [/(t)t$/,'$1']
			// committed
			// [/((.)\2)$/,'$2']
			[/(([blnpt])\2)$/, "$2"]
		],
		skip: [
			// led, red bed fed ted wed med zed ged ped
			// /^.{0,1}/,
			/^(?=.{0,1}$)/,
			// speed, need, feed, seed, reed
			/([e])$/,
			// abed slugabed
			/(ab)$/
		]
	},
	// NOTE: verb (present tense)  ing
	{
		w: /ing$/,
		s: [
			// loving - love
			// caring - care
			// [/(v|r)$/,'$1e']
			[/([vr])$/, "$1e"]
		],
		skip: [
			// something thing
			/(th)$/,
			// string, spring awning sing
			/(str|spr|awn)$/
		]
	}
];
var result = [];

/**
 * @param {RegExp|string} str
 */
function testCase(str) {
	return new RegExp(str, "i");
}

/**
 * @param {string} str
 */
function prefixes(str) {
	// var re = new RegExp(prefix_pattern);
	var re = testCase(prefix_pattern);
	if (re.test(str)) {
		return str.match(re).slice(1);
	}
	return [];
}

/**
 * @param {string} str
 */
function suffixes(str) {
	var re = testCase(suffix_pattern);
	if (re.test(str)) {
		var o = str
			.match(re)
			.slice(1)
			.filter(e => e.trim());
		// NOTE: fully ness
		if (o.length > 1) {
			return o;
		}
	}
	return [];
}

/**
 * @param {string} str
 */
function joiner(str) {
	var [word, suffix] = suffixes(str);
	// && e.k.test(word) == false
	// var skip_test = suffix_pattern_skip.test(str);
	var skip_test = testCase(suffix_pattern_skip).test(str);
	if (skip_test == false && suffix) {
		var _tasks = suffix_root.filter(
			// e=> e.w.test(suffix) && e.k.test(word) == false
			e =>
				testCase(e.w).test(suffix) &&
				e.skip.filter(s => testCase(s).test(word)).length == 0
		);
		if (_tasks.length) {
			_tasks
				.map(e => e.s.find(s => testCase(s[0]).test(word)))
				.filter(x => x)
				.forEach(function(w) {
					word = word.replace(testCase(w[0]), w[1].toString());
				});
			// suffix_root.filter(
			//   e=> e.w.test(suffix)
			// ).map(
			//   e=>e.s.find(
			//     s=>s[0].test(word)
			//   )
			// ).filter(x => x).forEach(function(w){
			//   word = word.replace(w[0],w[1]);
			// });
			joiner(word);
			result.push({ word: str, id: 2, s: suffix, skip: false });
		} else {
			result.push({ word: str, id: 1, skip: true });
		}
	} else {
		result.push({ word: str, id: 1, skip: skip_test });
	}
}

/**
 * @param {string} str
 */
export default function start(str) {
	result = [];
	var [prefix, word] = prefixes(str);
	if (testCase(prefix_pattern_skip).test(str) == false && prefix) {
		str = word.replace(/[^a-zA-Z]/gim, "");
		result.push({ word: prefix, id: 0 });
	}
	joiner(str);
	return result;
}

// Bob begin breaking Bubby broken bed

// module.exports = (str) => start(str.toLowerCase());
// module.exports = start;
