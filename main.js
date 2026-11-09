const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (v) => { const h = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };

/* ---- a small WebGL runner for Forme's shaders (src/registry/shader-canvas.tsx): renders
   only while on screen and the tab is visible, at most ~30fps; one still frame with
   reduced motion. ---- */
function shader(canvas, fragment, { ratio = 1.25, speed = 1, start = 0, tint, size, pointer } = {}) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const mouse = [0.5, 0.5], target = [0.5, 0.5];
  let visible = true, last = 0;
  const draw = (ms) => {
    mouse[0] += (target[0] - mouse[0]) * 0.08; mouse[1] += (target[1] - mouse[1]) * 0.08;
    gl.uniform2f(U("u_mouse"), mouse[0], mouse[1]);
    gl.uniform1f(U("u_time"), start + ms / 1000 * speed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const resize = () => {
    const r = Math.min(devicePixelRatio || 1, ratio), [w, h] = size();
    canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U("u_resolution"), canvas.width, canvas.height);
    gl.uniform1f(U("u_ratio"), r);
    draw(performance.now());
  };
  const set = (n, v) => typeof v === "number" ? gl.uniform1f(U(n), v) : v.length === 3 ? gl.uniform3f(U(n), ...v) : gl.uniform3fv(U(n), v);
  const apply = () => tint(set);
  const recolor = () => { apply(); draw(performance.now()); };
  apply();
  resize();
  addEventListener("resize", resize);
  addEventListener("theme-change", recolor);
  if (pointer) pointer.addEventListener("pointermove", (e) => {
    const b = pointer.getBoundingClientRect();
    target[0] = (e.clientX - b.left) / b.width; target[1] = 1 - (e.clientY - b.top) / b.height;
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  if (REDUCED) return;
  (function loop(ms) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden || ms - last < 33) return;
    last = ms; draw(ms);
  })(0);
}

const CONTOURS = `precision mediump float;
uniform vec2 u_resolution; uniform float u_time; uniform vec3 u_color; uniform vec3 u_index; uniform vec3 u_bg; uniform float u_zoom; uniform float u_levels; uniform float u_gain;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float height(vec2 p,float t){float h=0.0,a=.55;vec2 q=p+vec2(t*.04,-t*.025);
 for(int i=0;i<4;i++){h+=a*noise(q);q=q*2.03+vec2(1.7,9.2)+t*.015;a*=.5;}return h;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*u_resolution)/u_resolution.y*u_zoom;
 float t=u_time,levels=u_levels,h=height(p,t)*levels,e=1.5/u_resolution.y*u_zoom;
 vec2 g=vec2(height(p+vec2(e,0.),t)-height(p-vec2(e,0.),t),height(p+vec2(0.,e),t)-height(p-vec2(0.,e),t))*levels/(2.*e);
 float px=length(g)*(u_zoom/u_resolution.y)+1e-4,d=abs(fract(h)-.5)*2.0,dist=(1.0-d)*.5/px;
 float line=1.0-smoothstep(.5,1.5,dist),index=step(mod(floor(h+.5),5.0),.5),lineIndex=1.0-smoothstep(.75,1.8,dist);
 float a=min(1.,mix(line*.38,lineIndex*.9,index)*u_gain*(1.0-.5*smoothstep(.6,1.9,length(p)*2.4/u_zoom)));
 gl_FragColor=vec4(mix(u_bg,mix(u_color,u_index,index),a),1.0);}`;

/* ---- Forme's Contours (src/registry/contours-shader.tsx) behind the page, in the theme's
   colours: accent lines, secondary index lines ---- */
shader($("#contours"), CONTOURS, {
  ratio: 1, speed: 0.35, start: 20,
  size: () => [innerWidth, innerHeight],
  tint: (set) => { set("u_color", token("--sig")); set("u_index", token("--lav")); set("u_bg", token("--ink")); set("u_zoom", 2.4); set("u_levels", 22); set("u_gain", 1); },
});

const banner = $(".banner");

/* ---- the header: Forme's Dot grid (src/registry/dot-grid.tsx), a dot matrix with a slow
   swell; dots near the pointer glow in the theme's accent colour ---- */
