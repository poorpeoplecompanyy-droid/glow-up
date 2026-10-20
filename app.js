import { loadDoc, saveDoc } from "./db.js"
import {
  buy,
  configOk,
  dateKey,
  derive,
  editorConfig,
  emptyDocument,
  isSunday,
  levelUpCard,
  phaseAt,
  phasesOf,
  revive,
  reviveDeadline,
  saveDay,
  totalLevel as levelSum,
  weekSlice
} from "./rules.js"

const main = document.querySelector("#contenido")
const titles = { hoy: "Hoy", areas: "Áreas", tienda: "Tienda", dias: "Días", semana: "Semana", ajustes: "Ajustes" }
const MENU_ART = { hoy: "I_Scroll", areas: "S_Buff08", tienda: "I_Chest02", dias: "W_Book05", semana: "I_Clock", ajustes: "I_Key01" }
const CLASS_NAMES = { elf: "Aventurero", dwarf: "Guerrero", knight: "Caballero", wizard: "Mago", ghost: "Fantasma" }

let doc = emptyDocument()
let panel = panelFromHash() ?? "inicio"
let entering = panel === "hub" ? "to-hub" : ""
let cameFromHub = false
let cameFromStart = false
let lamina = null
let focusNext = []
let notice = ""
let jsonError = ""
let draft = null
const today = dateKey(new Date())

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value)
    else if (value === true) node.setAttribute(key, "")
    else if (value !== false && value != null) node.setAttribute(key, String(value))
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue
    node.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return node
}

const SHOP_ART = { food: "I_C_Pie", beer: "P_Yellow03", free: "I_Clock", noContent: "I_Scroll02", smallBuy: "I_Chest01", midBuy: "I_Chest02" }
const AREA_ART = { salud: 115, contenido: 29, finanzas: 89, aprender: 56, mente: 102 }
const QUEST_AREA_ART = { salud: "P_Red01", contenido: "I_Feather01", finanzas: "I_GoldCoin", aprender: "W_Book01", mente: "I_Crystal01" }
const QUEST_ART = {
  sleep: "P_Blue01",
  train: "W_Sword001",
  eat: "I_C_Carrot",
  publish: "I_Feather01",
  block: "I_Ink",
  weeklySave: "I_GoldBar",
  noSpend: "I_GoldCoin",
  learn: "W_Book01",
  read: "I_Book",
  lowSocial: "I_Crystal01",
  plan: "I_Map"
}
const ENEMY_ART = ["goblin", "imp", "skeleton", "zombie", "slime"]
const HEROES = [[17, "wizard"], [12, "knight"], [8, "dwarf"], [0, "elf"]]

function sprite(n, cls = "sprite") {
  return el("img", { class: cls, src: `assets/sprites/tile_${String(n).padStart(4, "0")}.png`, width: 16, height: 16, alt: "" })
}

function icon(name, cls = "sprite icon") {
  return el("img", { class: cls, src: `assets/icons/${name}.png`, width: 34, height: 34, alt: "" })
}

function foe(name) {
  return el("span", { class: "sprite foe", "data-foe": name, "aria-hidden": "true" })
}

function totalLevel(state) {
  return levelSum(doc.config, state.areas)
}

function currentPhase(state) {
  return phaseAt(totalLevel(state), phasesOf(doc.config))
}

function replay(node, cls) {
  node.classList.remove(cls)
  void node.offsetWidth
  node.classList.add(cls)
}

function calm() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches
}

function celebrate() {
  if (calm()) return
  const layer = document.querySelector("#confetti")
  const colors = ["#f2c14e", "#4fbf63", "#e5534b", "#f3ecd8", "#7fb2ff"]
  for (let i = 0; i < 26; i += 1) {
    const dx = Math.round((Math.random() - .5) * 320)
    const up = Math.round(80 + Math.random() * 140)
    const fall = Math.round(220 + Math.random() * 260)
    const turn = Math.round((Math.random() - .5) * 720)
    const delay = Math.round(Math.random() * 120)
    const style = `--dx:${dx}px;--up:${-up}px;--fall:${fall}px;--turn:${turn}deg;--c:${colors[i % colors.length]};animation-delay:${delay}ms`
    const bit = el("span", { class: i % 4 === 0 ? "bit coin-bit" : "bit", style })
    layer.append(bit)
    setTimeout(() => bit.remove(), 1600 + delay)
  }
}

let announceTimer = 0

