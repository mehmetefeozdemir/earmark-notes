// Spike: can each AI provider be called directly from a browser page?
// Sends the same CORS preflight a browser would send (no API keys involved)
// and reports whether the provider allows our origin and auth headers.
//
// Usage: node scripts/check-cors.mjs [origin]

const ORIGIN = process.argv[2] ?? 'http://localhost:5180'
const TIMEOUT_MS = 10_000

const PROVIDERS = [
  {
    name: 'OpenAI',
    capability: 'STT batch',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    headers: 'authorization',
  },
  {
    name: 'OpenAI',
    capability: 'LLM',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: 'authorization,content-type',
  },
  {
    name: 'Anthropic',
    capability: 'LLM',
    url: 'https://api.anthropic.com/v1/messages',
    headers: 'x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access,content-type',
  },
  {
    name: 'Gemini',
    capability: 'LLM',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    headers: 'x-goog-api-key,content-type',
  },
  {
    name: 'Groq',
    capability: 'STT batch',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    headers: 'authorization',
  },
  {
    name: 'Groq',
    capability: 'LLM',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: 'authorization,content-type',
  },
  {
    name: 'OpenRouter',
    capability: 'LLM',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: 'authorization,content-type',
  },
  {
    name: 'AssemblyAI',
    capability: 'STT upload',
    url: 'https://api.assemblyai.com/v2/upload',
    headers: 'authorization,content-type',
  },
  {
    name: 'AssemblyAI',
    capability: 'STT batch',
    url: 'https://api.assemblyai.com/v2/transcript',
    headers: 'authorization,content-type',
  },
  {
    name: 'AssemblyAI',
    capability: 'stream token',
    url: 'https://streaming.assemblyai.com/v3/token',
    headers: 'authorization',
    method: 'GET',
  },
  {
    name: 'Deepgram',
    capability: 'STT batch',
    url: 'https://api.deepgram.com/v1/listen',
    headers: 'authorization,content-type',
  },
]

const preflight = async ({ url, headers, method = 'POST' }) => {
  const response = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const allowOrigin = response.headers.get('access-control-allow-origin')
  const allowHeaders = (response.headers.get('access-control-allow-headers') ?? '').toLowerCase()
  const originOk = allowOrigin === '*' || allowOrigin === ORIGIN
  const requested = headers.split(',')
  const headersOk =
    allowHeaders === '*' || requested.every((header) => allowHeaders.includes(header))
  return { status: response.status, allowOrigin, originOk, headersOk }
}

const results = []
for (const provider of PROVIDERS) {
  try {
    const result = await preflight(provider)
    results.push({
      provider: provider.name,
      capability: provider.capability,
      status: result.status,
      allowOrigin: result.allowOrigin ?? '-',
      browserOk: result.originOk && result.headersOk ? 'yes' : 'no',
    })
  } catch (error) {
    results.push({
      provider: provider.name,
      capability: provider.capability,
      status: 'ERR',
      allowOrigin: String(error.cause?.code ?? error.name),
      browserOk: '?',
    })
  }
}

const toMarkdownTable = (rows) => {
  const columns = Object.keys(rows[0] ?? {})
  const line = (cells) => `| ${cells.join(' | ')} |`
  return [
    line(columns),
    line(columns.map(() => '---')),
    ...rows.map((row) => line(columns.map((column) => row[column]))),
  ].join('\n')
}

process.stdout.write(`${toMarkdownTable(results)}\n`)
