const fs = require('fs');
const path = require('path');

const syncFilePath = path.join(__dirname, '../src/lib/db/sync.ts');
if (fs.existsSync(syncFilePath)) {
  let content = fs.readFileSync(syncFilePath, 'utf8');
  content = content.replaceAll(
    `delete (payload as any).syncStatus;`,
    `delete (payload as Record<string, unknown>).syncStatus;`
  );
  fs.writeFileSync(syncFilePath, content, 'utf8');
  console.log('Successfully replaced (payload as any) with (payload as Record<string, unknown>) in sync.ts!');
}
