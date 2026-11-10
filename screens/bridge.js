// Мост: экран-игра живёт в рамке (iframe) и берёт у SLAYhomepage в окне таверны настоящих ботов, персону и действия
const SH = parent.SLAYHOME;
const tt = SH.tt, PL = SH.pl, LANG = SH.lang;
SH.localize(document);
const CHARS = SH.items.map((c) => ({ name: c.name, img: c.img, chats: c.chats, last: c.ts, msgs: c.msgs, snip: c.snip, render: c.render, pin: !!c.pin }));
const ME = SH.me;
// ты в чате с i-м ботом: у разных чатов может быть разная персона
const meOf = (i) => SH.items[i]?.me ?? ME;
const START = Math.min(SH.start || 0, Math.max(0, CHARS.length - 1));
// отступ сверху задаёт сама рамка — внутри экрана он не нужен
document.documentElement.style.setProperty('--top', '0px');
document.documentElement.style.setProperty('--topBarBlockSize', '0px');

// Бережём батарею: на телефоне декоративных частиц не больше десятка одного вида,
// а через 20 секунд без касаний бесконечные анимации засыпают (просыпаются от любого касания/мыши/клавиши)
addEventListener('load', () => {
    const forever = (a) => a.effect?.getTiming().iterations === Infinity;
    if (matchMedia('(hover: none), (max-width: 760px)').matches) {
        setTimeout(() => {
            const byName = {};
            for (const a of document.getAnimations()) if (forever(a) && a.effect.target) (byName[a.animationName] ??= new Set()).add(a.effect.target);
            for (const set of Object.values(byName)) {
                if (set.size <= 12) continue;
                const step = Math.ceil(set.size / 10);
                [...set].forEach((el, i) => { if (i % step) el.remove(); });
            }
        }, 300);
    }
    let timer = 0;
    const sleep = () => document.getAnimations().forEach((a) => forever(a) && a.playState === 'running' && a.pause());
    const wake = () => {
        clearTimeout(timer);
        document.getAnimations().forEach((a) => forever(a) && a.playState === 'paused' && a.play());
        timer = setTimeout(sleep, 20000);
    };
    for (const e of ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel']) addEventListener(e, wake, { passive: true });
    wake();
});

// Шрифты приходят в фоне: когда они загрузились, экран пересчитывает всё, что зависит от ширины текста
document.fonts?.addEventListener?.('loadingdone', () => dispatchEvent(new Event('resize')));

// Закреплённый в таверне чат: значок-кнопка у имени выбранного и уголок на его миниатюре в списке, как в штатном списке таверны.
// Шрифт значков берём у таверны и грузим, только если значок правда нужен.
const PIN_NAME = { sf6: '.nm', gta: '.nm', cult: '.nm', otome: '.nm', danganronpa: '.nm', genshin: '.name', ow: '.big', persona: '.name', hollow: '.entry h2', disco: '.sheet h1', pokemon: '.nm h1', valorant: '.nm', lis: '.cap', acnh: '.tag', ddlc: '.tag', pipboy: '.cap', sims: '.fname', mk: '.mk-n1' };
// в Pip-Boy список текстовый: значок встаёт после имени, а не уголком поверх букв (перед именем — курсор темы)
const PIN_EXTRA = { pipboy: '.row.sh-pinned::after{position:static;display:inline-block;width:auto;height:auto;background:none;color:inherit;-webkit-text-fill-color:currentColor;font-size:.8em;margin-left:8px}' };
addEventListener('DOMContentLoaded', () => {
    if (!CHARS.some((c) => c.pin)) return;
    const name = PIN_NAME[location.pathname.split('/').pop().replace('.html', '')];
    const st = document.createElement('style');
    st.textContent = `@font-face{font-family:shpin;src:url(/webfonts/fa-solid-900.woff2) format('woff2');font-display:block}
html.sh-pin ${name || '#none'}::before{content:'\\f08d';font:900 .42em/1 shpin;display:inline-block;vertical-align:.55em;margin-right:.45em;rotate:30deg;opacity:.85;background:inherit;-webkit-background-clip:text;background-clip:text}
.sh-pinned:not(img)::after{content:'\\f08d';font:900 10px/1 shpin;position:absolute;top:3px;left:3px;z-index:3;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#000a;color:#fff;rotate:30deg;pointer-events:none;-webkit-text-fill-color:#fff}`;
    st.textContent += PIN_EXTRA[location.pathname.split('/').pop().replace('.html', '')] || '';
    document.head.append(st);
    const now = () => (typeof cur !== 'undefined' ? cur : typeof current !== 'undefined' ? current : -1);
    const mark = () => {
        document.documentElement.classList.toggle('sh-pin', !!CHARS[now()]?.pin);
        for (const el of document.querySelectorAll('[data-i]')) {
            const on = !!CHARS[+el.dataset.i]?.pin;
            el.classList.toggle('sh-pinned', on);
            if (on && el.tagName !== 'IMG' && getComputedStyle(el).position === 'static') el.style.position = 'relative';
        }
    };
    // каждый экран выбирает бота своей функцией show(): после неё обновляем значок
    if (typeof window.show === 'function') {
        const orig = window.show;
        window.show = function (...a) { const r = orig.apply(this, a); mark(); return r; };
    }
    mark();
});
