(function initializeSettingsManager(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.SettingsManager = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsManagerApi() {
    const STORAGE_KEY = 'racat-settings-v1';

    const DEFAULT_SETTINGS = Object.freeze({
        language: 'ar',
        voiceURI: '',
        quietMode: false
    });

    const TEXT = Object.freeze({
        ar: Object.freeze({
            app_title: 'عداد الركعات المطور',
            preparing_ai: 'تجهيز الذكاء الاصطناعي',
            checking_model: 'جاري التحقق من النموذج...',
            verifying_model: 'جاري التحقق من النموذج وحفظه...',
            model_required: 'نموذج الذكاء الاصطناعي مطلوب',
            download_once: 'يتم تنزيله مرة واحدة ثم يُحفظ على هذا الجهاز.',
            download_model: 'تنزيل النموذج',
            download_speed: 'سرعة التنزيل',
            retry: 'المحاولة مرة أخرى',
            error_network: 'تعذر تنزيل النموذج، تحقق من الإنترنت وحاول مرة أخرى',
            error_storage: 'تعذر حفظ النموذج على الجهاز، وفر مساحة وحاول مرة أخرى',
            error_model_invalid: 'ملف الذكاء الاصطناعي غير صالح، أعد تنزيله',
            error_unknown: 'حدث خطأ غير متوقع، حاول مرة أخرى',
            settings: 'الإعدادات',
            settings_title: 'إعدادات التطبيق',
            back: 'رجوع',
            language: 'اللغة',
            arabic: 'العربية',
            english: 'English',
            voice: 'الصوت',
            system_voice: 'الصوت الافتراضي للجهاز',
            quiet_mode: 'الوضع الهادئ',
            quiet_description: 'إيقاف جميع التعليمات الصوتية',
            start_prayer: 'ابدأ الصلاة الآن',
            current_rakat: 'الركعة الحالية',
            model_ready: 'النموذج جاهز',
            tap_start: 'اضغط على زر البدء لتشغيل الكاميرا',
            connecting_camera: 'جاري الاتصال بالكاميرا...',
            allow_camera: 'يرجى السماح بالوصول إلى الكاميرا',
            camera_failed: 'تعذر تشغيل الكاميرا',
            face_here: 'يجب أن يكون وجهك هنا',
            face_not_visible: 'الوجه غير ظاهر، انظر إلى الكاميرا',
            move_back: 'ارجع خطوة واحدة إلى الخلف',
            move_closer: 'اقترب خطوة واحدة',
            position_correct: 'ممتاز، توقف في مكانك',
            preparing_position: 'تجهيز مكان الوقوف',
            follow_guide: 'ضع وجهك داخل المنطقة المضيئة في أعلى الشاشة',
            countdown_status: 'البدء خلال: {count}',
            reposition: 'أعد وضع وجهك داخل المنطقة المضيئة',
            camera_denied: 'يجب السماح للكاميرا حتى يعمل عداد الركعات',
            reset: 'إعادة الضبط',
            counter_reset: 'تمت إعادة عداد الركعات',
            standing: 'الوضع: وقوف',
            not_standing: 'الوضع: ليس وقوفاً',
            tracking_started: 'بدأ تتبع الصلاة',
            left_standing: 'تم رصد مغادرة وضع الوقوف',
            returned_from_ruku: 'تم رصد العودة من الركوع.. بانتظار السجود',
            rakat_complete: 'تم إكمال الركعة السابقة! الركعة {count}',
            rakat_number: 'الركعة {count}',
            countdown_5: 'خمسة',
            countdown_4: 'أربعة',
            countdown_3: 'ثلاثة',
            countdown_2: 'اثنان',
            countdown_1: 'واحد',
            countdown_0: 'صفر'
        }),
        en: Object.freeze({
            app_title: 'Smart Rak’ah Counter',
            preparing_ai: 'Preparing artificial intelligence',
            checking_model: 'Checking the model...',
            verifying_model: 'Checking and saving the model...',
            model_required: 'AI model required',
            download_once: 'It downloads once and is then saved on this device.',
            download_model: 'Download model',
            download_speed: 'Download speed',
            retry: 'Try again',
            error_network: 'Could not download the model. Check the internet and try again.',
            error_storage: 'Could not save the model. Free some storage and try again.',
            error_model_invalid: 'The AI model file is invalid. Download it again.',
            error_unknown: 'An unexpected error happened. Try again.',
            settings: 'Settings',
            settings_title: 'Application Settings',
            back: 'Back',
            language: 'Language',
            arabic: 'Arabic',
            english: 'English',
            voice: 'Voice',
            system_voice: 'Device default voice',
            quiet_mode: 'Quiet Mode',
            quiet_description: 'Turn off all spoken instructions',
            start_prayer: 'Start prayer now',
            current_rakat: 'Current Rak’ah',
            model_ready: 'Model ready',
            tap_start: 'Press Start to turn on the camera',
            connecting_camera: 'Connecting to the camera...',
            allow_camera: 'Please allow camera access',
            camera_failed: 'Could not start the camera',
            face_here: 'Your face should be here',
            face_not_visible: 'Face is not visible; look at the camera',
            move_back: 'Move back one step',
            move_closer: 'Move closer one step',
            position_correct: 'Great, stop in your place',
            preparing_position: 'Preparing your standing position',
            follow_guide: 'Put your face inside the highlighted area at the top',
            countdown_status: 'Starting in: {count}',
            reposition: 'Put your face back inside the highlighted area',
            camera_denied: 'Camera permission is required for the counter',
            reset: 'Reset',
            counter_reset: 'Rak’ah counter reset',
            standing: 'Position: standing',
            not_standing: 'Position: not standing',
            tracking_started: 'Prayer tracking started',
            left_standing: 'You left the standing position',
            returned_from_ruku: 'Return from Ruku detected; waiting for Sujud',
            rakat_complete: 'Previous Rak’ah completed! Rak’ah {count}',
            rakat_number: 'Rak’ah {count}',
            countdown_5: 'five',
            countdown_4: 'four',
            countdown_3: 'three',
            countdown_2: 'two',
            countdown_1: 'one',
            countdown_0: 'zero'
        })
    });

    function normalizeSettings(value) {
        return {
            language: value?.language === 'en' ? 'en' : 'ar',
            voiceURI: typeof value?.voiceURI === 'string' ? value.voiceURI : '',
            quietMode: value?.quietMode === true
        };
    }

    function loadSettings(storage = globalThis.localStorage) {
        try {
            const storedValue = storage?.getItem(STORAGE_KEY);
            if (!storedValue) return { ...DEFAULT_SETTINGS };
            return normalizeSettings(JSON.parse(storedValue));
        } catch (error) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings(settings, storage = globalThis.localStorage) {
        const normalized = normalizeSettings(settings);
        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Settings remain active for this session when storage is unavailable.
        }
        return normalized;
    }

    function translate(key, language = 'ar', replacements = {}) {
        const selectedLanguage = language === 'en' ? 'en' : 'ar';
        const template = TEXT[selectedLanguage][key] ?? TEXT.ar[key] ?? key;
        return Object.entries(replacements).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
            template
        );
    }

    function sortVoices(voices, language) {
        const prefix = language === 'en' ? 'en' : 'ar';
        return [...(voices || [])].sort((left, right) => {
            const leftMatch = left.lang?.toLowerCase().startsWith(prefix) ? 0 : 1;
            const rightMatch = right.lang?.toLowerCase().startsWith(prefix) ? 0 : 1;
            return leftMatch - rightMatch || left.name.localeCompare(right.name);
        });
    }

    function findVoice(voices, voiceURI, language) {
        const availableVoices = voices || [];
        if (voiceURI) {
            const savedVoice = availableVoices.find(voice => voice.voiceURI === voiceURI);
            if (savedVoice) return savedVoice;
        }

        const prefix = language === 'en' ? 'en' : 'ar';
        return availableVoices.find(voice => (
            voice.default && voice.lang?.toLowerCase().startsWith(prefix)
        )) || availableVoices.find(voice => voice.lang?.toLowerCase().startsWith(prefix)) || null;
    }

    function createSpeechRequest(messageKey, settings, voices, replacements = {}) {
        const normalized = normalizeSettings(settings);
        if (normalized.quietMode) return null;

        return {
            text: translate(messageKey, normalized.language, replacements),
            language: normalized.language === 'en' ? 'en-US' : 'ar-SA',
            voice: normalized.voiceURI
                ? findVoice(voices, normalized.voiceURI, normalized.language)
                : null
        };
    }

    return {
        DEFAULT_SETTINGS,
        STORAGE_KEY,
        TEXT,
        createSpeechRequest,
        findVoice,
        loadSettings,
        normalizeSettings,
        saveSettings,
        sortVoices,
        translate
    };
}));
