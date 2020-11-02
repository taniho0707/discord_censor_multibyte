'use strict';

const fs = require("fs");
const config = require("config");
const log4js = require("log4js");
const Discord = require("discord.js");
const sqlite3 = require('sqlite3').verbose();

const client = new Discord.Client();

const helpmessage = "\
NOBODY CAN USE MULTIBYTE\n\
/mbsummary view summary\n\
/mbhelp view this message";

log4js.configure(config.log4js);
const defaultLogger = log4js.getLogger('default');
const debugLogger = log4js.getLogger('debug');
const errorLogger = log4js.getLogger('error');
process.on('unhandledRejection', errorLogger.error);
defaultLogger.info('run discord_censor_multibyte bot');


// Databases
var dbSummary;


// Load Configs and Token
let token = '';
let channelid = '';
const secret = JSON.parse(fs.readFileSync(config.secretPath));
if (fs.existsSync(config.secretPath)) {
    token = secret.token;
    channelid = secret.channelid;
} else {
    errorLogger.error('Not found secret file');
    process.exit(1);
}


// Status
var messageLogStatus;
var fetchingMessages;


function openOrCreateDatabase() {
    dbSummary = new sqlite3.Database('summary.sqlite');
    dbSummary.serialize(() => {
        dbSummary.run('CREATE TABLE IF NOT EXISTS summary (username TEXT PRIMARY KEY, date NUMERIC, comment TEXT)');
    });
    defaultLogger.info("Open database");
}

function closeDatabase() {
    dbSummary.close();
    defaultLogger.info("Close database");
}


// Multibyteかどうか判定する
function isMultibyte(text) {
    if (text.match(/([^\x00-\x7F])/) === null) {
        return false;
    } else {
        return true;
    }
}

// 検閲のサマリーを表示する
function getSummary(callback) {
    dbWord.get("SELECT COUNT(username) FROM summary", [], (err, row) => {
        if (err) {
            errorLogger.error(err);
        } else {
            let status = "[censor_multibyte status]\n";
            status += row['COUNT(username)'];
            defaultLogger.info(status);
            callback(status);
        }
    });
}

// 検閲ログを追加する
function addCensoredLog(username, content, date) {
    defaultLogger.info("@" + username.username + " said \"" + content + "\" at " + date);
    dbSummary.run("INSERT OR REPLACE INTO summary VALUES (?,?,?)", [username.username, date, content]);
}


client.on('ready', () => {
    defaultLogger.info('discord_censor_multibyte bot started');
});

client.on('message', message => {
    if (message.content === "/mbhelp") {
        message.channel.send(helpmessage);
    } else if (message.content === "/mbsummary") {
        getSummary((msg) => {
            message.channel.send(msg);
        });
    } else {
        if (isMultibyte(message.content)) {
            // 投稿を削除し、エラーコメントを返信
            let username = message.author;
            let date = message.createdTimestamp;
            let content = message.content;
            addCensoredLog(username, content, date);
            let deletelog = "The message has been deleted.";
            message.reply(deletelog);
            message.delete()
                .then(msg => console.log(`Deleted message from ${msg.author.username}`))
                .catch(console.error);
        } else {
            // Multibyteが含まれていないので何もしない
        }
    }
});


// 終了前処理
process.on('exit', function (code) {
    closeDatabase();
    defaultLogger.info('exit program');
    defaultLogger.info('return code: ' + code);
});
process.on('SIGINT', function () {
    process.exit();
});


openOrCreateDatabase();

client.login(token);
