/**
 * Мелочи интерфейса: фокус строки по клику и выбор цветовой темы.
 */
(() => {
    'use strict';

    const THEME_KEY = 'homepage.theme';
    const DEFAULT_THEME = 'standard';

    /**
     * Кроме стандартной темы, которая живёт в style.css и загружена всегда,
     * каждая тема — отдельный <link disabled>, включаемый по имени.
     * Старое значение 'standart' из прошлых версий считаем стандартной темой.
     */
    const THEME_LINKS = {
        terminal: document.getElementById('terminal-theme'),
        minimalism: document.getElementById('minimalism-theme'),
    };

    const normalizeTheme = (name) => (name in THEME_LINKS ? name : DEFAULT_THEME);

    const applyTheme = (theme) => {
        const name = normalizeTheme(theme);
        for (const [key, link] of Object.entries(THEME_LINKS)) {
            if (link) { link.disabled = key !== name; }
        }
        document.documentElement.dataset.theme = name;
    };

    let savedTheme = DEFAULT_THEME;
    try {
        savedTheme = normalizeTheme(localStorage.getItem(THEME_KEY));
    } catch {
        // localStorage недоступен (например, в приватном режиме) — остаётся базовая тема
    }
    applyTheme(savedTheme);

    window.homepageTheme = {
        current: () => document.documentElement.dataset.theme,
        set: (theme) => {
            applyTheme(theme);
            try {
                localStorage.setItem(THEME_KEY, window.homepageTheme.current());
            } catch {
                // не критично: тема применена, но не запомнится
            }
        },
    };

    // Переключатель темы живёт в диалоге настроек: отмечаем сохранённую тему
    // и реагируем на выбор новой.
    const themeRadios = document.querySelectorAll('input[name="theme"]');

    const syncThemeRadios = () => {
        const current = window.homepageTheme.current();
        themeRadios.forEach((radio) => { radio.checked = radio.value === current; });
    };

    themeRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
            if (radio.checked) { window.homepageTheme.set(radio.value); }
        });
    });

    syncThemeRadios();

    // Строка поиска — главный элемент страницы: клик в любом её месте возвращает фокус в ввод.
    // Клики внутри диалога и по интерактивным элементам игнорируем,
    // иначе фокус вырывался бы из полей панели алиасов
    document.body.addEventListener('click', (event) => {
        if (event.target.closest('a, button, li, input, label, dialog')) { return; }

        document.getElementById('search-line-input')?.focus();
    });
})();
