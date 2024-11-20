const startButton = document.getElementById('start-button');
const callButton = document.getElementById('call-button');
const hangupButton = document.getElementById('hangup-button');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let localStream;
let remoteStream;
let localConnection;

const signalingServer = new WebSocket('ws://localhost:3000');

signalingServer.onmessage = async event => {
	console.log(event)
	const message = JSON.parse(event.data);

	if (message.type === 'offer') {
		await localConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
		const answer = await localConnection.createAnswer();
		await localConnection.setLocalDescription(answer);

		signalingServer.send(JSON.stringify({
			type: 'answer',
			answer: answer
		}));
	} else if (message.type === 'answer') {
		await localConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
	} else if (message.type === 'candidate') {
		try {
			await localConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
		} catch (error) {
			console.error('Error adding received ICE candidate', error);
		}
	}
};

// Запуск получения медиа
startButton.addEventListener('click', async () => {
	try {
		localConnection = new RTCPeerConnection();

		localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		localVideo.srcObject = localStream;

		callButton.disabled = false;
		startButton.disabled = true;
	} catch (error) {
		console.error('Error accessing media devices:', error);
	}
});

// Установка соединения
callButton.addEventListener('click', async () => {
	callButton.disabled = true;
	hangupButton.disabled = false;


	localConnection.onicecandidate = event => {
		if (event.candidate) {
			signalingServer.send(JSON.stringify({
				type: 'candidate',
				candidate: event.candidate
			}));
		}
	};

	localConnection.ontrack = event => {
		if (!remoteStream) {
			remoteStream = new MediaStream();
			remoteVideo.srcObject = remoteStream;
		}
		remoteStream.addTrack(event.track);
	};

	localStream.getTracks().forEach(track => {
		localConnection.addTrack(track, localStream);
	});

	const offer = await localConnection.createOffer();
	await localConnection.setLocalDescription(offer);

	signalingServer.send(JSON.stringify({
		type: 'offer',
		offer: offer
	}));
});

// Завершение соединения
hangupButton.addEventListener('click', () => {
	localConnection.close();
	hangupButton.disabled = true;
	callButton.disabled = false;
});
