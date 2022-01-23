"use strict";

import {
  DescribeNetworkInterfacesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import {
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";

var client: ECSClient;
var ec2Client: EC2Client;

export async function getCurrentServerIP(
  region: string,
  serviceName: string,
  clusterArn: string
) {
  // Initialize clients
  if (!client) {
    client = new ECSClient({ region });
  }
  if (!ec2Client) {
    ec2Client = new EC2Client({ region });
  }

  // Load all running tasks
  const listTasksParams = {
    serviceName: serviceName,
    cluster: clusterArn,
    desiredStatus: "RUNNING",
  };
  const listTasksCommand = new ListTasksCommand(listTasksParams);
  const listTasksResult = await client.send(listTasksCommand);
  const taskArns = listTasksResult.taskArns;
  if (!taskArns || taskArns.length < 1) {
    return null;
  }
  var describeTaskParams = {
    cluster: clusterArn,
    tasks: taskArns,
  };

  // Get more information about the tasks
  const describeTaskCommand = new DescribeTasksCommand(describeTaskParams);
  const describeTasksResult = await client.send(describeTaskCommand);
  if (!describeTasksResult) {
    return null;
  }
  const networkInterfaceId =
    describeTasksResult.tasks?.[0].attachments?.[0].details?.find(
      (detail) => detail.name == "networkInterfaceId"
    )?.value;
  if (!networkInterfaceId) {
    return null;
  }

  // Get the public IP of the currently running task
  const describeNetworkInterfacesCommand = new DescribeNetworkInterfacesCommand(
    {
      NetworkInterfaceIds: [networkInterfaceId],
    }
  );
  const networkInterfaces = await ec2Client.send(
    describeNetworkInterfacesCommand
  );
  return networkInterfaces?.NetworkInterfaces?.find(
    (networkInterface) => networkInterface.Association != undefined
  )?.Association?.PublicIp;
}

export async function updateServerConfiguration(
  region: string,
  serviceName: string,
  clusterArn: string,
  desiredCount: number
): Promise<boolean> {
  if (!client) {
    client = new ECSClient({ region });
  }

  const params = {
    desiredCount,
    service: serviceName,
    cluster: clusterArn,
  };

  const updateCommand = new UpdateServiceCommand(params);
  try {
    await client.send(updateCommand);
  } catch (error: any) {
    console.log("Error updating server: " + error);
    return false;
  }

  return true;
}

export function getResponse(
  statusCode: number,
  message: string,
  fields: object = {}
) {
  const bodyContent = {
    ...fields,
    message,
  };
  return {
    statusCode,
    body: JSON.stringify(bodyContent),
  };
}
