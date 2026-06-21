import * as fs from 'fs';
import * as path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';

export interface ComparisonResult {
  file: string;
  geminiSmells: string[];
  ollamaSmells: string[];
  ollamaStatus: string;
  ollamaJustification: string;
}

export interface Metric {
  smell: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
}

export async function evaluateResults(config: any) {
  const versionSuffix = config.analyzer.version ? `_v${config.analyzer.version}` : '';
  const inputPath = path.resolve(process.cwd(), config.analyzer.outputDir, `comparison_results${versionSuffix}.json`);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Comparison results not found at ${inputPath}`);
    process.exit(1);
  }

  const data: ComparisonResult[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  
  const smellTypes = new Set<string>();
  
  // Normalize and collect all unique smell types
  const normalizeSmell = (smell: string) => {
    const s = smell.trim();
    if (s === 'Magic Number' || s === 'Hardcoded Literal') {
      return 'Magic Number/Hardcoded Literal';
    }
    return s;
  };

  for (const result of data) {
    if (result.ollamaStatus !== 'success') continue;
    
    result.geminiSmells.forEach(s => smellTypes.add(normalizeSmell(s)));
    result.ollamaSmells.forEach(s => smellTypes.add(normalizeSmell(s)));
  }

  smellTypes.delete('None');
  smellTypes.delete('');

  const metrics: Metric[] = [];
  const validData = data.filter(d => d.ollamaStatus === 'success');
  const totalFiles = validData.length;

  for (const smell of Array.from(smellTypes)) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;

    for (const result of validData) {
      const geminiHas = result.geminiSmells.some(s => normalizeSmell(s) === smell);
      const ollamaHas = result.ollamaSmells.some(s => normalizeSmell(s) === smell);

      if (geminiHas && ollamaHas) tp++;
      else if (!geminiHas && ollamaHas) fp++;
      else if (geminiHas && !ollamaHas) fn++;
      else tn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    metrics.push({
      smell,
      tp,
      fp,
      fn,
      tn,
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1: parseFloat(f1.toFixed(4))
    });
  }

  const outputDir = path.resolve(process.cwd(), config.analyzer.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonOutputPath = path.join(outputDir, `evaluation_metrics${versionSuffix}.json`);
  fs.writeFileSync(jsonOutputPath, JSON.stringify(metrics, null, 2));
  console.log(`JSON metrics saved to ${jsonOutputPath}`);

  generateHtmlReport(metrics, totalFiles, outputDir, versionSuffix);
  await generatePngCharts(metrics, outputDir, versionSuffix);
}

function generateHtmlReport(metrics: Metric[], totalFiles: number, outputDir: string, versionSuffix: string = '') {
  const htmlOutputPath = path.join(outputDir, `report${versionSuffix}.html`);
  
  const labels = metrics.map(m => m.smell);
  const precisionData = metrics.map(m => m.precision);
  const recallData = metrics.map(m => m.recall);
  const f1Data = metrics.map(m => m.f1);

  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Smell Evaluation Report${versionSuffix ? ` (v${versionSuffix.replace('_v', '')})` : ''}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        dark: '#0f172a',
                        card: '#1e293b',
                        primary: '#3b82f6',
                        secondary: '#8b5cf6',
                        accent: '#10b981'
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; }
        .glass-panel {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
        }
    </style>
</head>
<body class="p-8">
    <div class="max-w-7xl mx-auto space-y-8">
        
        <header class="text-center py-10 glass-panel">
            <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-sm mb-4">
                Test Smell Benchmarking${versionSuffix ? ` (v${versionSuffix.replace('_v', '')})` : ''}
            </h1>
            <p class="text-xl text-gray-400">Ollama vs Gemini Baseline</p>
            <div class="mt-6 flex justify-center gap-6 text-sm font-medium">
                <span class="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-full">Evaluated Files: ${totalFiles}</span>
                <span class="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-full">Smell Types: ${metrics.length}</span>
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="glass-panel p-6 shadow-xl">
                <h2 class="text-2xl font-bold mb-6 text-white text-center">Metrics Overview (P/R/F1)</h2>
                <div class="relative h-[400px]">
                    <canvas id="barChart"></canvas>
                </div>
            </div>

            <div class="glass-panel p-6 shadow-xl">
                <h2 class="text-2xl font-bold mb-6 text-white text-center">F1-Score Distribution</h2>
                <div class="relative h-[400px]">
                    <canvas id="radarChart"></canvas>
                </div>
            </div>
        </div>

        <div class="glass-panel p-8 shadow-xl overflow-x-auto">
            <h2 class="text-2xl font-bold mb-6 text-white">Raw Evaluation Metrics</h2>
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-gray-700 text-gray-400">
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm">Smell Type</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right">TP</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right">FP</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right">FN</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right">TN</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right text-blue-400">Precision</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right text-purple-400">Recall</th>
                        <th class="py-4 px-4 font-semibold uppercase tracking-wider text-sm text-right text-emerald-400">F1-Score</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-800">
                    ${metrics.map(m => `
                    <tr class="hover:bg-white/5 transition-colors duration-150">
                        <td class="py-4 px-4 font-medium text-white">${m.smell}</td>
                        <td class="py-4 px-4 text-right text-gray-300">${m.tp}</td>
                        <td class="py-4 px-4 text-right text-gray-300">${m.fp}</td>
                        <td class="py-4 px-4 text-right text-gray-300">${m.fn}</td>
                        <td class="py-4 px-4 text-right text-gray-300">${m.tn}</td>
                        <td class="py-4 px-4 text-right font-semibold text-blue-400">${(m.precision * 100).toFixed(1)}%</td>
                        <td class="py-4 px-4 text-right font-semibold text-purple-400">${(m.recall * 100).toFixed(1)}%</td>
                        <td class="py-4 px-4 text-right font-semibold text-emerald-400">${(m.f1 * 100).toFixed(1)}%</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const labels = ${JSON.stringify(labels)};
        const precision = ${JSON.stringify(precisionData)};
        const recall = ${JSON.stringify(recallData)};
        const f1 = ${JSON.stringify(f1Data)};

        // Custom theme settings
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        const barCtx = document.getElementById('barChart').getContext('2d');
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Precision',
                        data: precision,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'Recall',
                        data: recall,
                        backgroundColor: 'rgba(139, 92, 246, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'F1-Score',
                        data: f1,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 1,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        const radarCtx = document.getElementById('radarChart').getContext('2d');
        new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'F1-Score',
                    data: f1,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#94a3b8', font: { size: 12 } },
                        ticks: { display: false, max: 1, min: 0 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(htmlOutputPath, html);
  console.log(`Interactive HTML Report saved to ${htmlOutputPath}`);
}

async function generatePngCharts(metrics: Metric[], outputDir: string, versionSuffix: string = '') {
  const width = 1200;
  const height = 800;
  const backgroundColour = 'white';
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });

  const labels = metrics.map(m => m.smell);
  const precision = metrics.map(m => m.precision);
  const recall = metrics.map(m => m.recall);
  const f1 = metrics.map(m => m.f1);

  const fontOptions = {
    family: "'Times New Roman', Times, serif",
    size: 16
  };

  const barConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Precision', data: precision, backgroundColor: '#444444', borderColor: '#000000', borderWidth: 1 },
        { label: 'Recall', data: recall, backgroundColor: '#888888', borderColor: '#000000', borderWidth: 1 },
        { label: 'F1-Score', data: f1, backgroundColor: '#cccccc', borderColor: '#000000', borderWidth: 1 }
      ]
    },
    options: {
      plugins: {
        legend: { labels: { font: fontOptions, color: '#000000' } },
        title: { display: true, text: 'Metrics Overview (P/R/F1)', font: { ...fontOptions, size: 24, weight: 'bold' }, color: '#000000' }
      },
      scales: {
        y: { beginAtZero: true, max: 1, ticks: { font: fontOptions, color: '#000000' }, grid: { color: '#e0e0e0' }, title: { display: true, text: 'Score', font: fontOptions, color: '#000000' } },
        x: { ticks: { font: fontOptions, color: '#000000' }, grid: { display: false }, title: { display: true, text: 'Test Smell Type', font: fontOptions, color: '#000000' } }
      }
    }
  };

  const radarConfig: ChartConfiguration = {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'F1-Score',
        data: f1,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderColor: '#000000',
        pointBackgroundColor: '#000000',
        borderWidth: 2,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'F1-Score Distribution', font: { ...fontOptions, size: 24, weight: 'bold' }, color: '#000000' }
      },
      scales: {
        r: {
          angleLines: { color: '#cccccc' },
          grid: { color: '#cccccc' },
          pointLabels: { font: fontOptions, color: '#000000' },
          ticks: { backdropColor: 'transparent', font: fontOptions, color: '#000000', max: 1, min: 0 }
        }
      }
    }
  };

  const barBuffer = await chartJSNodeCanvas.renderToBuffer(barConfig);
  fs.writeFileSync(path.join(outputDir, `metrics_bar_chart${versionSuffix}.png`), barBuffer);
  console.log(`Saved PNG chart to ${path.join(outputDir, `metrics_bar_chart${versionSuffix}.png`)}`);

  const radarBuffer = await chartJSNodeCanvas.renderToBuffer(radarConfig);
  fs.writeFileSync(path.join(outputDir, `metrics_radar_chart${versionSuffix}.png`), radarBuffer);
  console.log(`Saved PNG chart to ${path.join(outputDir, `metrics_radar_chart${versionSuffix}.png`)}`);
}
