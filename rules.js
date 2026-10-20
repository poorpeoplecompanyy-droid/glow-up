/** Reglas puras de Glow Up. Sin DOM, sin almacenamiento, sin red. */

const DEFAULT = {
  hpMax: 1000,
  levelUpCoins: 50,
  reviveDays: 7,
  monthlyHpReset: false,
  good: [
    { id: "sleep", name: "Dormir 7 h o más", area: "salud", exp: 10, coins: 10 },
    { id: "train", name: "Entrenar (sesión completa)", area: "salud", exp: 15, coins: 15 },
    { id: "eat", name: "Comer sano todo el día", area: "salud", exp: 10, coins: 5 },
    { id: "publish", name: "Publicar una pieza", area: "contenido", exp: 20, coins: 20, repeatable: true },
    { id: "block", name: "Bloque de 1 h de contenido", area: "contenido", exp: 10, coins: 10, repeatable: true },
    { id: "weeklySave", name: "Ahorro semanal cumplido", area: "finanzas", exp: 25, coins: 25, sundayOnly: true },
    { id: "noSpend", name: "Día sin gastos innecesarios", area: "finanzas", exp: 5, coins: 5 },
    { id: "learn", name: "30 min aprendiendo IA / edición", area: "aprender", exp: 10, coins: 10 },
    { id: "read", name: "Leer 20 min", area: "mente", exp: 5, coins: 5 },
    { id: "lowSocial", name: "Redes de ocio < 60 min", area: "mente", exp: 10, coins: 10 },
    { id: "plan", name: "Planificar el día siguiente", area: "mente", exp: 5, coins: 5 }
  ],
  bad: [
    { id: "social", name: "Más de 60 min de redes de ocio", hp: 20 },
    { id: "impulse", name: "Compra impulsiva", hp: 30 },
    { id: "junk", name: "Comida basura entre horas", hp: 15 },
    { id: "skipTrain", name: "Saltarse un entreno planificado", hp: 10 },
    { id: "late", name: "Acostarse después de la 1:00", hp: 10 }
  ],
  shop: [
    { id: "food", name: "Capricho de comida", price: 150 },
    { id: "beer", name: "Cerveza / salida", price: 200 },
    { id: "free", name: "Tarde libre de todo", price: 250 },
    { id: "noContent", name: "Día libre de contenido", price: 300 },
    { id: "smallBuy", name: "Compra deseada pequeña", price: 400 },
    { id: "midBuy", name: "Compra deseada mediana", price: 1000, wait48h: true }
  ],
  areas: [
    { id: "salud", name: "Salud", goal: "" },
    { id: "contenido", name: "Contenido y marca", goal: "" },
    { id: "finanzas", name: "Finanzas", goal: "" },
    { id: "aprender", name: "Aprender", goal: "" },
    { id: "mente", name: "Mente y disciplina", goal: "" }
  ],
  phases: [
    { name: "Aprendiz", min: 5, quests: ["sleep", "eat", "read", "plan", "lowSocial"], foes: ["junk", "late", "social"], shop: ["food", "beer", "free"] },
    { name: "Aventurero", min: 8, quests: ["train", "noSpend"], foes: ["skipTrain"], shop: ["noContent"] },
    { name: "Héroe", min: 12, quests: ["publish", "learn"], foes: ["impulse"], shop: ["smallBuy"] },
    { name: "Leyenda", min: 17, quests: ["block", "weeklySave"], foes: [], shop: ["midBuy"] }
  ],
  daily: { quests: 3, foes: 2, shop: 2 },
  punishment: ""
}

export function defaultConfig() {
  return structuredClone(DEFAULT)
}

export function configOk(data) {
  if (!data || typeof data !== "object") return false
  if (!Number.isFinite(data.hpMax) || data.hpMax < 1) return false
  if (!Number.isFinite(data.levelUpCoins) || data.levelUpCoins < 0) return false
  if (!Number.isFinite(data.reviveDays) || data.reviveDays < 1) return false
  if (typeof data.monthlyHpReset !== "boolean") return false
  if (typeof data.punishment !== "string") return false
  if (!Array.isArray(data.areas) || data.areas.length < 1) return false
  if (!Array.isArray(data.good) || !Array.isArray(data.bad) || !Array.isArray(data.shop)) return false
  if (data.phases != null && !phasesOk(data.phases)) return false
  if (data.daily != null && !dailyOk(data.daily)) return false
  return true
}

function idListOk(value) {
  return value == null || (Array.isArray(value) && value.every((id) => typeof id === "string"))
}

