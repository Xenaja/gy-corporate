/**
 * Приёмник заявок с лендинга -> сообщение в Telegram.
 *
 * Зачем прослойка: GitHub Pages отдаёт статику, а токен бота нельзя класть
 * в site.js — он был бы виден всем и любой смог бы писать от имени бота.
 * Токен живёт в секретах воркера, страница знает только его адрес.
 *
 * Деплой (один раз):
 *   1. Создать бота у @BotFather, забрать токен.
 *   2. Узнать chat_id: написать боту, открыть
 *      https://api.telegram.org/bot<ТОКЕН>/getUpdates и взять message.chat.id.
 *      Для группы — добавить бота в неё и взять id группы (он с минусом).
 *   3. npx wrangler deploy  (wrangler.toml лежит рядом)
 *   4. npx wrangler secret put BOT_TOKEN
 *      npx wrangler secret put CHAT_ID
 *   5. Полученный URL вписать в LEAD_ENDPOINT в assets/js/site.js.
 */

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
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
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

    const lines = [`<b>Заявка с лендинга</b> · ${esc(clean(data.form) || "форма")}`];
    for (const [key, label] of FIELDS) {
      const v = clean(data[key]);
      if (v) lines.push(`${label}: <b>${esc(v)}</b>`);
    }
    const meta = META.map(([k, l]) => (clean(data[k]) ? `${l}=${esc(clean(data[k]))}` : "")).filter(Boolean);
    if (meta.length) lines.push(`\n<i>${meta.join(" · ")}</i>`);
    if (clean(data.page)) lines.push(`<i>страница: ${esc(clean(data.page))}</i>`);

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
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
