import React, { useState, useEffect } from 'react';
import { Search, BarChart3, AlertCircle, CheckCircle2, Loader2, Plus, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [brand, setBrand] = useState('AcmeCorp');
  const [domain, setDomain] = useState('acmecorp.com');
  const [category, setCategory] = useState('Cloud Security');
  const [competitors, setCompetitors] = useState('CompetitorA, CompetitorB');
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const startAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: '00000000-0000-0000-0000-000000000000', // Mock project ID
          brand,
          domain,
          category,
          competitors: competitors.split(',').map(c => c.trim()),
          brandAliases: [],
        }),
      });
      const data = await res.json();
      setJobId(data.id);
      setPolling(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (polling && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/analysis/${jobId}`);
          const data = await res.json();
          if (data.status === 'completed') {
            setAnalysis(data);
            setPolling(false);
            clearInterval(interval);
          }
        } catch (err) {
          console.error(err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [polling, jobId]);

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#141414] font-sans">
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] rounded-lg flex items-center justify-center">
              <BarChart3 className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">AI Visibility Platform</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono uppercase tracking-widest opacity-50">MVP v1.0</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Configuration */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white rounded-2xl border border-[#141414]/10 p-8 shadow-sm">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5" /> New Analysis
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider opacity-50 mb-1 block">Target Brand</label>
                <input 
                  value={brand} 
                  onChange={e => setBrand(e.target.value)}
                  className="w-full bg-[#F5F5F4] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#141414] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider opacity-50 mb-1 block">Domain</label>
                <input 
                  value={domain} 
                  onChange={e => setDomain(e.target.value)}
                  className="w-full bg-[#F5F5F4] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#141414] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider opacity-50 mb-1 block">Category</label>
                <input 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-[#F5F5F4] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#141414] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider opacity-50 mb-1 block">Competitors (comma separated)</label>
                <textarea 
                  value={competitors} 
                  onChange={e => setCompetitors(e.target.value)}
                  className="w-full bg-[#F5F5F4] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#141414] outline-none transition-all h-24 resize-none"
                />
              </div>
              <button 
                onClick={startAnalysis}
                disabled={loading || polling}
                className="w-full bg-[#141414] text-white rounded-lg py-4 font-semibold flex items-center justify-center gap-2 hover:bg-[#262626] disabled:opacity-50 transition-all"
              >
                {loading || polling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                {polling ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
          </section>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-8">
          {!analysis && !polling && (
            <div className="h-full min-h-[400px] border-2 border-dashed border-[#141414]/10 rounded-2xl flex flex-col items-center justify-center text-center p-12">
              <div className="w-16 h-16 bg-[#141414]/5 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 opacity-20" />
              </div>
              <h3 className="text-xl font-medium opacity-40">No analysis data yet</h3>
              <p className="max-w-xs mx-auto mt-2 opacity-30 text-sm">Configure your brand and competitors to start tracking visibility across LLMs.</p>
            </div>
          )}

          {polling && (
            <div className="h-full min-h-[400px] bg-white rounded-2xl border border-[#141414]/10 p-12 flex flex-col items-center justify-center text-center shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin mb-6" />
              <h3 className="text-2xl font-bold mb-2">Analyzing Visibility...</h3>
              <p className="opacity-50 max-w-md">We are running high-intent prompts across OpenAI and Anthropic models to detect brand mentions and ranking.</p>
              <div className="mt-8 w-full max-w-xs bg-[#F5F5F4] h-2 rounded-full overflow-hidden">
                <div className="bg-[#141414] h-full w-1/2 animate-pulse" />
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-sm">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">Share of Voice</p>
                  <p className="text-4xl font-bold">{analysis.aggregatedMetrics.shareOfVoice.toFixed(1)}%</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-sm">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">Visibility Score</p>
                  <p className="text-4xl font-bold">{analysis.aggregatedMetrics.weightedVisibilityScore.toFixed(1)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-sm">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">Mention Rate</p>
                  <p className="text-4xl font-bold">{analysis.aggregatedMetrics.mentionRate.toFixed(1)}%</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-sm">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">Confidence</p>
                  <p className="text-4xl font-bold">{(analysis.aggregatedMetrics.overallConfidence * 100).toFixed(0)}%</p>
                </div>
              </div>

              {/* Recommendations */}
              <section className="bg-[#141414] text-white rounded-2xl p-8 shadow-xl">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-emerald-400" /> Strategic Recommendations
                </h3>
                <div className="space-y-4">
                  {analysis.recommendations.map((rec: any, i: number) => (
                    <div key={i} className="flex gap-4 items-start bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="w-6 h-6 rounded-full bg-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold">{i+1}</div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">{rec.type} • Impact: {rec.expectedImpact}</p>
                        <p className="text-sm leading-relaxed opacity-90">{rec.reasoning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Detailed Results */}
              <section className="bg-white rounded-2xl border border-[#141414]/10 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-[#141414]/10 flex items-center justify-between">
                  <h3 className="font-semibold">Intent Performance</h3>
                  <span className="text-xs font-mono opacity-40">Multi-Layer Confidence</span>
                </div>
                <div className="divide-y divide-[#141414]/5">
                  {analysis.results.map((res: any, i: number) => (
                    <div key={i} className="p-8 hover:bg-[#F5F5F4]/50 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold bg-[#141414]/5 px-2 py-1 rounded mb-2 inline-block">{res.intent}</span>
                          <p className="text-sm font-medium italic max-w-lg">"{res.promptText}"</p>
                        </div>
                        <div className="flex gap-6">
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold opacity-30">Agreement</p>
                            <p className="text-sm font-bold">{(res.metrics.agreementRate * 100).toFixed(0)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold opacity-30">Jaccard</p>
                            <p className="text-sm font-bold">{(res.metrics.competitorJaccard * 100).toFixed(0)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold opacity-30">Confidence</p>
                            <p className="text-sm font-bold">{(res.metrics.confidence * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {res.runs.map((run: any, j: number) => (
                          <div key={j} className={cn(
                            "w-3 h-3 rounded-full",
                            run.parsed.brandMentioned ? "bg-emerald-500" : "bg-red-400"
                          )} title={`${run.provider}: Rank ${run.parsed.rank || 'N/A'}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
