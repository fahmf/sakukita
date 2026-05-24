const fs = require('fs');
const path = require('path');

const paths = [
  'C:\\Users\\hpstd\\.gemini\\antigravity\\brain\\9ee2050c-d957-4253-9675-788c2078e428\\.system_generated\\logs\\transcript.jsonl',
  'C:\\Users\\hpstd\\.gemini\\antigravity\\brain\\7e6e3bba-13c8-4332-b4bf-752eb0d0f172\\.system_generated\\logs\\transcript.jsonl'
];

const outputPath = 'C:\\Users\\hpstd\\.gemini\\antigravity\\brain\\9ee2050c-d957-4253-9675-788c2078e428\\extracted_reviews.md';

let results = '';

for (const p of paths) {
  if (!fs.existsSync(p)) {
    console.log('Path does not exist:', p);
    continue;
  }
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  let count = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      // Let's search inside content or tool_calls
      let text = '';
      if (obj.content) text += obj.content;
      if (obj.tool_calls) text += JSON.stringify(obj.tool_calls);
      
      if (text.includes('# Review Proyek "Saku Kita"') || text.includes('BUG KRITIS')) {
        results += `\n\n--- FOUND IN ${p} (step ${obj.step_index}) ---\n\n`;
        results += obj.content || JSON.stringify(obj.tool_calls, null, 2);
        count++;
      }
    } catch (e) {
      // ignore
    }
  }
  console.log(`Found ${count} occurrences in ${p}`);
}

fs.writeFileSync(outputPath, results, 'utf8');
console.log('Saved to', outputPath);