function announce(text) {
  const status = document.querySelector("#status")
  clearTimeout(announceTimer)
  status.textContent = ""
  if (text) announceTimer = setTimeout(() => { status.textContent = text }, 150)
}

function burst(before, after) {
  const box = document.querySelector("#fx")
  const stage = document.querySelector("#avatar-stage") || document.createElement("div")
  const bits = []
  const spoken = []
  if (after.coins > before.coins) {
    bits.push(["gain", `+${after.coins - before.coins} monedas`])
    spoken.push(`Ganas ${after.coins - before.coins} monedas.`)
    replay(stage, "gain")
  }
  if (after.coins < before.coins) spoken.push(`Gastas ${before.coins - after.coins} monedas.`)
  if (after.hp < before.hp) {
    bits.push(["loss", `−${before.hp - after.hp} HP`])
    spoken.push(`Pierdes ${before.hp - after.hp} HP.`)
    replay(stage, "hurt")
  }
  if (after.hp > before.hp) spoken.push(`Recuperas ${after.hp - before.hp} HP.`)
  if (totalLevel(after) > totalLevel(before)) replay(stage, "levelup")
  bits.forEach(([kind, text], i) => {
    const bit = el("span", { class: `float ${kind}`, style: `animation-delay:${i * 180}ms` }, text)
    box.append(bit)
    setTimeout(() => bit.remove(), 1800 + i * 180)
  })
  return spoken
}

function localTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
}

