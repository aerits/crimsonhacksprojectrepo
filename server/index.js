import { createApp } from './app.js';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
createApp().listen(port, host, () => console.log(`Softly is ready at http://${host}:${port}`));
