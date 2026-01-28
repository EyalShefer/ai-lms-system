#!/usr/bin/env npx ts-node

/**
 * AI Peer Review Tool
 *
 * Run code reviews using different AI models.
 *
 * Usage:
 *   npx ts-node scripts/peer-review.ts [options]
 *
 * Examples:
 *   npx ts-node scripts/peer-review.ts --file src/components/UnitEditor.tsx
 *   npx ts-node scripts/peer-review.ts --file src/config/adaptiveFeatureFlags.ts --model gemini
 *   npx ts-node scripts/peer-review.ts --files "src/services/*.ts" --model openai
 *   npx ts-node scripts/peer-review.ts --dir src/components --model claude
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// Configuration
// ============================================================================

interface ModelConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'azure';
  model: string;
  apiKeyEnv: string;
  endpoint?: string;
  maxTokens: number;
}

const MODELS: Record<string, ModelConfig> = {
  'gpt4': {
    name: 'GPT-4 Turbo',
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokens: 4096,
  },
  'gpt4o': {
    name: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokens: 4096,
  },
  'claude': {
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokens: 4096,
  },
  'claude-opus': {
    name: 'Claude Opus 4',
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokens: 4096,
  },
  'gemini': {
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    model: 'gemini-2.0-flash',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    maxTokens: 8192,
  },
  'gemini-pro': {
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    model: 'gemini-1.5-pro',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    maxTokens: 8192,
  },
};

// ============================================================================
// Review Prompt
// ============================================================================

const REVIEW_PROMPT = `You are a senior software engineer conducting a thorough code review.

Analyze the provided code and identify:

1. **Bugs & Logic Errors** - Actual bugs, race conditions, null pointer issues, off-by-one errors
2. **Security Vulnerabilities** - XSS, injection, auth issues, data exposure
3. **Performance Issues** - Memory leaks, inefficient algorithms, unnecessary re-renders
4. **Type Safety Issues** - Missing types, incorrect types, any usage
5. **Error Handling** - Missing try/catch, unhandled promise rejections
6. **Code Quality** - Code smells, dead code, inconsistent patterns
7. **Best Practices** - React/TypeScript/Firebase best practices violations

For each finding, provide:
- **Location**: File and line number(s)
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Category**: One of the categories above
- **Description**: Clear explanation of the issue
- **Suggestion**: How to fix it
- **Code Example**: Before/after if applicable

Format your response as JSON:
{
  "summary": "Brief overall assessment",
  "findings": [
    {
      "id": 1,
      "location": "file.ts:42-45",
      "severity": "HIGH",
      "category": "Security",
      "title": "Short title",
      "description": "Detailed explanation",
      "suggestion": "How to fix",
      "codeExample": {
        "before": "problematic code",
        "after": "fixed code"
      }
    }
  ],
  "positives": ["Good things about the code"],
  "overallScore": 7.5
}

Be thorough but avoid false positives. Only report genuine issues.
If you're unsure about something, note your uncertainty.

CODE TO REVIEW:
`;

// ============================================================================
// API Clients
// ============================================================================

async function callOpenAI(config: ModelConfig, prompt: string): Promise<string> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing ${config.apiKeyEnv} environment variable`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(config: ModelConfig, prompt: string): Promise<string> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing ${config.apiKeyEnv} environment variable`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGoogle(config: ModelConfig, prompt: string): Promise<string> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing ${config.apiKeyEnv} environment variable`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: 0.3,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google AI API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callModel(modelKey: string, prompt: string): Promise<string> {
  const config = MODELS[modelKey];
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(MODELS).join(', ')}`);
  }

  console.log(`\n🤖 Calling ${config.name}...`);

  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, prompt);
    case 'anthropic':
      return callAnthropic(config, prompt);
    case 'google':
      return callGoogle(config, prompt);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// ============================================================================
// File Handling
// ============================================================================

function readFile(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, 'utf-8');
}

async function getFiles(pattern: string): Promise<string[]> {
  return glob(pattern, { ignore: ['node_modules/**', 'dist/**', 'build/**'] });
}

function formatCodeForReview(files: Array<{ path: string; content: string }>): string {
  return files.map(f => `
=== FILE: ${f.path} ===
\`\`\`typescript
${f.content}
\`\`\`
`).join('\n');
}

// ============================================================================
// Output Handling
// ============================================================================

interface ReviewResult {
  model: string;
  modelName: string;
  timestamp: string;
  files: string[];
  response: string;
  parsed?: ReviewFindings;
}

interface ReviewFindings {
  summary: string;
  findings: Array<{
    id: number;
    location: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    suggestion: string;
    codeExample?: { before: string; after: string };
  }>;
  positives: string[];
  overallScore: number;
}

function parseReviewResponse(response: string): ReviewFindings | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn('Could not parse response as JSON');
  }
  return null;
}

function formatFindingsForConsole(result: ReviewResult): string {
  const lines: string[] = [];

  lines.push('\n' + '='.repeat(80));
  lines.push(`📋 PEER REVIEW RESULTS - ${result.modelName}`);
  lines.push('='.repeat(80));
  lines.push(`📅 ${result.timestamp}`);
  lines.push(`📁 Files reviewed: ${result.files.join(', ')}`);
  lines.push('');

  if (result.parsed) {
    const p = result.parsed;

    lines.push(`📊 Overall Score: ${p.overallScore}/10`);
    lines.push(`📝 Summary: ${p.summary}`);
    lines.push('');

    if (p.findings.length === 0) {
      lines.push('✅ No issues found!');
    } else {
      lines.push(`🔍 Found ${p.findings.length} issue(s):`);
      lines.push('');

      // Group by severity
      const bySeverity: Record<string, typeof p.findings> = {};
      for (const f of p.findings) {
        if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
        bySeverity[f.severity].push(f);
      }

      const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const severityEmoji: Record<string, string> = {
        'CRITICAL': '🔴',
        'HIGH': '🟠',
        'MEDIUM': '🟡',
        'LOW': '🟢',
      };

      for (const severity of severityOrder) {
        const findings = bySeverity[severity];
        if (!findings) continue;

        lines.push(`${severityEmoji[severity]} ${severity} (${findings.length}):`);
        for (const f of findings) {
          lines.push(`  [${f.id}] ${f.title}`);
          lines.push(`      📍 ${f.location} | 🏷️ ${f.category}`);
          lines.push(`      ${f.description}`);
          if (f.suggestion) {
            lines.push(`      💡 ${f.suggestion}`);
          }
          lines.push('');
        }
      }
    }

    if (p.positives?.length > 0) {
      lines.push('✨ Positives:');
      for (const positive of p.positives) {
        lines.push(`  • ${positive}`);
      }
    }
  } else {
    lines.push('Raw Response:');
    lines.push(result.response);
  }

  lines.push('\n' + '='.repeat(80));
  return lines.join('\n');
}

function saveResults(result: ReviewResult, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `review-${result.model}-${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

// ============================================================================
// Main
// ============================================================================

interface CliArgs {
  file?: string;
  files?: string;
  dir?: string;
  model: string;
  models?: string;
  output?: string;
  save?: boolean;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { model: 'gemini' };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const next = process.argv[i + 1];

    switch (arg) {
      case '--file':
      case '-f':
        args.file = next;
        i++;
        break;
      case '--files':
        args.files = next;
        i++;
        break;
      case '--dir':
      case '-d':
        args.dir = next;
        i++;
        break;
      case '--model':
      case '-m':
        args.model = next;
        i++;
        break;
      case '--models':
        args.models = next;
        i++;
        break;
      case '--output':
      case '-o':
        args.output = next;
        i++;
        break;
      case '--save':
      case '-s':
        args.save = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
AI Peer Review Tool
===================

Usage:
  npx ts-node scripts/peer-review.ts [options]

Options:
  -f, --file <path>      Review a single file
  --files <pattern>      Review files matching glob pattern
  -d, --dir <path>       Review all files in directory
  -m, --model <name>     Model to use (default: gemini)
  --models <list>        Comma-separated list of models to compare
  -o, --output <dir>     Output directory for results (default: ./reviews)
  -s, --save             Save results to file
  -h, --help             Show this help

Available Models:
${Object.entries(MODELS).map(([key, config]) =>
  `  ${key.padEnd(12)} - ${config.name} (${config.provider})`
).join('\n')}

Environment Variables:
  OPENAI_API_KEY      - For GPT models
  ANTHROPIC_API_KEY   - For Claude models
  GOOGLE_AI_API_KEY   - For Gemini models

Examples:
  # Review a single file with Gemini
  npx ts-node scripts/peer-review.ts --file src/components/UnitEditor.tsx

  # Review with multiple models for comparison
  npx ts-node scripts/peer-review.ts --file src/config/adaptiveFeatureFlags.ts --models "gemini,claude,gpt4o"

  # Review all TypeScript files in a directory
  npx ts-node scripts/peer-review.ts --dir src/services --model claude

  # Review with glob pattern and save results
  npx ts-node scripts/peer-review.ts --files "src/**/*.tsx" --model gpt4 --save
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  // Collect files to review
  const filesToReview: Array<{ path: string; content: string }> = [];

  if (args.file) {
    filesToReview.push({
      path: args.file,
      content: readFile(args.file),
    });
  } else if (args.files) {
    const files = await getFiles(args.files);
    for (const file of files) {
      filesToReview.push({
        path: file,
        content: readFile(file),
      });
    }
  } else if (args.dir) {
    const pattern = path.join(args.dir, '**/*.{ts,tsx,js,jsx}');
    const files = await getFiles(pattern);
    for (const file of files) {
      filesToReview.push({
        path: file,
        content: readFile(file),
      });
    }
  } else {
    console.error('Error: Please specify --file, --files, or --dir');
    printHelp();
    process.exit(1);
  }

  if (filesToReview.length === 0) {
    console.error('Error: No files found to review');
    process.exit(1);
  }

  console.log(`\n📁 Found ${filesToReview.length} file(s) to review`);
  filesToReview.forEach(f => console.log(`   • ${f.path}`));

  // Prepare the prompt
  const codeContent = formatCodeForReview(filesToReview);
  const fullPrompt = REVIEW_PROMPT + codeContent;

  // Get models to use
  const modelKeys = args.models
    ? args.models.split(',').map(m => m.trim())
    : [args.model];

  // Run reviews
  const results: ReviewResult[] = [];

  for (const modelKey of modelKeys) {
    try {
      const config = MODELS[modelKey];
      if (!config) {
        console.error(`Unknown model: ${modelKey}`);
        continue;
      }

      const response = await callModel(modelKey, fullPrompt);

      const result: ReviewResult = {
        model: modelKey,
        modelName: config.name,
        timestamp: new Date().toISOString(),
        files: filesToReview.map(f => f.path),
        response,
        parsed: parseReviewResponse(response) || undefined,
      };

      results.push(result);
      console.log(formatFindingsForConsole(result));

      if (args.save) {
        const outputDir = args.output || './reviews';
        const savedPath = saveResults(result, outputDir);
        console.log(`\n💾 Saved to: ${savedPath}`);
      }

    } catch (error) {
      console.error(`\n❌ Error with ${modelKey}:`, error);
    }
  }

  // Summary if multiple models
  if (results.length > 1) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPARISON SUMMARY');
    console.log('='.repeat(80));

    for (const result of results) {
      const findingsCount = result.parsed?.findings.length ?? 'N/A';
      const score = result.parsed?.overallScore ?? 'N/A';
      console.log(`  ${result.modelName}: ${findingsCount} findings, Score: ${score}/10`);
    }
  }
}

main().catch(console.error);
