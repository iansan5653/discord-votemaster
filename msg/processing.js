/**
 * @file Message parsing and processing.
 */

/**
 * Possible argument types.
 * @type {Object.<string, Symbol>}
 */
const ARGUMENT_TYPES = Object.freeze({
    /** String argument type. */
    STRING: Symbol('String Argument Type'),
    /** Number argument type. */
    NUMBER: Symbol('Number Argument Type'),
    /** List argument type. */
    LIST: Symbol('List Argument Type'),
    /** Flag argument type. */
    FLAG: Symbol('Flag Argument Type'),
    /** Unknown argument type. */
    OTHER: Symbol('Unknown Argument Type')
});

/**
 * @typedef {Symbol} ArgumentType A value in {@link ARGUMENT_TYPES}.
 */


/** Class representing a message, with information about message contents. */
class Message {
    /**
     * Construct a new message and perform initial parsing.
     * @param {string} rawMessage The original message string.
    */
    constructor(rawMessage) {
        /** The original message string. */
        this.raw = rawMessage;
        const messageComponents = Message.breakComponents(this.raw);

        /** The command associated with the message (first word in lowercase).*/
        this.command = messageComponents[0].toLowerCase();
        /**
         * The rest of the message components as defined by
         * {@link Message.breakMessage}.
         */
        this.argStrings = messageComponents.shift();
        /** Arguments with usable data. @type {[MessageArg]} */
        this.args = this.argStrings.map(arg => new MessageArg(arg));
    }

    /**
     * Parse a raw message string and return its components.
     * Returns a parsed array with: anything in brackets, anything in quotes,
     * anything separated by spaces (in that hierarchy).
     * @param {string} rawMessage The original message string.
     * @return {[string]}
     */
    static breakComponents(rawMessage) {
        return rawMessage.content.trim().match(/(?:[^\s"\[]+|\[[^\[]*\]|"[^"]*")+/g);
    }
}

/** Class representing a message argument. Has a type defined by some rules. */
class MessageArg {
    /**
     * Construct a new MessageArg and determine its type.
     * @param {string} rawArgument The unprocessed argument.
     */
    constructor(rawArgument) {
        /** The unprocessed string argument. */
        this.raw = rawArgument;
    }

    /**
     * The type of argument.
     * @see {@link MessageArg.determineType} for details.
     * @return {ArgumentType}
     */
    get type() {
        return MessageArg.determineType(this.raw);
    }

    /**
     * Usable value. Exact form depends on type.
     * @see {@link MessageArg.parse} for details.
     * @return {*}
     */
    get parsed() {
        return MessageArg.parse(this.raw);
    }

    /**
     * Determine the type of the argument based on some rules. Does NOT eval the
     * string or parse anything.
     * @param {string} rawArgument String representing the original argument.
     * @return {ArgumentType}
     */
    static determineType(rawArgument) {
        if (
            (rawArgument.charAt(0) === '"' && rawArgument.charAt(1) === '"') ||
            (rawArgument.charAt(0) === '\'' && rawArgument.charAt(1) === '\'')
        ) {
            return ARGUMENT_TYPES.STRING;
        }

        if (rawArgument.charAt(0) === '#' && +rawArgument.substring(1) !== NaN) {
            return ARGUMENT_TYPES.NUMBER;
        }

        if (rawArgument.substring(0, 1) === '--') {
            return ARGUMENT_TYPES.FLAG;
        }

        if (
            (rawArgument.charAt(0) === '[' && rawArgument.charAt(1) === ']') ||
            (rawArgument.charAt(0) === '(' && rawArgument.charAt(1) === ')')
        ) {
            return ARGUMENT_TYPES.LIST;
        }

        return ARGUMENT_TYPES.OTHER;
    }

    /**
     * Parse the argument and return a usable value.
     * Return type varies based on argument `type`. Will assume that `type` is
     * correct even if it makes no sense. For example, if given a number but a
     * type of 'string', will treat as a string and remove first and last
     * character anyway. In other words, will not verify `type`.
     * @param {string} rawArgument The unparsed argument.
     * @param {ArgumentType} [type] Type of argument. If not provided, will
     *   determine.
     * @return {*}
     */
    static parse(rawArgument, type) {
        if (!type) type = MessageArg.determineType(rawArgument);

        switch (type) {
        case ARGUMENT_TYPES.STRING:
            return rawArgument.substring(1, rawArgument.length - 1);
        case ARGUMENT_TYPES.NUMBER:
            return +rawArgument.substring(1);
        case ARGUMENT_TYPES.LIST:
            return rawArgument.substring(1, rawArgument.length - 1)
                .split(',').map(val => val.trim());
        case ARGUMENT_TYPES.FLAG:
            return rawArgument.substring(2);
        }
        return rawArgument;
    }
}

exports.Message = Message;
exports.MessageArg = Message;
