function ExportActions({ hasHistory, onExport }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onExport('csv')}
        disabled={!hasHistory}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download CSV
      </button>
      <button
        type="button"
        onClick={() => onExport('excel')}
        disabled={!hasHistory}
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download Excel
      </button>
    </div>
  )
}

export default ExportActions