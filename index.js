import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Usamos el identificador base que el SDK procesa sin errores de enrutamiento
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

discordClient.once('ready', () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
});

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.mentions.has(discordClient.user)) {
        try {
            await message.channel.sendTyping();
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();

            if (!cleanContent) {
                await message.reply("¿En qué puedo ayudarte?");
                return;
            }

            const prompt = `[Rol: Eres Aletheia, estratega y orientadora concisa y ejecutiva]. Pregunta del usuario: ${cleanContent}`;
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            await message.reply(responseText.substring(0, 1900));

        } catch (error) {
            console.error("DETALLE DEL ERROR:", error);
            await message.reply(`❌ Error: ${error.message || 'Falla interna en el módulo'}`);
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
