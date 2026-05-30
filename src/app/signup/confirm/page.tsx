import Link from 'next/link'

export default function ConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-600 to-orange-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-black text-gray-800 mb-2">Check Your Email</h2>
        <p className="text-gray-500 text-sm mb-2">We sent a confirmation link to your email.</p>
        <p className="text-gray-500 text-sm mb-6">Click the link in that email — it will bring you back here to sign in automatically.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left">
          <p className="text-xs text-amber-700 font-semibold">⚠️ Link not working?</p>
          <p className="text-xs text-amber-600 mt-1">Go to Supabase → Authentication → Settings → disable <strong>Email Confirmations</strong>. Then you can sign up and log in directly without email verification.</p>
        </div>
        <Link href="/login" className="block w-full bg-orange-600 text-white rounded-xl py-3 font-semibold text-center hover:bg-orange-700">
          Go to Sign In
        </Link>
      </div>
    </div>
  )
}
