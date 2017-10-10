const private = require('./private.js');
const Discord = require('discord.js');
const client = new Discord.Client();

const defaults = {
	timeout: 30,
	color: 2555834,
	trigger: '!newpoll'
};
var pollIndex = 0;

// The corresponding emojis are used as unique keys for choices within each poll object
const emoji = {
	numbers: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
	letters: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
		.map(value => 'regional_indicator_' + value),
	yn: ['yes','no'],
	maybe: 'shrug'
};

class Poll {
	constructor(opt) {
		var args = opt.arguments;
		this.name = opt.name;
		this.id = pollIndex;
			pollIndex++;

		// Choices is a map so it can be easily iterated
		this.choices = new Map();
		opt.choices.forEach((value, index) => {
			this.choices.set(emoji[opt.emojiType][index], {
				name: value,
				votes: 0
			});
		});
		if(args.maybe || args.idk) {
			this.choices.set(emoji.maybe, {
				name: 'I don\'t know.',
				votes: 0
			});
		}

		this.disallowEdits = args.lock || false;
		this.blind = args.blind || false;
		this.chartRequested = args.chart || args.graph || false;
		this.reactionVoting = args.reactions || args.rxn || false;
		this.allowMultipleVotes = this.reactionVoting || args.mult || args.multiple || false;
		this.restrictRole = args.role || false;
		this.dontCloseEarly = args.lo || args.leaveopen || args.dontcloseearly || false;

		this.footNote = opt.notes || ' ';
		this.footNote += `This is Poll \`${this.id}\`.`;

		this.open = false;
		this.totalVotes = 0;

		this.voters = new Map();
	}

	// Function to initiate timer
	startTimer() {
		this.open = true;
		setTimeout(this.close().bind(this), opt.timeout * 60 * 1000);
	}

	// Log votes (if the poll is open and unlocked/user hasn't voted)
	vote(emoji, user) {
		if(this.open) {
			if(this.lock && this.voters.get(user.id)) {
				return {
					success: false,
					reason: 'lock',
					message: "Sorry, this is a locked poll (you can't edit your vote) and you've already voted."
				};
			} else {
				this.choices.get(emoji).votes++;
				// While we technically *could* use the user object as the key, that would be difficult to access. id should be unique.
				this.voters.set(user.id, {
					user: user,
					vote: {
						time: new Date(),
						choice: emoji
					}
				});
				return {
					success: true,
					reason: '',
					message: `Great, I logged your vote for ${this.choices.get(emoji).name}!`
				};
			}
		} else {
			return {
				sucess: false,
				reason: 'timeout',
				message: "Sorry, this poll has timed out and can no longer be voted on."
			};
		}
	}

	close() {
		// Calling close() on a closed poll has no effect
		if(this.open) {
			this.open = false;
			return true;
		} else return false;
	}

	generateChart() {
		// TODO generate charts of results
		return null;
	}
}

client.on('ready', () => {
	console.log('I am ready!');
});

client.on('message', message => {
	// Array with: anything in brackets, anything in quotes, anything separated by spaces (in that hierarchy)
	var args = message.content.trim().match(/(?:[^\s"\[]+|\[[^\[]*\]|"[^"]*")+/g);

	if(args.shift().toLowerCase() === defaults.trigger) {
		// Do a little format checking to make sure (first argument, title, should be in quotes, and second argument, choices, should be in brackets)
		if(
			args.length > 1 &&
			args[0].charAt(0) === '"' &&
			args[0].charAt(args[0].length - 1) === '"' &&
			args[1].charAt(0) === '[' &&
			args[1].charAt(args[1].length - 1) === ']'
		) {
			
			// Title of the poll, without quotes
			var title = args.shift().slice(1,-1);
			// Array of poll choices, trimmed
			var choices = args.shift().slice(1,-1).split(',').map(Function.prototype.call, String.prototype.trim);
			var options = {
				name: title,
				choices: choices,
				emojiType: 'letters',
				timeout: defaults.timeout,
				color: defaults.color,
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
						if(!isNaN(nextEl) && nextEl > 0) {
							options.timeout = +nextEl;
							args.slice(index + 1, 1);
						} else {
							let errorMessage = `A timeout argument was found, but the next item was not a valid number, so the poll defaulted to ${defaults.timeout} minutes. `;
							console.warn(errorMessage);
							options.notes += errorMessage;
						}

					} else if(arg === 'color' || arg === 'colour') {
						let nextEl = args[index + 1];
						// If the next element is a valid RGB int code
						if(!isNaN(nextEl) && +nextEl >= 0 && +nextEl <= 256*256*256) {
							options.color = +nextEl;
							args.slice(index + 1, 1);
						} else {
							let errorMessage = `A color argument was found, but the next item was not an RGB int code, so this was ignored.`;
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
			console.error("Message format was invalid.");
			message.channel.send(`Poll requests must at minimum include a title (in "double quotes") and a set of options (in [square brackets], separated by commas). For example, try \`${defaults.trigger} "What is your favorite shade of red?" [dark red, medium red, light red]\`.`);
		}
	}
});

client.login(private.token);

