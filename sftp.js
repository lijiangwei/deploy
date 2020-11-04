const socksv5 = require('@luminati-io/socksv5');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');
const fs = require('fs');
const dayjs = require('dayjs');
const sshClient = require('ssh2').Client;
let Client = require('ssh2-sftp-client');

function upload (server) {
  return new Promise((resolve, reject) => {
    socksv5.connect({
      ...server,
      auths: [socksv5.auth.None()]
    }, async function (socket) {
      const { username, password, host, port, outputPath, deployPath } = server;
      const sftp = new Client();
      try {
        await sftp.connect({
          host,
          port,
          username,
          password,
          sock: socket,
        });
        sftp.on('upload', info => {
          const fileName = path.relative(outputPath, info.source);
          console.log(chalk.green(`upload ${fileName} success.`));
        });
        const fullOutputPath = path.resolve(process.cwd(), outputPath);
        await sftp.uploadDir(fullOutputPath, deployPath);
      } catch (err) {
        console.log(`${err.message}`);
      } finally {
        console.log(chalk.green(`${host} deploy finish.`));
        sftp.end();
      }
    }).on('close', (had_error) => {
      resolve(had_error);
    });
  });
}

// 同步执行shell command
function syncExec (connect, command, message) {
  return new Promise((resolve, reject) => {
    connect.exec(command, (err, stream) => {
      const tip = message || command;
      if (err) {
        // reject(err);
        console.log(chalk.red(`${tip} fail.`));
        throw err;
      }
      console.log(chalk.green(`${tip} success.`));
      resolve();
    });
  });
}

// 建立socket连接
function socketConnect (server, callback) {
  return new Promise((resolve, reject) => {
    socksv5.connect({
      ...server,
      auths: [socksv5.auth.None()]
    }, async function (socket) {
      await callback(socket);
    }).on('close', (had_error) => {
      resolve(had_error);
    });
  });
}

function backup (server) {
  return new Promise((resolve, reject) => {
    socketConnect(server, (socket) => {
      try {
        const conn = new sshClient();
        const { backupPath, deployPath, host } = server;
        const today = dayjs().format('YYYYMMDD');
        conn.on('ready', async () => {
          if (backupPath) {
            const dirName = path.basename(deployPath);
            const fullBackupPath = path.join(backupPath, `${dirName}.${today}.tar.gz`);
            await syncExec(conn, `tar -czvf ${fullBackupPath} ${deployPath}`, 'backup');
          }
          conn.end();
        }).connect({
          ...server,
          sock: socket,
        });
      } catch (err) {
      }
      resolve();
    });
  });
}

function sockProxy (server) {
  return new Promise(async (resolve, reject) => {
    try {
      await backup(server);
      await upload(server);
    } catch (err) {

    }
    resolve();
  });
}

async function deploy (serverList) {
  for (let server of serverList) {
    try {
      await sockProxy(server);
    } catch (err) {
      console.log(err);
    }
  }
  console.log('all server deploy finish.')
}

module.exports = deploy;
