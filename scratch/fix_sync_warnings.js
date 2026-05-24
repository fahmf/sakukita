const fs = require('fs');
const path = require('path');

const syncFilePath = path.join(__dirname, '../src/lib/db/sync.ts');
let content = fs.readFileSync(syncFilePath, 'utf8');

// 1. Replace syncStatus destructuring with delete property to clear unused vars lints
content = content.replaceAll(
  'const { syncStatus, ...payload } = entry.payload;',
  'const payload = { ...entry.payload }; delete (payload as any).syncStatus;'
);

// 2. Replace the 'as any' in pgError to strict type
content = content.replace(
  'const pgError = err as any;',
  'const pgError = err as { code?: string; message?: string };'
);

// 3. Replace the 'as any' in db[entry.entity]
content = content.replace(
  'const table = (db as any)[entry.entity];',
  'const table = (db as unknown as Record<string, { update: (id: string, obj: { syncStatus: "synced" }) => Promise<unknown> }>)[entry.entity];'
);

fs.writeFileSync(syncFilePath, content, 'utf8');
console.log('Successfully applied precise linter fixes to sync.ts!');
