const STRINGS = {

  // ── Language picker ──────────────────────────────────────────────────────────
  'lang.heading':    { si: 'ඔබේ භාෂාව තෝරන්න',       ta: 'உங்கள் மொழியை தேர்ந்தெடுக்கவும்', en: 'Choose Your Language' },
  'lang.subheading': { si: 'ඔබට ලේසිම භාෂාව!',         ta: 'உங்களுக்கு எளிதான மொழி!',           en: 'Pick what feels easy!' },
  'lang.sinhala':    { si: 'සිංහල',                      ta: 'சிங்களம்',                            en: 'Sinhala' },
  'lang.tamil':      { si: 'දෙමළ',                       ta: 'தமிழ்',                              en: 'Tamil' },
  'lang.english':    { si: 'ඉංග්‍රීසි',                  ta: 'ஆங்கிலம்',                           en: 'English' },

  // ── Welcome / scan screen ────────────────────────────────────────────────────
  'welcome.badge':          { si: 'PAGES · සහන කඳවුර',              ta: 'PAGES · நிவாரண முகாம்',                    en: 'PAGES · Relief Camp' },
  'welcome.greeting_1':     { si: 'ආයුබෝවන්! 👋',                   ta: 'வணக்கம்! 👋',                             en: 'Hello! 👋' },
  'welcome.greeting_2':     { si: 'ඔබට සුභ දවසක්! ☀️',             ta: 'நல்ல நாளாக இருக்கட்டும்! ☀️',            en: 'Have a great day! ☀️' },
  'welcome.greeting_3':     { si: 'අපි සෙල්ලම් කරමු! 🎮',          ta: 'விளையாடலாம்! 🎮',                        en: "Let's play! 🎮" },
  'welcome.greeting_4':     { si: 'ඔයා දක්ෂයි! ⭐',                 ta: 'நீ ஒரு நட்சத்திரம்! ⭐',                en: 'You are a star! ⭐' },
  'welcome.scan_btn':       { si: 'QR කේතය ස්කෑන් කරන්න',          ta: 'QR குறியீட்டை ஸ்கேன் செய்யவும்',        en: 'Scan QR Wristband' },
  'welcome.scan_sub':       { si: 'SCAN WRISTBAND',                  ta: 'SCAN WRISTBAND',                           en: 'SCAN WRISTBAND' },
  'welcome.requesting':     { si: 'කැමරාව ලබා ගනිමින්…',            ta: 'கேமரா கோரப்படுகிறது…',                   en: 'Requesting camera…' },
  'welcome.loading':        { si: 'සූදානම් වෙමින්…',                 ta: 'தயாராகுகிறது…',                           en: 'Getting ready…' },
  'welcome.scanning':       { si: 'QR ස්කෑන් කරමින්…',              ta: 'QR ஸ்கேன் செய்கிறது…',                   en: 'Scanning wristband…' },
  'welcome.cancel':         { si: 'අවලංගු කරන්න',                   ta: 'ரத்து செய்',                              en: 'Cancel' },
  'welcome.err_denied':     { si: 'කැමරා අවසරය ප්‍රතික්ෂේප විය. Settings වලින් අවසර දෙන්න.', ta: 'கேமரா அனுமதி மறுக்கப்பட்டது. அமைப்புகளில் அனுமதி கொடுங்கள்.', en: 'Camera access denied. Please allow camera in Settings.' },
  'welcome.err_unavailable':{ si: 'කැමරාව ලබා ගත නොහැක.',           ta: 'கேமரா கிடைக்கவில்லை.',                    en: 'Camera not available.' },

  // ── Game (Go/No-Go) ──────────────────────────────────────────────────────────
  'game.instruction_main':    { si: 'බලන්න - එය තට්ටු කරන්න!',                          ta: 'பார்த்தால் — தட்டவும்!',             en: 'See it — Tap it!' },
  'game.instruction_sub':     { si: 'මිත්‍රශීලී සතුන් අල්ලන්න· අනෙකුත් සතුන් අල්ලන්න එපා', ta: 'நட்பான விலங்குகளை தட்டவும் · மற்றவற்றை தட்டாதீர்கள்', en: 'Tap friendly animals · Ignore others' },
  'game.stop_label':          { si: 'නවත්වන්න !',                                             ta: 'நிறுத்து!',                           en: 'STOP!' },
  'game.tap_now':             { si: 'දැන් ස්පර්ශ කරන්න!',                                   ta: 'இப்போது தட்டவும்!',                   en: 'TAP NOW!' },
  'game.wait':                { si: 'රැඳෙන්න…',                                         ta: 'காத்திருங்கள்…',                      en: 'Wait…' },
  'game.done_heading':        { si: 'සාර්ථකයි!',                                         ta: 'சிறப்பாக செய்தீர்கள்!',               en: 'Well Done!' },
  'game.done_sub':            { si: 'ඔබ ඉතා හොඳයි!',                                      ta: 'நீ மிகவும் நன்றாக செய்தாய்!',        en: 'You were amazing!' },
  'game.countdown_instruction':{ si: 'සතා අල්ලන්න!',                          ta: 'விலங்கை பார்த்தால் தட்டவும்!',       en: 'Tap the animal when you see it!' },
  'game.no_tap_instruction':  { si: 'සර්පයා / මකුළුවා? අල්ලන්න එපා!',                  ta: 'பாம்பு / சிலந்தி? தட்டாதீர்கள்!',   en: "Snake / Spider? Don't tap!" },

  // ── Animal names ─────────────────────────────────────────────────────────────
  'animal.elephant':  { si: 'අලියා',      ta: 'யானை',              en: 'Elephant'   },
  'animal.rabbit':    { si: 'හාවා',       ta: 'முயல்',             en: 'Rabbit'     },
  'animal.butterfly': { si: 'සමනලා',     ta: 'பட்டாம்பூச்சி',     en: 'Butterfly'  },
  'animal.bird':      { si: 'කුරුල්ලා',  ta: 'பறவை',              en: 'Bird'       },
  'animal.fish':      { si: 'මාළුවා',    ta: 'மீன்',              en: 'Fish'       },
  'animal.cat':       { si: 'පූසා',       ta: 'பூனை',              en: 'Cat'        },
  'animal.duck':      { si: 'තාරාවා',     ta: 'வாத்து',            en: 'Duck'       },
  'animal.snake':     { si: 'සර්පයා',     ta: 'பாம்பு',            en: 'Snake'      },
  'animal.spider':    { si: 'මකුළුවා',   ta: 'சிலந்தி',           en: 'Spider'     },
  'animal.crab':      { si: 'කකුළුවා',   ta: 'நண்டு',             en: 'Crab'       },

  // ── Breathing / calming ──────────────────────────────────────────────────────
  'breathe.heading':    { si: '🌿 අපි හුස්ම ගනිමු',  ta: '🌿 சுவாசிப்போம்',              en: "🌿 Let's Breathe Together" },
  'breathe.subheading': { si: 'දිගට හුස්ම ගන්න',       ta: 'ஆழமாக சுவாசியுங்கள்',           en: 'Take a deep breath' },
  'breathe.in':         { si: 'හුස්ම ගන්න…',            ta: 'உள்ளே சுவாசிக்கவும்…',          en: 'Breathe in…' },
  'breathe.hold':       { si: 'රැඳෙන්න…',               ta: 'பிடித்திருங்கள்…',               en: 'Hold…' },
  'breathe.out':        { si: 'හුස්ම හරින්න…',           ta: 'வெளியே சுவாசிக்கவும்…',         en: 'Breathe out…' },
  'breathe.rounds_left':{ si: (n) => `තව ${n} වතාවක්`,  ta: (n) => `இன்னும் ${n} முறை`,      en: (n) => `${n} more round${n !== 1 ? 's' : ''}` },
  'breathe.safe':       { si: 'ඔයා ආරක්ෂිතය 💙',         ta: 'நீ பாதுகாப்பாக இருக்கிறாய் 💙', en: 'You are safe 💙' },
  'breathe.done_heading':{ si: 'ඉතා හොඳයි!',            ta: 'மிகவும் நன்றாக செய்தீர்கள்!',   en: 'Great job!' },
  'breathe.done_sub':   { si: 'ඔබ ඉතා හොඳයි!',            ta: 'நீ அற்புதமாக செய்தாய்!',         en: 'You did wonderfully.' },
  'breathe.friend':     { si: 'ඔබේ මිතුරා',             ta: 'உங்கள் நண்பர்',                  en: 'Your friend' },

  // ── Content cards ────────────────────────────────────────────────────────────
  'content.card_1.title': { si: 'ඔබේ හැඟීම් වැදගත්',       ta: 'உங்கள் உணர்வுகள் முக்கியம்',     en: 'Your feelings matter' },
  'content.card_1.body':  { si: 'දුකක්, බියක් හෝ කනස්සල්ලක් දැනීම සාමාන්‍යයි. ඔබ විශ්වාස කරන කෙනෙකු සමඟ කතා කරන්න - එය උපකාරී වේ.', ta: 'சோகம், பயம் அல்லது கவலை உணர்ந்தால் சரிதான். நம்பகமான ஒருவரிடம் சொல்லுங்கள்.', en: "It's OK to feel sad, scared, or worried. Talk to someone you trust — it helps!" },
  'content.card_2.title': { si: 'ඔයා දක්ෂයි!',              ta: 'நீ ஒரு வீரன்!',                   en: 'You are a star!' },
  'content.card_2.body':  { si: 'ඔයා අද ඉතා නිර්භීතයි. ඔයා ගැන අපට ගොඩක් ආඩම්බරයි!', ta: 'நீ இன்று மிகவும் தைரியமாக இருக்கிறாய். நாங்கள் உன்னை பெருமையாக நினைக்கிறோம்!', en: 'You are brave for being here today. We are so proud of you!' },
  'content.card_3.title': { si: 'අපි එකට',                   ta: 'நாம் ஒன்றாக இருக்கிறோம்',        en: 'We are together' },
  'content.card_3.body':  { si: 'ඔයා තනිවෙලා නෑ. ඔයා සමඟ ගොඩක් මිතුරන් හා උදව්කරුවන් ඉන්නවා.', ta: 'நீ தனியாக இல்லை. உன்னோடு நிறைய நண்பர்களும் உதவியாளர்களும் இருக்கிறார்கள்.', en: 'You are not alone. Many friends and helpers are here for you.' },
  'content.card_4.title': { si: 'ඉදිරියේදී දීප්තිමත් දින එනවා',             ta: 'நாளை சூரியன் மீண்டும் உதயமாகும்', en: 'Brighter days ahead' },
  'content.card_4.body':  { si: 'දුෂ්කර කාලය සදාකාලිකව නොපවතී. ඉදිරියට හොඳ දින එනවා.', ta: 'கஷ்டமான காலம் என்றும் நீடிக்காது. நல்ல நாட்கள் வரும்.', en: 'Hard times do not last forever. Better days are coming your way.' },
  'content.next':             { si: '➡️ ඊළඟ',   ta: '➡️ அடுத்து', en: '➡️ Next' },
  'content.done':             { si: '✅ අවසන්', ta: '✅ முடிந்தது', en: '✅ Done' },
  'content.complete_heading': { si: 'ඔබ ඉතා හොඳයි!', ta: 'நீ மிகவும் நன்றாக செய்தாய்!', en: 'Amazing job!' },
  'content.complete_emoji':   { si: '🎉', ta: '🎉', en: '🎉' },
}

/**
 * Translate a key into the chosen language.
 * Falls back: chosen lang → English → key itself.
 * @param {string} key
 * @param {'si'|'ta'|'en'} lang
 * @param {...any} args — passed to function values (plurals etc.)
 * @returns {string}
 */
export function t(key, lang = 'en', ...args) {
  const entry = STRINGS[key]
  if (!entry) return key
  const val = entry[lang] ?? entry['en'] ?? key
  return typeof val === 'function' ? val(...args) : val
}

/** All supported languages */
export const LANGUAGES = [
  { code: 'si', label: 'සිංහල',  labelEn: 'Sinhala', flag: '🇱🇰', color: '#F97316' },
  { code: 'ta', label: 'தமிழ்',  labelEn: 'Tamil',   flag: '🌺',  color: '#8B5CF6' },
  { code: 'en', label: 'English', labelEn: 'English', flag: '📖',  color: '#0D9488' },
]

export default STRINGS
