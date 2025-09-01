# myanmarNotation
# Copyright(c) 2018-2022 Khen Solomon Lethil
# MIT Licensed
# v1.5.0
# Ported to Python by Gemini, refactored into a class.

class MyanmarNotation:
    """
    A class to convert numbers into Burmese word notation.
    """
    # Configuration data, similar to the '$' object in the JS version
    _CONFIG = {
        "conjunction": {
            "space": " ",
            "comma": "၊ ",
            "and": "နှင့် ",
            "plus": "ပေါင်း "
        },
        "numeral": [
            {"name": "သုည", "digit": "၀"},
            {"name": "တစ်", "digit": "၁"},
            {"name": "နှစ်", "digit": "၂"},
            {"name": "သုံး", "digit": "၃"},
            {"name": "လေး", "digit": "၄"},
            {"name": "ငါး", "digit": "၅"},
            {"name": "ခြောက်", "digit": "၆"},
            {"name": "ခုနစ်", "digit": "၇"},
            {"name": "ရှစ်", "digit": "၈"},
            {"name": "ကိုး", "digit": "၉"}
        ],
        "scale": [
            {"name": "", "rule": 0},
            {"name": "ဆယ်", "rule": 1, "creaky": "ဆယ့်"},
            {"name": "ရာ", "rule": 2, "creaky": "ရာ့"},
            {"name": "ထောင်", "rule": 3, "creaky": "ထောင့်"},
            {"name": "သောင်း", "rule": 4},
            {"name": "သိန်း", "rule": 5, "limit": True},
            {"name": "သန်း", "rule": 6, "limit": True},
            {"name": "ကု​ဋေ​", "rule": 7, "limit": True}
            # Additional scales from the original JS are commented out but can be added here
        ]
    }

    # Constants for internal logic
    _UNIT_LEFT = "l"
    _UNIT_RIGHT = "r"

    # Create mappings for quick digit conversion
    _DIGIT_BURMESE = [e["digit"] for e in _CONFIG["numeral"]]
    _ASCII_TO_BURMESE_MAP = {str(i): digit for i, digit in enumerate(_DIGIT_BURMESE)}
    _BURMESE_TO_ASCII_MAP = {digit: str(i) for i, digit in enumerate(_DIGIT_BURMESE)}

    def multiplication(self, length, head="1"):
        """
        Joins a zero tail to a head string.
        
        Args:
            length (int): The number of zeros to append.
            head (str): The leading string, defaults to "1".
            
        Returns:
            str: The resulting string.
        """
        return head + '0' * length

    def keep(self, s):
        """
        Converts a string with ASCII digits to Burmese digits.
        
        Args:
            s (str): The input string.
            
        Returns:
            str: String with Burmese digits.
        """
        return "".join([self._ASCII_TO_BURMESE_MAP.get(char, char) for char in s])

    def turn(self, s):
        """
        Converts a string with Burmese digits to ASCII digits.
        
        Args:
            s (str): The input string.
            
        Returns:
            str: String with ASCII digits.
        """
        return "".join([self._BURMESE_TO_ASCII_MAP.get(char, char) for char in s])

    def _chunk(self, s, size, right=0):
        """
        Splits a string into chunks of a given size.
        
        Args:
            s (str): The string to chunk.
            size (int): The size of each chunk.
            right (int): If 1, the first chunk may be smaller. Defaults to 0.
            
        Returns:
            list: A list of string chunks.
        """
        if not s or size <= 0:
            return []
            
        length = len(s)
        if right == 1:
            first_chunk_size = length % size or size
            chunks = [s[:first_chunk_size]]
            chunks.extend([s[i:i + size] for i in range(first_chunk_size, length, size)])
            return chunks
        else:
            return [s[i:i + size] for i in range(0, length, size)]

    def _sense(self, s="0"):
        """
        Generates the Burmese word representation for numbers up to 10,000.
        
        Args:
            s (str): A string of digits, max length is 8.
            
        Returns:
            dict: A dictionary containing the sense result.
        """
        raw = []
        k = len(s)
        row = {"sense": "", "rule": k, "size": k, "list": []}

        if k <= 1 and int(s) < 1:
            row["sense"] = self._CONFIG["numeral"][0]["name"]
            return row

        for i, char_num in enumerate(s):
            num = int(char_num)
            if num > 0:
                index = k - i - 1
                if raw and index < 3:
                    last = raw[-1]
                    if "creaky" in self._CONFIG["scale"][last["index"]]:
                        last["creaky"] = True
                        last["tone"] = self._CONFIG["scale"][last["index"]]["creaky"]
                
                raw.append({
                    "name": self._CONFIG["numeral"][num]["name"],
                    "tone": self._CONFIG["scale"][index]["name"],
                    "creaky": False,
                    "index": index
                })
                
        row["sense"] = "".join([e["name"] + e["tone"] for e in raw])
        return row

    def _engine(self, s, scale):
        """
        Handles larger numbers by breaking them down based on a given scale.
        
        Args:
            s (str): The digit string.
            scale (dict): The scale object from CONFIG.
            
        Returns:
            dict: The notation result.
        """
        rule = scale["rule"]
        if rule < 5:
            return self._sense(s)

        name = scale["name"]
        list_chunks = self._chunk(s, rule, 1)
        size = len(list_chunks)
        last_index = size - 1

        fst = ""
        mid = []
        
        for i, num_chunk in enumerate(list_chunks):
            row = self._sense(num_chunk)
            is_head = i % 2 == 0
            
            if i > 1 or is_head:
                mid.append(name)
            
            if row["sense"]:
                if is_head:
                    if i == 0:
                        fst += self._UNIT_LEFT
                    elif i != last_index:
                        fst += name
                    fst += row["sense"]
                    if len(num_chunk) <= 1:
                        fst += self._UNIT_RIGHT
                else:
                    if i == last_index:
                        fst += self._CONFIG["conjunction"]["space"]
                    else:
                        fst += self._CONFIG["conjunction"]["and"]
                    fst += row["sense"]
                    if i != last_index:
                        fst += self._CONFIG["conjunction"]["comma"]
        
        # Corrected logic to handle ordering and combination of number parts.
        # This mirrors the original JavaScript's use of shift() which modifies the array in place.
        if self._UNIT_RIGHT in fst:
            # This handles single-digit chunks to produce outputs like "ရှစ်ကု​ဋေ​"
            fst = fst.replace(self._UNIT_RIGHT, mid.pop(0) if mid else "", 1)

        mid_str = ""
        if mid:
            # This correctly joins the remaining scale markers for very large numbers.
            # It replicates the JS logic: .join(',').replace(',', '+', 1)
            mid_str = self._CONFIG["conjunction"]["comma"].join(mid)
            mid_str = mid_str.replace(self._CONFIG["conjunction"]["comma"], self._CONFIG["conjunction"]["plus"], 1)

        # This handles multi-digit chunks by prepending the scale, producing formal outputs like "သိန်းရှစ်ရာ"
        final_sense = fst.replace(self._UNIT_LEFT, mid_str, 1)
        
        return {
            "sense": final_sense,
            "rule": rule,
            "size": len(s),
            "list": list_chunks
        }

    def get(self, s):
        """
        Main function to convert a number into Burmese notation.
        
        Args:
            s (str or int): The number to convert.
            
        Returns:
            dict: A result object with number, digit, and notation details.
        """
        if isinstance(s, int):
            s = str(s)
        
        # Check if the string contains any Burmese digits
        if any(digit in s for digit in self._DIGIT_BURMESE):
            s = self.turn(s)
            
        s = s.lstrip('0').replace(',', '').replace(' ', '')
        if not s:
            s = '0'

        query = str(int(s))
        k = len(query) - 1
        
        result = {
            "number": self.keep(query),
            "digit": query,
            "notation": []
        }

        if int(query) <= 0:
            result["notation"].append(self._sense('0'))
        else:
            # Filter applicable scales
            applicable_scales = [
                e for e in self._CONFIG["scale"] 
                if (e.get("limit") and e["rule"] <= k) or e["rule"] == k
            ]
            result["notation"] = [self._engine(query, e) for e in applicable_scales]
            
        return result


myanmarNotation = MyanmarNotation()
# Example usage:
if __name__ == "__main__":
    converter = MyanmarNotation()
    test_numbers = ["12345", "100000", "1234567", "987654321", "၀", "၁၂၃", "80000000"]
    
    for number in test_numbers:
        notation_result = converter.get(number)
        print(f"Input: {number}")
        print(f"  Digit: {notation_result['digit']}")
        print(f"  Burmese Number: {notation_result['number']}")
        print("  Notations:")
        for note in notation_result['notation']:
            print(f"    - Sense: {note['sense']}")
            print(f"      (Rule: {note['rule']}, Size: {note['size']}, Chunks: {note['list']})")
        print("-" * 20)

