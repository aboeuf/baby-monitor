// main.js - FINAL VERSION (with Audio)
// This version adds an audio stream, starts muted, and provides a mute/unmute toggle button.

const videoElement = document.getElementById('video');
const statusElement = document.getElementById('status');
const videoContainer = document.getElementById('video-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// --- NEW: Mute/Unmute Functionality ---
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');

const volumeOnIcon = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
const volumeOffIcon = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;

function toggleMute() {
    videoElement.muted = !videoElement.muted;
    if (videoElement.muted) {
        muteIcon.innerHTML = volumeOffIcon;
        muteBtn.title = "Unmute";
    } else {
        muteIcon.innerHTML = volumeOnIcon;
        muteBtn.title = "Mute";
    }
}
// --- END NEW ---


async function startViewing() {
    statusElement.textContent = "Connecting to media server...";
    statusElement.style.display = 'block';

    // Start muted to satisfy browser autoplay policy
    videoElement.muted = true;

    videoElement.addEventListener('playing', () => {
        console.log("Video element has started playing.");
        statusElement.style.display = 'none';
    });

    try {
        const pc = new RTCPeerConnection();

        const remoteStream = new MediaStream();
        videoElement.srcObject = remoteStream;

        pc.ontrack = (event) => {
            console.log(`Received track: ${event.track.kind}`);
            remoteStream.addTrack(event.track);
        };

        pc.onconnectionstatechange = () => {
             const state = pc.connectionState;
             console.log(`Connection state changed to: ${state}`);

             switch (state) {
                case 'connecting':
                    statusElement.textContent = "Connecting...";
                    statusElement.style.display = 'block';
                    break;
                case 'connected':
                    statusElement.textContent = "Connection established. Waiting for video...";
                    break;
                case 'failed':
                case 'closed':
                case 'disconnected':
                    statusElement.textContent = "Connection lost.";
                    statusElement.style.display = 'block';
                    break;
             }
        }

        // We request both audio and video now
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const whepUrl = `http://${window.location.hostname}:8889/stream/whep`;
        console.log(`Connecting to WHEP endpoint: ${whepUrl}`);

        const response = await fetch(whepUrl, {
            method: 'POST',
            body: offer.sdp,
            headers: { 'Content-Type': 'application/sdp' }
        });

        if (!response.ok) {
            throw new Error(`Failed to connect: ${response.status}`);
        }
        
        const answerSdp = await response.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (e) {
        console.error("Connection failed:", e);
        statusElement.textContent = "Connection failed. Is mediamtx running?";
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);
// --- NEW: Add event listener for the mute button ---
muteBtn.addEventListener('click', toggleMute);
// --- END NEW ---

window.onload = startViewing;
