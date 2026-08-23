function MarketTimeline({ history, status, formatNumber }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Market Session Timeline</h2>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" />
            {status}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-950/70 text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-6 py-3 font-medium">Total CE OI</th>
              <th className="px-6 py-3 font-medium">Total PE OI</th>
              <th className="px-6 py-3 font-medium">CE OI Change</th>
              <th className="px-6 py-3 font-medium">PE OI Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/60">
            {history.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-6 text-center text-slate-400">
                  No values recorded yet. The table will populate as data arrives during the session.
                </td>
              </tr>
            ) : (
              history.map((row, index) => (
                <tr key={`${row.timestamp}-${index}`} className="transition hover:bg-slate-800/70">
                  <td className="px-6 py-4 font-semibold text-white">{row.time}</td>
                  <td className="px-6 py-4">{formatNumber(row.ceOi)}</td>
                  <td className="px-6 py-4">{formatNumber(row.peOi)}</td>
                  <td className={`px-6 py-4 ${row.ceChange < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatNumber(row.ceChange)}
                  </td>
                  <td className={`px-6 py-4 ${row.peChange < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatNumber(row.peChange)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default MarketTimeline