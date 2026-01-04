#!/usr/bin/env node

/**
 * Infographic Cost Calculator
 * Calculates and compares costs for DALL-E 3 vs Imagen 3
 *
 * Usage:
 *   node scripts/cost-calculator.js --teachers 20 --images-per-teacher 25 --cache-rate 0.35
 *   node scripts/cost-calculator.js --help
 */

const args = process.argv.slice(2);

// Parse command line arguments
function parseArgs() {
    const params = {
        teachers: 20,
        imagesPerTeacher: 25,
        cacheRate: 0.30,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--teachers':
            case '-t':
                params.teachers = parseInt(args[++i]);
                break;
            case '--images-per-teacher':
            case '-i':
                params.imagesPerTeacher = parseInt(args[++i]);
                break;
            case '--cache-rate':
            case '-c':
                params.cacheRate = parseFloat(args[++i]);
                break;
            case '--help':
            case '-h':
                params.help = true;
                break;
        }
    }

    return params;
}

// Display help
function showHelp() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         💰 Infographic Cost Calculator                        ║
╚═══════════════════════════════════════════════════════════════╝

USAGE:
  node scripts/cost-calculator.js [OPTIONS]

OPTIONS:
  --teachers, -t <number>           Number of active teachers (default: 20)
  --images-per-teacher, -i <number> Images per teacher per month (default: 25)
  --cache-rate, -c <decimal>        Cache hit rate 0.0-1.0 (default: 0.30)
  --help, -h                        Show this help message

EXAMPLES:
  # Small school (5 teachers, 20 images/month each, 25% cache)
  node scripts/cost-calculator.js -t 5 -i 20 -c 0.25

  # Medium school (20 teachers, 25 images/month each, 35% cache)
  node scripts/cost-calculator.js -t 20 -i 25 -c 0.35

  # Large school (50 teachers, 30 images/month each, 40% cache)
  node scripts/cost-calculator.js -t 50 -i 30 -c 0.40

  # Educational network (200 teachers, 35 images/month each, 45% cache)
  node scripts/cost-calculator.js -t 200 -i 35 -c 0.45

CACHE RATES (typical):
  Small schools (< 10 teachers):    0.20-0.30 (teachers work independently)
  Medium schools (10-50 teachers):  0.30-0.40 (some shared content)
  Large schools (50-100 teachers):  0.35-0.45 (curriculum coordination)
  Networks (100+ teachers):         0.40-0.50 (standardized content library)