function nowIso() {
  const date = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${dateKey(date)}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

function view() {
  return derive(doc, today, nowIso())
}

function countsOf(date) {
  return { ...(doc.days[date]?.counts || {}) }
}

function ensureDraft() {
  if (!draft) draft = countsOf(today)
  return draft
}

async function load() {
  try {
    const saved = await loadDoc()
    if (saved && configOk(saved.config)) doc = saved
  } catch {
    notice = "No se pudieron leer los datos de este navegador."
  }
  draft = countsOf(today)
  render()
  announce(notice)
}

function say(message) {
  notice = message
  render()
  announce(message)
}

async function persist(next) {
  const before = view()
  doc = next
  draft = countsOf(today)
  try {
    await saveDoc(doc)
  } catch {
    notice = "No se pudieron guardar los datos en este navegador."
  }
  render()
  const after = view()
  const spoken = burst(before, after)
  const card = levelUpCard(before, after, doc.config)
  if (card) {
    const from = heroOf(before)
    const to = heroOf(after)
    lamina = { ...card, className: from === to ? "" : CLASS_NAMES[to] }
    spoken.push(laminaSpeech(lamina))
    if (!before.dead && !after.dead) celebrate()
  }
  if (before.dead && !after.dead) spoken.push("Vuelves a la vida.")
  if (!before.dead && after.dead) spoken.push("YOU DIED.")
  announce([notice, ...spoken].filter(Boolean).join(" "))
  paintLamina()
}

function laminaSpeech(card) {
  const bits = [`Nivel ${card.level}.`]
  bits.push(card.coins > 0 ? `+${card.coins} monedas.` : "Sin monedas.")
  if (card.className) bits.push(`Clase ${card.className}.`)
  if (card.phase) bits.push(`Fase ${card.phase}.`)
  if (card.objectives.length) bits.push(`Nuevos objetivos: ${card.objectives.join(", ")}.`)
  if (card.products.length) bits.push(`Nuevos productos: ${card.products.join(", ")}.`)
  return bits.join(" ")
}

let paintingLamina = false

function paintLamina() {
  const old = document.querySelector(".lamina")
  if (old) {
    paintingLamina = true
    old.close()
    old.remove()
    paintingLamina = false
  }
  if (!lamina) return
  const card = lamina
  const dialog = el("dialog", { class: "lamina", "aria-labelledby": "lamina-titulo" }, [
    el("h2", { id: "lamina-titulo" }, `Nivel ${card.level}`),
    el("p", {}, card.coins > 0 ? `+${card.coins} monedas` : "Sin monedas."),
    card.className ? el("p", {}, `Clase ${card.className}.`) : null,
    card.phase ? el("p", {}, `Fase ${card.phase}.`) : null,
    card.objectives.length ? el("p", {}, `Nuevos objetivos: ${card.objectives.join(", ")}.`) : null,
    card.products.length ? el("p", {}, `Nuevos productos: ${card.products.join(", ")}.`) : null,
    el("button", { class: "primary", type: "button", id: "seguir", onClick: () => dialog.close() }, "Seguir")
  ])
  dialog.addEventListener("close", () => {
    if (paintingLamina) return
    lamina = null
    dialog.remove()
    const back = document.getElementById("guardar") || document.getElementById("continuar") || document.querySelector("#screen-title")
    back?.focus()
  })
  document.body.append(dialog)
  dialog.showModal()
  document.getElementById("seguir")?.focus()
}

function meter(value, max, label) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const track = el("div", { class: "track", role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": Math.max(0, value) })
  track.append(el("div", { class: "fill", style: `width:${pct}%` }))
  return track
}

function heroOf(state) {
  if (state.dead) return "ghost"
  const level = totalLevel(state)
  return HEROES.find(([min]) => level >= min)[1]
}

function paintHeader(state) {
  const home = panel === "inicio" || panel === "hub"
  const title = home ? "Glow Up" : titles[panel]
  document.querySelector("#back").hidden = panel === "inicio"
  document.querySelector("#screen-title").textContent = title
  document.title = home ? "Glow Up" : `${title} · Glow Up`
  document.querySelector("#coins-label").replaceChildren(String(state.coins), el("span", { class: "sr-only" }, " monedas"))
}

function menuData(state, id) {
  if (id === "hoy") {
    const saved = countsOf(today)
    const pending = state.rotation.quests.filter((id) => !(saved[id] > 0)).length
    if (doc.days[today]) return "Guardado"
    return pending === 1 ? "1 misión pendiente" : `${pending} misiones pendientes`
  }
  if (id === "areas") {
    const levels = doc.config.areas.map((area) => state.areas[area.id]?.level || 1)
    const mean = levels.reduce((sum, n) => sum + n, 0) / Math.max(1, levels.length)
    return `Nivel medio ${mean.toLocaleString("es-ES", { maximumFractionDigits: 1 })}`
  }
  if (id === "tienda") {
    const count = cartCount()
    return `${state.coins} monedas. ${count ? `${count} en el carrito` : "Carrito vacío"}`
  }
  if (id === "dias") {
    const days = Object.keys(state.dayLog).length
    return days === 1 ? "1 día guardado" : days ? `${days} días guardados` : "Sin días guardados"
  }
  if (id === "semana") return isSunday(today) ? "Hoy toca la revisión" : "La revisión es el domingo"
  return "Datos en este dispositivo"
}

function openPanel(id, card) {
  if (card.classList.contains("tap")) return
  cameFromHub = true
  if (calm()) {
    location.hash = id
    return
  }
  replay(card, "tap")
  setTimeout(() => { location.hash = id }, 220)
}

function panelHub(state) {
  const level = totalLevel(state)
  const hero = heroOf(state)
  const hp = Math.max(0, state.hp)
  const hpTrack = meter(hp, doc.config.hpMax, "HP")
  hpTrack.classList.add("hp")
  const stage = el("div", { class: state.dead ? "avatar-stage dead" : "avatar-stage", id: "avatar-stage" }, [
    el("span", { class: "hero", id: "avatar", "data-hero": hero, "aria-hidden": "true" }),
    el("span", { class: "level", "aria-hidden": "true" }, `Nv ${level}`)
  ])
  const menu = el("ul", { class: "menu" })
  for (const id of Object.keys(titles)) {
    const alert = id === "semana" && isSunday(today)
    menu.append(el("li", {}, el("button", {
      type: "button",
      id: `card-${id}`,
      class: alert ? "menu-card alert" : "menu-card",
      onClick: (event) => openPanel(id, event.currentTarget)
    }, [
      icon(MENU_ART[id], "menu-icon"),
      el("span", { class: "menu-text" }, [
        el("span", { class: "menu-title" }, titles[id]),
        el("span", { class: "menu-data" }, menuData(state, id))
      ]),
      el("span", { class: "menu-arrow", "aria-hidden": "true" })
    ])))
  }
  return el("section", { class: "panel hub", "aria-labelledby": "screen-title" }, [
    el("div", { class: "hub-hero compartment" }, [
      stage,
      el("div", { class: "hub-stats" }, [
        el("h2", { class: "class-name" }, CLASS_NAMES[hero]),
        el("p", { class: "meter-label" }, `Fase ${currentPhase(state).name}`),
        el("p", { class: "meter-label" }, `Nivel total ${level}`),
        el("p", { class: "meter-label" }, state.dead ? `HP ${hp} de ${doc.config.hpMax}. YOU DIED` : `HP ${hp} de ${doc.config.hpMax}`),
        hpTrack
      ])
    ]),
    deadBanner(state),
    notice ? el("p", {}, notice) : null,
    el("nav", { "aria-label": "Apartados" }, menu)
  ])
}

function deadBanner(state) {
  if (!state.dead) return null
  const end = reviveDeadline(state.dead.since, doc.config.reviveDays)
  const left = end.getTime() - Date.now()
  const when = left <= 0 ? "El plazo ya pasó. Sigues en YOU DIED hasta confirmar." : `Quedan ${Math.ceil(left / 86400000)} días para cumplir el castigo.`
  const punishment = doc.config.punishment.trim() || "Escribe el castigo en Ajustes."
  return el("section", { class: "banner", "aria-labelledby": "died-title" }, [
    el("h2", { id: "died-title" }, "YOU DIED"),
    el("p", {}, state.dead.causeName ? `Causa: ${state.dead.causeName}.` : "Causa sin hábito."),
    el("p", {}, punishment),
    el("p", {}, when),
    el("button", { class: "primary", type: "button", id: "revivir", onClick: () => {
      notice = "Castigo cumplido."
      focusNext = panel === "hub" ? ["card-hoy"] : []
      persist(revive(doc, today).doc)
    } }, "He cumplido el castigo")
  ])
}

function previewText(state, counts) {
  if (!Object.keys(counts).length) return "Hoy todavía no hay cambios."
  const day = state.dayLog[today]
  if (!day) return "Hoy todavía no hay cambios."
  const exp = Object.values(day.exp).reduce((sum, n) => sum + n, 0)
  return `Hoy: +${exp} EXP, +${day.coinsIn} monedas, −${day.hpLoss} HP.`
}

function offeredToday(state) {
  return { quests: state.rotation.quests, foes: state.rotation.foes }
}

function panelInicio(state) {
  const level = totalLevel(state)
  const hero = heroOf(state)
  const stage = el("div", { class: state.dead ? "avatar-stage dead start-stage" : "avatar-stage start-stage", id: "avatar-stage" }, [
    el("span", { class: "hero", "data-hero": hero, "aria-hidden": "true" }),
    el("span", { class: "level", "aria-hidden": "true" }, `Nv ${level}`)
  ])
  return el("section", { class: "panel start" }, [
    stage,
    el("p", { class: "quiet" }, "Fase"),
    el("h2", { class: "phase-name" }, currentPhase(state).name),
    el("p", { class: "meter-label" }, `Nivel ${level}`),
    state.dead ? el("p", {}, "YOU DIED") : null,
    el("button", { class: "primary continue", type: "button", id: "continuar", onClick: () => {
      cameFromStart = true
      location.hash = "menu"
    } }, "Continuar")
  ])
}

function panelHoy(state) {
  const counts = ensureDraft()
  const byId = (list, id) => list.find((entry) => entry.id === id)
  const habits = [
    ...state.rotation.quests.map((id) => byId(doc.config.good, id)).filter(Boolean).map((habit) => ({ ...habit, kind: "good" })),
    ...state.rotation.foes.map((id) => byId(doc.config.bad, id)).filter(Boolean).map((habit) => ({ ...habit, kind: "bad" }))
  ]
  const quests = el("ul", { class: "list" })
  const enemies = el("ul", { class: "list" })
  let enemyIndex = 0
  for (const habit of habits) {
    const count = Math.max(0, Math.floor(Number(counts[habit.id]) || 0))
    const art = habit.kind === "good" ? icon(QUEST_ART[habit.id] ?? QUEST_AREA_ART[habit.area] ?? "I_Map") : foe(ENEMY_ART[enemyIndex++ % ENEMY_ART.length])
    const tag = habit.kind === "good" ? `+${habit.exp} EXP` : `−${habit.hp} HP`
    const row = el("li", { class: habit.repeatable ? `item row ${habit.kind}` : `item ${habit.kind}` })
    if (habit.repeatable) {
      row.append(
        art,
        el("span", { class: "grow" }, `${habit.name}. ${count}`),
        el("button", { type: "button", id: `menos-${habit.id}`, "aria-label": `Quitar uno a ${habit.name}`, onClick: () => setCount(habit.id, count - 1) }, "−"),
        el("button", { type: "button", id: `mas-${habit.id}`, "aria-label": `Sumar uno a ${habit.name}`, onClick: () => setCount(habit.id, count + 1) }, "+")
      )
    } else {
      row.append(el("button", {
        type: "button",
        id: `habito-${habit.id}`,
        class: "habit",
        "aria-pressed": count > 0 ? "true" : "false",
        onClick: () => setCount(habit.id, count > 0 ? 0 : 1)
      }, [
        art,
        el("span", { class: "grow" }, habit.name),
        count > 0 ? el("span", { class: "check", "aria-hidden": "true" }, "✓") : null,
        el("span", { class: "tag" }, tag)
      ]))
    }
    ;(habit.kind === "good" ? quests : enemies).append(row)
  }
  const savedCounts = countsOf(today)
  const dirty = JSON.stringify(counts) !== JSON.stringify(savedCounts)
  const preview = derive(saveDay(doc, today, counts, offeredToday(state)), today, nowIso())
  const line = notice || (dirty ? `Sin guardar. ${previewText(preview, counts)}` : previewText(state, counts))
  return el("section", { class: "panel" }, [
    el("h2", {}, "Objetivos de hoy"),
    el("p", { class: "quiet" }, "Mañana cambian."),
    deadBanner(state),
    el("div", { class: "compartment" }, [el("h3", {}, "Misiones"), quests]),
    el("div", { class: "compartment foes" }, [el("h3", {}, "Enemigos"), enemies]),
    el("p", { class: "quiet", id: "hoy-resumen" }, line),
    el("button", { class: "primary", type: "button", id: "guardar", onClick: () => {
      notice = "Día guardado."
      const stateNow = view()
      persist(saveDay(doc, today, ensureDraft(), offeredToday(stateNow)))
    } }, "Guardar el día")
  ])
}

function setCount(id, value) {
  const counts = ensureDraft()
  const next = Math.max(0, value)
  if (next) counts[id] = next
  else delete counts[id]
  notice = ""
  render()
  announce(document.querySelector("#hoy-resumen")?.textContent)
}

function panelAreas(state) {
  const list = el("ul", { class: "list" })
  for (const area of doc.config.areas) {
    const progress = state.areas[area.id] || { level: 1, exp: 0 }
    const need = progress.level * 100
    list.append(el("li", { class: "card compartment" }, [
      el("div", { class: "row" }, [sprite(AREA_ART[area.id] ?? 102, "sprite big"), el("h2", { class: "sub grow" }, area.name), el("span", { class: "tag" }, `Nv ${progress.level}`)]),
      area.goal ? el("p", {}, area.goal) : el("p", { class: "quiet" }, "Sin meta."),
      el("p", {}, `Nivel ${progress.level}. ${progress.exp} de ${need} EXP`),
      meter(progress.exp, need, `EXP de ${area.name}`)
    ]))
  }
  return el("section", { class: "panel" }, [deadBanner(state), list])
}

function cartLines() {
  return Array.isArray(doc.cart) ? doc.cart.filter((line) => line.qty > 0) : []
}

function cartCount() {
  return cartLines().reduce((sum, line) => sum + line.qty, 0)
}

function shopItem(id) {
  return doc.config.shop.find((item) => item.id === id)
}

function cartTotal() {
  return cartLines().reduce((sum, line) => sum + (shopItem(line.itemId)?.price || 0) * line.qty, 0)
}

function writeCart(lines, message) {
  const next = structuredClone(doc)
  next.cart = lines.filter((line) => line.qty > 0)
  notice = message
  persist(next)
}

function onMarket(id) {
  return view().rotation.shop.includes(id)
}

function addToCart(id) {
  if (view().dead) {
    say("No puedes comprar en YOU DIED.")
    return
  }
  if (!onMarket(id)) {
    say("Hoy no está en el mercado.")
    return
  }
  const lines = cartLines().map((line) => ({ ...line }))
  const found = lines.find((line) => line.itemId === id)
  if (found) found.qty += 1
  else lines.push({ itemId: id, qty: 1 })
  const item = shopItem(id)
  writeCart(lines, item ? `${item.name} en el carrito.` : "Añadido.")
}

function changeQty(id, delta) {
  if (delta > 0 && !onMarket(id)) {
    say("Hoy no está en el mercado.")
    return
  }
  const current = cartLines()
  const index = current.findIndex((line) => line.itemId === id)
  const lines = current.map((line) => line.itemId === id ? { ...line, qty: line.qty + delta } : { ...line })
  const item = shopItem(id)
  const qty = lines[index]?.qty ?? 0
  if (qty < 1) {
    const rest = current.filter((line) => line.itemId !== id)
    const neighbour = rest[index] ?? rest[index - 1]
    focusNext = neighbour ? [`carrito-menos-${neighbour.itemId}`] : ["carrito-titulo"]
  }
  const name = item?.name ?? "Producto"
  writeCart(lines, qty < 1 ? `${name} fuera del carrito.` : `${name}: ${qty} en el carrito.`)
}

function checkout(state) {
  const lines = cartLines()
  if (!lines.length) return
  if (state.dead) {
    say("No puedes comprar en YOU DIED.")
    return
  }
  if (lines.some((line) => !state.rotation.shop.includes(line.itemId))) {
    say("Hoy no está en el mercado.")
    return
  }
  if (state.coins < cartTotal()) {
    say("No llega el saldo.")
    return
  }
  let current = doc
  for (const line of lines) {
    for (let i = 0; i < line.qty; i += 1) {
      const result = buy(current, line.itemId, nowIso())
      if (!result.ok) {
        notice = result.reason === "muerto" ? "No puedes comprar en YOU DIED." : result.reason === "mercado" ? "Hoy no está en el mercado." : "No llega el saldo."
        persist(current)
        return
      }
      current = result.doc
    }
  }
  current.cart = []
  notice = "Pedido confirmado."
  focusNext = ["carrito-titulo"]
  persist(current)
  celebrate()
}

function panelTienda(state) {
  const lines = cartLines()
  const total = cartTotal()
  const short = total > state.coins
  const cartList = el("ul", { class: "list" })
  for (const line of lines) {
    const item = shopItem(line.itemId)
    if (!item) continue
    cartList.append(el("li", { class: "row" }, [
      icon(SHOP_ART[item.id] ?? "I_Chest01"),
      el("span", { class: "grow" }, `${item.name}. ${line.qty} × ${item.price}`),
      el("button", { type: "button", id: `carrito-menos-${item.id}`, "aria-label": `Quitar uno de ${item.name}`, onClick: () => changeQty(item.id, -1) }, "−"),
      el("button", { type: "button", id: `carrito-mas-${item.id}`, "aria-label": `Sumar uno de ${item.name}`, disabled: !state.rotation.shop.includes(item.id), onClick: () => changeQty(item.id, 1) }, "+")
    ]))
  }
  const payWhy = state.dead ? "No puedes comprar en YOU DIED." : !lines.length ? "El carrito está vacío." : short ? `Faltan ${total - state.coins} monedas.` : "Pagar"
  const market = state.rotation.shop
  const reservedOpen = state.reservations.filter((item) => !item.confirmed)
  const shown = []
  for (const id of market) {
    const item = shopItem(id)
    if (item) shown.push(item)
  }
  for (const hold of reservedOpen) {
    if (market.includes(hold.itemId) || shown.some((item) => item.id === hold.itemId)) continue
    const item = shopItem(hold.itemId)
    if (item) shown.push({ ...item, hold: true })
  }
  const catalog = el("ul", { class: "catalog" })
  for (const item of shown) {
    const onShelf = market.includes(item.id)
    catalog.append(el("li", { class: "product" }, [
      el("div", { class: "stage" }, icon(SHOP_ART[item.id] ?? "I_Chest01", "sprite item")),
      el("h3", { id: `producto-${item.id}` }, item.name),
      el("p", { class: "price" }, [el("span", { class: "coin", "aria-hidden": "true" }), item.wait48h ? `${item.price} monedas. Se confirma a las 48 h.` : `${item.price} monedas.`]),
      item.hold ? el("p", {}, "Reservado") : el("button", {
        type: "button",
        id: `al-carrito-${item.id}`,
        "aria-describedby": `producto-${item.id}`,
        disabled: Boolean(state.dead) || !onShelf,
        onClick: () => addToCart(item.id)
      }, state.dead ? "No puedes comprar en YOU DIED." : "Al carrito")
    ]))
  }
  const reserved = state.reservations.filter((item) => !item.confirmed)
  const done = state.reservations.filter((item) => item.confirmed)
  return el("section", { class: "panel" }, [
    el("p", { class: "quiet" }, "Paga con las monedas que tienes."),
    deadBanner(state),
    notice ? el("p", {}, notice) : null,
    el("div", { class: "compartment" }, [
      el("h2", { class: "sub", id: "carrito-titulo", tabindex: "-1" }, "Carrito"),
      lines.length ? cartList : el("p", { class: "quiet" }, "Todavía no hay nada."),
      el("p", {}, lines.length ? `Total ${total} monedas. Tienes ${state.coins}.` : `Tienes ${state.coins} monedas.`),
      el("button", {
        class: "primary",
        type: "button",
        id: "pagar",
        disabled: Boolean(state.dead) || !lines.length || short,
        onClick: () => checkout(state)
      }, payWhy)
    ]),
    el("div", { class: "compartment" }, [
      el("h2", { class: "sub" }, "Mercado de hoy"),
      el("p", { class: "quiet" }, "Mañana cambian."),
      catalog
    ]),
    el("div", { class: "compartment" }, [
      el("h2", { class: "sub" }, "Reservas"),
      reserved.length ? el("ul", { class: "list" }, reserved.map((item) => el("li", {}, `${item.name}. Reservado hasta el ${localTime(item.confirmAt)}.`))) : el("p", { class: "quiet" }, "No hay reservas."),
      done.length ? el("ul", { class: "list" }, done.map((item) => el("li", {}, `${item.name}. Confirmado.`))) : null
    ])
  ])
}

function panelDias(state) {
  const dates = Object.keys(state.dayLog).sort().reverse()
  const list = el("ul", { class: "list" })
  for (const date of dates) {
    const day = state.dayLog[date]
    const exp = Object.entries(day.exp).map(([area, n]) => `${area} ${n}`).join(", ") || "sin EXP"
    const levels = day.levels.length ? ` Subidas: ${day.levels.map((item) => `${item.area} ${item.level}`).join(", ")}.` : ""
    list.append(el("li", { class: "card" }, `${date}. EXP ${exp}. HP ${day.hpEnd}. Monedas +${day.coinsIn} −${day.coinsOut}, saldo ${day.coinsEnd}.${levels}`))
  }
  const deaths = state.deaths.length
    ? el("ul", { class: "list" }, state.deaths.map((death) => el("li", {}, `${death.date}. ${death.causeName || death.causeId}. Castigo el ${death.revivedAt}.`)))
    : el("p", { class: "quiet" }, "No hay muertes.")
  return el("section", { class: "panel" }, [
    dates.length ? list : el("p", { class: "quiet" }, "Todavía no hay días guardados."),
    el("h2", { class: "sub" }, "Muertes"),
    deaths
  ])
}

function panelSemana(state) {
  if (!isSunday(today)) {
    return el("section", { class: "panel" }, [el("p", {}, "La revisión se hace el domingo.")])
  }
  const week = weekSlice(state.dayLog, today)
  const note = doc.weekly[today] || { best: "", worst: "", improve: "" }
  const exp = Object.entries(week.expByArea).map(([area, n]) => `${area} ${n}`).join(", ") || "sin EXP"
  const levels = week.levels.length ? week.levels.map((item) => `${item.area} nivel ${item.level}`).join(", ") : "ninguna"
  const form = el("form", { class: "stack", onSubmit: (event) => {
    event.preventDefault()
    const data = new FormData(event.target)
    const next = structuredClone(doc)
    next.weekly[today] = { best: String(data.get("best") || ""), worst: String(data.get("worst") || ""), improve: String(data.get("improve") || "") }
    notice = "Revisión guardada."
    persist(next)
  }})
  form.append(
    el("label", {}, ["Lo mejor", el("input", { type: "text", name: "best", value: note.best })]),
    el("label", {}, ["Lo que más HP quitó", el("input", { type: "text", name: "worst", value: note.worst })]),
    el("label", {}, ["Una mejora", el("input", { type: "text", name: "improve", value: note.improve })]),
    el("button", { class: "primary", type: "submit", id: "guardar-revision" }, "Guardar revisión")
  )
  return el("section", { class: "panel" }, [
    el("p", {}, `EXP: ${exp}.`),
    el("p", {}, `Subidas: ${levels}.`),
    el("p", {}, `HP al final: ${week.hpEnd ?? state.hp}.`),
    el("p", {}, `Monedas +${week.coinsPlus} −${week.coinsMinus}. Saldo ${state.coins}.`),
    form
  ])
}

function panelAjustes() {
  const area = el("textarea", { id: "config-json", "aria-label": "Configuración en JSON" }, JSON.stringify(editorConfig(doc.config), null, 2))
  return el("section", { class: "panel" }, [
    el("p", {}, "Los datos se quedan en este dispositivo."),
    jsonError ? el("p", { class: "error", role: "alert" }, jsonError) : null,
    area,
    el("button", { class: "primary", type: "button", id: "guardar-ajustes", onClick: () => {
      try {
        const parsed = JSON.parse(area.value)
        if (!configOk(parsed)) { jsonError = "Ese JSON no cumple la config."; render(); return }
        const next = structuredClone(doc)
        next.config = parsed
        jsonError = ""
        notice = "Ajustes guardados."
        persist(next)
      } catch {
        jsonError = "Ese JSON no se puede leer."
        render()
      }
    } }, "Guardar ajustes"),
    el("button", { type: "button", id: "exportar", onClick: exportCopy }, "Exportar copia"),
    el("label", { class: "file" }, ["Importar copia", el("input", { type: "file", id: "importar", accept: "application/json", onChange: importCopy })]),
    el("p", { class: "quiet" }, "En este ordenador, ábrela en localhost y usa Instalar en el menú del navegador. En el móvil hace falta HTTPS. Un archivo suelto no se instala.")
  ])
}

function exportCopy() {
  const blob = new Blob([JSON.stringify({ version: 1, ...doc }, null, 2)], { type: "application/json" })
  const link = el("a", { href: URL.createObjectURL(blob), download: "glow-up.json" })
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function cleanCart(cart, config) {
  if (!Array.isArray(cart)) return []
  return cart
    .filter((line) => line && typeof line.itemId === "string" && Number.isInteger(line.qty) && line.qty > 0)
    .filter((line) => config.shop.some((item) => item.id === line.itemId))
    .map((line) => ({ itemId: line.itemId, qty: line.qty }))
}

function importCopy(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result))
      if (!configOk(parsed.config) || typeof parsed.days !== "object") {
        jsonError = "Esa copia no vale."
        render()
        return
      }
      jsonError = ""
      notice = "Copia importada."
      persist({
        config: parsed.config,
        days: parsed.days || {},
        buys: parsed.buys || [],
        revives: parsed.revives || [],
        weekly: parsed.weekly || {},
        cart: cleanCart(parsed.cart, parsed.config)
      })
    } catch {
      jsonError = "Esa copia no se puede leer."
      render()
    }
  }
  reader.readAsText(file)
}

