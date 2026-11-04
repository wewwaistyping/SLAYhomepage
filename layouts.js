// Раскладки стартового экрана. Каждая: html(items) — разметка, show(root, i, items) — выделить i-го.
// Общие правила (в index.js): [data-i] — элемент персонажа, [data-act] — действие, [data-nav] — листание.
// hover: true — выбор наведением (на телефоне всё равно тапом); false — выбор кликом.

import { LOCALE, tt } from './lang.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (root, sel) => root.querySelector(sel);
const mark = (root, sel, i) => root.querySelectorAll(sel).forEach(x => x.classList.toggle('on', +x.dataset.i === i));

export function ago(ts) {
    const m = (Date.now() - ts) / 60e3;
    if (!isFinite(m)) return '';
    if (m < 1) return tt('только что');
    if (m < 60) return Math.round(m) + tt(' мин назад');
    if (m < 1440) return Math.round(m / 60) + tt(' ч назад');
    const d = Math.round(m / 1440);
    if (d === 1) return tt('вчера');
    if (d < 30) return d + tt(' дн назад');
    return new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' });
}

const BTNS = `<button class="sh-go" data-act="continue">${tt("Продолжить")}</button><button data-act="new">${tt("Новый чат")}</button><button data-act="all">${tt("Все чаты")}</button>`;
const img = (c) => `<img src="${esc(c.img)}" alt="" decoding="async">`;

// Веер «Колоды» раскрывается настолько, насколько позволяет место справа: от 44° на узких экранах до 64° на широких
function deckFan(root) {
    const cards = root.querySelectorAll('.shd-card'), n = cards.length, r = $(root, '.shd-fan').getBoundingClientRect();
    const reach = innerWidth - (r.left + r.width / 2) - 12 - cards[0].offsetWidth * .85;
    const wide = 2 * Math.asin(Math.min(1, reach / (2.1 * cards[0].offsetHeight))) * 180 / Math.PI;
    return { step: Math.min(9, Math.min(64, Math.max(innerWidth <= 1000 ? 14 : 44, wide)) / Math.max(n - 1, 1)), mid: (n - 1) / 2 };
}

// Длинное имя в классических темах: уменьшаем шрифт, пока имя не влезет в две строки
// Какая карта веера лежит в этой точке. Считаем по геометрии, а не по элементу под пальцем. При тапе первой
// проверяем выбранную: она приподнята и лежит сверху. Для мыши она не в счёт, иначе выбор скакал бы туда-обратно.
function deckHit(root, e, tap) {
    const cards = root.querySelectorAll('.shd-card'), r = $(root, '.shd-fan').getBoundingClientRect();
    const W = cards[0].offsetWidth, H = cards[0].offsetHeight, { step, mid } = deckFan(root);
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.bottom + 1.6 * H); // от оси веера (transform-origin)
    const inside = (i, lift) => {
        const o = i - mid, a = -o * step * Math.PI / 180;
        const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a) - Math.abs(o) * 3 + lift;
        return Math.abs(x) <= W / 2 && y >= -2.6 * H && y <= -1.6 * H;
    };
    if (tap) {
        const on = [...cards].findIndex((c) => c.classList.contains('on'));
        if (on >= 0 && inside(on, 70)) return on;
    }
    for (let i = cards.length - 1; i >= 0; i--) if (inside(i, 0)) return i;
    return null;
}

// Шире ли сам текст своего блока. scrollWidth тут врёт: он считает ещё и копии имени для глитча
function textWide(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().width > el.clientWidth * 1.08;
}

export function fitLong(root) {
    const el = root.querySelector('.shd-name, .shf-name, .shv-name, .shn-name, .shc-name, .shr-name, .shz-talk h1');
    if (!el || !el.clientWidth) return;
    el.style.fontSize = '';
    const cs = getComputedStyle(el);
    let size = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight) / size || 1.15;
    for (let n = 0; n < 60 && size > 13 && (el.offsetHeight > size * lh * 2 + 6 || textWide(el)); n++) {
        size -= 1;
        el.style.fontSize = size + 'px';
    }
}

