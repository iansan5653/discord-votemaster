# discord-votemaster
This is the beginnings of a complex polling bot for Discord, allowing for advanced polls with many options, vote restrictions, and even graphs of results. Messages will be formatting like so:

`!newpoll "poll name" [Choice 1, Choice 2] --yn|yesno --num|numbers --lock --pvt|private --time|timeout 5 --chart|graph --mult|multiple --rxn|reactions --maybe|idk --chnnl|restrictchannel --role "role"`


* `yn`: convert to a yes/no poll (has no effect if more than two options)
* `num`: convert to a number poll (1,2,3,4) (has no effect if more than 10 options)
* `lock`: answers cannot be edited even if there is time left. If everyone answers, poll ends immediately.
* `pvt`: answers are private (answer with DMs)
* `time #`: # = time in minutes before poll ends (defaults to 30)
* `chart`: generate a chart when the poll ends
* `mult`: allows for voting for multiple items (rather than just one each)
* `rxn`: vote by reactions instead of messages (enables mult)
* `maybe`: adds a 'maybe' option in addition to other choices
* `chnnl`: restricts to users in the current channel
* `role "role"`: restricts voting to users with a matching role

## Testing
To set up the bot on your machine, you will need Node.js installed. Clone the repo, follow the instructions in "private_example.js" and save as "private.js", add the bot to your server, and finally run `node index.js` in a command window in the folder with the code.