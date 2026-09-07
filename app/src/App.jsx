import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import AIAnalysis from './components/AIAnalysis'
import MarketSummary from './components/MarketSummary'
import MarketTimeline from './components/MarketTimeline'

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
  const [isAIAnalysisOpen, setIsAIAnalysisOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

    // Load the baseline first so the history response cannot overwrite the latest row.
    updateSessionState()
    loadHistory().then(() => {
      if (isMounted) fetchLatestAndAppend()
    })

    // poll at a configurable cadence for the latest snapshot; backend scheduler uses the same cadence
    pollTimer = setInterval(() => {
      updateSessionState()
      fetchLatestAndAppend()
    }, POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      if (pollTimer) clearInterval(pollTimer)
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

  const openAIAnalysis = () => {
    setIsAIAnalysisOpen(true)
    setIsMobileMenuOpen(false)
  }

  const latestRow = history.length ? history[history.length - 1] : null

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openAIAnalysis}
            className="hidden rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 md:inline-flex"
          >
            Generate AI Analysis
          </button>

          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-actions-menu"
              aria-label="Open actions menu"
              className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800"
            >
              <span className="h-0.5 w-5 bg-current" />
              <span className="h-0.5 w-5 bg-current" />
              <span className="h-0.5 w-5 bg-current" />
            </button>
            {isMobileMenuOpen && (
              <div id="mobile-actions-menu" className="absolute right-0 top-14 z-10 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
                <button
                  type="button"
                  onClick={openAIAnalysis}
                  className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-cyan-300 transition hover:bg-slate-800"
                >
                  Generate AI Analysis
                </button>
              </div>
            )}
          </div>
        </div>
        <MarketSummary
          summary={summary}
          expiry={expiry}
          isSessionActive={isSessionActive}
          nextOpenLabel={nextOpenLabel}
          formatNumber={formatIndianNumber}
          hasHistory={history.length > 0}
          onExport={handleExport}
        />
        {isAIAnalysisOpen && (
          <AIAnalysis
            summary={summary}
            latestRow={latestRow}
            expiry={expiry}
            onClose={() => setIsAIAnalysisOpen(false)}
          />
        )}
        <MarketTimeline history={history} status={status} formatNumber={formatIndianNumber} />
      </div>
    </main>
  )
}

export default App