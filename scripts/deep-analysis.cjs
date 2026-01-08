// Deep analysis of QA failures - understand root causes
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deepAnalysis() {
  console.log('🔬 Deep Analysis of QA Failures\n');
  console.log('='.repeat(80));

  const coursesSnapshot = await db.collection('courses').get();
  console.log(`\n📚 Total courses in system: ${coursesSnapshot.size}\n`);

  const analysis = {
    totalCourses: coursesSnapshot.size,
    emptyCourses: [],
    coursesWithEmptyUnits: [],
    coursesWithMCProblems: [],
    coursesWithNoActivityBlocks: [],
    byStatus: {},
    byCreationMethod: {},
    patterns: []
  };

  for (const courseDoc of coursesSnapshot.docs) {
    const data = courseDoc.data();
    const courseId = courseDoc.id;
    const courseTitle = data.title || data.name || 'Untitled';
    const syllabus = data.syllabus || [];
    const status = data.status || 'unknown';
    const createdAt = data.createdAt?.toDate?.() || data.createdAt;

    // Track by status
    analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;

    // Check if course is empty
    const totalUnits = syllabus.reduce((sum, m) => sum + (m.learningUnits?.length || 0), 0);
    const totalBlocks = syllabus.reduce((sum, m) => {
      return sum + (m.learningUnits || []).reduce((uSum, u) => {
        return uSum + (u.activityBlocks?.length || 0);
      }, 0);
    }, 0);

    if (totalUnits === 0 || totalBlocks === 0) {
      analysis.emptyCourses.push({
        id: courseId,
        title: courseTitle,
        status,
        totalUnits,
        totalBlocks,
        createdAt,
        teacherId: data.teacherId
      });
    }

    // Check for empty units (units with no blocks)
    let emptyUnitsCount = 0;
    let unitsWithNoActivity = 0;
    let mcProblems = [];

    syllabus.forEach((module, mIdx) => {
      (module.learningUnits || []).forEach((unit, uIdx) => {
        const blocks = unit.activityBlocks || [];

        if (blocks.length === 0) {
          emptyUnitsCount++;
        }

        // Check if unit has any interactive blocks
        const hasActivity = blocks.some(b =>
          ['multiple-choice', 'multipleChoice', 'open-question', 'openQuestion', 'fill-in-blank', 'drag-drop'].includes(b.type)
        );
        if (!hasActivity && blocks.length > 0) {
          unitsWithNoActivity++;
        }

        // Check MC blocks
        blocks.forEach((block, bIdx) => {
          if (block.type === 'multiple-choice' || block.type === 'multipleChoice') {
            const content = block.content || {};
            const options = content.options || [];
            const correctAnswer = content.correctAnswer || content.correct_answer;

            let problem = null;
            if (options.length === 0) {
              problem = 'no_options';
            } else if (!correctAnswer) {
              problem = 'no_correct_answer';
            } else {
              // Check if correct answer matches any option
              const optionTexts = options.map(o => typeof o === 'string' ? o : (o.text || o.label || o.value));
              if (!optionTexts.includes(correctAnswer)) {
                problem = 'answer_not_in_options';
              }
            }

            if (problem) {
              mcProblems.push({
                unitTitle: unit.title,
                blockId: block.id,
                problem,
                question: (content.question || '').substring(0, 50),
                optionsCount: options.length,
                correctAnswer
              });
            }
          }
        });
      });
    });

    if (emptyUnitsCount > 0) {
      analysis.coursesWithEmptyUnits.push({
        id: courseId,
        title: courseTitle,
        emptyUnitsCount,
        totalUnits
      });
    }

    if (mcProblems.length > 0) {
      analysis.coursesWithMCProblems.push({
        id: courseId,
        title: courseTitle,
        problems: mcProblems
      });
    }

    if (unitsWithNoActivity > 0) {
      analysis.coursesWithNoActivityBlocks.push({
        id: courseId,
        title: courseTitle,
        unitsWithNoActivity
      });
    }
  }

  // Print analysis
  console.log('\n📊 ANALYSIS RESULTS');
  console.log('='.repeat(80));

  console.log('\n\n1️⃣ COURSES BY STATUS:');
  Object.entries(analysis.byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    const pct = ((count / analysis.totalCourses) * 100).toFixed(1);
    console.log(`   ${status}: ${count} (${pct}%)`);
  });

  console.log('\n\n2️⃣ EMPTY COURSES (no units or no blocks):');
  console.log(`   Total: ${analysis.emptyCourses.length} courses`);
  if (analysis.emptyCourses.length > 0) {
    console.log('\n   Breakdown:');
    analysis.emptyCourses.slice(0, 10).forEach(c => {
      console.log(`   - "${c.title}" (${c.status}) - ${c.totalUnits} units, ${c.totalBlocks} blocks`);
    });
    if (analysis.emptyCourses.length > 10) {
      console.log(`   ... and ${analysis.emptyCourses.length - 10} more`);
    }
  }

  console.log('\n\n3️⃣ COURSES WITH EMPTY UNITS:');
  console.log(`   Total: ${analysis.coursesWithEmptyUnits.length} courses`);
  if (analysis.coursesWithEmptyUnits.length > 0) {
    console.log('\n   Top offenders:');
    analysis.coursesWithEmptyUnits
      .sort((a, b) => b.emptyUnitsCount - a.emptyUnitsCount)
      .slice(0, 10)
      .forEach(c => {
        console.log(`   - "${c.title}": ${c.emptyUnitsCount}/${c.totalUnits} units empty`);
      });
  }

  console.log('\n\n4️⃣ MULTIPLE CHOICE PROBLEMS:');
  console.log(`   Total courses affected: ${analysis.coursesWithMCProblems.length}`);
  const allMCProblems = analysis.coursesWithMCProblems.flatMap(c => c.problems);
  const problemTypes = {};
  allMCProblems.forEach(p => {
    problemTypes[p.problem] = (problemTypes[p.problem] || 0) + 1;
  });
  console.log('\n   Problem types:');
  Object.entries(problemTypes).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count} blocks`);
  });

  if (analysis.coursesWithMCProblems.length > 0) {
    console.log('\n   Detailed breakdown:');
    analysis.coursesWithMCProblems.slice(0, 5).forEach(c => {
      console.log(`\n   Course: "${c.title}"`);
      c.problems.forEach(p => {
        console.log(`     - [${p.problem}] "${p.question}..." (${p.optionsCount} options)`);
      });
    });
  }

  console.log('\n\n5️⃣ ROOT CAUSE ANALYSIS:');
  console.log('='.repeat(80));

  // Identify patterns
  const emptyByStatus = {};
  analysis.emptyCourses.forEach(c => {
    emptyByStatus[c.status] = (emptyByStatus[c.status] || 0) + 1;
  });

  console.log('\n   Empty courses by status:');
  Object.entries(emptyByStatus).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });

  // Recommendations
  console.log('\n\n6️⃣ RECOMMENDATIONS:');
  console.log('='.repeat(80));

  if (analysis.emptyCourses.length > 0) {
    const draftEmpty = analysis.emptyCourses.filter(c => c.status === 'draft').length;
    console.log(`\n   🔸 ${draftEmpty} empty courses are drafts - consider:`);
    console.log('      - Adding validation before saving draft');
    console.log('      - Auto-generating starter content');
    console.log('      - Marking as "incomplete" status');
  }

  if (analysis.coursesWithEmptyUnits.length > 0) {
    console.log('\n   🔸 Courses have units without content blocks - consider:');
    console.log('      - Validating unit has blocks before saving');
    console.log('      - Auto-generating placeholder blocks');
    console.log('      - Showing warning in course editor');
  }

  if (allMCProblems.length > 0) {
    console.log('\n   🔸 Multiple choice blocks have issues - consider:');
    console.log('      - Validating correctAnswer exists in options');
    console.log('      - Auto-selecting first correct option if missing');
    console.log('      - Adding editor validation');
  }

  // Save analysis to file
  const analysisJson = JSON.stringify(analysis, null, 2);
  require('fs').writeFileSync('qa-analysis.json', analysisJson);
  console.log('\n\n💾 Full analysis saved to qa-analysis.json');

  process.exit(0);
}

deepAnalysis();
