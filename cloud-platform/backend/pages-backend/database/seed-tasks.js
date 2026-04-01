'use strict';

require('dotenv').config();

const path     = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SQLITE_PATH || './database/pages.db';
const db = new Database(path.resolve(DB_PATH));

db.pragma('foreign_keys = ON');

const insert = db.prepare(`
  INSERT OR IGNORE INTO content_tasks
    (task_id, content_session_id, task_order, subject, task_type,
     question_text, option_a, option_b, option_c, correct_answer, grade_level)
  VALUES
    (@task_id, @content_session_id, @task_order, @subject, @task_type,
     @question_text, @option_a, @option_b, @option_c, @correct_answer, @grade_level)
`);

const insertSession = db.prepare(`
  INSERT OR IGNORE INTO content_sessions
    (content_session_id, session_label, grade_level, zeo_approved, approved_date)
  VALUES
    (@content_session_id, @session_label, @grade_level, 1, @approved_date)
`);

//  Helper
let taskCounter = 1;
function t(session, order, subject, type, question, a, b, c, correct, grade) {
  const id = `TASK-${String(taskCounter++).padStart(3,'0')}`;
  return {
    task_id:            id,
    content_session_id: `SESSION-${session}`,
    task_order:         order,
    subject,
    task_type:          type,
    question_text:      question,
    option_a:           a,
    option_b:           b,
    option_c:           c,
    correct_answer:     correct,
    grade_level:        grade,
  };
}

