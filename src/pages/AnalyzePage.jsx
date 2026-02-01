import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { categorizeMessage } from '../utils/llmHelper'
import { calculateUrgency } from '../utils/urgencyScorer'
import { getRecommendedAction } from '../utils/templates'

function AnalyzePage() {
  const [message, setMessage] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const abortControllerRef = useRef(null)

  useEffect(() => {
    // Check for example message from home page
    const exampleMessage = localStorage.getItem('exampleMessage')
    if (exampleMessage) {
      setMessage(exampleMessage)
      localStorage.removeItem('exampleMessage')
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      setLoadingStage('')
    }
  }

  const handleAnalyze = async () => {
    if (!message.trim()) {
      alert('Please enter a message to analyze')
      return
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    setIsLoading(true)
    setResults(null)

    try {
      // Stage 1: Run categorization and urgency in parallel
      // (urgency works without category, just slightly less accurate)
      setLoadingStage('Analyzing message...')

      const [categoryResult, urgencyResult] = await Promise.all([
        categorizeMessage(message, signal),
        calculateUrgency(message, null, signal)
      ])

      const { category, reasoning } = categoryResult

      // Stage 2: Get recommended action (needs both category and urgency)
      setLoadingStage('Generating recommendations...')

      const actionResult = await getRecommendedAction(message, category, urgencyResult.level, signal)

      const analysisResult = {
        message,
        category,
        urgency: urgencyResult.level,
        urgencyScore: urgencyResult.score,
        urgencyReasoning: urgencyResult.reasoning,
        recommendedAction: actionResult.action,
        escalate: actionResult.escalate,
        escalateReason: actionResult.escalateReason,
        reasoning,
        timestamp: new Date().toISOString()
      }

      setResults(analysisResult)

      // Save to history
      const history = JSON.parse(localStorage.getItem('triageHistory') || '[]')
      history.push(analysisResult)
      localStorage.setItem('triageHistory', JSON.stringify(history))
    } catch (error) {
      if (error.message === 'Request cancelled') {
        console.log('Analysis cancelled by user')
      } else {
        console.error('Error analyzing message:', error)
        alert('Error analyzing message. Please try again.')
      }
    } finally {
      setIsLoading(false)
      setLoadingStage('')
      abortControllerRef.current = null
    }
  }

  const handleClear = () => {
    setMessage('')
    setResults(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analyze Customer Message</h1>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to automatically categorize and prioritize.
          </p>

          {/* Input Section */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste customer message here..."
              className="w-full border border-gray-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <div className="text-sm text-gray-500 mt-1">
              {message.length} characters
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {loadingStage || 'Analyzing...'}
                </span>
              ) : (
                'Analyze Message'
              )}
            </button>
            {isLoading && (
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Analysis Results</h2>

            {/* Escalation Alert */}
            {results.escalate && (
              <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                <div className="flex items-start">
                  <span className="text-red-600 text-xl mr-3">⚠️</span>
                  <div>
                    <div className="font-semibold text-red-800">Escalation Recommended</div>
                    <p className="text-sm text-red-700 mt-1">{results.escalateReason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Category</div>
                <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
                  {results.category}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Urgency Level</div>
                <div className="flex items-center gap-3">
                  <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${
                    results.urgency === 'High' ? 'bg-red-200 text-red-900' :
                    results.urgency === 'Medium' ? 'bg-yellow-200 text-yellow-900' :
                    'bg-green-200 text-green-900'
                  }`}>
                    {results.urgency}
                  </div>
                  {results.urgencyScore !== undefined && (
                    <span className="text-sm text-gray-500">
                      Score: {results.urgencyScore}/100
                    </span>
                  )}
                </div>
                {results.urgencyReasoning && (
                  <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                    {results.urgencyReasoning}
                  </p>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Recommended Action</div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-gray-800">{results.recommendedAction}</p>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">AI Reasoning</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>
                      {results.reasoning}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  const text = `Category: ${results.category}\nUrgency: ${results.urgency}${results.urgencyScore !== undefined ? ` (${results.urgencyScore}/100)` : ''}\n${results.urgencyReasoning ? `Urgency Analysis: ${results.urgencyReasoning}\n` : ''}${results.escalate ? `⚠️ ESCALATION REQUIRED: ${results.escalateReason}\n` : ''}Recommendation: ${results.recommendedAction}\n\nCategory Reasoning: ${results.reasoning}`
                  navigator.clipboard.writeText(text)
                  alert('Results copied to clipboard!')
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-semibold"
              >
                📋 Copy Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyzePage
