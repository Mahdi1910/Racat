const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'js', 'settings-manager.js');
const moduleExists = fs.existsSync(modulePath);
const api = moduleExists ? require(modulePath) : {};

function createStorage(initialValue) {
    const values = new Map();
    if (initialValue !== undefined) {
        values.set('racat-settings-v1', initialValue);
    }

    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
        value(key = 'racat-settings-v1') {
            return values.get(key);
        }
    };
}

const voices = [
    { name: 'English One', lang: 'en-US', voiceURI: 'voice-en', default: true },
    { name: 'Arabic Two', lang: 'ar-IQ', voiceURI: 'voice-ar-2', default: false },
    { name: 'Arabic One', lang: 'ar-SA', voiceURI: 'voice-ar-1', default: true }
];

test('settings manager module exists', () => {
    assert.equal(moduleExists, true);
});

test('uses Arabic, system voice, and speech enabled by default', () => {
    assert.deepEqual(api.DEFAULT_SETTINGS, {
        language: 'ar',
        voiceURI: '',
        quietMode: false
    });
});

test('normalizes unknown language back to Arabic', () => {
    assert.deepEqual(api.normalizeSettings({
        language: 'fr',
        voiceURI: 100,
        quietMode: 'yes'
    }), {
        language: 'ar',
        voiceURI: '',
        quietMode: false
    });
});

test('loads valid settings from localStorage', () => {
    const storage = createStorage(JSON.stringify({
        language: 'en',
        voiceURI: 'voice-en',
        quietMode: true
    }));

    assert.deepEqual(api.loadSettings(storage), {
        language: 'en',
        voiceURI: 'voice-en',
        quietMode: true
    });
});

test('returns defaults when stored JSON is corrupt', () => {
    assert.deepEqual(api.loadSettings(createStorage('{bad json')), api.DEFAULT_SETTINGS);
});

test('returns defaults when localStorage is blocked', () => {
    const storage = {
        getItem() {
            throw new Error('blocked');
        }
    };

    assert.deepEqual(api.loadSettings(storage), api.DEFAULT_SETTINGS);
});

test('saves only normalized settings', () => {
    const storage = createStorage();
    const saved = api.saveSettings({
        language: 'en',
        voiceURI: 'voice-en',
        quietMode: 1,
        ignored: 'value'
    }, storage);

    assert.deepEqual(saved, {
        language: 'en',
        voiceURI: 'voice-en',
        quietMode: false
    });
    assert.deepEqual(JSON.parse(storage.value()), saved);
});

test('translates a message into Arabic and English', () => {
    assert.equal(api.translate('settings', 'ar'), 'الإعدادات');
    assert.equal(api.translate('settings', 'en'), 'Settings');
    assert.equal(api.translate('rakat_number', 'en', { count: 3 }), 'Rak’ah 3');
});

test('falls back to Arabic when a language or key is unknown', () => {
    assert.equal(api.translate('settings', 'unknown'), 'الإعدادات');
    assert.equal(api.translate('unknown_key', 'en'), 'unknown_key');
});

test('places matching-language voices before other voices', () => {
    assert.deepEqual(
        api.sortVoices(voices, 'ar').map(voice => voice.voiceURI),
        ['voice-ar-1', 'voice-ar-2', 'voice-en']
    );
});

test('finds the saved voice by voiceURI', () => {
    assert.equal(api.findVoice(voices, 'voice-ar-2', 'ar').voiceURI, 'voice-ar-2');
});

test('falls back to a matching-language default voice', () => {
    assert.equal(api.findVoice(voices, 'missing', 'en').voiceURI, 'voice-en');
});

test('Quiet Mode prevents a speech request', () => {
    assert.equal(api.createSpeechRequest('move_back', {
        language: 'ar',
        voiceURI: 'voice-ar-1',
        quietMode: true
    }, voices), null);
});

test('empty voice selection leaves the device default voice in control', () => {
    const request = api.createSpeechRequest('move_back', {
        language: 'ar',
        voiceURI: '',
        quietMode: false
    }, voices);

    assert.equal(request.voice, null);
});

test('Arabic speech uses the saved Arabic voice', () => {
    const request = api.createSpeechRequest('move_back', {
        language: 'ar',
        voiceURI: 'voice-ar-2',
        quietMode: false
    }, voices);

    assert.equal(request.text, 'ارجع خطوة واحدة إلى الخلف');
    assert.equal(request.language, 'ar-SA');
    assert.equal(request.voice.voiceURI, 'voice-ar-2');
});

test('English speech uses the saved English voice', () => {
    const request = api.createSpeechRequest('move_closer', {
        language: 'en',
        voiceURI: 'voice-en',
        quietMode: false
    }, voices);

    assert.equal(request.text, 'Move closer one step');
    assert.equal(request.language, 'en-US');
    assert.equal(request.voice.voiceURI, 'voice-en');
});

test('missing saved voice falls back without breaking speech', () => {
    const request = api.createSpeechRequest('position_correct', {
        language: 'ar',
        voiceURI: 'missing',
        quietMode: false
    }, voices);

    assert.equal(request.voice.voiceURI, 'voice-ar-1');
});
