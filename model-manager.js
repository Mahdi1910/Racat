(function initializeModelManager(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.ModelManager = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createModelManagerApi() {
    const MODEL_CONFIG = Object.freeze({
        remoteUrl: 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4',
        indexedDbUrl: 'indexeddb://racat-movenet-singlepose-lightning-v4',
        modelVersion: 4,
        speedWindowMs: 1500
    });

    class ModelManagerError extends Error {
        constructor(code, cause) {
            super(code);
            this.name = 'ModelManagerError';
            this.code = code;
            this.cause = cause;
        }
    }

    function createSpeedTracker({
        windowMs = MODEL_CONFIG.speedWindowMs,
        now = () => performance.now()
    } = {}) {
        const samples = [];
        let downloadedBytes = 0;

        function removeOldSamples(currentTime) {
            const cutoff = currentTime - windowMs;
            while (samples.length > 1 && samples[0].time < cutoff) {
                samples.shift();
            }
        }

        function addBytes(byteCount) {
            if (!Number.isFinite(byteCount) || byteCount <= 0) return;
            const currentTime = now();
            downloadedBytes += byteCount;
            samples.push({ time: currentTime, bytes: byteCount });
            removeOldSamples(currentTime);
        }

        function getMetrics() {
            const currentTime = now();
            removeOldSamples(currentTime);
            const bytesInWindow = samples.reduce((total, sample) => total + sample.bytes, 0);
            const oldestTime = samples.length > 0 ? samples[0].time : currentTime;
            const elapsedSeconds = Math.max((currentTime - oldestTime) / 1000, 0.001);

            return {
                downloadedBytes,
                bytesPerSecond: samples.length > 0
                    ? Math.round(bytesInWindow / elapsedSeconds)
                    : 0
            };
        }

        return { addBytes, getMetrics };
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatSpeed(bytesPerSecond) {
        if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 KB/s';
        if (bytesPerSecond < 1024 * 1024) {
            return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        }
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }

    function createModelManager({
        tf,
        poseDetection,
        fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
        now = () => performance.now()
    }) {
        if (!tf || !poseDetection) {
            throw new Error('TensorFlow.js and pose detection are required.');
        }

        async function removeCachedModel() {
            try {
                await tf.io.removeModel(MODEL_CONFIG.indexedDbUrl);
            } catch (error) {
                // A missing model is already equivalent to a removed model.
            }
        }

        async function hasValidModel() {
            const models = await tf.io.listModels();
            if (!models[MODEL_CONFIG.indexedDbUrl]) return false;

            try {
                const model = await tf.loadGraphModel(MODEL_CONFIG.indexedDbUrl);
                model.dispose();
                return true;
            } catch (error) {
                await removeCachedModel();
                return false;
            }
        }

        function createTrackedFetch(speedTracker, emitProgress) {
            return async function trackedFetch(url, init) {
                if (!fetchImpl) throw new Error('Fetch is unavailable.');
                const response = await fetchImpl(url, init);

                if (!response.ok) {
                    throw new Error(`Model request failed with status ${response.status}.`);
                }

                if (!response.body || typeof response.body.getReader !== 'function'
                    || typeof ReadableStream === 'undefined' || typeof Response === 'undefined') {
                    return response;
                }

                const reader = response.body.getReader();
                const stream = new ReadableStream({
                    async pull(controller) {
                        const result = await reader.read();
                        if (result.done) {
                            controller.close();
                            return;
                        }

                        speedTracker.addBytes(result.value.byteLength);
                        emitProgress();
                        controller.enqueue(result.value);
                    },
                    cancel(reason) {
                        return reader.cancel(reason);
                    }
                });

                return new Response(stream, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            };
        }

        async function downloadModel(onProgress = () => {}) {
            const speedTracker = createSpeedTracker({
                windowMs: MODEL_CONFIG.speedWindowMs,
                now
            });
            let fraction = 0;

            function emitProgress(nextFraction = fraction) {
                fraction = Math.max(fraction, Math.min(1, Number(nextFraction) || 0));
                const metrics = speedTracker.getMetrics();
                onProgress({
                    fraction,
                    percentage: Math.round(fraction * 100),
                    downloadedBytes: metrics.downloadedBytes,
                    bytesPerSecond: metrics.bytesPerSecond
                });
            }

            let downloadedModel;
            try {
                downloadedModel = await tf.loadGraphModel(MODEL_CONFIG.remoteUrl, {
                    fromTFHub: true,
                    onProgress: emitProgress,
                    fetchFunc: createTrackedFetch(speedTracker, () => emitProgress())
                });
            } catch (error) {
                throw new ModelManagerError('NETWORK', error);
            }

            try {
                await downloadedModel.save(MODEL_CONFIG.indexedDbUrl);
            } catch (error) {
                downloadedModel.dispose();
                throw new ModelManagerError('STORAGE', error);
            }

            downloadedModel.dispose();

            if (!await hasValidModel()) {
                throw new ModelManagerError('MODEL_INVALID');
            }
        }

        function createDetector() {
            return poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                    modelUrl: MODEL_CONFIG.indexedDbUrl,
                    enableSmoothing: true
                }
            );
        }

        return {
            createDetector,
            downloadModel,
            hasValidModel,
            removeCachedModel
        };
    }

    return {
        MODEL_CONFIG,
        ModelManagerError,
        createModelManager,
        createSpeedTracker,
        formatBytes,
        formatSpeed
    };
}));
