/**
 * ELO Shell Development Runner
 *
 * @author PB, ELO Digital Office GmbH
 * @version 1.01.002
 *
 * @elosh
 */
/* eslint-disable quotes */
importPackage(Packages.de.elo.ix.client);
importPackage(Packages.java.io);

//Packages.java.lang.System.setProperty("log4j.configurationFile", "log4j2.xml");
 //log.info("global {}", this)
(function (global, args) {
  function ConnectionHandler(configManager) {
    var connectionHandler,
        connectionFactory,
        ixConnect,
        ixConnectAdmin,
        $ENV;

    configManager = configManager || global.ConfigManager;

    connectionHandler = {
      connectIx: function () {
        return connectionHandler._connectIx(
          configManager.getConfig("ixUrl"),
          configManager.getConfig("username"),
          configManager.getConfig("password"),
          configManager.getConfig("language") || "en"
        );
      },
      _connectIx: function (ixUrl, username, password, language) {
        log.info("Connect to IX: {}", ixUrl);
        log.info("User name: {}", username);
        log.info("Computer name: {}", ($ENV || {}).COMPUTERNAME || "unknown");
        log.info("Language: {}", language);

        if (ixConnect) {
          ixConnect.close();
        }

        connectionFactory = new IXConnFactory(ixUrl, "ELO Shell Script", "1.0");

        ixConnect = connectionFactory.create(username, password, ($ENV || {}).COMPUTERNAME || "unknown", null);
        ixConnect.loginResult.clientInfo.language = language;
        global.ixConnect = ixConnect;

        ixConnectAdmin = connectionFactory.createAdmin(username, password, ($ENV || {}).COMPUTERNAME || "unknown", null);
        ixConnectAdmin.loginResult.clientInfo.language = language;
        global.ixConnectAdmin = ixConnectAdmin;

        return ixConnect;
      }
    };
    return connectionHandler;
  }
  var initializer = {
    defaults: {
      logPath: "C:/git/dev/elo-cli.git/jsscripts/sol.dev.helper.Logger.js",
      fileManagerPath: "C:/git/dev/elo-cli.git/jsscripts/sol.dev.FileManager.js",
      configManagerPath: "C:/git/dev/elo-cli.git/jsscripts/sol.dev.ConfigManager.js",
      jasminePath: "C:/git/dev/elo-cli.git/jasmine",
      jasmineEntryFile: "sol.dev.jasmine.boot.js",
      jasmineOnloadFile: "sol.dev.jasmine.onload.js"
    },
    initialize: function () {
      initializer.alignRhinoAndNashorn();
      global.DEV_PARAMS = initializer.parseArguments(args);
      log.info("global {}", global)
      initializer.loadLog(global.DEV_PARAMS.LOG_PATH);
      initializer.loadManagers();
      global.FileManager.setSearchFolders(global.ConfigManager.getSkriptFolders());
      if (global.DEV_PARAMS.jasmine) {
        initializer.loadJasmine(global.DEV_PARAMS.JASMINE_PATH, global.DEV_PARAMS.JASMINE_ENTRY_FILE);
      }
      if (global.DEV_PARAMS.project != "common") {
        (global.FileManager.commonFolders || [])
          .map(function (commonFolder) {
            global.FileManager.addToSearchFolders(commonFolder);
          });
      }
      global.FileManager.loadScript(global.DEV_PARAMS.entry);

    },
    alignRhinoAndNashorn: function () {
      global.readFile = global.readFully || global.readFile;
      global.readFully = global.readFile || global.readFully;
    },
    parseArguments: function (arguments) {
      return (arguments[0] || "").split(" ")
        .map(initializer.parseArgument)
        .reduce(initializer.setKeyValuePair, {});
    },
    loadLog: function (logPath) {
      initializer.load(logPath || initializer.defaults.logPath);
    },
    loadManagers: function () {
      initializer.loadFileManager(global.DEV_PARAMS.FILE_MANAGER_PATH);
      initializer.loadConfigManager(global.DEV_PARAMS.CONFIG_MANAGER_PATH);
      global.ConnectionHandler = ConnectionHandler(global.ConfigManager);
    },
    loadFileManager: function (fileManagerPath) {
      initializer.load(fileManagerPath || initializer.defaults.fileManagerPath);
    },
    loadConfigManager: function (configManagerPath) {
      initializer.load(configManagerPath || initializer.defaults.configManagerPath);
    },
    loadJasmine: function (jasminePath, jasmineEntryFile) {
      global.FileManager.addToSearchFolders(jasminePath || initializer.defaults.jasminePath);


      EloShellScriptRunner.loadScript("", jasmineEntryFile || initializer.defaults.jasmineEntryFile, false);
    },
    triggerJasmineOnload: function (jasmineOnloadFile) {
      EloShellScriptRunner.loadScript("", jasmineOnloadFile || initializer.defaults.jasmineOnloadFile, false);
    },
    load: function (path) {
      load(path);
    },
    parseArgument: function (argument) {
      return {
        key: (argument.split("=")[0]).substring(1).replace("\\", "/"),
        value: argument.split("=")[1]
      };
    },
    setKeyValuePair: function (target, keyValuePair) {
      target[keyValuePair.key] = initializer.parseValue(keyValuePair.value);
      return target;
    },
    parseValue: function (value) {
      return value == "True"
        ? true
        : value == "False"
          ? false
          : value;
    }
  };
  if (!global.Initializer) {
    try {
      global.Initializer = initializer;
      global.Initializer.initialize();
    } catch (e) { }
  }


  if (!global.Initializer) {
    global.Initializer = initializer;
    global.Initializer.initialize();
  }

  global.Initializer.triggerJasmineOnload();

  if (global.DEV_PARAMS.jasmine) {
    global.Initializer.triggerJasmineOnload();
  }
 // eslint-disable-next-line no-undef
})(this, $ARGS[0]);
