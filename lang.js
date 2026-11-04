// Язык интерфейса. Ключи словаря — русские строки: русский работает без словаря, остальные языки лежат в lang/<код>.json
import { extension_settings } from '../../../extensions.js';
import { getCurrentLocale } from '../../../i18n.js';

export const VER = '1.0.2'; // меняется — экраны в рамке и словарь грузятся заново, а не из кэша браузера

// 'auto' — как в таверне: русский для русской таверны, для всех остальных английский
const want = extension_settings.slayHome?.lang || 'auto';
export const LANG = want !== 'auto' ? want : String(getCurrentLocale()).startsWith('ru') ? 'ru' : 'en';
export const LOCALE = LANG === 'ru' ? 'ru-RU' : 'en-US';

const dict = LANG === 'ru' ? {} : await fetch(new URL(`lang/${LANG}.json?v=${VER}`, import.meta.url))
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));

// tt('Текст') или tt`Текст ${x}`: подстановки в словаре записаны как ${0}, ${1}
export function tt(s, ...v) {
    const key = typeof s === 'string' ? s : s.reduce((a, x, i) => a + x + (i < v.length ? `\${${i}}` : ''), '');
    return (dict[key] ?? key).replace(/\$\{(\d+)\}/g, (m, i) => v[i]);
}

// pl(5, 'чат', 'чата', 'чатов'): в словаре ключ «чат|чата|чатов», значение «chat|chats»
export function pl(n, one, few, many) {
    const forms = dict[`${one}|${few}|${many}`]?.split('|');
    if (forms) return n === 1 ? forms[0] : forms[1];
    return n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;
}

// Переводит готовую страницу: текст в разметке, подсказки и надписи из CSS (content)
export function localize(doc) {
    doc.documentElement.lang = LANG;
    if (LANG === 'ru') return;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (['SCRIPT', 'STYLE'].includes(n.parentNode.nodeName)) continue;
        const key = n.nodeValue.trim().replace(/\s+/g, ' ');
        if (dict[key]) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), dict[key]);
    }
    for (const attr of ['title', 'placeholder', 'alt', 'aria-label']) {
        for (const el of doc.querySelectorAll(`[${attr}]`)) {
            const value = dict[el.getAttribute(attr)];
            if (value) el.setAttribute(attr, value);
        }
    }
    const rules = (list) => {
        for (const r of list) {
            if (r.cssRules) rules(r.cssRules);
            const key = r.style?.content?.slice(1, -1);
            if (key && dict[key]) r.style.content = JSON.stringify(dict[key]);
        }
    };
    for (const sheet of doc.styleSheets) {
        try { rules(sheet.cssRules); } catch { /* чужие таблицы стилей (шрифты) не читаются */ }
    }
}
