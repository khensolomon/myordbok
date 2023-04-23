/*
Copyright 2005,2006,2008 ThanLwinSoft.org

You are free to use this on your website and modify it
subject to either the GNU Lesser General Public License or the
Creative Commons license at your choice.
However, please add a link to www.thanlwinsoft.org
somewhere on your site if you this script. For more info
and contact details see www.thanlwinsoft.org.

This copyright statement must not be removed.

MyParser - a javascript class for parsing myanmar into tokens based on
syllables. For the purposes of this script, syllable pairs joined by stacking
are treated as one unit.

Version:       0.1
Author:        Keith Stribley (KRS)
Contributors:

Change History:
08-07-2005    KRS    Initial Version in PHP and Java
24-07-2006    KRS    Modified for new Unicode Proposal
27-10-2006    KRS    Ported from PHP to JavaScript

*/

var MM_CONTEXT_LEN = 3;
var MMC_UNKNOWN = 0;
var MMC_CI = 1;
var MMC_ME = 2;
var MMC_VI = 3;
var MMC_EV = 4;
var MMC_UV = 5;
var MMC_LV = 6;
var MMC_AV = 7;
var MMC_AN = 8;
var MMC_KI = 9;
var MMC_LD = 10;
var MMC_VG = 11;
var MMC_MD = 12;
var MMC_SE = 13;
var MMC_VS = 14;
var MMC_SP = 15;
var MMC_LQ = 16;
var MMC_RQ = 17;
var MMC_WJ = 18;
var MMC_OT = 19;
// break weights from initial table approach
var BK_NO_BREAK = 0;
var BK_WEIGHT_1 = 1;
var BK_WEIGHT_2 = 2;
var BK_CONTEXT = 3; // used internally only
var BK_UNEXPECTED = 4; // illegal sequence
var BK_SYLLABLE = 5; // syllable break, no line break
var BK_WHITESPACE = 6; // white space character
var BK_EOL = 7; // end of line or string
var BK_STACK_SYLLABLE = 8; // within a stacked combination

