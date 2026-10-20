import test from "node:test"
import assert from "node:assert/strict"
import {
  buy,
  configOk,
  defaultConfig,
  derive,
  editorConfig,
  emptyDocument,
  levelUpCard,
  phaseAt,
  revive,
  rotationFor,
  saveDay,
  weekSlice
} from "../rules.js"

test("subir de nivel cuesta N×100 y la EXP sobrante sigue", () => {
  const config = defaultConfig()
  config.good = [{ id: "x", name: "X", area: "salud", exp: 250, coins: 0 }]
  config.levelUpCoins = 50
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { x: 1 })
  const view = derive(doc, "2026-10-19")
  assert.equal(view.areas.salud.level, 2)
  assert.equal(view.areas.salud.exp, 150)
  assert.equal(view.coins, 50)
})

test("una sola marca puede subir varios niveles y cada uno da monedas", () => {
  const config = defaultConfig()
  config.good = [{ id: "x", name: "X", area: "salud", exp: 300, coins: 0 }]
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { x: 1 })
  const view = derive(doc, "2026-10-19")
  assert.equal(view.areas.salud.level, 3)
  assert.equal(view.areas.salud.exp, 0)
  assert.equal(view.coins, 100)
})

test("al morir no se ganan monedas, ni las de subir de nivel, y la EXP sigue", () => {
  const config = defaultConfig()
  config.hpMax = 10
  config.good = [{ id: "x", name: "X", area: "salud", exp: 200, coins: 5 }]
  config.bad = [{ id: "b", name: "B", hp: 10 }]
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { x: 1, b: 1 })
  let view = derive(doc, "2026-10-19")
  assert.equal(view.hp, 0)
  assert.equal(view.dead.causeId, "b")
  assert.equal(view.areas.salud.level, 2)
  assert.equal(view.coins, 55)

  doc = saveDay(doc, "2026-10-20", { x: 1 })
  view = derive(doc, "2026-10-20")
  assert.equal(view.areas.salud.level, 3)
  assert.equal(view.coins, 55)
  assert.ok(view.dead)
})

test("la causa de la muerte es el mal hábito que más HP quitó", () => {
  const config = defaultConfig()
  config.hpMax = 20
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { junk: 1, late: 1 })
  const view = derive(doc, "2026-10-19")
  assert.equal(view.dead.causeId, "junk")
  assert.equal(view.hp, 0)
})

test("revivir devuelve el HP al máximo y guarda la muerte, también pasados los 7 días", () => {
  const config = defaultConfig()
  config.hpMax = 10
  config.reviveDays = 7
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-01", { late: 1 })
  const result = revive(doc, "2026-10-20")
  assert.equal(result.ok, true)
  const view = derive(result.doc, "2026-10-20")
  assert.equal(view.dead, null)
  assert.equal(view.hp, 10)
  assert.equal(view.deaths.length, 1)
  assert.equal(view.deaths[0].date, "2026-10-01")
  assert.equal(view.deaths[0].revivedAt, "2026-10-20")
  assert.equal(view.deaths[0].causeId, "late")
})

test("la tienda no deja el saldo en negativo ni compra estando muerto", () => {
  let doc = emptyDocument()
  doc.config.daily = { quests: 3, foes: 2, shop: 9 }
  doc = saveDay(doc, "2026-10-19", { noSpend: 1 })
  let denied = buy(doc, "food", "2026-10-19T12:00")
  assert.equal(denied.ok, false)
  assert.equal(denied.reason, "saldo")
  assert.equal(derive(doc, "2026-10-19").coins, 5)

  const config = defaultConfig()
  config.hpMax = 10
  doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { noSpend: 1, late: 1 })
  doc.config.shop = [{ id: "cheap", name: "Barato", price: 5 }]
  denied = buy(doc, "cheap", "2026-10-19T12:00")
  assert.equal(denied.ok, false)
  assert.equal(denied.reason, "muerto")
})

