// The single string table for every player-facing string (HUD, prompts,
// captions, dialogue, travel card, settings, journal). Keys are the English
// source text; t() returns the entry for the current language. In-world
// signs drawn into textures (茶, 臭豆腐, ...) are art and are not translated.
// Templates use {name} placeholders: t('Explore the old streets ({n}/{m})', { n, m }).

const ZH = {
  // ---- HUD / engine -----------------------------------------------------------
  'Move': '移動',
  'Look around': '環顧四周',
  'Interact': '互動',
  'Settings': '設定',
  'Click to look around': '點一下畫面以環顧四周',
  'Esc to get up': '按 Esc 起身',
  'Get up': '起床',
  'Stand up': '站起來',
  'N': '北', 'E': '東', 'S': '南', 'W': '西',
  // settings
  'Language': '語言',
  'Mouse sensitivity': '滑鼠靈敏度',
  'Resume': '繼續',
  'Press Esc to resume': '按 Esc 繼續',
  // travel
  'Traveling to Taiwan…': '前往台灣中……',
  'Heading home…': '回家囉……',
  'Heading to the airport…': '前往機場中……',
  'Arriving in {place}': '抵達{place}',
  'Arriving at the airport': '抵達機場',
  'the loft': '閣樓',
  'the airport': '機場',
  'Shanghai': '上海',

  // ---- room ---------------------------------------------------------------------
  'Objective:': '目標：',
  'Explore the room': '探索房間',
  'Find the hidden journal ☆': '找到藏起來的日記 ☆',
  'Stars collected': '收集的星星',
  'Go to the airport': '前往機場',
  'Pull a book': '抽一本書',
  '“The Little Prince” — what is essential is invisible to the eye.': '《小王子》——真正重要的東西，用眼睛是看不見的。',
  '“Drawing on the Right Side of the Brain.” Margins full of doodles.': '《像藝術家一樣思考》。頁邊畫滿了塗鴉。',
  '“A Field Guide to Getting Lost.” Seems fitting.': '《迷路指南》。好像很應景。',
  '“Kitchen” by Banana Yoshimoto. Someone underlined half of it.': '吉本芭娜娜的《廚房》。有人把半本都畫了線。',
  'An old sketchbook. Every page is the same window.': '一本舊素描本。每一頁都畫著同一扇窗。',
  'Sit at the desk': '坐到書桌前',
  'Back to work… or at least, back to doodling.': '回去工作……或者至少，回去塗鴉。',
  'Next screen': '下一個畫面',
  'Sketch saved. The castle looks better today.': '草圖已儲存。今天的城堡看起來好多了。',
  'Mom: did you eat yet?  (yes… noodles again)': '媽：吃飯了沒？（吃了……又是麵）',
  'New idea: a game set in this room.': '新點子：一款以這個房間為舞台的遊戲。',
  'Reminder: small steps, big dreams.': '提醒自己：一小步，大夢想。',
  'Strum the guitar': '彈一下吉他',
  '♪ A slightly out-of-tune G chord.': '♪ 一個有點走音的 G 和弦。',
  'Climb into bed': '爬上床',
  'Just five more minutes…': '再五分鐘就好……',
  'Toggle lamp': '開關檯燈',
  'Click. Warm light again.': '喀。溫暖的燈光又亮了。',
  'Click. The afternoon is bright enough.': '喀。午後的陽光已經夠亮了。',
  'Squeeze the plush': '捏捏布偶',
  'Squeak!': '吱！',
  'Sit on the sofa': '坐到沙發上',
  'The afternoon light is nice from here.': '從這裡看，午後的陽光真好。',
  'Make tea': '泡茶',
  'Tea’s ready.': '茶泡好了。',
  'Open the fridge': '打開冰箱',
  'Close the fridge': '關上冰箱',
  'Milk, three eggs, one apple. Grocery day tomorrow.': '牛奶、三顆蛋、一顆蘋果。明天該去買菜了。',
  'Leftover noodles. Again.': '剩下的麵。又是麵。',
  'The light still works. That counts.': '燈還會亮。這也算數。',
  'Sit at the table': '坐到餐桌旁',
  'A quiet meal for one. Not bad.': '一個人安靜地吃頓飯。還不錯。',
  'From here you can see the whole room.': '從這裡可以看到整個房間。',
  'Read journal': '閱讀日記',
  'Look outside': '看看窗外',
  'A quiet afternoon, somewhere far from home.': '一個安靜的午後，在離家很遠的地方。',
  'Pick up star': '撿起星星',
  // journal page
  'Oct 16': '10月16日',
  'Moved in today. The boxes are mostly unpacked, and the window light is perfect in the afternoon.': '今天搬進來了。箱子大多拆完了，下午窗邊的光線剛剛好。',
  'Small steps, big dreams. I keep telling myself that.': '一小步，大夢想。我一直這樣告訴自己。',
  'Tomorrow: shelve the books, call home, find a good noodle place nearby.': '明天：把書放上架、打電話回家、在附近找一家好吃的麵店。',
  'press {key} to close': '按 {key} 關閉',

  // ---- Taiwan ---------------------------------------------------------------------
  'Taiwan': '台灣',
  'Jiufen old street': '九份老街',
  'Explore the old streets': '探索老街',
  'Explore the old streets ({n}/{m})': '探索老街（{n}/{m}）',
  'Find the tea house': '找到茶館',
  'Watch the sunset': '欣賞夕陽',
  'Collectibles': '收集品',
  'Head home': '回家',
  'Talk to Tea Auntie': '和茶館阿姨聊天',
  'Welcome, welcome! The oolong is fresh today.': '歡迎歡迎！今天的烏龍茶很新鮮喔。',
  'You walked all the way down? Rest your feet, have a cup.': '你一路走下來的嗎？歇歇腳，喝杯茶吧。',
  'Go down to the lookout before dark. Jiufen is prettiest at sunset.': '天黑前去觀景台看看吧。九份的夕陽最美了。',
  'Tap the lantern': '碰碰燈籠',
  'The lantern sways. 茶 — tea, this way.': '燈籠輕輕搖晃。茶——這邊請。',
  'Talk to Cat': '和貓咪說話',
  'Mrrp. The cat blinks slowly at you.': '喵～貓咪慢慢地對你眨了眨眼。',
  'Peek in the steamer': '看看蒸籠',
  'Fresh xiaolongbao. Careful, they’re hot!': '剛蒸好的小籠包。小心燙！',
  'Light incense': '上香',
  'A quiet wish for safe travels.': '默默祈求旅途平安。',
  'The sun sinks behind Taipei. Worth every step.': '夕陽沉到台北的後面。每一步都值得。',
  'Taipei 101 against the evening sky.': '傍晚天空下的台北101。',
  'Sit on the bench': '坐到長椅上',
  'The city lights are coming on.': '城市的燈火漸漸亮起。',
  'Pick Up': '撿起來',
  'Good food, good mood.': '吃得好，心情好。',
  'Look at the flag': '看看國旗',
  'The flag of Taiwan, waving over the old street.': '台灣的國旗在老街上隨風飄揚。',
  'Talk to the tofu vendor': '和臭豆腐老闆聊天',
  'Stinky tofu! Smells strong, tastes even better.': '臭豆腐！聞起來很臭，吃起來更香！',
  'Talk to the fruit seller': '和水果攤阿姨聊天',
  'Guava and mango, picked this morning. Sweet as can be!': '芭樂跟芒果，今天早上剛摘的，甜得不得了！',
  'Talk to the noodle cook': '和麵攤老闆聊天',
  'Beef noodles, simmered since dawn. Want a bowl?': '牛肉麵，從天亮就開始燉了。來一碗嗎？',

  // ---- Shanghai (the Bund) ------------------------------------------------------------
  'Traveling to Shanghai…': '前往上海中……',
  'Explore the waterfront': '探索江邊步道',
  'Explore the waterfront ({n}/{m})': '探索江邊步道（{n}/{m}）',
  'Find the café': '找到咖啡館',
  'Take a photo': '拍一張照片',
  'Look at the skyline': '眺望天際線',
  'The Bund, Shanghai. A familiar skyline, seen from a different perspective.': '上海，外灘。熟悉的天際線，換個角度來看。',
  'Click! Saved to your photo album.': '喀嚓！照片存進相簿了。',
  'Another one for the album.': '相簿又多了一張。',
  'The Bund, Shanghai': '上海・外灘',
  'Photos': '照片',
  'Talk to the barista': '和咖啡師聊天',
  'Barista': '咖啡師',
  'Take a moment. Watch the boats pass, and let the city move around you.': '休息一下吧。看看船來船往，讓城市在你身邊流動。',
  'First time on the Bund? The skyline looks different from every bench.': '第一次來外灘嗎？從每張長椅看出去，天際線都不一樣。',
  'One latte, coming up. The window seat has the best view.': '一杯拿鐵馬上好。窗邊的位子風景最好。',
  'Bund Coffee. It smells like fresh espresso.': '外灘咖啡。滿屋子都是現煮咖啡的香氣。',
  'Check the life ring': '看看救生圈',
  'A life ring, just in case. The river is wide here.': '一個救生圈，以防萬一。這裡的江面很寬。',
  'Say hi to the seagull': '跟海鷗打招呼',
  'Squawk! The seagull eyes your backpack.': '嘎！海鷗盯著你的背包看。',
  'The ferries glide by. Nobody is in a hurry here.': '渡輪緩緩滑過。這裡沒有人在趕時間。',
  'The Bund, Shanghai. Different place. Same you.': '上海，外灘。不同的地方，同樣的你。',

  // ---- airport lobby -------------------------------------------------------------
  'Departures': '出境大廳',
  'Choose your next destination': '選擇下一個目的地',
  'Choose a gate': '選一個登機門',
  'Visit the info desk': '到服務台看看',
  'Check in to Shanghai': '前往上海登機門',
  'Check in to Taipei': '前往台北登機門',
  'Check in to the Bay Area': '前往灣區登機門',
  'See the next stop': '看看下一站',
  'Ask at the info desk': '詢問服務台',
  'Sit down': '坐下',
  'Plenty of time before boarding.': '離登機還有很多時間。',
  'How this works': '怎麼玩',
  'Walk up to a gate and press E to check in.': '走到登機門前，按 E 報到。',
  'Walk through the jetway to fly to that city.': '穿過空橋，就會飛到那座城市。',
  'Every city has a signpost back to the airport.': '每座城市都有路標帶你回機場。',
  'The doors behind you lead home.': '身後的門通往家。',
  'Coming soon': '即將開放',
  'More gates opening soon.': '更多登機門即將開放。',
  '{city}: this gate opens soon.': '{city}：這個登機門即將開放。',
  'Back to the airport': '回到機場',
  'Gates': '登機門',

  // ---- Bay Area ------------------------------------------------------------------
  'the Bay Area': '舊金山灣區',
  'Traveling to the Bay Area…': '前往舊金山灣區中……',
  'Bay Area': '舊金山灣區',
  'San Francisco · Santa Clara': '舊金山 · 聖克拉拉',
  'Visit the Mission Church': '參觀教會教堂',
  'Read the Bay Area map': '看看灣區地圖',
  'Look out from the pier': '在碼頭眺望',
  'Read the sign': '看看招牌',
  'Look at the Golden Gate': '眺望金門大橋',
  "Santa Clara University, founded in 1851 beside Mission Santa Clara de Asís, the eighth of California's 21 missions.": '聖克拉拉大學創立於 1851 年，就在聖克拉拉亞西西教會旁；這座教會是加州 21 座教會中的第八座。',
  'The Golden Gate Bridge, opened in 1937, spans the strait where the bay meets the Pacific.': '金門大橋於 1937 年通車，橫跨海灣與太平洋交會的海峽。',
  'The fog rolls in over the bridge. Nobody is in a hurry here.': '霧從大橋那頭慢慢飄來。這裡沒有人在趕時間。',
  'Mission Santa Clara de Asís, the heart of the campus.': '聖克拉拉亞西西教會，校園的中心。',
  'The San Francisco Bay Area': '舊金山灣區',
  'A map of the bay: San Francisco at the Golden Gate in the north, Santa Clara at the south end of the bay.': '海灣地圖：北邊金門旁是舊金山，海灣的南端是聖克拉拉。',
  'San Francisco and Santa Clara: two ends of one bay, about 45 miles (70 km) apart.': '舊金山與聖克拉拉：同一片海灣的兩端，相距約 45 英里（70 公里）。',
};

const TABLES = { en: {}, zh: ZH };
const KEY = 'doodleworld.lang';
let lang = 'en';
try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'zh') lang = v; } catch { /* storage unavailable */ }
const listeners = new Set();
export const missing = new Set();

export function t(s, vars) {
  if (s == null) return s;
  let out = s;
  if (lang !== 'en') {
    const tr = TABLES[lang][s];
    if (tr === undefined) missing.add(s); else out = tr;
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}
export function getLang() { return lang; }
export function setLang(l) {
  if (!TABLES[l] || l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
  for (const cb of listeners) cb(l);
}
export function onLang(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export const STRINGS = Object.keys(ZH);
document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
