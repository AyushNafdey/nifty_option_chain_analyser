import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isMarketOpen(date = new Date()) {
  if (isWeekend(date)) {
    return false
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes()
  const marketOpenMinutes = 9 * 60 + 17
  const marketCloseMinutes = 15 * 60 + 32
  // const marketOpenMinutes = 0
  // const marketCloseMinutes = 24 * 60

  return currentMinutes >= marketOpenMinutes && currentMinutes < marketCloseMinutes
}

function getNextMarketOpenTime(date = new Date()) {
  const candidate = new Date(date)
  candidate.setHours(9, 17, 0, 0)

  while (candidate.getTime() <= date.getTime() || isWeekend(candidate)) {
    candidate.setDate(candidate.getDate() + 1)
    candidate.setHours(9, 17, 0, 0)
  }

  return candidate
}

function formatNextOpenLabel(date) {
  return date.toLocaleString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    // second: '2-digit',
  })
}

function formatIndianNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value)
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const HISTORY_URL = `${API_BASE_URL}/history`
const LATEST_URL = `${API_BASE_URL}/latest-data`
const POLL_INTERVAL_MINUTES = Number(import.meta.env.VITE_POLL_INTERVAL_MINUTES || '1')
const POLL_INTERVAL_MS = Number.isFinite(POLL_INTERVAL_MINUTES) && POLL_INTERVAL_MINUTES > 0
  ? POLL_INTERVAL_MINUTES * 60000
  : 60000

