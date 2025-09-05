#!/bin/bash

# --- run.sh ---
# A definitive script to launch the baby monitor application.

# Configuration
MEDIAMTX_EXEC="./mediamtx/mediamtx"
GSTREAMER_CMD="gst-launch-1.0 v4l2src device=/dev/video0 ! video/x-raw,width=640,height=480 ! videoconvert ! x264enc speed-preset=ultrafast tune=zerolatency ! rtspclientsink location=rtsp://localhost:8554/stream"
URL="http://localhost:3000"
LOG_DIR="/tmp"

# Array to hold Process IDs (PIDs) of background jobs
PIDS=()

# Function to clean up all background processes on exit
cleanup() {
    echo -e "\nShutting down..."
    # Kill all processes whose PIDs are in the PIDS array
    for pid in "${PIDS[@]}"; do
        # Use a silent kill (-s TERM) and check if the process exists before killing
        if ps -p $pid > /dev/null; then
           kill -s TERM "$pid" 2>/dev/null
        fi
    done
    echo "Done."
    exit 0
}

# Trap the EXIT signal (including Ctrl+C) and call the cleanup function
trap cleanup SIGINT SIGTERM EXIT

# --- Main Execution ---

# Check if required executables exist
if [ ! -f "$MEDIAMTX_EXEC" ]; then
    echo "Error: mediamtx executable not found at '$MEDIAMTX_EXEC'"
    exit 1
fi
if ! command -v gst-launch-1.0 &> /dev/null; then
    echo "Error: gst-launch-1.0 could not be found. Is GStreamer installed?"
    exit 1
fi

echo "Starting servers..."

# Start mediamtx and redirect its output to a log file in /tmp
$MEDIAMTX_EXEC > "$LOG_DIR/mediamtx.log" 2>&1 &
PIDS+=($!)

# Start the Node server and log its output
node server.js > "$LOG_DIR/webserver.log" 2>&1 &
PIDS+=($!)

# Wait for servers to initialize
sleep 2

# Start GStreamer and log its output
$GSTREAMER_CMD > "$LOG_DIR/gstreamer.log" 2>&1 &
PIDS+=($!)

# Wait for the stream to start
sleep 2

echo "Launching browser at $URL..."
google-chrome-stable "$URL" &

echo "---"
echo "Application is running."
echo "Logs are located in $LOG_DIR"
echo "Press Ctrl+C in this terminal to stop everything."
echo "---"

# Wait indefinitely for background jobs
wait
```
