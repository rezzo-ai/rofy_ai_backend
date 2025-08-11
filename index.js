const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Sample route
app.get('/', (req, res) => {
    res.send('API is running!');
});

// Example API endpoint
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from the backend API!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
