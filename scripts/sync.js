// Ručná synchronizácia služieb a termínov z Booqme: npm run sync
import { syncAll } from '../src/booqme.js';

try {
  console.log('Synchronizované:', await syncAll());
} catch (e) {
  console.error('Synchronizácia zlyhala:', e.message);
  process.exitCode = 1;
}