function App() {
  // history now solely comes from backend; localStorage removed
  const [history, setHistory] = useState([])
  const historyRef = useRef([])
  const [status, setStatus] = useState('Waiting for market data...')
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [nextOpenLabel, setNextOpenLabel] = useState(() => formatNextOpenLabel(getNextMarketOpenTime()))
  const lastSessionDateRef = useRef(null)
  const [expiry, setExpiry] = useState("")

  useEffect(() => {
    let isMounted = true
    let pollTimer = null

    const updateSessionState = () => {
      const now = new Date()
      const marketOpen = isMarketOpen(now)
      const sessionDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const nextOpen = getNextMarketOpenTime(now)

      setIsSessionActive(marketOpen)
      setNextOpenLabel(formatNextOpenLabel(nextOpen))

      if (!isMounted) return

      if (marketOpen) {
        setStatus(`Market is open. Collecting values every ${POLL_INTERVAL_MINUTES} minute${POLL_INTERVAL_MINUTES === 1 ? '' : 's'}`)
      } else if (isWeekend(now)) {
        setStatus(`Market is closed for the weekend. Next market open: ${formatNextOpenLabel(nextOpen)}`)
      } else {
        setStatus('Market session has ended. Data collection stopped. Previous rows are preserved until the next session opens.')
      }

      // track session day change for client-side display; backend /history will be authoritative
      lastSessionDateRef.current = sessionDateKey
    }

    const loadHistory = async () => {
      try {
        const res = await fetch(HISTORY_URL)
        if (!res.ok) {
          throw new Error(`Failed to load history: ${res.status}`)
        }
        const result = await res.json()
        if (!isMounted) return

        historyRef.current = result.map((rec) => {
          const ts = new Date(rec.timestamp)
          return {
            timestamp: rec.timestamp,
            time: formatTime(ts),
            ceOi: rec.data?.total_ce_oi ?? 0,
            peOi: rec.data?.total_pe_oi ?? 0,
            ceChange: rec.data?.ce_oi_change ?? 0,
            peChange: rec.data?.pe_oi_change ?? 0,
          }
        })

        setHistory(historyRef.current)

        // set expiry from latest if available
        const latest = result.length ? result[result.length - 1] : null
        setExpiry((latest && latest.data && latest.data.selected_expiry) || "")
      } catch (error) {
        console.error(error)
        if (!isMounted) return
        setStatus('Unable to fetch history from backend. Check that the backend is running.')
      }
    }

    const fetchLatestAndAppend = async () => {
      try {
        const res = await fetch(LATEST_URL)
        if (!res.ok) {
          // 204 or 404 or server error — ignore silently but log
          console.warn('Latest-data fetch failed', res.status)
          return
        }
        const result = await res.json()
        if (!result) return
        if (!isMounted) return

        const incomingTimestamp = result.timestamp // ISO string
        const last = historyRef.current.length ? historyRef.current[historyRef.current.length - 1].timestamp : null

        if (incomingTimestamp && incomingTimestamp !== last) {
          const ts = new Date(incomingTimestamp)
          const newRow = {
            timestamp: incomingTimestamp,
            time: formatTime(ts),
            ceOi: result.data?.total_ce_oi ?? 0,
            peOi: result.data?.total_pe_oi ?? 0,
            ceChange: result.data?.ce_oi_change ?? 0,
            peChange: result.data?.pe_oi_change ?? 0,
          }

          setHistory((prev) => {
            // Avoid duplicate appends in race conditions: check last again
            const lastLocal = prev.length ? prev[prev.length - 1].timestamp : null
            if (lastLocal === incomingTimestamp) return prev
            const updated = [...prev, newRow]
            historyRef.current = updated
            return updated
          })
        }

        // always update expiry to latest if present
        setExpiry((result.data && result.data.selected_expiry) || "")
      } catch (error) {
        console.error('Error fetching latest data:', error)
      }
    }

    // initial actions
    updateSessionState()
    loadHistory()

    // poll at a configurable cadence for the latest snapshot; backend scheduler uses the same cadence
    pollTimer = setInterval(() => {
      updateSessionState()
      fetchLatestAndAppend()
    }, POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      if (pollTimer) clearInterval(pollTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  const summary = useMemo(() => {
    if (!history.length) {
      return { latestCeOi: 0, latestPeOi: 0, totalSamples: 0 }
    }

    const latest = history[history.length - 1]
    return {
      latestCeOi: latest.ceOi,
      latestPeOi: latest.peOi,
      totalSamples: history.length,
    }
  }, [history])

  function getCurrentDate() {
    const today = new Date()

    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    return `${day}-${month}-${year}`
  }

  function exportToCsv(rows) {
    const header = ['Time', 'Total CE OI', 'Total PE OI', 'CE OI Change', 'PE OI Change']
    const date = getCurrentDate()
    const csvRows = [
      header.join(','),
      ...rows.map((row) =>
        [row.time, row.ceOi, row.peOi, row.ceChange, row.peChange]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Option_Chain_Data_${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportToExcel(rows) {
    const date = getCurrentDate()
    const worksheetData = [
      ['Time', 'Total CE OI', 'Total PE OI', 'CE OI Change', 'PE OI Change'],
      ...rows.map((row) => [row.time, row.ceOi, row.peOi, row.ceChange, row.peChange]),
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Option Chain')
    XLSX.writeFile(workbook, `Option_Chain_Data_${date}.xlsx`)
  }

  const handleExport = (format) => {
    if (!history.length) return

    if (format === 'csv') {
      exportToCsv(history)
    } else {
      exportToExcel(history)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">NIFTY Option Chain Analysis</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
                This table records live values from the market session window from 09:17 AM to 03:32 PM on weekdays only.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Latest CE OI</p>
                <p className="text-xl font-semibold">{formatIndianNumber(summary.latestCeOi)}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Latest PE OI</p>
                <p className="text-xl font-semibold">{formatIndianNumber(summary.latestPeOi)}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Expiry</p>
                <p className="text-xl font-semibold">{expiry || "-"}</p>
              </div>
              {!isSessionActive && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Next Market Open</p>
                  <p className="text-sm font-semibold text-amber-100">{nextOpenLabel}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  disabled={!history.length}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('excel')}
                  disabled={!history.length}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        </header>

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
                      <td className="px-6 py-4">{formatIndianNumber(row.ceOi)}</td>
                      <td className="px-6 py-4">{formatIndianNumber(row.peOi)}</td>
                      <td className={`px-6 py-4 ${row.ceChange < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatIndianNumber(row.ceChange)}
                      </td>
                      <td className={`px-6 py-4 ${row.peChange < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatIndianNumber(row.peChange)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App