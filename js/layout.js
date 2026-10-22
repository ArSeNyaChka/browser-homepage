/**
 * Преобразование раскладки клавиатуры.
 *
 * Алиасы хранятся в одной раскладке, а набрать их можно в любой: «вк» и «vk»
 * — это одни и те же клавиши. Нормализуем и запрос, и алиасы к латинице,
 * поэтому сравнение всегда одностороннее, а работает в обе стороны.
 */
(() => {
    'use strict';

    // Знаки препинания в намеренно не переводим: «.» встречается в адресах и
    // алиасах (notion.so), а её перевод в «/» ломал бы сравнение. Разница
    // раскладок для них не мешает — символы совпадают как есть.
    const EN_TO_RU = {
        '`': 'ё',
        q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з',
        '[': 'х', ']': 'ъ',
        a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д',
        ';': 'ж', "'": 'э',
        z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь',
        ',': 'б', '.': 'ю',
    };

    const RU_TO_EN = Object.fromEntries(
        Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en])
    );

    /** Латиница и цифры уже «английские», переводить нечего. */
    const hasRussian = (value) => /[а-яё]/i.test(value);

    /** Приводит строку к виду, в котором она была набрана на английской раскладке. */
    const toEnLayout = (value) => {
        let result = '';
        for (const char of String(value)) {
            const lower = char.toLowerCase();
            const mapped = RU_TO_EN[lower];
            if (!mapped) {
                result += char;
                continue;
            }
            result += char === lower ? mapped : mapped.toUpperCase();
        }
        return result;
    };

    /** Обратное преобразование — им показываем русские алиасы, если запрос был кириллическим. */
    const toRuLayout = (value) => {
        let result = '';
        for (const char of String(value)) {
            const lower = char.toLowerCase();
            const mapped = EN_TO_RU[lower];
            if (!mapped) {
                result += char;
                continue;
            }
            result += char === lower ? mapped : mapped.toUpperCase();
        }
        return result;
    };

    window.layout = { toEnLayout, toRuLayout, hasRussian };
})();
