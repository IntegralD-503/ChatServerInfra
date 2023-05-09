import * as cdk from "aws-cdk-lib";
import { Pipeline, Artifact } from "aws-cdk-lib/aws-codepipeline";
import {
  GitHubSourceAction,
  CodeBuildAction,
  CodeDeployServerDeployAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import {
  PipelineProject,
  LinuxBuildImage,
  BuildSpec,
} from "aws-cdk-lib/aws-codebuild";
import {
  ServerDeploymentGroup,
  ServerApplication,
  InstanceTagSet,
} from "aws-cdk-lib/aws-codedeploy";
import { SecretValue } from "aws-cdk-lib";
import { Construct } from "constructs";

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CodePipeline
    const pipeline = new Pipeline(this, "python_chat_pipeline", {
      pipelineName: "python-chatApp",
      crossAccountKeys: false, // solves the encrypted bucket issue
    });

    // Source action
    const cdkSourceOutput = new Artifact();
    const chatServiceSourceOutput = new Artifact("ChatServiceSourceOutput");

    // Source Stage
    const sourceStage = pipeline.addStage({
      stageName: "Source",
      actions: [
        new GitHubSourceAction({
          owner: "IntegralD-503",
          repo: "ChatServiceInfra",
          branch: "master",
          actionName: "ChatServiceInfra_Source",
          oauthToken: SecretValue.secretsManager("github-token"),
          output: cdkSourceOutput,
        }),
        new GitHubSourceAction({
          owner: "IntegralD-503",
          repo: "ChatService",
          branch: "master",
          actionName: "ChatService_Source",
          oauthToken: SecretValue.secretsManager("github-token"),
          output: chatServiceSourceOutput,
        }),
      ],
    });

    const cdkBuildOutput = new Artifact("CdkBuildOutput");
    const chatServiceBuildOutput = new Artifact("ChatServiceBuildOutput");

    // Build Stage
    const buildStage = pipeline.addStage({
      stageName: "Build",
      actions: [
        new CodeBuildAction({
          actionName: "CDK_Build",
          input: cdkSourceOutput,
          outputs: [cdkBuildOutput],
          project: new PipelineProject(this, "CdkBuildProject", {
            environment: {
              buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              "build-specs/cdk-build-spec.yml"
            ),
          }),
        }),
        new CodeBuildAction({
          actionName: "ChatApp_Build",
          input: chatServiceSourceOutput,
          outputs: [chatServiceBuildOutput],
          project: new PipelineProject(this, "ChatAppBuildProject", {
            environment: {
              buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
              privileged: true,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              "build-specs/chat-app-build-spec.yml"
            ),
          }),
          // role: codeBuildECRTokenAccessRole
        }),
      ],
    });

    // Deploy Stage
    // Deploy Actions
    const pythonDeployApplication = new ServerApplication(
      this,
      "python_deploy_application",
      {
        applicationName: "python-chatApp",
      }
    );

    // Deployment group
    const deploymentGroup = new ServerDeploymentGroup(
      this,
      "PythonAppDeployGroup",
      {
        application: pythonDeployApplication,
        deploymentGroupName: "PythonAppDeploymentGroup",
        installAgent: true,
        ec2InstanceTags: new InstanceTagSet({
          "application-name": ["python-chat"],
          stage: ["prod", "stage"],
        }),
      }
    );

    const deployStage = pipeline.addStage({
      stageName: "Deploy",
      actions: [
        new CodeDeployServerDeployAction({
          actionName: "ChatApp_Deploy",
          input: chatServiceBuildOutput,
          deploymentGroup,
        }),
      ],
    });
  }
}
