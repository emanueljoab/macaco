const { EmbedBuilder } = require("discord.js");

// GIFs de macacos exibidos aleatoriamente nos embeds de erro/aviso (hospedados no imgur)
const THUMBNAILS = [
    "https://i.imgur.com/trPOuZj.gif", // helpmonkey: macaco levado pelos paramédicos
    "https://i.imgur.com/zcm0OkH.gif", // worriedmonkey: macaco com as mãos na cabeça
    "https://i.imgur.com/Lr3LW45.gif", // stopmonkey: macaco mandando parar
    "https://i.imgur.com/nrwYG9k.gif", // sadmonkey: macaquinho triste
];

function randomThumbnail() {
    return THUMBNAILS[Math.floor(Math.random() * THUMBNAILS.length)];
}

// O ​ (zero-width space) impede o Discord de cortar a primeira linha vazia,
// empurrando o texto pra baixo pra alinhar com o thumbnail
function monkeyEmbed(text) {
    return new EmbedBuilder()
        .setDescription(`​\n${text}`)
        .setThumbnail(randomThumbnail());
}

function getFile() {
    const lines = new Error().stack.split("\n");
    const line = lines.find(l => l.includes(".js") && !l.includes("utils.js"));
    return line?.match(/\/([^/\\]+)\.js/)?.[1] ?? line?.match(/\\([^/\\]+)\.js/)?.[1] ?? "unknown";
}

const COLOR_CODES = { dim: "2", red: "31", green: "32", yellow: "33", magenta: "35", cyan: "36" };

function makePaint() {
    return (color, text) => `\x1b[${COLOR_CODES[color]}m${text}\x1b[0m`;
}

function format(message, text, paint) {
    const guild = message?.guild?.name;
    const user = message?.author?.username;
    // Sem guild e sem usuário → log de sistema
    const context = (guild || user)
        ? `[${paint("cyan", guild ?? "DM")}] [${paint("magenta", getFile())}] [${paint("green", user ?? "?")}]`
        : `[${paint("yellow", "SYSTEM")}] [${paint("magenta", getFile())}]`;
    return `${context} [${text}]`;
}

function emit(writer, message, text, textColor) {
    const paint = makePaint();
    writer(format(message, textColor ? paint(textColor, text) : text, paint));
}

function log(message, text) {
    emit(console.log, message, text, null);
}

// Condição adversa prevista e tratada (permissão faltando, falha externa com retry) — não pede investigação no código
function warn(message, text) {
    emit(console.warn, message, text, "yellow");
}

// Falha inesperada que pede investigação (exceção não prevista, banco de dados, etc.)
function error(message, text) {
    emit(console.error, message, text, "red");
}

function matchPrefix(content, prefix) {
    const lowerPrefix = prefix.toLowerCase();
    if (!content.startsWith(lowerPrefix)) return null;

    const rest = content.slice(lowerPrefix.length);
    const isWordLike = /[a-z0-9]/i.test(lowerPrefix.at(-1));

    if (isWordLike && rest !== "" && !/\s/.test(rest[0])) return null;

    return rest.trim();
}

// Para colorir trechos de um log fora do utils
const paint = makePaint();

module.exports = { log, warn, error, matchPrefix, paint, monkeyEmbed, randomThumbnail };