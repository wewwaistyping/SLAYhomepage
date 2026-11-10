import {
    characters,
    eventSource,
    event_types,
    getCurrentChatId,
    getRequestHeaders,
    getThumbnailUrl,
    openCharacterChat,
    saveSettings,
    saveSettingsDebounced,
    selectCharacterById,
    setActiveCharacter,
    setActiveGroup,
    doNewChat,
    name1,
} from '../../../../script.js';
import { getConnectedPersonas, user_avatar } from '../../../personas.js';
import { power_user } from '../../../power-user.js';
import { extension_settings } from '../../../extensions.js';
import { groups, openGroupById, openGroupChat } from '../../../group-chats.js';
import { VER, LANG, tt, pl, localize } from './lang.js';
import { LAYOUTS, fitLong } from './layouts.js';
import { SCREENS } from './screens/screens.js';

const KEY = 'slayHome';
const CACHE = 'slayhome:cache';
const BASE = new URL('.', import.meta.url).pathname;
const s = extension_settings[KEY] ??= {};
s.enabled ??= true;
s.count ??= 10;
s.layout ??= 'kino';
s.mode ??= 'one';       // 'one' — всегда s.layout; 'random' — при запуске случайная из избранного
s.favs ??= [];         // избранное человек собирает сам
s.hidden ??= [];        // 'c:<аватар>' / 'g:<группа>' — не показывать на стартовом экране
s.offThemes ??= [];     // темы, убранные из меню: их нет в настройках, в кнопке в углу и в «Сюрпризе»
s.groups ??= true;      // групповые чаты в ленте
s.btn ??= true;         // кнопка смены темы в углу стартового экрана
s.lang ??= 'auto';      // 'auto' — как в таверне, иначе код языка
s.hideBar ??= false;    // верхнее меню таверны прячется на стартовом экране, выезжает у верхнего края
s.renders ??= {}; // аватар персонажа → путь к картинке «в полный рост» в user/files (карточку не трогаем)
// Экраны-игры: готовые страницы в screens/, открываются в рамке и берут данные через window.SLAYHOME
for (const [key, title] of Object.entries(SCREENS)) {
    LAYOUTS[key] = {
        title, game: true,
        html: () => `<iframe class="sh-game" src="${BASE}screens/${key}.html?v=${VER}" title="${title}"></iframe>`,
        show() {},
        mount(root) {
            const f = root.querySelector('.sh-game');
            f.addEventListener('load', () => f.contentWindow?.focus(), { once: true });
        },
        // спрятали экран — останавливаем рамку, чтобы таймеры и анимации не крутились под чатом
        unmount(root) { const f = root.querySelector('.sh-game'); if (f) f.src = 'about:blank'; },
        key: () => true,
    };
}
// убранные из расширения темы выпадают из избранного
s.favs = s.favs.filter((k) => LAYOUTS[k]);
s.offThemes = s.offThemes.filter((k) => LAYOUTS[k]);
const shown = (k) => LAYOUTS[k] && !s.offThemes.includes(k);

let root = null;
let hoverTimer = 0, lastPick = 0;
let items = [];
let current = 0;
let appReady = false;

