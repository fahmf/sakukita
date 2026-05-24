const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:\\Users\\hpstd\\.gemini\\antigravity\\brain\\9ee2050c-d957-4253-9675-788c2078e428\\.system_generated\\logs\\transcript.jsonl';
const outputPath = 'C:\\Users\\hpstd\\.gemini\\antigravity\\brain\\9ee2050c-d957-4253-9675-788c2078e428\\full_review_from_user.md';

const fileContent = fs.readFileSync(transcriptPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.content && obj.content.includes('# Review Proyek "Saku Kita"')) {
      fs.writeFileSync(outputPath, obj.content, 'utf8');
      console.log('Successfully wrote review to:', outputPath);
      break;
    }
  } catch (e) {
    // ignore
  }
}
