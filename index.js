const private = require('./private.js');
const Discord = require('discord.js');
const client = new Discord.Client();

const defaults = {
	timeout: 30
};

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
	// Array with: anything in brackets, anything in quotes, anything separated by spaces (in that hierarchy)
	var args = message.content.trim().match(/(?:[^\s"\[]+|\[[^\[]*\]|"[^"]*")+/g);

	if(args.shift().toLowerCase() === '!newpoll') {
		// Do a little format checking to make sure (first argument, title, should be in quotes, and second argument, choices, should be in brackets)
		if(args[0].charAt(0) !== '"' || args[0].charAt(-1) !== '"' || args[1].charAt(0) !== '[' || args[0].charAt(-1) !== ']') {
			
			// Title of the poll, without quotes
			var title = args.shift().slice(1, -1);
			// Array of poll choices, trimmed
			var choices = args.shift().slice(1, -1).split(',').map(Function.prototype.call, String.prototype.trim);
			var options = {
				title: title,
				choices: choices
			};

			// footNote will be used to store any error messsages/supplementary information
			var footNote;

			// args should now just have the arguments
			args.forEach((arg, index) => {

				// If it's a new argument (starts with '--')
				if(arg.charAt(0) === '-' && arg.charAt(1) === '-') {

					// Remove '--'
					arg = arg.slice(2);

					if(arg === 'time') {
						let nextEl = args[index + 1];
						// If the next element is a nunber
						if(!isNaN(nextEl)) {
							options.timeout = +nextEl;
						} else {
							let errorMessage = `A "time" argument was found, but the next item was not a number, so the poll defaulted to ${defaults.timeout} minutes. `;
							console.warn(errorMessage);
							footNote += errorMessage;
							options.timeout = defaults.timeout;
						}

					} else if(arg === 'role') {
						let nextEl = args[index + 1];
						// If the next element is surrounded by double quotes
						if(nextEl.charAt(0) === '"' && nextEl.charAt(nextEl.length - 1) === '"') {
							options.role = nextEl.slice(1, -1);
						} else {
							let errorMessage = `A "role" argument was found, but the next item was not a string surrounded by "double quotes", so this was ignored. `;
							console.warn(errorMessage);
							footNote += errorMessage;
						}

					} else {
						options[arg] = true;
					}
				}
			});

			console.log(options);

		} else {
			message.channel.send("Sorry, there was a problem with your messsage format. I was unable to make a poll.");
		}
	}
});

client.login(private.token);

