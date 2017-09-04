#!/usr/bin/env node

'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const os = require('os');

if (process.argv[2] === "install") {
  let command = "npm";
  if (os.platform().indexOf('win') == 0) {
    command += ".cmd"
  }

  // Install npm packages
  const npmInstall = childProcess.spawn(command, ['install'], { stdio: [0,1,2] });
  npmInstall.on('exit', function () {
    const publicSuffixListUpdate = childProcess.spawn(command, ['run', 'tldjs-update-rules'], { stdio: [0,1,2] });
    publicSuffixListUpdate.on('exit', function () {
      fern();
    });
  });
} else {
  fern();
}

function fern() {
const program = require('commander');
const execa = require('execa');
const spaws = require('cross-spawn');
const fs = require('fs');
const wrench = require('wrench');
const walk = require('walk');
const colors = require('colors');
const broccoli = require('broccoli');
const Testem = require('testem')
const path = require('path')
const rimraf = require('rimraf');
const chalk = require('chalk');
const notifier = require('node-notifier');
const copyDereferenceSync = require('copy-dereference').sync
const copy = require('recursive-copy');

const common = require('./fern/commands/common');
require('./fern/commands/serve');

const setConfigPath = common.setConfigPath;
const buildFreshtabFrontEnd = common.buildFreshtabFrontEnd;
const getExtensionVersion = common.getExtensionVersion;
const createBuildWatcher = common.createBuildWatcher;
const cleanupDefaultBuild = common.cleanupDefaultBuild;

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

function isPackageInstalled(pkg, options, msg) {
  var spawned = spaws.sync(pkg, [options], { stderr: 'inherit' });
  if(spawned.error !== null) {
    console.log(chalk.red(msg));
    process.exit(1);
  }
}

program.command('install')
       .action(() => {
          isPackageInstalled('bower', '--silent', 'npm bower package missing, to install it run `npm install bower -g`');

          console.log(chalk.green('Installing project dependencies'));
          spaws.sync('bower', ['install'], { stdio: 'inherit', stderr: 'inherit'});

          console.log(chalk.green('Installing ember freshtab dependencies'));
          spaws.sync('npm', ['install'], { stdio: 'inherit', stderr: 'inherit', cwd: 'subprojects/fresh-tab-frontend'});
          spaws.sync('bower', ['install'], { stdio: 'inherit', stderr: 'inherit', cwd: 'subprojects/fresh-tab-frontend'});
          console.log(chalk.green('DONE!'))
       });

program.command('addon-version')
       .action(() => {
          getExtensionVersion('package').then(version => {
            console.log(version)
          });
        });

program.command('addon-id [file]')
       .action((configPath) => {
          setConfigPath(configPath);
          console.log(CONFIG.settings.id || 'cliqz@cliqz.com')
        });

program.command('build [file]')
       .option('--no-maps', 'disables source maps')
       .option('--version [version]', 'sets extension version', 'package')
       .option('--freshtab', 'enables ember fresh-tab-frontend build')
       .option('--environment <environment>')
       .option('--to-subdir', 'build into a subdirectory named after the config')
       .option('--instrument-functions', 'enable function instrumentation for profiling')
       .action((configPath, options) => {
          const buildStart = Date.now();
          const cfg = setConfigPath(configPath, options.toSubdir);
          const CONFIG = cfg.CONFIG;
          const OUTPUT_PATH = cfg.OUTPUT_PATH;

          process.env['CLIQZ_ENVIRONMENT'] = options.environment || 'development';
          process.env['CLIQZ_SOURCE_MAPS'] = options.maps;
          process.env['CLIQZ_FRESHTAB'] = options.freshtab;
          process.env['CLIQZ_INSTRUMENT_FUNCTIONS'] = options.instrumentFunctions || '';

          console.log("Starting build");
          buildFreshtabFrontEnd();
          cleanupDefaultBuild();

          getExtensionVersion(options.version).then(tag => {
            process.env.EXTENSION_VERSION = tag;
            assert(OUTPUT_PATH);

            cleanupDefaultBuild();
            const node = broccoli.loadBrocfile();
            const builder = new broccoli.Builder(node, {
              outputDir: OUTPUT_PATH
            });
            builder.build()
              .then(() => {
                copyDereferenceSync(builder.outputPath, OUTPUT_PATH);
                console.log('Build successful');
                process.exit(0);
              })
              .catch(err => {
                console.error('Build error', err)
                process.exit(1);
              });
          });
       });

program.command('test-webext')
       .action(() => {
         const cfg = setConfigPath('./configs/cliqzium.json');
         const CONFIG = cfg.CONFIG;
         const OUTPUT_PATH = cfg.OUTPUT_PATH;
         const watcher = createBuildWatcher();
         let runner;

         watcher.on('change', () => {
           notifier.notify({
             title: 'Fern',
             message: 'Build complete',
             time: 1500
           });

           if (runner) {
             runner.kill('SIGTERM');
           }

           runner = childProcess.spawn('node', [path.join(process.cwd(), 'fern/run_selenium_tests.es')]);

           process.on('exit', () => { runner.kill('SIGTERM'); });
         });
       });

program.command('test [file]')
       .option('--ci [output]', 'Starts Testem in CI mode')
       .option('--grep [pattern]', 'only run tests matching <pattern>')
       .option('--fgrep [pattern]', 'only run tests with file names matching <pattern>')
       .option('--firefox [firefox]', 'firefox path', 'nightly')
       .option('-l --launchers [launchers]', 'comma separted list of launchers')
       .action( (configPath, options) => {
         "use strict";
         const cfg = setConfigPath(configPath);
         const CONFIG = cfg.CONFIG;
         const OUTPUT_PATH = cfg.OUTPUT_PATH;
         const watcher = createBuildWatcher();

         if (options.grep) {
           process.env["MOCHA_GREP"] = options.grep;
         }

         if (options.fgrep) {
           process.env["MOCHA_FGREP"] = options.fgrep;
         }

         if (options.firefox) {
           process.env["FIREFOX_PATH"] = options.firefox;
         }

         process.env["OUTPUT_PATH"] = OUTPUT_PATH;

         const Testem = require('testem');
         const testem = new Testem();
         const launchers = options.launchers;
         let isRunning = false;

          if (options.ci) {
            watcher.on('buildSuccess', function() {
              rimraf.sync(OUTPUT_PATH);
              copyDereferenceSync(watcher.builder.outputPath, OUTPUT_PATH);

              testem.startCI({
                debug: true,
                host: 'localhost',
                port: '4200',
                launch: launchers || (CONFIG['testem_launchers_ci'] || []).join(','),
                reporter: 'xunit',
                report_file: options.ci
              });
            });
          } else {
            let server;
            watcher.on('buildSuccess', function() {
              rimraf.sync(OUTPUT_PATH);
              copyDereferenceSync(watcher.builder.outputPath, OUTPUT_PATH);
              notifier.notify({
                title: "Fern",
                message: "Build complete",
                time: 1500
              });
              if (!isRunning) {
                testem.startDev({
                  debug: true,
                  host: 'localhost',
                  port: '4200',
                  launch: launchers || (CONFIG['testem_launchers'] || []).join(','),
                  reporter: 'xunit',
                  report_file: options.ci
                });
                isRunning = true;
              } else {
                testem.restart();
              }
            });
          }
       });

program.command('generate <type> <moduleName>')
       .description('available types: module')
       .action((type, moduleName) => {
         if(type !== 'module') {
           console.error(`Error: generate does not support type - '${type}'`);
           return;
         }

        const modulePath = `modules/${moduleName}`;

        try {
          fs.lstatSync(modulePath);

          // lstatSync throws error if Directory does not exist, which is
          // the only situation that generator can work.
          console.log(e);
          console.error(`Error: module '${moduleName}' already exists`);
          return;
        } catch (e) {
        }

        wrench.copyDirSyncRecursive('fern/templates/module', modulePath);

        console.log('installing module');
        walk.walk(modulePath).on('file', (root, stat, next) => {
          console.log('  create'.info, `${root}/${stat.name}`);
          next();
        });
       });

program.command('react-dev [config]')
      .description('run the react-native dev server')
      .action((config) => {
        const cfg = setConfigPath(config || 'configs/react-native.json');
        const CONFIG = cfg.CONFIG;
        const OUTPUT_PATH = cfg.OUTPUT_PATH;
        const projectRoots = [OUTPUT_PATH, path.resolve(process.cwd(), 'node_modules')]
        const options = ['./node_modules/react-native/local-cli/cli.js', 'start',
                         '--projectRoots', projectRoots.join(',')]
        spaws.sync('node', options, { stdio: 'inherit', stderr: 'inherit'});
      });

function createReactNativeBundle(bundleDir, platform, dev) {
  const shellOpts = { stdio: 'inherit', stderr: 'inherit' };
  const bundleName = 'jsengine.bundle.js';
  const bundlePath = `${bundleDir}/${bundleName}`;
  const outDirInsideRepo = bundleDir.indexOf(__dirname) === 0;
  console.log(bundleDir, outDirInsideRepo);
  if (outDirInsideRepo) {
    rimraf.sync(bundleDir);
  }
  // create bundle
  var options = ['./node_modules/react-native/local-cli/cli.js', 'unbundle',
    '--platform', platform, '--entry-file', `${OUTPUT_PATH}/index.${platform}.js`,
    '--bundle-output', bundlePath, '--assets-dest', bundleDir, '--dev', dev === true];
  console.log(options);
  spaws.sync('node', options, shellOpts);

  // prepare package.json
  spaws.sync('cp', ['package.json', `${bundleDir}/package.json`], shellOpts);
  // move bundled assets over
  return copy(`${OUTPUT_PATH}/assets`, `${bundleDir}/assets`, { overwrite: true });
}

program.command('react-bundle <platfocrm> [config] [dest]')
      .description('create a react-native jsbundle')
      .option('--dev', 'disables warning and error messages')
      .action((platform, config, dest, cmdOptions) => {
        setConfigPath(config || 'configs/react-native.json');
        const shellOpts = { stdio: 'inherit', stderr: 'inherit' };
        const bundleDir = path.resolve(dest || 'jsengineBundle');
        spaws.sync('./fern.js', ['build', config], shellOpts);
        createReactNativeBundle(bundleDir, platform, cmdOptions.dev);
      });

program.command('react-release <platform> <tag> [config]')
      .description('deploy a react bundle to the CDN')
      .action((platform, tag, config) => {
        setConfigPath(config || 'configs/react-native.json');
        const shellOpts = { stdio: 'inherit', stderr: 'inherit' };
        const bundleDir = path.resolve(`jsengine-${platform}-${tag}`);
        const archiveName = `jsengine.${platform}.${tag}.tar.gz`;

        createReactNativeBundle(bundleDir, platform, false).then(() => {
          // create archive of bundle files
          spaws.sync('tar', ['-C', bundleDir, '-czf', archiveName, './'], shellOpts);
          // push to s3
          const s3Bucket = 's3://cdn.cliqz.com/mobile/jsengine/';
          spaws.sync('aws', ['s3', 'cp', archiveName, s3Bucket], shellOpts);
          // cleanup
          spaws.sync('rm', ['-R', archiveName, bundleDir], shellOpts);
        });
      });

program.parse(process.argv);
}