// All 110 tasks (from sessions.js) 
const ALL_TASKS = [

  // SESSION A — Grade 2 focus
  t('A',1,'sinhala','mcq','Choose the correctly spelled word','ෂක්තිය','ශක්තිය','සක්තිය','b',3),
  t('A',2,'mathematics','mcq','3 + 4 = ?','6','7','8','b',3),
  t('A',3,'sinhala','fill_blank','___ grow on trees','Fruits','Stones','Water','a',3),
  t('A',4,'mathematics','count','How many apples? (count 7)','5','6','7','c',3),
  t('A',5,'english','match','Which animal says "meow"?','Cat','Dog','Hen','a',3),
  t('A',6,'mathematics','mcq','9 - 4 = ?','3','4','5','c',3),
  t('A',7,'sinhala','mcq','Who gives plants the energy to produce food?','Sun','Moon','Star','a',3),
  t('A',8,'evs','mcq','This creature lives in water. What is it?','Fish','Rabbit','Elephant','a',3),
  t('A',9,'mathematics','pattern','What comes next? 🔴 🔵 🔴 🔵 🔴 ?','🔵','🔴','🟡','a',3),
  t('A',10,'sinhala','mcq','What color is the parrot?','Red','Blue','Green','c',3),

 
  // SESSION B — Grade 3 focus
  t('B',1,'mathematics','mcq','12 + 5 = ?','15','16','17','c',3),
  t('B',2,'sinhala','true_false','"Reading books completes a man" - True?','True','False','Uncertain','a',3),
  t('B',3,'english','sort_order','Arrange: goes / to school / The boy','The boy goes to school','goes to school The boy','to school goes The boy','a',3),
  t('B',4,'evs','mcq','What is the national bird of Sri Lanka?','Peacock','Swallow','Junglefowl','c',3),
  t('B',5,'mathematics','mcq','15 - 6 = ?','7','8','9','c',3),
  t('B',6,'sinhala','fill_blank','Water falls from the ___','Clouds','Stones','Trees','a',3),
  t('B',7,'mathematics','count','How many stars? (count 5)','4','5','6','b',3),
  t('B',8,'english','match','Match the word to picture: Sun','☀️ Sun','☁️ Cloud','🌧️ Rain','a',3),
  t('B',9,'sinhala','mcq','Achini wore a red dress. What color was it?','Blue','Red','Yellow','b',3),
  t('B',10,'mathematics','pattern','What is the next number? 2, 4, 6, 8, ?','9','10','11','b',3),

  
  // SESSION C — Grade 3/4 bridge
  t('C',1,'evs','mcq','Which part of a plant makes food?','Leaves','Flower','Root','a',3),
  t('C',2,'mathematics','mcq','5 + 13 = ?','18','19','20','b',3),
  t('C',3,'english','match','Match the body part: Eye','👁️ Eye','👃 Nose','👂 Ear','a',3),
  t('C',4,'sinhala','true_false','The sun rises in the east - True?','True','False','Maybe','a',3),
  t('C',5,'mathematics','count','How many bananas? (count 9)','7','8','9','c',3),
  t('C',6,'sinhala','mcq','Choose the correct spelling','ශිෂ්‍යයා','ෂිෂ්‍යයා','ෂිශ්‍යයා','a',3),
  t('C',7,'mathematics','mcq','20 - 8 = ?','10','11','12','c',3),
  t('C',8,'english','fill_blank','The ___ is hot','Sun','Rain','Cloud','a',3),
  t('C',9,'mathematics','pattern','What comes next? 🔺 🔺 🔷 🔺 🔺 ?','🔺','🔷','🟡','b',3),
  t('C',10,'evs','mcq','Who do you visit when sick?','Doctor','Teacher','Driver','a',3),


  // SESSION D — Grade 4 focus
  t('D',1,'mathematics','mcq','3 × 4 = ?','10','11','12','c',4),
  t('D',2,'sinhala','mcq','Dinesh likes cricket. His favorite sport is?','Football','Cricket','Hockey','b',4),
  t('D',3,'sinhala','fill_blank','Answer needed for the question','Farmer','Person','Sisters','a',4),
  t('D',4,'mathematics','count','How many triangles? (count 6)','4','5','6','c',4),
  t('D',5,'english','match','Match the color: Red','🔴 Red','🔵 Blue','🟢 Green','a',4),
  t('D',6,'mathematics','mcq','27 - 10 = ?','15','16','17','c',4),
  t('D',7,'evs','true_false','Plants need water, space, and sunlight - True?','True','False','Maybe','a',4),
  t('D',8,'sinhala','sort_order','Arrange: goes / home / She','She goes home','Home she goes','goes She home','a',4),
  t('D',9,'mathematics','pattern','Next number? 5, 10, 15, 20, ?','22','24','25','c',4),
  t('D',10,'evs','mcq','Who drives a fire engine?','Doctor','Firefighter','Teacher','b',4),


  // SESSION E — Grade 4 focus
  t('E',1,'sinhala','mcq','Without water ___ cannot survive','Plants','Stones','Glass','a',4),
  t('E',2,'mathematics','mcq','5 × 3 = ?','13','14','15','c',4),
  t('E',3,'english','true_false','Can a cat fly? - True?','True','False','Maybe','b',4),
  t('E',4,'mathematics','count','How many eggs? (count 8)','6','7','8','c',4),
  t('E',5,'english','match','Match the food: Rice','🍚 Rice','🍎 Apple','🍞 Bread','a',4),
  t('E',6,'mathematics','mcq','13 - 8 = ?','3','4','5','c',4),
  t('E',7,'sinhala','fill_blank','The school ___ rings','Bell','Door','Window','a',4),
  t('E',8,'evs','mcq','Cutting trees destroys ___','Forests','Stones','Ships','a',4),
  t('E',9,'mathematics','pattern','Next shape? 🟠 🟠 🟠 🟠 ?','🟡','🟢','🟠','c',4),
  t('E',10,'sinhala','mcq','She exercises daily. She keeps healthy:','Healthy','Sick','Lazy','a',4),

 
  // SESSION F — Tamil language focus (Grade 3/4)
  t('F',1,'tamil','mcq','Choose the Tamil word for Cow','பசு','குதிரை','நாய்','a',3),
  t('F',2,'mathematics','mcq','6 + 7 = ?','12','13','14','b',3),
  t('F',3,'tamil','fill_blank','___ உள்ளது - is in the sky','சூரியன்','மரம்','நீர்','a',3),
  t('F',4,'evs','true_false','Fish lives on land - True?','True','False','Maybe','b',3),
  t('F',5,'mathematics','count','How many trees? (count 4)','3','4','5','b',3),
  t('F',6,'tamil','match','அம்மா means which family member?','Mother','Father','Sister','a',3),
  t('F',7,'mathematics','mcq','18 - 9 = ?','7','8','9','c',3),
  t('F',8,'evs','mcq','National tree of Sri Lanka?','Na tree','Devadara','Nelli','a',3),
  t('F',9,'mathematics','pattern','Next number? 3, 6, 9, 12, ?','13','14','15','c',3),
  t('F',10,'tamil','mcq','குழந்தை சாப்பிட்டது - Child ate?','Rice','Stone','Mud','a',3),

  
  // SESSION G — Grade 4, harder mathematics + EVS
  t('G',1,'mathematics','mcq','3 × 5 = ?','20','31','15','c',4),
  t('G',2,'sinhala','mcq','Sister likes to go with mother to ___ ?','Travel','Shopping','Gathering','a',4),
  t('G',3,'english','fill_blank','She ___ to school every day','goes','go','went','a',4),
  t('G',4,'mathematics','count','How many circles? (count 10)','8','9','10','c',4),
  t('G',5,'evs','mcq','___ pollutes the air','Factory smoke','Water','Leaves','a',4),
  t('G',6,'mathematics','mcq','12 ÷ 3 = ?','2','3','4','c',4),
  t('G',7,'evs','true_false','ගසකට ජලය අවශ්‍යය - Plants need water - True?','True','False','Maybe','a',4),
  t('G',8,'english','match','Which verb means to move fast?','Run','Swim','Sing','a',4),
  t('G',9,'mathematics','pattern','Next number? 100, 90, 80, 70, ?','65','60','55','b',4),
  t('G',10,'evs','mcq','Keeping body clean is ___','Important','Unnecessary','Difficult','a',4),

  
  // SESSION H — Mixed Grade 3/4, body + community + higher maths
  t('H',1,'evs','mcq','The heart ___ in the body','Pumps blood','Swallows water','Makes oxygen','a',4),
  t('H',2,'mathematics','mcq','8 × 2 = ?','30','21','16','c',4),
  t('H',3,'sinhala','sort_order','Put in order of day: Night / Noon / Morning','Morning, Noon, Night','Night, Noon, Morning','Noon, Morning, Night','a',4),
  t('H',4,'english','fill_blank','The children ___ playing in garden','are','is','am','a',4),
  t('H',5,'mathematics','count','How many cups? (count 3)','2','3','4','b',4),
  t('H',6,'evs','mcq','Where to send a letter?','Post office','School','Shop','a',4),
  t('H',7,'mathematics','mcq','20 ÷ 4 = ?','4','5','6','b',4),
  t('H',8,'english','true_false','Can dogs talk like humans - True?','True','False','Maybe','b',4),
  t('H',9,'mathematics','pattern','Next number? 1, 4, 9, 16, ?','20','24','25','c',4),
  t('H',10,'sinhala','mcq','ශ්‍රී ලංකාව ___ දූපතකි - is a ___ island','Dry','Small','Cold','b',4),

 
  // SESSION I — Creative / higher-order thinking Grade 4
  t('I',1,'evs','mcq','Saving rainwater is ___','Good','Bad','Wasteful','a',4),
  t('I',2,'mathematics','mcq','Brother picked 7 mangoes, gave me 3. He has?','2','3','4','c',4),
  t('I',3,'evs','sort_order','Plant growth order: Fruit / Seed / Seedling / Tree','Seed, Seedling, Tree, Fruit','Fruit, Seed, Tree, Seedling','Tree, Seed, Fruit, Seedling','a',4),
  t('I',4,'english','true_false','Birds can fly - True?','True','False','Maybe','a',4),
  t('I',5,'mathematics','count','How many mangoes? (count 6)','4','5','6','c',4),
  t('I',6,'mathematics','mcq','9 × 3 = ?','25','26','27','c',4),
  t('I',7,'sinhala','fill_blank','National sport of Sri Lanka is ___','Volleyball','Cricket','Hockey','a',4),
  t('I',8,'evs','true_false','Plants need sunlight to grow - True?','True','False','Maybe','a',4),
  t('I',9,'mathematics','pattern','Next number? 2, 4, 8, 16, ?','20','24','32','c',4),
  t('I',10,'english','match','Animal and home: Lion lives in','Forest','Hole','Coop','a',4),

 
  // SESSION J — Grade 4, disaster awareness + advanced
  t('J',1,'mathematics','pattern','Next number? 3, 6, 9, 12, ?','20','14','15','c',4),
  t('J',2,'mathematics','mcq','7 × 8 = ?','54','55','56','c',4),
  t('J',3,'sinhala','fill_blank','Gift you can give to school:','Study well','Play with friends','Skip school','b',4),
  t('J',4,'evs','mcq','When national anthem plays you should','Stand respectfully','Be silent','Stand straight','c',4),
  t('J',5,'english','match','Which animal? Rabbit','🐰 Rabbit','🐄 Cow','🐕 Dog','a',4),
  t('J',6,'evs','true_false','Crow is a household pet - True?','True','False','Maybe','b',4),
  t('J',7,'mathematics','mcq','36 ÷ 6 = ?','4','5','6','c',4),
  t('J',8,'sinhala','mcq','Volunteers ___ to help others','Serve for free','Get paid','Play games','a',4),
  t('J',9,'mathematics','pattern','Next number? 1, 3, 7, 15, ?','20','28','31','c',4),
  t('J',10,'evs','mcq','When fire breaks out children should','Move away to safety','Run towards fire','Sleep','a',4),


  // SESSION K — Special: all-EVS + community + health
  t('K',1,'evs','mcq','Brush teeth ___ times a day','1','2','3','b',3),
  t('K',2,'mathematics','mcq','16 + 14 = ?','28','29','30','c',3),
  t('K',3,'english','match','Match food group: Banana','🍌 Banana','🥕 Carrot','🐟 Fish','a',3),
  t('K',4,'evs','true_false','Physical exercise is good for health - True?','True','False','Maybe','a',3),
  t('K',5,'mathematics','count','How many onions? (count 13)','12','9','13','c',3),
  t('K',6,'evs','mcq','Before crossing road you should','Look left and right','Run fast','Close eyes','a',3),
  t('K',7,'mathematics','mcq','40 - 17 = ?','21','22','23','c',3),
  t('K',8,'sinhala','fill_blank','National flower of Sri Lanka','Camphor','කර්පුරු','Blue Water Lily','c',3),
  t('K',9,'mathematics','pattern','Next number? 10, 20, 30, 40, ?','45','48','50','c',3),
  t('K',10,'evs','mcq','Which is Sri Lanka national park?','Yala','Kandy','Colombo','a',3),

];

