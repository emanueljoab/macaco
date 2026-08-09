const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, PermissionsBitField } = require("discord.js");
const { db, DEFAULT_PREFIX, getPrefix, getLanguagePreference } = require("../database");
const { log, warn, error, monkeyEmbed, randomThumbnail } = require("../utils");

async function execute(message, _args, _db, translate) {
    // Verificar se o usuário tem permissão de administrador
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const permEmbed = monkeyEmbed(await translate("config", "permission"));
        return message.reply({ embeds: [permEmbed] });
    }

    const currentLanguage = await getLanguagePreference(message.guild.id);
    const currentPrefix = (await getPrefix(message.guild.id)) || DEFAULT_PREFIX;
    const currentLanguageLabel = await translate("config", currentLanguage === "english" ? "label-en" : "label-pt");

    // Embed inicial com os valores atuais e botões de configuração
    const embed = new EmbedBuilder()
        .setTitle(await translate("config", "setTitle"))
        .setDescription(await translate("config", "currentValues", currentLanguageLabel, currentPrefix))
        .addFields({ name: "​", value: await translate("config", "addFields") });

    const languageButton = new ButtonBuilder()
        .setCustomId("config-language")
        .setLabel(await translate("config", "label-language"))
        .setEmoji("🌐")
        .setStyle(ButtonStyle.Primary);

    const prefixButton = new ButtonBuilder()
        .setCustomId("config-prefix")
        .setLabel(await translate("config", "label-prefix"))
        .setEmoji("⌨️")
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(languageButton, prefixButton);
    const reply = await message.reply({ embeds: [embed], components: [row] });

    const filter = (interaction) => ["config-language", "config-prefix"].includes(interaction.customId) && interaction.user.id === message.author.id;
    const collector = reply.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 60000,
        max: 1,
    });

    collector.on("collect", async (interaction) => {
        if (interaction.customId === "config-language") {
            // Fluxo de idioma
            const languageEmbed = new EmbedBuilder()
                .setTitle(await translate("config", "setTitle"))
                .setDescription(" ")
                .addFields({ name: "​", value: await translate("config", "addFieldsLanguage") });

            const englishButton = new ButtonBuilder()
                .setCustomId("lang-english")
                .setLabel(await translate("config", "label-en"))
                .setEmoji("🇺🇸")
                .setStyle(currentLanguage === "english" ? ButtonStyle.Success : ButtonStyle.Primary);

            const portugueseButton = new ButtonBuilder()
                .setCustomId("lang-portuguese")
                .setLabel(await translate("config", "label-pt"))
                .setEmoji("🇧🇷")
                .setStyle(currentLanguage === "portuguese" ? ButtonStyle.Success : ButtonStyle.Primary);

            const langRow = new ActionRowBuilder().addComponents(englishButton, portugueseButton);
            await interaction.update({ embeds: [languageEmbed], components: [langRow] });

            const langFilter = (i) => ["lang-english", "lang-portuguese"].includes(i.customId) && i.user.id === message.author.id;
            const langCollector = reply.createMessageComponentCollector({
                filter: langFilter,
                componentType: ComponentType.Button,
                time: 60000,
                max: 1,
            });

            langCollector.on("collect", (langInteraction) => {
                const selectedLanguage = langInteraction.customId === "lang-english" ? "english" : "portuguese";
                db.run(
                    `INSERT INTO server_language (guild_id, language) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET language = ?`,
                    [message.guild.id, selectedLanguage, selectedLanguage],
                    async (err) => {
                        try {
                            if (err) {
                                error(message, `Erro ao atualizar o idioma: ${err}`);
                                languageEmbed.setFields({ name: "​", value: await translate("config", "error") }).setThumbnail(randomThumbnail());
                                await langInteraction.update({ embeds: [languageEmbed], components: [] });
                            } else {
                                languageEmbed.setFields({ name: "​", value: await translate("config", "success", selectedLanguage) });
                                await langInteraction.update({ embeds: [languageEmbed], components: [] });
                                log(message, `Idioma alterado para ${selectedLanguage}`);
                            }
                        } catch (e) {
                            if (e.code !== 10062) error(message, `Erro inesperado na interação: ${e}`);
                        }
                    }
                );
            });

            langCollector.on("end", (collected, reason) => {
                if (reason === "time") {
                    reply.edit({ components: [] }).catch(e => warn(message, `Não foi possível remover os componentes do config: ${e.message}`));
                }
            });

        } else if (interaction.customId === "config-prefix") {
            // Fluxo de prefixo (modal)
            const modal = new ModalBuilder()
                .setCustomId("set-prefix")
                .setTitle(await translate("config", "prefixModalTitle"));

            const prefixInput = new TextInputBuilder()
                .setCustomId("prefix-input")
                .setLabel(await translate("config", "prefixInputLabel"))
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(10)
                .setValue(currentPrefix)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(prefixInput));
            await interaction.showModal(modal);

            try {
                const modalSubmit = await interaction.awaitModalSubmit({
                    time: 60000,
                    filter: (i) =>
                        i.customId === "set-prefix" &&
                        i.user.id === message.author.id &&
                        i.guildId === message.guild.id,
                });
                const newPrefix = modalSubmit.fields.getTextInputValue("prefix-input").trim();

                if (!newPrefix || /\s/.test(newPrefix)) {
                    const invalidEmbed = new EmbedBuilder()
                        .setTitle(await translate("config", "setTitle"))
                        .setDescription(" ")
                        .setFields({ name: "​", value: await translate("config", "prefixInvalid") })
                        .setThumbnail(randomThumbnail());
                    await modalSubmit.update({ embeds: [invalidEmbed], components: [] });
                    return;
                }

                db.run(
                    `INSERT INTO server_prefix (guild_id, guild_name, prefix) VALUES (?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET guild_name = ?, prefix = ?`,
                    [message.guild.id, message.guild.name, newPrefix, message.guild.name, newPrefix],
                    async (err) => {
                        try {
                            const resultEmbed = new EmbedBuilder()
                                .setTitle(await translate("config", "setTitle"))
                                .setDescription(" ");
                            if (err) {
                                error(message, `Erro ao atualizar o prefixo: ${err}`);
                                resultEmbed.setFields({ name: "​", value: await translate("config", "error") }).setThumbnail(randomThumbnail());
                            } else {
                                resultEmbed.setFields({ name: "​", value: await translate("config", "prefixSuccess", newPrefix) });
                                log(message, `Prefixo alterado para "${newPrefix}"`);
                            }
                            await modalSubmit.update({ embeds: [resultEmbed], components: [] });
                        } catch (e) {
                            if (e.code !== 10062) error(message, `Erro inesperado ao atualizar prefixo: ${e}`);
                        }
                    }
                );
            } catch (e) {
                await reply.edit({ components: [] }).catch(e2 => warn(message, `Não foi possível remover os componentes do config: ${e2.message}`));
            }
        }
    });

    collector.on("end", (collected, reason) => {
        if (reason === "time") {
            reply.edit({ components: [] }).catch(e => warn(message, `Não foi possível remover os componentes do config: ${e.message}`));
        }
    });
}

module.exports = {
    execute,
};
