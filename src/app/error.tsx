'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center border border-red-200">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-bold text-red-700 mb-2">حدث خطأ</h2>
        <div className="bg-red-50 rounded-lg p-3 mb-4 text-right">
          <p className="text-sm text-red-600 font-mono break-words">{error.message}</p>
          {error.stack && (
            <pre className="text-xs text-red-500 mt-2 overflow-auto max-h-40 whitespace-pre-wrap">{error.stack.substring(0, 1000)}</pre>
          )}
        </div>
        <button
          onClick={reset}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}
