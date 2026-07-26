require("dotenv").config();

const readline = require("readline");

const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require("discord.js");
const { db, DEFAULT_PREFIX, getPrefix } = require("../database");
const { loadTranslations, translate: translateRaw } = require("../translate");
const { checkSpam } = require("../spam");
const { log, warn, error, matchPrefix, paint } = require("../utils");

const ball8 = require("../commands/8ball");
const clima = require("../commands/clima");
const config = require("../commands/config");
const flip = require("../commands/flip");
const help = require("../commands/help");
const howgay = require("../commands/howgay");
const jokenpo = require("../commands/jokenpo");
const macaco = require("../commands/macaco");
const rank = require("../commands/rank");
const ping = require("../commands/ping");
const pp = require("../commands/pp");
const server = require("../commands/server");
const simp = require("../commands/simp");
const stank = require("../commands/stank");
const user = require("../commands/user");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("clientReady", async () => {
    client.user.setActivity({ name: "custom", state: "pls help", type: ActivityType.Custom });
    loadTranslations(); // Carregar traduções ao iniciar o bot
    log(null, `${client.user.tag} está online!`);
});

client.on("guildCreate", (guild) => {
    log(null, `Entrei num servidor novo: ${guild.name} (${guild.memberCount} membros)!`);
});

client.on("guildDelete", (guild) => {
    // Stubs "unavailable" do READY: guilds de que o bot já saiu, reanunciadas pelo Discord a cada conexão
    if (!guild.available) return;
    log(null, `Saí do servidor: ${guild.name}`);
});

// Comandos digitados no console (terminal local ou painel do host)
const GUILD_SORTS = {
    joined: (a, b) => a.joinedTimestamp - b.joinedTimestamp, // ordem em que o bot entrou
    name: (a, b) => a.name.localeCompare(b.name),
    members: (a, b) => b.memberCount - a.memberCount,
};

