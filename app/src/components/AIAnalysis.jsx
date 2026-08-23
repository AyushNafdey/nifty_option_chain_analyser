import { useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

function AIAnalysis({ summary, latestRow, expiry, onClose }) {
    const [query, setQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Ask me about the latest CE OI, PE OI, or open-interest changes.' },
    ])

    async function askQuery(event) {
        event.preventDefault()
        const trimmedQuery = query.trim()
        if (!trimmedQuery || isLoading) return

        const latestContext = latestRow
            ? `Latest snapshot: CE OI ${latestRow.ceOi}, PE OI ${latestRow.peOi}, CE OI change ${latestRow.ceChange}, PE OI change ${latestRow.peChange}, timestamp ${latestRow.timestamp}.`
            : 'No latest market snapshot is available.'
        const prompt = `You are analyzing NIFTY option-chain data. Answer the user's question using only the supplied data. Be concise, explain uncertainty, and do not give financial advice.

Expiry: ${expiry || 'Not available'}
Summary: latest CE OI ${summary.latestCeOi}, latest PE OI ${summary.latestPeOi}, total samples ${summary.totalSamples}.
${latestContext}

User question: ${trimmedQuery}`

        setError('')
        setIsLoading(true)
        setMessages((previousMessages) => [...previousMessages, { role: 'user', text: trimmedQuery }])

        try {
            const response = await fetch(`${API_BASE_URL}/ai-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            })
            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(result.detail || 'Unable to get an AI response')
            }

            setMessages((previousMessages) => [
                ...previousMessages,
                { role: 'assistant', text: result.response || 'The AI returned an empty response.' },
            ])
            setQuery('')
        } catch (requestError) {
            setError(requestError.message || 'Unable to connect to the AI service.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-5 shadow-2xl shadow-slate-950/40" aria-labelledby="ai-analysis-title">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Interactive insight</p>
                    <h2 id="ai-analysis-title" className="mt-1 text-xl font-semibold text-white">AI Analysis</h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                >
                    Close
                </button>
            </div>

            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4" aria-live="polite">
                {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8 rounded-lg bg-cyan-500/10 p-3 text-sm text-cyan-100' : 'mr-8 rounded-lg bg-slate-800 p-3 text-sm text-slate-200'}>
                        {message.text}
                    </div>
                ))}
                {isLoading && <div className="mr-8 rounded-lg bg-slate-800 p-3 text-sm text-slate-400">Thinking...</div>}
            </div>

            {error && <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">{error}</p>}

            <form onSubmit={askQuery} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label htmlFor="ai-analysis-query" className="sr-only">Ask about the option chain</label>
                <input
                    id="ai-analysis-query"
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ask about the current option chain..."
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
                <button
                    type="submit"
                    disabled={!query.trim() || isLoading}
                    className="rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? 'Asking...' : 'Ask AI'}
                </button>
            </form>
        </section>
    )
}

export default AIAnalysis