(function dots() {
  const node = $("#dots"), ctx = node.getContext("2d"), SP = 20;
  const p = { x: 0, y: 0, tx: 0, ty: 0, s: 0, on: false };
  let w = 0, h = 0, t = 0, last = performance.now(), visible = true, dot = "0,0,0", glow = "0,0,0";
  const rgbOf = (v) => token(v).map((c) => Math.round(c * 255)).join(",");
  const colors = () => { dot = rgbOf("--mute"); glow = rgbOf("--sig"); };
  const paint = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!REDUCED) t += dt;
    p.x += (p.tx - p.x) * 0.25; p.y += (p.ty - p.y) * 0.25; p.s += ((p.on ? 1 : 0) - p.s) * 0.15;
    ctx.clearRect(0, 0, w, h);
    for (let y = SP / 2; y < h; y += SP) for (let x = SP / 2; x < w; x += SP) {
      const swell = REDUCED ? 0 : 0.5 + 0.5 * Math.sin(x * 0.012 + y * 0.009 - t * 0.9);
      const d = Math.hypot(x - p.x, y - p.y), g = p.s * Math.exp(-(d * d) / 7000);
      ctx.fillStyle = g > 0.05 ? `rgba(${glow},${(0.35 + g * 0.65).toFixed(3)})` : `rgba(${dot},${(0.35 + swell * 0.25).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 1.1 + g * 1.6, 0, 6.2832); ctx.fill();
    }
  };
  const size = () => {
    w = banner.clientWidth; h = banner.clientHeight;
    const r = Math.min(devicePixelRatio || 1, 2);
    node.width = w * r; node.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0); paint(performance.now());
  };
  colors(); size();
  addEventListener("resize", size);
  addEventListener("theme-change", () => { colors(); paint(performance.now()); });
  banner.addEventListener("pointermove", (e) => { const b = node.getBoundingClientRect(); p.tx = e.clientX - b.left; p.ty = e.clientY - b.top; if (p.s < 0.02) { p.x = p.tx; p.y = p.ty; } p.on = true; });
  banner.addEventListener("pointerleave", () => { p.on = false; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(node);
  (function loop(ms) { requestAnimationFrame(loop); if (visible && !document.hidden && ms - last >= 32) paint(ms); })(0);
})();

/* ---- Forme's Dock (src/registry/dock.tsx): icons swell toward the pointer ---- */
(function dock() {
  const small = innerWidth <= 640, SIZE = small ? 38 : 44, GAP = small ? 5 : 8, PAD = small ? 7 : 10, MAX_BOOST = 0.62;
  const ul = $(".forme-dock ul"), items = [...ul.children].filter((li) => !li.classList.contains("sep"));
  let space = Infinity, centers = [], raf = 0, px = null;
  // Measure each icon's centre once, at rest, when the pointer arrives. Re-measuring on every
  // move reads layout while the icons are resizing, which stalls the frame.
  const measure = () => { centers = items.map((el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; }); };
  const magnify = (x) => {
    if (x === null || REDUCED) return items.forEach((el) => el.style.setProperty("--forme-dock-scale", "1"));
    const boosts = centers.map((c) => { const d = (x - c) / 90; return MAX_BOOST * Math.exp(-d * d); });
    const rest = items.length * SIZE + (items.length - 1) * GAP + PAD * 2;
    const room = Math.max(0, space - rest), growth = SIZE * boosts.reduce((a, b) => a + b, 0), k = growth > room ? room / growth : 1;
    items.forEach((el, i) => el.style.setProperty("--forme-dock-scale", String(1 + boosts[i] * k)));
  };
  ul.addEventListener("pointerenter", () => { space = $(".dock-wrap").clientWidth - 16; magnify(null); measure(); });
  addEventListener("resize", measure);
  // one update per frame; browsing the theme menu shouldn't magnify the icons
  ul.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.target.closest(".theme-menu") ? null : e.clientX;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; magnify(px); });
  });
  ul.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); raf = 0; magnify(null); });

  // the dot under the section in view
  const mark = (id) => items.forEach((li) => li.dataset.for === id ? li.setAttribute("data-active", "") : li.removeAttribute("data-active"));
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && mark(scrollY < 80 ? "top" : e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
  items.forEach((li) => { const s = li.dataset.for && document.getElementById(li.dataset.for); if (s) io.observe(s); });
  addEventListener("scroll", () => scrollY < 80 && mark("top"), { passive: true });
  mark("top");
})();

/* ---- VS Code themes, from the dock. Each theme is a block of tokens in style.css; the
   choice is remembered per visitor. ---- */
(function themes() {
  const THEMES = [["sage", "Sage (default)"], ["dark-plus", "Dark+"], ["one-dark", "One Dark Pro"], ["dracula", "Dracula"], ["monokai", "Monokai"],
    ["github-dark", "GitHub Dark"], ["tokyo-night", "Tokyo Night"], ["catppuccin", "Catppuccin Mocha"], ["nord", "Nord"],
    ["light-plus", "Light+"], ["github-light", "GitHub Light"], ["solarized-light", "Solarized Light"]];
  const btn = $("#theme"), menu = $("#theme-menu");
  const current = () => document.documentElement.dataset.theme || "sage";
  for (const [id, name] of THEMES) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "menuitemradio"); b.dataset.id = id;
    b.innerHTML = `<span class="sw" data-theme="${id}"></span>`;
    b.append(name);
    menu.append(b);
  }
  const sync = () => {
    menu.querySelectorAll("[role=menuitemradio]").forEach((b) => b.setAttribute("aria-checked", b.dataset.id === current()));
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  };
  const open = (on) => { menu.hidden = !on; btn.setAttribute("aria-expanded", on); if (on) menu.querySelector("[aria-checked=true]")?.focus(); };
  btn.addEventListener("click", () => open(menu.hidden));
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[role=menuitemradio]");
    if (!b) return;
    if (b.dataset.id === "sage") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = b.dataset.id;
    try { localStorage.setItem("theme", b.dataset.id); } catch {}
    sync(); dispatchEvent(new Event("theme-change"));
  });
  menu.addEventListener("keydown", (e) => {
    const list = [...menu.querySelectorAll("[role=menuitemradio]")], i = list.indexOf(document.activeElement);
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); list[(i + d + list.length) % list.length].focus(); }
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { open(false); btn.focus(); } });
  addEventListener("pointerdown", (e) => { if (!menu.hidden && !e.target.closest("#theme, #theme-menu")) open(false); });
  sync();
})();

/* ---- $ whoami typewriter ---- */
const ROLES = ["CS student", "ML builder", "open-source contributor", "full-stack dev"];
if (!REDUCED) {
  const el = $("#role");
  let r = 0, n = ROLES[0].length, del = false;
  setTimeout(function step() {
    const word = ROLES[r];
    n += del ? -1 : 1;
    el.textContent = word.slice(0, n);
    let wait = del ? 40 : 85;
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

/* ---- copy email ---- */
$("#copy").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText("anushree.kasturi06@gmail.com"); e.target.textContent = "copied ✓"; setTimeout(() => e.target.textContent = "copy", 1800); } catch {}
});

/* ---- local time ---- */
const tick = () => $("#clock").textContent = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) + " IST";
tick(); setInterval(tick, 30000);

/* ---- live GitHub calendar: stats, month labels, hover readout ---- */
const fmtDay = (iso) => new Date(iso + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
function streaks(days) {
  let longest = 0, run = 0;
  for (const d of days) { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, cur = 0;
  if (i >= 0 && !days[i].count) i--; // today not counted yet doesn't break the streak
  while (i >= 0 && days[i].count) { cur++; i--; }
  return { longest, cur };
}
fetch("https://github-contributions-api.jogruber.de/v4/AnushreeKasturi?y=last")
  .then((r) => r.ok ? r.json() : Promise.reject())
  .then(({ contributions }) => {
    // coerce API fields before they touch innerHTML
    const all = contributions.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .map((d) => ({ date: d.date, count: Math.max(0, d.count | 0), level: Math.min(4, Math.max(0, d.level | 0)) }));
    // the last six months (26 weeks), starting on a Sunday
    let start = all.length - 26 * 7;
    while (start > 0 && new Date(all[start].date + "T00:00").getDay() !== 0) start--;
    const days = all.slice(Math.max(0, start));
    const pad = new Date(days[0].date + "T00:00").getDay(); // first column starts on Sunday
    const cells = [...Array(pad).fill(null), ...days];
    $("#heat").innerHTML = cells.map((d) => d ? `<i data-l="${d.level}" data-c="${d.count}" data-d="${d.date}"></i>` : `<i class="pad"></i>`).join("");
    // a month's label sits over the first week that starts in it
    const weeks = Math.ceil(cells.length / 7);
    let prev = -1, months = "";
    for (let w = 0; w < weeks; w++) {
      const d = cells[w * 7] || cells[w * 7 + 6] || days[0], m = new Date(d.date + "T00:00").getMonth();
      months += `<span>${m !== prev && w < weeks - 2 ? new Date(d.date + "T00:00").toLocaleString("en-US", { month: "short" }) : ""}</span>`;
      prev = m;
    }
    $("#months").innerHTML = months;
    const total = days.reduce((s, d) => s + d.count, 0), { longest, cur } = streaks(days);
    $("#s-total").textContent = total.toLocaleString();
    $("#s-active").textContent = days.filter((d) => d.count).length;
    $("#s-long").textContent = longest + "d";
    $("#s-cur").textContent = cur + "d";
    $("#heat").setAttribute("aria-label", `${total} GitHub contributions in the last six months`);
    const tip = $("#tip");
    $("#heat").addEventListener("pointerover", (e) => {
      const c = e.target.dataset.c;
      if (c !== undefined) tip.textContent = `${c === "0" ? "No" : c} contribution${c === "1" ? "" : "s"} on ${fmtDay(e.target.dataset.d)}`;
    });
    $("#heat").addEventListener("pointerleave", () => tip.textContent = "hover a day");
  })
  .catch(() => { $(".cal").remove(); $(".gh-foot").remove(); $("#gh-tiles").outerHTML = `<p class="note" style="margin:0">couldn't reach GitHub right now · <a href="https://github.com/AnushreeKasturi">see the profile ↗</a></p>`; });

/* ---- open source, live from GitHub's search API. The numbers and list already in the
   page are the fallback if GitHub is unreachable or rate-limits the visitor. ---- */
(async function openSource() {
  const q = (extra) => fetch(`https://api.github.com/search/issues?per_page=100&sort=updated&q=${encodeURIComponent(`author:AnushreeKasturi type:pr -user:AnushreeKasturi ${extra}`)}`)
    .then((r) => r.ok ? r.json() : Promise.reject());
  try {
    const [merged, open] = await Promise.all([q("is:merged"), q("is:open")]);
    const repoOf = (pr) => pr.repository_url.split("/repos/")[1];
    $("#o-merged").textContent = merged.total_count;
    $("#o-repos").textContent = new Set(merged.items.map(repoOf)).size;
    $("#o-open").textContent = open.total_count;
    $("#oss-note").textContent = "pull requests merged into other people's projects · live from GitHub";
    // the newest merges, one per repository, with each repository's stars and language
    const seen = new Set(), latest = [];
    for (const pr of merged.items) { const r = repoOf(pr); if (!seen.has(r) && latest.length < 9) { seen.add(r); latest.push(pr); } }
    const repos = await Promise.all(latest.map((pr) => fetch(pr.repository_url).then((r) => r.ok ? r.json() : {}).catch(() => ({}))));
    const k = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    $("#prs").replaceChildren(...latest.map((pr, i) => {
      const a = el("a"); a.href = pr.html_url; a.target = "_blank"; a.rel = "noopener";
      const repo = el("span", "repo", repoOf(pr));
      if (repos[i].stargazers_count) repo.append(el("em", "", `★ ${k(repos[i].stargazers_count)}`));
      a.append(repo, el("span", "t", pr.title));
      if (repos[i].language) a.append(el("span", "lang", repos[i].language));
      const li = el("li"); li.append(a); return li;
    }));
  } catch {}
})();
