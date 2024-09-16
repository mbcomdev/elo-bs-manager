
/* global EloInstallPackage, BASE_CONFIG, SCRIPT_CONFIG */

//@include lib_sol.dev.BuildPackages.js

EloBuildPackage = {

  execute: function (packageRepoPath, exportPath, eloInstPath) {
    var builder;
    exportPath += "";
    exportPath = exportPath.replace("\"", "").trim();
    log.info("Build packages: packagePath=" + packageRepoPath);
    EloShellScriptRunner.connectIx(BASE_CONFIG.ixUrl, BASE_CONFIG.username, BASE_CONFIG.password, BASE_CONFIG.language);
    builder = sol.create("sol.dev.BuildPackages", {
        objIds: ["ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:" + packageRepoPath],
        exportDirPath: exportPath,
        cleanExportDir: false,
        eloInstPath: eloInstPath
    });
   builder.execute();
  }
}

EloBuildPackage.execute($ARGS[0], $ARGS[1], $ARGS[2]);
log.info("Build finished");