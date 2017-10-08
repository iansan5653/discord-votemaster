const private = require('./private.js');
const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if (message.content === 'ping') {
    message.reply('pong');
  } else if (message.content === 'Bye Votemaster!') {
  	// Useful for quitting when Nodemon is watching for changes
  	process.exit();
  }
});

client.login(private.token);