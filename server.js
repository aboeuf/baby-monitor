// server.js (Simplified Version)
// This script runs a minimal web server just to serve the
// client-side HTML and JavaScript files.

const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Serve the static files from the 'public' directory
app.use(express.static('public'));

server.listen(PORT, () => {
    console.log(`Web server is running on http://localhost:${PORT}`);
    console.log('This server is only for serving the web page.');
    console.log('The video stream is handled by mediamtx.');
});
