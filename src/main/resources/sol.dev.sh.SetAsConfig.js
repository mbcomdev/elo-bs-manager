
/* global EloInstallPackage, BASE_CONFIG, SCRIPT_CONFIG */

var SetAsConfig,
    tempSubDirName, i, installConfig,
    packageDir, sqlFiles, sqlFile, packageFiles, packageFile;

SetAsConfig = {

  execute: function (protocol, host, port, service) {
    log.info("Setting AS Service path in common configuration: protocol=" + protocol + ", host=" + host + ", port=" + port + ", service=" + service);
    EloShellScriptRunner.loadScript("", "lib_Class.js", true);
    EloShellScriptRunner.loadScript("", "lib_sol.common.SordUtils.js");
    EloShellScriptRunner.loadScript("", "lib_sol.common.RepoUtils.js");
    EloShellScriptRunner.loadScript("", "lib_sol.common.FileUtils.js");
    EloShellScriptRunner.loadScript("", "lib_sol.common.ZipUtils.js");

    EloShellScriptRunner.connectIx(BASE_CONFIG.ixUrl, BASE_CONFIG.username, BASE_CONFIG.password, BASE_CONFIG.language);

    sol.common.RepoUtils.saveToRepo({
      repoPath: "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/common/Configuration/as.config",
      maskId: "ELO Business Solution Configuration",
      extension: "json",
      objKeysObj: {
        BS_CONFIG_NAME: "ELO AS settings",
        BS_CONFIG_VERSION: "1.0"
      },
      contentObject: {
        protocol: protocol,
        serverName: host,
        port: port,
        serviceName: service
      },
      withoutBom: true,
      tryUpdate: true
    });
  }
};

SetAsConfig.execute($ARGS[0], $ARGS[1], $ARGS[2], $ARGS[3]);
log.info("SetAsConfig finished");
