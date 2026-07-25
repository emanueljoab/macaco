const { EmbedBuilder } = require("discord.js");
const { log, error, monkeyEmbed } = require("../utils");
const { updateRecord } = require("../database");

async function execute(message, _args, _db, translate) {
    try {
        let user = message.mentions.users.first() || message.author;
        const tamanho = Math.floor(Math.random() * 21);
        const pp = "8" + "=".repeat(tamanho) + "D";

        const embed = new EmbedBuilder()
            .setTitle(await translate("pp", "setTitle"))
            .setDescription(await translate("pp", "setDescription", user.username, pp))
            .setFooter({ text: `${tamanho} cm` });
        await message.reply({ embeds: [embed] });
        log(message, `Pipi de ${user.username}: ${tamanho} cm`);
        updateRecord(message.guild.id, message.guild.name, user.id, user.username, "max_pp", tamanho);
    } catch (err) {
        const embed = monkeyEmbed(await translate("pp", "error"));
        await message.reply({ embeds: [embed] });
        error(message, `Erro ao executar comando: ${err.message}`);
    }
}

module.exports = {
    execute,
};