═══════════════════════════════════════════════════════════════
    `);
}

// Calculate costs
function calculateCosts(teachers, imagesPerTeacher, cacheRate) {
    const totalImages = teachers * imagesPerTeacher;
    const cacheHits = Math.round(totalImages * cacheRate);
    const newGenerations = totalImages - cacheHits;

    // Provider costs
    const DALL_E_COST_PER_IMAGE = 0.040;
    const IMAGEN_COST_PER_IMAGE = 0.020;

    // DALL-E costs
    const dallEImageCost = newGenerations * DALL_E_COST_PER_IMAGE;
    const dallETotal = dallEImageCost;

    // Imagen costs
    const imagenImageCost = newGenerations * IMAGEN_COST_PER_IMAGE;

    // Imagen additional costs (GCP overhead)
    let gcpOverhead = 0;
    if (totalImages > 1000) {
        // Vertex AI API calls: $0.001 per request after 1000
        const extraRequests = newGenerations - 1000;
        gcpOverhead = Math.max(0, extraRequests * 0.001);
        // Cap at $5/month
        gcpOverhead = Math.min(5, gcpOverhead);
    }

    const imagenTotal = imagenImageCost + gcpOverhead;

    // Savings
    const savings = dallETotal - imagenTotal;
    const savingsPercentage = (savings / dallETotal) * 100;

    // Yearly projections
    const yearlyDallE = dallETotal * 12;
    const yearlyImagen = imagenTotal * 12;
    const yearlySavings = savings * 12;

    return {
        monthly: {
            totalImages,
            cacheHits,
            newGenerations,
            dallE: {
                imageCost: dallEImageCost,
                total: dallETotal
            },
            imagen: {
                imageCost: imagenImageCost,
                gcpOverhead,
                total: imagenTotal
            },
            savings,
            savingsPercentage
        },
        yearly: {
            dallE: yearlyDallE,
            imagen: yearlyImagen,
            savings: yearlySavings
        }
    };
}

// Format currency
function formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
}

// Display results
function displayResults(params, results) {
    const { monthly, yearly } = results;

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              💰 COST CALCULATION RESULTS                      ║
╚═══════════════════════════════════════════════════════════════╝

📊 INPUT PARAMETERS:
   Teachers:                 ${params.teachers}
   Images per teacher:       ${params.imagesPerTeacher}/month
   Cache hit rate:           ${(params.cacheRate * 100).toFixed(0)}%

📈 MONTHLY METRICS:
   Total images requested:   ${monthly.totalImages}
   Cache hits (saved):       ${monthly.cacheHits} (${formatCurrency(monthly.cacheHits * 0.03)} saved!)
   New generations needed:   ${monthly.newGenerations}

💵 MONTHLY COSTS - DALL-E 3:
   Image generation cost:    ${formatCurrency(monthly.dallE.imageCost)}
   ─────────────────────────────────────────────────────────────
   TOTAL:                    ${formatCurrency(monthly.dallE.total)}

💵 MONTHLY COSTS - IMAGEN 3:
   Image generation cost:    ${formatCurrency(monthly.imagen.imageCost)}
   GCP overhead (Vertex AI): ${formatCurrency(monthly.imagen.gcpOverhead)}
   ─────────────────────────────────────────────────────────────
   TOTAL:                    ${formatCurrency(monthly.imagen.total)}

💰 SAVINGS WITH IMAGEN 3:
   Monthly savings:          ${formatCurrency(monthly.savings)} (${monthly.savingsPercentage.toFixed(1)}%)
   Yearly savings:           ${formatCurrency(yearly.savings)}

📅 YEARLY PROJECTION:
   DALL-E 3 total:           ${formatCurrency(yearly.dallE)}
   Imagen 3 total:           ${formatCurrency(yearly.imagen)}
   ─────────────────────────────────────────────────────────────
   You save:                 ${formatCurrency(yearly.savings)}/year 🎉

🎯 RECOMMENDATION:
${getRecommendation(params.teachers, monthly.savings, yearly.savings)}

═══════════════════════════════════════════════════════════════
    `);
}

// Get recommendation based on results
function getRecommendation(teachers, monthlySavings, yearlySavings) {
    if (teachers < 10 && yearlySavings < 100) {
        return `   • Small usage - DALL-E 3 is fine (simpler setup)
   • Imagen 3 would save ${formatCurrency(yearlySavings)}/year
   • Consider Imagen when you scale up to 10+ teachers`;
    } else if (teachers < 50 && yearlySavings < 500) {
        return `   • Medium usage - Consider Imagen 3
   • ROI: ${formatCurrency(yearlySavings)}/year
   • Payback period: ~2-3 months after setup
   • Setup time: 2-3 hours (one-time)`;
    } else if (teachers < 100 && yearlySavings < 1000) {
        return `   • Large usage - Imagen 3 RECOMMENDED!
   • ROI: ${formatCurrency(yearlySavings)}/year
   • Payback period: ~1 month
   • Setup time: 2-3 hours (one-time)
   • This is a no-brainer investment!`;
    } else {
        return `   • Massive usage - Imagen 3 is MANDATORY!
   • ROI: ${formatCurrency(yearlySavings)}/year
   • Payback period: IMMEDIATE
   • Setup time: 2-3 hours (one-time)
   • NOT using Imagen = throwing money away!`;
    }
}

