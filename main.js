// Local time in Bengaluru.
const clock = document.getElementById("clock");
const tick = () => clock.textContent = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) + " IST";
tick(); setInterval(tick, 30000);

// Live GitHub contributions. Section stays hidden if the API is unreachable (no fake data).
fetch("https://github-contributions-api.jogruber.de/v4/AnushreeKasturi?y=last")
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(({ contributions }) => {
    // coerce API fields before they touch innerHTML
    const days = contributions.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .map(d => ({ date: d.date, count: Math.max(0, d.count | 0), level: Math.min(4, Math.max(0, d.level | 0)) }));
    const heat = document.getElementById("heat");
    // pad so the first column starts on Sunday, like GitHub
    const pad = new Date(days[0].date + "T00:00").getDay();
    heat.innerHTML = "<i style='visibility:hidden'></i>".repeat(pad) +
      days.map(d => `<i data-l="${d.level}" title="${d.count} on ${d.date}"></i>`).join("");
    const total = days.reduce((s, d) => s + d.count, 0);
    const active = days.filter(d => d.count).length;
    const cap = `${total.toLocaleString()} contributions · ${active} active days in the last year`;
    document.getElementById("heat-cap").textContent = cap;
    heat.setAttribute("aria-label", cap);
    document.getElementById("activity").hidden = false;
  })
  .catch(() => {});
