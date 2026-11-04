// Мост: экран-игра живёт в рамке (iframe) и берёт у SLAYhomepage в окне таверны настоящих ботов, персону и действия
const SH = parent.SLAYHOME;
const tt = SH.tt, PL = SH.pl, LANG = SH.lang;
SH.localize(document);
const CHARS = SH.items.map((c) => ({ name: c.name, img: c.img, chats: c.chats, last: c.ts, msgs: c.msgs, snip: c.snip, render: c.render }));
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
