#!/usr/bin/python3

import subprocess
import os
import sys
import time
import signal
import shlex

MEDIAMTX_EXEC = "./mediamtx/mediamtx"
GSTREAMER_CMD_STR = "gst-launch-1.0 v4l2src device=/dev/video0 ! video/x-raw,width=640,height=480,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast tune=zerolatency key-int-max=60 ! rtspclientsink location=rtsp://localhost:8554/stream"
LOG_DIR = "/tmp"

# Global list to hold the subprocess objects
processes = []

def cleanup(signum, frame):
    """Gracefully terminates all child processes."""
    print("\nShutting down all processes...")
    # Terminate processes in reverse order of creation
    for p in reversed(processes):
        if p.poll() is None:
            try:
                # Use os.kill to send signal to the process group, ensuring children die too
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass # Process already finished

    # Wait a moment for processes to terminate
    time.sleep(0.5)

    for p in reversed(processes):
         if p.poll() is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass # Process already finished
    print("Cleanup complete.")
    sys.exit(0)

def main():
    """Main function to launch all components."""
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    if not os.path.exists(MEDIAMTX_EXEC):
        print(f"Error: mediamtx executable not found at '{MEDIAMTX_EXEC}'", file=sys.stderr)
        sys.exit(1)

    print("Starting all components...")

    try:
        # --- Start mediamtx server ---
        mediamtx_log = open(os.path.join(LOG_DIR, "mediamtx.log"), "w")
        mediamtx_proc = subprocess.Popen(
            [MEDIAMTX_EXEC],
            stdout=mediamtx_log,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid  # Create a new process group
        )
        processes.append(mediamtx_proc)
        print(f"- mediamtx server started (PID: {mediamtx_proc.pid})")

        # --- Start Python web server as a subprocess ---
        webserver_log = open(os.path.join(LOG_DIR, "webserver.log"), "w")
        python_exec = sys.executable or "python3"
        webserver_proc = subprocess.Popen(
            [python_exec, "-m", "http.server", "3000", "--directory", "public"],
            stdout=webserver_log,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid # Create a new process group
        )
        processes.append(webserver_proc)
        print(f"- Python web server started (PID: {webserver_proc.pid})")
        
        time.sleep(2)

        # --- Start GStreamer ---
        gstreamer_args = shlex.split(GSTREAMER_CMD_STR)
        gstreamer_log = open(os.path.join(LOG_DIR, "gstreamer.log"), "w")
        gstreamer_proc = subprocess.Popen(
            gstreamer_args,
            stdout=gstreamer_log,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid # Create a new process group
        )
        processes.append(gstreamer_proc)
        print(f"- GStreamer pipeline started (PID: {gstreamer_proc.pid})")
        
        print("\n---")
        print("Application is running.")
        print(f"Logs are located in {LOG_DIR}")
        print("Press Ctrl+C in this terminal to stop everything.")
        print("---\n")
        
        # Wait for the first process to exit, then trigger cleanup
        os.waitpid(processes[0].pid, 0)
        cleanup(None, None)

    except Exception as e:
        print(f"\nAn error occurred during startup: {e}", file=sys.stderr)
        cleanup(None, None)

if __name__ == "__main__":
    main()
