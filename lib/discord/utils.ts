import {
  DiscordResponseData,
  getDiscordSecrets,
} from "@spenhand/discord-bot-cdk-construct";
import axios from "axios";

export async function sendResponse(
  response: DiscordResponseData,
  interactionToken: string
): Promise<boolean> {
  const discordSecret = await getDiscordSecrets();
  const authConfig = {
    headers: {
      Authorization: `Bot ${discordSecret?.authToken}`,
    },
  };

  try {
    let url = `https://discord.com/api/v8/webhooks/${discordSecret?.clientId}/${interactionToken}`;
    return (await axios.post(url, response, authConfig)).status == 200;
  } catch (exception) {
    console.log(`There was an error posting a response: ${exception}`);
    return false;
  }
}
