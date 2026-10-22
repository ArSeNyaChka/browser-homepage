/**
 * Поисковая строка: подсказки сайтов + строки поиска DuckDuckGo.
 */
(() => {
    'use strict';

    const input = document.getElementById('search-line-input');
    const suggestionsList = document.getElementById('suggestions-list');
    const clearBtn = document.getElementById('clear-btn');
    const engineBtns = document.querySelectorAll('.engine-btn');

    const ENGINE_BY_ATTRIBUTE = {
        google: 'https://www.google.com/search?q=',
        duckduckgo: 'https://duckduckgo.com/?q=',
        youtube: 'https://www.youtube.com/results?search_query=',
    };

    const DDG_TTL_MS = 3000;
    const MAX_SUGGESTIONS = 8;

    let siteList = {};
    let suggestions = [];
    let selectedIndex = -1;
    let selectedEngine = null;
    let requestId = 0;
    const ddgCache = new Map();

    const escapeHtml = (str) => str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

    /** Подсказки из sites.json по началу алиаса (в т.ч. русские раскладки). */
    const getSiteSuggestions = (query) => {
        const prefix = query.toLowerCase();
        return Object.entries(siteList)
            .filter(([alias]) => alias.startsWith(prefix))
            .slice(0, MAX_SUGGESTIONS)
            .map(([alias, site]) => ({ type: 'site', text: alias, name: site.name }));
    };

    /** Строки поиска DuckDuckGo; результат кэшируется, чтобы не долбить API на каждый символ. */
    const getDdgSuggestions = async (query) => {
        const cached = ddgCache.get(query);
        if (cached && Date.now() - cached.time < DDG_TTL_MS) {
            return cached.items;
        }

        let items = [];
        try {
            const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            items = data.map(({ phrase }) => ({ type: 'search', text: phrase, name: '' }));
        } catch {
            // Офлайн или заблокирован запрос — оставляем только сайты
        }

        ddgCache.set(query, { time: Date.now(), items });
        return items;
    };

    const render = () => {
        if (suggestions.length === 0) {
            suggestionsList.hidden = true;
            return;
        }

        suggestionsList.innerHTML = suggestions
            .map(({ text, name }, index) => {
                const label = name ? `<span class="suggestion-item__name">${escapeHtml(name)}</span>` : '';
                const selected = index === selectedIndex ? 'true' : 'false';
                return `<li class="suggestion-item" role="option" data-index="${index}" aria-selected="${selected}">${escapeHtml(text)}${label}</li>`;
            })
            .join('');

        suggestionsList.hidden = false;
    };

    const updateClearBtn = () => {
        clearBtn.hidden = input.value.length === 0;
    };

    const hideSuggestions = () => {
        suggestions = [];
        selectedIndex = -1;
        suggestionsList.hidden = true;
    };

    /**
     * Обновляет подсказки для текущего значения строки.
     * Ответы приходят асинхронно, поэтому каждый запрос получает номер —
     * отрисовываем только последний, иначе быстрые наборы текста дают «мигающий» список.
     */
    const refreshSuggestions = async () => {
        const query = input.value.trim();
        const currentRequest = ++requestId;

        if (!query) {
            hideSuggestions();
            return;
        }

        const siteSuggestions = getSiteSuggestions(query);
        const ddgSuggestions = await getDdgSuggestions(query);
        if (currentRequest !== requestId) { return; }

        suggestions = [...siteSuggestions, ...ddgSuggestions].slice(0, MAX_SUGGESTIONS);
        selectedIndex = -1;
        render();
    };

    const openSite = (alias) => {
        window.location.href = `https://${siteList[alias].url}`;
    };

    const search = (query) => {
        const template = selectedEngine ? ENGINE_BY_ATTRIBUTE[selectedEngine] : ENGINE_BY_ATTRIBUTE.google;
        window.location.href = template + encodeURIComponent(query);
    };

    /**
     * Общий обработчик Enter и клика.
     * Точно введённый алиас (например «вк» или «vk») открывает сайт сразу —
     * иначе привычный «набрал vk, нажал Enter» превратился бы в поиск по слову vk.
     */
    const activate = (suggestion) => {
        const typed = input.value.trim().toLowerCase();
        if (!suggestion) {
            siteList[typed] ? openSite(typed) : search(input.value);
            return;
        }
        suggestion.type === 'site' ? openSite(suggestion.text) : search(suggestion.text);
    };

    const moveSelection = (step) => {
        if (suggestions.length === 0) { return; }

        // selectedSuggestion = -1 означает «ничего не выбрано», шаг от него даёт первый/последний элемент
        const count = suggestions.length;
        selectedIndex = selectedIndex < 0
            ? (step > 0 ? 0 : count - 1)
            : (selectedIndex + step + count) % count;

        render();
        suggestionsList.children[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('input', () => {
        updateClearBtn();
        refreshSuggestions();
    });

    input.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                activate(suggestions[selectedIndex] ?? null);
                break;
            case 'ArrowDown':
                event.preventDefault();
                moveSelection(1);
                break;
            case 'Tab':
                // Tab перебирает подсказки, а не уплывает по элементам страницы;
                // без подсказок перехват не нужен — иначе ловушка клавиатуры
                if (suggestions.length === 0) { break; }
                event.preventDefault();
                moveSelection(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                moveSelection(-1);
                break;
            case 'ArrowRight':
                // Принимаем подсказку как автодополнение, не выходя из строки
                if (selectedIndex >= 0) {
                    event.preventDefault();
                    input.value = suggestions[selectedIndex].text;
                    hideSuggestions();
                }
                break;
            case 'Escape':
                hideSuggestions();
                break;
        }
    });

    // Мышью подсказки выбираются кликом; mousedown, а не click, чтобы input не терял фокус
    suggestionsList.addEventListener('mousedown', (event) => {
        const item = event.target.closest('.suggestion-item');
        if (!item) { return; }

        event.preventDefault();
        activate(suggestions[Number(item.dataset.index)]);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        updateClearBtn();
        hideSuggestions();
        input.focus();
    });

    // Выбор поисковой системы повторным кликом снимается — строка снова ищет «как обычно»
    engineBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const engine = btn.dataset.engine;
            const isTogglingOff = selectedEngine === engine;

            engineBtns.forEach((other) => {
                other.setAttribute('aria-checked', 'false');
            });

            if (isTogglingOff) {
                selectedEngine = null;
                return;
            }

            selectedEngine = engine;
            btn.setAttribute('aria-checked', 'true');
        });
    });

    const init = async () => {
        try {
            const response = await fetch('sites.json');
            siteList = await response.json();
        } catch {
            console.warn('Не удалось загрузить sites.json — подсказки сайтов недоступны');
        }

        input.focus();
    };

    init();
})();
