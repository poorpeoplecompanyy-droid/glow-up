import test from "node:test"
import assert from "node:assert/strict"
import { buy, configOk, defaultConfig, derive, emptyDocument, levelUpCard, phaseAt, revive, rotationFor, saveDay, weekSlice } from "../rules.js"

function doc(config = defaultConfig()) {
  return emptyDocument(config)
}

test("subir de nivel cuesta N×100 y la EXP sobrante sigue", () => {
  const state = doc()
  state.days["2026-10-19"] = { savedAt: "2026-10-19T10:00:00.000Z", counts: { publish: 6 } }
  const view = derive(state, "2026-10-19")
  assert.equal(view.areas.contenido.level, 2)
  assert.equal(view.areas.contenido.exp, 20)
  assert.equal(view.coins, 170)
})

test("varias subidas en el mismo día arrastran el resto", () => {
  const state = doc()
  state.days["2026-10-19"] = { savedAt: "2026-10-19T10:00:00.000Z", counts: { publish: 18 } }
  const view = derive(state, "2026-10-19")
  assert.equal(view.areas.contenido.level, 3)
  assert.equal(view.areas.contenido.exp, 60)
  assert.equal(view.coins, 460)
})

test("morir, seguir sumando EXP y no ganar monedas ni de nivel", () => {
  const state = doc(defaultConfig())
  state.config.hpMax = 30
  state.days["2026-10-18"] = { savedAt: "2026-10-18T10:00:00.000Z", counts: { impulse: 1 } }
  state.days["2026-10-19"] = { savedAt: "2026-10-19T10:00:00.000Z", counts: { publish: 6 } }
  const view = derive(state, "2026-10-19")
  assert.equal(view.hp, 0)
  assert.equal(view.dead.causeId, "impulse")
  assert.equal(view.areas.contenido.level, 2)
  assert.equal(view.coins, 0)
  assert.equal(view.dayLog["2026-10-19"].coinsIn, 0)
})

test("muerto no compra y la tienda no deja saldo negativo", () => {
  const state = doc()
  state.config.hpMax = 30
  state.config.shop = [
    { id: "cheap", name: "Barato", price: 5 },
    { id: "dear", name: "Caro", price: 999 }
  ]
  state.days["2026-10-18"] = { savedAt: "2026-10-18T10:00:00.000Z", counts: { impulse: 1, sleep: 1 } }
  const denied = buy(state, "cheap", "2026-10-18T11:00:00.000Z")
  assert.equal(denied.ok, false)
  assert.equal(denied.reason, "muerto")
  assert.equal(derive(state, "2026-10-18").coins, 10)

  const alive = doc()
  alive.config.shop = state.config.shop
  alive.days["2026-10-19"] = { savedAt: "2026-10-19T10:00:00.000Z", counts: { sleep: 1 } }
  const poor = buy(alive, "dear", "2026-10-19T11:00:00.000Z")
  assert.equal(poor.ok, false)
  assert.equal(poor.reason, "saldo")
  assert.equal(derive(alive, "2026-10-19").coins, 10)
})

test("comprar no quita HP y un ítem de 48 h reserva ya y se confirma después", () => {
  let state = doc()
  state.config.shop = [
    { id: "now", name: "Ya", price: 5 },
    { id: "later", name: "Luego", price: 5, wait48h: true }
  ]
  state.days["2026-10-01"] = { savedAt: "2026-10-01T08:00:00.000Z", counts: { sleep: 1 } }
  state = buy(state, "now", "2026-10-01T09:00:00.000Z").doc
  state = buy(state, "later", "2026-10-01T10:00:00.000Z").doc
  const early = derive(state, "2026-10-02", "2026-10-02T10:00:00.000Z")
  assert.equal(early.hp, 1000)
  assert.equal(early.coins, 0)
  assert.equal(early.reservations[0].confirmed, true)
  assert.equal(early.reservations[1].confirmed, false)
  const later = derive(state, "2026-10-03", "2026-10-03T10:00:00.000Z")
  assert.equal(later.reservations[1].confirmed, true)
  assert.equal(later.coins, 0)
})

test("a los 7 días sigue muerto hasta confirmar, y revivir devuelve el HP", () => {
  let state = doc()
  state.config.hpMax = 30
  state.days["2026-10-01"] = { savedAt: "2026-10-01T10:00:00.000Z", counts: { impulse: 1 } }
  const still = derive(state, "2026-10-20")
  assert.ok(still.dead)
  assert.equal(still.deaths.length, 0)
  const back = revive(state, "2026-10-20")
  assert.equal(back.ok, true)
  const view = derive(back.doc, "2026-10-20")
  assert.equal(view.dead, null)
  assert.equal(view.hp, 30)
  assert.equal(view.deaths[0].causeId, "impulse")
  assert.equal(view.deaths[0].revivedAt, "2026-10-20")
})

test("repetible cuenta N, el resto una vez, y el ahorro solo el domingo", () => {
  const state = doc()
  state.days["2026-10-19"] = { savedAt: "2026-10-19T10:00:00.000Z", counts: { sleep: 4, publish: 3, weeklySave: 1 } }
  state.days["2026-10-18"] = { savedAt: "2026-10-18T10:00:00.000Z", counts: { weeklySave: 1 } }
  const view = derive(state, "2026-10-19")
  assert.equal(view.dayLog["2026-10-19"].exp.salud, 10)
  assert.equal(view.dayLog["2026-10-19"].exp.contenido, 60)
  assert.equal(view.dayLog["2026-10-19"].exp.finanzas, undefined)
  assert.equal(view.dayLog["2026-10-18"].exp.finanzas, 25)
  assert.equal(view.dayLog["2026-10-18"].coinsIn, 25)
})

