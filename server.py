from flask import Flask, send_from_directory, request, jsonify
from gtts import gTTS
import os
import requests
from bs4 import BeautifulSoup
import io
import base64
import language_tool_python
from langdetect import detect  # Feature 1 & 2 के लिए

app = Flask(__name__)

# LanguageTool को इनिशियलाइज़ करें (ऑफलाइन मोड में)
tool = language_tool_python.LanguageTool('en-US')

@app.route('/')
def index():
    return open('index.html').read()

@app.route('/<path:filename>')
def serve_static(filename):
    response = send_from_directory('.', filename)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/check_grammar', methods=['POST'])
def check_grammar():
    try:
        data = request.json
        text = data['text']
        lang = data['lang']
        print(f"Checking grammar for text: {text} in language: {lang}")

        # LanguageTool को सही लैंग्वेज में सेट करें (यहाँ सिर्फ़ इंग्लिश सपोर्ट करेंगे अभी)
        if lang != 'en':
            return jsonify({
                'originalText': text,
                'correctedText': text,
                'errors': [],
                'errorDetails': 'Grammar checking is only supported for English currently.'
            })

        # ग्रामर चेक करें
        matches = tool.check(text)
        corrected_text = tool.correct(text)

        # गलतियों का डिटेल तैयार करें
        errors = []
        for match in matches:
            error_detail = {
                'message': match.message,
                'incorrect': text[match.offset:match.offset + match.errorLength],
                'suggestions': match.replacements
            }
            errors.append(error_detail)

        print(f"Grammar check result: Original: {text}, Corrected: {corrected_text}, Errors: {errors}")
        return jsonify({
            'originalText': text,
            'correctedText': corrected_text,
            'errors': errors,
            'errorDetails': '\n'.join([f"Error: {e['message']}, Found: {e['incorrect']}, Suggestions: {', '.join(e['suggestions'])}" for e in errors]) if errors else 'No errors found.'
        })

    except Exception as e:
        print("Grammar check error:", str(e))
        return jsonify({'error': str(e)})

# Feature 1 & 2: Language Detection Endpoint
@app.route('/detect_language', methods=['POST'])
def detect_language():
    try:
        data = request.json
        text = data['text']
        detected_lang = detect(text)
        print(f"Detected language: {detected_lang} for text: {text}")
        return jsonify({'detectedLang': detected_lang})
    except Exception as e:
        print(f"Language detection error: {str(e)}")
        return jsonify({'error': str(e)})

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.json
        text = data['q']
        source = data['source']
        target = data['target']
        print(f"Received translation request: text='{text}', source={source}, target={target}")

        # Feature 1: Auto-Detect Language
        if source == 'auto':
            detected_lang = detect(text)
            source = detected_lang
            print(f"Auto-detected source language: {source}")

        # Feature 9: Multi-Language UI Support (Translate UI labels)
        if 'ui_labels' in data:
            ui_labels = data['ui_labels']
            translated_labels = {}
            for label in ui_labels:
                translated = requests.get(
                    f"https://translate.google.com/m?sl=en&tl={target}&q={label}",
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124"}
                )
                soup = BeautifulSoup(translated.text, 'html.parser')
                translated_text = soup.find("div", {"class": "result-container"})
                translated_labels[label] = translated_text.text.strip() if translated_text else label
            return jsonify({'translatedLabels': translated_labels})

        # पहले ग्रामर चेक करें (अगर सोर्स लैंग्वेज इंग्लिश है)
        corrected_text = text
        error_details = None
        if source == 'en':
            grammar_response = requests.post('http://localhost:8080/check_grammar', json={'text': text, 'lang': source}).json()
            corrected_text = grammar_response['correctedText']
            error_details = grammar_response['errorDetails']
            print(f"Grammar corrected text: {corrected_text}, Errors: {error_details}")

        # अगर source और target एक ही हैं, तो डायरेक्ट टेक्स्ट रिटर्न करें
        if source == target:
            print(f"Source and target are the same ({source}). Skipping translation.")
            return jsonify({'translatedText': corrected_text, 'errorDetails': error_details})

        url = f"https://translate.google.com/m?sl={source}&tl={target}&q={corrected_text}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124",
            "Accept-Language": "en-US,en;q=0.9"
        }
        print("Sending request to Google Translate:", url)

        response = requests.get(url, headers=headers)
        print("Response status code:", response.status_code)

        soup = BeautifulSoup(response.text, 'html.parser')
        translated_text = None

        # तरीका 1: "result-container" डिव
        translated_text = soup.find("div", {"class": "result-container"})
        if translated_text:
            translated_text = translated_text.text.strip()
            print("Translated text (method 1):", translated_text)
            return jsonify({'translatedText': translated_text, 'errorDetails': error_details})

        # तरीका 2: "t0" डिव
        translated_text = soup.find("div", {"class": "t0"})
        if translated_text:
            translated_text = translated_text.text.strip()
            print("Translated text (method 2):", translated_text)
            return jsonify({'translatedText': translated_text, 'errorDetails': error_details})

        # तरीका 3: "translation" डिव
        translated_text = soup.find("div", {"class": "translation"})
        if translated_text:
            translated_text = translated_text.text.strip()
            print("Translated text (method 3):", translated_text)
            return jsonify({'translatedText': translated_text, 'errorDetails': error_details})

        print("HTML structure (first 2000 chars):", str(soup)[:2000])
        return jsonify({'error': 'Could not find translated text in the response'})

    except Exception as e:
        print("Translation error:", str(e))
        return jsonify({'error': str(e)})

@app.route('/tts', methods=['POST'])
def tts():
    try:
        data = request.json
        text = data['text']
        lang = data['lang']
        print(f"Generating audio for text: {text} in language: {lang}")

        supported_languages = {
            'af': 'af', 'ar': 'ar', 'bg': 'bg', 'bn': 'bn', 'bs': 'bs', 'ca': 'ca', 'cs': 'cs', 'da': 'da',
            'de': 'de', 'el': 'el', 'en': 'en', 'es': 'es', 'et': 'et', 'fi': 'fi', 'fr': 'fr', 'gu': 'gu',
            'hi': 'hi', 'hr': 'hr', 'hu': 'hu', 'id': 'id', 'it': 'it', 'ja': 'ja', 'kn': 'kn', 'ko': 'ko',
            'lt': 'lt', 'lv': 'lv', 'ml': 'ml', 'mr': 'mr', 'ms': 'ms', 'nl': 'nl', 'no': 'no', 'pl': 'pl',
            'pt': 'pt', 'ro': 'ro', 'ru': 'ru', 'sk': 'sk', 'sl': 'sl', 'sq': 'sq', 'sr': 'sr', 'sv': 'sv',
            'ta': 'ta', 'te': 'te', 'th': 'th', 'tr': 'tr', 'uk': 'uk', 'vi': 'vi', 'zh': 'zh-cn', 'zh-cn': 'zh-cn',
            'zh-tw': 'zh-tw'
        }

        if lang not in supported_languages:
            print(f"Language {lang} not supported by gTTS, falling back to 'en'")
            lang = 'en'
        else:
            lang = supported_languages[lang]

        tts = gTTS(text=text, lang=lang, slow=False)
        audio_io = io.BytesIO()
        tts.write_to_fp(audio_io)
        audio_io.seek(0)

        audio_base64 = base64.b64encode(audio_io.read()).decode('utf-8')

        return jsonify({'audio_base64': audio_base64})

    except Exception as e:
        print("TTS error:", str(e))
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    print("Starting Flask server on port 8080...")
    app.run(host='0.0.0.0', port=8080, debug=True)
