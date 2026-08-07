import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft as ArrowLeftIcon, Eye, EyeOff } from 'lucide-react'
import LoginLeftSide from './LoginLeftSide'

const LoginForm = ({ role, title, subtitle }) => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Add your login logic here
  }

  return (
    <div className='min-h-screen flex flex-col md:flex-row'>
      <LoginLeftSide />

      <div className='flex-1 flex items-center justify-center p-6 sm:p-12 bg-white'>
        <div className="w-full max-w-md animate-fade-in">

          <Link to='/login' className='inline-flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm mb-10 transition-colors'>
            <ArrowLeftIcon size={16} /> Back to portals
          </Link>

          <div className="mb-8">
            <h1 className='text-2xl sm:text-3xl font-medium text-zinc-800'>{title}</h1>
            <p className='text-slate-500 text-sm sm:text-base mt-2'>{subtitle}</p>
          </div>

          {error && (
            <div className='mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-3'>
              <div className='w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0' />
              {error}
            </div>
          )}

          <form className='space-y-5' onSubmit={handleSubmit}>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-2'>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder='john@example.com'
                className='w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-slate-700 mb-2'>Password</label>
              <div className='relative'>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder='••••••••'
                  className='w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500'
                />
                <button
                  type='button'
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-70"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}

export default LoginForm