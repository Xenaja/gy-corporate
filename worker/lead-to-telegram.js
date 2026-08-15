/**
 * Приёмник заявок с лендинга -> сообщение в Telegram.
 *
 * Зачем прослойка: GitHub Pages отдаёт статику, а токен бота нельзя класть
 * в site.js — он был бы виден всем и любой смог бы писать от имени бота.
 * Токен живёт в секретах воркера, страница знает только его адрес.
 *
 * Переменные (Cloudflare → Worker → Settings → Variables and Secrets):
 *   TG_TOKEN    — токен бота от @BotFather. Годится и уже работающий бот:
 *                 у «Кочевника» тем же способом живёт @ansamble_leads_bot.
 *   TG_CHAT_ID  — куда слать. Личка — свой id (@userinfobot подскажет),
 *                 группа — её id с минусом.
 *
 * Деплой (один раз):
 *   cd worker && npx wrangler deploy      # имя и main берутся из wrangler.toml
 *   затем в Dashboard добавить TG_TOKEN и TG_CHAT_ID
 *   и вписать адрес воркера в LEAD_ENDPOINT в assets/js/site.js.
 *
 * Две грабли, обе уже стоили времени на «Кочевнике»:
 *   — в личку бот пишет только после того, как получатель нажал ему /start;
 *   — хвостовой пробел в имени переменной = воркер её не найдёт и будет
 *     молча отдавать 502.
 */

// Человеческие названия форм: в телефоне важно с первой строки понять,
// откуда заявка, а не расшифровывать «agency-magnet».
const FORMS = {
  "manager": "Связаться с менеджером",
  "hr-lead": "Забота о команде — заявка",
  "pr-lead": "Событие для гостей — заявка",
  "agency-lead": "Агентство — запрос",
  "pr-magnet": "Гайд «7 идей» — запрос",
  "agency-magnet": "Каталог для агентств — запрос",
};

const FIELDS = [
  ["name", "Имя"],
  ["company", "Компания"],
  ["contact", "Связь"],
  ["about", "Задача"],
  ["size", "Размер команды"],
  ["guests", "Гостей"],
  ["project", "Проект"],
];

const META = [
  ["utm_source", "utm_source"],
  ["utm_campaign", "utm_campaign"],
  ["ref_id", "id"],
];

const LIMIT = 400; // на поле: заявка, а не письмо счастья

export default {
  async fetch(request, env) {
    /* ALLOW_ORIGIN — список через запятую: у сайта их два (свой домен и старый
       адрес Pages, который редиректит на него). Отдавать нужно ровно тот,
       с которого пришёл запрос: браузер сверяет заголовок со своим Origin
       посимвольно, и «почти совпадает» для него равно «запрещено».
       Один адрес в переменной тоже работает — это частный случай списка. */
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.length
        ? (allowed.includes(origin) ? origin : allowed[0])
        : "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ ok: false, error: "method" }, 405, cors);

    let data;
    try {
      data = await request.json();
    } catch {
      return reply({ ok: false, error: "json" }, 400, cors);
    }

    // Ловушка для ботов: поле спрятано от людей, значит заполнил не человек.
    // Отвечаем «ок», чтобы спамер не понял, что его отсеяли.
    if (data.website) return reply({ ok: true }, 200, cors);

    const contact = clean(data.contact);
    if (!contact) return reply({ ok: false, error: "contact" }, 400, cors);
    if (!data.consent) return reply({ ok: false, error: "consent" }, 400, cors);

    const form = clean(data.form);
    const lines = [`<b>GY для бизнеса</b> · ${esc(FORMS[form] || form || "форма")}`];
    for (const [key, label] of FIELDS) {
      const v = clean(data[key]);
      if (v) lines.push(`${label}: <b>${esc(v)}</b>`);
    }
    const meta = META.map(([k, l]) => (clean(data[k]) ? `${l}=${esc(clean(data[k]))}` : "")).filter(Boolean);
    if (meta.length) lines.push(`\n<i>${meta.join(" · ")}</i>`);
    if (clean(data.page)) lines.push(`<i>страница: ${esc(clean(data.page))}</i>`);

    const tg = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!tg.ok) return reply({ ok: false, error: "telegram" }, 502, cors);
    return reply({ ok: true }, 200, cors);
  },
};

function clean(v) {
  return typeof v === "string" ? v.trim().slice(0, LIMIT) : "";
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
