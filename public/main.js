// main.js - FINAL VERSION
// This version uses a dynamic hostname to work on any device.

const videoElement = document.getElementById('video');
const statusElement = document.getElementById('status');

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

        // --- THE CRITICAL FIX ---
        // Replace the hardcoded 'localhost' with the dynamic hostname
        // that was used to access the page.
        const whepUrl = `http://${window.location.hostname}:8889/stream/whep`;
        console.log(`Connecting to WHEP endpoint: ${whepUrl}`);
        // --- END OF FIX ---

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

// Start the connection process as soon as the page loads.
window.onload = startViewing;

