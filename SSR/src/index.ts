import { Launcher } from '../launcher/server.js';

const app = new Launcher({
  port: 3333,
});

app.start();