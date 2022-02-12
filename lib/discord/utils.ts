import axios from "axios";
import * as config from "../../config.json";
import { getSecret } from "../utils";
import { DiscordResponseData } from "./types";

export async function sendResponse(
  response: DiscordResponseData,
  interactionToken: string
): Promise<boolean> {
  const authToken = await getSecret(config.discordBot.secrets.authToken);
  const clientId = await getSecret(config.discordBot.secrets.clientId);
  const authConfig = {
    headers: {
      Authorization: `Bot ${authToken}`,
    },
  };

  try {
    let url = `https://discord.com/api/v8/webhooks/${clientId}/${interactionToken}`;
    return (await axios.post(url, response, authConfig)).status == 200;
  } catch (exception) {
    console.log(`There was an error posting a response: ${exception}`);
    return false;
  }
}
