// Script to check curriculum content
const https = require('https');

const data = JSON.stringify({ data: {} });

const options = {
  hostname: 'us-central1-ai-lms-pro.cloudfunctions.net',
  path: '/debugKnowledgeBase',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const result = JSON.parse(body);
    console.log('\n📊 Knowledge Base Summary:\n');
    console.log(`Total: ${result.result.total}`);
    console.log(`By Type: ${JSON.stringify(result.result.byVolumeType)}`);
    console.log(`Grade ב: ${JSON.stringify(result.result.gradeB)}`);
    console.log('\n📋 Curriculum Samples:\n');
    result.result.curriculumSamples.forEach((doc, i) => {
      console.log(`[${i+1}] Chapter: ${doc.chapter}`);
      console.log(`    Grade: ${doc.grade}, Grades: ${JSON.stringify(doc.grades)}`);
      console.log(`    Source: ${doc.source}`);
      console.log('');
    });
  });
});

req.write(data);
req.end();