test("comprar con el saldo justo deja las monedas a cero", () => {
  const config = defaultConfig()
  config.shop = [{ id: "cheap", name: "Barato", price: 5 }]
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { noSpend: 1 })
  const result = buy(doc, "cheap", "2026-10-19T12:00")
  assert.equal(result.ok, true)
  assert.equal(derive(result.doc, "2026-10-19", "2026-10-19T12:00").coins, 0)
})

test("un ítem de 48 h reserva las monedas y se confirma después", () => {
  const config = defaultConfig()
  config.phases[0].shop = [...config.phases[0].shop, "midBuy"]
  config.daily = { ...config.daily, shop: 9 }
  config.good = [{ id: "x", name: "X", area: "finanzas", exp: 0, coins: 1000 }]
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-19", { x: 1 })
  const bought = buy(doc, "midBuy", "2026-10-19T10:00")
  assert.equal(bought.ok, true)
  const soon = derive(bought.doc, "2026-10-19", "2026-10-19T10:00")
  assert.equal(soon.coins, 0)
  assert.equal(soon.reservations[0].confirmed, false)
  const later = derive(bought.doc, "2026-10-21", "2026-10-21T10:00")
  assert.equal(later.reservations[0].confirmed, true)
  assert.equal(later.coins, 0)
})

test("lo repetible suma N y lo demás cuenta una vez", () => {
  let doc = emptyDocument()
  doc = saveDay(doc, "2026-10-19", { publish: 3, sleep: 5 })
  const view = derive(doc, "2026-10-19")
  assert.equal(view.areas.contenido.exp, 60)
  assert.equal(view.areas.salud.exp, 10)
  assert.equal(view.coins, 70)
})

test("el ahorro semanal solo cuenta el domingo", () => {
  let doc = emptyDocument()
  doc = saveDay(doc, "2026-10-19", { weeklySave: 1 })
  assert.equal(derive(doc, "2026-10-19").areas.finanzas.exp, 0)
  doc = saveDay(doc, "2026-10-18", { weeklySave: 1 })
  assert.equal(derive(doc, "2026-10-19").areas.finanzas.exp, 25)
})

test("guardar otra vez el mismo día sustituye el efecto", () => {
  let doc = emptyDocument()
  doc = saveDay(doc, "2026-10-19", { sleep: 1 })
  assert.equal(derive(doc, "2026-10-19").areas.salud.exp, 10)
  doc = saveDay(doc, "2026-10-19", {})
  assert.equal(derive(doc, "2026-10-19").areas.salud.exp, 0)
  assert.equal(derive(doc, "2026-10-19").coins, 0)
})

test("el día 1 del mes devuelve el HP solo si el ajuste está activo y sigue vivo", () => {
  const config = defaultConfig()
  config.monthlyHpReset = false
  let doc = emptyDocument(config)
  doc = saveDay(doc, "2026-10-31", { late: 1 })
  assert.equal(derive(doc, "2026-11-01").hp, 990)

  doc.config.monthlyHpReset = true
  assert.equal(derive(doc, "2026-11-01").hp, 1000)

  doc.config.hpMax = 10
  doc = saveDay(doc, "2026-10-31", { late: 1 })
  assert.equal(derive(doc, "2026-11-01").hp, 0)
  assert.ok(derive(doc, "2026-11-01").dead)
})

test("la semana que termina en domingo resume EXP, niveles, HP y monedas", () => {
  let doc = emptyDocument()
  doc = saveDay(doc, "2026-10-18", { sleep: 1 })
  const view = derive(doc, "2026-10-18")
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
  legacy.phases = [{ name: " ", min: 1 }]
  assert.equal(configOk(legacy), false)
})

test("la fase sale del nivel total y los umbrales de la config", () => {
  const phases = defaultConfig().phases
  assert.equal(phaseAt(5, phases).name, "Aprendiz")
  assert.equal(phaseAt(7, phases).name, "Aprendiz")
  assert.equal(phaseAt(8, phases).name, "Aventurero")
  assert.equal(phaseAt(12, phases).name, "Héroe")
  assert.equal(phaseAt(17, phases).name, "Leyenda")
  assert.equal(phaseAt(40, phases).name, "Leyenda")
})

