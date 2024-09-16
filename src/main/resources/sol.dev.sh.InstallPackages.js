//@include lib_Class.js
//@include lib_sol.common.FileUtils.js
//@include lib_sol.common.ZipUtils.js

/* global EloInstallPackage, BASE_CONFIG, SCRIPT_CONFIG */

var EloConvertEloInstToGit, tempSubDirName, i, buildConfig, installConfig;

EloInstallPackage = { // eslint-disable-line no-global-assign

  tempSubDirName: "temp",

  execute: function (operation, packageFilePath, tempDirPath) {
    var me = this,
        packagesBaseDirPath;

  
    if (!tempDirPath) {
      tempDirPath = "temp";
    }

    tempDirPath = tempDirPath.replace("\"", "").trim();
    log.info("Executing installation: operation=" + operation + ", packageFilePath=" + packageFilePath + ", tempDirPath=" + tempDirPath);

    if (!operation) {
      throw "'operation' is missing";
    }

    if (operation == "deploy") {
      me.installPackage(packageFilePath, tempDirPath + "_install");
    }

    if (operation == "installWorkspace") {
      packagesBaseDirPath = SCRIPT_CONFIG.packagesBaseDir;
      if (!packagesBaseDirPath) {
        throw "'SCRIPT_CONFIG.packagesBaseDir' is missing";
      }
      me.installWorkspace(packagesBaseDirPath, tempDirPath + "_install");
    }
  },

  deleteTempDir: function (subDirName) {
    var tempDir;
    tempDir = new java.io.File(subDirName);
    sol.common.FileUtils.delete(tempDir, { quietly: true });
  },

  installPackage: function (packageFilePath, subDirName) {
    var tempDir, installConfigPath, installConfigString, buildConfigPath, buildConfigString, packageFile;
    log.info("Install package:" + packageFilePath);
    log.info("Install package temp dir:" + subDirName);
    tempDir = new java.io.File(subDirName);
    sol.common.FileUtils.delete(tempDir, { quietly: true });
    sol.common.FileUtils.makeDirectories(tempDir);
    packageFile = new java.io.File(packageFilePath);
    sol.common.ZipUtils.unzip(packageFile, tempDir);
    installConfigPath = tempDir.absolutePath + File.separator + "install.json";
    installConfigString = sol.common.FileUtils.readFileToString(installConfigPath);
    installConfig = JSON.parse(installConfigString);
    buildConfigPath = tempDir.absolutePath + File.separator + "build.json";
    try {
      buildConfigString = sol.common.FileUtils.readFileToString(buildConfigPath);
      buildConfig = JSON.parse(buildConfigString);
    } catch (ignore) {
      buildConfig = {};
    }
    ELOINSTDIR = tempDir.absolutePath;
    EloShellScriptRunner.connectIx(BASE_CONFIG.ixUrl, BASE_CONFIG.username, BASE_CONFIG.password, BASE_CONFIG.language);
    EloShellScriptRunner.loadScript(subDirName, "install.js", true);
    log.info("Package installed: " + packageFilePath);
  },

  installWorkspace: function (packagesBaseDirPath, tempDirPath) {
    var me = this,
        packagesBaseDir, fileCollection, fileIterator, packageFile;

    if (!packagesBaseDirPath) {
      throw "'packagesBaseDirPath' is missing";
    }
    packagesBaseDir = new File(packagesBaseDirPath);

    fileCollection = Packages.org.apache.commons.io.FileUtils.listFiles(packagesBaseDir, ["eloinst"], false);

    fileIterator = fileCollection.iterator();

    while (fileIterator.hasNext()) {
      packageFile = fileIterator.next();
      me.installPackage(packageFile.absolutePath, tempDirPath);
    }
  }
};

EloInstallPackage.execute($ARGS[0], $ARGS[1], $ARGS[2]);
log.info("Installation finished");
