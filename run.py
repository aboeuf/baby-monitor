#!/usr/bin/python3

import subprocess
import os
import sys
import time
import signal
import shlex

VIDEO_DEVICE = "/dev/video0"
AUDIO_DEVICE = "alsa_input.pci-0000_00_1f.3.analog-stereo"

# High-pass filter frequency in Hz. Cuts out low-frequency rumble.
HIGH_PASS_FREQ = 200

# Noise gate threshold (0.0 to 1.0). Higher values cut out more background noise.
NOISE_GATE_THRESHOLD = 0.04

# --- FFmpeg Command (Constructed from variables above) ---
FFMPEG_CMD_STR = (
    f"ffmpeg -f v4l2 -i {VIDEO_DEVICE} "
    f"-f pulse -i {AUDIO_DEVICE} "
    f"-c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p "
    f'-af "highpass=f={HIGH_PASS_FREQ},agate=threshold={NOISE_GATE_THRESHOLD}" '
    f"-c:a libopus -b:a 96k -ar 48000 "
    f"-f rtsp -rtsp_transport tcp rtsp://localhost:8554/stream"
)

LOG_DIR = "/tmp"
MEDIAMTX_EXEC = "./mediamtx/mediamtx"

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

    from shutil import which
    if which("ffmpeg") is None:
        print("Error: ffmpeg command not found. Please install it.", file=sys.stderr)
        print("On Debian/Ubuntu: sudo apt update && sudo apt install ffmpeg", file=sys.stderr)
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

        # --- Start FFmpeg ---
        print(f"--- Using Video Device: {VIDEO_DEVICE}")
        print(f"--- Using Audio Device: {AUDIO_DEVICE}")
        ffmpeg_args = shlex.split(FFMPEG_CMD_STR)
        ffmpeg_log = open(os.path.join(LOG_DIR, "ffmpeg.log"), "w")
        ffmpeg_proc = subprocess.Popen(
            ffmpeg_args,
            stdout=ffmpeg_log,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid # Create a new process group
        )
        processes.append(ffmpeg_proc)
        print(f"- FFmpeg pipeline started (PID: {ffmpeg_proc.pid})")
        
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
