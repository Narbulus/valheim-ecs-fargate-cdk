import { Construct } from "constructs";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as efs from "aws-cdk-lib/aws-efs";

export interface FtpUserProps {
  /**
   * username to login
   *
   * @default - lowercase of its construct id
   */
  readonly userName?: string;

  /**
   * password for this user
   *
   * @default - password is randomly generated
   */
  readonly password?: string;

  /**
   * the id of transfer server for this user
   */
  readonly transferServerId: string;

  /**
   * the EFS Filesystem that this user has access to
   */
  readonly accessibleFS: efs.FileSystem;
}

export class FtpUser extends Construct {
  readonly secret: sm.Secret;

  constructor(scope: Construct, id: string, props: FtpUserProps) {
    super(scope, id);

    const userName = props.userName ?? id.toLowerCase();

    // requirements for IAM role for ftp users: https://docs.aws.amazon.com/transfer/latest/userguide/requirements-roles.html
    const userRole = new iam.Role(this, `Role`, {
      assumedBy: new iam.ServicePrincipal("transfer.amazonaws.com"),
    });

    this.secret = new sm.Secret(this, `User`, {
      secretName: `ftpSecret/${props.transferServerId}/${userName}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          Role: userRole.roleArn,
          HomeDirectory: `/${props.accessibleFS.fileSystemId}/`,
          Password: props.password,
        }),
        generateStringKey: props.password == null ? "Password" : "Dummy",
        excludePunctuation: true,
      },
    });

    props.accessibleFS.grant(userRole, "elasticfilesystem:ClientMount");
    props.accessibleFS.grant(userRole, "elasticfilesystem:ClientWrite");
    props.accessibleFS.grant(
      userRole,
      "elasticfilesystem:DescribeMountTargets"
    );
    props.accessibleFS.grant(userRole, "elasticfilesystem:ClientRootAccess");
  }
}