function render() {
  const focusId = document.activeElement?.id || ""
  const state = view()
  paintHeader(state)
  const body = {
    inicio: () => panelInicio(state),
    hub: () => panelHub(state),
    hoy: () => panelHoy(state),
    areas: () => panelAreas(state),
    tienda: () => panelTienda(state),
    dias: () => panelDias(state),
    semana: () => panelSemana(state),
    ajustes: () => panelAjustes()
  }[panel]()
  body.setAttribute("aria-labelledby", "screen-title")
  if (entering) body.classList.add(entering)
  entering = ""
  const hadFocus = main.contains(document.activeElement)
  main.replaceChildren(body)
  const fallbacks = focusNext
  focusNext = []
  if (!hadFocus && !focusId) return
  for (const id of [focusId, ...fallbacks]) {
    const target = id && document.getElementById(id)
    if (!target) continue
    target.focus()
    if (document.activeElement === target) return
  }
  if (hadFocus) document.querySelector("#screen-title").focus()
}

function panelFromHash() {
  const id = decodeURIComponent(location.hash.slice(1))
  if (!id || id === "inicio") return "inicio"
  if (id === "menu") return "hub"
  return Object.hasOwn(titles, id) ? id : null
}

function route() {
  const next = panelFromHash()
  if (next === null || next === panel) return
  document.querySelector(".lamina")?.close()
  const prev = panel
  panel = next
  entering = next === "hub" ? "to-hub" : next === "inicio" ? "" : "from-hub"
  notice = ""
  if (next === "hub") cameFromHub = false
  if (next === "inicio") cameFromStart = false
  render()
  main.scrollTop = 0
  if (next === "hub") (document.getElementById(prev === "inicio" ? "card-hoy" : `card-${prev}`) || document.querySelector("#screen-title"))?.focus()
  else if (next === "inicio") document.getElementById("continuar")?.focus()
  else document.querySelector("#screen-title")?.focus()
}

window.addEventListener("hashchange", route)

document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault()
  main.focus()
})

document.querySelector("#back").addEventListener("click", () => {
  if (panel === "hub") {
    if (cameFromStart) {
      cameFromStart = false
      history.back()
      return
    }
    location.hash = "inicio"
    return
  }
  if (cameFromHub) {
    history.back()
    return
  }
  location.hash = "menu"
})

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {})

load()
