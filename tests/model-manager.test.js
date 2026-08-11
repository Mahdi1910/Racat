const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'js', 'model-manager.js');
const moduleExists = fs.existsSync(modulePath);
const api = moduleExists ? require(modulePath) : {};

test('model manager module exists', () => {
    assert.equal(moduleExists, true);
});

function createDependencies(options = {}) {
    let saved = options.saved ?? false;
    const removed = [];
    const detectorCalls = [];
    const verificationModel = { dispose() {} };
    const downloadedModel = {
        async save() {
            if (options.saveError) throw options.saveError;
            saved = true;
        },
        dispose() {}
    };

    const tf = {
        io: {
            async listModels() {
                return saved ? { [api.MODEL_CONFIG.indexedDbUrl]: { dateSaved: new Date() } } : {};
            },
            async removeModel(url) {
                removed.push(url);
                saved = false;
            }
        },
        async loadGraphModel(url, loadOptions = {}) {
            if (url === api.MODEL_CONFIG.remoteUrl) {
                if (options.downloadError) throw options.downloadError;
                for (const value of options.progressValues || [0, 0.5, 1]) {
                    loadOptions.onProgress?.(value);
                }
                return downloadedModel;
            }

            if (options.corrupt) throw new Error('corrupt model');
            return verificationModel;
        }
    };

    const poseDetection = {
        SupportedModels: { MoveNet: 'MoveNet' },
        movenet: { modelType: { SINGLEPOSE_LIGHTNING: 'lightning' } },
        async createDetector(model, config) {
            detectorCalls.push({ model, config });
            return { model, config };
        }
    };

    return { tf, poseDetection, removed, detectorCalls };
}

test('missing IndexedDB model returns false', async () => {
    assert.equal(typeof api.createModelManager, 'function');
    const dependencies = createDependencies({ saved: false });
    const manager = api.createModelManager(dependencies);

    assert.equal(await manager.hasValidModel(), false);
});

test('matching IndexedDB model loads and validates', async () => {
    const dependencies = createDependencies({ saved: true });
    const manager = api.createModelManager(dependencies);

    assert.equal(await manager.hasValidModel(), true);
    assert.deepEqual(dependencies.removed, []);
});

test('corrupt IndexedDB model is removed and returns false', async () => {
    const dependencies = createDependencies({ saved: true, corrupt: true });
    const manager = api.createModelManager(dependencies);

    assert.equal(await manager.hasValidModel(), false);
    assert.deepEqual(dependencies.removed, [api.MODEL_CONFIG.indexedDbUrl]);
});

test('download progress never decreases', async () => {
    const dependencies = createDependencies({ progressValues: [0.4, 0.2, 0.75, 1] });
    const manager = api.createModelManager(dependencies);
    const percentages = [];

    await manager.downloadModel(progress => percentages.push(progress.percentage));

    assert.deepEqual(percentages, [40, 40, 75, 100]);
});

test('speed uses bytes received inside the rolling time window', () => {
    assert.equal(typeof api.createSpeedTracker, 'function');
    let time = 0;
    const tracker = api.createSpeedTracker({ windowMs: 1500, now: () => time });

    tracker.addBytes(1000);
    time = 1000;
    tracker.addBytes(1000);

    assert.equal(tracker.getMetrics().downloadedBytes, 2000);
    assert.equal(tracker.getMetrics().bytesPerSecond, 2000);
});

test('cached detector uses the IndexedDB model URL', async () => {
    const dependencies = createDependencies({ saved: true });
    const manager = api.createModelManager(dependencies);

    await manager.createDetector();

    assert.equal(dependencies.detectorCalls.length, 1);
    assert.equal(dependencies.detectorCalls[0].config.modelUrl, api.MODEL_CONFIG.indexedDbUrl);
    assert.equal(dependencies.detectorCalls[0].config.enableSmoothing, true);
});

test('network download failure uses the NETWORK error code', async () => {
    const dependencies = createDependencies({ downloadError: new Error('offline') });
    const manager = api.createModelManager(dependencies);

    await assert.rejects(manager.downloadModel(), error => error.code === 'NETWORK');
});

test('IndexedDB save failure uses the STORAGE error code', async () => {
    const dependencies = createDependencies({ saveError: new Error('quota') });
    const manager = api.createModelManager(dependencies);

    await assert.rejects(manager.downloadModel(), error => error.code === 'STORAGE');
});
