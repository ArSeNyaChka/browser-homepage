/**
 * Панель управления алиасами: добавление, удаление, импорт и экспорт.
 */
(() => {
    'use strict';

    const openBtn = document.getElementById('aliases-open-btn');
    const dialog = document.getElementById('aliases-dialog');
    const closeBtn = document.getElementById('aliases-close-btn');
    const form = document.getElementById('alias-form');
    const nameInput = document.getElementById('alias-name');
    const urlInput = document.getElementById('alias-url');
    const aliasesInput = document.getElementById('alias-values');
    const list = document.getElementById('aliases-list');
    const status = document.getElementById('aliases-status');
    const importInput = document.getElementById('aliases-import-file');

    const escapeHtml = window.escapeHtml;

    let statusTimer = null;
    const showStatus = (message) => {
        status.textContent = message;
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => { status.textContent = ''; }, 4000);
    };

    /** Один сайт может стоять за несколькими алиасами — группируем по адресу. */
    const groupBySite = (aliases) => {
        const groups = new Map();
        for (const [alias, site] of Object.entries(aliases)) {
            if (!groups.has(site.url)) { groups.set(site.url, { name: site.name, url: site.url, aliases: [] }); }
            groups.get(site.url).aliases.push(alias);
        }
        return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
    };

    const render = () => {
        const groups = groupBySite(window.sites.all());

        if (groups.length === 0) {
            list.innerHTML = '<li class="aliases-list__empty">Пока нет ни одного алиаса</li>';
            return;
        }

        list.innerHTML = groups.map(({ name, url, aliases }) => `
            <li class="alias-group" data-url="${escapeHtml(url)}">
                <div class="alias-group__head">
                    <span class="alias-group__name">${escapeHtml(name)}</span>
                    <span class="alias-group__url">${escapeHtml(url)}</span>
                    <button type="button" class="alias-group__remove" data-action="remove-site" title="Удалить сайт со всеми алиасами">✕</button>
                </div>
                <div class="alias-group__aliases">
                    ${aliases.map((alias) => `<span class="alias-chip">${escapeHtml(alias)}<button type="button" class="alias-chip__remove" data-action="remove-alias" data-alias="${escapeHtml(alias)}" title="Удалить алиас">✕</button></span>`).join('')}
                </div>
            </li>
        `).join('');
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const { added, skipped, conflicts } = await window.sites.addSite({
            name: nameInput.value,
            url: urlInput.value,
            aliases: aliasesInput.value,
        });

        // Алиас, совпадающий по клавишам раскладки с чужим, всё равно что опечатка:
        // его нельзя набрать, поэтому о таком надо сказать прямо
        const conflictNote = conflicts.length
            ? `. Занято: ${conflicts.map((c) => `${c.alias} → ${c.takenBy}`).join(', ')}`
            : '';

        if (added === 0) {
            showStatus((skipped ? 'Такие алиасы уже есть' : 'Проверьте адрес и алиасы') + conflictNote);
            return;
        }

        form.reset();
        showStatus(`Добавлено алиасов: ${added}${skipped ? `, пропущено: ${skipped}` : ''}${conflictNote}`);
    });

    list.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) { return; }

        if (button.dataset.action === 'remove-alias') {
            await window.sites.removeAlias(button.dataset.alias);
            return;
        }

        const url = button.closest('.alias-group').dataset.url;
        const removed = await window.sites.removeSite(url);
        showStatus(`Удалено алиасов: ${removed}`);
    });

    document.getElementById('aliases-export-btn').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(window.sites.all(), null, 4)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'aliases.json';
        link.click();
        URL.revokeObjectURL(link.href);
    });

    importInput.addEventListener('change', async () => {
        const file = importInput.files[0];
        if (!file) { return; }

        try {
            const { added, skipped } = await window.sites.importAliases(JSON.parse(await file.text()));
            showStatus(`Импортировано: ${added}, пропущено: ${skipped}`);
        } catch (error) {
            showStatus(`Ошибка импорта: ${error.message}`);
        } finally {
            importInput.value = '';
        }
    });

    document.getElementById('aliases-reset-btn').addEventListener('click', async () => {
        if (!confirm('Удалить все добавленные алиасы и вернуться к sites.json?')) { return; }

        await window.sites.reset();
        showStatus('Сброшено к sites.json');
    });

    openBtn.addEventListener('click', () => dialog.showModal());
    closeBtn.addEventListener('click', () => dialog.close());

    // <dialog> закрывается по Escape, но не по клику мимо — добавляем:
    // клик по backdrop приходит как событие на самом dialog с target === dialog
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) { dialog.close(); }
    });

    window.sites.ready.then(() => {
        render();
        window.sites.onChange(render);
    });
})();
