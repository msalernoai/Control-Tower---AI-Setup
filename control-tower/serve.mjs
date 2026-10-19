// Serves the dashboard on http://localhost:4321, only to this machine.
// No build step, no dependencies: index.html + snapshot.json.

import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 4321

createServer((req, res) => {
  if (req.url.startsWith('/snapshot.json')) {
    // No real snapshot yet: show the example so the page is never empty.
    const file = existsSync(join(HERE, 'snapshot.json')) ? 'snapshot.json' : 'snapshot.example.json'
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return res.end(readFileSync(join(HERE, file)))
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(readFileSync(join(HERE, 'index.html')))
}).listen(PORT, '127.0.0.1', () => console.log(`Control Tower on http://localhost:${PORT}`))
