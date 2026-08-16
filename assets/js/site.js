/* Generation Yoga — корпоративное направление. Поведение прототипа. */
(function () {
  "use strict";

  /* ---- 1. Scroll reveal (+ активирует линию горизонта) ---------------- */
  /* Двойная страховка: IntersectionObserver даёт плавную анимацию, а
     проверка позиции на scroll работает даже там, где IO молчит
     (фоновые вкладки, offscreen-iframe). Обе идемпотентно зовут show().
     Контент не должен оставаться скрытым ни при каком раскладе. */
  var reveals = [].slice.call(document.querySelectorAll(".reveal, .is-observe"));
  function show(el) { el.classList.add("is-visible"); }

  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  var ticking = false;
  function sweep() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = reveals.length - 1; i >= 0; i--) {
      var el = reveals[i];
      if (el.classList.contains("is-visible")) { reveals.splice(i, 1); continue; }
      var r = el.getBoundingClientRect();
      // проявляем, как только элемент показался снизу (top вошёл во вьюпорт)
      if (r.top < vh - 40 && r.bottom > 0) { show(el); if (io) io.unobserve(el); reveals.splice(i, 1); }
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("load", sweep);
  sweep(); // раскрыть то, что уже в вьюпорте на старте

  /* ---- 2. Мобильное меню ---------------------------------------------- */
  var burger = document.querySelector(".burger");
  var nav = document.querySelector(".aud-nav");
  if (burger && nav) {
    function setNav(open) {
      nav.classList.toggle("open", open);
      /* Класс на body тянет за собой две вещи из CSS: затемнение фона и
         блокировку прокрутки. Без второй страница едет под открытым меню,
         и человек теряет место, на котором читал. */
      document.body.classList.toggle("nav-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    burger.addEventListener("click", function () {
      setNav(!nav.classList.contains("open"));
    });

    // Выйти из меню, не выбирая пункт: тап по затемнению или Esc.
    document.addEventListener("click", function (ev) {
      if (!nav.classList.contains("open")) return;
      if (nav.contains(ev.target) || burger.contains(ev.target)) return;
      setNav(false);
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && nav.classList.contains("open")) setNav(false);
    });
    // Переход по пункту меню — тоже закрытие: якорные ссылки ведут на ту же
    // страницу, и меню осталось бы висеть поверх нужного блока.
    nav.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) setNav(false);
    });
  }

  /* ---- 3. UTM + персональный id: захват и проброс --------------------- */
  /* Структура T.1: каждому каналу своя ссылка, id агентства в метке.
     Складываем в память вкладки и подставляем в скрытые поля форм. */
  var params = new URLSearchParams(location.search);
  var TRACK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "id", "ref"];
  var lead = {};
  try { lead = JSON.parse(sessionStorage.getItem("gy_lead") || "{}"); } catch (e) { lead = {}; }
  TRACK_KEYS.forEach(function (k) {
    var v = params.get(k);
    if (v) lead[k] = v;
  });
  try { sessionStorage.setItem("gy_lead", JSON.stringify(lead)); } catch (e) {}

  document.querySelectorAll('input[data-track]').forEach(function (input) {
    var key = input.getAttribute("data-track");
    if (lead[key]) input.value = lead[key];
  });

  /* ---- 4. Трекинг событий (заглушка под будущую CRM, структура T.2) ---- */
  function emit(name, detail) {
    var payload = Object.assign({ event: name, page: location.pathname, ts: Date.now() }, lead, detail || {});
    // Заглушка: в проде — отправка в CRM/Метрику. Пока — консоль + dataLayer.
    (window.dataLayer = window.dataLayer || []).push(payload);
    if (window.console) console.debug("[gy-track]", name, payload);
  }
  emit("page_view");

  document.querySelectorAll("[data-cta]").forEach(function (el) {
    el.addEventListener("click", function () {
      emit("cta_click", { cta: el.getAttribute("data-cta") });
    });
  });

  // Скролл до блока цен — повышает «температуру» лида
  var pricing = document.querySelector("[data-track-view='pricing']");
  if (pricing && "IntersectionObserver" in window) {
    var pio = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { emit("view_pricing"); pio.disconnect(); }
      });
    }, { threshold: 0.4 });
    pio.observe(pricing);
  }

  /* ---- 5. Модальное окно заявки --------------------------------------- */
  /* Нативный <dialog>: Esc, подложку и возврат фокуса делает браузер.
     Наше дело — открыть, закрыть по клику мимо окна и вернуть фокус кнопке. */
  var lastOpener = null;

  document.querySelectorAll("[data-modal-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dlg = document.getElementById(btn.getAttribute("data-modal-open"));
      if (!dlg) return;
      lastOpener = btn;
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      emit("modal_open", { modal: dlg.id });
      var first = dlg.querySelector("input:not([type=hidden]):not([tabindex='-1'])");
      if (first) first.focus();
    });
  });

  document.querySelectorAll("dialog.modal").forEach(function (dlg) {
    dlg.querySelectorAll("[data-modal-close]").forEach(function (x) {
      x.addEventListener("click", function () { dlg.close(); });
    });
    // Клик по подложке приходит на сам dialog: тело окна свои клики забирает.
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", function () { if (lastOpener) lastOpener.focus(); });
  });

  /* ---- 6. Заявка -> Telegram через воркер ------------------------------ */
  /* Адрес прослойки (код — в worker/lead-to-telegram.js). Токен бота лежит
     в её секретах и на страницу не попадает, поэтому светить адрес не страшно:
     воркер принимает только POST и только с нашего домена.
     Если очистить строку, форма вернётся в демо-режим прототипа. */
  var LEAD_ENDPOINT = "https://gy-lead-to-telegram.xenonline77.workers.dev";

  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    var errBox = form.querySelector(".form-error");
    var okBox = form.querySelector(".form-ok");
    var fields = form.querySelector(".form-fields");
    var submit = form.querySelector("button[type=submit]");

    // Плашку «демо-режим» показываем только пока отправка действительно фиктивная.
    if (LEAD_ENDPOINT && okBox) {
      okBox.querySelectorAll(".pill-note").forEach(function (n) { n.remove(); });
    }

    function showOk() {
      emit("form_submit", { form: form.getAttribute("data-lead") });
      if (fields) fields.style.display = "none";
      if (okBox) { okBox.classList.add("show"); okBox.setAttribute("tabindex", "-1"); okBox.focus(); }
    }

    /* Браузерное «Введите данные в требуемом формате» не объясняет ничего.
       Подменяем текст на человеческий из data-error и сбрасываем его при
       вводе — иначе поле остаётся «невалидным» после исправления. */
    form.querySelectorAll("[data-error]").forEach(function (el) {
      el.addEventListener("invalid", function () {
        el.setCustomValidity(el.getAttribute("data-error"));
      });
      el.addEventListener("input", function () { el.setCustomValidity(""); });
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (errBox) errBox.textContent = "";
      /* Сбрасываем прошлые сообщения перед проверкой: поле с непустым
         customValidity считается невалидным навсегда, даже когда в нём уже
         всё исправлено. Нужный текст поставит обработчик invalid ниже. */
      form.querySelectorAll("[data-error]").forEach(function (el) { el.setCustomValidity(""); });
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var payload = { form: form.getAttribute("data-lead"), page: location.pathname };
      new FormData(form).forEach(function (v, k) { payload[k] = v; });

      if (!LEAD_ENDPOINT) { showOk(); return; }

      var label = submit ? submit.textContent : "";
      if (submit) { submit.disabled = true; submit.textContent = "Отправляем…"; }

      fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        showOk();
      }).catch(function () {
        if (errBox) errBox.textContent = "Не получилось отправить — проверьте связь и попробуйте ещё раз.";
        if (submit) { submit.disabled = false; submit.textContent = label; }
      });
    });
  });

  /* ---- 7. Хедер меняет фон при скролле над тёмным героем -------------- */
  var header = document.querySelector(".site-header[data-hero-dark]");
  if (header) {
    var hero = document.querySelector(".hero");
    var threshold = hero ? hero.offsetHeight - 90 : 400;
    var onScroll = function () {
      if (window.scrollY > threshold) header.classList.remove("on-ink");
      else header.classList.add("on-ink");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
