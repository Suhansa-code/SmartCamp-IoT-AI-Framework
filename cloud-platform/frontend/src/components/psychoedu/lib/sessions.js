export const SESSIONS = [

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION A — Grade 3 focus
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'A',
    grade: 3,
    tasks: [

      // Task 1 — Sinhala reading / sentence comprehension
      {
        id: 'A1',
        type: 'mcq',
        subject: 'sinhala',
        skill: 'reading_comprehension',
        question: {
          si: 'නිවැරදිව ලියා ඇති වචනය තෝරන්න ',
          ta: 'නිවැරදිව ලියා ඇති වචනය තෝරන්න',
          en: 'නිවැරදිව ලියා ඇති වචනය තෝරන්න',
        },
        options: {
          si: ['ෂක්තිය', 'ශක්තිය', 'සක්තිය', 'ශක්ථිය'],
          ta: ['ෂක්තිය', 'ශක්තිය', 'සක්තිය', 'ශක්ථිය'],
          en: ['ෂක්තිය', 'ශක්තිය', 'සක්තිය', 'ශක්ථිය'],
        },
        answer: 1,
        emoji: '📚',
      },

      // Task 2 — Mathematics / addition single digit
      {
        id: 'A2',
        type: 'mcq',
        subject: 'mathematics',
        skill: 'addition',
        question: {
          si: '3 + 4 = ?',
          ta: '3 + 4 = ?',
          en: '3 + 4 = ?',
        },
        options: {
          si: ['6', '7', '8', '9'],
          ta: ['6', '7', '8', '9'],
          en: ['6', '7', '8', '9'],
        },
        answer: 1,
        emoji: '➕',
      },

      // Task 3 — Sinhala fill in the blank
      {
        id: 'A3',
        type: 'fill_blank',
        subject: 'sinhala',
        skill: 'vocabulary',
        question: {
          si: 'ගස් වල ___ හටගනී.',
          ta: 'மரங்களில் ___ வளரும்.',
          en: '___ grow on trees.',
        },
        blank_choices: {
          si: ['ගෙඩි', 'ගල්', 'ජලය'],
          ta: ['பழங்கள்', 'கற்கள்', 'நீர்'],
          en: ['Fruits', 'Stones', 'Water'],
        },
        answer: 0,
        emoji: '🌳',
      },

      // Task 4 — Mathematics / counting objects
      {
        id: 'A4',
        type: 'count',
        subject: 'mathematics',
        skill: 'counting',
        question: {
          si: 'ඇපල් ගෙඩි කීයක් තිබේද?',
          ta: 'எத்தனை ஆப்பிள்கள் உள்ளன?',
          en: 'How many apples are there?',
        },
        display_emoji: '🍎',
        count: 7,
        options: {
          si: ['5', '6', '7', '8'],
          ta: ['5', '6', '7', '8'],
          en: ['5', '6', '7', '8'],
        },
        answer: 2,
        emoji: '🍎',
      },

      // Task 5 — English / match word to image
      {
        id: 'A5',
        type: 'match',
        subject: 'english',
        skill: 'vocabulary',
        question: {
          si: 'වචනය සහ රූපය ගලපන්න',
          ta: 'சொல்லையும் படத்தையும் பொருத்துங்கள்',
          en: 'Match the word to the picture',
        },
        pairs: [
          { word: { si: 'පූසා', ta: 'பூனை', en: 'Cat' },     emoji: '🐱' },
          { word: { si: 'කුකුළා', ta: 'கோழி', en: 'Hen' },   emoji: '🐔' },
          { word: { si: 'ගෙම්බා ', ta: 'தேரை', en: 'Frog' }, emoji: '🐸' },
          { word: { si: 'හාවා', ta: 'முயல்', en: 'Rabbit' }, emoji: '🐰' },
        ],
        emoji: '🔗',
      },

      // Task 6 — Mathematics / subtraction
      {
        id: 'A6',
        type: 'mcq',
        subject: 'mathematics',
        skill: 'subtraction',
        question: {
          si: '9 - 4 = ?',
          ta: '9 - 4 = ?',
          en: '9 - 4 = ?',
        },
        options: {
          si: ['3', '4', '5', '6'],
          ta: ['3', '4', '5', '6'],
          en: ['3', '4', '5', '6'],
        },
        answer: 2,
        emoji: '➖',
      },

      // Task 7 — Sinhala / identify correct word
      {
        id: 'A7',
        type: 'mcq',
        subject: 'sinhala',
        skill: 'word_recognition',
        question: {
          si: 'ශාක වලට ආහාර නිපදවීමට ශක්තිය දෙන්නේ කවුද?',
          ta: 'தாவரங்கள் உணவை உற்பத்தி செய்வதற்கான ஆற்றலை யார் அளிக்கிறார்கள்?',
          en: 'Who gives plants the energy to produce food?',
        },
        options: {
          si: ['හිරු', 'සඳ', 'තාරකාව', 'වළාකුළ'],
          ta: ['சூரியன்', 'நிலா', 'நட்சத்திரம்', 'மேகம்'],
          en: ['Sun', 'Moon', 'Star', 'Cloud'],
        },
        answer: 0,
        emoji: '🌞',
      },

      // Task 8 — EVS / identify animal
      {
        id: 'A8',
        type: 'mcq',
        subject: 'evs',
        skill: 'living_things',
        question: {
          si: 'ජලයේ ජීවත් වන සතා කවුද? ',
          ta: 'இந்த உயிரினம் நீரில் வாழும். அது என்ன?',
          en: 'This creature lives in water. What is it?',
        },
        options: {
          si: ['මාළුවා', 'හාවා', 'ඇතා', 'කුකුළා '],
          ta: ['மீன்', 'முயல்', 'யானை', 'சேவல்'],
          en: ['Fish', 'Rabbit', 'Elephant', 'Rooster'],
        },
        answer: 0,
        emoji: '🐟',
      },

      // Task 9 — Mathematics / simple pattern
      {
        id: 'A9',
        type: 'pattern',
        subject: 'mathematics',
        skill: 'patterns',
        question: {
          si: 'ඊළඟට කුමක් ද?',
          ta: 'அடுத்து என்ன வரும்?',
          en: 'What comes next?',
        },
        sequence: ['🔴', '🔵', '🔴', '🔵', '🔴', '?'],
        options: {
          si: ['🔵', '🔴', '🟡', '🟢'],
          ta: ['🔵', '🔴', '🟡', '🟢'],
          en: ['🔵', '🔴', '🟡', '🟢'],
        },
        answer: 0,
        emoji: '🔮',
      },

      // Task 10 — Sinhala reading / short paragraph + question
      {
        id: 'A10',
        type: 'mcq',
        subject: 'sinhala',
        skill: 'reading_comprehension',
        question: {
          si: 'ගිරවා මොන පාටද  ?',
          ta: 'கிளி என்ன நிறம்?',
          en: "What color is the parrot??",
        },
        options: {
          si: ['රතු', 'නිල්', 'කොළ', 'කහ'],
          ta: ['சிவப்பு', 'நீலம்', 'பச்சை', 'மஞ்சள்'],
          en: ['Red', 'Blue', 'Green', 'Yellow'],
        },
        answer: 2,
        emoji: '📖',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION B — Grade 3 focus
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'B',
    grade: 3,
    tasks: [

      // Task 1 — Mathematics / addition (two digit + single)
      {
        id: 'B1',
        type: 'mcq',
        subject: 'mathematics',
        skill: 'addition',
        question: {
          si: '12 + 5 = ?',
          ta: '12 + 5 = ?',
          en: '12 + 5 = ?',
        },
        options: { si: ['15', '16', '17', '18'], ta: ['15', '16', '17', '18'], en: ['15', '16', '17', '18'] },
        answer: 2,
        emoji: '➕',
      },

      // Task 2 — Sinhala / true or false
      {
        id: 'B2',
        type: 'true_false',
        subject: 'sinhala',
        skill: 'comprehension',
        question: {
          si: '"පොත් කියවීමෙන් මිනිසා සම්පූර්ණවේ" යනුවෙන් කියමනක් තිබේ.',
          ta: '"புத்தகங்களைப் படிப்பது ஒரு மனிதனைப் பூரணப்படுத்துகிறது" என்று ஒரு பழமொழி உண்டு.',
          en: 'There is a saying that "reading books completes a man."',
        },
        answer: true,
        emoji: '🌸',
      },

      // Task 3 — English / sentence word order
      {
        id: 'B3',
        type: 'sort_order',
        subject: 'english',
        skill: 'sentence_building',
        question: {
          si: 'නිවැරදි ක්‍රමයට වචන සකසන්න',
          ta: 'வார்த்தைகளை சரியான வரிசையில் வையுங்கள்',
          en: 'Arrange the words in the correct order',
        },
        words: {
          si: ['යයි', 'පාසලට', 'ළමයා'],
          ta: ['போகிறான்', 'பாடசாலைக்கு', 'பையன்'],
          en: ['goes', 'to school', 'The boy'],
        },
        correct_order: {
          si: ['ළමයා', 'පාසලට', 'යයි'],
          ta: ['பையன்', 'பாடசாலைக்கு', 'போகிறான்'],
          en: ['The boy', 'goes', 'to school'],
        },
        emoji: '🔤',
      },

      // Task 4 — EVS / national symbols
      {
        id: 'B4',
        type: 'mcq',
        subject: 'evs',
        skill: 'national_awareness',
        question: {
          si: 'ශ්‍රී ලංකාවේ ජාතික පක්ෂියා කවුද ',
          ta: 'இலங்கையின் தேசியப் பறவை எது?',
          en: 'What is the national bird of Sri Lanka?.',
        },
        options: {
          si: ['මොණරා  ', 'සැළලිහිණියා ', 'වළි කුකුළා', 'උකුස්සා '],
          ta: ['மயில்', 'விழுங்கு', 'காட்டு சேவல்', 'ஹாக்'],
          en: ['Peacock', 'Swallow', 'Junglefowl', 'Hawk'],
        },
        answer: 2,
      },

      // Task 5 — Mathematics / subtraction
      {
        id: 'B5',
        type: 'mcq',
        subject: 'mathematics',
        skill: 'subtraction',
        question: {
          si: '15 - 6 = ?',
          ta: '15 - 6 = ?',
          en: '15 - 6 = ?',
        },
        options: { si: ['7', '8', '9', '10'], ta: ['7', '8', '9', '10'], en: ['7', '8', '9', '10'] },
        answer: 2,
        emoji: '➖',
      },

      // Task 6 — Sinhala / fill in the blank
      {
        id: 'B6',
        type: 'fill_blank',
        subject: 'sinhala',
        skill: 'vocabulary',
        question: {
          si: 'ජලය ___ සිට පොළොවට වැටේ.',
          ta: 'நீர் ___ இல் இருந்து கீழே விழும்.',
          en: 'Water falls from the ___.',
        },
        blank_choices: {
          si: ['වළාකුළු', 'ගල්', 'ගස්'],
          ta: ['மேகம்', 'கற்கள்', 'மரங்கள்'],
          en: ['Clouds', 'Stones', 'Trees'],
        },
        answer: 0,
        emoji: '🌧️',
      },

      // Task 7 — Mathematics / counting objects
      {
        id: 'B7',
        type: 'count',
        subject: 'mathematics',
        skill: 'counting',
        question: {
          si: 'තරු කීයක් තිබේද?',
          ta: 'எத்தனை நட்சத்திரங்கள் உள்ளன?',
          en: 'How many stars are there?',
        },
        display_emoji: '⭐',
        count: 5,
        options: {
          si: ['4', '5', '6', '7'],
          ta: ['4', '5', '6', '7'],
          en: ['4', '5', '6', '7'],
        },
        answer: 1,
        emoji: '⭐',
      },

      // Task 8 — English / word to image match
      {
        id: 'B8',
        type: 'match',
        subject: 'english',
        skill: 'vocabulary',
        question: {
          si: 'වචනය සහ රූපය ගලපන්න',
          ta: 'சொல்லையும் படத்தையும் பொருத்துங்கள்',
          en: 'Match the word to the picture',
        },
        pairs: [
          { word: { si: 'හිරු', ta: 'சூரியன்', en: 'Sun' },   emoji: '☀️' },
          { word: { si: 'වළාකුළු', ta: 'மேகம்', en: 'Cloud' }, emoji: '☁️' },
          { word: { si: 'වැස්ස', ta: 'மழை', en: 'Rain' },     emoji: '🌧️' },
          { word: { si: 'ගස', ta: 'மரம்', en: 'Tree' },       emoji: '🌳' },
        ],
        emoji: '🔗',
      },

      // Task 9 — Sinhala reading / comprehension
      {
        id: 'B9',
        type: 'mcq',
        subject: 'sinhala',
        skill: 'reading_comprehension',
        question: {
          si: 'අචිනි රතු පාට ඇඳුම් ඇඳ ගත්තාය. ඇය ඇන්ද ඇඳුමේ වර්ණය?',
          ta: 'අචිනි රතු පාට ඇඳුම් ඇඳ ගත්තාය. ඇය ඇන්ද ඇඳුමේ වර්ණය?',
          en: 'අචිනි රතු පාට ඇඳුම් ඇඳ ගත්තාය. ඇය ඇන්ද ඇඳුමේ වර්ණය??',
        },
        options: {
          si: ['නිල්', 'රතු', 'කහ', 'කොළ'],
          ta: ['නිල්', 'රතු', 'කහ', 'කොළ'],
          en: ['නිල්', 'රතු', 'කහ', 'කොළ'],
        },
        answer: 1,
        emoji: '📖',
      },

      // Task 10 — Mathematics / pattern
      {
        id: 'B10',
        type: 'pattern',
        subject: 'mathematics',
        skill: 'patterns',
        question: {
          si: 'ඊළඟ සංඛ්‍යාව කුමක්ද?',
          ta: 'அடுத்த எண் என்ன?',
          en: 'What is the next number?',
        },
        sequence: ['2', '4', '6', '8', '?'],
        options: { si: ['9', '10', '11', '12'], ta: ['9', '10', '11', '12'], en: ['9', '10', '11', '12'] },
        answer: 1,
        emoji: '🔢',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION C — Grade 3/4 bridge
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C',
    grade: 3,
    tasks: [
      {
        id: 'C1',
        type: 'mcq', subject: 'evs', skill: 'plants',
        question: { si: 'ශාක වල ආහාරය සාදා ගන්නේ.', ta: 'தாவரத்தின் ___ உணவை தயாரிக்கும்.', en: 'The ___ of a plant makes food.' },
        options: { si: ['කොළ', 'මල', 'මුල', 'ගෙඩිය'], ta: ['இலைகள்', 'மலர்', 'வேர்', 'பழம்'], en: ['Leaves', 'Flower', 'Root', 'Fruit'] },
        answer: 0, emoji: '🌿',
      },
      {
        id: 'C2',
        type: 'mcq', subject: 'mathematics', skill: 'addition',
        question: { si: '5 + 13 = ?', ta: '24 + 13 = ?', en: '24 + 13 = ?' },
        options: { si: ['16', '17', '18', '19'], ta: ['16', '17', '18', '19'], en: ['16', '17', '18', '19'] },
        answer: 2, emoji: '➕',
      },
      {
        id: 'C3',
        type: 'match', subject: 'english', skill: 'vocabulary',
        question: { si: 'ශරීර කොටස් ගලපන්න', ta: 'உடல் உறுப்புகளை பொருத்துங்கள்', en: 'Match the body parts' },
        pairs: [
          { word: { si: 'ඇස', ta: 'கண்', en: 'Eye' },       emoji: '👁️' },
          { word: { si: 'නාසය', ta: 'மூக்கு', en: 'Nose' }, emoji: '👃' },
          { word: { si: 'කන', ta: 'காது', en: 'Ear' },       emoji: '👂' },
          { word: { si: 'අත', ta: 'கை', en: 'Hand' },        emoji: '✋' },
        ],
        emoji: '🔗',
      },
      {
        id: 'C4',
        type: 'true_false', subject: 'sinhala', skill: 'comprehension',
        question: { si: 'හිරු නැගෙනහිරින් උදා වේ.', ta: 'சூரியன் கிழக்கில் உதிக்கும். — இது சரியா?', en: 'The sun rises in the east. — Is this true?' },
        answer: true, emoji: '🌅',
      },
      {
        id: 'C5',
        type: 'count', subject: 'mathematics', skill: 'counting',
        question: { si: 'කෙසෙල් ගෙඩි කීයක් තිබේද ?', ta: 'எத்தனை வாழைப்பழங்கள் உள்ளன?', en: 'How many bananas are there?' },
        display_emoji: '🍌', count: 9,
        options: { si: ['7', '8', '9', '10'], ta: ['7', '8', '9', '10'], en: ['7', '8', '9', '10'] },
        answer: 2, emoji: '🍌',
      },
      {
        id: 'C6',
        type: 'mcq', subject: 'sinhala', skill: 'word_recognition',
        question: { si: 'නිවැරදිව ලියා ඇති වචනය තෝරන්න ', ta: 'නිවැරදිව ලියා ඇති වචනය තෝරන්න.', en: 'නිවැරදිව ලියා ඇති වචනය තෝරන්න.' },
        options: { si: ['ශිෂ්‍යයා ', 'ෂිෂ්‍යයා', 'ෂිශ්‍යයා', 'ශිශ්‍යයා'], ta: ['ශිෂ්‍යයා ', 'ෂිෂ්‍යයා', 'ෂිශ්‍යයා', 'ශිශ්‍යයා'], en: ['ශිෂ්‍යයා ', 'ෂිෂ්‍යයා', 'ෂිශ්‍යයා', 'ශිශ්‍යයා'] },
        answer: 0, 
      },
      {
        id: 'C7',
        type: 'mcq', subject: 'mathematics', skill: 'subtraction',
        question: { si: '20 - 8 = ?', ta: '20 - 8 = ?', en: '20 - 8 = ?' },
        options: { si: ['10', '11', '12', '13'], ta: ['10', '11', '12', '13'], en: ['10', '11', '12', '13'] },
        answer: 2, emoji: '➖',
      },
      {
        id: 'C8',
        type: 'fill_blank', subject: 'english', skill: 'vocabulary',
        question: { si: 'The ___ is hot.', ta: 'The ___ is hot.', en: 'The ___ is hot.' },
        blank_choices: { si: ['Sun', 'Rain', 'Cloud'], ta: ['Sun', 'Rain', 'Cloud'], en: ['Sun', 'Rain', 'Cloud'] },
        answer: 0, emoji: '☀️',
      },
      {
        id: 'C9',
        type: 'pattern', subject: 'mathematics', skill: 'patterns',
        question: { si: 'ඊළඟට කුමක්ද?', ta: 'அடுத்து என்ன வரும்?', en: 'What comes next?' },
        sequence: ['🔺', '🔺', '🔷', '🔺', '🔺', '?'],
        options: { si: ['🔺', '🔷', '🟡', '🔴'], ta: ['🔺', '🔷', '🟡', '🔴'], en: ['🔺', '🔷', '🟡', '🔴'] },
        answer: 1, emoji: '🔮',
      },
      {
        id: 'C10',
        type: 'mcq', subject: 'evs', skill: 'community',
        question: { si: 'අසනීප වූ විට යන්නේ කවුරුන් ළගට ද?', ta: 'நோய்வாய்ப்பட்டால் யாரிடம் செல்வீர்கள்?', en: 'Who do you visit when you are sick?' },
        options: { si: ['වෛද්‍යවරයා', 'ගුරුවරයා', 'රියදුරා', 'ධීවරයා'], ta: ['மருத்துவர்', 'ஆசிரியர்', 'சாரதி', 'மீனவர்'], en: ['Doctor', 'Teacher', 'Driver', 'Fisherman'] },
        answer: 0, emoji: '🏥',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION D — Grade 4 focus
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'D',
    grade: 4,
    tasks: [
      {
        id: 'D1',
        type: 'mcq', subject: 'mathematics', skill: 'multiplication',
        question: { si: '3 × 4 = ?', ta: '3 × 4 = ?', en: '3 × 4 = ?' },
        options: { si: ['10', '11', '12', '13'], ta: ['10', '11', '12', '13'], en: ['10', '11', '12', '13'] },
        answer: 2, emoji: '✖️',
      },
      {
        id: 'D2',
        type: 'mcq', subject: 'sinhala', skill: 'reading_comprehension',
        question: { si: 'දිනේෂ් ක්‍රිකට් ක්‍රීඩා කිරීමට ප්‍රිය කරයි. ඔහු ප්‍රිය ක්‍රීඩාව කුමක්ද?', ta: 'දිනේෂ් ක්‍රිකට් ක්‍රීඩා කිරීමට ප්‍රිය කරයි. ඔහු ප්‍රිය ක්‍රීඩාව කුමක්ද?', en: 'දිනේෂ් ක්‍රිකට් ක්‍රීඩා කිරීමට ප්‍රිය කරයි. ඔහු ප්‍රිය ක්‍රීඩාව කුමක්ද?' },
        options: { si: ['පාපන්දු', 'ක්‍රිකට්', 'හොකී', 'එල්ලේ'], ta: ['පාපන්දු', 'ක්‍රිකට්', 'හොකී', 'එල්ලේ'], en: ['පාපන්දු', 'ක්‍රිකට්', 'හොකී', 'එල්ලේ'] },
        answer: 1, emoji: '🏏',
      },
      {
        id: 'D3',
        type: 'fill_blank', subject: 'sinhala', skill: 'grammar',
        question: { si: 'පුරුෂ ලිංග ඒක වචන නාම පදයකි.', ta: 'පුරුෂ ලිංග ඒක වචන නාම පදයකි.', en: 'පුරුෂ ලිංග ඒක වචන නාම පදයකි.' },
        blank_choices: { si: ['ගොවියා', 'මිනිසා', 'අයියලා'], ta: ['ගොවියා', 'මිනිසා', 'අයියලා'], en: ['ගොවියා', 'මිනිසා', 'අයියලා'] },
        answer: 0, emoji: '🏡',
      },
      {
        id: 'D4',
        type: 'count', subject: 'mathematics', skill: 'counting',
        question: { si: 'ත්‍රිකෝණ කීයක් තිබේද?', ta: 'எத்தனை முக்கோணங்கள் உள்ளன?', en: 'How many triangles are there?' },
        display_emoji: '🔺', count: 6,
        options: { si: ['4', '5', '6', '7'], ta: ['4', '5', '6', '7'], en: ['4', '5', '6', '7'] },
        answer: 2, emoji: '🔺',
      },
      {
        id: 'D5',
        type: 'match', subject: 'english', skill: 'vocabulary',
        question: { si: 'වර්ණ ගලපන්න', ta: 'நிறங்களை பொருத்துங்கள்', en: 'Match the colours' },
        pairs: [
          { word: { si: 'රතු', ta: 'சிவப்பு', en: 'Red' },    emoji: '🔴' },
          { word: { si: 'නිල්', ta: 'நீலம்', en: 'Blue' },    emoji: '🔵' },
          { word: { si: 'කොළ', ta: 'பச்சை', en: 'Green' },   emoji: '🟢' },
          { word: { si: 'කහ', ta: 'மஞ்சள்', en: 'Yellow' }, emoji: '🟡' },
        ],
        emoji: '🎨',
      },
      {
        id: 'D6',
        type: 'mcq', subject: 'mathematics', skill: 'subtraction',
        question: { si: '27 - 10 = ?', ta: '27 - 10 = ?', en: '27 - 10 = ?' },
        options: { si: ['15', '16', '17', '18'], ta: ['15', '16', '17', '18'], en: ['15', '16', '17', '18'] },
        answer: 2, emoji: '➖',
      },
      {
        id: 'D7',
        type: 'true_false', subject: 'evs', skill: 'science',
        question: { si: 'ශාකයන්ට ජලය, ඉඩ, හිරු රශ්මිය අවශ්‍යයිද?', ta: 'தாவரங்களுக்கு நீர், இடம், சூரிய ஒளி தேவை. — சரியா?', en: 'Plants need water, space, and sunlight. — True?' },
        answer: true, emoji: '🌱',
      },
      {
        id: 'D8',
        type: 'sort_order', subject: 'sinhala', skill: 'sentence_building',
        question: { si: 'වචන ගලපා වාක්‍යය සකසන්න ', ta: 'சரியான வரிசையில் வையுங்கள்', en: 'Put in the correct order' },
        words: { si: ['ඇය', 'ගෙදර', 'යයි'], ta: ['அவள்', 'வீட்டிற்கு', 'போகிறாள்'], en: ['She', 'goes', 'home'] },
        correct_order: { si: ['ඇය', 'ගෙදර', 'යයි'], ta: ['அவள்', 'வீட்டிற்கு', 'போகிறாள்'], en: ['She', 'goes', 'home'] },
        emoji: '🔤',
      },
      {
        id: 'D9',
        type: 'pattern', subject: 'mathematics', skill: 'patterns',
        question: { si: 'ඊළඟ සංඛ්‍යාව කුමක්ද?', ta: 'அடுத்த எண்?', en: 'Next number?' },
        sequence: ['5', '10', '15', '20', '?'],
        options: { si: ['22', '24', '25', '30'], ta: ['22', '24', '25', '30'], en: ['22', '24', '25', '30'] },
        answer: 2, emoji: '🔢',
      },
      {
        id: 'D10',
        type: 'mcq', subject: 'evs', skill: 'community',
        question: { si: 'ගිනි නිවීමේ රථය ගෙන යන්නේ?', ta: 'தீயை அணைப்பவர் யார்?', en: 'Who drives a fire engine?' },
        options: { si: ['වෛද්‍යවරයා', 'ගිනි නිවන භටයා', 'ගුරුවරයා', 'පොලිස් නිලධාරියා'], ta: ['மருத்துவர்', 'தீயணைப்பாளர்', 'ஆசிரியர்', 'போலீசார்'], en: ['Doctor', 'Firefighter', 'Teacher', 'Police officer'] },
        answer: 1, emoji: '🚒',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION E — Grade 4 focus
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'E',
    grade: 4,
    tasks: [
      { id:'E1',  type:'mcq',        subject:'sinhala',     skill:'vocabulary',          question:{si:'ජලය නොමැතිව ___ ජීවත් නොවේ.',ta:'நீர் இல்லாமல் ___ வாழ முடியாது.',en:'Without water ___ cannot survive.'},                   options:{si:['ශාකයන්','ගල්','වීදුරු','යකඩ'],ta:['தாவரங்கள்','கற்கள்','கண்ணாடி','இரும்பு'],en:['Plants','Stones','Glass','Iron']},                                answer:0, emoji:'💧' },
      { id:'E2',  type:'mcq',        subject:'mathematics', skill:'multiplication',       question:{si:'5 × 3 = ?',ta:'5 × 3 = ?',en:'5 × 3 = ?'},                                                                                        options:{si:['13','14','15','16'],ta:['13','14','15','16'],en:['13','14','15','16']},                                                                                                                                             answer:2, emoji:'✖️' },
      { id:'E3',  type:'true_false', subject:'english',     skill:'comprehension',        question:{si:'A cat can fly. — Is this true?',ta:'A cat can fly. — Is this true?',en:'A cat can fly. — Is this true?'},                answer:false, emoji:'🐱' },
      { id:'E4',  type:'count',      subject:'mathematics', skill:'counting',             question:{si:'බිත්තර කීයක් තිබේ ද?',ta:'எத்தனை முட்டைகள் உள்ளன?',en:'How many eggs are there?'},                                              display_emoji:'🥚', count:8, options:{si:['6','7','8','9'],ta:['6','7','8','9'],en:['6','7','8','9']},                                                                                                                                             answer:2, emoji:'🥚' },
      { id:'E5',  type:'match',      subject:'english',     skill:'vocabulary',           question:{si:'ආහාර ගලපන්න',ta:'உணவுகளை பொருத்துங்கள்',en:'Match the foods'},                                                                 pairs:[{word:{si:'හාල්',ta:'அரிசி',en:'Rice'},emoji:'🍚'},{word:{si:'ඇපල්',ta:'ஆப்பிள்',en:'Apple'},emoji:'🍎'},{word:{si:'පිටි',ta:'மாவு',en:'Bread'},emoji:'🍞'},{word:{si:'කිරි',ta:'பால்',en:'Milk'},emoji:'🥛'}], emoji:'🍱' },
      { id:'E6',  type:'mcq',        subject:'mathematics', skill:'subtraction',          question:{si:'13 - 8 = ?',ta:'13 - 8 = ?',en:'13 - 8 = ?'},                                                                                  options:{si:['3','4','5','6'],ta:['3','4','5','6'],en:['3','4','5','6']},                                                                                                                                             answer:2, emoji:'➖' },
      { id:'E7',  type:'fill_blank', subject:'sinhala',     skill:'vocabulary',           question:{si:'ඉස්කෝලේ ___ නාදය කරයි.',ta:'பள்ளி ___ ஒலிக்கும்.',en:'The school ___ rings.'},                                                  blank_choices:{si:['සීනුව','දොර','ජනේලය'],ta:['மணி','கதவு','சன்னல்'],en:['Bell','Door','Window']},                                                                                                                           answer:0, emoji:'🔔' },
      { id:'E8',  type:'mcq',        subject:'evs',         skill:'environment',          question:{si:'ගස් කපා දැමීමෙන් ___ විනාශ වේ.',ta:'மரங்களை வெட்டுவதால் ___ அழியும்.',en:'Cutting trees destroys ___.'},                       options:{si:['වනාන්තර','ගල්','නැව','අහස '],ta:['காடுகள்','கற்கள்','கப்பல்','வானம்'],en:['Forests','Stones','Ship','Sky']},                                                                                                  answer:0, emoji:'🌲' },
      { id:'E9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ හැඩය කුමක්ද?',ta:'அடுத்த வடிவம்?',en:'Next shape?'},                                                                                sequence:['🟠','🟠','🟠','🟠','?'],                                                                                                                                                                                          options:{si:['🟡','🟢','🟠','🔴'],ta:['🟡','🟢','🟠','🔴'],en:['🟡','🟢','🟠','🔴']}, answer:2, emoji:'🔮' },
      { id:'E10', type:'mcq',        subject:'sinhala',     skill:'reading_comprehension',question:{si:'ඈ දිනපතා ව්‍යායාම කරයි. ඈ ශරීරය ___ තබා ගනී.',ta:'அவள் தினமும் உடற்பயிற்சி செய்கிறாள். அவள் உடலை ___ வைக்கிறாள்.',en:'She exercises every day. She keeps her body ___.'},options:{si:['සෞඛ්‍යසම්පන්නව','රෝගාතුරව','කම්මැලිව','ශෝකෙන්'],ta:['ஆரோக்கியமாக','நோய்வாய்ப்பட்டு','சோம்பலாக','சோகமாக'],en:['Healthy','Sick','Lazy','Sad']},                                                  answer:0, emoji:'🏃' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION F — Tamil language focus (Grade 3/4)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'F',
    grade: 3,
    tasks: [
      { id:'F1',  type:'mcq',        subject:'tamil',       skill:'reading',              question:{si:'හරකාට දෙමළ වචනය තෝරන්න?',ta:'"ஹரகா" என்பதற்கான தமிழ் சொல்லைத் தேர்ந்தெடுக்கவும்.',en:'Choose the Tamil word for Cow'},            options:{si:['பசு','குதிரை','நாய்','பூனை'],ta:['பசு','குதிரை','நாய்','பூனை'],en:['பசு','குதிரை','நாய்','பூனை']},                                                                                     answer:0, emoji:'🐄' },
      { id:'F2',  type:'mcq',        subject:'mathematics', skill:'addition',             question:{si:'6 + 7 = ?',ta:'6 + 7 = ?',en:'6 + 7 = ?'},                                                                                        options:{si:['12','13','14','15'],ta:['12','13','14','15'],en:['12','13','14','15']},                                                                                                                                             answer:1, emoji:'➕' },
      { id:'F3',  type:'fill_blank', subject:'tamil',       skill:'vocabulary',           question:{si:'___ අහසේ ඇත.',ta:'வானத்தில் ___ உள்ளது.',en:'The ___ is in the sky.'},                                                   blank_choices:{si:['හිරු', 'ගස', 'ජලය'],ta:['சூரியன்','மரம்','நீர்'],en:['Sun','Tree','Water']},                                                                                                                              answer:0, emoji:'☀️' },
      { id:'F4',  type:'true_false', subject:'evs',         skill:'living_things',        question:{si:'මාළුවා ගොඩ ජීවත් වෙයි. — සත්‍යද?',ta:'மீன் நிலத்தில் வாழும். — சரியா?',en:'Fish lives on land. — Is this true?'},              answer:false, emoji:'🐟' },
      { id:'F5',  type:'count',      subject:'mathematics', skill:'counting',             question:{si:'ගස් කීයක් තිබේද?',ta:'எத்தனை மரங்கள் உள்ளன?',en:'How many trees?'},                                                              display_emoji:'🌴', count:4, options:{si:['3','4','5','6'],ta:['3','4','5','6'],en:['3','4','5','6']},                                                                                                                                             answer:1, emoji:'🌴' },
      { id:'F6',  type:'match',      subject:'tamil',       skill:'vocabulary',           question:{si:'දෙමළ වචනය ගලපන්න',ta:'தமிழ் சொல்லை பொருத்துங்கள்',en:'Match the Tamil words'},                                                  pairs:[{word:{si:'அம்மா',ta:'அம்மா',en:'அம்மா '},emoji:'👩'},{word:{si:'அப்பா',ta:'அப்பா',en:'அப்பா'},emoji:'👨'},{word:{si:'தங்கை',ta:'தங்கை',en:'தங்கை'},emoji:'👧'},{word:{si:'அண்ணன்',ta:'அண்ணன்',en:'அண்ணன்'},emoji:'👦'}], emoji:'👨‍👩‍👧‍👦' },
      { id:'F7',  type:'mcq',        subject:'mathematics', skill:'subtraction',          question:{si:'18 - 9 = ?',ta:'18 - 9 = ?',en:'18 - 9 = ?'},                                                                                      options:{si:['7','8','9','10'],ta:['7','8','9','10'],en:['7','8','9','10']},                                                                                                                                                     answer:2, emoji:'➖' },
      { id:'F8',  type:'mcq',        subject:'evs',         skill:'national_awareness',   question:{si:'ශ්‍රී ලංකාවේ ජාතික වෘක්ෂය කුමක්ද?',ta:'இலங்கையின் தேசிய மரம்?',en:'National tree of Sri Lanka?'},                                         options:{si:['නා','දේවදාර','නෙල්ලි','කොහොඹ'],ta:['நா மரம்','தேவதாரு','நெல்லி','கோம்பு'],en:['Na','Devadara','Nelli','Kohomba']},                                                                                                    answer:0, emoji:'🌳' },
      { id:'F9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක්ද?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['3','6','9','12','?'],                                                                                                                                                                                              options:{si:['13','14','15','16'],ta:['13','14','15','16'],en:['13','14','15','16']},  answer:2, emoji:'🔢' },
      { id:'F10', type:'mcq',        subject:'tamil',       skill:'reading',              question:{si:'ළමයා ___ කෑවේය. (Tamil sentence: குழந்தை ___ சாப்பிட்டது.)',ta:'குழந்தை ___ சாப்பிட்டது.',en:'The child ate ___.'},               options:{si:['சாதம்','கல்','மண்','நீர்'],ta:['சாதம்','கல்','மண்','நீர்'],en:['Rice ','Stone ','Mud ','Water']},                                                                                            answer:0, emoji:'🍚' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION G — Grade 4, harder mathematics + EVS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'G',
    grade: 4,
    tasks: [
      { id:'G1',  type:'mcq',        subject:'mathematics', skill:'multiplication',       question:{si:'3 × 5 = ?',ta:'3 × 5 = ?',en:'3 × 5 = ?'},                                                                                        options:{si:['20','31','15','13'],ta:['20','31','15','13'],en:['20','31','15','13']},                                                                                                                                             answer:2, emoji:'✖️' },
      { id:'G2',  type:'mcq',        subject:'sinhala',     skill:'reading_comprehension',question:{si:'අම්මා සමඟ ___ යාමට නංගී ඉතා කැමතියි.',ta:'අම්මා සමඟ ___ යාමට නංගී ඉතා කැමතියි.',en:'අම්මා සමඟ ___ යාමට නංගී ඉතා කැමතියි.'},  options:{si:['ගමන් බිමන්','කෑම බීම ','තෑගී බෝග ','සිරිත් විරිත්'],ta:['ගමන් බිමන්','කෑම බීම ','තෑගී බෝග ','සිරිත් විරිත්'],en:['ගමන් බිමන්','කෑම බීම ','තෑගී බෝග ','සිරිත් විරිත්']},                                                                          answer:0, emoji:'🌊' },
      { id:'G3',  type:'fill_blank', subject:'english',     skill:'grammar',              question:{si:'She ___ to school every day.',ta:'She ___ to school every day.',en:'She ___ to school every day.'},                                blank_choices:{si:['goes','go','went'],ta:['goes','go','went'],en:['goes','go','went']},                                                                                                                                  answer:0, emoji:'🏫' },
      { id:'G4',  type:'count',      subject:'mathematics', skill:'counting',             question:{si:'වෘත්ත ගණන කීයද ?',ta:'எத்தனை வட்டங்கள் உள்ளன?',en:'How many circles?'},                                                           display_emoji:'⭕', count:10, options:{si:['8','9','10','11'],ta:['8','9','10','11'],en:['8','9','10','11']},                                                                                                                                            answer:2, emoji:'⭕' },
      { id:'G5',  type:'mcq',        subject:'evs',         skill:'environment',          question:{si:'වාතය දූෂිත කරන්නේ ___ .'  ,ta:'காற்றை மாசுபடுத்துவது ___.',en:'___ pollutes the air.'},                                          options:{si:['කර්මාන්ත ශාලා දුම','ජලය','කොළ','ගස්'],ta:['தொழிற்சாலை புகை','நீர்','இலைகள்','மரங்கள்'],en:['Factory smoke','Water','Leaves','Trees']},                                                                               answer:0, emoji:'🏭' },
      { id:'G6',  type:'mcq',        subject:'mathematics', skill:'division',             question:{si:'12 ÷ 3 = ?',ta:'12 ÷ 3 = ?',en:'12 ÷ 3 = ?'},                                                                                      options:{si:['2','3','4','5'],ta:['2','3','4','5'],en:['2','3','4','5']},                                                                                                                                                         answer:2, emoji:'➗' },
      { id:'G7',  type:'true_false', subject:'sinhala',     skill:'comprehension',        question:{si:'"ගසකට වර්ධනය වීමට ජලය අවශ්‍යය." - සත්‍යද?',ta:'"மரத்திற்கு வளர தண்ணீர் தேவை." — சரியா?',en:'"Plants need water to grow." — True?'},      answer:true, emoji:'🌱' },
      { id:'G8',  type:'match',      subject:'english',     skill:'vocabulary',           question:{si:'ක්‍රියා ගලපන්න',ta:'வினைச்சொற்களை பொருத்துங்கள்',en:'Match the action words'},                                                   pairs:[{word:{si:'දිවීම',ta:'ஓடுவது',en:'Run'},emoji:'🏃'},{word:{si:'පිහිනීම',ta:'நீந்துவது',en:'Swim'},emoji:'🏊'},{word:{si:'ගීත ගැයීම',ta:'பாடுவது',en:'Sing'},emoji:'🎤'},{word:{si:'ඇඳීම',ta:'வரைவது',en:'Draw'},emoji:'🎨'}], emoji:'🔗' },
      { id:'G9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක්ද?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['100','90','80','70','?'],                                                                                                                                                                                          options:{si:['65','60','55','50'],ta:['65','60','55','50'],en:['65','60','55','50']}, answer:1, emoji:'🔢' },
      { id:'G10', type:'mcq',        subject:'evs',         skill:'health',               question:{si:'ශරීරය සෝදා පිරිසිදු කර ගැනීම ___ .',ta:'உடலை சுத்தம் செய்வது ___.',en:'Keeping the body clean is ___.'},                         options:{si:['වැදගත්','අනවශ්‍ය','අමාරු','නරක'],ta:['முக்கியம்','தேவையற்றது','கஷ்டமானது','கெட்டது'],en:['Important','Unnecessary','Difficult','Bad']},                                                                                answer:0, emoji:'🧼' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION H — Mixed Grade 3/4, body + community + higher maths
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'H',
    grade: 4,
    tasks: [
      { id:'H1',  type:'mcq',        subject:'evs',         skill:'human_body',           question:{si:'හදවත ශරීරය තුළ ___ කරයි.',ta:'இதயம் உடலில் ___ செய்கிறது.',en:'The heart ___ inside the body.'},                                 options:{si:['රුධිරය පොම්ප කරයි','ජලය ගිලිනවා','ආහාර ජීර්ණය කරයි','ඔක්සිජන් සාදයි'],ta:['இரத்தத்தை செலுத்துகிறது','நீரை விழுங்குகிறது','உணவை செரிக்கிறது','ஆக்சிஜன் உருவாக்குகிறது'],en:['Pumps blood','Swallows water','Digests food','Makes oxygen']},answer:0, emoji:'❤️' },
      { id:'H2',  type:'mcq',        subject:'mathematics', skill:'multiplication',       question:{si:'8 × 2 = ?',ta:'8 × 2 = ?',en:'8 × 2 = ?'},                                                                                        options:{si:['30','21','16','15'],ta:['30','21','16','15'],en:['30','21','16','15']},                                                                                                                                             answer:2, emoji:'✖️' },
      { id:'H3',  type:'sort_order', subject:'sinhala',     skill:'sequence',             question:{si:'නිවැරදි පිළිවෙලට සකසන්න', ta:'சரியான வரிசையில் வையுங்கள் (நாள்)',en:'Put in correct order of the day'},                         words:{si:['රාත්‍රිය','දවල්','උදෑසන'],ta:['இரவு','மதியம்','காலை'],en:['Night','Noon','Morning']},                                                                                                                  correct_order:{si:['උදෑසන','දවල්','රාත්‍රිය'],ta:['காலை','மதியம்','இரவு'],en:['Morning','Noon','Night']},  emoji:'🌅' },
      { id:'H4',  type:'fill_blank', subject:'english',     skill:'grammar',              question:{si:'The children ___ playing in the garden.',ta:'The children ___ playing in the garden.',en:'The children ___ playing in the garden.'},blank_choices:{si:['are','is','am'],ta:['are','is','am'],en:['are','is','am']},                                                                                                                   answer:0, emoji:'🌻' },
      { id:'H5',  type:'count',      subject:'mathematics', skill:'counting',             question:{si:'කෝප්ප කීයක් තිබේද ?',ta:'எத்தனை கோப்பைகள் உள்ளன?',en:'How many cups are there?'},                                                 display_emoji:'☕', count:3, options:{si:['2','3','4','5'],ta:['2','3','4','5'],en:['2','3','4','5']},                                                                                                                answer:1, emoji:'☕' },
      { id:'H6',  type:'mcq',        subject:'evs',         skill:'community',            question:{si:'ලිපියක් යවන්න කුමන ස්ථානයට යා යුතුද?',ta:'கடிதம் அனுப்ப எந்த இடத்திற்கு செல்ல வேண்டும்?',en:'Where should you go to send a letter?'},                          options:{si:['තැපැල් කාර්යාලය','පාසල','වෙළඳසැල','රෝහල'],ta:['அஞ்சலகம்','பள்ளி','கடை','மருத்துவமனை'],en:['Post office','School','Shop','Hospital']},                         answer:0, emoji:'📮' },
      { id:'H7',  type:'mcq',        subject:'mathematics', skill:'division',             question:{si:'20 ÷ 4 = ?',ta:'20 ÷ 4 = ?',en:'20 ÷ 4 = ?'},                                                                                      options:{si:['4','5','6','7'],ta:['4','5','6','7'],en:['4','5','6','7']},                                                                                                                                                         answer:1, emoji:'➗' },
      { id:'H8',  type:'true_false', subject:'english',     skill:'comprehension',        question:{si:'Dogs can talk. Is this true?',ta:'Dogs can talk. — Is this true?',en:'Dogs can talk. — Is this true?'}, answer:false, emoji:'🐕' },
      { id:'H9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක්ද?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['1','4','9','16','?'],                                                                                                                                                                                              options:{si:['20','24','25','30'],ta:['20','24','25','30'],en:['20','24','25','30']},   answer:2, emoji:'🔢' },
      { id:'H10', type:'mcq',        subject:'sinhala',     skill:'reading_comprehension',question:{si:'ශ්‍රී ලංකාව ___ දූපතකි.',ta:'இலங்கை ஒரு ___ தீவு.',en:'Sri Lanka is a ___ island.'},                                          options:{si:['වියළි ','කුඩා','ශීතල','ගිනිකඳු'],ta:['உலர்','சிறிய','குளிரான','எரிமலை'],en:['Dry','Small','Cold','Volcanic']},                                                                                                  answer:1, emoji:'🇱🇰' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION I — Creative / higher-order thinking Grade 4
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'I',
    grade: 4,
    tasks: [
      { id:'I1',  type:'mcq',        subject:'evs',         skill:'environment',          question:{si:'වැසි ජලය රැකගැනීම ___ .',ta:'மழை நீரை சேமிப்பது ___.',en:'Saving rainwater is ___.'},                                           options:{si:['හොඳයි','නරකයි','කාල නාස්තිකරනවා','ව්‍යාකූලයි'],ta:['நல்லது','கெட்டது','நேரத்தை வீணடிப்பது','குழப்பமானது'],en:['Good','Bad','Wasteful','Confusing']},                                                          answer:0, emoji:'🌧️' },
      { id:'I2',  type:'mcq',        subject:'mathematics', skill:'fractions',            question:{si:'අයියා අඹ ගෙඩි 7ක් කැඩුවේ ය. ඉන් 3 ක් මට දුන්නේනම් අයියාට අඹ ගෙඩි කීයද? ',ta:'என் சகோதரன் 7 மாம்பழங்களைப் பறித்தான். அவற்றில் 3-ஐ அவன் எனக்குக் கொடுத்தால், அவனிடம் எத்தனை மாம்பழங்கள் இருக்கும்?',en:'My brother picked 7 mangoes. If he gave me 3 of them, how many mangoes would my brother have?'},options:{si:['2','3','4','5'],ta:['2','3','4','5'],en:['2','3','4','5']},     answer:2, emoji:'🥭' },
      { id:'I3',  type:'sort_order', subject:'evs',         skill:'sequence',             question:{si:'ශාකයේ වර්ධනය නිවැරදි ක්‍රමයට සකසන්න',ta:'தாவரத்தின் வளர்ச்சியை சரியான வரிசையில் வையுங்கள்',en:'Put plant growth in correct order'},words:{si:['ගෙඩිය','බීජය','පැළය','ගස'],ta:['பழம்','விதை','நாற்று','மரம்'],en:['Fruit','Seed','Seedling','Tree']},                                                               correct_order:{si:['බීජය','පැළය','ගස','ගෙඩිය'],ta:['விதை','நாற்று','மரம்','பழம்'],en:['Seed','Seedling','Tree','Fruit']}, emoji:'🌱' },
      { id:'I4',  type:'true_false', subject:'english',     skill:'comprehension',        question:{si:'"Birds can fly:"',ta:'"Birds can fly:"',en:'"Birds can fly:"'},answer:true, emoji:'🐦' },
      { id:'I5',  type:'count',      subject:'mathematics', skill:'counting',             question:{si:'අඹ ගෙඩි කීයක් තියනවද?',ta:'எத்தனை கோல் பழங்கள் உள்ளன?',en:'How many mangoes are there?'},                                       display_emoji:'🥭', count:6, options:{si:['4','5','6','7'],ta:['4','5','6','7'],en:['4','5','6','7']},                                                                                                                                            answer:2, emoji:'🥭' },
      { id:'I6',  type:'mcq',        subject:'mathematics', skill:'multiplication',       question:{si:'9 × 3 = ?',ta:'9 × 3 = ?',en:'9 × 3 = ?'},                                                                                        options:{si:['25','26','27','28'],ta:['25','26','27','28'],en:['25','26','27','28']},                                                                                                                                             answer:2, emoji:'✖️' },
      { id:'I7',  type:'fill_blank', subject:'sinhala',     skill:'vocabulary',           question:{si:'ශ්‍රී ලංකාවේ ජාතික ක්‍රීඩාව ___ ය.', ta:'இலங்கையின் தேசிய விளையாட்டு ___.',en:'The national sport of Sri Lanka is ___.'},           blank_choices:{si:['වොලිබෝල්','ක්‍රිකට්','හොකී'],ta:['கைப்பந்து','கிரிக்கெட்','ஹாக்கி'],en:['Volleyball','Cricket','Hockey']},                                                                                               answer:0, emoji:'🏐' },
      { id:'I8',  type:'true_false', subject:'evs',         skill:'science',              question:{si:'ශාක වැඩෙන්න හිරු එළිය අවශ්‍ය වේ.',ta:'தாவரங்கள் வளர்வதற்கு சூரிய ஒளி தேவைப்படுகிறது.',en:'Plants need sunlight to grow.'}, answer:true, emoji:'🌿' },
      { id:'I9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක්ද?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['2','4','8','16','?'],                                                                                                                                                                                              options:{si:['20','24','32','36'],ta:['20','24','32','36'],en:['20','24','32','36']}, answer:2, emoji:'🔢' },
      { id:'I10', type:'match',      subject:'english',     skill:'vocabulary',           question:{si:'සත්තු හා ඔවුන්ගේ වාසස්ථාන ගලපන්න',ta:'விலங்குகள் மற்றும் அவற்றின் வாழிடங்களை பொருத்துங்கள்',en:'Match animals with their homes'},                                        pairs:[{word:{si:'වනය',ta:'காடு',en:'Forest'},emoji:'🦁'},{word:{si:'ගුල',ta:'துளை',en:'Hole'},emoji:'🐭'},{word:{si:'කූඩුව',ta:'கூண்டு',en:'Coop'},emoji:'🐔'},{word:{si:'ජලය',ta:'நீர்',en:'Water'},emoji:'🐟'}] },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION J — Grade 4, disaster awareness + advanced
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'J',
    grade: 4,
    tasks: [
      { id:'J1',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක්ද?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['3','6','9','12','?'],                                                                                                                                                                                              options:{si:['20','14','15','16'],ta:['20','14','15','16'],en:['20','14','15','16']}, answer:2, emoji:'🔢' },
      { id:'J2',  type:'mcq',        subject:'mathematics', skill:'multiplication',       question:{si:'7 × 8 = ?',ta:'7 × 8 = ?',en:'7 × 8 = ?'},                                                                                        options:{si:['54','55','56','57'],ta:['54','55','56','57'],en:['54','55','56','57']},                                                                                                                                             answer:2, emoji:'✖️' },
      { id:'J3',  type:'fill_blank', subject:'sinhala',     skill:'vocabulary',           question:{si:'ඔබෙන් පාසලට ලබා දිය හැකි තිළිණයකි.',ta:'நீங்கள் பள்ளிக்குக் கொடுக்கக்கூடிய ஒரு பரிசு.',en:'A gift you can give to the school.'},              blank_choices:{si:['මල් පාත්ති සැකසීම','හොඳින් ඉගෙන ගැනීම.','දිනපතා පාසල් නොයෑම.'],ta:['பூ படுக்கை ஏற்பாடு','நன்றாகப் படிப்பது','தினமும் பள்ளிக்குச் செல்லாமல் இருப்பது.'],en:['Flower bed arrangementd','Studying well','Not going to school every day.']},    answer:1, emoji:'🎁' },
      { id:'J4',  type:'mcq',        subject:'evs',         skill:'vocabulary',           question:{si:'ජාතික ගීය ගයන කරන විට ',ta:'தேசிய கீதம் பாடப்படும்போது',en:'When the national anthem is sung'},                                          options:{si:['කෙලින් සිට ගෙන සිටිය යුතු ය.','නිශ්ශබ්දව සිටිය යුතුයි.', 'සීරුවෙන් සිට ගෙන සිට ඊට ගෞරවය කල යුතුය.'], ta:['நீங்கள் நேராக நிற்க வேண்டும்.','நீங்கள் அமைதியாக இருக்க வேண்டும்.', 'நாம் விழிப்புடன் இருந்து அதை மதிக்க வேண்டும்.'],en:['You should stand up straight.','You should be silent.','You should stand respectfully.']},    answer:2, emoji:'🎶' },
      { id:'J5',  type:'match', subject:'english', skill:'vocabulary',
      question: { si: 'සතුන් සහ රූපය ගලපන්න', ta: 'விலங்குகளை படத்துடன் பொருத்துங்கள்', en: 'Match the animals to the pictures' },
      pairs: [
        { word: { si: 'Rabbit', ta: 'Rabbit', en: 'Rabbit' }, emoji: '🐰' },
        { word: { si: 'Cow', ta: 'Cow', en: 'Cow' }, emoji: '🐄' },
        { word: { si: 'Dog', ta: 'Dog', en: 'Dog' }, emoji: '🐕' },
        { word: { si: 'Cat', ta: 'Cat', en: 'Cat' }, emoji: '🐱' },
        { word: { si: 'Fish', ta: 'Fish', en: 'Fish' }, emoji: '🐟' },
      ],
      emoji: '🐾',},
      { id:'J6',  type:'true_false', subject:'evs',         skill:'vocabulary',           question:{si:'කපුටා ගෘහ ආශ්‍රිතව ඇති කරන සතෙකි.',ta:'காக்கை என்பது வீட்டில் வளர்க்கப்படும் ஒரு விலங்கு.',en:'The crow is an animal that is kept in the household. — True?'}, answer:false, emoji:'✅' },
      { id:'J7',  type:'mcq',        subject:'mathematics', skill:'division',             question:{si:'36 ÷ 6 = ?',ta:'36 ÷ 6 = ?',en:'36 ÷ 6 = ?'},                                                                                      options:{si:['4','5','6','7'],ta:['4','5','6','7'],en:['4','5','6','7']},                                                                                                                                                         answer:2, emoji:'➗' },
      { id:'J8',  type:'mcq',        subject:'sinhala',     skill:'reading_comprehension',question:{si:'ස්වේච්ඡා සේවකයෝ ___ කරයි.',ta:'தன்னார்வலர்கள் ___ செய்கிறார்கள்.',en:'Volunteers ___ to help others.'},                          options:{si:['නොමිලේ සේවය','ගෙවීමට','අලසව '],ta:['இலவசமாக சேவை','பணம் பெற்று','சோம்பேறித்தனமாக'],en:['Serve for free','Get paid','Lazily']},                                                          answer:0, emoji:'🤝' },
      { id:'J9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක්ද ?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['1','3','7','15','?'],                                                                                                                                                                                              options:{si:['20','28','31','34'],ta:['20','28','31','34'],en:['20','28','31','34']},    answer:2, emoji:'🔢' },
      { id:'J10', type:'mcq',        subject:'evs',         skill:'disaster_safety',      question:{si:'ගින්නක් ආ විට ළමුන් ___ .',ta:'தீ வரும்போது குழந்தைகள் ___.',en:'When fire breaks out children should ___.'},                   options:{si:['ලඟා නොවෙමින් ආරක්ෂිත ස්ථානයකට යන්න','ගිනි ළඟට දිවෙන්න','නිදා ගන්න','ගෙදරම ඉන්න'],ta:['நெருங்காமல் பாதுகாப்பான இடத்திற்கு செல்லுங்கள்','தீயை நெருங்குங்கள்','தூங்குங்கள்','வீட்டிலேயே இருங்கள்'],en:['Move away to safety','Run towards fire','Sleep','Stay home']}, answer:0, emoji:'🔥' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION K — Special: all-EVS + community + health
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'K',
    grade: 3,
    tasks: [
      { id:'K1',  type:'mcq',        subject:'evs',         skill:'health',               question:{si:'දිනකට ___ වතාවක් දත් මදිනු ලැබේ.',ta:'ஒரு நாளில் ___ முறை பல் தேய்க்க வேண்டும்.',en:'You should brush teeth ___ times a day.'},     options:{si:['1','2','3','4'],ta:['1','2','3','4'],en:['1','2','3','4']},                                                                                                                                                         answer:1, emoji:'🦷' },
      { id:'K2',  type:'mcq',        subject:'mathematics', skill:'addition',             question:{si:'16 + 14 = ?',ta:'16 + 14 = ?',en:'16 + 14 = ?'},                                                                                  options:{si:['28','29','30','31'],ta:['28','29','30','31'],en:['28','29','30','31']},                                                                                                                                             answer:2, emoji:'➕' },
      { id:'K3',  type:'match',      subject:'english',     skill:'vocabulary',           question:{si:'Match food groups',ta:'Match food groups',en:'Match food groups'},                                                      pairs:[{word:{si:'Banana',ta:'Banana',en:'Banana'},emoji:'🍌'},{word:{si:'Carrot',ta:'Carrot',en:'Carrot'},emoji:'🥕'},{word:{si:'Fish',ta:'Fish',en:'Fish'},emoji:'🐟'},{word:{si:'Milk',ta:'Milk',en:'Milk'},emoji:'🥛'}], emoji:'🥗' },
      { id:'K4',  type:'true_false', subject:'evs',         skill:'health',               question:{si:'ශාරීරික ව්‍යායාම සෞඛ්‍යයට හොඳයි.',ta:'உடற்பயிற்சி உடலுக்கு நல்லது. — சரியா?',en:'Physical exercise is good for health.'}, answer:true, emoji:'🏃' },
      { id:'K5',  type:'count',      subject:'mathematics', skill:'counting',             question:{si:'ළූණු කීයක් තිබේද ?',ta:'எத்தனை வெங்காயங்கள் உள்ளன?',en:'How many onions?'},                                                       display_emoji:'🧅', count:13, options:{si:['12','9','13','10'],ta:['12','9','13','10'],en:['12','9','13','10']},                                                                                                       answer:2, emoji:'🧅' },
      { id:'K6',  type:'mcq',        subject:'evs',         skill:'community',            question:{si:'මාර්ගය හරහා යාමට පෙර ඔබ කුමක් කළ යුතුද?',ta:'சாலையை கடக்க முன் நீங்கள் என்ன செய்ய வேண்டும்?',en:'What should you do before crossing the road?'},options:{si:['වම හා දකුණ බලන්න','ඉක්මනින් දුවන්න','ඇස් වසාගන්න','සිනාසෙන්න'],ta:['இடமும் வலமும் பார்க்க','வேகமாக ஓட','கண்களை மூட','சிரிக்க'],en:['Look left and right','Run fast','Close eyes','Smile']},                            answer:0, emoji:'👩‍🏫' },
      { id:'K7',  type:'mcq',        subject:'mathematics', skill:'subtraction',          question:{si:'40 - 17 = ?',ta:'40 - 17 = ?',en:'40 - 17 = ?'},                                                                                  options:{si:['21','22','23','24'],ta:['21','22','23','24'],en:['21','22','23','24']},                                                                                                                                             answer:2, emoji:'➖' },
      { id:'K8',  type:'fill_blank', subject:'sinhala',     skill:'vocabulary',           question:{si:'ශ්‍රී ලංකාවේ ජාතික පුෂ්පය කුමක්ද?',ta:'இலங்கையின் தேசிய மலர் எது?',en:'What is the national flower of Sri Lanka?'},           blank_choices:{si:['කපුරු','අරලිය','නිල් මානෙල් '],ta:['கற்பூரம்','கோயில்','நீல அல்லி'],en:['Camphor','Temple tree flower','Blue Water Lily']},                                                                             answer:2, },
      { id:'K9',  type:'pattern',    subject:'mathematics', skill:'patterns',             question:{si:'ඊළඟ සංඛ්‍යාව කුමක් ද?',ta:'அடுத்த எண்?',en:'Next number?'},                                                                              sequence:['10','20','30','40','?'],                                                                                                                                                                                           options:{si:['45','48','50','55'],ta:['45','48','50','55'],en:['45','48','50','55']},    answer:2, emoji:'🔢' },
      { id:'K10', type:'mcq',        subject:'evs',         skill:'environment',          question:{si:'ශ්‍රී ලංකාවේ ජාතික වනෝද්‍යානයකි?',ta:'இலங்கையின் தேசிய பூங்கா?',en:'A famous national park in Sri Lanka?'},                         options:{si:['යාල', 'මහනුවර', 'කොළඹ', 'නුවරඑළිය'],ta:['யால', 'கண்டி', 'கொழும்பு', 'நுவரெலியா'],en:['Yala','Kandy','Colombo','Nuwara Eliya']},                                                                                        answer:0, emoji:'🦁' },
    ],
  },
]

// ── Session utilities ─────────────────────────────────────────────────────────

/**
 * Get a random session, optionally filtered by grade
 * @param {3|4|null} grade
 * @returns {Object} session
 */
export function getRandomSession(grade = null) {
  const pool = grade
    ? SESSIONS.filter(s => s.grade === grade || s.grade === null)
    : SESSIONS
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Get a specific session by ID
 * @param {string} id — 'A' through 'K'
 */
export function getSession(id) {
  return SESSIONS.find(s => s.id === id) ?? SESSIONS[0]
}

/** All session IDs */
export const SESSION_IDS = SESSIONS.map(s => s.id)

/** Subject colour map for UI */
export const SUBJECT_COLORS = {
  mathematics: { bg: '#CCFBF1', text: '#0D9488', label: 'Mathematics · ගණිතය · கணிதம்' },
  sinhala:     { bg: '#FED7AA', text: '#C2410C', label: 'Sinhala · සිංහල' },
  english:     { bg: '#BAE6FD', text: '#0369A1', label: 'English' },
  tamil:       { bg: '#EDE9FE', text: '#6D28D9', label: 'Tamil · தமிழ்' },
  evs:         { bg: '#DCFCE7', text: '#166534', label: 'EVS · පරිසරය · சூழல்' },
}

/** Task type labels (bilingual) */
export const TASK_TYPE_LABELS = {
  mcq:        { si: 'නිවැරදි පිළිතුර තෝරන්න', ta: 'சரியான விடையை தேர்ந்தெடுங்கள்', en: 'Choose the correct answer' },
  fill_blank: { si: 'හිස්තැන පුරවන්න',         ta: 'இடைவெளியை நிரப்புங்கள்',         en: 'Fill in the blank' },
  match:      { si: 'ගලපන්න',                    ta: 'பொருத்துங்கள்',                    en: 'Match the pairs' },
  count:      { si: 'ගණන් කරන්න',               ta: 'எண்ணுங்கள்',                       en: 'Count and choose' },
  sort_order: { si: 'නිවැරදි පිළිවෙලට සකසන්න',  ta: 'சரியான வரிசையில் வையுங்கள்',      en: 'Put in correct order' },
  true_false: { si: 'හරි හෝ වැරදිද?',         ta: 'சரியா தவறா?',                      en: 'True or False?' },
  pattern:    { si: 'ඊළඟට කුමක්ද?',              ta: 'அடுத்து என்ன?',                    en: 'What comes next?' },
}
