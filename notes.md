### First time setup:
1. Login to AWS, install npm
2. Clone respository
3. Customize config file to enable / disable features
4. Run cdk deploy to create infra (including secrets)
 - this populates that cdk context file somehow
5. Run configuration script to populate secrets
6. (maybe) Run cdk deploy again? to pass populated secrets into ecs 

### issues
- Custom authorizer for FTP: we don't need multiple users and it actually makes
  things harder. Can we refactor to (typescript) and just check a hardcode username
  and password from the secret? Probably don't want more than one user anyways.
- Secret has to be manually created to have a hard coded name. We need to populate the config file.
- Relocate config file to configs directory and have it read the secret ARN from the context file
- New secret pattern
  - [X] Server
  - [X] HTTP Server
  - [X] Discord Webhook
  - [ ] Discord Bot
  - [ ] SFTP
- Copy ENV consts pattern from discord bot? Maybe don't need to handle returning an error code if the lambda is misconfigured, that should never happen so things should just break
- Figure out secret typing so you can just fetch the object and grab properties off of it

### open questions
- Do we want one secret per feature? Probably not because they would get destroyed when
  you disable a feature (e.g. turn of SFTP after using it). Also no because you pay-per-secret on AWS