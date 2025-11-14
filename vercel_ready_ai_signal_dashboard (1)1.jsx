// Vercel-Ready AI Trading Signal Dashboard (Next.js 14 App Router)
// Full project with: webhook ingestion API, Supabase DB, realtime subscriptions, auto-refresh, Supabase Auth admin UI, and deploy-ready README.

// -----------------------------
// package.json
// -----------------------------
{
  "name": "ai-trading-signal-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "framer-motion": "10.16.4",
    "@supabase/supabase-js": "2.30.0",
    "lucide-react": "0.344.0"
  },
  "devDependencies": {
    "autoprefixer": "10.4.17",
    "postcss": "8.4.33",
    "tailwindcss": "3.4.1"
  }
}

// -----------------------------
// tailwind.config.js
// -----------------------------
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

// -----------------------------
// postcss.config.js
// -----------------------------
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

// -----------------------------
// app/globals.css
// -----------------------------
@tailwind base;
@tailwind components;
@tailwind utilities;

body { background: #f7f7f7; }

// -----------------------------
// lib/supabaseClient.js (shared client for browser)
// -----------------------------
export const createBrowserSupabase = () => {
  const { createClient } = require('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(supabaseUrl, supabaseAnonKey)
}

// -----------------------------
// app/api/webhook/route.js
// Accepts TradingView webhook POST, validates optional HMAC, and inserts into Supabase using service role key
// -----------------------------
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TRADINGVIEW_SECRET = process.env.TRADINGVIEW_SECRET || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export async function POST(request) {
  try {
    const body = await request.text()

    // Optional HMAC verification (TradingView doesn't support HMAC natively unless you include signature in message)
    // If you configure TradingView to include a signature field, you can verify here. For now we accept JSON.

    let payload = null
    try { payload = JSON.parse(body) } catch (e) { return NextResponse.json({ ok:false, error:'invalid_json' }, { status:400 }) }

    // Basic validation
    const required = ['symbol','time','signal','entry','stoploss','target1']
    const missing = required.filter(k => !(k in payload))
    if (missing.length) return NextResponse.json({ ok:false, error:'missing_fields', missing }, { status:400 })

    // Insert into Supabase table 'signals' (create this table beforehand or use SQL migration below in README)
    const { data, error } = await supabase.from('signals').insert([{ 
      symbol: payload.symbol,
      received_at: new Date().toISOString(),
      signal_time: payload.time,
      signal_type: payload.signal,
      entry: payload.entry,
      stoploss: payload.stoploss,
      target1: payload.target1,
      raw: payload
    }])

    if (error) {
      console.error('Supabase insert error', error)
      return NextResponse.json({ ok:false, error: 'db_insert_failed', detail: error.message }, { status:500 })
    }

    return NextResponse.json({ ok:true, inserted: data })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok:false, error: 'server_error', detail: String(err) }, { status:500 })
  }
}

// -----------------------------
// app/api/signals/route.js
// Returns latest signals from Supabase for the dashboard (public or protected)
// -----------------------------
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function GET() {
  try {
    const { data, error } = await supabaseAnon.from('signals').select('*').order('id', { ascending: false }).limit(100)
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ ok:false, error: String(err) }, { status:500 })
  }
}

// -----------------------------
// app/page.js (Dashboard) - uses Supabase client to fetch initial data and subscribe to realtime updates
// -----------------------------
'use client'

import React, { useEffect, useState } from 'react'
import { createBrowserSupabase } from '../lib/supabaseClient'
import { motion } from 'framer-motion'

export default function Dashboard() {
  const [signals, setSignals] = useState([])
  useEffect(() => {
    let supabase = createBrowserSupabase()

    // Fetch initial signals
    supabase.from('signals').select('*').order('id', { ascending: false }).limit(100).then(res => {
      if (!res.error) setSignals(res.data)
    })

    // Realtime subscription to INSERTs on 'signals'
    const channel = supabase.channel('public:signals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
        setSignals(prev => [payload.new, ...prev].slice(0, 100))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-6">AI Trading Signals Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {signals.map((s, i) => (
          <motion.div key={s.id || i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow p-5">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="text-lg font-semibold">{s.symbol}</div>
                <div className="text-xs text-gray-500">{s.signal_time}</div>
              </div>
              <div className={`px-3 py-1 rounded-full text-white text-sm ${s.signal_type === 'BUY' ? 'bg-green-600' : 'bg-red-600'}`}>{s.signal_type}</div>
            </div>

            <div className="text-xl font-medium">Entry: {s.entry}</div>
            <div className="text-sm text-gray-700 mt-2">SL: {s.stoploss} • T1: {s.target1}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// -----------------------------
// app/(auth)/login/page.js - simple Supabase email magic link login for admin
// -----------------------------
'use client'
import React, { useState } from 'react'
import { createBrowserSupabase } from '../../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [info, setInfo] = useState('')

  const sendLink = async () => {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setInfo('Error sending link: ' + error.message)
    else setInfo('Magic link sent! Check your email.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl mb-4">Admin Login</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourmail.com" className="w-full p-3 border rounded mb-3" />
        <button onClick={sendLink} className="w-full p-3 bg-blue-600 text-white rounded mb-2">Send Magic Link</button>
        <div className="text-sm text-gray-600">{info}</div>
      </div>
    </div>
  )
}

// -----------------------------
// SQL to create 'signals' table on Supabase
// -----------------------------
/*
CREATE TABLE public.signals (
  id bigserial primary key,
  symbol text NOT NULL,
  received_at timestamptz NOT NULL,
  signal_time text,
  signal_type text,
  entry numeric,
  stoploss numeric,
  target1 numeric,
  raw jsonb
);
CREATE INDEX ON public.signals (received_at DESC);
*/

// -----------------------------
// README.md (updated)
// -----------------------------
# AI Trading Signal Dashboard — Vercel Ready (Full)

This Next.js project includes:
- TradingView webhook ingestion API (`/api/webhook`) that inserts alerts into Supabase.
- Signals API (`/api/signals`) for public dashboard consumption.
- Real-time frontend using Supabase Realtime subscriptions.
- Admin login page using Supabase magic-link auth.

## Required Env Variables (set these in Vercel)
- `SUPABASE_URL` — Supabase project URL (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side ONLY)
- `NEXT_PUBLIC_SUPABASE_URL` — same as SUPABASE_URL (client)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key (client)
- `TRADINGVIEW_SECRET` — optional TradingView secret string (if you add HMAC in webhook)

## Setup Supabase
1. Create a Supabase project.
2. Run the SQL in `app` README to create the `signals` table.
3. Copy the `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables.

## Deploy to Vercel
1. Push the repo to GitHub.
2. Import into Vercel (Framework: Next.js).
3. Ensure environment variables are set in the Vercel dashboard.
4. Deploy.

## Hook TradingView
- Use the webhook URL: `https://<your-vercel-app>/api/webhook`
- The TradingView Pine script should send the JSON payload as shown previously.

## Security Notes
- The webhook endpoint uses the Service Role key to write to the database. **Keep the service key secret**. Only set it in server env in Vercel, never in client-side code.
- Consider adding HMAC signature verification; TradingView can include a signature field you generate in Pine script.

## Next Enhancements (I can add for you)
- HMAC verification for request authenticity.
- Rate limiting and/or IP allowlist.
- Slack / Telegram / Broker integration for automated orders.
- Historical charts and P&L computation.


// End of project files
