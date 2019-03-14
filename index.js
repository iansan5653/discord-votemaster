const private = require('./private.js');
const Discord = require('discord.js');
const client = new Discord.Client();
const messageProcessing = require('msg/processing.js');
const messageBuilding = require('msg/building.js');

const defaults = {
    timeout: 30,
    color: 2555834,
    triggers: {newPoll: '!newpoll', vote: '!vote', results: '!results'},
    appName: 'Votemaster'
};
let pollIndex = 0;
const polls = new Map();

/**
 * The corresponding emojis are used as unique keys for choices within each
 * poll object.
 */
const emoji = {
    numbers: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
        .map((value, index) => [String(index), `:${value}:`]),
    letters: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
        .map(value => [value, `:regional_indicator_${value}:`]),
    yn: [['yes', '**Yes**'], ['no', '**No**']],
    maybe: ['maybe', '**Maybe**']
};

const EMBED_TYPES = Object.freeze({
    POLL: Symbol('Poll Embed Type'),
    RESULTS: Symbol('Results Embed Type'),
    DETAIL_RESULTS: Symbol('Detailed Results Embed Type')
});

/** Class representing a single poll. */
class Poll {
    /**
     * Create a new poll with an options object.
     * @param {Object} opt
     */
    constructor(opt) {
        const args = opt.arguments;
        this.name = opt.name;
        this.id = pollIndex;
        pollIndex++;

        this.choices = new Map();
        opt.choices.forEach((value, index) => {
            this.choices.set(emoji[opt.emojiType][index][0], {
                name: value,
                emoji: emoji[opt.emojiType][index][1],
                votes: 0
            });
        });
        if (args.maybe || args.idk) {
            this.choices.set(emoji.maybe[0], {
                name: 'I don\'t know.',
                emoji: emoji.maybe[1],
                votes: 0
            });
        }

        this.disallowEdits = args.lock || false;
        this.blind = args.blind || false;
        this.reactionVoting = args.reactions || args.rxn || false;
        this.allowMultipleVotes = this.reactionVoting || args.mult || args.multiple || false;
        this.restrictRole = args.role || false;
        this.dontCloseEarly = args.lo || args.leaveopen || args.dontcloseearly || false;
        this.timeout = opt.timeout || 30;
        this.color = opt.color;

        this.footNote = opt.notes || ' ';
        this.footNote += `${opt.notes ? '| ' : ''}This is Poll #${this.id}. It will expire in ${this.timeout} minutes.`;

        this.open = false;
        this.totalVotes = 0;

        this.voters = new Map();

        this.server = opt.server;

        this.timeCreated = new Date();
    }

    /** Function to initiate timer */
    startTimer() {
        this.open = true;
        setTimeout(function() {
            this.open = false;
        }.bind(this), this.timeout * 60 * 1000);
    }

    /**
     * Log votes (if the poll is open and unlocked/user hasn't voted)
     * @param {string} key
     * @param {string} user
     * @return {Object}
     */
    vote(key, user) {
        console.log(key, this.choices);
        if (this.open) {
            if (this.lock && this.voters.get(user.id)) {
                return {
                    success: false,
                    reason: 'lock',
                    message: 'Sorry, this is a locked poll (you can\'t edit your vote) and you\'ve already voted.'
                };
            } else if (!this.choices.get(key)) {
                return {
                    success: false,
                    reason: 'invalid',
                    message: 'That option is not a valid choice, so I can\'t log your vote. Try sending just the letter, number, or word that corresponds with the choice.'
                };
            } else if (this.voters.get(user.id)) {
                // User has already voted, we need to change their vote
                const oldVoter = this.voters.get(user.id);
                this.choices.get(oldVoter.vote.choice).votes--;

                this.choices.get(key).votes++;
                this.voters.set(user.id, {
                    user: user,
                    vote: {
                        time: new Date(),
                        choice: key
                    }
                });
                return {
                    success: true,
                    reason: '',
                    message: `Great, I changed your vote to "${this.choices.get(key).name}"!`
                };
            } else {
                this.choices.get(key).votes++;
                // While we technically *could* use the user object as the key, that would be difficult to access. id should be unique.
                this.voters.set(user.id, {
                    user: user,
                    vote: {
                        time: new Date(),
                        choice: key
                    }
                });
                return {
                    success: true,
                    reason: '',
                    message: `Great, I logged your vote for "${this.choices.get(key).name}"!`
                };
            }
        } else {
            return {
                sucess: false,
                reason: 'timeout',
                message: 'Sorry, this poll has timed out and can no longer be voted on.'
            };
        }
    }

