// main.js - FINAL VERSION
// This version uses a dynamic hostname and includes a fullscreen toggle.

const videoElement = document.getElementById('video');
const statusElement = document.getElementById('status');
// --- NEW: Get references to the new elements ---
const videoContainer = document.getElementById('video-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');


async function startViewing() {
    statusElement.textContent = "Connecting to media server...";
    statusElement.style.display = 'block';

    // Start muted to satisfy browser autoplay policy
    videoElement.muted = true;

    try {
        const pc = new RTCPeerConnection();

        const remoteStream = new MediaStream();
        videoElement.srcObject = remoteStream;

        pc.ontrack = (event) => {
            console.log(`Received track: ${event.track.kind}`);
            remoteStream.addTrack(event.track);
        };

        pc.onconnectionstatechange = () => {
             console.log(`Connection state changed to: ${pc.connectionState}`);
             if (pc.connectionState === 'connected') {
                 statusElement.style.display = 'none';
             }
        }

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Replace the hardcoded 'localhost' with the dynamic hostname
        // that was used to access the page.
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

// --- NEW: Function to handle fullscreen toggle ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // If we're not in fullscreen, request it on the video container
        videoContainer.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        // Otherwise, exit fullscreen
        document.exitFullscreen();
    }
}

// Add the click listener for the fullscreen button
fullscreenBtn.addEventListener('click', toggleFullscreen);

// Start the connection process as soon as the page loads.
window.onload = startViewing;

