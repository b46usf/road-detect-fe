const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'lib', 'roboflow-client.ts');
const txt = fs.readFileSync(file, 'utf8');
const lines = txt.split(/\r?\n/);
let balance = 0;
lines.forEach((line, idx) => {
  for (let ch of line) {
    if (ch === '{') balance++;
    if (ch === '}') balance--;
  }
  console.log(String(idx+1).padStart(3) + ': bal=' + balance + '  ' + line);
});
console.log('final balance=' + balance);
