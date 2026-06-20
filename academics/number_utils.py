def bengali_to_english_number(num):
    """
    Convert Bengali numerals to English numerals.
    Accepts strings, integers, etc. Returns a string with all digits converted to English.
    """
    if num is None:
        return None
    
    num_str = str(num)
    bengali_digits = {
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    }
    
    result = []
    for char in num_str:
        if char in bengali_digits:
            result.append(bengali_digits[char])
        else:
            result.append(char)
    return ''.join(result)
