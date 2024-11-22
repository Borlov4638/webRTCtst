const startButton = document.querySelector('button.start-button');
const hangupButton = document.querySelector('button.hangup-button');
const videosContainer = document.querySelector('div.videos-container');

let localStream;
let peers = {}; // Хранение RTCPeerConnection для каждого пользователя

const signalingServer = new WebSocket('ws://localhost:3000');

signalingServer.onmessage = async event => {
	const message = JSON.parse(event.data);
	const { type, id, offer, answer, candidate } = message;

	if (type === 'new-user') {
		// Создаём соединение для нового пользователя
		setupPeerConnection(id, true);
	} else if (type === 'offer') {
		// Обработка входящего оффера
		await handleOffer(id, offer);
	} else if (type === 'answer') {
		// Обработка входящего ответа
		await peers[id].connection.setRemoteDescription(new RTCSessionDescription(answer));
	} else if (type === 'candidate') {
		// Добавление ICE-кандидата
		await peers[id].connection.addIceCandidate(new RTCIceCandidate(candidate));
	} else if (type === 'user-left') {
		// Удаление отключившегося пользователя
		removePeer(id);
	}
};

// Функция запуска
startButton.addEventListener('click', async () => {
	try {
		localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		// Показ локального видео
		const localVideo = document.querySelector('video.local-video');
		localVideo.srcObject = localStream;

		signalingServer.send(JSON.stringify({ type: 'join' }));
		startButton.disabled = true;
		hangupButton.disabled = false;
	} catch (error) {
		console.error('Error accessing media devices:', error);
	}
});

// Завершение звонка
hangupButton.addEventListener('click', () => {
	signalingServer.send(JSON.stringify({ type: 'leave' }));
	Object.keys(peers).forEach(id => removePeer(id));
	peers = {};
	hangupButton.disabled = true;
	startButton.disabled = false;
});

// Установка RTCPeerConnection для нового пользователя
function setupPeerConnection(id, isInitiator) {
	const connection = new RTCPeerConnection();

	// Обработка ICE-кандидатов
	connection.onicecandidate = event => {
		if (event.candidate) {
			signalingServer.send(JSON.stringify({
				type: 'candidate',
				id: id,
				candidate: event.candidate
			}));
		}
	};

	// Обработка потока нового пользователя
	connection.ontrack = event => {
		if (!peers[id].stream) {
			peers[id].stream = new MediaStream();
			const remoteVideo = document.createElement('video');
			remoteVideo.classList.add(`video-${id}`);
			remoteVideo.autoplay = true;
			videosContainer.appendChild(remoteVideo);
			remoteVideo.srcObject = peers[id].stream;
		}
		peers[id].stream.addTrack(event.track);
	};

	if(localStream){
		localStream.getTracks().forEach(track => {
			connection.addTrack(track, localStream);
		});
	}

	peers[id] = { connection, stream: null };

	if (isInitiator) {
		// Создаём offer для нового пользователя
		connection.createOffer()
			.then(offer => connection.setLocalDescription(offer))
			.then(() => {
				signalingServer.send(JSON.stringify({
					type: 'offer',
					id: id,
					offer: connection.localDescription
				}));
			});
	}
}

// Обработка входящего оффера
async function handleOffer(id, offer) {
	setupPeerConnection(id, false);
	const connection = peers[id].connection;
	await connection.setRemoteDescription(new RTCSessionDescription(offer));
	const answer = await connection.createAnswer();
	await connection.setLocalDescription(answer);

	signalingServer.send(JSON.stringify({
		type: 'answer',
		id: id,
		answer: answer
	}));
}

// Удаление видео и закрытие соединения
function removePeer(id) {
	if (peers[id]) {
		if (peers[id].stream) {
			const videoElement = document.querySelector(`video.video-${id}`);
			if (videoElement) videosContainer.removeChild(videoElement);
		}
		peers[id].connection.close();
		delete peers[id];
	}
}
