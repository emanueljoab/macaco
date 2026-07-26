const { EmbedBuilder } = require("discord.js");
const { log, error } = require("../utils");

async function execute(client, message, _args, _db, translate) {
    try {
        const linhas = await translate("help", "setDescription");

        const cabecalho = linhas.slice(0, 1);
        const comandos = linhas.slice(1).sort();
        const descricaoOrdenada = [...cabecalho, "", ...comandos, "", await translate("help", "links")].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(await translate("help", "setTitle"))
            .setDescription(descricaoOrdenada)
            .setThumbnail(client.user.avatarURL());
            
        message.reply({ embeds: [embed] });
        log(message, `Usuário executou o comando`);
    } catch (err) {
        error(message, `Erro na execução: ${err.message}`);
    }
}

module.exports = {
    execute,
};