export const LAYOUTS = {
    kino: {
        title: tt('Кино'),
        hover: true,
        html: (items) => `
            <div class="sh-amb"></div>
            <div class="sh-hero">
                <div class="sh-por"><img alt=""></div>
                <div class="sh-meta">
                    <div class="sh-k"></div>
                    <h1 class="sh-name"></h1>
                    <q class="sh-q"></q>
                    <div class="sh-btns">${BTNS}</div>
                    <div class="sh-stats"></div>
                </div>
            </div>
            <div class="sh-row"><h3>${tt("Недавние")}</h3><div class="sh-strip">${items.map((c, i) => `
                <div class="sh-c" data-i="${i}">${img(c)}<span>${esc(c.name)}</span><i>${ago(c.ts)}</i></div>`).join('')}
            </div></div>`,
        show(root, i, items) {
            const c = items[i];
            $(root, '.sh-amb').style.backgroundImage = c.img ? `url("${c.img}")` : '';
            $(root, '.sh-por img').src = c.img;
            $(root, '.sh-k').textContent = (i ? tt('недавний разговор · ') : tt('последний разговор · ')) + ago(c.ts);
            $(root, '.sh-name').textContent = c.name;
            const q = $(root, '.sh-q');
            q.textContent = c.snip;
            q.hidden = !c.snip;
            $(root, '.sh-stats').innerHTML = `<span><b>${c.msgs}</b> ${tt("сообщений в чате")}</span>${c.group ? tt('<span>группа</span>') : ''}`;
            mark(root, '.sh-c', i);
        },
    },

    // Кадр на весь экран, последняя реплика — как субтитр
    subs: {
        title: tt('Субтитры'),
        hover: true,
        html: (items) => `
            <div class="shs-fill"></div>
            <img class="shs-bg" alt="">
            <div class="shs-shade"></div>
            <div class="shs-top"><span class="shs-tm"></span><div class="shs-rec">${items.map((c, i) => `<img data-i="${i}" src="${esc(c.img)}" alt="" title="${esc(c.name)}" decoding="async">`).join('')}</div></div>
            <div class="shs-sub"><div class="shs-who"></div><div class="shs-line"></div></div>
            <div class="shs-acts">${BTNS}</div>`,
        show(root, i, items) {
            const c = items[i];
            $(root, '.shs-bg').src = c.img;
            $(root, '.shs-fill').style.backgroundImage = c.img ? `url("${c.img}")` : '';
            $(root, '.shs-tm').textContent = tt`${c.msgs} сообщ. · ${ago(c.ts)}`;
            $(root, '.shs-who').textContent = c.name;
            $(root, '.shs-line').textContent = c.snip ? '— ' + c.snip : '';
            mark(root, '.shs-rec img', i);
        },
    },

    // Недавние веером, выбранная карта поднята
    deck: {
        title: tt('Колода'),
        hover: true,
        // на телефоне — та же полоса по горизонтали, но по координатам, а не по карте под пальцем
        tap(root, e, items) {
            return deckHit(root, e, true);
        },
        // Выбирается карта, которая лежит под курсором в раскрытом веере. Считаем по их местам в покое, а не по
        // элементу под мышью: выбранная карта выезжает и перекрывает соседей, и выбор скакал бы туда-обратно.
        // Мимо карт (пустое место, поднятый край выбранной) — null, выбор не меняется.
        pointer: (root, e) => deckHit(root, e, false),
        html: (items) => `
            <div class="shd-txt"><div class="shd-when"></div><h1 class="shd-name"></h1><p class="shd-q"></p><div class="shd-btns">${BTNS}</div></div>
            <div class="shd-fan">${items.map((c, i) => `<div class="shd-card" data-i="${i}">${img(c)}</div>`).join('')}</div>`,
        show(root, a, items) {
            const c = items[a];
            $(root, '.shd-when').textContent = (a ? tt('недавний') : tt('последний')) + tt(' разговор · ') + ago(c.ts);
            $(root, '.shd-name').textContent = c.name;
            $(root, '.shd-q').textContent = c.snip;
            $(root, '.shd-txt').animate?.([{ opacity: .4 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
            const cards = root.querySelectorAll('.shd-card'), { step, mid } = deckFan(root);
            cards.forEach((k, i) => {
                const o = i - mid, on = i === a;
                k.classList.toggle('on', on);
                k.style.zIndex = on ? 50 : i;
                // выбранная остаётся на своём месте в дуге и только выезжает вверх вдоль своей оси
                k.style.transform = `rotate(${o * step}deg) translateY(${Math.abs(o) * 3 - (on ? 70 : 0)}px)`;
            });
        },
    },

    // Как мессенджер: контакты, «пузырь» с последней репликой, поле ответа = продолжить
    msgr: {
        title: tt('Переписка'),
        hover: false,
        html: (items) => `
            <aside class="shm-list"><h6>${tt("Недавние")}</h6>${items.map((c, i) => `
                <div class="shm-ct" data-i="${i}">${img(c)}<div><b>${esc(c.name)}<i>${ago(c.ts).replace(tt(' назад'), '')}</i></b><span>${esc(c.snip)}</span></div></div>`).join('')}
            </aside>
            <main class="shm-main">
                <header><img class="shm-av" alt=""><div><b class="shm-name"></b><small class="shm-sub"></small></div>
                    <div class="shm-sm"><button data-act="new">${tt("Новый чат")}</button><button data-act="all">${tt("Все чаты")}</button></div></header>
                <div class="shm-feed"><div class="shm-day">${tt("последнее сообщение")}</div>
                    <div class="shm-msg"><img class="shm-pic" alt=""><div class="shm-bub"><span></span><time></time></div></div></div>
                <div class="shm-input"><div class="shm-field" data-act="continue"></div><button data-act="continue" title="${tt("Продолжить")}">➤</button></div>
            </main>`,
        show(root, i, items) {
            const c = items[i];
            $(root, '.shm-av').src = c.img;
            $(root, '.shm-pic').src = c.img;
            $(root, '.shm-name').textContent = c.name;
            $(root, '.shm-sub').textContent = tt`${c.msgs} сообщений в чате`;
            $(root, '.shm-bub span').textContent = c.snip || '…';
            $(root, '.shm-bub time').textContent = ago(c.ts);
            $(root, '.shm-field').textContent = tt`Ответить ${c.name.split(' ')[0]}…`;
            mark(root, '.shm-ct', i);
        },
    },

    // Объёмная лента с отражением, листается стрелками
    flow: {
        title: tt('Карусель'),
        hover: false,
        // тап по центральной карте — она, левее/правее — соседняя (без попадания в повёрнутые карты)
        tap(root, e, items) {
            const st = $(root, '.shf-stage').getBoundingClientRect(), on = $(root, '.shf-card.on')?.getBoundingClientRect();
            if (!on || e.clientY < st.top || e.clientY > st.bottom) return null;
            const cur = +$(root, '.shf-card.on').dataset.i;
            if (e.clientX < on.left) return Math.max(0, cur - 1);
            if (e.clientX > on.right) return Math.min(items.length - 1, cur + 1);
            return cur;
        },
        html: (items) => `
            <div class="shf-stage">${items.map((c, i) => `<div class="shf-card" data-i="${i}">${img(c)}</div>`).join('')}</div>
            <button class="shf-arr shf-l" data-nav="-1">‹</button><button class="shf-arr shf-r" data-nav="1">›</button>
            <div class="shf-meta"><div class="shf-when"></div><h1 class="shf-name"></h1><p class="shf-q"></p><div class="shf-btns">${BTNS}</div></div>`,
        show(root, cur, items) {
            const c = items[cur];
            $(root, '.shf-when').textContent = ago(c.ts);
            $(root, '.shf-name').textContent = c.name;
            $(root, '.shf-q').textContent = c.snip;
            root.querySelectorAll('.shf-card').forEach((k, i) => {
                const o = i - cur, ao = Math.abs(o), w = k.offsetWidth;
                k.style.transform = `translateX(${-w / 2 + o * w * 0.62 + Math.sign(o) * w * 0.25}px) translateZ(${-ao * 140}px) rotateY(${-Math.sign(o) * 38}deg)`;
                k.style.zIndex = 100 - ao;
                k.style.opacity = ao > 3 ? 0 : 1;
                k.style.pointerEvents = ao > 3 ? 'none' : '';
                k.classList.toggle('on', !o);
            });
        },
    },
};

/* ─────────── Игровые меню: Новелла, Минимал, Ретро-пиксель, Киберпанк ───────────
   Хуки движка: mount(root, api) после отрисовки, unmount(root) при смене/скрытии,
   key(k, root, api) → true, если раскладка сама обработала клавишу.
   api: show(i), act(what), current, items. Пункты меню — [data-act], выбранный пункт хранится в root._m. */

const mod = (a, n) => ((a % n) + n) % n;

// Меню: подсветка наведением/стрелками, выбор Enter. Пункты не меняют размеров — ничего не прыгает под курсором.
function menu(root, sel) {
    const btns = [...root.querySelectorAll(sel)];
    root._m = 0;
    const paint = () => btns.forEach((b, i) => b.classList.toggle('on', i === root._m));
    btns.forEach((b, i) => b.addEventListener('mouseenter', () => { root._m = i; paint(); }));
    paint();
    return {
        move: (d) => { root._m = mod(root._m + d, btns.length); paint(); },
        pick: (api) => { const b = btns[root._m]; b.dataset.act ? api.act(b.dataset.act) : b.click(); },
    };
}

// Печать реплики по буквам
function typeInto(root, el, text, step = 2, ms = 26) {
    clearInterval(root._tm);
    let n = 0; el.textContent = '';
    root._tm = setInterval(() => { n += step; el.textContent = text.slice(0, n); if (n >= text.length) clearInterval(root._tm); }, ms);
}

// Пикселизация: картинку в маленький canvas, CSS растягивает без сглаживания
const pixImgs = {};
function pix(canvas, src, w, h, cropTop = 0, cropH = 1) {
    canvas.width = w; canvas.height = h;
    const draw = (im) => canvas.getContext('2d').drawImage(im, 0, im.naturalHeight * cropTop, im.naturalWidth, im.naturalHeight * cropH, 0, 0, w, h);
    const im = pixImgs[src] ??= Object.assign(new Image(), { src });
    if (im.complete && im.naturalWidth) draw(im); else im.addEventListener('load', () => draw(im), { once: true });
}

Object.assign(LAYOUTS, {
    // Титульный экран визуальной новеллы: меню строкой внизу, галерея персонажей
    novel: {
        title: tt('Новелла'),
        hover: false,
        html: (items) => `
            <div class="shv-fill"></div><img class="shv-art" alt="">
            <div class="shv-logo"><h1 class="shv-name"></h1><small class="shv-sub"></small></div>
            <div class="shv-bar"><div class="shv-keys"><span><kbd>←→</kbd>${tt("меню")}</span><span><kbd>↑↓</kbd>${tt("персонаж")}</span><span><kbd>Enter</kbd>${tt("ок")}</span></div>
                <div class="shv-menu"><button data-act="continue">${tt("Продолжить")}</button><button data-act="new">${tt("Начать заново")}</button><button data-act="all">${tt("Загрузить")}</button><button data-ui="gal">${tt("Галерея")}</button></div></div>
            <div class="shv-gal"><h2>${tt("Галерея")}</h2><div class="shv-grid">${items.map((c, i) => `<button class="shv-it" data-g="${i}"><img src="${esc(c.img)}" alt="" decoding="async"><span>${esc(c.name)}</span></button>`).join('')}</div></div>`,
        mount(root, api) {
            root._menu = menu(root, '.shv-menu button');
            const gal = root.querySelector('.shv-gal'), its = [...root.querySelectorAll('.shv-it')];
            root._g = 0;
            root._paintG = () => its.forEach((x, i) => x.classList.toggle('on', i === root._g));
            root._gal = (on) => { gal.classList.toggle('open', on); if (on) { root._g = api.current; root._paintG(); } };
            root.querySelector('[data-ui="gal"]').addEventListener('click', () => root._gal(true));
            its.forEach((x, i) => { x.addEventListener('mouseenter', () => { root._g = i; root._paintG(); }); x.addEventListener('click', () => { api.show(i); root._gal(false); }); });
            gal.addEventListener('click', (e) => { if (e.target === gal) root._gal(false); });
        },
        show(root, i, items) {
            const c = items[i];
            root.querySelector('.shv-fill').style.backgroundImage = c.img ? `url("${c.img}")` : '';
            root.querySelector('.shv-art').src = c.img;
            root.querySelector('.shv-name').textContent = c.name;
            root.querySelector('.shv-sub').textContent = tt`история · ${c.msgs} сообщений · ${ago(c.ts)}`;
        },
        key(k, root, api) {
            if (root.querySelector('.shv-gal.open')) {
                if (k === 'Escape') root._gal(false);
                else if (k === 'Enter') { api.show(root._g); root._gal(false); }
                else { const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 }[k]; if (!d) return false; root._g = mod(root._g + d, api.items.length); root._paintG(); }
                return true;
            }
            if (k === 'ArrowRight' || k === 'ArrowLeft') { root._menu.move(k === 'ArrowRight' ? 1 : -1); return true; }
            if (k === 'ArrowDown' || k === 'ArrowUp') { api.show(api.current + (k === 'ArrowDown' ? 1 : -1)); return true; }
            if (k === 'Enter') { root._menu.pick(api); return true; }
            return false;
        },
    },

    // Тихое тёмное меню по центру
    minimal: {
        title: tt('Минимал'),
        hover: false,
        html: () => `
            <img class="shn-art" alt=""><h1 class="shn-name"></h1>
            <div class="shn-who"><button data-nav="-1">${tt("‹ пред.")}</button><button data-nav="1">${tt("след. ›")}</button></div>
            <div class="shn-menu"><button data-act="continue">${tt("Продолжить")}</button><button data-act="new">${tt("Новое начало")}</button><button data-act="all">${tt("Все сказания")}</button></div>
            <div class="shn-line"></div>`,
        mount(root) { root._menu = menu(root, '.shn-menu button'); },
        show(root, i, items) {
            const c = items[i];
            root.querySelector('.shn-art').src = c.img;
            const nm = root.querySelector('.shn-name');
            nm.textContent = c.name;
            // имя с широкой разрядкой — уменьшаем, пока не влезет в одну строку
            nm.style.fontSize = '';
            let fs = parseFloat(getComputedStyle(nm).fontSize);
            while (fs > 16 && nm.scrollWidth > nm.clientWidth + 1) { fs -= 2; nm.style.fontSize = fs + 'px'; }
            root.querySelector('.shn-line').textContent = c.snip ? `«${c.snip}»` : '';
        },
        key(k, root, api) {
            if (k === 'ArrowDown' || k === 'ArrowUp') { root._menu.move(k === 'ArrowDown' ? 1 : -1); return true; }
            if (k === 'Enter') { root._menu.pick(api); return true; }
            return false; // ←→ — персонажи, как везде
        },
    },

    // Старая JRPG: синие окна, пиксельные портреты, отряд, диалог по буквам
    retro: {
        title: tt('Ретро-пиксель'),
        hover: false,
        html: (items) => `
            <div class="shr-stars">${Array.from({ length: 60 }, () => `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 70).toFixed(1)}%;animation-duration:${(1 + Math.random() * 2.5).toFixed(1)}s"></i>`).join('')}</div>
            <div class="shr-title">SILLYTAVERN<small>${tt("— продолжение истории —")}</small></div>
            <div class="shr-win shr-hero"><canvas></canvas></div>
            <div class="shr-win shr-stat"><h1 class="shr-name"></h1>
                <div class="shr-row"><b>LV</b><span class="shr-lv"></span><span></span></div>
                <div class="shr-row"><b>HP</b><div class="shr-meter"><i class="shr-hp"></i></div><span class="shr-hpn"></span></div>
                <div class="shr-row"><b>MP</b><div class="shr-meter mp"><i class="shr-mp"></i></div><span class="shr-mpn"></span></div>
                <div class="shr-row"><b>${tt("ГДЕ")}</b><span class="shr-when"></span><span></span></div></div>
            <div class="shr-win shr-menu"><button data-act="continue">${tt("Продолжить")}</button><button data-act="new">${tt("Новая игра")}</button><button data-act="all">${tt("Загрузить")}</button></div>
            <div class="shr-win shr-party"><h6>${tt("ОТРЯД")}</h6>${items.map((c, i) => `<button data-i="${i}" title="${esc(c.name)}"><canvas></canvas></button>`).join('')}</div>
            <div class="shr-win shr-dlg"><b></b><span class="shr-t"></span><span class="shr-more">▼</span></div><div class="shr-scan"></div>`,
        mount(root, api) {
            root._menu = menu(root, '.shr-menu button');
            root.querySelectorAll('.shr-party button').forEach((b, i) => pix(b.querySelector('canvas'), api.items[i].img, 16, 16, 0.06, 0.42));
        },
        unmount(root) { clearInterval(root._tm); },
        show(root, i, items) {
            const c = items[i], maxChats = Math.max(1, ...items.map((x) => x.chats || 0));
            pix(root.querySelector('.shr-hero canvas'), c.img, 64, 96);
            root.querySelector('.shr-name').textContent = c.name;
            root.querySelector('.shr-lv').textContent = c.msgs;
            root.querySelector('.shr-hp').style.width = Math.max(8, (c.chats || 0) / maxChats * 100) + '%';
            root.querySelector('.shr-hpn').textContent = `${c.chats || 0}/${maxChats}`;
            const fresh = Math.max(0.06, 1 - (Date.now() - c.ts) / (30 * 864e5));
            root.querySelector('.shr-mp').style.width = fresh * 100 + '%';
            root.querySelector('.shr-mpn').textContent = Math.round(fresh * 99);
            root.querySelector('.shr-when').textContent = ago(c.ts);
            mark(root, '.shr-party button', i);
            root.querySelector('.shr-dlg b').textContent = c.name.split(' ')[0].toUpperCase();
            typeInto(root, root.querySelector('.shr-t'), c.snip ? `«${c.snip}»` : '…', 2, 28);
        },
        key(k, root, api) {
            if (k === 'ArrowDown' || k === 'ArrowUp') { root._menu.move(k === 'ArrowDown' ? 1 : -1); return true; }
            if (k === 'Enter') { root._menu.pick(api); return true; }
            return false;
        },
    },

    // Киберпанк: жёлтый/циан/красный, глитч имени, контакты, «входящий вызов»
    cyber: {
        title: tt('Киберпанк'),
        hover: false,
        html: (items) => `
            <div class="shc-haze"></div><div class="shc-grid"></div><div class="shc-sweep"></div><div class="shc-hazard"></div>
            <div class="shc-head"><span class="shc-lbl"><b>LIVE</b>${tt("ЛОГ ПОСЛЕДНЕЙ СВЯЗИ")}</span><h1 class="shc-name"></h1><div class="shc-meta"></div></div>
            <nav class="shc-menu">
                <button class="shc-mi" data-act="continue"><small>01</small>${tt("Продолжить")}</button>
                <button class="shc-mi" data-act="new"><small>02</small>${tt("Новый чат")}</button>
                <button class="shc-mi" data-act="all"><small>03</small>${tt("Все чаты")}</button></nav>
            <div class="shc-por"><div class="shc-fr shc-cut"><img class="base" alt=""><img class="rc r1" alt=""><img class="rc r2" alt=""></div><span class="shc-br a"></span><span class="shc-br b"></span><span class="shc-tagr"></span><span class="shc-tagid"></span></div>
            <div class="shc-cts"><h6><span>${tt("КОНТАКТЫ")}</span><span>${items.length}</span></h6><div class="shc-list">${items.map((c, i) => `<button class="shc-ct" data-i="${i}"><img src="${esc(c.img)}" alt="" decoding="async"><div><b>${esc(c.name)}</b><small>${ago(c.ts)}</small></div><i class="${Date.now() - c.ts < 864e5 ? 'live' : ''}"></i></button>`).join('')}</div></div>
            <div class="shc-call shc-cut"><img alt=""><div><div class="shc-who">${tt("ВХОДЯЩИЙ ВЫЗОВ ·")} <b></b></div><div class="shc-msg"><span class="shc-t"></span><span class="shc-cur"></span></div></div>
                <div class="shc-ans"><button data-act="continue">${tt("Ответить")}</button><button data-act="all">${tt("История")}</button></div></div>
            <div class="shc-scan"></div>`,
        mount(root) {
            root._menu = menu(root, '.shc-mi');
            const por = root.querySelector('.shc-por');
            // глитч — сдвиг полос картинки, без осветления; при первом показе не срабатывает
            root._glitch = () => { por.classList.add('glitch'); setTimeout(() => por.classList.remove('glitch'), 160); };
            root._gt = setInterval(root._glitch, 4200);
            root._shown = false;
        },
        unmount(root) { clearInterval(root._tm); clearInterval(root._gt); },
        show(root, i, items) {
            const c = items[i], q = (s) => root.querySelector(s);
            q('.shc-haze').style.backgroundImage = c.img ? `url("${c.img}")` : '';
            root.querySelectorAll('.shc-por img').forEach((im) => { im.src = c.img; });
            q('.shc-call img').src = c.img;
            const nm = q('.shc-name'); nm.textContent = c.name; nm.dataset.t = c.name;
            q('.shc-meta').innerHTML = `<span>${tt("СООБЩ:")} <i>${c.msgs}</i></span>${c.chats ? `<span>${tt("ЧАТОВ:")} <i>${c.chats}</i></span>` : ''}<span>${tt("СВЯЗЬ:")} <i>${ago(c.ts)}</i></span>`;
            q('.shc-tagr').textContent = `ID ${String(i + 1).padStart(4, '0')}-${String(c.msgs).padStart(4, '0')}`;
            q('.shc-tagid').textContent = tt`◆ ${c.name.toUpperCase()} // ЛИЧНОЕ ДЕЛО`;
            q('.shc-who b').textContent = c.name.toUpperCase();
            mark(root, '.shc-ct', i);
            root.querySelectorAll('.shc-ct')[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (root._shown) root._glitch?.(); root._shown = true;
            typeInto(root, q('.shc-t'), c.snip || '…', 3, 24);
        },
        key(k, root, api) {
            if (k === 'ArrowDown' || k === 'ArrowUp') { root._menu.move(k === 'ArrowDown' ? 1 : -1); return true; }
            if (k === 'Enter') { root._menu.pick(api); return true; }
            return false;
        },
    },
});

