/**
 * 部署脚本
 */
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const dayjs = require('dayjs');
const ora = require('ora');
const scpClient = require('scp2');
const Client = require('ssh2').Client;

const today = dayjs().format('YYYYMMDD');
const success = chalk.green;
const error = chalk.red;

function syncExec (connect, command, message) {
  return new Promise((resolve, reject) => {
    connect.exec(command, (err, stream) => {
      const tip = message || command;
      if (err) {
        // reject(err);
        console.log(chalk.red(`${tip} fail.`));
        throw err;
      } else {
        stream.on('close', (code, signal) => {
          if (code === 0) {
            console.log(chalk.green(`${tip} success.`));
            resolve(code);
          } else {
            console.log(chalk.red(`exec ${command} fail status: ${code}`));
            throw code;
          }
        }).on('data', (data) => {
          // console.log(data);
        }).stderr.on('data', (data) => {
          // throw data;
        })
      }
    });
  });
}

function upload (file, server) {
  return new Promise((resolve, reject) => {
    const uploadSpinner = ora('uploading...').start();
    scpClient.scp(`${file}`, server, (err) => {
      uploadSpinner.stop();
      if (err) {
        console.log(error('upload faild.'));
        throw err;
      } else {
        console.log(success('upload success.'));
        resolve();
      }
    });
  })
}

function deploy (server) {
  return new Promise((resolve, reject) => {
    let connect = null;
    try {
      connect = new Client();
      const { backupPath, deployPath, outputPath, host } = server;
      connect.on('ready', async () => {
        console.log(success(`connect to ${host} success.`));
        if (backupPath) {
          const dirName = path.basename(deployPath);
          const fullBackupPath = path.join(backupPath, `${dirName}.${today}.tar.gz`);
          await syncExec(connect, `tar -czvf ${fullBackupPath} ${deployPath}`, 'backup');
        }
        if (outputPath) {
          const outputFile = path.resolve(process.cwd(), outputPath);
          const fileName = path.basename(outputPath);
          await syncExec(connect, `rm -rf ${deployPath}/*`);
          await upload(outputFile, {
            ...server,
            path: deployPath,
          });
          const fileStat = fs.statSync(outputFile);
          if (fileStat.isFile()) {
            const file = path.join(deployPath, fileName);
            await syncExec(connect, `tar -xvf ${file} -C ${deployPath}`);
            await syncExec(connect, `rm -rf ${file}`);
          }
          console.log(chalk.green(`deploy ${fileName} to ${host} success.`));
        }
        console.log(chalk.green(`disconnect ${host} success.`));
        console.log('\n');
        connect.end();
        resolve();
      }).on('error', (err) => {
        console.error(err);
        throw err;
      })
        .connect(server);
    } catch (err) {
      console.error(err);
      if (connect) {
        connect.end();
      }
      reject();
    }
  });
}


async function Deploy (serverList) {
  if (serverList instanceof Array) {
    for (let server of serverList) {
      await deploy(server);
    }
  }
}

module.exports = Deploy;
