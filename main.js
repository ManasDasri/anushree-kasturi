const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- Forme's Contours shader (src/registry/contours-shader.tsx), in plain WebGL.
   Sage lines, lavender index lines; drifts slowly at 30fps, still with reduced motion,
   paused when the tab is hidden. ---- */
(function contours() {
  const canvas = $("#contours");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return;
  const frag = `precision mediump float;
uniform vec2 u_resolution; uniform float u_time; uniform vec3 u_color; uniform vec3 u_index; uniform vec3 u_bg;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float height(vec2 p,float t){float h=0.0,a=.55;vec2 q=p+vec2(t*.04,-t*.025);
 for(int i=0;i<4;i++){h+=a*noise(q);q=q*2.03+vec2(1.7,9.2)+t*.015;a*=.5;}return h;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*u_resolution)/u_resolution.y*2.4;
 float t=u_time,levels=22.0,h=height(p,t)*levels,e=1.5/u_resolution.y*2.4;
 vec2 g=vec2(height(p+vec2(e,0.),t)-height(p-vec2(e,0.),t),height(p+vec2(0.,e),t)-height(p-vec2(0.,e),t))*levels/(2.*e);
 float px=length(g)*(2.4/u_resolution.y)+1e-4,d=abs(fract(h)-.5)*2.0,dist=(1.0-d)*.5/px;
 float line=1.0-smoothstep(.5,1.5,dist),index=step(mod(floor(h+.5),5.0),.5),lineIndex=1.0-smoothstep(.75,1.8,dist);
 float a=mix(line*.38,lineIndex*.9,index)*(1.0-.5*smoothstep(.6,1.9,length(p)));
 gl_FragColor=vec4(mix(u_bg,mix(u_color,u_index,index),a),1.0);}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  // colours come from the theme's CSS tokens
  const rgb = (v) => { const h = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
  const tint = () => { gl.uniform3f(U("u_color"), ...rgb("--sig")); gl.uniform3f(U("u_index"), ...rgb("--lav")); gl.uniform3f(U("u_bg"), ...rgb("--ink")); };
  tint();
  addEventListener("theme-change", () => { tint(); draw(performance.now()); });
  const res = U("u_resolution"), time = U("u_time");
  const size = () => {
    const r = Math.min(devicePixelRatio, 1.25);
    canvas.width = innerWidth * r; canvas.height = innerHeight * r;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(res, canvas.width, canvas.height);
  };
  const draw = (ms) => { gl.uniform1f(time, 20 + ms / 1000 * 0.35); gl.drawArrays(gl.TRIANGLES, 0, 6); };
  size(); draw(0);
  addEventListener("resize", () => { size(); draw(performance.now()); });
  if (REDUCED) return;
  let last = 0;
  (function loop(ms) {
    requestAnimationFrame(loop);
    if (document.hidden || ms - last < 33) return;
    last = ms; draw(ms);
  })(0);
})();

/* ---- Forme's Dock (src/registry/dock.tsx): icons swell toward the pointer ---- */
(function dock() {
  const SIZE = innerWidth <= 640 ? 38 : 44, GAP = innerWidth <= 640 ? 5 : 8, PAD = innerWidth <= 640 ? 7 : 10, MAX_BOOST = 0.62;
  const ul = $(".forme-dock ul"), items = [...ul.children].filter((li) => !li.classList.contains("sep"));
  let space = Infinity;
  const magnify = (x) => {
    if (x === null || REDUCED) return items.forEach((el) => el.style.setProperty("--forme-dock-scale", "1"));
    const boosts = items.map((el) => { const r = el.getBoundingClientRect(), d = (x - (r.left + r.width / 2)) / 90; return MAX_BOOST * Math.exp(-d * d); });
    const rest = items.length * SIZE + (items.length - 1) * GAP + PAD * 2;
    const room = Math.max(0, space - rest), growth = SIZE * boosts.reduce((a, b) => a + b, 0), k = growth > room ? room / growth : 1;
    items.forEach((el, i) => el.style.setProperty("--forme-dock-scale", String(1 + boosts[i] * k)));
  };
  ul.addEventListener("pointerenter", () => { space = $(".dock-wrap").clientWidth - 16; });
  ul.addEventListener("pointermove", (e) => e.pointerType === "mouse" && magnify(e.clientX));
  ul.addEventListener("pointerleave", () => magnify(null));

  // the dot under the section in view
  const mark = (id) => items.forEach((li) => li.dataset.for === id ? li.setAttribute("data-active", "") : li.removeAttribute("data-active"));
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && mark(scrollY < 80 ? "top" : e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
  items.forEach((li) => { const s = document.getElementById(li.dataset.for); if (s) io.observe(s); });
  addEventListener("scroll", () => scrollY < 80 && mark("top"), { passive: true });
  mark("top");
})();

/* ---- theme: dark by default, light remembered ---- */
const syncTheme = () => {
  const light = document.documentElement.dataset.theme === "light";
  $("#theme").setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
  $("#theme-label").textContent = `${light ? "Dark" : "Light"} theme`;
  document.querySelector('meta[name="theme-color"]').content = light ? "#f3f4ee" : "#060908";
};
$("#theme").addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  if (light) document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("theme", light ? "light" : "dark"); } catch {}
  syncTheme();
  dispatchEvent(new Event("theme-change"));
});
syncTheme();

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
