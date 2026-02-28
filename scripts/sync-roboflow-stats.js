#!/usr/bin/env node
/*
 Simple sync script: read .data/roboflow-admin-stats.json and POST it to
 a configured endpoint (SYNC_ROBOFLOW_ENDPOINT). Use header
 `x-roboflow-endpoint-secret` with `SYNC_ROBOFLOW_SECRET` if present.

 Usage:
   node scripts/sync-roboflow-stats.js [--dry-run]

 Designed to be scheduled (cron, Task Scheduler, GitHub Actions).
*/

const fs = require('fs').promises
const path = require('path')

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry-run')

  const statsFile = path.join(process.cwd(), '.data', 'roboflow-admin-stats.json')
  try {
    const raw = await fs.readFile(statsFile, 'utf8')
    const parsed = JSON.parse(raw)
    console.log('Loaded stats:', parsed)

    const endpoint = process.env.SYNC_ROBOFLOW_ENDPOINT
    const secret = process.env.SYNC_ROBOFLOW_SECRET

    if (!endpoint) {
      console.log('No SYNC_ROBOFLOW_ENDPOINT configured — nothing to POST. Exiting.')
      return
    }

    if (dry) {
      console.log('Dry run enabled — would POST to', endpoint)
      return
    }

    // use global fetch (Node 18+). If missing, instruct user to install node-fetch.
    const fetchFn = global.fetch
    if (typeof fetchFn !== 'function') {
      console.error('global.fetch not available in this Node runtime. Use Node 18+ or provide your own runner.')
      process.exit(2)
    }

    const resp = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-roboflow-endpoint-secret': secret } : {})
      },
      body: JSON.stringify(parsed),
      // do not cache
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error('Sync failed', resp.status, text)
      process.exit(3)
    }

    console.log('Sync successful:', text)
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.log('No stats file found at .data/roboflow-admin-stats.json — nothing to sync.')
      return
    }
    console.error('Error during sync:', err)
    process.exit(1)
  }
}

main()
