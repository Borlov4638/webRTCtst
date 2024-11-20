const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', ws => {
	console.log('New connection established.');

	ws.on('message', message => {
		// Сообщение, полученное от клиента
		const data = JSON.parse(message);

		// Пересылка сообщения всем остальным клиентам
		wss.clients.forEach(client => {
			if (client !== ws && client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(data)); // Убедитесь, что отправляете строку
			}
		});
	});

	ws.on('close', () => {
		console.log('Connection closed.');
	});
});

console.log('WebSocket server is running on ws://localhost:3000');