    /**
     * Close the poll.
     * @return {bool} True if the poll was closed (if it was still open).
     */
    close() {
        // Calling close() on a closed poll has no effect
        if (this.open) {
            this.open = false;
            return true;
        } else return false;
    }

    /**
     * Generate a chart. Doesn't work.
     * @return {null}
     */
    get chart() {
        // TODO generate charts of results
        return null;
    }
}

/**
 * Generate the Discord fancy embed object.
 * @param {Poll} poll Poll object.
 * @param {Symbol} type Type of embed.
 * @return {Object}
 */
function generateDiscordEmbed(poll, type) {
    let embed = {};
    let choiceList = ``;
    let resultsList = ``;
    poll.choices.forEach((choice, key) => {
        choiceList += `${choice.emoji} - ${choice.name} \n`;
        resultsList += `***${choice.votes} votes*** \n`;
    });

    switch (type) {
    case EMBED_TYPES.POLL:
        embed = {
            title: `Poll ${poll.id}: ${poll.name}`,
            description: `To vote, reply with\`!vote choice\` within the next ${poll.timeout} minutes. For example, "!vote ${poll.choices.keys().next().value}". If multiple polls are open, you\'ll have to specify which one using its number and a pound sign: \`!vote #${poll.id} choice\`.`,
            color: poll.color,
            timestamp: poll.timeCreated,
            footer: {
                text: poll.footNote
            },
            author: {
                name: defaults.appName
            },
            fields: [{
                name: `Choices:`,
                value: choiceList
            }]
        };
        break;
    case EMBED_TYPES.RESULTS:
        // TODO: Order choices in results based on number of votes

        embed = {
            title: `*Results* - Poll ${poll.id}: ${poll.name}`,
            description: poll.open ? `This poll is still open, so these results may change.` : `This poll has closed and cannot be voted on.`,
            color: poll.color,
            timestamp: new Date(),
            footer: {
                text: `For more detailed results, use the \`--users\` flag.`
            },
            author: {
                name: defaults.appName
            },
            fields: [{
                name: `Choices:`,
                value: choiceList,
                inline: true
            }, {
                name: `Results:`,
                value: resultsList,
                inline: true
            }]
        };
        break;
    case EMBED_TYPES.DETAIL_RESULTS:
        // TODO: Order choices in results based on number of votes

        embed = {
            title: `*Results* - Poll ${poll.id}: ${poll.name}`,
            description: poll.open ? `This poll is still open, so these results may change.` : `This poll has closed and cannot be voted on.`,
            color: poll.color,
            timestamp: new Date(),
            footer: {
                text: `We don't have detailed results capability yet.`
            },
            author: {
                name: defaults.appName
            },
            fields: [{
                name: `Choices:`,
                value: choiceList,
                inline: true
            }, {
                name: `Results:`,
                value: resultsList,
                inline: true
            }]
        };
    }

    return embed;
}

client.on('ready', () => {
    console.log('I am ready!');
});