function phasesOk(phases) {
  if (!Array.isArray(phases) || phases.length < 1) return false
  return phases.every((phase) => phase
    && typeof phase.name === "string"
    && phase.name.trim()
    && Number.isFinite(phase.min)
    && idListOk(phase.quests)
    && idListOk(phase.foes)
    && idListOk(phase.shop))
}

function dailyOk(daily) {
  if (!daily || typeof daily !== "object") return false
  return ["quests", "foes", "shop"].every((key) => Number.isInteger(daily[key]) && daily[key] >= 0)
}

export function phasesOf(config) {
  return phasesOk(config?.phases) ? config.phases : defaultConfig().phases
}

export function dailyOf(config) {
  return dailyOk(config?.daily) ? config.daily : defaultConfig().daily
}

export function editorConfig(config) {
  const next = structuredClone(config)
  const base = defaultConfig()
  if (!phasesOk(next.phases)) next.phases = base.phases
  if (!dailyOk(next.daily)) next.daily = base.daily
  return next
}

export function totalLevel(config, areas) {
  return (config?.areas || []).reduce((sum, area) => sum + (areas?.[area.id]?.level || 1), 0)
}

export function phaseAt(level, phases) {
  const list = [...phases].sort((a, b) => a.min - b.min || a.name.localeCompare(b.name, "es"))
  let current = list[0]
  for (const phase of list) if (level >= phase.min) current = phase
  return current
}

function listedIds(phases, key) {
  const ids = []
  let any = false
  for (const phase of phases) {
    if (!Array.isArray(phase[key])) continue
    any = true
    for (const id of phase[key]) if (!ids.includes(id)) ids.push(id)
  }
  return { any, ids }
}

function unlockedIds(level, phases, key) {
  const ids = []
  for (const phase of phases) {
    if (level < phase.min || !Array.isArray(phase[key])) continue
    for (const id of phase[key]) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

function dayNumber(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number)
  if (!y || !m || !d) return 0
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

function pickStable(ids, count, seed) {
  const list = [...ids].sort()
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (!list.length || n <= 0) return []
  if (n >= list.length) return list
  const start = seed % list.length
  const rotated = list.slice(start).concat(list.slice(0, start))
  return rotated.slice(0, n)
}

function poolFor(config, date, level, key, catalog) {
  const phases = phasesOf(config)
  const listed = listedIds(phases, key)
  const unlocked = new Set(unlockedIds(level, phases, key))
  const sunday = isSunday(date)
  return catalog.filter((entry) => {
    if (entry.sundayOnly && !sunday) return false
    if (!listed.any) return true
    return !listed.ids.includes(entry.id) || unlocked.has(entry.id)
  }).map((entry) => entry.id)
}

export function rotationFor(config, date, level) {
  const phases = phasesOf(config)
  const daily = dailyOf(config)
  const phase = phaseAt(level, phases)
  const seed = dayNumber(date) + phase.min
  return {
    phase,
    quests: pickStable(poolFor(config, date, level, "quests", config.good || []), daily.quests, seed),
    foes: pickStable(poolFor(config, date, level, "foes", config.bad || []), daily.foes, seed + 1),
    shop: pickStable(poolFor(config, date, level, "shop", config.shop || []), daily.shop, seed + 2)
  }
}

export function levelUpCard(before, after, config) {
  const prev = totalLevel(config, before.areas)
  const next = totalLevel(config, after.areas)
  if (next <= prev) return null
  const phases = phasesOf(config)
  const from = phaseAt(prev, phases)
  const to = phaseAt(next, phases)
  const opened = { quests: [], foes: [], shop: [] }
  for (const phase of phases) {
    if (prev >= phase.min || next < phase.min) continue
    for (const key of ["quests", "foes", "shop"]) {
      for (const id of phase[key] || []) if (!opened[key].includes(id)) opened[key].push(id)
    }
  }
  const objectives = [...opened.quests, ...opened.foes]
    .map((id) => config.good.find((habit) => habit.id === id)?.name || config.bad.find((habit) => habit.id === id)?.name)
    .filter(Boolean)
  const products = opened.shop
    .map((id) => config.shop.find((item) => item.id === id)?.name)
    .filter(Boolean)
  return {
    level: next,
    coins: before.dead ? 0 : (next - prev) * config.levelUpCoins,
    phase: from.name === to.name ? "" : to.name,
    objectives,
    products
  }
}

export function emptyDocument(config = defaultConfig()) {
  return { config: structuredClone(config), days: {}, buys: [], revives: [], weekly: {} }
}

export function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isSunday(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d).getDay() === 0
}

export function weekDatesEnding(sunday) {
  const [y, m, d] = sunday.split("-").map(Number)
  const end = new Date(y, m - 1, d)
  const out = []
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date(end)
    dt.setDate(end.getDate() - i)
    out.push(dateKey(dt))
  }
  return out
}

