import { execSync } from 'child_process';
import { MongoMemoryServerStates } from 'mongodb-memory-server-core/lib/MongoMemoryServer';
import { MongoMemoryServer } from 'mongodb-memory-server-global';

import * as core from '@actions/core';

import { MemoryServerFactory } from './factory/memory-server-factory';

async function runCommand(command: string, connectionString: string): Promise<string> {
  console.info(`--- Executing the target script: "${command}"`);

  const connectionStringEnvVar = core.getInput('db_connection_env_var');
  const mongoMsDebug = core.getInput('mongoms_debug');

  process.env[connectionStringEnvVar] = connectionString;

  if (mongoMsDebug) {
    process.env['MONGOMS_DEBUG'] = '1';
  }

  try {
    const output = execSync(command, {
      env: process.env,
      cwd: process.env.githubRepository,
      stdio: 'inherit',
    });

    return output ? output.toString() : '--- Child process executed synchronously and returned null.';
  } catch (err) {
    console.error(err);

    throw err;
  }
}

async function run(): Promise<void> {
  let mongodb: MongoMemoryServer | undefined;

  try {
    const dbName = core.getInput('instance_dbName');
    const port: number = Number.parseInt(core.getInput('instance_port'));
    const storageEngine = core.getInput('instance_storageEngine');
    const version = core.getInput('binary_version');
    const maxPoolInput = core.getInput('max_pool_size');
    const maxPoolSize =  maxPoolInput ? Number.parseInt(maxPoolInput) : undefined;

    mongodb = await MemoryServerFactory.generateMemoryServer(dbName, port, storageEngine, version);

    const connectionString = await MemoryServerFactory.verifyMemoryServer(mongodb, maxPoolSize);
    const command = core.getInput('run_command');

    const stdOut = await runCommand(command, connectionString);

    console.info(stdOut);
  } catch (err) {
    core.setFailed((err as Error).message);
  } finally {
    if (mongodb?.state === MongoMemoryServerStates.running) {
      await mongodb.stop();
    }
  }
}

run();
