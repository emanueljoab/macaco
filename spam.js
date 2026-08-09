const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { log, warn, error, randomThumbnail } = require("./utils");

// Map: guildId:userId -> [{ content, channelId, timestamp, message }]
const recentMessages = new Map();

const WINDOW_MS = 10_000;           // 10 second window
const THRESHOLD = 3;                // distinct channels threshold
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minute timeout

// Periodically clean up inactive users from memory
setInterval(() => {
    const now = Date.now();
    for (const [historyKey, history] of recentMessages.entries()) {
        const fresh = history.filter(e => now - e.timestamp <= WINDOW_MS);
        if (fresh.length === 0) {
            recentMessages.delete(historyKey);
        } else {
            recentMessages.set(historyKey, fresh);
        }
    }
}, 5 * 60 * 1000); // every 5 minutes

async function checkSpam(message, translate) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const historyKey = `${message.guild.id}:${userId}`;
    const now = Date.now();
    const content = message.content.trim();

    if (!content) return;

    // Initialize user history if needed
    if (!recentMessages.has(historyKey)) {
        recentMessages.set(historyKey, []);
    }

    const history = recentMessages.get(historyKey);

    // Remove entries outside the time window
    const recent = history.filter(entry => now - entry.timestamp <= WINDOW_MS);

    // Register current message
    recent.push({ content, channelId: message.channelId, timestamp: now, message });

    recentMessages.set(historyKey, recent);

    // Filter entries with the same content
    const sameContent = recent.filter(entry => entry.content === content);

    // Count distinct channels where this content was sent
    const distinctChannels = new Set(sameContent.map(entry => entry.channelId));

    if (distinctChannels.size < THRESHOLD) return;

    // Spam detected — clear user history immediately
    recentMessages.delete(historyKey);

    // Check if the bot has permission to timeout members
    const me = message.guild.members.me;
    if (!me || !me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        warn(message, `Sem permissão para aplicar timeout`);
        return;
    }

    // Check if the user can be moderated (not an admin or higher role than the bot)
    const member = message.guild.members.cache.get(userId);
    if (!member) return;
    if (!member.moderatable) {
        log(message, `Não foi possível moderar (cargo superior ou admin)`);
        return;
    }

    try {
        // Delete all detected spam messages
        for (const entry of sameContent) {
            await entry.message.delete().catch(() => null);
        }

        // Apply 30 minute timeout
        const reason = await translate("spam", "reason");
        await member.timeout(TIMEOUT_MS, reason);

        log(message, `Usuário silenciado por 30 minutos`);

        // Notify the channel where spam was detected
        const embed = new EmbedBuilder()
            .setTitle(await translate("spam", "setTitle"))
            .setDescription(await translate("spam", "detected", `<@${userId}>`))
            .setThumbnail(randomThumbnail());

        await message.channel.send({ embeds: [embed] });
    } catch (err) {
        error(message, `Erro ao processar spam: ${err.message}`);
    }

    // A mensagem atual foi deletada como spam; o chamador não deve processá-la
    return true;
}

module.exports = { checkSpam };
