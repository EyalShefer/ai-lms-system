// Script to read QA report from Firestore
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function readReport() {
  try {
    // Get the latest report
    const reportsRef = db.collection('qa_reports');
    const snapshot = await reportsRef.orderBy('createdAt', 'desc').limit(1).get();

    if (snapshot.empty) {
      console.log('No reports found');
      return;
    }

    const report = snapshot.docs[0].data();
    console.log('\n📊 Latest QA Report');
    console.log('==================\n');
    console.log('Report ID:', snapshot.docs[0].id);
    console.log('Created:', report.createdAt?.toDate?.() || report.createdAt);
    console.log('Environment:', report.environment);
    console.log('Triggered By:', report.triggeredBy);

    console.log('\n📈 Summary:');
    console.log('  Total Tests:', report.summary?.totalTests);
    console.log('  Passed:', report.summary?.passed);
    console.log('  Failed:', report.summary?.failed);
    console.log('  Warnings:', report.summary?.warnings);
    console.log('  Pass Rate:', report.summary?.passRate + '%');
    console.log('  Duration:', report.summary?.duration + 'ms');

    console.log('\n📋 Test Suites:');
    for (const suite of report.suites || []) {
      console.log(`\n  [${suite.status?.toUpperCase()}] ${suite.name} (${suite.nameHe})`);
      console.log(`     Passed: ${suite.passedCount}, Failed: ${suite.failedCount}, Warnings: ${suite.warningCount}`);

      for (const test of suite.tests || []) {
        const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚠️';
        console.log(`     ${icon} ${test.name}: ${test.message}`);
        if (test.details) {
          console.log(`        Details:`, JSON.stringify(test.details, null, 2).split('\n').join('\n        '));
        }
      }
    }

    // Output full JSON for detailed analysis
    console.log('\n\n📄 Full Report JSON:');
    console.log(JSON.stringify(report, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

readReport();