export function saveDay(doc, date, counts, offered) {
  const next = structuredClone(doc)
  const prev = next.days[date]
  const allow = offered ? new Set([...(offered.quests || []), ...(offered.foes || [])]) : null
  const clean = {}
  for (const [id, raw] of Object.entries(counts || {})) {
    if (allow && !allow.has(id)) continue
    const times = Math.max(0, Math.floor(Number(raw) || 0))
    if (times > 0) clean[id] = times
  }
  if (Object.keys(clean).length === 0) delete next.days[date]
  else {
    const day = { counts: clean, savedAt: prev?.savedAt || `${date}T00:00:01` }
    if (offered) day.offered = { quests: [...(offered.quests || [])], foes: [...(offered.foes || [])] }
    next.days[date] = day
  }
  return next
}

function monthFirsts(start, end) {
  const out = []
  let y = Number(start.slice(0, 4))
  let m = Number(start.slice(5, 7))
  const last = end.slice(0, 7)
  while (`${y}-${String(m).padStart(2, "0")}` <= last) {
    const key = `${y}-${String(m).padStart(2, "0")}-01`
    if (key >= start.slice(0, 10) && key <= end.slice(0, 10)) out.push(key)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function timeValue(value) {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function drainLevels(area, config, state, report) {
  let guard = 0
  while (area.exp >= area.level * 100 && guard < 10000) {
    area.exp -= area.level * 100
    area.level += 1
    report.levels.push({ area: area.id, level: area.level })
    if (!state.dead) {
      state.coins += config.levelUpCoins
      report.coinsIn += config.levelUpCoins
    }
    guard += 1
  }
}

function applyCheckIn(state, config, event, report) {
  const counts = event.counts || {}
  const sunday = isSunday(event.date)
  const listed = event.offered && typeof event.offered === "object"
  const goodAllow = listed ? new Set(event.offered.quests || []) : null
  const badAllow = listed ? new Set(event.offered.foes || []) : null
  const goodById = new Map(config.good.map((habit) => [habit.id, habit]))
  const badById = new Map(config.bad.map((habit) => [habit.id, habit]))

  for (const [id, raw] of Object.entries(counts)) {
    const asked = Math.max(0, Math.floor(Number(raw) || 0))
    if (!asked || (goodAllow && !goodAllow.has(id))) continue
    const habit = goodById.get(id)
    if (!habit || (habit.sundayOnly && !sunday)) continue
    const times = habit.repeatable ? asked : 1
    const area = state.areas[habit.area]
    if (!area) continue
    const gained = times * habit.exp
    area.exp += gained
    report.exp[habit.area] = (report.exp[habit.area] || 0) + gained
    if (!state.dead) {
      state.coins += times * habit.coins
      report.coinsIn += times * habit.coins
    }
    drainLevels(area, config, state, report)
  }

  if (!state.dead) {
    let worst = null
    for (const [id, raw] of Object.entries(counts)) {
      const asked = Math.max(0, Math.floor(Number(raw) || 0))
      if (!asked || (badAllow && !badAllow.has(id))) continue
      const habit = badById.get(id)
      if (!habit) continue
      state.hp -= habit.hp
      report.hpLoss += habit.hp
      if (!worst || habit.hp > worst.hp) worst = habit
    }
    if (state.hp <= 0) {
      state.hp = 0
      state.dead = { since: event.at, date: event.date, causeId: worst ? worst.id : "", causeName: worst ? worst.name : "" }
    }
  }

  report.hpEnd = state.hp
  report.coinsEnd = state.coins
}

function blankReport(state) {
  return { exp: {}, coinsIn: 0, coinsOut: 0, hpLoss: 0, levels: [], hpEnd: state.hp, coinsEnd: state.coins }
}

export function derive(doc, today, nowIso = `${today}T23:59:59`) {
  const config = doc.config
  const areas = {}
  for (const area of config.areas) areas[area.id] = { id: area.id, level: 1, exp: 0 }
  const state = { hp: config.hpMax, coins: 0, areas, dead: null, deaths: [], reservations: [] }
  const events = []
  for (const [date, day] of Object.entries(doc.days || {})) {
    events.push({
      type: "checkin",
      at: day.savedAt || `${date}T00:00:00`,
      date,
      counts: day.counts || {},
      offered: day.offered || null
    })
  }
  for (const entry of doc.buys || []) events.push({ type: "buy", ...entry })
  for (const entry of doc.revives || []) events.push({ type: "revive", ...entry })
  if (config.monthlyHpReset && today) {
    const known = Object.keys(doc.days || {}).filter((date) => date <= today)
    known.push(today)
    known.sort()
    if (known[0]) {
      for (const date of monthFirsts(known[0], today)) {
        events.push({ type: "month", at: `${date}T00:00:00`, date })
      }
    }
  }
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  const seenMonths = new Set()
  const dayLog = {}
  let levelAtToday = null
  const touchMonth = (date) => {
    if (!config.monthlyHpReset || !date?.endsWith("-01") || seenMonths.has(date) || state.dead) return
    seenMonths.add(date)
    state.hp = config.hpMax
  }

  for (const event of events) {
    const eventDate = event.date || event.at?.slice(0, 10)
    if (today && levelAtToday == null && eventDate >= today) levelAtToday = totalLevel(config, state.areas)
    if (event.type === "month") touchMonth(event.date)
    if (event.type === "checkin") {
      touchMonth(event.date)
      const report = blankReport(state)
      applyCheckIn(state, config, event, report)
      dayLog[event.date] = report
    } else if (event.type === "buy") {
      const item = config.shop.find((entry) => entry.id === event.itemId)
      if (!item || state.dead || state.coins < item.price) continue
      state.coins -= item.price
      const record = { id: event.id, itemId: item.id, name: item.name, price: item.price, at: event.at, confirmed: !item.wait48h }
      if (item.wait48h) record.confirmAt = new Date(timeValue(event.at) + 48 * 60 * 60 * 1000).toISOString()
      state.reservations.push(record)
      const day = event.at.slice(0, 10)
      if (!dayLog[day]) dayLog[day] = blankReport(state)
      dayLog[day].coinsOut += item.price
      dayLog[day].coinsEnd = state.coins
      dayLog[day].hpEnd = state.hp
    } else if (event.type === "revive" && state.dead) {
      state.deaths.push({
        date: state.dead.date,
        causeId: state.dead.causeId,
        causeName: state.dead.causeName,
        revivedAt: event.date || event.at.slice(0, 10)
      })
      state.dead = null
      state.hp = config.hpMax
    }
  }
  touchMonth(today)
  if (levelAtToday == null) levelAtToday = totalLevel(config, state.areas)

  const now = timeValue(nowIso)
  for (const reservation of state.reservations) {
    if (reservation.confirmAt && timeValue(reservation.confirmAt) <= now) reservation.confirmed = true
  }

  const rotation = rotationFor(config, today || "1970-01-01", levelAtToday)
  return { ...state, dayLog, weekly: doc.weekly || {}, config, rotation, level: totalLevel(config, state.areas) }
}

export function buy(doc, itemId, at) {
  const today = at.slice(0, 10)
  const view = derive(doc, today, at)
  if (view.dead) return { ok: false, reason: "muerto", doc }
  const item = doc.config.shop.find((entry) => entry.id === itemId)
  if (!item) return { ok: false, reason: "falta", doc }
  if (!view.rotation.shop.includes(itemId)) return { ok: false, reason: "mercado", doc }
  if (view.coins < item.price) return { ok: false, reason: "saldo", doc }
  const next = structuredClone(doc)
  next.buys.push({ id: `buy-${next.buys.length + 1}`, itemId, at })
  return { ok: true, doc: next }
}

export function revive(doc, date) {
  const view = derive(doc, date, `${date}T23:59:59`)
  if (!view.dead) return { ok: false, doc }
  const next = structuredClone(doc)
  next.revives.push({ date, at: `${date}T12:00:00` })
  return { ok: true, doc: next }
}

export function weekSlice(dayLog, sunday) {
  const expByArea = {}
  let coinsPlus = 0
  let coinsMinus = 0
  let hpEnd = null
  const levels = []
  for (const date of weekDatesEnding(sunday)) {
    const day = dayLog[date]
    if (!day) continue
    for (const [area, exp] of Object.entries(day.exp || {})) expByArea[area] = (expByArea[area] || 0) + exp
    coinsPlus += day.coinsIn || 0
    coinsMinus += day.coinsOut || 0
    hpEnd = day.hpEnd
    levels.push(...(day.levels || []))
  }
  return { expByArea, coinsPlus, coinsMinus, hpEnd, levels }
}

export function reviveDeadline(since, reviveDays) {
  return new Date(timeValue(since) + reviveDays * 24 * 60 * 60 * 1000)
}
