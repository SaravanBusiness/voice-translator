from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS  # CORS सेटअप
from gtts import gTTS
import requests
from bs4 import BeautifulSoup
import language_tool_python
import langdetect
import os
import base64

app = Flask(__name__)
CORS(app)  # CORS सेटअप

tool = language_tool_python.LanguageTool('en-US')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('', path)

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.get_json()
        if 'ui_labels' in data:
            labels = data['ui_labels']
            target = data['target']
            translated_labels = {}
            for label in labels:
                translated = translate_text(label, 'en', target)
                translated_labels[label] = translated
            return jsonify({'translatedLabels': translated_labels})
        else:
            text = data['q']
            source = data['source']
            target = data['target']
            translated = translate_text(text, source, target)
            errors = check_grammar(text)
            return jsonify({'translatedText': translated, 'errorDetails': errors})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.get_json()
        text = data['text']
        lang = data['lang']
        tts = gTTS(text=text, lang=lang)
        tts.save('output.mp3')
        with open('output.mp3', 'rb') as audio_file:
            audio_base64 = base64.b64encode(audio_file.read()).decode('utf-8')
        os.remove('output.mp3')
        return jsonify({'audio_base64': audio_base64})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/detect_language', methods=['POST'])
def detect_language():
    try:
        data = request.get_json()
        text = data['text']
        lang = langdetect.detect(text)
        return jsonify({'detectedLang': lang})
    except Exception as e:
        return jsonify({'error': str(e)})

def translate_text(text, source, target):
    url = f"https://translate.google.com/m?hl=en&sl={source}&tl={target}&q={text}"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    translated = soup.find('div', class_='result-container').text
    return translated

def check_grammar(text):
    matches = tool.check(text)
    errors = []
    for match in matches:
        errors.append(f"Error: {match.ruleId}, Message: {match.message}, Suggestion: {match.replacements}")
    return errors if errors else None

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)