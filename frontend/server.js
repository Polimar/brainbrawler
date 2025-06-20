const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Serve static files
app.use(express.static(__dirname));

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎨 Frontend server running on http://localhost:${PORT}`);
    console.log(`🎮 Open your browser and start testing BrainBrawler!`);
});
