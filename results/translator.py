
import google.generativeai as genai
import os
from django.conf import settings

def translate_to_english(data_dict):
    """
    Uses Gemini AI to intelligently translate Bengali school/student data to English.
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if not api_key:
        return data_dict # Fallback to original if no key

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')

    prompt = f"""
    Translate the following Bengali school result data to English.
    Ensure proper noun spellings are standard and professional.
    Data: {data_dict}

    Rules:
    1. school_name, student_name, father_name, mother_name, guardian_name, address should be translated to proper English.
    2. 'subjects' is a list of Bengali subject names. You MUST return a JSON object where the 'subjects' key maps to a dictionary: {{ "Bengali Name": "English Name", ... }}.
    3. Return ONLY a valid JSON object with the keys: school_name, student_name, father_name, mother_name, guardian_name, address, subjects.
    """

    try:
        response = model.generate_content(prompt)
        # Extract JSON from response
        import json
        import re
        text = response.text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Translation Error: {e}")

    return data_dict
