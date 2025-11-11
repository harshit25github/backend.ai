/**
 * Comparison Script - Before vs After Optimization
 *
 * Purpose: Compare baseline results with optimized results
 *
 * Usage:
 * node tests/compare-results.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASELINE_DIR = path.join(__dirname, '../baseline-results');
const OPTIMIZED_DIR = path.join(__dirname, '../optimized-results');
const COMPARISON_OUTPUT = path.join(__dirname, '../comparison-report.md');

const SCENARIOS = [
  'trip_planning',
  'flight_search',
  'modification',
  'hotel_search',
  'quick_question',
  'vague_destination'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadResults(dir, scenario) {
  const filePath = path.join(dir, `${scenario}.json`);
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Could not load ${filePath}:`, error.message);
    return null;
  }
}

function calculateImprovement(baseline, optimized) {
  if (!baseline || !optimized) return null;
  const diff = baseline - optimized;
  const percentage = ((diff / baseline) * 100).toFixed(1);
  return {
    absolute: diff.toFixed(0),
    percentage: percentage,
    improved: diff > 0
  };
}

function formatMetric(value) {
  return value ? value.toFixed(0) : 'N/A';
}

function generateComparisonTable(scenario, baseline, optimized) {
  if (!baseline || !optimized) {
    return `### ${scenario}\n\n**No data available for comparison**\n\n`;
  }

  const improvements = {
    total_avg: calculateImprovement(
      baseline.metrics.total_scenario_duration?.avg,
      optimized.metrics.total_scenario_duration?.avg
    ),
    total_p95: calculateImprovement(
      baseline.metrics.total_scenario_duration?.p95,
      optimized.metrics.total_scenario_duration?.p95
    ),
    step1: calculateImprovement(
      baseline.metrics.step1_duration?.avg,
      optimized.metrics.step1_duration?.avg
    ),
    step2: calculateImprovement(
      baseline.metrics.step2_duration?.avg,
      optimized.metrics.step2_duration?.avg
    ),
    step3: calculateImprovement(
      baseline.metrics.step3_duration?.avg,
      optimized.metrics.step3_duration?.avg
    )
  };

  let table = `### ${scenario.toUpperCase().replace(/_/g, ' ')}\n\n`;

  table += `| Metric | Baseline | Optimized | Improvement |\n`;
  table += `|--------|----------|-----------|-------------|\n`;

  // Total duration
  if (improvements.total_avg) {
    table += `| **Total Duration (avg)** | ${formatMetric(baseline.metrics.total_scenario_duration.avg)}ms | ${formatMetric(optimized.metrics.total_scenario_duration.avg)}ms | ${improvements.total_avg.improved ? '✅' : '❌'} ${improvements.total_avg.percentage}% (${improvements.total_avg.absolute}ms) |\n`;
  }

  if (improvements.total_p95) {
    table += `| **Total Duration (p95)** | ${formatMetric(baseline.metrics.total_scenario_duration.p95)}ms | ${formatMetric(optimized.metrics.total_scenario_duration.p95)}ms | ${improvements.total_p95.improved ? '✅' : '❌'} ${improvements.total_p95.percentage}% (${improvements.total_p95.absolute}ms) |\n`;
  }

  // Step durations
  if (improvements.step1) {
    table += `| Step 1 Duration | ${formatMetric(baseline.metrics.step1_duration.avg)}ms | ${formatMetric(optimized.metrics.step1_duration.avg)}ms | ${improvements.step1.improved ? '✅' : '❌'} ${improvements.step1.percentage}% |\n`;
  }

  if (improvements.step2) {
    table += `| Step 2 Duration | ${formatMetric(baseline.metrics.step2_duration.avg)}ms | ${formatMetric(optimized.metrics.step2_duration.avg)}ms | ${improvements.step2.improved ? '✅' : '❌'} ${improvements.step2.percentage}% |\n`;
  }

  if (improvements.step3) {
    table += `| Step 3 Duration | ${formatMetric(baseline.metrics.step3_duration.avg)}ms | ${formatMetric(optimized.metrics.step3_duration.avg)}ms | ${improvements.step3.improved ? '✅' : '❌'} ${improvements.step3.percentage}% |\n`;
  }

  // Response quality
  if (baseline.metrics.response_length_chars && optimized.metrics.response_length_chars) {
    const responseChange = calculateImprovement(
      baseline.metrics.response_length_chars.avg,
      optimized.metrics.response_length_chars.avg
    );
    table += `| Response Length | ${formatMetric(baseline.metrics.response_length_chars.avg)} chars | ${formatMetric(optimized.metrics.response_length_chars.avg)} chars | ${Math.abs(parseFloat(responseChange.percentage)) < 10 ? '✅' : '⚠️'} ${responseChange.percentage}% |\n`;
  }

  // Business metrics
  if (baseline.metrics.itinerary_days_generated && optimized.metrics.itinerary_days_generated) {
    table += `| Itinerary Days Generated | ${baseline.metrics.itinerary_days_generated.avg.toFixed(1)} | ${optimized.metrics.itinerary_days_generated.avg.toFixed(1)} | ${baseline.metrics.itinerary_days_generated.avg === optimized.metrics.itinerary_days_generated.avg ? '✅' : '⚠️'} Same |\n`;
  }

  table += `\n`;

  return table;
}

function generateSummaryReport(comparisons) {
  let report = `# Optimization Results Comparison\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;

  // Overall summary
  report += `## 📊 Overall Summary\n\n`;

  let totalScenarios = 0;
  let improvedScenarios = 0;
  let totalImprovementPct = 0;

  comparisons.forEach(comp => {
    if (comp.baseline && comp.optimized) {
      totalScenarios++;
      const improvement = calculateImprovement(
        comp.baseline.metrics.total_scenario_duration?.avg,
        comp.optimized.metrics.total_scenario_duration?.avg
      );
      if (improvement && improvement.improved) {
        improvedScenarios++;
        totalImprovementPct += parseFloat(improvement.percentage);
      }
    }
  });

  const avgImprovement = totalScenarios > 0 ? (totalImprovementPct / totalScenarios).toFixed(1) : 0;

  report += `- **Scenarios Tested:** ${totalScenarios}\n`;
  report += `- **Scenarios Improved:** ${improvedScenarios} (${((improvedScenarios / totalScenarios) * 100).toFixed(0)}%)\n`;
  report += `- **Average Improvement:** ${avgImprovement}%\n\n`;

  // Detailed comparisons
  report += `## 📈 Detailed Comparisons\n\n`;

  comparisons.forEach(comp => {
    report += generateComparisonTable(comp.scenario, comp.baseline, comp.optimized);
  });

  // Recommendations
  report += `---\n\n`;
  report += `## 💡 Recommendations\n\n`;
  report += `Based on the comparison results:\n\n`;

  if (avgImprovement > 50) {
    report += `✅ **Excellent!** Average improvement of ${avgImprovement}% achieved. The optimizations are highly effective.\n\n`;
  } else if (avgImprovement > 30) {
    report += `✅ **Good!** Average improvement of ${avgImprovement}% achieved. Consider further optimizations.\n\n`;
  } else if (avgImprovement > 10) {
    report += `⚠️ **Moderate** improvement of ${avgImprovement}%. Review which optimizations had the most impact.\n\n`;
  } else {
    report += `❌ **Limited** improvement of ${avgImprovement}%. The optimizations may need revision.\n\n`;
  }

  // Response quality check
  report += `### Response Quality Check\n\n`;
  report += `Ensure that response quality (length, itinerary days, etc.) remains consistent:\n`;
  report += `- Response length should not decrease significantly (indicates content loss)\n`;
  report += `- Itinerary days should match exactly\n`;
  report += `- Flight results count should be similar or better\n\n`;

  return report;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('='.repeat(80));
  console.log('Optimization Comparison Tool');
  console.log('='.repeat(80));

  // Create directories if they don't exist
  [BASELINE_DIR, OPTIMIZED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // Load all results
  const comparisons = SCENARIOS.map(scenario => ({
    scenario,
    baseline: loadResults(BASELINE_DIR, scenario),
    optimized: loadResults(OPTIMIZED_DIR, scenario)
  }));

  // Check if we have data
  const hasBaseline = comparisons.some(c => c.baseline !== null);
  const hasOptimized = comparisons.some(c => c.optimized !== null);

  if (!hasBaseline) {
    console.warn('\n⚠️  No baseline results found!');
    console.log('Run baseline tests first:');
    SCENARIOS.forEach(scenario => {
      console.log(`  k6 run tests/k6-baseline-scenarios.js -e SCENARIO=${scenario}`);
    });
    console.log('');
  }

  if (!hasOptimized) {
    console.warn('\n⚠️  No optimized results found!');
    console.log('After implementing optimizations, run:');
    SCENARIOS.forEach(scenario => {
      console.log(`  k6 run tests/k6-baseline-scenarios.js -e SCENARIO=${scenario}`);
      console.log(`  (Results will be saved to optimized-results/${scenario}.json)`);
    });
    console.log('');
  }

  if (hasBaseline && hasOptimized) {
    // Generate comparison report
    const report = generateSummaryReport(comparisons);

    // Save report
    fs.writeFileSync(COMPARISON_OUTPUT, report, 'utf8');

    console.log('\n✅ Comparison report generated!');
    console.log(`   Location: ${COMPARISON_OUTPUT}`);
    console.log('');

    // Print summary to console
    comparisons.forEach(comp => {
      if (comp.baseline && comp.optimized) {
        const improvement = calculateImprovement(
          comp.baseline.metrics.total_scenario_duration?.avg,
          comp.optimized.metrics.total_scenario_duration?.avg
        );
        if (improvement) {
          console.log(`${comp.scenario.padEnd(20)} | ${improvement.improved ? '✅' : '❌'} ${improvement.percentage}% improvement (${improvement.absolute}ms saved)`);
        }
      }
    });
  }

  console.log('\n' + '='.repeat(80));
}

// Run
main();
