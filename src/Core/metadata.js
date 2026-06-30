const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'Database', 'metadata.db');
const dbe = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ Failed to connect to database:', err.message);
  else console.log('[BOTIFY-X] Connected to metadata database.');
});

dbe.run(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    metadata TEXT
  )
`, (err) => {
  if (err) console.error('❌ Error creating groups table:', err);
  else console.log('[BOTIFY-X] Metadata table is ready.');
});

const getGroupMetadata = (id) => {
  return new Promise((resolve, reject) => {
    dbe.get('SELECT metadata FROM groups WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? JSON.parse(row.metadata) : null);
    });
  });
};

const saveGroupMetadata = (id, metadata) => {
  return new Promise((resolve, reject) => {
    const metadataString = JSON.stringify(metadata);
    dbe.run(
      `INSERT INTO groups (id, metadata) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET metadata = excluded.metadata`,
      [id, metadataString],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const updateGroupMetadata = async (Cypher) => {
  console.log('[BOTIFY-X] 🔄 Updating group metadata for all saved groups...');

  try {
    const rows = await new Promise((resolve, reject) => {
      dbe.all('SELECT id FROM groups', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    for (const row of rows) {
      try {
        const groupMetadata = await Cypher.groupMetadata(row.id);
        await saveGroupMetadata(row.id, groupMetadata);
        console.log(`[BOTIFY-X] ✅ Updated metadata for ${groupMetadata.subject}`);
      } catch (error) {
        console.error(`❌ Failed to update group ${row.id}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000)); // 3-second delay
    }
  } catch (err) {
    console.error('❌ Failed to fetch group IDs:', err);
  }
};

const fetchGroupMetadata = async (remoteJid, Cypher) => {
  let groupMetadata;

  try {
    groupMetadata = await Cypher.groupMetadata(remoteJid);
    if (groupMetadata) {
      await saveGroupMetadata(remoteJid, groupMetadata); 
    }
  } catch (error) {
 groupMetadata = await getGroupMetadata(remoteJid);
  }

  return groupMetadata;
};

module.exports = { getGroupMetadata, saveGroupMetadata, updateGroupMetadata, fetchGroupMetadata };