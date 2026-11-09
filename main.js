const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- the scene: a still night of rolling hills under a moon, Bayer-dithered in her sage
   and lavender. Drawn once (and again on resize); nothing moves. ---- */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const SKY = ["#070b0a", "#11132a", "#25234f", "#4a4690", "#a9a4e8"].map(hex);
const HILL = ["#070b0a", "#0f1d16", "#22402c", "#4f7a46", "#b9dfa5"].map(hex);
const MOON = ["#25234f", "#8f8ad0", "#e6ebe2"].map(hex);

function paint(canvas, px, moonX) {
  const w = Math.ceil(canvas.clientWidth / px), h = Math.ceil(canvas.clientHeight / px);
  if (!w || !h) return;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"), img = ctx.createImageData(w, h), d = img.data;
  const ar = w / h, mx = moonX * ar, my = 0.3, mr = 0.11;
  // three ridges, back to front: [baseline, amplitude, frequency, phase, brightness]
  const ridges = [[0.62, 0.06, 5, 1.3, 0.45], [0.74, 0.07, 3.4, 4.1, 0.7], [0.86, 0.05, 7, 2.2, 0.95]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / h, v = y / h, t = BAYER[(y & 3) * 4 + (x & 3)];
    let pal = SKY, val = 0.15 + 0.5 * (1 - v / 1) ** 3;
    const dm = Math.hypot(u - mx, v - my);
    if (dm < mr) { pal = MOON; val = 0.55 + 0.45 * (1 - dm / mr); }
    else val += 0.35 * Math.max(0, 1 - (dm - mr) / 0.35) ** 2;           // moon glow
    for (const [b, a, f, p, br] of ridges) {
      const top = b + a * Math.sin(u * f + p) + a * 0.4 * Math.sin(u * f * 2.7 + p * 2);
      if (v > top) { pal = HILL; val = br * (0.55 + 0.45 * Math.max(0, 1 - (v - top) * 5)); }
    }
    const lv = Math.min(pal.length - 1, Math.max(0, val * (pal.length - 1)));
    const c = pal[Math.floor(lv) + (lv % 1 > t ? 1 : 0)] || pal[pal.length - 1];
    const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const scenes = () => { paint($("#scene"), 4, 0.78); paint($("#margin"), 6, 0.85); };
scenes();
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(scenes, 150); });

/* ---- $ whoami typewriter ---- */
const ROLES = ["CS student", "ML builder", "full-stack dev", "hackathon regular"];
if (!REDUCED) {
  const el = $("#role");
  let r = 0, n = ROLES[0].length, del = false;
  setTimeout(function step() {
    const word = ROLES[r];
    n += del ? -1 : 1;
    el.textContent = word.slice(0, n);
    let wait = del ? 45 : 90;
    if (!del && n === word.length) { del = true; wait = 1800; }
    else if (del && n === 0) { del = false; r = (r + 1) % ROLES.length; wait = 300; }
    setTimeout(step, wait);
  }, 1800);
}

/* ---- Now: segmented tabs (arrow keys move between them) ---- */
const seg = $(".segmented"), tabs = [...seg.querySelectorAll("button")];
const pick = (i) => {
  tabs.forEach((b, j) => {
    b.setAttribute("aria-selected", i === j);
    b.tabIndex = i === j ? 0 : -1;
    document.getElementById(b.getAttribute("aria-controls")).hidden = i !== j;
  });
  seg.dataset.i = i;
  $("#now-note").textContent = tabs[i].dataset.note;
};
tabs.forEach((b, i) => b.addEventListener("click", () => pick(i)));
seg.addEventListener("keydown", (e) => {
  const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!d) return;
  const i = ((+seg.dataset.i || 0) + tabs.length + d) % tabs.length;
  pick(i); tabs[i].focus();
});

/* ---- dock: mark the section in view ---- */
const dock = [...document.querySelectorAll(".dock a")];
const mark = (id) => dock.forEach((a) => a.dataset.for === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"));
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && mark(scrollY < 80 ? "top" : e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
dock.forEach((a) => { const s = document.getElementById(a.dataset.for); if (s) io.observe(s); });
addEventListener("scroll", () => scrollY < 80 && mark("top"), { passive: true });

/* ---- copy email ---- */
$("#copy").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText("anushree.kasturi06@gmail.com"); e.target.textContent = "copied ✓"; setTimeout(() => e.target.textContent = "copy", 1800); } catch {}
});

/* ---- local time ---- */
const tick = () => $("#clock").textContent = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) + " IST";
tick(); setInterval(tick, 30000);

/* ---- live GitHub contributions; fields coerced before they touch innerHTML ---- */
fetch("https://github-contributions-api.jogruber.de/v4/AnushreeKasturi?y=last")
  .then((r) => r.ok ? r.json() : Promise.reject())
  .then(({ contributions }) => {
    const days = contributions.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .map((d) => ({ date: d.date, count: Math.max(0, d.count | 0), level: Math.min(4, Math.max(0, d.level | 0)) }));
    const pad = new Date(days[0].date + "T00:00").getDay(); // first column starts on Sunday
    $("#heat").innerHTML = "<i style='visibility:hidden'></i>".repeat(pad) +
      days.map((d) => `<i data-l="${d.level}" title="${d.count} on ${d.date}"></i>`).join("");
    const total = days.reduce((s, d) => s + d.count, 0), active = days.filter((d) => d.count).length;
    $("#heat-cap").textContent = `${total.toLocaleString()} contributions · ${active} active days in the last year`;
  })
  .catch(() => { $("#activity").previousElementSibling.remove(); $("#activity").remove(); });
