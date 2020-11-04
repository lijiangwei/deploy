const Client = require('ssh2').Client;
const socksv5 = require('@luminati-io/socksv5');
const conn = new Client();
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');
const fs = require('fs');

function put (sftp, localPath, remotePath, options = {}) {
  return new Promise((resolve, reject) => {
    let data = fs.createReadStream(localPath);
    sftp.fastPut(data, remotePath, {
      concurrency: 1,
    }, (err) => {
      resolve(err ? false : true);
    });
  });
}

function uploadFile (sftp, server) {
  return new Promise(async (resolve, reject) => {
    const { outputPath, deployPath } = server;
    const localFilePath = path.resolve(process.cwd(), outputPath);
    const fileNames = glob.sync(`${localFilePath}/**/*`, {
      nodir: true,
    });
    for (let filePath of fileNames) {
      const fileName = path.relative(localFilePath, filePath);
      const result = await put(sftp, filePath, deployPath);
      if (result) {
        console.log(chalk.green(`${fileName} upload success.`));
      } else {
        console.log(chalk.red(`${fileName} upload failed.`));
      }
    }
    resolve();
  });
}

function sshConnect (socket, server) {
  return new Promise(async (resolve, reject) => {
    const { username, password, host, port, } = server;
    conn.on('ready', () => {
      console.log(`connect ${host} ready.`);
      conn.sftp(async function (err, sftp) {
        if (err) throw err;
        try {
          await uploadFile(sftp, server);
        } finally {
          conn.end();
        }
      });
    })
      .on('close', () => {
        resolve();
      }).connect({
        host,
        port,
        username,
        password,
        sock: socket,
      });
  });
}

function sockProxy (server) {
  return new Promise(async (resolve, reject) => {
    socksv5.connect({
      ...server,
      auths: [socksv5.auth.None()]
    }, async function (socket) {
      try {
        await sshConnect(socket, server);
      } catch (err) {

      } finally {
        // socket.close();
      }
    }).on('close', (had_error) => {
      resolve(had_error);
    });
  });
}

async function deploy (serverList) {
  for (let i = 0; i < serverList.length; i++) {
    await sockProxy(serverList[i]);
  }
}

deploy(SERVER_LIST);



