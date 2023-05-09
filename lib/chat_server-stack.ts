import * as cdk from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import { Construct } from 'constructs';
import { Vpc, SubnetType, Peer, Port, AmazonLinuxGeneration, 
  AmazonLinuxCpuType, Instance, SecurityGroup, AmazonLinuxImage,
  InstanceClass, InstanceSize, InstanceType
} from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';


export class ChatServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // IAM
    // Policy for CodeDeploy bucket access
    // Role that will be attached to the EC2 instance so it can be 
    // managed by AWS SSM
    const chatServerRole = new Role(this, "ec2Role", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });

    // IAM policy attachment to allow access to
    chatServerRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );
    
    chatServerRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2RoleforAWSCodeDeploy")
    );

    // VPC
    const vpc = new Vpc(this, 'chat_server_vpc',{
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public01',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'public02',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'public03',
          subnetType: SubnetType.PUBLIC,
        }
      ]
    });

    // Security Groups
    // This SG will only allow HTTP traffic to the Web server
    const chatSg = new SecurityGroup(this, 'web_sg',{
      vpc,
      description: "Allows Inbound HTTP traffic to the web server.",
      allowAllOutbound: true,
    });

    chatSg.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80)
    );

    chatSg.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(22)
    );
    
    // EC2 Instance
    // This is the Python Web server that we will be using
    // Get the latest AmazonLinux 2 AMI for the given region
    const ami = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: AmazonLinuxCpuType.X86_64,
    });

    // The actual Web EC2 Instance for the web server
    const chatServer = new Instance(this, 'chat_server',{
      vpc,
      instanceType: InstanceType.of(
        InstanceClass.T2,
        InstanceSize.MICRO,
      ),
      keyName: 'chat_server',
      machineImage: ami,
      securityGroup: chatSg,
      role: chatServerRole,
    });

    // User data - used for bootstrapping
    const chatSGUserData = readFileSync('./assets/configure_amz_linux_chat_app.sh','utf-8');
    chatServer.addUserData(chatSGUserData);
    // Tag the instance
    cdk.Tags.of(chatServer).add('application-name','python-chat-server')
    cdk.Tags.of(chatServer).add('stage','prod')

    // Output the public IP address of the EC2 instance
    new cdk.CfnOutput(this, "IP Address", {
      value: chatServer.instancePublicIp,
    });
  }
}