test("los objetivos y el mercado rotan con la fecha y la fase, y el domingo guarda el suyo", () => {
  const config = defaultConfig()
  const today = rotationFor(config, "2026-10-20", 5)
  const again = rotationFor(config, "2026-10-20", 5)
  const tomorrow = rotationFor(config, "2026-10-21", 5)
  assert.deepEqual(today.quests, again.quests)
  assert.deepEqual(today.foes, again.foes)
  assert.deepEqual(today.shop, again.shop)
  assert.equal(today.quests.length, 3)
  assert.equal(today.foes.length, 2)
  assert.equal(today.shop.length, 2)
  assert.equal(today.phase.name, "Aprendiz")
  const picks = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((date) => rotationFor(config, date, 5).quests.join())
  assert.ok(new Set(picks).size > 1)
  assert.notDeepEqual(today.quests, tomorrow.quests)

  config.daily = { quests: 99, foes: 99, shop: 99 }
  const sunday = rotationFor(config, "2026-10-18", 17)
  const monday = rotationFor(config, "2026-10-19", 17)
  assert.ok(sunday.quests.includes("weeklySave"))
  assert.equal(monday.quests.includes("weeklySave"), false)
  assert.equal(rotationFor(config, "2026-10-18", 5).quests.includes("weeklySave"), false)
})

test("el día guardado solo cuenta lo que estaba en pantalla", () => {
  let doc = emptyDocument()
  doc = saveDay(doc, "2026-10-20", { sleep: 1, publish: 3 }, { quests: ["sleep"], foes: [] })
  const view = derive(doc, "2026-10-20")
  assert.equal(view.areas.salud.exp, 10)
  assert.equal(view.areas.contenido.exp, 0)
  assert.deepEqual(doc.days["2026-10-20"].offered.quests, ["sleep"])
})

test("un producto fuera del mercado no se puede comprar", () => {
  const denied = buy(emptyDocument(), "midBuy", "2026-10-20T12:00:00")
  assert.equal(denied.ok, false)
  assert.equal(denied.reason, "mercado")
  assert.equal(denied.doc.buys.length, 0)
})

test("la lámina de nivel dice monedas, fase y lo que abre", () => {
  const config = defaultConfig()
  config.good = [...config.good, { id: "x", name: "X", area: "salud", exp: 600, coins: 0 }]
  const before = derive(emptyDocument(config), "2026-10-20")
  const after = derive(saveDay(emptyDocument(config), "2026-10-20", { x: 1 }), "2026-10-20")
  const card = levelUpCard(before, after, config)
  assert.equal(card.level, 8)
  assert.equal(card.coins, 150)
  assert.equal(card.phase, "Aventurero")
  assert.ok(card.objectives.includes("Entrenar (sesión completa)"))
  assert.ok(card.products.includes("Día libre de contenido"))

  config.hpMax = 10
  config.bad = [{ id: "b", name: "B", hp: 10 }]
  let dead = saveDay(emptyDocument(config), "2026-10-19", { b: 1 })
  const deadBefore = derive(dead, "2026-10-20")
  dead = saveDay(dead, "2026-10-20", { x: 1 })
  const deadAfter = derive(dead, "2026-10-20")
  assert.equal(levelUpCard(deadBefore, deadAfter, config).coins, 0)
  assert.equal(deadAfter.coins, deadBefore.coins)
})

test("una config vieja sin fases sigue y el editor muestra los umbrales", () => {
  const config = defaultConfig()
  delete config.phases
  delete config.daily
  const shown = editorConfig(config)
  assert.equal(shown.phases[0].name, "Aprendiz")
  assert.equal(shown.daily.quests, 3)
  assert.equal(rotationFor(config, "2026-10-20", 5).phase.name, "Aprendiz")
})
