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
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
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

  /* ---- 5. Формы: заглушка отправки ------------------------------------ */
  document.querySelectorAll("form[data-stub]").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      emit("form_submit", { form: form.getAttribute("data-stub") });
      var ok = form.querySelector(".form-ok");
      var fields = form.querySelector(".form-fields");
      if (ok) {
        ok.classList.add("show");
        if (fields) fields.style.display = "none";
        ok.setAttribute("tabindex", "-1");
        ok.focus();
      } else {
        form.reset();
        alert("Спасибо! Заявка отправлена (демо).");
      }
    });
  });

  /* ---- 6. Хедер меняет фон при скролле над тёмным героем -------------- */
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
