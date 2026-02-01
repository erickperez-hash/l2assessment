import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

// Lazy initializer for history state
function getInitialHistory() {
  return JSON.parse(localStorage.getItem('triageHistory') || '[]')
}

// Sort options configuration
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'urgency-high', label: 'High Urgency First' },
  { value: 'urgency-low', label: 'Low Urgency First' }
]

// Urgency sort order
const URGENCY_ORDER = { High: 0, Medium: 1, Low: 2 }

function HistoryPage() {
  const [history, setHistory] = useState(getInitialHistory)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [urgencyFilter, setUrgencyFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [expandedIndex, setExpandedIndex] = useState(null)

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      localStorage.setItem('triageHistory', '[]')
      setHistory([])
    }
  }

  // Apply sorting
  const sortedHistory = [...history].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.timestamp) - new Date(a.timestamp)
      case 'oldest':
        return new Date(a.timestamp) - new Date(b.timestamp)
      case 'urgency-high':
        return (URGENCY_ORDER[a.urgency] ?? 2) - (URGENCY_ORDER[b.urgency] ?? 2)
      case 'urgency-low':
        return (URGENCY_ORDER[b.urgency] ?? 2) - (URGENCY_ORDER[a.urgency] ?? 2)
      default:
        return new Date(b.timestamp) - new Date(a.timestamp)
    }
  })

  // Apply filters
  const filteredHistory = sortedHistory.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchesUrgency = urgencyFilter === 'all' || item.urgency === urgencyFilter
    return matchesCategory && matchesUrgency
  })

  const categories = [...new Set(history.map(item => item.category))]
  const urgencyLevels = ['High', 'Medium', 'Low']

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analysis History</h1>
              <p className="text-gray-600">View and manage past message analyses</p>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-semibold"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Sort and Filter Controls */}
          {history.length > 0 && (
            <div className="space-y-4">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-600">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-2">Filter by Category:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      categoryFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({history.length})
                  </button>
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        categoryFilter === category
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category} ({history.filter(h => h.category === category).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgency Filter */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-2">Filter by Urgency:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setUrgencyFilter('all')}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      urgencyFilter === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {urgencyLevels.map(level => (
                    <button
                      key={level}
                      onClick={() => setUrgencyFilter(level)}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        urgencyFilter === level
                          ? level === 'High' ? 'bg-red-600 text-white'
                            : level === 'Medium' ? 'bg-yellow-500 text-white'
                            : 'bg-green-600 text-white'
                          : level === 'High' ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : level === 'Medium' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {level} ({history.filter(h => h.urgency === level).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-500">
                Showing {filteredHistory.length} of {history.length} messages
              </div>
            </div>
          )}
        </div>

        {/* History List */}
        {filteredHistory.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-xl text-gray-600 mb-2">No history yet</div>
            <p className="text-gray-500 mb-6">
              Analyzed messages will appear here
            </p>
            <a
              href="/analyze"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Analyze a Message
            </a>
          </div>
        )}

        <div className="space-y-4">
          {filteredHistory.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-gray-500 mb-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                    <div className="text-gray-800 font-medium mb-2">
                      "{item.message.substring(0, 100)}{item.message.length > 100 ? '...' : ''}"
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                        {item.category}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        item.urgency === 'High' ? 'bg-red-200 text-red-900' :
                        item.urgency === 'Medium' ? 'bg-yellow-200 text-yellow-900' :
                        'bg-green-200 text-green-900'
                      }`}>
                        {item.urgency} Urgency{item.urgencyScore !== undefined && ` (${item.urgencyScore})`}
                      </span>
                      {item.escalate && (
                        <span className="text-xs px-3 py-1 rounded-full font-semibold bg-red-600 text-white">
                          ⚠️ Escalate
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400 ml-4">
                    {expandedIndex === index ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {expandedIndex === index && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-600 mb-1">Full Message</div>
                      <div className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">
                        {item.message}
                      </div>
                    </div>
                    {item.urgencyReasoning && (
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Urgency Analysis</div>
                        <div className="text-sm text-gray-800 bg-orange-50 p-3 rounded border border-orange-200">
                          {item.urgencyReasoning}
                        </div>
                      </div>
                    )}
                    {item.escalate && (
                      <div>
                        <div className="text-xs font-semibold text-red-600 mb-1">⚠️ Escalation Required</div>
                        <div className="text-sm text-red-800 bg-red-50 p-3 rounded border border-red-200">
                          {item.escalateReason}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-gray-600 mb-1">Recommended Action</div>
                      <div className="text-sm text-gray-800 bg-purple-50 p-3 rounded border border-purple-200">
                        {item.recommendedAction}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-600 mb-1">Category Reasoning</div>
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="prose prose-sm max-w-none text-gray-700">
                          <ReactMarkdown>
                            {item.reasoning}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HistoryPage
