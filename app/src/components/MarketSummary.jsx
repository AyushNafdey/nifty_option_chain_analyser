import ExportActions from './ExportActions'

function SummaryMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function MarketSummary({ summary, expiry, isSessionActive, nextOpenLabel, formatNumber, hasHistory, onExport }) {
  return (
    <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">NIFTY Option Chain Analysis</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
            This table records live values from the market session window from 09:17 AM to 03:32 PM on weekdays only.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SummaryMetric label="Latest CE OI" value={formatNumber(summary.latestCeOi)} />
          <SummaryMetric label="Latest PE OI" value={formatNumber(summary.latestPeOi)} />
          <SummaryMetric label="Expiry" value={expiry || '-'} />
          {!isSessionActive && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Next Market Open</p>
              <p className="text-sm font-semibold text-amber-100">{nextOpenLabel}</p>
            </div>
          )}
          <ExportActions hasHistory={hasHistory} onExport={onExport} />
        </div>
      </div>
    </header>
  )
}

export default MarketSummary