/* ─────────── Уютная: пастель, арка, облачко, дневник; котик на подушке, сакура, кружка чая (SVG) ─────────── */
const SHZ_CAT = `<div class="shz-cat" aria-hidden="true">
<svg class="shz-cush" viewBox="0 0 240 150">
  <defs><linearGradient id="shz-cush" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9cdd8"/><stop offset="1" stop-color="#eea6b9"/></linearGradient></defs>
  <ellipse cx="120" cy="140" rx="104" ry="7" fill="#b9786a" opacity=".18"/>
  <rect x="14" y="96" width="212" height="40" rx="20" fill="url(#shz-cush)"/>
  <ellipse cx="120" cy="101" rx="98" ry="7" fill="#fde3ea"/>
  <path d="M66 117q4 3 8 0M116 120q4 3 8 0M166 117q4 3 8 0" fill="none" stroke="#dc8ea3" stroke-width="1.6" stroke-linecap="round"/>
  <ellipse cx="124" cy="121" rx="82" ry="6" fill="#d98aa0" opacity=".45"/>
</svg>
<svg class="shz-body" viewBox="0 0 240 150">
  <defs>
    <linearGradient id="shz-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8b26c"/><stop offset="1" stop-color="#ea8f48"/></linearGradient>
    <linearGradient id="shz-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fabd7d"/><stop offset="1" stop-color="#f09a55"/></linearGradient>
  </defs>
  <path d="M60 112C52 80 78 56 124 56C170 56 198 78 196 104C195 116 186 120 170 120H80C68 120 62 118 60 112Z" fill="url(#shz-fur)"/>
  <path d="M92 66C112 58 146 58 168 68" fill="none" stroke="#fdd2a3" stroke-width="7" stroke-linecap="round" opacity=".55"/>
  <path d="M128 58C134 66 134 74 130 82M148 61C154 68 154 76 150 83M166 68C171 74 171 80 168 86" fill="none" stroke="#d6722f" stroke-width="5" stroke-linecap="round" opacity=".5"/>
  <path d="M188 108C204 124 170 132 132 130C118 129 108 127 102 124" fill="none" stroke="#ec9550" stroke-width="14" stroke-linecap="round"/>
  <path d="M180.5 120 179.5 132M159.5 124 158.5 136" stroke="#d6722f" stroke-width="4" stroke-linecap="round" opacity=".55"/>
  <path d="M44 78 39 50Q40 45 45 48L64 63Z" fill="#f4a462" stroke="#f4a462" stroke-width="4" stroke-linejoin="round"/>
  <path d="M78 62 96 47Q101 44 102 49L100 74Z" fill="#f4a462" stroke="#f4a462" stroke-width="4" stroke-linejoin="round"/>
  <path d="M47 71 45 56 57 64ZM84 62 95 53 96 69Z" fill="#f5a9ab"/>
  <ellipse cx="72" cy="92" rx="34" ry="30" fill="url(#shz-head)"/>
  <path d="M66 69v6M72 67v8M78 69v6" stroke="#d6722f" stroke-width="3" stroke-linecap="round" opacity=".45"/>
  <ellipse cx="72" cy="104" rx="16" ry="10" fill="#fde7cf"/>
  <path d="M52 93q6 5 12 0M80 93q6 5 12 0" fill="none" stroke="#6e4330" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M69 99.5h6l-3 3.4Z" fill="#e57b8c"/>
  <path d="M72 102.9q-2 3-5 2M72 102.9q2 3 5 2" fill="none" stroke="#6e4330" stroke-width="1.5" stroke-linecap="round"/>
  <ellipse cx="53" cy="101" rx="5.5" ry="3.2" fill="#f59aa4" opacity=".5"/><ellipse cx="91" cy="101" rx="5.5" ry="3.2" fill="#f59aa4" opacity=".5"/>
  <path d="M46 100 31 98M46 104 32 106M98 100 113 98M98 104 112 106" stroke="#b98468" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
  <ellipse cx="60" cy="121" rx="10" ry="6" fill="#fde7cf"/><ellipse cx="84" cy="122" rx="10" ry="6" fill="#fde7cf"/>
  <path d="M57 121v3M62 121v3M81 122v3M86 122v3" stroke="#e8c3a2" stroke-width="1.2" stroke-linecap="round"/>
</svg>
<i class="shz-z">z</i><i class="shz-z">z</i><i class="shz-z">z</i>
</div>`;
const SHZ_BRANCH = `<div class="shz-branch" aria-hidden="true"><svg class="shz-bark" viewBox="-22 -22 444 202"><defs>
  <linearGradient id="shz-sak" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ee7fa0"/><stop offset=".3" stop-color="#fbbcd0"/><stop offset=".75" stop-color="#ffe6ee"/><stop offset="1" stop-color="#fff8fa"/></linearGradient>
  <linearGradient id="shz-bud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7a6bf"/><stop offset="1" stop-color="#e2668c"/></linearGradient>
  <linearGradient id="shz-leaf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8faa58"/><stop offset="1" stop-color="#c3cf7c"/></linearGradient>
  <linearGradient id="shz-bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d5544"/><stop offset=".55" stop-color="#5a3a2e"/><stop offset="1" stop-color="#3e271f"/></linearGradient>
  <path id="shz-pt" d="M0 0C-5 -2 -9.5 -8 -8.6 -13.4C-7.8 -16.8 -3.6 -17.6 -1.3 -14.8L0 -13.2 1.3 -14.8C3.6 -17.6 7.8 -16.8 8.6 -13.4C9.5 -8 5 -2 0 0Z" fill="url(#shz-sak)" stroke="#f3a9bf" stroke-width=".5"/>
  <g id="shz-st" stroke="#e86f93" stroke-width=".7" fill="#f7c66e"><path d="M0 0L7.6 2.4"/><circle cx="7.6" cy="2.4" r="1.1"/><path d="M0 0L3.9 5.2"/><circle cx="3.9" cy="5.2" r="1.1"/><path d="M0 0L0.1 8"/><circle cx="0.1" cy="8" r="1.1"/><path d="M0 0L-3.7 5.3"/><circle cx="-3.7" cy="5.3" r="1.1"/><path d="M0 0L-7.6 2.6"/><circle cx="-7.6" cy="2.6" r="1.1"/><path d="M0 0L-6.2 -1.9"/><circle cx="-6.2" cy="-1.9" r="1.1"/><path d="M0 0L-4.8 -6.4"/><circle cx="-4.8" cy="-6.4" r="1.1"/><path d="M0 0L-0.1 -6.5"/><circle cx="-0.1" cy="-6.5" r="1.1"/><path d="M0 0L4.6 -6.5"/><circle cx="4.6" cy="-6.5" r="1.1"/><path d="M0 0L6.2 -2.1"/><circle cx="6.2" cy="-2.1" r="1.1"/></g>
  <g id="shz-flw"><use href="#shz-pt"/><use href="#shz-pt" transform="rotate(72)"/><use href="#shz-pt" transform="rotate(144)"/><use href="#shz-pt" transform="rotate(216)"/><use href="#shz-pt" transform="rotate(288)"/><use href="#shz-st"/><circle r="2.6" fill="#d9557d"/></g>
  <g id="shz-cup"><use href="#shz-pt" transform="rotate(-62) scale(.9 1)"/><use href="#shz-pt" transform="rotate(62) scale(.9 1)"/><g stroke="#e86f93" stroke-width=".7" fill="#f7c66e"><path d="M0 -2L-4 -12M0 -2 0 -13M0 -2 4 -12"/><circle cx="-4" cy="-12" r="1.1"/><circle cy="-13" r="1.1"/><circle cx="4" cy="-12" r="1.1"/></g><use href="#shz-pt" transform="rotate(-24) scale(.95 .9)"/><use href="#shz-pt" transform="rotate(24) scale(.95 .9)"/><path d="M-4.5 0.5Q0 8 4.5 0.5L2.5 3.5 0 7-2.5 3.5Z" fill="#a14f58"/></g>
</defs>
<g fill="url(#shz-bark)"><path d="M-19.2 12L-12.7 12.8L-3.8 14.6L7 14.9L18.6 16.5L30.4 18L41.4 20.5L51.8 22.4L62 25.3L72 28.5L81.9 31.9L91.9 34.6L101.7 37.3L111.6 40.4L121.5 43.1L131.4 45.7L141.4 48L151.1 50.8L160.9 52.6L170.7 54.3L180.6 55.4L190.5 57.2L200.4 58L210.3 58.9L220.2 59.4L230.2 60.4L240.1 60.7L250 61.1L259.9 61.1L269.8 61.2L279.7 60.6L289.5 59.7L299.1 58.5L308.9 57.1L318.8 55.4L328.9 53.4L339.5 51.6L351.5 49.5L364.8 47.1L378.3 44.4L391.1 42L401.9 40L409.7 38.6L410.3 41.4L402.6 43.2L391.8 45.5L379.2 48.4L365.6 51.1L352.3 53.9L340.5 56.4L329.9 58.6L319.8 60.6L309.9 62.7L300.1 64.7L290.3 66.2L280.3 67.4L270.2 68.1L260.1 68.8L250 68.9L239.9 68.9L229.8 68.5L219.8 68.6L209.7 68L199.6 67.5L189.5 66.6L179.4 66.2L169.3 64.7L159.1 63.4L148.9 61.5L138.6 60L128.6 57.5L118.5 55.1L108.4 52.7L98.3 50.7L88.1 48L78.1 45L68 42.5L58 40.1L48.2 37.9L38.6 35.5L28.2 34.7L16.9 33.6L5.5 33.1L-5.1 31.8L-14.2 32.3L-20.8 32Z"/><path d="M115.1 47L116.8 45L119.1 42.3L121.5 38.8L124.4 35.2L127.3 31.6L130.3 28.5L133.1 25.5L136.1 22.8L139.2 20.1L142.4 17.6L145.7 15L149.1 12.7L152.9 10.4L157.2 8.1L161.6 5.9L165.6 3.9L169.1 2.4L171.6 1.2L172.4 2.8L170 4.1L166.7 6L162.7 8.1L158.5 10.4L154.4 12.9L150.9 15.3L147.8 17.8L144.7 20.3L141.8 23L139 25.8L136.3 28.7L133.7 31.5L131.3 34.8L128.7 38.4L126.2 42.2L123.8 45.6L122.2 48.8L120.9 51Z"/><path d="M199.8 60.7L200.4 63.4L201.2 67.1L202.7 71.3L204.1 76L205.5 80.7L206.5 85.3L207.6 89.5L208.6 93.8L209.5 98.2L210.3 102.7L211.2 107.2L211.8 111.7L212.2 116.7L212.5 122.1L212.8 127.5L212.9 132.6L212.9 136.9L213 139.9L211 140.1L210.7 137L210.3 132.7L210 127.7L209.5 122.3L209 117L208.2 112.3L207.3 107.9L206.4 103.5L205.2 99.3L204 95L202.7 90.9L201.5 86.7L199.9 82.5L198.3 77.9L196.5 73.4L195.1 69.2L193.4 65.8L192.2 63.3Z"/><path d="M294.2 61L295.6 62.8L297.4 65.4L299.8 68.1L302.3 71.1L304.9 74L307.3 76.6L309.8 78.8L312.2 81L314.7 83.2L317.2 85.3L319.8 87.1L322.6 88.7L325.8 90.2L329.4 91.6L333.3 92.7L336.9 93.7L340 94.6L342.2 95.2L341.8 96.8L339.6 96.3L336.4 95.7L332.7 94.8L328.8 93.8L324.9 92.6L321.4 91.3L318.3 89.7L315.4 87.8L312.6 85.9L309.9 83.8L307.2 81.7L304.7 79.4L301.8 77L299 74.2L296.2 71.4L293.7 68.6L291.4 66.5L289.8 65Z"/><path d="M48.4 29.2L48.8 31L49.3 33.6L50.2 36.5L51.1 39.6L52.2 42.6L53.3 45.3L54.7 47.9L56.4 50.6L58.3 53.3L60 55.8L61.6 57.9L62.7 59.5L61.3 60.5L60.1 59.1L58.5 57.1L56.5 54.7L54.4 52.1L52.4 49.4L50.7 46.7L49.2 43.9L47.8 40.8L46.5 37.8L45.5 34.8L44.4 32.5L43.6 30.8Z"/></g>
<g fill="#b08a74" opacity=".5"><path d="M-19.4 14.8L-12.9 15.5L-4 17L6.8 17.5L18.4 18.9L30.1 20.3L41 22.6L51.3 24.5L61.4 27.3L71.5 30.4L81.4 33.7L91.3 36.5L101.3 39.2L111.1 42.1L121.1 44.8L131 47.4L141 49.7L150.8 52.3L160.7 54.1L170.5 55.8L180.5 57L190.3 58.5L200.3 59.3L210.2 60.2L220.2 60.7L230.1 61.6L240.1 61.9L250 62.2L260 62.2L269.9 62.2L279.8 61.6L289.6 60.6L299.3 59.3L309 57.9L318.9 56.1L329.1 54.1L339.7 52.3L351.6 50.1L364.9 47.7L378.5 44.9L391.2 42.5L402 40.4L409.8 39L409.9 39.6L402.2 41.1L391.4 43.3L378.6 45.8L365.1 48.5L351.8 51.1L339.9 53.3L329.3 55.3L319.1 57.3L309.2 59.1L299.5 60.7L289.8 62L279.9 63.1L270 63.7L260 63.9L250 63.9L240 63.7L230 63.3L220.1 62.7L210.1 62.2L200.1 61.4L190.1 60.6L180.2 59.3L170.2 58.1L160.3 56.5L150.3 54.6L140.4 52.3L130.4 50L120.4 47.4L110.4 44.8L100.5 42.1L90.5 39.5L80.5 36.6L70.6 33.5L60.6 30.6L50.5 27.9L40.4 25.9L29.6 24L18 22.6L6.5 21.5L-4.3 20.8L-13.3 19.8L-19.8 19.2Z"/><path d="M116 47.6L117.6 45.6L119.8 42.8L122.2 39.3L125 35.7L127.9 32.1L130.8 28.9L133.6 26L136.5 23.2L139.6 20.5L142.8 18L146 15.4L149.4 13.1L153.2 10.8L157.4 8.4L161.7 6.2L165.8 4.2L169.3 2.6L171.7 1.4L171.9 1.8L169.4 3L166 4.7L162 6.7L157.7 8.9L153.5 11.3L149.7 13.6L146.4 16L143.2 18.5L140.1 21.1L137.1 23.8L134.2 26.6L131.5 29.5L128.7 32.7L125.9 36.3L123.2 40L120.8 43.5L118.7 46.3L117.1 48.4Z"/><path d="M198.6 61.1L199.4 63.7L200.3 67.4L201.8 71.6L203.2 76.3L204.6 81L205.7 85.5L206.9 89.7L207.9 94L208.9 98.4L209.7 102.8L210.6 107.3L211.3 111.8L211.7 116.8L212.1 122.1L212.3 127.6L212.5 132.6L212.6 136.9L212.7 140L212.3 140L212.2 136.9L212 132.6L211.8 127.6L211.5 122.2L211.1 116.8L210.5 111.9L209.8 107.4L209 103L208 98.6L207 94.3L205.9 90L204.7 85.8L203.5 81.3L202.1 76.7L200.6 72.1L199.1 67.8L198 64.2L197.1 61.6Z"/><path d="M293.6 61.6L295 63.4L296.8 65.9L299.3 68.6L301.8 71.6L304.5 74.4L306.9 77L309.4 79.2L311.9 81.5L314.4 83.6L316.9 85.7L319.6 87.5L322.4 89.1L325.6 90.6L329.3 91.9L333.2 93L336.8 94L339.9 94.8L342.1 95.5L342.1 95.8L339.8 95.2L336.7 94.4L333.1 93.4L329.2 92.3L325.5 91.1L322.2 89.6L319.3 88L316.6 86.2L313.9 84.2L311.4 82L308.9 79.8L306.4 77.6L303.9 75L301.2 72.2L298.6 69.3L296.1 66.5L294.1 64.1L292.7 62.4Z"/><path d="M47.7 29.4L48.1 31.3L48.7 33.8L49.7 36.7L50.6 39.8L51.8 42.8L52.9 45.5L54.4 48.1L56.1 50.8L58 53.5L59.8 56L61.4 58.1L62.5 59.7L62.2 59.9L61.1 58.3L59.5 56.3L57.6 53.8L55.7 51.1L53.9 48.4L52.4 45.8L51.2 43.1L50 40L48.9 36.9L48 34L47.3 31.5L46.7 29.8Z"/></g>
<g transform="translate(160 58) rotate(52) scale(0.8)"><path d="M0 0C7 -8 20 -9 30 0C20 8 7 7 0 0Z" fill="url(#shz-leaf)"/><path d="M1 0Q15 -1 28 0" fill="none" stroke="#7c8f4b" stroke-width=".8"/></g><g transform="translate(282 64) rotate(-40) scale(0.7)"><path d="M0 0C7 -8 20 -9 30 0C20 8 7 7 0 0Z" fill="url(#shz-leaf)"/><path d="M1 0Q15 -1 28 0" fill="none" stroke="#7c8f4b" stroke-width=".8"/></g><g transform="translate(342 54) rotate(70) scale(0.65)"><path d="M0 0C7 -8 20 -9 30 0C20 8 7 7 0 0Z" fill="url(#shz-leaf)"/><path d="M1 0Q15 -1 28 0" fill="none" stroke="#7c8f4b" stroke-width=".8"/></g>
<path d="M36 27Q35.9 36.5 30 46M60 58Q62.7 67 60 76M58 50Q67.9 53 76 56M54 56Q51.1 63 44 70M104 46Q106 56 102 66M112 50Q123.6 62 128 74M100 41Q91.3 35.5 86 30M148 16Q147.8 12 150 8M162 10Q170.5 15 176 20M170 3Q172.7 -1.5 178 -6M138 26Q133.8 22 132 18M204 86Q198.8 92 190 98M208 104Q218.2 108 226 112M208 124Q203.2 128 196 132M211 136Q218.4 139 224 142M212 140Q214.7 149 212 158M252 62Q250 52 254 42M268 66Q275.7 75 278 84M236 66Q239.7 75 238 84M320 89Q326.4 100.5 326 112M338 95Q346.9 101.5 352 108M344 96Q350.8 92 360 88M360 50Q363 40 372 30M390 43Q394.6 48.5 396 54M408 40Q410.1 37 414 34" fill="none" stroke="#8b6a3e" stroke-width="1.2" stroke-linecap="round"/>
<g transform="translate(44 70) rotate(160)"><path d="M0 -9C4 -9 5.5 -4 5 0H-5C-5.5 -4 -4 -9 0 -9Z" fill="url(#shz-bud)"/><path d="M-5.5 -.5Q0 6 5.5 -.5L3 3.5 0 6.5-3 3.5Z" fill="#9b4b52"/></g><g transform="translate(86 30) rotate(-30)"><path d="M0 -9C4 -9 5.5 -4 5 0H-5C-5.5 -4 -4 -9 0 -9Z" fill="url(#shz-bud)"/><path d="M-5.5 -.5Q0 6 5.5 -.5L3 3.5 0 6.5-3 3.5Z" fill="#9b4b52"/></g><g transform="translate(178 -6) rotate(40)"><path d="M0 -9C4 -9 5.5 -4 5 0H-5C-5.5 -4 -4 -9 0 -9Z" fill="url(#shz-bud)"/><path d="M-5.5 -.5Q0 6 5.5 -.5L3 3.5 0 6.5-3 3.5Z" fill="#9b4b52"/></g><g transform="translate(212 158) rotate(180)"><path d="M0 -9C4 -9 5.5 -4 5 0H-5C-5.5 -4 -4 -9 0 -9Z" fill="url(#shz-bud)"/><path d="M-5.5 -.5Q0 6 5.5 -.5L3 3.5 0 6.5-3 3.5Z" fill="#9b4b52"/></g><g transform="translate(360 88) rotate(70)"><path d="M0 -9C4 -9 5.5 -4 5 0H-5C-5.5 -4 -4 -9 0 -9Z" fill="url(#shz-bud)"/><path d="M-5.5 -.5Q0 6 5.5 -.5L3 3.5 0 6.5-3 3.5Z" fill="#9b4b52"/></g><g transform="translate(414 34) rotate(60)"><path d="M0 -9C4 -9 5.5 -4 5 0H-5C-5.5 -4 -4 -9 0 -9Z" fill="url(#shz-bud)"/><path d="M-5.5 -.5Q0 6 5.5 -.5L3 3.5 0 6.5-3 3.5Z" fill="#9b4b52"/></g>
</svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:11.7%;top:33.7%;animation-delay:-1.4s"><use href="#shz-flw" transform="rotate(10) scale(0.95)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:18.5%;top:48.5%;animation-delay:-2.7s"><use href="#shz-cup" transform="rotate(-20) scale(0.8)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:22.1%;top:38.6%;animation-delay:-4.1s"><use href="#shz-flw" transform="rotate(30) scale(1)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:27.9%;top:43.6%;animation-delay:-0.5s"><use href="#shz-flw" transform="rotate(-8) scale(1.05)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:33.8%;top:47.5%;animation-delay:-1.9s"><use href="#shz-flw" transform="rotate(24) scale(0.95)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:38.7%;top:14.9%;animation-delay:-3.2s"><use href="#shz-flw" transform="rotate(18) scale(0.85)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:44.6%;top:20.8%;animation-delay:-4.6s"><use href="#shz-flw" transform="rotate(-14) scale(0.8)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:34.7%;top:19.8%;animation-delay:-1.0s"><use href="#shz-cup" transform="rotate(-40) scale(0.7)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:47.7%;top:59.4%;animation-delay:-2.3s"><use href="#shz-flw" transform="rotate(-12) scale(1)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:55.9%;top:66.3%;animation-delay:-3.7s"><use href="#shz-flw" transform="rotate(26) scale(0.9)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:49.1%;top:76.2%;animation-delay:-0.1s"><use href="#shz-flw" transform="rotate(8) scale(0.95)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:55.4%;top:81.2%;animation-delay:-1.4s"><use href="#shz-cup" transform="rotate(140) scale(0.8)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:62.2%;top:31.7%;animation-delay:-2.8s"><use href="#shz-flw" transform="rotate(12) scale(1)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:67.6%;top:52.5%;animation-delay:-4.2s"><use href="#shz-flw" transform="rotate(-24) scale(0.9)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:58.6%;top:52.5%;animation-delay:-0.6s"><use href="#shz-cup" transform="rotate(160) scale(0.75)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:78.4%;top:66.3%;animation-delay:-1.9s"><use href="#shz-flw" transform="rotate(6) scale(0.95)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:84.2%;top:64.4%;animation-delay:-3.3s"><use href="#shz-flw" transform="rotate(34) scale(0.8)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:88.7%;top:25.7%;animation-delay:-4.7s"><use href="#shz-flw" transform="rotate(-18) scale(0.8)"/></svg><svg class="shz-fl" viewBox="-20 -20 40 40" style="left:94.1%;top:37.6%;animation-delay:-1.0s"><use href="#shz-cup" transform="rotate(20) scale(0.7)"/></svg></div>`;
const SHZ_MUG = `<svg class="shz-mug" viewBox="0 0 64 80" aria-hidden="true">
  <path class="shz-st" d="M22 20c-4-4 4-8 0-12"/><path class="shz-st" d="M31 18c-4-4 4-8 0-12"/><path class="shz-st" d="M40 20c-4-4 4-8 0-12"/>
  <ellipse cx="30" cy="74" rx="27" ry="5" fill="#f1d3c8"/><ellipse cx="30" cy="72.5" rx="20" ry="3" fill="#f8e4dc"/>
  <path d="M50 36h3a8 8 0 0 1 0 16h-3" fill="none" stroke="#efd8cb" stroke-width="6" stroke-linecap="round"/>
  <path d="M10 28h40v28a14 14 0 0 1-14 14H24a14 14 0 0 1-14-14Z" fill="#fff8f1"/>
  <path d="M42 28h8v28a14 14 0 0 1-12 13.9c3-4 4-10 4-16Z" fill="#f3e0d5"/>
  <rect x="10" y="44" width="40" height="6" fill="#f6a9bb"/>
  <circle cx="18" cy="47" r="1" fill="#fff"/><circle cx="26" cy="47" r="1" fill="#fff"/><circle cx="34" cy="47" r="1" fill="#fff"/><circle cx="42" cy="47" r="1" fill="#fff"/>
  <ellipse cx="30" cy="28" rx="20" ry="4" fill="#f6e6dc"/><ellipse cx="30" cy="28.6" rx="17" ry="2.7" fill="#b8714c"/>
  <path d="M41 28.5C44 31 47 37 46.5 53" fill="none" stroke="#c9b3a2" stroke-width=".9"/>
  <rect x="42.5" y="53" width="8" height="9" rx="1.2" fill="#f5c27a"/>
</svg>`;
LAYOUTS.cozy = {
    title: tt('Уютная'),
    hover: false,
    html: (items) => {
        const h = new Date().getHours();
        const hello = h < 5 ? tt('Доброй ночи') : h < 12 ? tt('Доброе утро') : h < 18 ? tt('Добрый день') : tt('Добрый вечер');
        return `<div class="shz-wrap">${SHZ_BRANCH}<div class="shz-petals">${Array.from({ length: 22 }, () => `<span style="left:${(Math.random()*100).toFixed(1)}%;--dx:${(Math.random()*160-80).toFixed(0)}px;animation-duration:${(9+Math.random()*9).toFixed(1)}s,3s;animation-delay:-${(Math.random()*18).toFixed(1)}s,-${(Math.random()*3).toFixed(1)}s"><svg width="${(10+Math.random()*8).toFixed(0)}" viewBox="-10 -18.5 20 19.5"><path d="M0 0C-5 -2 -9.5 -8 -8.6 -13.4C-7.8 -16.8 -3.6 -17.6 -1.3 -14.8L0 -13.2 1.3 -14.8C3.6 -17.6 7.8 -16.8 8.6 -13.4C9.5 -8 5 -2 0 0Z" fill="${['#ffe4ec','#fbc6d5','#f7b3c7'][Math.floor(Math.random()*3)]}" /></svg></span>`).join('')}</div>${SHZ_CAT}
            <div class="shz-soft"><i style="left:8%;top:62%;width:260px;height:260px;background:#ffc9a8"></i><i style="left:44%;top:6%;width:220px;height:220px;background:#f59bb0;animation-delay:-5s"></i><i style="left:70%;top:70%;width:300px;height:300px;background:#9cc9a4;animation-delay:-9s"></i></div>
            <div class="shz-hello">${hello}${tt(". С кем посидим сегодня?")}</div>
            <div class="shz-scene"><div class="shz-arch"><img alt=""></div>
                <div class="shz-talk"><span class="shz-tag"></span><h1></h1><div class="shz-bubble"><p></p></div>
                    <div class="shz-acts"><button class="shz-go" data-act="continue"><i></i>${tt("Продолжить")}</button><button data-act="new"><i></i>${tt("Новый чат")}</button><button data-act="all"><i></i>${tt("Все чаты")}</button>${SHZ_MUG}</div></div></div>
            <div class="shz-diary"><h2>${tt("Дневник")}</h2><small>${tt("последние разговоры")}</small><div class="shz-entries">${items.map((c, i) => `<button class="shz-entry" data-i="${i}"><img src="${esc(c.img)}" alt="" decoding="async"><div><b>${esc(c.name)}</b><span>${ago(c.ts)}</span></div></button>`).join('')}</div></div></div>`;
    },
    show(root, i, items) {
        const c = items[i], q = (s) => root.querySelector(s);
        q('.shz-arch img').src = c.img;
        q('.shz-tag').textContent = tt`${c.msgs} сообщений · ${ago(c.ts)}`;
        q('.shz-talk h1').textContent = c.name;
        q('.shz-bubble p').textContent = c.snip || '…';
        mark(root, '.shz-entry', i);
        root.querySelectorAll('.shz-entry')[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    key(k, root, api) {
        if (k === 'ArrowDown' || k === 'ArrowUp') { api.show(api.current + (k === 'ArrowDown' ? 1 : -1)); return true; }
        return false;
    },
};

/* ─────────── Ферма: пиксельная долина (canvas), деревянный UI, диалог как в Stardew, доска жителей ─────────── */
function farmScene(canvas) {
  const hr = new Date().getHours(), night = hr < 6 || hr >= 20;
  const cv = canvas, ctx = cv.getContext('2d'); let W = 320, H = 180, stat, clouds = [], stars = [];
  const px = (c, x, y, w=1, h=1) => { ctx.fillStyle = c; ctx.fillRect(x|0, y|0, w, h); };
  function build(){
    W = innerWidth <= 1000 ? 200 : 360;
    H = Math.round(W * innerHeight / Math.max(innerWidth,1)); cv.width = W; cv.height = H;
    stat = document.createElement('canvas'); stat.width = W; stat.height = H; const s = stat.getContext('2d');
    const P = (c,x,y,w=1,h=1) => { s.fillStyle=c; s.fillRect(Math.round(x),Math.round(y),w,h); };
    const N = (d,n) => night ? n : d;                                   // цвет днём / ночью
    const B = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    const dith = (x0,y0,w,h,c1,c2,t) => { for (let y=y0;y<y0+h;y++) for (let x=x0;x<x0+w;x++) P((typeof t==='function'?t(x,y):t)*16 > B[y&3][x&3] ? c2 : c1, x, y); };
    const disc = (cx,cy,r,c) => { for (let y=-r;y<=r;y++){ const w=Math.round(Math.sqrt(r*r-y*y)); P(c,cx-w,cy+y,w*2+1,1); } };
    const hz = Math.round(H*.5);
    // небо с дизерингом
    const sky = N(['#3f8fd8','#56a3e3','#6fb6ec','#8cc8f1','#acd9f4','#cbe8f7'],['#080b26','#0f1440','#171d58','#21286c','#2d357e','#3b438e']);
    for (let y=0;y<hz+8;y++){ const t=Math.min(y/hz,1)*(sky.length-1), i=Math.min(Math.floor(t),sky.length-2), f=t-i; for (let x=0;x<W;x++) P(f*16>B[y&3][x&3]?sky[i+1]:sky[i],x,y); }
    // светило
    if (night){ const mx=Math.round(W*.8), my=Math.round(H*.12); disc(mx,my,8,'#3b438e'); disc(mx,my,7,'#fff3c4'); P('#e6d79a',mx-3,my-2,3,2); P('#e6d79a',mx+2,my+2,3,2); P('#e6d79a',mx-1,my+4,2,1); }
    else { const sx=Math.round(W*.8), sy=Math.round(H*.12); disc(sx,sy,10,'#fff6c2'); disc(sx,sy,8,'#ffe36b'); disc(sx-2,sy-2,3,'#fff6c2'); }
    // дальние горы: тень справа, снежные шапки
    const mtn = (base,peaks,col,sh,snow) => { for (let x=0;x<W;x++){ let top=base, pk=null;
      peaks.forEach(p => { const y=base-p[1]+Math.abs(x-p[0]*W)*(p[1]/p[2]); if (y<top) { top=y; pk=p; } });
      if (!pk) continue; top=Math.round(top); const right = x>pk[0]*W;
      for (let y=top;y<base;y++) P(right?sh:col,x,y);
      if (snow && Math.abs(x-pk[0]*W) < pk[2]*.28) P(snow,x,top,1,3); } };
    mtn(hz+2,[[.12,34,40],[.33,46,52],[.58,30,38],[.86,40,46]],N('#7d97c4','#232a5c'),N('#6a84b2','#1c2250'),N('#f1f6ff','#9aa6d6'));
    // холмы с фактурой
    const hill = (base,amp,f,ph,c1,c2) => { for (let x=0;x<W;x++){ const y=Math.round(base+Math.sin(x*f+ph)*amp+Math.sin(x*f*2.7+1)*amp*.35);
      P(N('#2f5e2c','#0f2a22'),x,y,1,1); for (let yy=y+1;yy<H;yy++) P(((x*7+yy*13)%11===0)?c2:c1,x,yy); } };
    hill(hz+6,6,.03,1,N('#5c9a46','#1c4234'),N('#4f8a3c','#173a2e'));
    hill(hz+14,4,.05,3,N('#6fb04f','#21503b'),N('#62a046','#1c4634'));
    // земля: дизеринг светлее к зрителю
    const g1=N('#78bd52','#24573f'), g2=N('#8ccb5e','#2b6448');
    for (let y=hz+22;y<H;y++){ const t=(y-hz-22)/(H-hz-22); for (let x=0;x<W;x++) P(t*10>B[y&3][x&3]?g2:g1,x,y); }
    // пучки травы и цветочки
    for (let i=0;i<W*1.2;i++){ const x=Math.random()*W, y=hz+24+Math.random()*(H-hz-26); P(N('#5ea53f','#1d4a33'),x,y,1,2); P(N('#5ea53f','#1d4a33'),x+1,y+1,1,1); }
    for (let i=0;i<W*.15;i++){ const x=Math.random()*W, y=hz+30+Math.random()*(H-hz-32); P(N(['#fff','#ffd84a','#f59bb0'][i%3],'#8fa0c8'),x,y); }
    // пруд с отражением
    const px0=Math.round(W*.84), py0=hz+32, pw=Math.round(W*.09), ph=Math.round((H-hz)*.12);
    for (let y=0;y<ph;y++){ const w=Math.round(pw*Math.sqrt(1-Math.pow((y-ph/2)/(ph/2),2))); P(N('#3c7fbf','#13265a'),px0-w,py0+y,w*2,1); if (y%3===1) P(N('#7fc0ef','#3a4f96'),px0-w+4+(y*5)%7,py0+y,Math.max(2,w-6),1); }
    for (let x=-pw;x<pw;x+=3) P(N('#8a7a5a','#3a3a40'),px0+x,py0-1,2,1);
    // тропинка с камешками
    for (let y=hz+20;y<H;y++){ const k=(y-hz-20)/(H-hz-20), w=6+k*W*.12, cx=W*.47+k*W*.06+Math.sin(y*.15)*2;
      for (let x=Math.round(cx-w/2);x<cx+w/2;x++) P((x+y)%5===0?N('#c9a46a','#4a4436'):N('#d9b57a','#57503f'),x,y);
      if (y%7===0) P(N('#a8a39a','#45434a'),cx-w/2+((y*3)%Math.max(1,w|0)),y,2,1); }
    // деревья: контур, тень, блик
    const tree = (x,y,r) => { P(N('#3b2414','#120a06'),x-2,y,5,r+5); P(N('#7a4a26','#2c1a10'),x-1,y,3,r+4); P(N('#5e381c','#20130b'),x+1,y,1,r+4);
      const out=N('#24451f','#071a12'), base=N('#3f8a3c','#14402a'), mid=N('#4fa048','#1a4d33'), hi=N('#7cc65a','#2a6a45');
      [[0,-r,r+1],[-r*.7,-r*.4,r*.8+1],[r*.7,-r*.4,r*.8+1]].forEach(([dx,dy,rr])=>disc(x+dx,y+dy,Math.round(rr),out));
      [[0,-r,r],[-r*.7,-r*.4,r*.8],[r*.7,-r*.4,r*.8]].forEach(([dx,dy,rr])=>disc(x+dx,y+dy,Math.round(rr),base));
      disc(x-2,y-r-2,Math.round(r*.6),mid); disc(x-3,y-r-3,Math.round(r*.3),hi);
      for (let i=0;i<6;i++) P(hi,x-r+((i*7)%(2*r)),y-r-2+((i*5)%r),1,1); };
    const pine = (x,y,h) => { P(N('#5e381c','#20130b'),x,y-2,2,5); for (let k=0;k<3;k++){ const top=y-h+k*h/3, w=4+k*3;
      for (let yy=0;yy<h/2.4;yy++){ const ww=Math.round(1+yy*w/(h/2.4)); P(N('#24451f','#071a12'),x-ww,top+yy,ww*2+2,1); P(N('#2f6f3a','#123a26'),x-ww+1,top+yy,ww,1); P(N('#3c8746','#184a30'),x+1,top+yy,ww-1,1); } } };
    pine(Math.round(W*.04),hz+20,30); pine(Math.round(W*.94),hz+18,28); pine(Math.round(W*.98),hz+26,22);
    tree(Math.round(W*.16),hz+20,9); tree(Math.round(W*.36),hz+16,7);
    // дом: доски, черепица, труба, крыльцо, окна со светом
    const hx=Math.round(W*.58), hy=hz-6, hw=46, hh=24, out=N('#3a2010','#120805');
    P(out,hx-1,hy-1,hw+2,hh+2);
    for (let y=0;y<hh;y++) P(y%4===3?N('#a8683a','#3a2414'):N('#c98a52','#4a2e1a'),hx,hy+y,hw,1);
    P(N('#b07444','#3e2616'),hx+hw-6,hy,6,hh);
    const R=16; // треугольная крыша рядами черепицы
    for (let k=0;k<R;k++){ const w=Math.round((hw+10)*(1-k/R)), x=hx-5+Math.round((hw+10-w)/2), y=hy-1-k;
      P(out,x-1,y,w+2,1); P(k%3===0?N('#8f2f2a','#3a1414'):N('#b8423a','#5a1e1e'),x,y,w,1);
      if (k%3===1) for (let xx=x+((k>>1)%2)*2;xx<x+w-1;xx+=4) P(N('#d25a4c','#6a2626'),xx,y,2,1); }
    P(out,hx-6,hy-1,hw+12,1);
    P(out,hx+hw-14,hy-17,8,12); P(N('#9a8a80','#3a3a44'),hx+hw-13,hy-16,6,10); P(N('#7a6a60','#2a2a34'),hx+hw-13,hy-16,6,2);
    P(out,hx+18,hy+10,10,14); P(N('#6b3c1c','#2a160a'),hx+19,hy+11,8,13); P(N('#ffd75e','#ffd75e'),hx+25,hy+17,1,1);
    const win = (x) => { P(out,x-1,hy+5,10,9); P(night?'#ffd75e':'#9fd3f0',x,hy+6,8,7); P(out,x+3,hy+6,1,7); P(out,x,hy+9,8,1); if (!night) P('#d8eefa',x+1,hy+7,2,2); };
    win(hx+5); win(hx+33);
    P(N('#9a7a52','#3a2c1c'),hx+12,hy+hh,22,3); P(out,hx+12,hy+hh+3,22,1);
    chimney = {x:hx+hw-11, y:hy-18};
    // грядки: земля с бороздами, ростки и тыквы
    const gx=Math.round(W*.05), gy=hz+30, gw=Math.round(W*.26), gh=Math.round((H-hz)*.26);
    P(N('#4a2e18','#1a1008'),gx-1,gy-1,gw+2,gh+2);
    for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) P(y%5<2?N('#7a4c2a','#2c1a0e'):N('#8f5c34','#352012'),gx+x,gy+y);
    for (let r=2;r<gh-2;r+=5) for (let c=3;c<gw-3;c+=6){ const kind=(r*3+c)%7;
      if (kind===0){ P(N('#d8701c','#6a3a14'),gx+c-1,gy+r-1,4,3); P(N('#f39a3a','#7a4618'),gx+c,gy+r-1,1,1); P(N('#3c7a2c','#1a3a20'),gx+c+1,gy+r-2,1,1); }
      else { P(N('#3c8a32','#1d4a2a'),gx+c,gy+r,1,2); P(N('#6ccf4a','#2b6a3c'),gx+c-1,gy+r-1,1,1); P(N('#6ccf4a','#2b6a3c'),gx+c+1,gy+r-1,1,1); } }
    // забор: столбики с бликом и тенью, две перекладины
    const fy=hz+18;
    P(N('#6e5032','#2a1e14'),0,fy+2,W,1); P(N('#d9b585','#5a4a38'),0,fy+3,W,1); P(N('#6e5032','#2a1e14'),0,fy+6,W,1); P(N('#d9b585','#5a4a38'),0,fy+7,W,1);
    for (let x=3;x<W;x+=11){ P(N('#4a3020','#160e08'),x-1,fy-1,5,12); P(N('#e8c79a','#6a5a46'),x,fy,3,10); P(N('#b8946a','#4a3c2c'),x+2,fy,1,10); P(N('#fff0d0','#8a7a66'),x,fy,1,1); }
    clouds = Array.from({length:5},(_,i)=>({x:Math.random()*W, y:6+i*H*.05, s:.04+Math.random()*.06, w:20+Math.random()*22}));
    stars = Array.from({length:80},()=>({x:Math.random()*W, y:Math.random()*hz*.8, p:Math.random()*6}));
    flies = Array.from({length:14},()=>({x:Math.random()*W, y:hz+20+Math.random()*(H-hz-30), p:Math.random()*6}));
    birds = Array.from({length:3},(_,i)=>({x:-20-i*14, y:H*.18+i*5, s:.35+i*.05}));
    smoke = [];
  }
  let chimney = {x:0,y:0}, flies = [], birds = [], smoke = [];
  function frame(t){
    ctx.drawImage(stat,0,0);
    if (night) {
      stars.forEach(s => { if (Math.sin(t/400+s.p) > -.3) px(Math.sin(t/300+s.p)>.6?'#ffffff':'#c9d4ff', s.x, s.y); });
      flies.forEach(f => { const x=f.x+Math.sin(t/1400+f.p)*8, y=f.y+Math.cos(t/1100+f.p)*4; if (Math.sin(t/500+f.p*3)>0) { px('#fff7a0',x,y); px('#d8e86a55',x-1,y,3,1); } });
    } else {
      clouds.forEach(c => { c.x += c.s; if (c.x > W+40) c.x = -c.w;
        px('#d6eaf7',c.x+2,c.y+3,c.w-2,2); px('#ffffff',c.x,c.y,c.w,3); px('#ffffff',c.x+4,c.y-3,c.w*.45,3); px('#ffffff',c.x+c.w*.45,c.y-5,c.w*.3,5); });
      birds.forEach(b => { b.x += b.s; if (b.x > W+20) b.x = -30; const up = Math.floor(t/250+b.y)%2; px('#2a3a4a',b.x,b.y+up,2,1); px('#2a3a4a',b.x+3,b.y+up,2,1); px('#2a3a4a',b.x+2,b.y+1-up,1,1); });
    }
    if (Math.random()<.25) smoke.push({x:chimney.x+Math.random()*2, y:chimney.y, a:1});
    smoke.forEach(p => { p.y -= .35; p.x += .15; p.a -= .012; if (p.a>0) px(night?`rgba(160,160,190,${p.a*.6})`:`rgba(235,235,235,${p.a})`,p.x,p.y,2,2); });
    smoke = smoke.filter(p => p.a > 0);
  }
  let raf, last = 0;
  const loop = t => { if (t - last > 110) { frame(t); last = t; } raf = requestAnimationFrame(loop); };


  build();
  const onResize = () => build();
  return { start: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); addEventListener('resize', onResize); }, stop: () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); } };
}
const sfmHearts = (n) => Array.from({ length: 10 }, (_, k) => `<i class="${k < n ? 'sfm-f' : ''}"></i>`).join('');
LAYOUTS.farm = {
    title: tt('Ферма'),
    hover: false,
    html: (items) => {
        const DAYS = [tt('Вс.'), tt('Пн.'), tt('Вт.'), tt('Ср.'), tt('Чт.'), tt('Пт.'), tt('Сб.')], d = new Date();
        return `<canvas class="sfm-scene"></canvas><div class="sfm-ui">
            <div class="sfm-wood sfm-sign"><h1>Silly Valley</h1><small>${tt("— добро пожаловать домой —")}</small></div>
            <div class="sfm-wood sfm-clock"><div class="sfm-d">${DAYS[d.getDay()]} ${d.getDate()}</div><div class="sfm-t">${d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}</div><div class="sfm-g"><span class="sfm-gold"></span><i></i></div></div>
            <div class="sfm-btns"><button data-act="continue">${tt("Продолжить")}</button><button data-act="new">${tt("Новый день")}</button><button data-act="all">${tt("Загрузить")}</button><button data-ui="town">${tt("Жители")}</button></div>
            <div class="sfm-wood sfm-dlg"><div class="sfm-tx"><div class="sfm-t"></div></div><div class="sfm-side"><canvas></canvas><div class="sfm-nm"></div><div class="sfm-hearts"></div></div><span class="sfm-more"></span></div>
            <div class="sfm-dim"></div>
            <div class="sfm-wood sfm-board"><h2>${tt("Жители долины")}<button data-ui="close" title="${tt("Закрыть")}">✕</button></h2><div class="sfm-grid">${items.map((c, i) => `<button class="sfm-vl" data-g="${i}"><canvas></canvas><b>${esc(c.name)}</b><span class="sfm-hearts">${sfmHearts(Math.min(10, c.chats || 0))}</span></button>`).join('')}</div></div></div>`;
    },
    mount(root, api) {
        root._scene = farmScene(root.querySelector('.sfm-scene'));
        root._scene.start();
        root._menu = menu(root, '.sfm-btns button');
        const board = root.querySelector('.sfm-board'), dim = root.querySelector('.sfm-dim'), vls = [...root.querySelectorAll('.sfm-vl')];
        vls.forEach((v, i) => pix(v.querySelector('canvas'), api.items[i].img, 24, 24, 0.04, 0.42));
        root._g = 0;
        root._paintG = () => vls.forEach((v, i) => v.classList.toggle('on', i === root._g));
        root._board = (on) => { board.classList.toggle('open', on); dim.classList.toggle('open', on); if (on) { root._g = api.current; root._paintG(); } };
        root._pickV = (i) => { api.show(i); root._board(false); root._m = 0; root.querySelectorAll('.sfm-btns button').forEach((b, k) => b.classList.toggle('on', k === 0)); };
        root.querySelector('[data-ui="town"]').addEventListener('click', () => root._board(true));
        root.querySelector('[data-ui="close"]').addEventListener('click', () => root._board(false));
        dim.addEventListener('click', () => root._board(false));
        vls.forEach((v, i) => { v.addEventListener('mouseenter', () => { root._g = i; root._paintG(); }); v.addEventListener('click', () => root._pickV(i)); });
    },
    unmount(root) { root._scene?.stop(); clearInterval(root._tm); },
    show(root, i, items) {
        const c = items[i], q = (s) => root.querySelector(s);
        pix(q('.sfm-dlg canvas'), c.img, 56, 56, 0.03, 0.45);
        q('.sfm-nm').textContent = c.name;
        q('.sfm-dlg .sfm-hearts').innerHTML = sfmHearts(Math.min(10, c.chats || 0));
        q('.sfm-gold').textContent = c.msgs;
        typeInto(root, q('.sfm-tx .sfm-t'), c.snip || '…', 2, 26);
    },
    key(k, root, api) {
        if (root.querySelector('.sfm-board.open')) {
            if (k === 'Escape') root._board(false);
            else if (k === 'Enter') root._pickV(root._g);
            else { const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 }[k]; if (!d) return false; root._g = mod(root._g + d, api.items.length); root._paintG(); }
            return true;
        }
        if (k === 'ArrowRight' || k === 'ArrowLeft') { root._menu.move(k === 'ArrowRight' ? 1 : -1); return true; }
        if (k === 'ArrowDown' || k === 'ArrowUp') { api.show(api.current + (k === 'ArrowDown' ? 1 : -1)); return true; }
        if (k === 'Enter') { root._menu.pick(api); return true; }
        return false;
    },
};
