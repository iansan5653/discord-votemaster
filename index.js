const private = require('./private.js');
const Discord = require('discord.js');
const client = new Discord.Client();
const messageProcessing = require('./msg/processing.js');
const messageBuilding = require('./msg/building.js');

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
        setTimeout(function () {
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
        const args = message.argStrings;

        if (message.command === defaults.triggers.newPoll) {
            if (
                message.args.length >= 2 &&
                message.args[0].type === messageProcessing.ARGUMENT_TYPES.STRING &&
                message.args[1].type === messageProcessing.ARGUMENT_TYPES.LIST
            ) {
                // Title of the poll, without quotes
                const title = message.args[0].parsed;
                // Array of poll choices, trimmed
                const choices = message.args[1].parsed;
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

                for (let i = 2; i < message.args.length; i++) {
                    const arg = message.args[i];
                    const nextArg = message.args[i + 1] || null;

                    if (arg.type === messageProcessing.ARGUMENT_TYPES.FLAG) {
                        switch (arg.parsed) {
                        case 'time':
                        case 'timeout':
                            if (nextArg &&
                                nextArg.type === messageProcessing.ARGUMENT_TYPES.NUMBER &&
                                nextArg.parsed > 0) {
                                options.timeout = nextArg.parsed;
                            } else {
                                const errorMessage = `A timeout argument was found, but the next item was not a valid number, so the poll defaulted to ${defaults.timeout} minutes. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                            break;

                        case 'color':
                        case 'colour':
                            if (nextArg &&
                                nextArg.type === messageProcessing.ARGUMENT_TYPES.NUMBER &&
                                nextArg.parsed >= 0 &&
                                nextArg.parsed <= 256**3
                            ) {
                                options.color = nextArg.parsed;
                            } else {
                                const errorMessage = `A color argument was found, but the next item was not a valid RGB int code, so this was ignored.`;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                            break;

                        case 'role':
                            if (mesage.args.find(a => a.parsed == 'rxn' || a.parsed === 'reactions')) {
                                const errorMessage = `A "role" argument was found, but the reactions option was enabled, so voting can't be restricted to roles.`;
                                console.warn(errorMessage);
                                footNote += errorMessage;
                            } else if (nextArg && nextArg.type === messageProcessing.ARGUMENT_TYPES.STRING) {
                                options.role = nextArg.parsed;
                            } else {
                                const errorMessage = `A "role" argument was found, but the next item was not a valid parameter, so this was ignored. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                            break;

                        case 'numbers':
                        case 'num':
                            if (choices.length <= emoji.numbers.length) {
                                options.emojiType = 'numbers';
                            } else {
                                const errorMessage = `The poll was requested to be displayed with number icons, but there are only ten icons and ${choices.length} options were specified, so this was ignored. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                            break;

                        case 'yesno':
                        case 'yn':
                            if (choices.length <= emoji.yn.length) {
                                options.emojiType = 'yn';
                            } else {
                                const errorMessage = `The poll was requested to be displayed with yes/no icons, but too many (${choices.length}) options were specified, so this was ignored. `;
                                console.warn(errorMessage);
                                options.notes += errorMessage;
                            }
                            break;

                        default:
                            options.arguments[arg] = true;
                        }
                    }
                }

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
            const activePollsInServer = polls.filter(poll =>
                poll.open && poll.server === discordMessage.guild);
            let voteResponse;

            if (activePollsInServer.length === 0) {
                voteResponse = `There aren't any active polls in this server right now, so you can't vote.`;
            } else if (message.args.length === 0) {
                voteResponse = 'You need to provide a poll ID and vote value to vote.';
            } else if (activePollsInServer.length > 1 &&
                message.args[0].type !== messageProcessing.ARGUMENT_TYPES.NUMBER) {
                voteResponse = 'To vote, you need to specify a poll id.';
            } else if ((activePollsInServer.length === 1 && message.args[0].type !== messageProcessing.ARGUMENT_TYPES.OTHER) ||
                message.args[1].type !== messageProcessing.ARGUMENT_TYPES.OTHER) {
                voteResponse = 'To vote, you need to specify a vote.';
            } else if (activePollsInServer.length === 1 && message.args[0].type === messageProcessing.ARGUMENT_TYPES.OTHER) {
                voteResponse = polls.get(activePollsInServer[0]).vote(message.args[0].parsed.toLowerCase(), discordMessage.author).message;
            } else if (!activePollsInServer.includes(message.args[0].parsed)) {
                voteResponse = 'That poll either doesn\'t exist or isn\'t currently active, so you can\'t vote on it.';
            } else {
                voteResponse = polls.get(message.args[0].parsed).vote(args[1].toLowerCase(), discordMessage.author).message;
            }

            discordMessage.channel.send(voteResponse);
        } else if (message.command == defaults.triggers.results) {
            if (!message.args[0] || !message.args[0].type === messageProcessing.ARGUMENT_TYPES.NUMBER) {
                discordMessage.channel.send('Please specify the poll id number using a pound sign and number (ie \'!results #1\').');
            } else {
                const pollID = message.args[0].parsed;

                if (polls.get(pollID)) {
                    let embed;
                    if (message.args[1] && (message.args[1].parsed === 'detailed' || message.args[1].parsed === 'users')) {
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
            discordMessage.channel.send('Pong!'); // for testing connection
        }
    }
});

client.login(private.token);
