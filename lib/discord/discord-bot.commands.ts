import { Context, Callback } from "aws-lambda";
import {
  DiscordEventRequest,
  DiscordResponseData,
  verifyEvent,
} from "@spenhand/discord-bot-cdk-construct";
import { Embed } from "slash-commands";
import { sendResponse } from "./utils";
import { getCurrentServerIP, updateServerConfiguration } from "../api/utils";

const REGION = process.env.REGION;
const SERVICE_NAME = process.env.SERVICE_NAME;
const CLUSTER_ARN = process.env.CLUSTER_ARN;

/**
 * The actual handler for the lambda.
 * @param {DiscordEventRequest} event The incoming event to handle.
 * @param {Context} context The context to handle.
 * @param {Callback} callback The callback to run for this.
 * @return {string} A simple status code of what was run.
 */
export async function handler(
  event: DiscordEventRequest,
  context: Context,
  callback: Callback
): Promise<string> {
  console.log("Running Discord command handler...");

  if (await verifyEvent(event)) {
    const response = await handleCommand(event);
    console.log("Sending response...");
    if (
      event.jsonBody.token &&
      (await sendResponse(response, event.jsonBody.token))
    ) {
      console.log("Responded successfully!");
    } else {
      console.log("Failed to send response!");
    }
  } else {
    console.log("Invalid request!");
  }
  return "200";
}

/**
 * Handles an incoming command for a user.
 * @param {DiscordEventRequest} event The incoming event with the command to handle.
 * @return {DiscordResponseData} Returns a response that can be outputted to the user.
 */
export async function handleCommand(
  event: DiscordEventRequest
): Promise<DiscordResponseData> {
  console.log("Pre handle");
  if (!REGION || !SERVICE_NAME || !CLUSTER_ARN) {
    return generateStandardResponse("Lambda incorrectly configured");
  }
  console.log("Handle command");

  if (event.jsonBody.member) {
    switch (event.jsonBody.data?.name) {
      case "status":
        console.log("Status command");
        const currentIp = await getCurrentServerIP(
          REGION,
          SERVICE_NAME,
          CLUSTER_ARN
        );
        if (currentIp) {
          return generateStandardResponse(
            "Server is online at IP: " + currentIp
          );
        }
        return generateStandardResponse(
          "Server is offline. Use '/start' to start it."
        );
      case "start":
        console.log("Start command");
        const startSuccess = await updateServerConfiguration(
          REGION,
          SERVICE_NAME,
          CLUSTER_ARN,
          1 // desired count
        );
        if (startSuccess) {
          return generateStandardResponse("Service updated to start server.");
        }

        return generateStandardResponse("Unable to update service");
      case "stop":
        console.log("Start command");
        const stopSuccess = await updateServerConfiguration(
          REGION,
          SERVICE_NAME,
          CLUSTER_ARN,
          0 // desired count
        );
        if (stopSuccess) {
          return generateStandardResponse("Service updated to stop server.");
        }

        return generateStandardResponse("Unable to update service");
      default:
        return generateStandardResponse("Hey, that's a new command!");
    }
  } else {
    return generateStandardResponse(
      "Sorry, there is no member info with this request."
    );
  }
}

/**
 * A helper for generating a standard response for Discord.
 * @param {string} content The string content to return.
 * @param {Embed[]} embeds A list of embeds to return.
 * @return {DiscordResponseData} The fully-formed response.
 */
function generateStandardResponse(
  content: string,
  embeds: Embed[] = []
): DiscordResponseData {
  return {
    tts: false,
    content,
    embeds,
    allowed_mentions: [],
  };
}
