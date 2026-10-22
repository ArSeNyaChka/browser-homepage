import fs from 'node:fs';
import vm from 'node:vm';

globalThis.window = globalThis;

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};

let calls = 0;
globalThis.fetch = async (url) => {
    calls += 1;
    if (url !== 'sites.json') { throw new Error('unexpected fetch ' + url); }
    return { json: async () => JSON.parse(fs.readFileSync(new URL('../sites.json', import.meta.url), 'utf8')) };
};

const loadSites = () => vm.runInThisContext(fs.readFileSync(new URL('../js/sites.js', import.meta.url), 'utf8'), { filename: 'sites.js' });

loadSites();
await globalThis.sites.ready;

const check = (label, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
    if (!ok) { process.exitCode = 1; }
};

const all = () => globalThis.sites.all();

check('базовые алиасы загружены', all().vk?.url === 'vk.ru' && all().gh?.url === 'github.com');
check('sites.json читается один раз', calls === 1, `fetch calls: ${calls}`);

let r = await globalThis.sites.addSite({ name: 'Notion', url: 'https://notion.so/app/', aliases: 'n, нот, notion' });
check('addSite добавляет группу', r.added === 3, JSON.stringify(r));
check('URL нормализован', all().n?.url === 'notion.so/app', all().n?.url);
check('русский алиас принят', all()['нот']?.name === 'Notion');

r = await globalThis.sites.addSite({ name: 'Duplicate', url: 'vk.ru', aliases: 'вк' });
check('алиас на существующий сайт переопределяет имя',
    r.added === 1 && all()['вк']?.url === 'vk.ru' && all()['вк']?.name === 'Duplicate', JSON.stringify(r));

r = await globalThis.sites.addSite({ name: 'Duplicate', url: 'vk.ru', aliases: 'вк' });
check('идентичная запись пропускается', r.added === 0 && r.skipped === 1, JSON.stringify(r));

r = await globalThis.sites.addSite({ name: 'Bad', url: 'not a url', aliases: 'x' });
check('битый адрес отклоняется', r.added === 0, JSON.stringify(r));

r = await globalThis.sites.addSite({ name: 'Bad', url: 'localhost', aliases: 'y' });
check('адрес без точки отклоняется', r.added === 0, JSON.stringify(r));

r = await globalThis.sites.addSite({ name: 'Bad', url: 'ok.ru', aliases: '<script>, "b@d", a/b, oops!' });
check('алиасы с запрещёнными символами отклоняются', r.added === 0, JSON.stringify(r));

r = await globalThis.sites.addSite({ name: 'GitHub Alt', url: 'github.com', aliases: 'гх' });
check('новый алиас к базовому сайту', r.added === 1 && all().гх?.url === 'github.com');

await globalThis.sites.removeAlias('gh');
check('удаление базового алиаса скрывает его', all().gh === undefined, 'gh скрыт');
check('другие алиасы того же сайта живы', all().github?.url === 'github.com');
check('скрытие базового алиаса записано в хранилище',
    JSON.parse(store.get('homepage.aliases')).hidden.includes('gh'));

const removed = await globalThis.sites.removeSite('notion.so/app');
check('removeSite убирает все алиасы сайта', removed === 3 && all().n === undefined && all()['нот'] === undefined, `removed=${removed}`);

const removedBase = await globalThis.sites.removeSite('vk.ru');
check('removeSite базового сайта скрывает все его алиасы',
    removedBase === 3 && all().vk === undefined && all()['вк'] === undefined && all()['мл'] === undefined,
    `removed=${removedBase}`);
await globalThis.sites.reset();
check('reset возвращает скрытый базовый сайт', all()['вк']?.url === 'vk.ru');

const importData = {
    'тест': { name: 'Тест', url: 'test.example.com' },
    'gh': { name: 'GitHub Override', url: 'github.com' },
    'bad key': { name: 'Bad', url: 'nope' },
    'ok2': { name: 'Ok', url: 'https://ok.example.com/x/' },
};
r = await globalThis.sites.importAliases(importData);
check('импорт считает принятые и пропущенные', r.added === 3 && r.skipped === 1, JSON.stringify(r));
check('импорт переопределяет базовый алиас', all().gh?.name === 'GitHub Override');
check('импорт нормализует url', all().ok2?.url === 'ok.example.com/x');

r = await globalThis.sites.addSite({ name: 'GitHub Переименован', url: 'github.com', aliases: 'gh' });
check('переименование существующего сайта применяется',
    r.added === 1 && all().gh?.name === 'GitHub Переименован', JSON.stringify(r));
r = await globalThis.sites.addSite({ name: 'GitHub Переименован', url: 'github.com', aliases: 'gh' });
check('повтор identical-записи пропускается', r.added === 0 && r.skipped === 1, JSON.stringify(r));

let threw = false;
try { await globalThis.sites.importAliases([1, 2, 3]); } catch { threw = true; }
check('импорт массива отклоняется', threw);

const snapshot = JSON.parse(store.get('homepage.aliases'));
check('импорт возвращает переопределённый алиас из скрытых', !snapshot.hidden.includes('gh'));

await globalThis.sites.reset();
check('reset возвращает к sites.json', all().gh?.url === 'github.com' && all().тест === undefined);

// Персистентность: перезапуск модуля должен прочитать то же хранилище
await globalThis.sites.addSite({ name: 'Persist', url: 'persist.example.com', aliases: 'pp' });
delete globalThis.sites;
loadSites();
await globalThis.sites.ready;
check('правки переживают перезагрузку', globalThis.sites.all().pp?.url === 'persist.example.com');

// onChange
let notified = 0;
const off = globalThis.sites.onChange(() => { notified += 1; });
await globalThis.sites.addSite({ name: 'Watch', url: 'watch.example.com', aliases: 'ww' });
check('onChange срабатывает', notified === 1, `notified=${notified}`);
off();
await globalThis.sites.addSite({ name: 'Watch2', url: 'watch2.example.com', aliases: 'w2' });
check('отписка работает', notified === 1, `notified=${notified}`);

vm.runInThisContext(fs.readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8'), { filename: 'utils.js' });
const esc = globalThis.escapeHtml;
check('escapeHtml нейтрализует разметку',
    esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;',
    esc('<img src=x onerror=alert(1)>'));
