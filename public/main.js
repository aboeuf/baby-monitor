// main.js - FINAL VERSION
// This version uses a dynamic hostname, has a fullscreen toggle, and provides better user feedback.

const videoElement = document.getElementById('video');
const statusElement = document.getElementById('status');
const videoContainer = document.getElementById('video-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');


async function startViewing() {
    statusElement.textContent = "Connecting to media server...";
    statusElement.style.display = 'block';

    // Start muted to satisfy browser autoplay policy
    videoElement.muted = true;

    // --- THE FIX: Listen for the 'playing' event ---
    // This event only fires when the video actually starts rendering,
    // which is the perfect time to hide the status message.
    videoElement.addEventListener('playing', () => {
        console.log("Video element has started playing.");
        statusElement.style.display = 'none';
    });
    // --- END OF FIX ---

    try {
        const pc = new RTCPeerConnection();

        const remoteStream = new MediaStream();
        videoElement.srcObject = remoteStream;

        pc.ontrack = (event) => {
            console.log(`Received track: ${event.track.kind}`);
            remoteStream.addTrack(event.track);
            // We no longer hide the status here, we wait for the 'playing' event.
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
window.onload = startViewing;

