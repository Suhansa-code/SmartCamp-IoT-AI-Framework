import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const disasterDb = new Database(path.join(__dirname, 'db', 'disaster.db'));
console.log('=== DISASTER.DB ===');
const dTables = disasterDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
for (const t of dTables) {
  const cnt = disasterDb.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
  console.log(`${t.name.padEnd(30)} ${cnt.cnt}`);
}
disasterDb.close();

const pagesDb = new Database(path.join(__dirname, 'db', 'pages.db'));
console.log('\n=== PAGES.DB ===');
const pTables = pagesDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
for (const t of pTables) {
  const cnt = pagesDb.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
  console.log(`${t.name.padEnd(30)} ${cnt.cnt}`);
}
pagesDb.close();
