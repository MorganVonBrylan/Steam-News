

export const description = "Test a message";
export const options = [{
	type: STRING, name: "message", required: true,
	description: "The message content or embed to reply with.",
}];
export function run(inter) {
    let message = inter.options.getString("message");
    try {
        message = JSON.parse(message);
    } catch {
        message = { content: message.replaceAll("\\n", "\n") };
    }

    if("flags" in message)
    {
        if(message.flags instanceof Array)
        {
            if(!message.flags.includes("Ephemeral"))
                message.flags.push("Ephemeral");
        }
        else if(message.flags !== "Ephemeral")
            message.flags = [message.flags, "Ephemeral"];
    }
    else
        message.flags = "Ephemeral";

    inter.reply(message);
}
