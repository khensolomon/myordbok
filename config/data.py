"""
data.py
"""
from typing import List, TypedDict, Optional

# Define the structure of a single language entry.
# Using TypedDict lets your IDE know exactly what keys to expect.
class LangDict(TypedDict):
    id: str
    name: str
    my: str
    default: Optional[bool] # 'default' is not always present, so it's Optional.

# Define the structure of a dictionary group (e.g., "International").
class DictionaryGroup(TypedDict):
    name: str
    my: str
    lang: List[LangDict]

# We store the list of dictionaries in this file.
# This makes it easy to import and use in other parts of our app.

"""
A list of dictionary groups, categorized by region (International, Europe, Asia).
Each group contains a list of supported languages with their IDs, names in
English and Burmese, and an optional default flag.
"""
DICTIONARIES: List[DictionaryGroup] = [
	{
		"name": "International",
		"my": "အပြည်ပြည်ဆိုင်ရာ",
		"lang": [
			{
				"id": "en",
				"name": "English",
				"my": "အင်္ဂလိပ်",
				"default": True
			},
			{ "id": "iw", "name": "Hebrew", "my": "ဟေဗြဲ" },
			{ "id": "el", "name": "Greek", "my": "ဂရိ" },
			{ "id": "pt", "name": "Portuguese", "my": "ပေါ်တူဂီ" },
			{ "id": "fr", "name": "French", "my": "ပြင်သစ်" },
			{ "id": "nl", "name": "Dutch", "my": "ဒတ်ချ်" },
			{ "id": "ar", "name": "Arabic", "my": "အာရဗီ" },
			{ "id": "es", "name": "Spanish", "my": "စပိန်" }
		]
	},
	{
		"name": "Europe",
		"my": "ဥရောပ",
		"lang": [
			{ "id": "no", "name": "Norwegian", "my": "နော်ဝေ" },
			{ "id": "fi", "name": "Finnish", "my": "ဖင်လန်" },
			{ "id": "ro", "name": "Romanian", "my": "ရိုမေးနီးယား" },
			{ "id": "pl", "name": "Polish", "my": "ပိုလန်" },
			{ "id": "sv", "name": "Swedish", "my": "ဆွီဒင်" },
			{ "id": "da", "name": "Danish", "my": "ဒိန်းမတ်" },
			{ "id": "de", "name": "German", "my": "ဂျာမန်" },
			{ "id": "ru", "name": "Russian", "my": "ရုရှ" }
		]
	},
	{
		"name": "Asia",
		"my": "အာရှ",
		"lang": [
			{ "id": "ja", "name": "Japanese", "my": "ဂျပန်" },
			{ "id": "zh", "name": "Chinese", "my": "တရုတ်" },
			{ "id": "ko", "name": "Korean", "my": "ကိုရီးယား" },
			{ "id": "ms", "name": "Malay", "my": "မလေးရှား" },
			{ "id": "tl", "name": "Filipion", "my": "ဖိလစ်ပိုင်" },
			{ "id": "vi", "name": "Vietnamese", "my": "ဗီယက်နမ်" },
			{ "id": "th", "name": "Thai", "my": "ယိုးဒယား" },
			{ "id": "hi", "name": "Hindi", "my": "ဟိန္ဒီ" }
		]
	}
]
