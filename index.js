const private = require('./private.js');
const Discord = require('discord.js');
const client = new Discord.Client();

const defaults = {
	timeout: 30
};
var pollIndex = 0;

const emoji = {
	numbers: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
	letters: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
		.map(value => 'regional_indicator_' + value),
	yn: ['yes','no'],
	maybe: 'shrug'
};

function Poll(opt) {
	var args = opt.arguments;
	this.name = opt.name;
	this.id = pollIndex;
		pollIndex++;

	this.choices = {};
	opt.choices.forEach((value, index) => {
		this.choices[emoji[opt.emojiType][index]] = {
			name: value,
			votes: 0
		};
	});
	if(args.maybe || args.idk) {
		this.choices[emoji.maybe] = {
			name: 'I don\'t know.',
			votes: 0
		};
	}

	this.lock = args.lock || false;
	this.votedUsers = [];
	this.private = args.pvt || args.private || false;
	this.generateChart = args.chart || args.graph || false;
	this.reactionVoting = args.reactions || args.rxn || false;
	this.mult = this.reactionVoting || args.mult || args.multiple || false;
	this.role = args.role || false;
	this.footNote = opt.notes.trim() || '';

	this.open = false;
	this.totalVotes = 0;

	// Initiate timer
	this.startTimer = function() {
		this.open = true;
		setTimeout(function() {
			this.open = false;
		}.bind(this), opt.timeout * 60 * 1000);
	};

	// Log votes (if the poll is open and unlocked/user hasn't voted)
	this.vote = function(emoji, user) {
		if(this.open) {
			if(this.lock && this.votedUsers.findIndex(el => el === user) !== -1) {
				return "Sorry, this is a locked poll (you can't edit your vote) and you've already voted.";
			} else {
				this.choices[emoji].votes++;
				this.votedUsers.push(user);
				return `Great, I logged your vote for ${this.choices[emoji].name}!`;
			}
		} else {
			return "Sorry, this poll has timed out and can no longer be voted on.";
		}
	};
}

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
				choices: choices,
				emojiType: 'letters',
				timeout: defaults.timeout,
				arguments: {},
				role: false,
				notes: ''
			};

			// args should now just have the arguments
			args.forEach((arg, index) => {

				// If it's a new argument (starts with '--')
				if(arg.charAt(0) === '-' && arg.charAt(1) === '-') {

					// Remove '--'
					arg = arg.slice(2);

					if(arg === 'time' || arg === 'timeout') {
						let nextEl = args[index + 1];
						// If the next element is a nunber
						if(!isNaN(nextEl)) {
							options.timeout = +nextEl;
							args.slice(index + 1, 1);
						} else {
							let errorMessage = `A timeout argument was found, but the next item was not a number, so the poll defaulted to ${defaults.timeout} minutes. `;
							console.warn(errorMessage);
							options.notes += errorMessage;
						}

					} else if(arg === 'role') {
						let nextEl = args[index + 1];
						// If the next element is surrounded by double quotes
						if(args.find(el => el == 'rxn' || el === 'reactions')) {
							let errorMessage = `A "role" argument was found, but the reactions option was enabled, so voting can't be restricted to roles.`;
							console.warn(errorMessage);
							footNote += errorMessage;
						} else if(nextEl.charAt(0) === '"' && nextEl.charAt(nextEl.length - 1) === '"') {
							options.role = nextEl.slice(1, -1);
							args.slice(index + 1, 1);
						} else {
							let errorMessage = `A "role" argument was found, but the next item was not a string surrounded by "double quotes", so this was ignored. `;
							console.warn(errorMessage);
							options.notes += errorMessage;
						}

					} else if(arg === 'numbers' || arg === 'num') {
						if(choices.length <= emoji.numbers.length) {
							options.emojiType = 'numbers';
						} else {
							let errorMessage = `The poll was requested to be displayed with number icons, but there are only ten icons and ${choices.length} options were specified, so this was ignored. `;
							console.warn(errorMessage);
							options.notes += errorMessage;
						}

					} else if(arg === 'yesno' || arg === 'yn') {
						if(choices.length <= emoji.yn.length) {
							options.emojiType = 'yn';
						} else {
							let errorMessage = `The poll was requested to be displayed with yes/no icons, but too many (${choices.length}) options were specified, so this was ignored. `;
							console.warn(errorMessage);
							options.notes += errorMessage;
						}

					} else {
						options.arguments[arg] = true;
					}
				}
			});

			console.log(new Poll(options));

		} else {
			message.channel.send("Sorry, there was a problem with your messsage format. I was unable to make a poll.");
		}
	}
});

client.login(private.token);

