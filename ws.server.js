const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });
const users = new Map();

wss.on('connection', ws => {
	const id = generateUniqueId();
	users.set(id, ws);

	ws.on('message', message => {
		const data = JSON.parse(message);

		if (data.type === 'join') {

			broadcast({ type: 'new-user', id }, ws);
		} else if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {

			const target = users.get(data.id);
			if (target) {
				target.send(JSON.stringify({ ...data, id }));
			}
		} else if (data.type === 'leave') {

			broadcast({ type: 'user-left', id });
			users.delete(id);
		}
	});

	ws.on('close', () => {

		broadcast({ type: 'user-left', id });
		users.delete(id);
	});
});

function broadcast(message, sender) {
	users.forEach((ws) => {
		if (ws !== sender) {
			ws.send(JSON.stringify(message));
		}
	});
}

function generateUniqueId() {
	return Math.random().toString(36).substr(2, 9);
}

console.log('Signaling server is running on ws://localhost:3000');