// Последний абзац «прозы»: без служебных блоков пресета (TIME:, META, OOC, инфоблоки, запросы картинок)
function prose(mes) {
    const text = String(mes ?? '').replace(/```[\s\S]*?```|<[^>]+>|\{\{[^}]*\}\}/g, '\n');
    const pars = text.split('\n').reverse();
    for (const par of pars) {
        const t = par.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
        if (t.length < 60 || t.includes('|') || '#-=[>\\'.includes(t[0])) continue;
        if (/^(\d+\.|[A-ZА-Я0-9 _]{2,}:)/.test(t) || /^[\p{L}\d_-]{2,24}:\S*=|^["“”«»'][\p{L}\d_-]{2,24}["“”«»']\s*:|^[a-z_-]{3,24}:\S/u.test(t)) continue;
        if (/META|OOC|CORE|INFOBLOCK|Co-author|PROMPT|P0|HTML|image/i.test(t)) continue;
        return t.length > 220 ? t.slice(0, 220).replace(/\s\S*$/, '') + '…' : t;
    }
    return '';
}

function parseTs(v) {
    const n = Number(v);
    if (isFinite(n) && n > 0) return n;
    const d = Date.parse(v);
    return isFinite(d) ? d : 0;
}

// Кто ты в этом чате: тот же порядок, что у таверны при открытии чата — привязка к чату, к персонажу, персона по умолчанию, текущая
function personaOf(chat, key) {
    const avatar = [chat.chat_metadata?.persona, ...getConnectedPersonas(key), power_user.default_persona, user_avatar].find((a) => a && a in power_user.personas);
    return { name: power_user.personas[avatar] || name1 || tt('Ты'), img: avatar ? personaUrl(avatar) : '' };
}

// Таверна по умолчанию режет миниатюры до 96×144, на большом экране они мылятся. Размер задаётся только в config.yaml
// на сервере, поэтому при маленьких миниатюрах берём оригиналы. Только для ботов на экране, остальную таверну не трогаем.
let smallThumbs = null;
const checkThumbs = () => new Promise((done) => {
    if (smallThumbs !== null || !characters[0]) return done();
    const probe = new Image();
    probe.onload = () => { smallThumbs = probe.naturalHeight < 400; done(); };
    probe.onerror = () => { smallThumbs = false; done(); };
    probe.src = getThumbnailUrl('avatar', characters[0].avatar);
});
const avatarUrl = (file) => (smallThumbs ? `/characters/${encodeURIComponent(file)}` : getThumbnailUrl('avatar', file));
const personaUrl = (file) => (smallThumbs ? `/User%20Avatars/${encodeURIComponent(file)}` : getThumbnailUrl('persona', file));

async function recentChats(body) {
    const res = await fetch('/api/chats/recent', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body),
        cache: 'no-cache',
    });
    return res.ok ? res.json() : [];
}

const chatKey = (chat) => `${chat.avatar || ''}|${chat.group || ''}|${chat.file_name}`;

// Метаданные чатов бывают по мегабайту на чат, а нужна из них только персона. Поэтому список берём без них,
// а потом просим метаданные только у чатов на экране: таверна отдаёт закреплённые сверх лимита, а лимит ставим 0.
// Чаты, закреплённые в штатном списке таверны, идут первыми, как и там. Старая таверна без закрепов это поле не читает.
function pinnedChats() {
    try { return Object.values(JSON.parse(globalThis.SillyTavern?.getContext?.().accountStorage?.getItem('pinnedChats') || '{}')); } catch { return []; }
}

async function fetchItems() {
    const data = await recentChats({ max: 60, pinned: pinnedChats() });
    await checkThumbs();
    const picked = buildItems(data);
    const pinned = picked.map(({ chat }) => ({ avatar: chat.avatar || '', group: chat.group || '', file_name: chat.file_name }));
    const meta = new Map((pinned.length ? await recentChats({ max: 0, pinned, metadata: true }) : []).map((chat) => [chatKey(chat), chat.chat_metadata]));
    return picked.map(({ item, chat, owner }) => ({ ...item, me: personaOf({ chat_metadata: meta.get(chatKey(chat)) }, owner) }));
}