test("el día 1 devuelve el HP solo con el ajuste, también sin check-in, y no si está muerto", () => {
  const state = doc()
  state.days["2026-09-30"] = { savedAt: "2026-09-30T10:00:00.000Z", counts: { social: 1 } }
  state.days["2026-10-01"] = { savedAt: "2026-10-01T10:00:00.000Z", counts: { social: 1 } }
  assert.equal(derive(state, "2026-10-01").hp, 960)
  state.config.monthlyHpReset = true
  assert.equal(derive(state, "2026-10-01").hp, 980)

  const gap = doc()
  gap.config.monthlyHpReset = true
  gap.days["2026-09-30"] = { savedAt: "2026-09-30T10:00:00.000Z", counts: { social: 1 } }
  assert.equal(derive(gap, "2026-10-02").hp, 1000)

  gap.config.hpMax = 20
  const dead = derive(gap, "2026-10-02")
  assert.equal(dead.hp, 0)
  assert.ok(dead.dead)
})

test("guardar el mismo día otra vez sustituye el efecto", () => {
  let state = saveDay(doc(), "2026-10-19", { sleep: 1 })
  assert.equal(derive(state, "2026-10-19").areas.salud.exp, 10)
  state = saveDay(state, "2026-10-19", {})
  assert.equal(derive(state, "2026-10-19").areas.salud.exp, 0)
  assert.equal(derive(state, "2026-10-19").coins, 0)
})

test("la semana que termina en domingo resume el día", () => {
  const state = doc()
  state.days["2026-10-18"] = { savedAt: "2026-10-18T10:00:00.000Z", counts: { sleep: 1 } }
  const view = derive(state, "2026-10-18")
  const week = weekSlice(view.dayLog, "2026-10-18")
  assert.equal(week.expByArea.salud, 10)
  assert.equal(week.coinsPlus, 10)
  assert.equal(week.hpEnd, 1000)
})

test("una configuración incompleta no se acepta", () => {
  assert.equal(configOk(defaultConfig()), true)
  assert.equal(configOk({ hpMax: 0 }), false)
  const legacy = defaultConfig()
  delete legacy.phases
  delete legacy.daily
  assert.equal(configOk(legacy), true)
})

test("la fase y la rotación dependen de la fecha y del nivel total", () => {
  const config = defaultConfig()
  assert.equal(phaseAt(5, config.phases).name, "Aprendiz")
  assert.equal(phaseAt(8, config.phases).name, "Aventurero")
  assert.equal(phaseAt(12, config.phases).name, "Héroe")
  assert.equal(phaseAt(17, config.phases).name, "Leyenda")
  const one = rotationFor(config, "2026-10-20", 5)
  const two = rotationFor(config, "2026-10-21", 5)
  assert.deepEqual(one, rotationFor(config, "2026-10-20", 5))
  assert.equal(one.quests.length, 3)
  assert.equal(one.foes.length, 2)
  assert.equal(one.shop.length, 2)
  assert.notDeepEqual(one.quests, two.quests)
  config.daily = { quests: 99, foes: 99, shop: 99 }
  assert.equal(rotationFor(config, "2026-10-19", 17).quests.includes("weeklySave"), false)
  assert.equal(rotationFor(config, "2026-10-18", 17).quests.includes("weeklySave"), true)
})

test("solo cuenta lo ofrecido ese día y el mercado cierra lo demás", () => {
  const saved = saveDay(emptyDocument(), "2026-10-20", { sleep: 1, publish: 2 }, { quests: ["sleep"], foes: [] })
  const view = derive(saved, "2026-10-20")
  assert.equal(view.areas.salud.exp, 10)
  assert.equal(view.areas.contenido.exp, 0)
  const denied = buy(emptyDocument(), "midBuy", "2026-10-20T12:00:00")
  assert.equal(denied.reason, "mercado")
})

test("subir de fase anuncia monedas y lo nuevo, y muerto no gana monedas", () => {
  const config = defaultConfig()
  config.good = [...config.good, { id: "x", name: "X", area: "salud", exp: 600, coins: 0 }]
  const before = derive(emptyDocument(config), "2026-10-20")
  const after = derive(saveDay(emptyDocument(config), "2026-10-20", { x: 1 }), "2026-10-20")
  const card = levelUpCard(before, after, config)
  assert.equal(after.areas.salud.level, 4)
  assert.equal(card.level, 8)
  assert.equal(card.coins, 150)
  assert.equal(card.phase, "Aventurero")
  config.hpMax = 5
  config.bad = [{ id: "b", name: "B", hp: 5 }]
  let dead = saveDay(emptyDocument(config), "2026-10-19", { b: 1 })
  const deadBefore = derive(dead, "2026-10-20")
  dead = saveDay(dead, "2026-10-20", { x: 1 })
  const deadAfter = derive(dead, "2026-10-20")
  assert.equal(levelUpCard(deadBefore, deadAfter, config).coins, 0)
  assert.equal(deadAfter.coins, 0)
})