client.on('message', discordMessage => {
    if (discordMessage.content) {
        const message = new messageProcessing.Message(discordMessage.content);
        const args = message.args;
        if (message.command === defaults.triggers.newPoll) {
            // Do a little format checking to make sure (first argument, title, should be in quotes, and second argument, choices, should be in brackets)
            if (
                args.length > 1 &&
                args[0].charAt(0) === '"' &&
                args[0].charAt(args[0].length - 1) === '"' &&
                args[1].charAt(0) === '[' &&
                args[1].charAt(args[1].length - 1) === ']'
            ) {
                // Title of the poll, without quotes
                const title = args.shift().slice(1, -1);
                // Array of poll choices, trimmed
                const choices = args.shift().slice(1, -1).split(',').map(Function.prototype.call, String.prototype.trim);
                const options = {
                    name: title,
                    choices: choices,
                    emojiType: 'letters',
                    timeout: defaults.timeout,
                    color: defaults.color,
                    arguments: {},
                    role: false,
                    notes: '',
                    server: discordMessage.guild
                };

                // args should now just have the arguments
                args.forEach((arg, index) => {
                    // If it's a new argument (starts with '--')
                    if (arg.charAt(0) === '-' && arg.charAt(1) === '-') {
                        // Remove '--'
                        arg = arg.slice(2);

                        if (arg === 'time' || arg === 'timeout') {
                            const nextEl = args[index + 1];
                            // If the next element is a nunber
                            if (!isNaN(nextEl) && nextEl > 0) {
                                options.timeout = +nextEl;
                                args.slice(index + 1, 1);
                            } else {
                                const errorMessage = `A timeout argument was found, but the next item was not a valid number, so the poll defaulted to ${defaults.timeout} minutes. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                        } else if (arg === 'color' || arg === 'colour') {
                            const nextEl = args[index + 1];
                            // If the next element is a valid RGB int code
                            if (!isNaN(nextEl) && +nextEl >= 0 && +nextEl <= 256 * 256 * 256) {
                                options.color = +nextEl;
                                args.slice(index + 1, 1);
                            } else {
                                const errorMessage = `A color argument was found, but the next item was not an RGB int code, so this was ignored.`;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                        } else if (arg === 'role') {
                            const nextEl = args[index + 1];
                            // If the next element is surrounded by double quotes
                            if (args.find(el => el == 'rxn' || el === 'reactions')) {
                                const errorMessage = `A "role" argument was found, but the reactions option was enabled, so voting can't be restricted to roles.`;
                                console.warn(errorMessage);
                                footNote += errorMessage;
                            } else if (nextEl.charAt(0) === '"' && nextEl.charAt(nextEl.length - 1) === '"') {
                                options.role = nextEl.slice(1, -1);
                                args.slice(index + 1, 1);
                            } else {
                                const errorMessage = `A "role" argument was found, but the next item was not a string surrounded by "double quotes", so this was ignored. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                        } else if (arg === 'numbers' || arg === 'num') {
                            if (choices.length <= emoji.numbers.length) {
                                options.emojiType = 'numbers';
                            } else {
                                const errorMessage = `The poll was requested to be displayed with number icons, but there are only ten icons and ${choices.length} options were specified, so this was ignored. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                        } else if (arg === 'yesno' || arg === 'yn') {
                            if (choices.length <= emoji.yn.length) {
                                options.emojiType = 'yn';
                            } else {
                                const errorMessage = `The poll was requested to be displayed with yes/no icons, but too many (${choices.length}) options were specified, so this was ignored. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                        } else {
                            options.arguments[arg] = true;
                        }
                    }
                });

                const newPoll = new Poll(options);
                newPoll.startTimer();
                polls.set(newPoll.id, newPoll);

                const embed = generateDiscordEmbed(newPoll, 'poll');
                discordMessage.channel.send('OK, here\'s your poll:', {embed});
            } else {
                console.error('Message format was invalid.');
                discordMessage.channel.send(`Poll requests must at minimum include a title (in "double quotes") and a set of options (in [square brackets], separated by commas). For example, try \`${defaults.triggers.newPoll} "What is your favorite shade of red?" [dark red, medium red, light red]\`.`);
            }
        } else if (message.command == defaults.triggers.vote) {
            const activePollsInServer = [];
            let voteResponse;
            polls.forEach(poll => {
                if (poll.open && poll.server == discordMessage.guild) {
                    activePollsInServer.push(poll.id);
                }
            });

            if (activePollsInServer.length === 0) {
                voteResponse = `There aren't any active polls in this server right now, so you can't vote.`;
            } else if (args[0].charAt(0) !== '#') {
                // Only the vote was supplied
                if (activePollsInServer.length === 1) {
                    voteResponse = polls.get(activePollsInServer[0]).vote(args[0].toLowerCase(), discordMessage.author).message;
                } else {
                    // TODO dynamic examples
                    voteResponse = 'Sorry, I don\'t know which poll to vote on. Please specify the poll id number using a pound sign and a number (ie \'!vote #1 A\') before your vote.';
                }
            } else {
                // The ID and vote were supplied
                const pollID = +(args[0].substr(1));

                if (activePollsInServer.includes(pollID)) {
                    voteResponse = polls.get(pollID).vote(args[1].toLowerCase(), discordMessage.author).message;
                } else {
                    // TODO dynamic examples
                    voteResponse = 'Sorry, that\'s not a valid poll to vote on. Please specify the poll id number (ie \'!vote #1 A\') before your vote.';
                }
            }

            discordMessage.channel.send(voteResponse);
        } else if (message.command == defaults.triggers.results) {
            if (args[0].charAt(0) !== '#') {
                discordMessage.channel.send('Sorry, I don\'t know which poll to get results for. Please specify the poll id number using a pound sign and number (ie \'!results #1\').');
            } else {
                const pollID = +(args[0].substr(1));

                if (polls.get(pollID)) {
                    let embed;
                    if (args[1] && (args[1].slice(2) === 'detailed' || args[1].slice(2) === 'users')) {
                        embed = generateDiscordEmbed(polls.get(pollID), 'detailResults');
                    } else {
                        embed = generateDiscordEmbed(polls.get(pollID), 'results');
                    }

                    discordMessage.channel.send('OK, here\'s the results:', {embed});
                } else {
                    discordMessage.channel.send('Sorry, that poll doesn\'t seem to exist.');
                }
            }
        } else if (message.command == '!pollping') {
            discordMessage.channel.send('PONG!'); // for testing connection
        }
    }
});

client.login(private.token);
