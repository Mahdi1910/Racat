(function initializeDeveloperSettings(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.DeveloperSettings = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createDeveloperSettingsApi() {
    const STORAGE_KEY = 'racat-developer-settings-v1';

    const FIELD_DEFINITIONS = Object.freeze([
        Object.freeze({
            key: 'setupFaceConfidencePct',
            labelKey: 'setup_face_confidence',
            descriptionKey: 'setup_face_confidence_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'targetBandTopPct',
            labelKey: 'top_face_position',
            descriptionKey: 'top_face_position_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'targetBandBottomPct',
            labelKey: 'bottom_face_position',
            descriptionKey: 'bottom_face_position_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'minimumFaceWidthPct',
            labelKey: 'minimum_face_size',
            descriptionKey: 'minimum_face_size_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'maximumFaceWidthPct',
            labelKey: 'maximum_face_size',
            descriptionKey: 'maximum_face_size_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'validPositionSeconds',
            labelKey: 'valid_position_hold',
            descriptionKey: 'valid_position_hold_description',
            unitKey: 'unit_seconds',
            step: 0.1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'invalidCountdownGraceSeconds',
            labelKey: 'wrong_position_grace',
            descriptionKey: 'wrong_position_grace_description',
            unitKey: 'unit_seconds',
            step: 0.1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'instructionSpeechCooldownSeconds',
            labelKey: 'voice_instruction_cooldown',
            descriptionKey: 'voice_instruction_cooldown_description',
            unitKey: 'unit_seconds',
            step: 0.1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'trackingFaceConfidencePct',
            labelKey: 'tracking_face_confidence',
            descriptionKey: 'tracking_face_confidence_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'countdownFrom',
            labelKey: 'countdown_start_number',
            descriptionKey: 'countdown_start_number_description',
            unitKey: 'unit_count',
            step: 1,
            inputMode: 'numeric'
        }),
        Object.freeze({
            key: 'minimumCalibrationSamples',
            labelKey: 'minimum_calibration_samples',
            descriptionKey: 'minimum_calibration_samples_description',
            unitKey: 'unit_samples',
            step: 1,
            inputMode: 'numeric'
        }),
        Object.freeze({
            key: 'standingZoneRadiusPct',
            labelKey: 'standing_movement_tolerance',
            descriptionKey: 'standing_movement_tolerance_description',
            unitKey: 'unit_percent',
            step: 1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'leaveStandingConfirmSeconds',
            labelKey: 'leave_standing_confirmation',
            descriptionKey: 'leave_standing_confirmation_description',
            unitKey: 'unit_seconds',
            step: 0.1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'missingFaceConfirmSeconds',
            labelKey: 'missing_face_confirmation',
            descriptionKey: 'missing_face_confirmation_description',
            unitKey: 'unit_seconds',
            step: 0.1,
            inputMode: 'decimal'
        }),
        Object.freeze({
            key: 'returnToStandingConfirmSeconds',
            labelKey: 'return_to_standing_confirmation',
            descriptionKey: 'return_to_standing_confirmation_description',
            unitKey: 'unit_seconds',
            step: 0.1,
            inputMode: 'decimal'
        })
    ]);

    const TEXT = Object.freeze({
        ar: Object.freeze({
            developer_title: 'خيارات المطور للاختبار',
            developer_badge: 'مؤقت',
            developer_intro: 'غيّر أرقام التعرف ثم اضغط حفظ واختبار. هذه الخيارات مؤقتة لاختيار أفضل إعدادات على هاتفك.',
            developer_save_test: 'حفظ واختبار',
            developer_restore_defaults: 'استعادة القيم الحالية',
            developer_error_numbers: 'تأكد أن جميع القيم أرقام صحيحة.',
            developer_error_confidence: 'نسبة ثقة الوجه يجب أن تكون أكبر من 0% وحتى 100%.',
            developer_error_vertical: 'يجب أن يكون الحد العلوي أقل من الحد السفلي وكلاهما بين 0% و100%.',
            developer_error_face_size: 'يجب أن يكون أقل حجم للوجه أكبر من 0% وأقل من أكبر حجم للوجه.',
            developer_error_timing: 'قيم الوقت لا يمكن أن تكون سالبة.',
            developer_error_integer: 'رقم العد وعدد عينات المعايرة يجب أن يكونا أعداداً صحيحة أكبر من صفر.',
            developer_error_tolerance: 'سماحية حركة الوقوف يجب أن تكون أكبر من 0% وحتى 100%.',
            developer_saved: 'تم حفظ قيم الاختبار.',
            setup_face_confidence: 'ثقة الوجه أثناء تحديد المكان',
            setup_face_confidence_description: 'مدى تأكد الذكاء الاصطناعي من نقاط الوجه قبل استخدامها أثناء تحديد مكان الوقوف.',
            top_face_position: 'الحد العلوي لمكان الوجه',
            top_face_position_description: 'أين تبدأ المنطقة المقبولة للوجه من أعلى صورة الكاميرا.',
            bottom_face_position: 'الحد السفلي لمكان الوجه',
            bottom_face_position_description: 'إلى أي مستوى أسفل صورة الكاميرا تمتد المنطقة المقبولة للوجه.',
            minimum_face_size: 'أقل حجم للوجه / أبعد مسافة',
            minimum_face_size_description: 'خفض الرقم يسمح لك بالوقوف أبعد عن الكاميرا.',
            maximum_face_size: 'أكبر حجم للوجه / أقرب مسافة',
            maximum_face_size_description: 'رفع الرقم يسمح لك بالوقوف أقرب إلى الكاميرا.',
            valid_position_hold: 'مدة تثبيت الوضع الصحيح',
            valid_position_hold_description: 'مدة بقاء الوضع صحيحاً قبل بدء العد التنازلي.',
            wrong_position_grace: 'مهلة الوضع الخاطئ أثناء العد',
            wrong_position_grace_description: 'كم يجب أن يبقى الوضع خاطئاً بشكل متواصل قبل إلغاء العد التنازلي.',
            voice_instruction_cooldown: 'مهلة تكرار تعليمات الصوت',
            voice_instruction_cooldown_description: 'أقل مدة قبل أن يكرر التطبيق نفس تعليمات تحديد المكان.',
            tracking_face_confidence: 'ثقة الوجه أثناء تتبع الصلاة',
            tracking_face_confidence_description: 'مدى تأكد الذكاء الاصطناعي من نقاط الوجه أثناء تتبع الوقوف في الصلاة.',
            countdown_start_number: 'رقم بداية العد التنازلي',
            countdown_start_number_description: 'الرقم الذي يبدأ منه العد قبل تشغيل تتبع الصلاة.',
            minimum_calibration_samples: 'أقل عدد لعينات المعايرة',
            minimum_calibration_samples_description: 'عدد قياسات الوجه الصحيحة المطلوبة لإنشاء مرجع الوقوف.',
            standing_movement_tolerance: 'سماحية حركة الوقوف',
            standing_movement_tolerance_description: 'مقدار حركة الوجه عمودياً بعيداً عن مكان الوقوف المرجعي مع بقائه محسوباً كوقوف.',
            leave_standing_confirmation: 'تأكيد مغادرة الوقوف',
            leave_standing_confirmation_description: 'مدة استمرار الخروج من منطقة الوقوف قبل تأكيد مغادرة الوقوف.',
            missing_face_confirmation: 'تأكيد اختفاء الوجه',
            missing_face_confirmation_description: 'مدة اختفاء الوجه قبل اعتباره خارج وضع الوقوف.',
            return_to_standing_confirmation: 'تأكيد العودة إلى الوقوف',
            return_to_standing_confirmation_description: 'مدة بقاء الوجه داخل منطقة الوقوف قبل تأكيد العودة.',
            unit_percent: '%',
            unit_seconds: 'ثانية',
            unit_samples: 'عينة',
            unit_count: 'عدد'
        }),
        en: Object.freeze({
            developer_title: 'Developer Options (Testing)',
            developer_badge: 'Temporary',
            developer_intro: 'Tune recognition numbers, then press Save & Test. These controls are temporary while you find the best values on your phone.',
            developer_save_test: 'Save & Test',
            developer_restore_defaults: 'Restore Current Defaults',
            developer_error_numbers: 'Make sure every value is a valid number.',
            developer_error_confidence: 'Face confidence must be greater than 0% and at most 100%.',
            developer_error_vertical: 'Top position must be below the bottom position, and both must be between 0% and 100%.',
            developer_error_face_size: 'Minimum face size must be greater than 0% and lower than maximum face size.',
            developer_error_timing: 'Timing values cannot be negative.',
            developer_error_integer: 'Countdown and calibration samples must be positive whole numbers.',
            developer_error_tolerance: 'Standing movement tolerance must be greater than 0% and at most 100%.',
            developer_saved: 'Testing values saved.',
            setup_face_confidence: 'Setup face confidence',
            setup_face_confidence_description: 'How certain the AI must be about face points while positioning.',
            top_face_position: 'Top face position',
            top_face_position_description: 'Where the accepted face area starts from the top of the camera image.',
            bottom_face_position: 'Bottom face position',
            bottom_face_position_description: 'How far down the accepted face area extends.',
            minimum_face_size: 'Minimum face size / far limit',
            minimum_face_size_description: 'Lower values let you stand farther from the camera.',
            maximum_face_size: 'Maximum face size / close limit',
            maximum_face_size_description: 'Higher values let you stand closer to the camera.',
            valid_position_hold: 'Valid-position hold time',
            valid_position_hold_description: 'How long your position must stay correct before countdown starts.',
            wrong_position_grace: 'Wrong-position grace',
            wrong_position_grace_description: 'How long positioning must stay continuously wrong before countdown restarts.',
            voice_instruction_cooldown: 'Voice instruction cooldown',
            voice_instruction_cooldown_description: 'Minimum time before Racat repeats the same positioning instruction.',
            tracking_face_confidence: 'Tracking face confidence',
            tracking_face_confidence_description: 'How certain the AI must be about face points while tracking prayer.',
            countdown_start_number: 'Countdown start number',
            countdown_start_number_description: 'The number Racat counts down from before prayer tracking.',
            minimum_calibration_samples: 'Minimum calibration samples',
            minimum_calibration_samples_description: 'Valid face measurements required before creating the standing reference.',
            standing_movement_tolerance: 'Standing movement tolerance',
            standing_movement_tolerance_description: 'How far your face may move vertically from the standing reference and still count as standing.',
            leave_standing_confirmation: 'Leave-standing confirmation',
            leave_standing_confirmation_description: 'How long movement outside the standing area must continue before leaving standing is confirmed.',
            missing_face_confirmation: 'Missing-face confirmation',
            missing_face_confirmation_description: 'How long the face may be missing before Racat treats you as not standing.',
            return_to_standing_confirmation: 'Return-to-standing confirmation',
            return_to_standing_confirmation_description: 'How long the face must remain back in the standing area before return is confirmed.',
            unit_percent: '%',
            unit_seconds: 'seconds',
            unit_samples: 'samples',
            unit_count: 'count'
        })
    });

    function roundForUi(value, digits = 3) {
        const factor = 10 ** digits;
        return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
    }

    function createDefaults(setupConfig, standingConfig) {
        return {
            setupFaceConfidencePct: roundForUi(setupConfig.faceConfidence * 100),
            targetBandTopPct: roundForUi(setupConfig.targetBandTop * 100),
            targetBandBottomPct: roundForUi(setupConfig.targetBandBottom * 100),
            minimumFaceWidthPct: roundForUi(setupConfig.minimumFaceWidth * 100),
            maximumFaceWidthPct: roundForUi(setupConfig.maximumFaceWidth * 100),
            validPositionSeconds: roundForUi(setupConfig.validPositionMs / 1000),
            invalidCountdownGraceSeconds: roundForUi(setupConfig.invalidCountdownGraceMs / 1000),
            instructionSpeechCooldownSeconds: roundForUi(setupConfig.instructionSpeechCooldownMs / 1000),
            trackingFaceConfidencePct: roundForUi(standingConfig.faceConfidence * 100),
            countdownFrom: standingConfig.countdownFrom,
            minimumCalibrationSamples: standingConfig.minimumCalibrationSamples,
            standingZoneRadiusPct: roundForUi(standingConfig.standingZoneRadius * 100),
            leaveStandingConfirmSeconds: roundForUi(standingConfig.leaveStandingConfirmMs / 1000),
            missingFaceConfirmSeconds: roundForUi(standingConfig.missingFaceConfirmMs / 1000),
            returnToStandingConfirmSeconds: roundForUi(standingConfig.returnToStandingConfirmMs / 1000)
        };
    }

    function parseNumber(value) {
        if (typeof value === 'string' && value.trim() === '') return Number.NaN;
        return Number(value);
    }

    function normalizeSettings(value, defaults) {
        const normalized = {};
        for (const field of FIELD_DEFINITIONS) {
            normalized[field.key] = parseNumber(
                value && Object.prototype.hasOwnProperty.call(value, field.key)
                    ? value[field.key]
                    : defaults[field.key]
            );
        }
        return normalized;
    }

    function validateSettings(value, defaults) {
        const normalized = normalizeSettings(value, defaults);
        const values = Object.values(normalized);

        if (values.some(item => !Number.isFinite(item))) {
            return { ok: false, errorKey: 'developer_error_numbers', value: normalized };
        }

        if (
            normalized.setupFaceConfidencePct <= 0
            || normalized.setupFaceConfidencePct > 100
            || normalized.trackingFaceConfidencePct <= 0
            || normalized.trackingFaceConfidencePct > 100
        ) {
            return { ok: false, errorKey: 'developer_error_confidence', value: normalized };
        }

        if (
            normalized.targetBandTopPct < 0
            || normalized.targetBandTopPct > 100
            || normalized.targetBandBottomPct < 0
            || normalized.targetBandBottomPct > 100
            || normalized.targetBandTopPct >= normalized.targetBandBottomPct
        ) {
            return { ok: false, errorKey: 'developer_error_vertical', value: normalized };
        }

        if (
            normalized.minimumFaceWidthPct <= 0
            || normalized.minimumFaceWidthPct > 100
            || normalized.maximumFaceWidthPct <= 0
            || normalized.maximumFaceWidthPct > 100
            || normalized.minimumFaceWidthPct >= normalized.maximumFaceWidthPct
        ) {
            return { ok: false, errorKey: 'developer_error_face_size', value: normalized };
        }

        const timingValues = [
            normalized.validPositionSeconds,
            normalized.invalidCountdownGraceSeconds,
            normalized.instructionSpeechCooldownSeconds,
            normalized.leaveStandingConfirmSeconds,
            normalized.missingFaceConfirmSeconds,
            normalized.returnToStandingConfirmSeconds
        ];
        if (timingValues.some(item => item < 0)) {
            return { ok: false, errorKey: 'developer_error_timing', value: normalized };
        }

        if (
            !Number.isInteger(normalized.countdownFrom)
            || normalized.countdownFrom <= 0
            || !Number.isInteger(normalized.minimumCalibrationSamples)
            || normalized.minimumCalibrationSamples <= 0
        ) {
            return { ok: false, errorKey: 'developer_error_integer', value: normalized };
        }

        if (normalized.standingZoneRadiusPct <= 0 || normalized.standingZoneRadiusPct > 100) {
            return { ok: false, errorKey: 'developer_error_tolerance', value: normalized };
        }

        return { ok: true, errorKey: null, value: normalized };
    }

    function loadSettings(defaults, storage = globalThis.localStorage) {
        try {
            const stored = storage?.getItem(STORAGE_KEY);
            if (!stored) return { ...defaults };
            const parsed = JSON.parse(stored);
            const result = validateSettings(parsed, defaults);
            return result.ok ? result.value : { ...defaults };
        } catch (error) {
            return { ...defaults };
        }
    }

    function saveSettings(value, defaults, storage = globalThis.localStorage) {
        const result = validateSettings(value, defaults);
        if (!result.ok) return result;

        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify(result.value));
        } catch (error) {
            // Runtime testing still works for this session when storage is unavailable.
        }

        return result;
    }

    function buildSetupConfig(settings, defaults) {
        return {
            ...defaults,
            faceConfidence: settings.setupFaceConfidencePct / 100,
            targetBandTop: settings.targetBandTopPct / 100,
            targetBandBottom: settings.targetBandBottomPct / 100,
            minimumFaceWidth: settings.minimumFaceWidthPct / 100,
            maximumFaceWidth: settings.maximumFaceWidthPct / 100,
            validPositionMs: settings.validPositionSeconds * 1000,
            invalidCountdownGraceMs: settings.invalidCountdownGraceSeconds * 1000,
            instructionSpeechCooldownMs: settings.instructionSpeechCooldownSeconds * 1000
        };
    }

    function buildStandingConfig(settings, defaults) {
        return {
            ...defaults,
            faceConfidence: settings.trackingFaceConfidencePct / 100,
            countdownFrom: settings.countdownFrom,
            minimumCalibrationSamples: settings.minimumCalibrationSamples,
            standingZoneRadius: settings.standingZoneRadiusPct / 100,
            leaveStandingConfirmMs: settings.leaveStandingConfirmSeconds * 1000,
            missingFaceConfirmMs: settings.missingFaceConfirmSeconds * 1000,
            returnToStandingConfirmMs: settings.returnToStandingConfirmSeconds * 1000
        };
    }

    function translate(key, language = 'ar') {
        const selectedLanguage = language === 'en' ? 'en' : 'ar';
        return TEXT[selectedLanguage][key] ?? TEXT.ar[key] ?? key;
    }

    return {
        FIELD_DEFINITIONS,
        STORAGE_KEY,
        TEXT,
        buildSetupConfig,
        buildStandingConfig,
        createDefaults,
        loadSettings,
        normalizeSettings,
        saveSettings,
        translate,
        validateSettings
    };
}));
