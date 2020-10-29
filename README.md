# Deploy

deploy files to ecs.

## Useage

```
const deploy = require('@starsoul/deploy');
const SERVER_LIST = [
  {
    host: 'xxx',// ip
    port: 22,// 端口
    username: 'xxx', // 登录服务器的账号
    password: 'xxx', // 登录服务器的密码
    outputPath: '', // 要部署的本地目录
    deployPath: '', // 服务器目录
    backupPath: '', // 备份上个版本的目录
  },
];
deploy(SERVER_LIST);
```
