const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { log, warn, error, monkeyEmbed } = require("../utils");

const CHOICE_IDS = {
    ROCK: "rock",
    PAPER: "paper",
    SCISSORS: "scissors",
};

async function execute(message, args, db, translate) {
    try {
        if (args.length > 1 || (args.length === 1 && !args[0].startsWith("<@") && !args[0].endsWith(">"))) {
            return;
        }
        const player1 = message.author;
            let player2 = message.mentions.users.first();

            if (!player2) {
                player2 = {
                    username: message.client.user.username,
                    id: "1243673463902834809",
                };
            }
            
            if (player1.id === player2.id) {
                const yourselfEmbed = monkeyEmbed(await translate("jokenpo", "yourself"));
                return message.reply({ embeds: [yourselfEmbed] });
            }

            const isBotGame = player2.id === "1243673463902834809";
            const [sortedPlayer1, sortedPlayer2] = isBotGame ? [player1, player2] : player1.id < player2.id ? [player1, player2] : [player2, player1];

            const embed = new EmbedBuilder()
                .setTitle(await translate("jokenpo", "jokenpo"))
                .setDescription(await translate("jokenpo", "challenge", escapeMarkdown(player1.username), escapeMarkdown(player2.username)));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(CHOICE_IDS.ROCK)
                    .setLabel(await translate("jokenpo", "label rock"))
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(CHOICE_IDS.PAPER)
                    .setLabel(await translate("jokenpo", "label paper"))
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(CHOICE_IDS.SCISSORS)
                    .setLabel(await translate("jokenpo", "label scissors"))
                    .setStyle(ButtonStyle.Danger)
            );

            const reply = await message.reply({
                embeds: [embed],
                components: [row],
            });

            const filter = (interaction) => interaction.isButton() && [sortedPlayer1.id, sortedPlayer2.id].includes(interaction.user.id);

            const collector = reply.createMessageComponentCollector({
                filter,
                time: 60000,
            });

            const choices = {};
            let resultado = "";
            let gameDecided = false; // Controle de estado para evitar múltiplas atualizações

            collector.on("collect", async (interaction) => {
                try {
                    if (gameDecided) return; // Evitar múltiplas interações após a decisão do jogo

                    choices[interaction.user.id] = interaction.customId;
                    await interaction.deferUpdate();

                    if (sortedPlayer2.id === "1243673463902834809") {
                        const opcoes = [CHOICE_IDS.ROCK, CHOICE_IDS.PAPER, CHOICE_IDS.SCISSORS];
                        choices[sortedPlayer2.id] = opcoes[Math.floor(Math.random() * 3)];
                    }

                    if (Object.keys(choices).length < 2) {
                        const jogadorEsperando = [sortedPlayer1, sortedPlayer2].find((player) => !choices[player.id]);

                        const waitingDescription = await translate("jokenpo", "waiting", escapeMarkdown(sortedPlayer1.username), escapeMarkdown(sortedPlayer2.username), escapeMarkdown(jogadorEsperando.username));

                        // O outro jogador pode ter escolhido durante o await acima;
                        // não sobrescrever o resultado final com a mensagem de espera
                        if (!gameDecided && Object.keys(choices).length < 2) {
                            embed.setDescription(waitingDescription);
                            await reply.edit({ embeds: [embed] });
                        }
                    }

                    if (Object.keys(choices).length === 2 && !gameDecided) {
                        gameDecided = true; // Marcar que o jogo foi decidido
                        collector.stop();

                        let winner = null;
                        if (choices[sortedPlayer1.id] === choices[sortedPlayer2.id]) {
                            resultado = await translate("jokenpo", "tie");
                            log(message, `Empate entre ${sortedPlayer1.username} e ${sortedPlayer2.username}`);
                        } else if (
                            (choices[sortedPlayer1.id] === CHOICE_IDS.ROCK && choices[sortedPlayer2.id] === CHOICE_IDS.SCISSORS) ||
                            (choices[sortedPlayer1.id] === CHOICE_IDS.PAPER && choices[sortedPlayer2.id] === CHOICE_IDS.ROCK) ||
                            (choices[sortedPlayer1.id] === CHOICE_IDS.SCISSORS && choices[sortedPlayer2.id] === CHOICE_IDS.PAPER)
                        ) {
                            resultado = await translate("jokenpo", "player 1 win", escapeMarkdown(sortedPlayer1.username));
                            winner = sortedPlayer1;
                            log(message, `${sortedPlayer1.username} venceu ${sortedPlayer2.username}`);
                        } else {
                            resultado = await translate("jokenpo", "player 2 win", escapeMarkdown(sortedPlayer2.username));
                            winner = sortedPlayer2;
                            log(message, `${sortedPlayer2.username} venceu ${sortedPlayer1.username}`);
                        }

                        const player1Name = escapeMarkdown(sortedPlayer1.username);
                        const player2Name = escapeMarkdown(sortedPlayer2.username);

                        embed.setDescription(
                            await translate(
                                "jokenpo",
                                "choices",
                                winner === sortedPlayer1 ? `__${player1Name}__` : player1Name,
                                getChoiceEmoji(choices[sortedPlayer1.id]),
                                winner === sortedPlayer2 ? `__${player2Name}__` : player2Name,
                                getChoiceEmoji(choices[sortedPlayer2.id]),
                                resultado
                            )
                        );

                        const guildId = message.guild.id;

                        let historyMessage = await translate("jokenpo", "no history");
                        if (winner === sortedPlayer1) {
                            historyMessage = await atualizarHistorico(sortedPlayer1.id, sortedPlayer2.id, sortedPlayer1.username, sortedPlayer2.username, 1, 0);
                            atualizarPontuacao(guildId, sortedPlayer1.id, sortedPlayer1.username, 1, 0);
                            atualizarPontuacao(guildId, sortedPlayer2.id, sortedPlayer2.username, 0, 1);
                        } else if (winner === sortedPlayer2) {
                            historyMessage = await atualizarHistorico(sortedPlayer1.id, sortedPlayer2.id, sortedPlayer1.username, sortedPlayer2.username, 0, 1);
                            atualizarPontuacao(guildId, sortedPlayer2.id, sortedPlayer2.username, 1, 0);
                            atualizarPontuacao(guildId, sortedPlayer1.id, sortedPlayer1.username, 0, 1);
                        } else {
                            historyMessage = await atualizarHistorico(sortedPlayer1.id, sortedPlayer2.id, sortedPlayer1.username, sortedPlayer2.username, 0, 0);
                        }

                        if (historyMessage) {
                            embed.setFooter({ text: historyMessage });
                        } else {
                            embed.setFooter({
                                text: await translate("jokenpo", "no history"),
                            });
                        }

                        const rematchId = "rematch";
                        const rematchRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(rematchId)
                                .setLabel(await translate("jokenpo", "rematch"))
                                .setStyle(ButtonStyle.Secondary)
                        );

                        await reply.edit({ embeds: [embed], components: [rematchRow] });

                        const rematchFilter = (i) =>
                            i.isButton() &&
                            i.customId === rematchId &&
                            (isBotGame ? i.user.id === player1.id : [sortedPlayer1.id, sortedPlayer2.id].includes(i.user.id));

                        const rematchCollector = reply.createMessageComponentCollector({
                            filter: rematchFilter,
                            time: 30000,
                            max: 1,
                        });

                        rematchCollector.on("collect", async (interaction) => {
                            try {
                                const disabledRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(rematchId)
                                        .setLabel(await translate("jokenpo", "rematch"))
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(true)
                                );
                                await interaction.update({ components: [disabledRow] });
                                await execute(message, args, db, translate);
                            } catch (err) {
                                if (err.code !== 10062) {
                                    error(message, `Erro no collector de revanche: ${err.message}`);
                                }
                            }
                        });

                        rematchCollector.on("end", async (collected, reason) => {
                            if (reason === "time") {
                                try {
                                    await reply.edit({ components: [] });
                                } catch (err) {
                                    if (err.code !== 10008) {
                                        warn(message, `Não foi possível remover o botão de revanche: ${err.message}`);
                                    }
                                }
                            }
                        });
                    }
                } catch (err) {
                    if (err.code !== 10062) {
                        error(message, `Erro no collector do jokenpo: ${err.message}`);
                    }
                }
            });

            collector.on("end", async (collected, reason) => {
                try {
                    if (reason === "time" && !gameDecided) {
                        embed.setDescription(await translate("jokenpo", "time up"));
                        await reply.edit({ embeds: [embed], components: [] });
                    }
                } catch (err) {
                    if (err.code !== 10008) {
                        error(message, `Erro no fim do collector do jokenpo: ${err.message}`);
                    }
                }
            });

            function atualizarPontuacao(guildId, userId, username, winsToAdd, lossesToAdd) {
                // serialize: garante que o INSERT rode antes do UPDATE
                db.serialize(() => {
                    db.run("INSERT OR IGNORE INTO jokenpo_rank (guild_id, user_id, username, wins, losses) VALUES (?, ?, ?, 0, 0)", [guildId, userId, username]);
                    // username no SET: o INSERT OR IGNORE acima só grava o nome na primeira
                    // partida, então sem isso quem troca de nick fica congelado no rank
                    db.run("UPDATE jokenpo_rank SET username = ?, wins = wins + ?, losses = losses + ? WHERE guild_id = ? AND user_id = ?", [username, winsToAdd, lossesToAdd, guildId, userId], function (err) {
                        if (err) {
                            error(message, `Erro ao atualizar a pontuação: ${err.message} `);
                        }
                    });
                });
            }

            function atualizarHistorico(player1Id, player2Id, player1Username, player2Username, player1WinsToAdd, player2WinsToAdd) {
                return new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run(
                            `INSERT OR IGNORE INTO jokenpo_history (player1_id, player2_id, player1_username, player2_username, player1_wins, player2_wins)
                                VALUES (?, ?, ?, ?, 0, 0)`,
                            [player1Id, player2Id, player1Username, player2Username],
                            function (err) {
                                if (err) {
                                    error(message, `Erro ao inserir no histórico: ${err.message}`);
                                    reject(err);
                                }
                            }
                        );

                        db.run(
                            `UPDATE jokenpo_history
                                SET player1_username = ?, player2_username = ?,
                                    player1_wins = player1_wins + ?, player2_wins = player2_wins + ?
                                WHERE player1_id = ? AND player2_id = ?`,
                            [player1Username, player2Username, player1WinsToAdd, player2WinsToAdd, player1Id, player2Id],
                            function (err) {
                                if (err) {
                                    error(message, `Erro ao atualizar o histórico: ${err.message}`);
                                    reject(err);
                                } else {
                                    db.get(
                                        `SELECT player1_wins, player2_wins
                                            FROM jokenpo_history
                                            WHERE player1_id = ? AND player2_id = ?`,
                                        [player1Id, player2Id],
                                        async (err, row) => {
                                            if (err) {
                                                error(message, `Erro ao obter o histórico atualizado: ${err.message}`);
                                                reject(err);
                                            } else if (row) {
                                                const historyMessage = await translate("jokenpo", "score", player1Username, row.player1_wins, row.player2_wins, player2Username);
                                                resolve(historyMessage);
                                            } else {
                                                resolve(await translate("jokenpo", "no history"));
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    });
                });
            }
    } catch (err) {
        error(message, `Ocorreu um erro ao executar o comando jokenpo: ${err.message}`);
        const errEmbed = monkeyEmbed(await translate("jokenpo", "error jokenpo"));
        message.reply({ embeds: [errEmbed] });
    }
}

function escapeMarkdown(text) {
    return text.replace(/([\\*_`~])/g, "\\$1");
}

function getChoiceEmoji(choice) {
    if (choice === CHOICE_IDS.ROCK) return "👊";
    if (choice === CHOICE_IDS.PAPER) return "✋";
    if (choice === CHOICE_IDS.SCISSORS) return "✌️";
    return "";
}

module.exports = {
    execute,
};