#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ChatServerStack } from "../lib/chat_server-stack";
import { PipelineStack } from "../lib/pipeline_stack";

const app = new cdk.App();

new PipelineStack(app, "ChatServerPipeline" ,{});
new ChatServerStack(app, "ChatServerStack", {});
