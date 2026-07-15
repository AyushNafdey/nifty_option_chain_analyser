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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://fastapi-deployment-ashy.vercel.app').replace(/\/$/, '')
const OPTION_CHAIN_URL = `${API_BASE_URL}/option-chain`

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

function App() {
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("optionChainHistory")
    return saved ? JSON.parse(saved) : []
  })
  const [status, setStatus] = useState('Waiting for market data...')
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [nextOpenLabel, setNextOpenLabel] = useState(() => formatNextOpenLabel(getNextMarketOpenTime()))
  const lastSessionDateRef = useRef(null)
  const [expiry, setExpiry] = useState("")

  useEffect(() => {
    let isMounted = true

    const updateSessionState = () => {
      const now = new Date()
      const marketOpen = isMarketOpen(now)
      const sessionDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const nextOpen = getNextMarketOpenTime(now)

      setIsSessionActive(marketOpen)
      setNextOpenLabel(formatNextOpenLabel(nextOpen))

      if (!isMounted) return

      if (marketOpen) {
        if (lastSessionDateRef.current !== sessionDateKey) {
          setHistory([])
          localStorage.removeItem("optionChainHistory")
          lastSessionDateRef.current = sessionDateKey
        }
        setStatus('Market is open. Collecting values every 15 minutes')
      } else if (isWeekend(now)) {
        setStatus(`Market is closed for the weekend. Next market open: ${formatNextOpenLabel(nextOpen)}`)
      } else {
        setStatus('Market session has ended. Data collection stopped. Previous rows are preserved until the next session opens.')
      }
    }

    const loadData = async () => {
      const now = new Date()

      if (!isMarketOpen(now)) {
        updateSessionState()
        return
      }

      try {
        const response = await fetch(OPTION_CHAIN_URL)
        const result = await response.json()

        if (!isMounted) return

        const data = result?.data ?? {}
        setExpiry(data.selectedExpiry ?? "")
        const snapshot = {
          time: formatTime(now),
          ceOi: data['Total CE OI'] ?? 0,
          peOi: data['Total PE OI'] ?? 0,
          ceChange: data['CE OI Change'] ?? 0,
          peChange: data['PE OI Change'] ?? 0,
        }

        setHistory((prev) => {
          const updated = [...prev, snapshot]
          localStorage.setItem("optionChainHistory", JSON.stringify(updated))
          return updated
        })
        setStatus('Collecting values continuously every 15 minutes')
      } catch (error) {
        if (!isMounted) return
        setStatus('Unable to fetch values from FastAPI. Check that the backend is running.')
      }
    }

    updateSessionState()
    loadData()

    const timer = setInterval(() => {
      const now = new Date()
      const marketOpen = isMarketOpen(now)
      const sessionDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      setIsSessionActive(marketOpen)
      setNextOpenLabel(formatNextOpenLabel(getNextMarketOpenTime(now)))

      if (marketOpen) {
        if (lastSessionDateRef.current !== sessionDateKey) {
          setHistory([])
          localStorage.removeItem("optionChainHistory")
          lastSessionDateRef.current = sessionDateKey
        }
        loadData()
      } else if (isWeekend(now)) {
        setStatus(`Market is closed for the weekend. Next market open: ${formatNextOpenLabel(getNextMarketOpenTime(now))}`)
      } else {
        setStatus('Market session has ended. Data collection stopped. Previous rows are preserved until the next session opens.')
      }
    }, 900000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

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
                    <tr key={`${row.time}-${index}`} className="transition hover:bg-slate-800/70">
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
