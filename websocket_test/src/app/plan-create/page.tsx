import { useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001/plan');

export default function PlanCreatePage() {
    const [chatId, setChatId] = useState('');
    const [response, setResponse] = useState('');

    const handleSend = () => {
        socket.emit('getPlan', { chatId });
    };

    socket.on('planData', (data) => {
        setResponse((prev) => prev + '\n' + JSON.stringify(data));
    });

    return (
        <div className="p-8 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Test Plan Create (Socket.IO)</h1>
            <textarea
                className="w-full h-24 p-2 border rounded mb-2"
                placeholder="Enter chatId..."
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
            />
            <button
                className="bg-blue-600 text-white px-4 py-2 rounded"
                onClick={handleSend}
            >
                Send to Socket
            </button>
            <div className="mt-4 bg-gray-100 p-2 rounded">
                <strong>Response:</strong>
                <pre className="whitespace-pre-wrap">{response}</pre>
            </div>
        </div>
    );
}