function buildItems(data) {
    const seen = new Set();
    const out = [];
    // сколько чатов у персонажа среди последних (для «Ретро» и «Киберпанка»), без отдельных запросов
    const counts = {};
    for (const chat of data) { const k = chat.group ? 'g:' + chat.group : 'c:' + chat.avatar; counts[k] = (counts[k] || 0) + 1; }
    for (const chat of data) {
        const key = chat.group ? 'g:' + chat.group : 'c:' + chat.avatar;
        if (seen.has(key) || s.hidden.includes(key) || (chat.group && !s.groups)) continue;
        const ch = chat.avatar ? characters.find(x => x.avatar === chat.avatar) : null;
        const gr = chat.group ? groups.find(x => x.id === chat.group) : null;
        if (!ch && !gr) continue;
        seen.add(key);
        const avatar = ch ? ch.avatar : (gr.members?.[0] ?? '');
        const item = {
            avatar: ch ? ch.avatar : '',
            group: gr ? gr.id : '',
            // openCharacterChat/openGroupChat ждут имя без расширения, иначе создадут новый «*.jsonl.jsonl»
            file: String(chat.file_name).replace(/\.jsonl$/, ''),
            name: ch ? ch.name : gr.name,
            img: avatar ? avatarUrl(avatar) : '',
            ts: parseTs(chat.last_mes),
            msgs: chat.chat_items ?? 0,
            snip: prose(chat.mes),
            chats: counts[key],
            render: ch ? (s.renders[ch.avatar] || '') : '',
            me: null,
        };
        out.push({ item, chat, owner: ch ? ch.avatar : gr.id });
        if (out.length >= s.count) break;
    }
    return out;
}

const touch = () => matchMedia('(hover: none)').matches;
// ?slayhome=<тема> в адресе — посмотреть тему, не меняя настройку (для превью в галерее)
const PREVIEW = new URLSearchParams(location.search).get('slayhome');
// «Сюрприз»: тема выбирается один раз за запуск таверны, из избранного и не та же, что в прошлый раз
let session = null;
function pickSession() {
    const pool = s.favs.filter(shown);
    const fresh = pool.filter((k) => k !== s.lastRandom);
    const from = fresh.length ? fresh : pool;
    session = from[Math.floor(Math.random() * from.length)] ?? null;
    if (session) { s.lastRandom = session; saveSettingsDebounced(); }
}
const layoutKey = () => {
    if (PREVIEW && LAYOUTS[PREVIEW]) return PREVIEW;
    if (s.mode === 'random') { if (!session) pickSession(); if (session) return session; }
    return shown(s.layout) ? s.layout : Object.keys(LAYOUTS).find(shown) ?? 'kino';
};
const layout = () => LAYOUTS[layoutKey()];

function build() {
    root = document.createElement('div');
    root.id = 'slayhome';
    for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'wheel']) root.addEventListener(ev, wake, { passive: true });
    root.addEventListener('mousemove', e => {
        if (touch() || !layout().pointer) return;
        const i = layout().pointer(root, e, items);
        clearTimeout(hoverTimer);
        if (i === null || i === current) return;
        // не чаще раза в 90 мс: карты сменяются ровно, а выбор догоняет курсор, не перепрыгивая через весь веер
        const wait = lastPick + 90 - e.timeStamp;
        if (wait > 0) hoverTimer = setTimeout(() => { lastPick = performance.now(); show(i); }, wait);
        else { lastPick = e.timeStamp; show(i); }
    });
    root.addEventListener('mouseover', e => {
        // тап на телефоне тоже шлёт mouseover — там выбор делает click
        if (touch() || !layout().hover || layout().pointer) return;
        const c = e.target.closest('[data-i]');
        if (c && +c.dataset.i !== current) show(+c.dataset.i);
    });
    // Телефон: свайп влево/вправо листает в любой классической раскладке; клик после свайпа гасим
    let t0 = null, swiped = 0;
    root.addEventListener('touchstart', e => { const t = e.touches[0]; t0 = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
    root.addEventListener('touchend', e => {
        if (!t0 || layout().game) return;
        const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
        t0 = null;
        // по горизонтальной ленте (контакты, полароиды) свайп — это её собственная прокрутка, не листание
        for (let el = e.target; el && el !== root; el = el.parentElement) {
            if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return;
        }
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            swiped = Date.now();
            show(Math.max(0, Math.min(items.length - 1, current + (dx < 0 ? 1 : -1))));
        }
    }, { passive: true });
    root.addEventListener('click', e => {
        if (Date.now() - swiped < 450) return;
        const r = e.target.closest('[data-render]');
        if (r) return r.dataset.render === 'set' ? uploadRender(items[current]) : clearRender(items[current]);
        const a = e.target.closest('[data-act]');
        if (a) return act(a.dataset.act, items[current]);
        const n = e.target.closest('[data-nav]');
        if (n) return show(Math.max(0, Math.min(items.length - 1, current + +n.dataset.nav)));
        // Повёрнутые в 3D карты Safari на айфоне «попадает» неточно — там, где умеет, раскладка считает карту по месту тапа
        const tapped = touch() ? layout().tap?.(root, e, items) : null;
        const c = e.target.closest('[data-i]');
        if (tapped == null && !c) return;
        const i = tapped ?? layout().pointer?.(root, e, items) ?? +c.dataset.i;
        // Без наведения (телефон, карусель, переписка) первый клик выбирает, повторный открывает чат
        if (i !== current && (touch() || !layout().hover)) return show(i);
        act('continue', items[i]);
    });
    document.body.append(root);
}

