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
uniform vec2 u_resolution; uniform float u_time; uniform vec3 u_color; uniform vec3 u_index;
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
 vec3 c=vec3(.024,.035,.031)+u_color*.03*(h/levels);
 c+=mix(u_color*.3,u_index*.85,index)*mix(line,lineIndex,index);
 gl_FragColor=vec4(c*(1.0-.45*smoothstep(.6,1.9,length(p))),1.0);}`;
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
  gl.uniform3f(U("u_color"), 185 / 255, 223 / 255, 165 / 255);
  gl.uniform3f(U("u_index"), 169 / 255, 164 / 255, 232 / 255);
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
  const ul = $(".forme-dock ul"), items = [...ul.children];
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
    const days = contributions.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .map((d) => ({ date: d.date, count: Math.max(0, d.count | 0), level: Math.min(4, Math.max(0, d.level | 0)) }));
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
    $("#heat").setAttribute("aria-label", `${total} GitHub contributions in the last year`);
    const tip = $("#tip");
    $("#heat").addEventListener("pointerover", (e) => {
      const c = e.target.dataset.c;
      if (c !== undefined) tip.textContent = `${c === "0" ? "No" : c} contribution${c === "1" ? "" : "s"} on ${fmtDay(e.target.dataset.d)}`;
    });
    $("#heat").addEventListener("pointerleave", () => tip.textContent = "hover a day");
  })
  .catch(() => { $(".cal").remove(); $(".gh-foot").remove(); $("#gh-tiles").outerHTML = `<p class="note" style="margin:0">couldn't reach GitHub right now · <a href="https://github.com/AnushreeKasturi">see the profile ↗</a></p>`; });