function listGuilds(args) {
    const sortKey = args[0];
    if (sortKey && !GUILD_SORTS[sortKey]) return log(null, `Ordenação desconhecida: "${sortKey}" (opções: ${Object.keys(GUILD_SORTS).join(", ")})`);
    if (!client.isReady()) return log(null, `O bot ainda não está online`);
    const guilds = Array.from(client.guilds.cache.values());
    if (sortKey) guilds.sort(GUILD_SORTS[sortKey]); // Sem flag, mantém a ordem em que o Discord enviou
    for (const guild of guilds) {
        const detail = sortKey === "joined"
            ? new Date(guild.joinedTimestamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : `${guild.memberCount} membros`;
        log(null, `${guild.name} ${paint("dim", `(${detail})`)}`);
    }
    const total = guilds.reduce((sum, guild) => sum + guild.memberCount, 0);
    log(null, `Total: ${total} membros em ${guilds.length} servidores`);
}

const consoleCommands = {
    guilds: listGuilds,
    help: () => log(null, `Comandos de console: guilds [${Object.keys(GUILD_SORTS).join("|")}], help`),
};

readline.createInterface({ input: process.stdin }).on("line", (line) => {
    const [command, ...args] = line.trim().toLowerCase().split(/\s+/);
    if (!command) return;
    const fn = consoleCommands[command];
    if (fn) fn(args);
    else log(null, `Comando de console desconhecido: "${command}" (digite "help")`);
});
process.stdin.on("error", () => {}); // Alguns hosts fecham o stdin; ignorar

client.on("messageCreate", async (message) => {
    if (message.system) return; // Mensagens de sistema (criação de tópico, boost, etc.) não aceitam reply

    if (process.env.DEV_MODE === 'true') { // Verificar se o modo de desenvolvimento está ativado
        if (message.channelId !== process.env.DEV_CHANNEL_ID) return;

        const originalReply = message.reply.bind(message);
        
        message.reply = (content) => {
            if (typeof content === 'string') {
                return originalReply('-# 🛠️ DEV MODE\n' + content);
            } else if (content?.embeds) {
                return originalReply({ ...content, content: '-# 🛠️ DEV MODE' });
            }
            return originalReply(content);
        };
    }

    // Verificar spam antes de qualquer coisa
    const guildTranslate = (command, key, ...args) => translateRaw(message.guild?.id, command, key, ...args);
    const isSpam = await checkSpam(message, guildTranslate).catch(err => error(message, `Erro no checkSpam: ${err.message}`));
    if (isSpam) return; // Mensagem deletada como spam; não processar comandos

    // Evento para mensagens
    const content = message.content.toLowerCase();

    if (message.author.bot) return;

    if (!message.guild) return;

    const guildId = message.guild.id;
    const guildPrefix = (await getPrefix(guildId)) || DEFAULT_PREFIX;
    const translate = (command, key, ...args) => translateRaw(guildId, command, key, ...args);

    const rest = matchPrefix(content, guildPrefix);
    if (rest === null) return;

    const args = rest.split(/ +/).filter(Boolean);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    const commandDefs = [
        { names: ["bola8", "8ball"],                                          handler: ball8.execute },
        { names: ["clima", "weather"],                                        handler: clima.execute },
        { names: ["config", "settings"],                                      handler: config.execute,              noMention: true },
        { names: ["flip", "moeda", "coin"],                                   handler: flip.execute,                noMention: true },
        { names: ["help", "ajuda"],                                           handler: help.execute.bind(null, client), noMention: true },
        { names: ["howgay", "gay"],                                           handler: howgay.execute,              mention: true },
        { names: ["jokenpo", "jankenpon", "rps"],                             handler: jokenpo.execute },
        { names: ["macaco", "monkey"],                                        handler: macaco.execute,              noMention: true },
        { names: ["ping"],                                                    handler: ping.execute,                noMention: true },
        { names: ["pp"],                                                      handler: pp.execute,                  mention: true },
        { names: ["rank"],                                                    handler: rank.execute,                noMention: true },
        { names: ["server", "servidor"],                                      handler: server.execute,              noMention: true },
        { names: ["simp"],                                                    handler: simp.execute,                mention: true },
        { names: ["stank", "fedor"],                                          handler: stank.execute,               mention: true },
        { names: ["user", "usuario", "usuário", "profile", "perfil"],         handler: user.execute,                mention: true },
    ];

    const commands = {};
    const noMentionHandlers = new Set();
    const mentionHandlers = new Set();

    for (const def of commandDefs) {
        for (const name of def.names) commands[name] = def.handler;
        if (def.noMention) noMentionHandlers.add(def.handler);
        if (def.mention) mentionHandlers.add(def.handler);
    }

    if (commands[command]) {
        // Verificar e executar os comandos
        try {
            const fn = commands[command];

            if (noMentionHandlers.has(fn) && args.length > 0) return;

            if (mentionHandlers.has(fn)) {
                if (
                    args.length === 0 ||
                    (args.length === 1 && message.mentions.users.size > 0)
                ) {
                    await commands[command](message, args, db, translate);
                } else {
                    return;
                }
            } else {
                await commands[command](message, args, db, translate);
            }
        } catch (err) {
            error(message, `Erro ao executar o comando: ${err.message}`);
            const errorEmbed = new EmbedBuilder()
                .setDescription(await translate("index", "error", command));
            await message.reply({ embeds: [errorEmbed] });
        }
    }
});

// O login inicial falha se a rede ainda não estiver de pé (queda de energia, boot do host):
// o DNS devolve EBUSY/EAI_AGAIN e o bot fica no ar sem nunca conectar. Insistir até resolver.
const LOGIN_RETRY_MS = 15_000;
const FATAL_LOGIN_CODES = new Set(["TokenInvalid", "TokenMissing", "DisallowedIntents"]);

async function login() {
    while (true) {
        try {
            return await client.login(process.env.TOKEN);
        } catch (err) {
            if (FATAL_LOGIN_CODES.has(err.code)) {
                error(null, `Não dá pra conectar no Discord: ${err.message}`);
                process.exit(1); // Token ou intents errados; retry não resolve
            }
            warn(null, `Falha ao conectar no Discord (${err.message}); tentando de novo em ${LOGIN_RETRY_MS / 1000}s`);
            await new Promise(resolve => setTimeout(resolve, LOGIN_RETRY_MS));
        }
    }
}

login();

process.on("unhandledRejection", (err) => {
    error(null, `Unhandled rejection: ${err?.message ?? err}`);
});

client.on("error", (err) => {
    // Falha de websocket; o client reconecta sozinho
    warn(null, `Falha de conexão do client: ${err.message}`);
});