// То, что раскладка может попросить у движка (меню-раскладки сами решают, что делают стрелки и Enter)
const api = {
    show: (i) => show(Math.max(0, Math.min(items.length - 1, i))),
    act: (what) => act(what, items[current]),
    get current() { return current; },
    get items() { return items; },
    // ты — второй игрок: персона выбранного чата
    get me() { return items[current]?.me ?? { name: name1 || tt('Ты'), img: user_avatar ? personaUrl(user_avatar) : '' }; },
};

// То же для экранов в рамке: они читают ботов и персону и зовут действия отсюда
window.SLAYHOME = {
    tt, pl, localize, lang: LANG,
    get items() { return items; },
    get me() { return api.me; },
    get start() { return current; },
    act(what, i) {
        if (!items[i]) return;
        current = i;
        if (what === 'png') return uploadRender(items[i]);
        act(what, items[i]);
    },
};

// PNG «в полный рост» для бота: файл кладём в user/files, в настройки — только ссылку. Карточка и аватар не меняются.
// Перед загрузкой: не выше 1600 px и в WebP с прозрачностью (браузер не умеет WebP — оставляем как есть)
async function shrink(file) {
    try {
        const bmp = await createImageBitmap(file);
        const k = Math.min(1, 1600 / bmp.height);
        const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close?.();
        const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.88));
        if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
    } catch {
        return file;
    }
}
async function uploadFile(file) {
    file = await shrink(file);
    const data = await new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = bad; fr.readAsDataURL(file); });
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const name = `slayhome-render-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const res = await fetch('/api/files/upload', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ name, data }) });
    if (!res.ok) throw new Error(await res.text());
    const { path } = await res.json();
    return '/' + String(path).replace(/^\/+/, '');
}
function uploadRender(item) {
    if (!item?.avatar) return toastr.info(tt('Для групп своя картинка пока не поддерживается'));
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/webp,image/*' });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            setRender(item, await uploadFile(file));
            toastr.success(tt`Картинка привязана к ${item.name}`);
        } catch (err) {
            console.error('[SLAYhomepage]', err);
            toastr.error(tt('Не удалось загрузить картинку, подробности в консоли'));
        }
    });
    input.click();
}
function clearRender(item) {
    if (!item?.avatar || !s.renders[item.avatar]) return;
    setRender(item, '');
    toastr.info(tt`Своя картинка у ${item.name} убрана (файл остался в user/files)`);
}
function setRender(item, url, redraw = true) {
    if (url) s.renders[item.avatar] = url; else delete s.renders[item.avatar];
    saveSettingsDebounced();
    items.forEach((x) => { if (x.avatar === item.avatar) x.render = url; });
    try { localStorage.setItem(CACHE, JSON.stringify(items)); } catch {}
    if (redraw) { const keep = current; render(); show(keep); }
}
let mounted = null;
function unmount() { mounted?.unmount?.(root, api); mounted = null; if (root) clearInterval(root._tm); clearTimeout(napTimer); clearTimeout(hoverTimer); }

// Реальный низ верхней панели таверны: тема может сделать её выше стандартной переменной
// у верхнего края — невидимая полоска: навёл мышь (или тапнул) — меню выехало
// Меню видно, пока указатель у верхнего края или на самом меню, или открыта его панель: тогда у body класс slayhome-bar.
// Раньше это решало правило body:has(…) в стилях, но из-за него браузер заново считал стили всей страницы таверны
// при каждом изменении на экране (смена бота, печать текста).
const BAR_ZONE = '#slayhome-barzone, #top-bar, #top-settings-holder';
let barWatch = null;
function applyBar() {
    document.body.classList.toggle('slayhome-nobar', !!s.hideBar);
    if (!s.hideBar || barWatch) return;
    document.body.insertAdjacentHTML('beforeend', '<div id="slayhome-barzone"></div>');
    const holder = document.getElementById('top-settings-holder');
    let over = false, drawer = false;
    const update = () => document.body.classList.toggle('slayhome-bar', over || drawer);
    document.addEventListener('pointerover', (e) => { const now = !!e.target.closest?.(BAR_ZONE); if (now !== over) { over = now; update(); } }, { passive: true });
    // мышь ушла за окно; у пальца «наведение» держится до следующего тапа, как :hover на телефоне
    document.documentElement.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && over) { over = false; update(); } });
    barWatch = new MutationObserver(() => { const now = !!holder.querySelector('.openDrawer'); if (now !== drawer) { drawer = now; update(); } });
    if (holder) { barWatch.observe(holder, { subtree: true, attributes: true, attributeFilter: ['class'] }); drawer = !!holder.querySelector('.openDrawer'); }
    update();
}

function measureTop() {
    if (s.hideBar) return root?.style.setProperty('--sh-top', '0px');
    const bottoms = ['top-bar', 'top-settings-holder'].map((id) => document.getElementById(id)?.getBoundingClientRect().bottom || 0);
    root?.style.setProperty('--sh-top', Math.round(Math.max(...bottoms)) + 'px');
}

// Шрифты подключаем отдельно и только когда экран показан: таверна не ждёт Google и не тянет их, если экран выключен
const FONTS = 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500&family=Unbounded:wght@800&family=JetBrains+Mono:wght@400;600&family=Literata:ital,opsz,wght@1,7..72,400&family=Onest:wght@400;500;700&family=Spectral:ital,wght@0,300;1,300&family=IBM+Plex+Mono:wght@400;500&family=Inter+Tight:wght@800;900&family=Tektur:wght@500;700;800&family=Exo+2:wght@500&family=Tiny5&family=Press+Start+2P&family=Nunito:wght@600;700;800;900&display=swap';
let fontsAdded = false;
function loadFonts() {
    if (fontsAdded) return;
    fontsAdded = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS;
    document.fonts?.addEventListener?.('loadingdone', () => { if (root?.childElementCount && document.body.classList.contains('slayhome-on')) { fitLong(root); fitName(); } });
    document.head.append(link);
}

function render() {
    loadFonts();
    if (!root) build();
    applyBar();
    measureTop();
    unmount();
    root.className = 'sh-l-' + layoutKey();
    root.classList.toggle('sh-empty', !items.length);
    root.innerHTML = items.length ? layout().html(items) : '';
    if (items.length) { mounted = layout(); mounted.mount?.(root, api); }
    if (s.btn && items.length) themePill();
    root._napped = false;
    wake();
    show(Math.min(current, Math.max(items.length - 1, 0)));
}

// Бережём батарею: через 20 секунд без касаний бесконечные анимации и сцена фермы встают на паузу
let napTimer = 0;
const forever = (a) => a.effect?.getTiming().iterations === Infinity;
function wake() {
    clearTimeout(napTimer);
    if (!root || !document.body.classList.contains('slayhome-on')) return;
    if (root._napped) {
        root.getAnimations({ subtree: true }).forEach((a) => forever(a) && a.playState === 'paused' && a.play());
        root._scene?.start();
        if (root._glitch) root._gt = setInterval(root._glitch, 4200);
        root._napped = false;
    }
    napTimer = setTimeout(() => {
        if (!root || layout().game) return;
        root.getAnimations({ subtree: true }).forEach((a) => forever(a) && a.pause());
        root._scene?.stop();
        clearInterval(root._gt);
        root._napped = true;
    }, 20000);
}

// Маленькая кнопка в углу: ‹ › листают темы прямо тут, по названию — открыть настройки
function themePill() {
    const favs = s.favs.filter(shown);
    const order = s.mode === 'random' && favs.length > 1 ? favs : Object.keys(LAYOUTS).filter(shown);
    const k = layoutKey();
    const pill = document.createElement('div');
    pill.className = 'sh-pill';
    pill.innerHTML = `<button data-d="-1" title="${tt("Предыдущая тема")}">‹</button><button class="sh-pill-t" title="${tt("Настройки стартового экрана")}">◐<span> ${LAYOUTS[k].title}</span></button><button data-d="1" title="${tt("Следующая тема")}">›</button>`;
    pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = e.target.closest('[data-d]');
        if (!d) return openStudio();
        const next = order[(order.indexOf(k) + +d.dataset.d + order.length) % order.length];
        // в «сюрпризе» листаем только этот запуск; в «одной теме» — запоминаем выбор
        if (s.mode === 'random') session = next; else { s.layout = next; saveSettingsDebounced(); }
        current = 0; render();
    });
    root.append(pill);
}

function show(i) {
    if (!items[i] || !root) return;
    current = i;
    layout().show(root, i, items);
    fitLong(root);
    fitName();
}

// Имя — не больше двух строк и без переноса посреди слова: уменьшаем кегль, пока не влезет
function fitName() {
    const el = root?.querySelector('.sh-name');
    if (!el || !el.clientWidth) return;
    let size = innerWidth <= 1000 ? Math.min(56, innerWidth * 0.13) : Math.min(96, innerWidth * 0.056);
    const fits = () => el.scrollWidth <= el.clientWidth + 1 && el.offsetHeight <= size * 0.95 * 2 + 4;
    el.style.fontSize = size + 'px';
    while (size > 26 && !fits()) {
        size -= 3;
        el.style.fontSize = size + 'px';
    }
}

async function act(what, c) {
    if (!c || !appReady) return;
    // «Все чаты» чат не открывает: показываем список таверны прямо на главной. Нет списка (старая таверна или он свёрнут) — как раньше
    if (what === 'all' && showTavernList(c)) return;
    try {
        if (c.group) {
            await openGroupById(c.group);
            setActiveGroup(c.group);
            if (what === 'continue' && getCurrentChatId() !== c.file) await openGroupChat(c.group, c.file);
        } else {
            const id = characters.findIndex(x => x.avatar === c.avatar);
            if (id === -1) return;
            await selectCharacterById(id);
            setActiveCharacter(c.avatar);
            if (what === 'continue' && getCurrentChatId() !== c.file) await openCharacterChat(c.file);
        }
        saveSettingsDebounced();
        if (what === 'new') await doNewChat();
        if (what === 'all') document.getElementById('option_select_chat')?.click(); // запасной путь без списка таверны
    } catch (err) {
        console.error('[SLAYhomepage]', err);
        toastr.error(tt('Не удалось открыть чат, подробности в консоли'));
    }
}

// «Все чаты»: убираем свой экран и показываем штатный список недавних чатов таверны. Там её собственные кнопки:
// закрепить, переименовать, удалить. Кнопка «Стартовый экран» возвращает обратно.
let peek = false;
function showTavernList(c) {
    const panel = document.querySelector('#chat .welcomePanel');
    const rows = [...(panel?.querySelectorAll('.recentChat') ?? [])];
    if (!rows.some((el) => el.offsetParent || el.classList.contains('hidden'))) return false;
    peek = true;
    setVisible(false);
    document.body.classList.add('slayhome-peek');
    // таверна показывает три чата: раскрываем список целиком и подсвечиваем чаты выбранного бота
    const more = panel.querySelector('.showMoreChats');
    if (more && !more.classList.contains('rotated') && panel.querySelector('.recentChat.hidden')) more.click();
    const mine = rows.filter((el) => (c.group ? el.dataset.group === c.group : el.dataset.avatar === c.avatar));
    rows.forEach((el) => el.classList.toggle('slayhome-mine', mine.includes(el)));
    mine[0]?.scrollIntoView({ block: 'center' });
    if (!document.getElementById('slayhome-back')) {
        const back = document.createElement('button');
        back.id = 'slayhome-back';
        back.type = 'button';
        back.textContent = tt('‹ Стартовый экран');
        back.addEventListener('click', () => { endPeek(); refresh(); });
        document.body.append(back);
    }
    placeBack();
    return true;
}
// Кнопка висит по центру колонки чата над полем ввода: шапку списка и боковые панели таверны она не закрывает
function placeBack() {
    const back = document.getElementById('slayhome-back'), box = document.getElementById('sheld')?.getBoundingClientRect();
    if (!back || !box?.width) return;
    back.style.left = Math.round(box.left + box.width / 2) + 'px';
    const form = document.getElementById('form_sheld')?.getBoundingClientRect();
    // в мобильной раскладке таверны у fixed-слоёв контейнер нулевой высоты, bottom там не работает: считаем top
    if (form?.height) back.style.top = Math.round(form.top - (back.offsetHeight || 32) - 10) + 'px';
}
function endPeek() {
    peek = false;
    document.body.classList.remove('slayhome-peek');
}

function setVisible(on) {
    document.body.classList.toggle('slayhome-on', on);
    // таймеры и анимации раскладки не крутятся под открытым чатом, картинки не держатся в памяти
    if (!on) { unmount(); if (root) root.innerHTML = ''; }
}

// redraw: настройки поменялись (тема, кнопка, кол-во) — перерисовать, даже если боты те же
async function refresh(redraw = false) {
    if (!s.enabled || getCurrentChatId() !== undefined) return setVisible(false);
    setVisible(true);
    if (!root) build();
    try {
        const fresh = await fetchItems();
        if (getCurrentChatId() !== undefined) return setVisible(false);
        const same = !redraw && JSON.stringify(fresh) === JSON.stringify(items) && root?.childElementCount;
        items = fresh;
        if (same) return; // экран уже нарисован этими же данными — не грузим его второй раз
        current = 0;
        render();
        localStorage.setItem(CACHE, JSON.stringify(items));
    } catch (err) {
        console.error('[SLAYhomepage]', err);
        if (!root?.childElementCount) render(); // сервер не ответил — показываем то, что помним
    }
}

// Мгновенный первый кадр — из кэша прошлого запуска, пока таверна грузит персонажей
try { items = JSON.parse(localStorage.getItem(CACHE) || '[]'); } catch { items = []; }
if (s.enabled && items.length) { setVisible(true); render(); }

document.fonts?.ready.then(fitName);
// При повороте телефона и когда прячется адресная строка resize приходит пачкой: перерисовываем один раз, когда окно успокоилось
let resizeTimer = 0;
window.addEventListener('resize', () => {
    if (peek) placeBack();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!document.body.classList.contains('slayhome-on')) return; measureTop(); if (items[current]) show(current); }, 150);
});
window.addEventListener('keydown', e => {
    if (!document.body.classList.contains('slayhome-on') || e.target.closest?.('input, textarea, [contenteditable]')) return;
    if (!items[current]) return;
    if (layout().key?.(e.key, root, api)) return e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') show(Math.max(0, Math.min(items.length - 1, current + (e.key === 'ArrowLeft' ? -1 : 1))));
    if (e.key === 'Enter' && items[current]) act('continue', items[current]);
});

eventSource.once(event_types.APP_READY, () => { appReady = true; refresh(); });
eventSource.on(event_types.CHAT_CHANGED, () => {
    if (!appReady) return;
    if (getCurrentChatId() !== undefined) { endPeek(); return setVisible(false); }
    if (!peek) refresh(); // пока открыт список таверны, свой экран не возвращаем: его вернёт кнопка
});

// Студия настроек: своя страница в рамке поверх таверны (стили таверны её не трогают)
let studio = null;
const langAtStart = s.lang;
function openStudio() {
    if (studio) return;
    studio = document.createElement('div');
    studio.id = 'slayhome-studio';
    studio.innerHTML = `<iframe src="${BASE}studio.html?v=${VER}" title="${tt("Стартовый экран — настройки")}"></iframe>`;
    document.body.append(studio);
    document.body.classList.add('slayhome-studio-on'); // стартовый экран под студией не виден — не рисуем его
    studio.querySelector('iframe').addEventListener('load', (e) => e.target.contentWindow?.focus(), { once: true });
}
let studioChanged = false;
function closeStudio() {
    studio?.remove(); studio = null;
    if (s.lang !== langAtStart) return saveSettings().then(() => location.reload()); // язык подхватывается только при загрузке
    document.body.classList.remove('slayhome-studio-on');
    if (appReady) refresh(studioChanged);
    studioChanged = false;
}
window.SLAYHOME_STUDIO = {
    tt, pl, localize, lang: LANG,
    base: BASE,
    get themes() { return Object.entries(LAYOUTS).map(([key, l]) => ({ key, title: l.title, game: !!l.game })); },
    get state() { return { enabled: s.enabled, mode: s.mode, layout: s.layout, favs: [...s.favs], hidden: [...s.hidden], offThemes: [...s.offThemes], count: s.count, groups: s.groups, btn: s.btn, hideBar: s.hideBar, lang: s.lang }; },
    set(patch) {
        Object.assign(s, patch);
        if ('mode' in patch || 'favs' in patch || (session && !shown(session))) session = null;
        saveSettingsDebounced();
        onBox.checked = s.enabled;
        studioChanged = true;
    },
    // все боты: сначала из недавних чатов, потом остальные по алфавиту
    bots() {
        const recent = items.filter((x) => x.avatar).map((x) => x.avatar);
        const list = characters.map((c) => ({ avatar: c.avatar, name: c.name, img: getThumbnailUrl('avatar', c.avatar), full: avatarUrl(c.avatar), render: s.renders[c.avatar] || '', recent: recent.indexOf(c.avatar) }));
        return list.sort((a, b) => ((a.recent < 0) - (b.recent < 0)) || (a.recent - b.recent) || a.name.localeCompare(b.name));
    },
    groupsList: () => groups.map((g) => ({ key: 'g:' + g.id, name: g.name })),
    async upload(avatar, file) { const url = await uploadFile(file); this.setRender(avatar, url); return url; },
    setRender(avatar, url) { setRender({ avatar }, url, false); studioChanged = true; },
    close: closeStudio,
};

const panel = document.createElement('div');
panel.className = 'slayhome-settings';
panel.innerHTML = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>SLAYhomepage</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label class="checkbox_label"><input type="checkbox" class="sh-set-on"> ${tt("Показывать вместо пустого экрана")}</label>
            <div class="menu_button sh-set-open" style="width:auto;margin-top:6px">${tt("Темы, картинки и остальное…")}</div>
        </div>
    </div>`;
document.getElementById('extensions_settings2')?.append(panel);
const onBox = panel.querySelector('.sh-set-on');
onBox.checked = s.enabled;
onBox.addEventListener('change', () => { s.enabled = onBox.checked; saveSettingsDebounced(); appReady && refresh(); });
panel.querySelector('.sh-set-open').addEventListener('click', openStudio);
