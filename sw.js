const CACHE = "glow-up-v9"
const SPRITES = [29, 40, 48, 56, 89, 102, 108, 115]
  .map((n) => `./assets/sprites/tile_${String(n).padStart(4, "0")}.png`)
const HEROES = ["elf", "dwarf", "knight", "wizard"].map((name) => `./assets/heroes/${name}.png`)
const FOES = ["goblin", "imp", "skeleton", "zombie", "slime"].map((name) => `./assets/foes/${name}.png`)
const ICONS = [
  "I_C_Pie", "P_Yellow03", "I_Clock", "I_Scroll02", "I_Chest01", "I_Chest02",
  "P_Red01", "P_Blue01", "W_Sword001", "I_C_Carrot", "I_Feather01", "I_Ink",
  "I_GoldBar", "I_GoldCoin", "W_Book01", "I_Book", "I_Crystal01", "I_Map",
  "I_Scroll", "S_Buff08", "W_Book05", "I_Key01"
].map((name) => `./assets/icons/${name}.png`)
const SHELL = [
  ...SPRITES,
  ...HEROES,
  ...FOES,
  ...ICONS,
  "./assets/fonts/pixelify-sans-latin.woff2",
  "./assets/ui/panel-border-014.png",
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./rules.js",
  "./db.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || event.request.method !== "GET") return
  if (url.pathname.endsWith("/sw.js")) return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  )
})
