/**
 * Алиасы сайтов: базовый sites.json поверх которого накладываются
 * пользовательские правки из панели.
 *
 * sites.json остаётся нетронутым — добавленные алиасы и скрытые базовые
 * живут отдельным слоем, поэтому «Сбросить» всегда возвращает к файлу.
 */
(() => {
    'use strict';

    const STORAGE_KEY = 'homepage.aliases';

    // chrome.storage.local есть только на страницах расширения; при открытии
    // через file:// или локальный сервер его нет — откатываемся на localStorage
    const backend = globalThis.chrome?.storage?.local ?? globalThis.browser?.storage?.local ?? null;

    const ALIAS_PATTERN = /^[\p{L}\p{N}._-]{1,32}$/u;

    const defaults = {};
    let edits = { custom: {}, hidden: [] };
    let merged = {};
    const listeners = new Set();

    const normalizeAlias = (value) => {
        const alias = String(value ?? '').trim().toLowerCase();
        return ALIAS_PATTERN.test(alias) ? alias : null;
    };

    /** Приводим адрес к виду «example.com/path» — как в sites.json. */
    const normalizeUrl = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) { return null; }

        try {
            const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
            if (!url.hostname.includes('.')) { return null; }
            const path = url.pathname.replace(/\/+$/, '');
            return url.hostname + path;
        } catch {
            return null;
        }
    };

    const normalizeSite = (value) => {
        const url = normalizeUrl(value?.url);
        if (!url) { return null; }

        const name = String(value?.name ?? '').trim().slice(0, 60);
        return { name: name || url, url };
    };

    /** Полностью идентичную запись не перезаписываем — иначе импорт не смог бы переименовать сайт. */
    const isSameEntry = (existing, site) => existing?.url === site.url && existing?.name === site.name;

    const readEdits = async () => {
        let stored = null;
        try {
            if (backend) {
                stored = (await backend.get(STORAGE_KEY))[STORAGE_KEY];
            } else {
                stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
            }
        } catch {
            stored = null;
        }

        const custom = {};
        for (const [rawAlias, site] of Object.entries(stored?.custom ?? {})) {
            const alias = normalizeAlias(rawAlias);
            const normalized = normalizeSite(site);
            if (alias && normalized) { custom[alias] = normalized; }
        }

        return { custom, hidden: [...new Set(stored?.hidden ?? [])] };
    };

    const persist = async () => {
        try {
            if (backend) {
                await backend.set({ [STORAGE_KEY]: edits });
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
            }
        } catch (error) {
            console.error('Не удалось сохранить алиасы:', error);
        }

        merged = Object.fromEntries(
            Object.entries(defaults).filter(([alias]) => !edits.hidden.includes(alias))
        );
        Object.assign(merged, edits.custom);
        listeners.forEach((callback) => callback(merged));
    };

    const ready = (async () => {
        try {
            const response = await fetch('sites.json');
            Object.assign(defaults, await response.json());
        } catch {
            console.warn('Не удалось загрузить sites.json — доступны только пользовательские алиасы');
        }

        edits = await readEdits();
        await persist();
    })();

    /** Добавляет группу «сайт + алиасы», возвращает сколько алиасов принято. */
    const addSite = async ({ name, url, aliases }) => {
        const site = normalizeSite({ name, url });
        if (!site) { return { added: 0, skipped: 0 }; }

        const wanted = [...new Set(String(aliases ?? '').split(/[\s,;]+/).map(normalizeAlias).filter(Boolean))];
        if (wanted.length === 0) { return { added: 0, skipped: 0 }; }

        let added = 0;
        for (const alias of wanted) {
            if (isSameEntry(merged[alias], site)) { continue; }

            edits.custom[alias] = site;
            edits.hidden = edits.hidden.filter((hidden) => hidden !== alias);
            added += 1;
        }

        if (added > 0) { await persist(); }
        return { added, skipped: wanted.length - added };
    };

    const removeAlias = async (alias) => {
        if (!merged[alias]) { return false; }

        delete edits.custom[alias];
        if (defaults[alias] && !edits.hidden.includes(alias)) { edits.hidden.push(alias); }
        await persist();
        return true;
    };

    /** Убирает сразу все алиасы сайта — и пользовательские, и базовые. */
    const removeSite = async (url) => {
        const aliases = Object.keys(merged).filter((alias) => merged[alias].url === url);
        if (aliases.length === 0) { return 0; }

        for (const alias of aliases) {
            delete edits.custom[alias];
            if (defaults[alias] && !edits.hidden.includes(alias)) { edits.hidden.push(alias); }
        }

        await persist();
        return aliases.length;
    };

    const importAliases = async (data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Ожидался объект вида {"алиас": {"name": …, "url": …}}');
        }

        let added = 0;
        let skipped = 0;

        for (const [rawAlias, value] of Object.entries(data)) {
            const alias = normalizeAlias(rawAlias);
            const site = normalizeSite(value);
            if (!alias || !site) {
                skipped += 1;
                continue;
            }

            const existing = merged[alias];
            if (isSameEntry(existing, site)) { skipped += 1; continue; }

            edits.custom[alias] = site;
            edits.hidden = edits.hidden.filter((hidden) => hidden !== alias);
            added += 1;
        }

        if (added > 0) { await persist(); }
        return { added, skipped };
    };

    const reset = async () => {
        edits = { custom: {}, hidden: [] };
        await persist();
    };

    window.sites = {
        ready,
        all: () => merged,
        addSite,
        removeAlias,
        removeSite,
        importAliases,
        reset,
        onChange: (callback) => {
            listeners.add(callback);
            return () => listeners.delete(callback);
        },
    };
})();
