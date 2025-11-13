const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')
const fs = require('fs')
const mime = require('mime-types')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000
// when using middleware `hostname` and `port` might be different.
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname } = parsedUrl

      // Serve static files from the public/sheets directory
      if (pathname.startsWith('/sheets/')) {
        const filePath = path.join(process.cwd(), 'public', pathname)
        
        // Check if file exists
        if (fs.existsSync(filePath)) {
          const contentType = mime.lookup(filePath) || 'application/octet-stream'
          res.setHeader('Content-Type', contentType)
          fs.createReadStream(filePath).pipe(res)
        } else {
          // If file not found, let Next.js handle it (e.g., 404 page)
          await handle(req, res, parsedUrl)
        }
      } else {
        await handle(req, res, parsedUrl)
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})