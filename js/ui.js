/**
 * Мелочи интерфейса: фокус строки по клику и выбор цветовой темы.
 */
(() => {
    'use strict';

    const THEME_KEY = 'homepage.theme';
    const terminalTheme = document.getElementById('terminal-theme');

    const applyTheme = (theme) => {
        if (terminalTheme) {
            terminalTheme.disabled = theme !== 'terminal';
        }
        document.documentElement.dataset.theme = theme;
    };

    let savedTheme = 'standard';
    try {
        savedTheme = localStorage.getItem(THEME_KEY) || 'standard';
    } catch {
        // localStorage недоступен (например, в приватном режиме) — остаётся базовая тема
    }
    applyTheme(savedTheme);

    /** Тема сохраняется, но переключается вне этого файла: localStorage.setItem(...) + applyTheme. */
    window.homepageTheme = {
        current: () => document.documentElement.dataset.theme,
        set: (theme) => {
            applyTheme(theme);
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch {
                // не критично: тема применена, но не запомнится
            }
        },
    };

    // Переключатель темы живёт в диалоге настроек. Сравнение идёт по признаку
    // «терминал или нет», а не по точному совпадению: в localStorage уже лежат
    // значения со старым написанием 'standart', их нельзя терять.
    const themeRadios = document.querySelectorAll('input[name="theme"]');

    const syncThemeRadios = () => {
        const isTerminal = window.homepageTheme.current() === 'terminal';
        themeRadios.forEach((radio) => {
            radio.checked = (radio.value === 'terminal') === isTerminal;
        });
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
