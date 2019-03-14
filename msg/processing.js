/**
 * @file Message parsing and processing.
 */

/** Class representing a message, with information about message contents. */
class Message {
    /** 
     * Construct a new message and perform initial parsing.
     * @param {string} rawMessage The original message string.
    */
    constructor(rawMessage) {
        /** The original message string. */
        this.rawMessage = rawMessage
        let messageComponents = Message.breakMessage(this.rawMessage)

        /** The command associated with the message (first word in lowercase).*/
        this.command = messageComponents[0].toLowerCase()
        /** 
         * The rest of the message components as defined by
         * {@link Message.breakMessage}.
         */
        this.args = messageComponents.shift()
    }

    /**
     * Parse a raw message string and return its components.
     * Returns a parsed array with: anything in brackets, anything in quotes,
     * anything separated by spaces (in that hierarchy) 
     * @param {string} rawMessage The original message string.
     * @returns {[string]}
     */
    static breakMessage(rawMessage) {
        return this.rawMessage.content.trim().match(/(?:[^\s"\[]+|\[[^\[]*\]|"[^"]*")+/g);
    }
}