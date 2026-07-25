const { EmbedBuilder } = require("discord.js");
const { log, error, monkeyEmbed } = require("../utils");

async function execute(message, _args, _db, translate) {
    try {
        const startTimestamp = Date.now();
        await message.channel.sendTyping();
        const latency = Date.now() - startTimestamp;
        const wsLatency = Math.round(message.client.ws.ping);
        const embed = new EmbedBuilder()
            .setTitle("🏓 Pong!")
            .setDescription(await translate("ping", "latency", latency))
            .setFooter({ text: await translate("ping", "apiLatency", wsLatency) });
        await message.reply({ embeds: [embed] });
        log(message, `Pong! Latência ${latency} ms (WS: ${wsLatency} ms)`);
    } catch (err) {
        error(message, `Erro ao executar ping: ${err.message}`);
        const errEmbed = monkeyEmbed(await translate("ping", "error"));
        await message.reply({ embeds: [errEmbed] });
    }
}

module.exports = {
    execute,
};