import {
    buildCharacterColorizerKey,
    buildCharacterColorizerKeyFromParts,
    buildPersonaColorizerKey,
    normalizeHexColor,
} from './colorizer-helpers.js';

const DEFAULTS = {
    character: {
        dialogSource: 'avatar_vibrant',
        dialogStatic: '#da6745ff',
        bubbleMode: 'gradient',
        bubbleStatic1: '#da6745ff',
        bubbleStatic2: '#da6745ff',
        colorizeTarget: 3,
        bubbleOpacity: 0.1,
        bubbleGradientStops: [],
        bubbleGradientAngle: 225,
    },
    persona: {
        dialogSource: 'avatar_vibrant',
        dialogStatic: '#537fddff',
        bubbleMode: 'gradient',
        bubbleStatic1: '#537fddff',
        bubbleStatic2: '#537fddff',
        colorizeTarget: 3,
        bubbleOpacity: 0.1,
        bubbleGradientStops: [],
        bubbleGradientAngle: 125,
    },
};

const STORE_KEYS = {
    character: {
        enabled: 'charCustomColorizerEnabled',
        settings: 'charCustomColorizerSettings',
    },
    persona: {
        enabled: 'personaCustomColorizerEnabled',
        settings: 'personaCustomColorizerSettings',
    },
};

const SOURCE_VALUES = new Set(['avatar_vibrant', 'static_color']);
const BUBBLE_MODE_VALUES = new Set(['avatar_light', 'avatar_dark', 'static_color', 'gradient']);
const TARGET_VALUES = new Set([1, 2, 3]);

function getType(type) {
    return type === 'persona' ? 'persona' : 'character';
}

function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

function normalizeGradientStops(stops, fallbackColor) {
    if (!Array.isArray(stops)) return [];
    return stops.map(stop => ({
        color: normalizeHexColor(stop?.color, fallbackColor),
        position: clampNumber(stop?.position, 0, 0, 1),
    }));
}

function normalizeBubbleMode(entry, fallback) {
    if (BUBBLE_MODE_VALUES.has(entry?.bubbleMode)) return entry.bubbleMode;
    if (entry?.bubbleColorMode === 3) return 'gradient';
    return fallback;
}

export function getColorizerCustomDefaults(type) {
    return { ...DEFAULTS[getType(type)] };
}

export function buildCharacterCustomColorizerKey(charName, avatarFilename) {
    return buildCharacterColorizerKeyFromParts(charName, avatarFilename);
}

export function buildCustomColorizerKey(type, uid, domAvatarUrl) {
    return getType(type) === 'persona'
        ? buildPersonaColorizerKey(uid, domAvatarUrl)
        : buildCharacterColorizerKey(uid, domAvatarUrl);
}

export function buildColorizerCustomEntry(type, patch = {}) {
    const defaults = DEFAULTS[getType(type)];
    const entry = { ...defaults, ...patch };
    return {
        dialogSource: SOURCE_VALUES.has(entry.dialogSource) ? entry.dialogSource : defaults.dialogSource,
        dialogStatic: normalizeHexColor(entry.dialogStatic, defaults.dialogStatic),
        bubbleMode: normalizeBubbleMode(entry, defaults.bubbleMode),
        bubbleStatic1: normalizeHexColor(entry.bubbleStatic1, defaults.bubbleStatic1),
        bubbleStatic2: normalizeHexColor(entry.bubbleStatic2, defaults.bubbleStatic2),
        colorizeTarget: TARGET_VALUES.has(Number(entry.colorizeTarget)) ? Number(entry.colorizeTarget) : defaults.colorizeTarget,
        bubbleOpacity: clampNumber(entry.bubbleOpacity, defaults.bubbleOpacity, 0, 1),
        bubbleGradientStops: normalizeGradientStops(entry.bubbleGradientStops, defaults.dialogStatic),
        bubbleGradientAngle: clampNumber(entry.bubbleGradientAngle, defaults.bubbleGradientAngle, 0, 360),
    };
}

export function resolveCustomColorizerSettings(settingsStore, type, key) {
    const storeType = getType(type);
    const keys = STORE_KEYS[storeType];
    const enabledList = settingsStore.get(keys.enabled) ?? [];
    const settingsMap = settingsStore.get(keys.settings) ?? {};
    const enabled = enabledList.includes(key);
    const raw = settingsMap[key];
    const value = buildColorizerCustomEntry(storeType, raw || {});
    return { enabled, value, raw: raw || null, key };
}

export async function updateCustomColorizerSettings(settingsStore, type, key, options = {}) {
    if (!key) return false;

    const storeType = getType(type);
    const keys = STORE_KEYS[storeType];
    const enabledList = [...(settingsStore.get(keys.enabled) ?? [])];
    const settingsMap = { ...(settingsStore.get(keys.settings) ?? {}) };
    const currentlyEnabled = enabledList.includes(key);

    if (options.enabled === false) {
        if (currentlyEnabled) enabledList.splice(enabledList.indexOf(key), 1);
        delete settingsMap[key];
        await settingsStore.update({ [keys.enabled]: enabledList, [keys.settings]: settingsMap });
        return true;
    }

    const oldEntry = buildColorizerCustomEntry(storeType, settingsMap[key] || {});
    const nextEntry = buildColorizerCustomEntry(storeType, { ...oldEntry, ...(options.patch || {}) });

    if (options.enabled === true && !currentlyEnabled) enabledList.push(key);
    settingsMap[key] = nextEntry;

    await settingsStore.update({ [keys.enabled]: enabledList, [keys.settings]: settingsMap });
    return true;
}

export function migrateColorizerSettings(loadedSettings, currentVersion) {
    const loadedVersion = Number(loadedSettings.dialogueColorizerSettingsVersion || 0);
    if (loadedVersion >= currentVersion) return false;

    const hasCustomColorizerSettings =
        (Array.isArray(loadedSettings.charCustomColorizerEnabled) && loadedSettings.charCustomColorizerEnabled.length > 0) ||
        (loadedSettings.charCustomColorizerSettings && Object.keys(loadedSettings.charCustomColorizerSettings).length > 0) ||
        (Array.isArray(loadedSettings.personaCustomColorizerEnabled) && loadedSettings.personaCustomColorizerEnabled.length > 0) ||
        (loadedSettings.personaCustomColorizerSettings && Object.keys(loadedSettings.personaCustomColorizerSettings).length > 0);

    if (hasCustomColorizerSettings) {
        console.log('[PTMT] Resetting legacy Dialogue Colorizer per-character/persona settings for v2 key format.');
        loadedSettings.charCustomColorizerEnabled = [];
        loadedSettings.charCustomColorizerSettings = {};
        loadedSettings.personaCustomColorizerEnabled = [];
        loadedSettings.personaCustomColorizerSettings = {};
    }

    loadedSettings.dialogueColorizerSettingsVersion = currentVersion;
    return true;
}