// Break-even analysis
function displayBreakEven(params, results) {
    const setupCost = 150; // Estimated setup cost (3 hours @ $50/hour)
    const monthsToBreakEven = setupCost / results.monthly.savings;

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              📊 BREAK-EVEN ANALYSIS                           ║
╚═══════════════════════════════════════════════════════════════╝

🔧 SETUP COSTS (one-time):
   Developer time:           3 hours @ $50/hour = $150
   Cloud setup:              $0 (free tier)
   Testing:                  Included in development time
   ─────────────────────────────────────────────────────────────
   TOTAL SETUP:              $150

📈 BREAK-EVEN TIMELINE:
   Monthly savings:          ${formatCurrency(results.monthly.savings)}
   Months to break even:     ${monthsToBreakEven.toFixed(1)} months

💡 INSIGHTS:
${getBreakEvenInsight(monthsToBreakEven, results.yearly.savings)}

═══════════════════════════════════════════════════════════════
    `);
}

function getBreakEvenInsight(months, yearlySavings) {
    if (months <= 1) {
        return `   ⚡ IMMEDIATE ROI - Break even in less than a month!
   🚀 Total savings after 1 year: ${formatCurrency(yearlySavings - 150)}
   ⭐ Status: THIS IS A NO-BRAINER!`;
    } else if (months <= 3) {
        return `   ✅ Fast ROI - Break even in ${months.toFixed(1)} months
   📈 Total savings after 1 year: ${formatCurrency(yearlySavings - 150)}
   ⭐ Status: HIGHLY RECOMMENDED`;
    } else if (months <= 6) {
        return `   👍 Good ROI - Break even in ${months.toFixed(1)} months
   💰 Total savings after 1 year: ${formatCurrency(yearlySavings - 150)}
   ⭐ Status: Recommended if you plan to scale`;
    } else if (months <= 12) {
        return `   🤔 Moderate ROI - Break even in ${months.toFixed(1)} months
   💵 Total savings after 1 year: ${formatCurrency(yearlySavings - 150)}
   ⭐ Status: Consider if usage will increase`;
    } else {
        return `   ⏳ Slow ROI - Break even in ${months.toFixed(1)} months
   ⚠️  Total savings after 1 year: ${formatCurrency(yearlySavings - 150)}
   ⭐ Status: Stick with DALL-E for now, revisit when usage grows`;
    }
}

// Comparison table
function displayComparisonTable() {
    const scenarios = [
        { name: 'Small (5T)', teachers: 5, images: 20, cache: 0.25 },
        { name: 'Medium (20T)', teachers: 20, images: 25, cache: 0.35 },
        { name: 'Large (50T)', teachers: 50, images: 30, cache: 0.40 },
        { name: 'Network (200T)', teachers: 200, images: 35, cache: 0.45 }
    ];

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              📊 QUICK COMPARISON TABLE                        ║
╚═══════════════════════════════════════════════════════════════╝
`);

    console.log('┌─────────────┬──────────┬──────────┬──────────┬─────────────┐');
    console.log('│ Scenario    │ DALL-E 3 │ Imagen 3 │ Savings  │ Yearly      │');
    console.log('├─────────────┼──────────┼──────────┼──────────┼─────────────┤');

    scenarios.forEach(scenario => {
        const results = calculateCosts(scenario.teachers, scenario.images, scenario.cache);
        const nameCol = scenario.name.padEnd(11);
        const dallECol = formatCurrency(results.monthly.dallE.total).padStart(8);
        const imagenCol = formatCurrency(results.monthly.imagen.total).padStart(8);
        const savingsCol = formatCurrency(results.monthly.savings).padStart(8);
        const yearlyCol = formatCurrency(results.yearly.savings).padStart(11);

        console.log(`│ ${nameCol} │ ${dallECol} │ ${imagenCol} │ ${savingsCol} │ ${yearlyCol} │`);
    });

    console.log('└─────────────┴──────────┴──────────┴──────────┴─────────────┘');
    console.log('');
}

// Main function
function main() {
    const params = parseArgs();

    if (params.help) {
        showHelp();
        return;
    }

    // Validate inputs
    if (params.teachers <= 0 || params.imagesPerTeacher <= 0) {
        console.error('❌ Error: Teachers and images per teacher must be positive numbers');
        process.exit(1);
    }

    if (params.cacheRate < 0 || params.cacheRate > 1) {
        console.error('❌ Error: Cache rate must be between 0.0 and 1.0');
        process.exit(1);
    }

    // Calculate and display
    const results = calculateCosts(params.teachers, params.imagesPerTeacher, params.cacheRate);
    displayResults(params, results);
    displayBreakEven(params, results);
    displayComparisonTable();

    console.log(`
💡 TIP: Run with different parameters to see various scenarios:
   node scripts/cost-calculator.js -t 50 -i 30 -c 0.40

📖 Full documentation: See IMAGEN_3_COST_ANALYSIS.md
    `);
}

// Run
main();
