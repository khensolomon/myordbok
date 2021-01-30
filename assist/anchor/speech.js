import {escape} from 'querystring';
import {ask} from 'lethil';
import {setting} from './config.js';

/**
 * @param {{q:string,l:string}} query
 * https://www.googleapis.com/language/translate/v2?
 * https://translate.google.com/translate_a/single?
 * https://translation.googleapis.com/language/translate/v2?
 * https://translation.googleapis.com/language/translate/v2?source=en&target=my&q=love
 */
export function speech(query){
  return ask.request(setting.speechUrl.replace('$q',escape(query.q)).replace('$l',query.l));
}