// Run the seed 
const seedAll = db.transaction(() => {
  for (const s of ['A','B','C','D','E','F','G','H','I','J','K']) {
    const grade = ['A', 'B', 'C', 'F', 'K'].includes(s) ? 3 : 4;
    insertSession.run({
      content_session_id: `SESSION-${s}`,
      session_label: s,
      grade_level: grade,
      approved_date: '2024-01-01',
    });
  }

  let inserted = 0;
  let skipped  = 0;

  for (const task of ALL_TASKS) {
    const result = insert.run(task);
    if (result.changes > 0) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
});

try {
  const { inserted, skipped } = seedAll();
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  PAGES — content_tasks seed complete');
  console.log('════════════════════════════════════════');
  console.log(`  Tasks inserted : ${inserted}`);
  console.log(`  Tasks skipped  : ${skipped} (already existed)`);
  console.log(`  Total in DB    : ${inserted + skipped}`);
  console.log('');
  console.log('  Sessions seeded:');
  ['A','B','C','D','E','F','G','H','I','J','K'].forEach(s => {
    const grade = ['A','B','C','F','K'].includes(s) ? 3 : 4;
    console.log(`    SESSION-${s} → Grade ${grade}`);
  });
  console.log('');
  console.log('  You can now call:');
  console.log('  GET /api/session/content/B-001');
  console.log('════════════════════════════════════════');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exit(1);
} finally {
  db.close();
}
