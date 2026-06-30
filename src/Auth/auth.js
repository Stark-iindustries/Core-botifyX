let useSQLiteAuthState;

try {
    const BetterSQLite3 = require('better-sqlite3');
    const testDB = new BetterSQLite3(':memory:');
    testDB.prepare('SELECT 1').get();
    testDB.close();

    useSQLiteAuthState = require('./auth-1').useSQLiteAuthState;
    console.log('[BOTIFY-X] Using better-sqlite3 as auth state');

} catch (err) {
    useSQLiteAuthState = require('./auth-2').useSQLiteAuthState;
    console.log('[BOTIFY-X] Using sqlite3 as auth state');
}

module.exports = { useSQLiteAuthState };
