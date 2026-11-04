// Общее для экранов-игр: боты, персона и действия приходят из bridge.js.
// Подключать после bridge.js.
const NOW = Date.now();
const ITEMS = CHARS.map((c) => {
    const name = c.name.replace(/\s+/g, ' ').trim();
    return { name, img: c.img, ts: c.last, msgs: c.msgs || 0, chats: c.chats || 1, snip: c.snip || '', render: c.render || '' };
});

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mod = (a, n) => ((a % n) + n) % n;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ago(ts) {
    const m = (NOW - ts) / 60e3;
    if (m < 60) return Math.round(m) + tt(' мин назад');
    if (m < 1440) return Math.round(m / 60) + tt(' ч назад');
    const d = Math.round(m / 1440);
    return d === 1 ? tt('вчера') : d + tt(' дн назад');
}
// одна и та же «случайность» для персонажа — для выдуманных характеристик в стиле игры
function seeded(name, k) {
    let h = 2166136261 ^ k;
    for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return ((h >>> 0) % 1000) / 1000;
}

const toast = (() => {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;top:18px;transform:translate(-50%,-30px);z-index:999;background:#fff;color:#111;padding:11px 20px;border-radius:99px;font:600 14px system-ui,sans-serif;box-shadow:0 10px 30px #0008;opacity:0;pointer-events:none;transition:.25s';
    document.addEventListener('DOMContentLoaded', () => document.body.append(t));
    let h;
    return (s) => { t.textContent = s; t.style.opacity = 1; t.style.transform = 'translate(-50%,0)'; clearTimeout(h); h = setTimeout(() => { t.style.opacity = 0; t.style.transform = 'translate(-50%,-30px)'; }, 1700); };
})();
// действие уходит в таверну: открыть чат, новый чат, список чатов или выбрать свою PNG
const ACT = (what, c) => SH.act(what, ITEMS.indexOf(c));

// фигура: своя PNG — целиком; без неё — портрет в аккуратной рамке (класс рамки задаёт каждый экран)
const figHTML = (c, frameCls) => c.render ? `<img class="full" src="${c.render}" alt="">` : `<div class="${frameCls}"><img src="${c.img}" alt=""></div>`;