// BK_NO_BREAK = 0; BK_WEIGHT_1 = 1; BK_WEIGHT_2 = 2; BK_CONTEXT = 3;
// BK_UNEXPECTED = 4; BK_SYLLABLE = 5; BK_WHITESPACE = 6; BK_EOL = 7;
var BKSTATUS = new Array(
	//              ci me vi ev uv lv av an ki ld vg md se vs sp lq rq wj ot
	/*ci*/ new Array(3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*me*/ new Array(3, 0, 4, 0, 0, 0, 0, 0, 4, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*vi*/ new Array(0, 4, 0, 4, 0, 4, 4, 4, 4, 4, 4, 0, 4, 4, 1, 2, 5, 0, 1),
	/*ev*/ new Array(3, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*uv*/ new Array(3, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*lv*/ new Array(3, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*av*/ new Array(3, 4, 0, 4, 4, 4, 0, 0, 0, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*an*/ new Array(2, 4, 4, 4, 4, 4, 0, 4, 0, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*ki*/ new Array(2, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*ld*/ new Array(2, 4, 4, 4, 4, 4, 0, 4, 4, 4, 0, 1, 5, 5, 1, 2, 5, 0, 1),
	/*vg*/ new Array(2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 5, 5, 1, 2, 5, 0, 1),
	/*md*/ new Array(1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 5, 0, 1),
	/*se*/ new Array(1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 4, 1, 1, 2, 5, 0, 1),
	/*vs*/ new Array(1, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 1, 5, 5, 1, 2, 5, 0, 1),
	/*sp*/ new Array(6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6, 6, 5, 0, 6),
	/*lq*/ new Array(5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 0, 5, 5, 5),
	/*rq*/ new Array(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 5, 0, 1),
	/*wj*/ new Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 5, 0, 0),
	/*ot*/ new Array(1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 5, 0, 0)
);

var MM_LANG_MY = "my";
var MM_LANG_KSW = "ksw";
var language = "my";

/**
 * @param {string} someText
 * @param {number} i
 */
function canBreakAfter(someText, i) {
	var canBreak = false;
	// check that we aren't at the end of the text
	if (i + 1 == someText.length) return canBreak;
	var classA = myParser.getCharClass(someText.charCodeAt(i));
	var classB = myParser.getCharClass(someText.charCodeAt(i + 1));
	var breakStatus = myParser.getBreakStatus(classA, classB);
	var langHint = myParser.MM_LANG_MY;
	if (breakStatus == myParser.BK_CONTEXT) {
		langHint = myParser.guessLanguage(someText);
		breakStatus = myParser.evaluateContext(someText, i, langHint);
	}
	//alert(langHint + "Parser " + someText[i] + " " + someText[i+1] +
	//      " status:" + breakStatus + " " + classA + " " + classB);
	switch (breakStatus) {
		case myParser.BK_NO_BREAK:
		case myParser.BK_UNEXPECTED:
			canBreak = false;
			break;
		case myParser.BK_WEIGHT_1:
		case myParser.BK_WEIGHT_2:
		// syllable shouldn't be used for line breaking, only index tokenizing
		case myParser.BK_SYLLABLE:
		case myParser.BK_EOL:
		case myParser.BK_WHITESPACE:
			canBreak = true;
			break;
	}
	return canBreak;
}

/**
 * @param {number} before
 * @param {number} after
 */
function getBreakStatus(before, after) {
	// nj,vi = 0  e.g. husband
	// nj,lv = 2 e.g. abbreviation of male I
	// nj,ci = 2 I think
	// nj,lv = 0 for male first personal pronoun abbrev,
	// should we allow nj+ev,uv,av,an for the same reason?
	// in burmese the only valid use of nj is after virama
	return myParser.BKSTATUS[before - 1][after - 1];
}

/**
 * @param {any} mmChar
 */
function getCharClass(mmChar) {
	var mmClass = myParser.MMC_UNKNOWN;
	switch (mmChar) {
		case 0x1000:
		case 0x1001:
		case 0x1002:
		case 0x1003:
		case 0x1004:
		case 0x1005:
		case 0x1006:
		case 0x1007:
		case 0x1008:
		case 0x1009:
		case 0x100a:
		case 0x100b:
		case 0x100c:
		case 0x100d:
		case 0x100e:
		case 0x100f:
		case 0x1010:
		case 0x1011:
		case 0x1012:
		case 0x1013:
		case 0x1014:
		case 0x1015:
		case 0x1016:
		case 0x1017:
		case 0x1018:
		case 0x1019:
		case 0x101a:
		case 0x101b:
		case 0x101c:
		case 0x101d:
		case 0x101e:
		case 0x101f:
		case 0x1020:
		case 0x1021:
		case 0x1022:
		case 0x1023:
		case 0x1024:
		case 0x1025:
		case 0x1026:
		case 0x1027:
		case 0x1028:
		case 0x1029:
		case 0x102a:
		case 0x104e:
		case 0x1050:
		case 0x1051:
		case 0x1052:
		case 0x1053:
		case 0x1054:
		case 0x1055:
		case 0x105a:
		case 0x105b:
		case 0x105c:
		case 0x105d:
		case 0x1061:
		case 0x25cc:
		case 0x103f:
			//case 0x002d: // not sure about -
			mmClass = myParser.MMC_CI;
			break;
		case 0x103b:
		case 0x103c:
		case 0x103d:
		case 0x103e:
		case 0x105e:
		case 0x105f:
		case 0x1060:
			mmClass = myParser.MMC_ME; // medials
			break;
		case 0x1039:
			mmClass = myParser.MMC_VI;
			break;
		case 0x103a:
			mmClass = myParser.MMC_KI; // visible killer
			break;
		case 0x1031:
			mmClass = myParser.MMC_EV;
			break;
		case 0x102f:
		case 0x1030:
		case 0x1058:
		case 0x1059:
			mmClass = myParser.MMC_LV;
			break;
		case 0x102d:
		case 0x102e:
		case 0x1032:
		case 0x1033:
		case 0x1034:
			mmClass = myParser.MMC_UV;
			break;
		case 0x102b:
		case 0x102c:
		case 0x1056:
		case 0x1057:
		case 0x1062:
		case 0x1063:
		case 0x1064:
			mmClass = myParser.MMC_AV;
			break;
		case 0x1036:
			mmClass = myParser.MMC_AN;
			break;
		case 0x1037:
			mmClass = myParser.MMC_LD;
			break;
		case 0x1038:
			mmClass = myParser.MMC_VG;
			break;
		case 0x1040:
		case 0x1041:
		case 0x1042:
		case 0x1043:
		case 0x1044:
		case 0x1045:
		case 0x1046:
		case 0x1047:
		case 0x1048:
		case 0x1049:
			mmClass = myParser.MMC_MD;
			break;
		case 0x104a:
		case 0x104b:
		case 0x002c:
		case 0x002e:
		case 0x003a:
		case 0x003b:
		case 0x0021: // ?
		case 0x003f: // !
			mmClass = myParser.MMC_SE;
			break;
		case 0x104c:
		case 0x104d:
		case 0x104f:
		case 0x0027: // '
		case 0x0022: // "
		case 0x0060: // `
		case 0x002d: // -
		case 0x2013: //en dash
		case 0x2014: //em dash
			mmClass = myParser.MMC_VS;
			break;
		case 0x0020:
		case 0x2000:
		case 0x200b:
			mmClass = myParser.MMC_SP;
			break;
		case 0x0028:
		case 0x005b:
		case 0x007b:
		case 0x00ab:
		case 0x2018:
		case 0x201c:
		case 0x2039:
			mmClass = myParser.MMC_LQ;
			break;
		case 0x0029:
		case 0x005d:
		case 0x007d:
		case 0x00bb:
		case 0x2019:
		case 0x201d:
		case 0x203a:
			mmClass = myParser.MMC_RQ;
			break;
		case 0x200d:
		case 0x2060:
			mmClass = myParser.MMC_WJ;
			break;
		case 0x0020:
		case 0x0009: //tab
		case 0x000a: //LF
		case 0x000d: //CR
		case 0x005f: // -
		case 0x2013: // --
		case 0x2014: // --
		case 0x2000:
		case 0x2001:
		case 0x2002:
		case 0x2003:
		case 0x2004:
		case 0x2005:
		case 0x2006:
		case 0x2007:
		case 0x2008:
		case 0x2009:
		case 0x200a:
			mmClass = myParser.MMC_SP;
			break;
		default:
			mmClass = myParser.MMC_OT;
	}
	return mmClass;
}

/**
 * @param {string} contextText
 * @param {number} offset
 * @param {string} langHint
 */
function evaluateContext(contextText, offset, langHint) {
	var length = contextText.length;
	var text = new Array(0, 0, 0);
	for (var i = 0; i < myParser.MM_CONTEXT_LEN; i++) {
		if (offset + i < length) text[i] = contextText.charCodeAt(offset + i);
		else text[i] = 0x0020; //space
	}
	// deal with easy cases first
	if (text[0] == 0x1021) return myParser.BK_NO_BREAK;

	if (text[1] == 0x002d) return myParser.BK_NO_BREAK;
	if (text[1] == 0x103f) return myParser.BK_NO_BREAK;

	if (text[2] == 0x1039 || text[2] == 0x103a) {
		return myParser.BK_NO_BREAK;
	} else if (text[2] == 0x103a && langHint == myParser.MM_LANG_MY) {
		return myParser.BK_NO_BREAK;
	} else {
		return myParser.BK_WEIGHT_2;
	}
}

/**
 * @param {string | any[]} text
 */
function guessLanguage(text) {
	var length = text.length;
	var language = myParser.MM_LANG_MY;
	var prevChar = 0x0020;
	for (var i = 0; i < length && language == myParser.MM_LANG_MY; i++) {
		// we could look for specific sequences that are Karen specific as well
		switch (text[i]) {
			case 0x1060:
			case 0x1061:
			case 0x1062:
			case 0x1063:
			case 0x1064:
				language = myParser.MM_LANG_KSW;
				break;
			case 0x102c:
				if (prevChar == 0x1036 || prevChar == 0x1037) {
					language = myParser.MM_LANG_KSW;
					break;
				}
			default:
				prevChar = text[i];
		}
	}
	return language;
}
