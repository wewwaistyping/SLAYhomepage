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

// Длинное имя не должно ломать экран: уменьшаем шрифт, пока имя не влезет в две строки
const NAME_FIT = { sf6: ['.nm'], gta: ['.nm'], cult: ['.nm'], otome: ['.nm', '.ph-name'], danganronpa: ['.nm'], genshin: ['.name'], ow: ['.big'], persona: ['.name'], hollow: ['.entry h2'], disco: ['.sheet h1'], pokemon: ['.nm h1'], valorant: ['.nm'], lis: ['.cap'] };
addEventListener('DOMContentLoaded', () => {
    const sels = NAME_FIT[location.pathname.split('/').pop().replace('.html', '')];
    if (!sels) return;
    const done = new Map();
    const wide = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width > el.clientWidth * 1.08; };
    const fit = () => {
        for (const s of sels) {
            const el = $(s);
            if (!el || !el.clientWidth) continue;
            const key = el.textContent + '|' + innerWidth + '|' + innerHeight;
            if (done.get(s) === key) continue;
            done.set(s, key);
            el.style.fontSize = '';
            const cs = getComputedStyle(el);
            let size = parseFloat(cs.fontSize);
            const lh = parseFloat(cs.lineHeight) / size || 1.15;
            for (let n = 0; n < 60 && size > 13 && (el.offsetHeight > size * lh * 2 + 6 || wide(el)); n++) {
                size -= 1;
                el.style.fontSize = size + 'px';
            }
        }
    };
    new MutationObserver(fit).observe(document.body, { childList: true, subtree: true, characterData: true });
    addEventListener('resize', fit);
    document.fonts?.ready.then(() => { done.clear(); fit(); });
    document.fonts?.addEventListener?.('loadingdone', () => { done.clear(); fit(); });
    fit();
});
