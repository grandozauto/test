/* ============================================================
   Grand Ozaukee Automotive — GSAP experience layer
   Degrades gracefully: if GSAP fails to load or the user
   prefers reduced motion, content renders fully visible.
   ============================================================ */

(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  var animate = hasGSAP && !prefersReduced;

  /* ---------- Always-on basics (no GSAP required) ---------- */

  document.getElementById("year").textContent = new Date().getFullYear();

  // Header background on scroll
  var header = document.getElementById("header");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var navToggle = document.getElementById("navToggle");
  var mobileMenu = document.getElementById("mobileMenu");
  function setMenu(open) {
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  }
  navToggle.addEventListener("click", function () {
    setMenu(navToggle.getAttribute("aria-expanded") !== "true");
  });
  mobileMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  // Contact form — validate only; let FormSubmit handle the actual submission
  var form = document.getElementById("contactForm");
  var note = document.getElementById("formNote");
  form.addEventListener("submit", function (e) {
    if (!form.checkValidity()) {
      e.preventDefault();
      note.textContent = "Please fill in your name, phone, and what your vehicle needs.";
    }
    // If valid, do nothing — the form submits naturally to FormSubmit
  });

  /* ---------- Build the gauge geometry (SVG) ---------- */

  var GAUGE = { cx: 180, cy: 180, r: 140, startDeg: -130, endDeg: 130 };

  function polar(deg, radius) {
    var rad = ((deg - 90) * Math.PI) / 180; // 0deg = straight up
    return {
      x: GAUGE.cx + radius * Math.cos(rad),
      y: GAUGE.cy + radius * Math.sin(rad)
    };
  }

  function arcPath(fromDeg, toDeg, radius) {
    var s = polar(fromDeg, radius);
    var e = polar(toDeg, radius);
    var large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    return "M " + s.x.toFixed(2) + " " + s.y.toFixed(2) +
      " A " + radius + " " + radius + " 0 " + large + " 1 " +
      e.x.toFixed(2) + " " + e.y.toFixed(2);
  }

  var track = document.querySelector(".gauge__track");
  var arc = document.querySelector(".gauge__arc");
  var ticks = document.getElementById("gaugeTicks");
  var needleGroup = document.querySelector(".gauge__needle-group");
  var gaugeValue = document.querySelector(".gauge__value");

  if (track && arc && ticks) {
    track.setAttribute("d", arcPath(GAUGE.startDeg, GAUGE.endDeg, GAUGE.r));
    arc.setAttribute("d", arcPath(GAUGE.startDeg, GAUGE.endDeg, GAUGE.r));

    var svgNS = "http://www.w3.org/2000/svg";
    for (var deg = GAUGE.startDeg; deg <= GAUGE.endDeg; deg += 13) {
      var major = Math.round((deg - GAUGE.startDeg) % 65) === 0;
      var outer = polar(deg, 162);
      var inner = polar(deg, major ? 148 : 154);
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", outer.x.toFixed(2));
      line.setAttribute("y1", outer.y.toFixed(2));
      line.setAttribute("x2", inner.x.toFixed(2));
      line.setAttribute("y2", inner.y.toFixed(2));
      if (major) line.setAttribute("stroke", "rgba(255,179,71,.6)");
      ticks.appendChild(line);
    }

    var arcLen = arc.getTotalLength();
    arc.style.strokeDasharray = arcLen;
    arc.style.strokeDashoffset = arcLen;
    needleGroup.style.transform = "rotate(" + GAUGE.startDeg + "deg)";
  }

  /* ---------- No animation? Snap everything to final state ---------- */

  var loader = document.getElementById("loader");

  function finishGauge() {
    if (arc) arc.style.strokeDashoffset = 0;
    if (needleGroup) needleGroup.style.transform = "rotate(" + GAUGE.endDeg + "deg)";
    if (gaugeValue) gaugeValue.textContent = "30";
    document.querySelectorAll("[data-counter]").forEach(function (el) {
      el.textContent = el.getAttribute("data-counter") + el.getAttribute("data-suffix");
    });
  }

  if (!animate) {
    loader.style.display = "none";
    finishGauge();
    return; // CSS keeps all content visible without the .js class
  }

  /* ---------- GSAP experience ---------- */

  document.documentElement.classList.add("js");
  gsap.registerPlugin(ScrollTrigger);

  // Loader → hero intro
  var intro = gsap.timeline({ defaults: { ease: "power3.out" } });

  intro
    .to(".loader__bar-fill", { scaleX: 1, duration: 0.7, ease: "power2.inOut" })
    .to(loader, {
      yPercent: -100,
      duration: 0.65,
      ease: "power3.inOut",
      onComplete: function () { loader.style.display = "none"; }
    })
    .to(".hero__line-inner", {
      y: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: "power4.out"
    }, "-=0.25")
    .to("[data-hero-fade]", {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.1
    }, "-=0.5");

  // Failsafe: if rAF is throttled (hidden tab, low-power mode) the
  // intro can stall with the loader covering the page. Force-finish it.
  setTimeout(function () {
    if (loader.style.display !== "none") {
      intro.progress(1);
      gsap.set("[data-hero-fade], .hero__line-inner", { opacity: 1, y: 0 });
      document.querySelectorAll("[data-counter]").forEach(function (el) {
        el.textContent = el.getAttribute("data-counter") + (el.getAttribute("data-suffix") || "");
      });
    }
  }, 4000);

  // Gauge: needle sweep + arc draw + value count
  if (arc) {
    var arcLength = arc.getTotalLength();
    var gaugeState = { deg: GAUGE.startDeg, val: 0 };
    intro.to(gaugeState, {
      deg: GAUGE.endDeg,
      val: 30,
      duration: 1.6,
      ease: "power2.inOut",
      onUpdate: function () {
        var progress = (gaugeState.deg - GAUGE.startDeg) / (GAUGE.endDeg - GAUGE.startDeg);
        needleGroup.style.transform = "rotate(" + gaugeState.deg + "deg)";
        arc.style.strokeDashoffset = arcLength * (1 - progress);
        gaugeValue.textContent = Math.round(gaugeState.val);
      }
    }, "-=1.1");
  }

  // Stat counters
  document.querySelectorAll("[data-counter]").forEach(function (el) {
    var target = parseInt(el.getAttribute("data-counter"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var state = { val: 0 };
    gsap.to(state, {
      val: target,
      duration: 1.6,
      delay: 1.4,
      ease: "power2.out",
      onUpdate: function () {
        el.textContent = Math.round(state.val) + suffix;
      }
    });
  });

  // Marquee: seamless infinite loop
  gsap.to("#marqueeTrack", {
    xPercent: -50,
    duration: 22,
    ease: "none",
    repeat: -1
  });

  // Scroll reveals
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        overwrite: true
      });
    }
  });

  // Safety net: anything still hidden when it should be visible
  // (e.g. above the fold after resize) gets revealed.
  ScrollTrigger.addEventListener("refreshInit", function () {
    gsap.set("[data-reveal]", { clearProps: "transform" });
  });

  // Subtle parallax on the hero glow (desktop pointer only)
  if (window.matchMedia("(pointer: fine)").matches) {
    var glow = document.querySelector(".hero__glow");
    window.addEventListener("mousemove", function (e) {
      var dx = (e.clientX / window.innerWidth - 0.5) * 30;
      var dy = (e.clientY / window.innerHeight - 0.5) * 30;
      gsap.to(glow, { x: dx, y: dy, duration: 1.2, ease: "power2.out" });
    });
  }
})();
