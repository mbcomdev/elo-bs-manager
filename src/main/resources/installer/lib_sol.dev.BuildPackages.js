
//@include lib_Class.js
//@include lib_handlebars.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.Cache.js
//@include lib_sol.common.UserUtils.js
//@include lib_sol.common.Config.js
//@include lib_sol.common.Template.js
//@include lib_sol.common.JsonUtils.js
//@include lib_sol.common.RepoUtils.js
//@include lib_sol.common.SordUtils.js
//@include lib_sol.common.WfUtils.js
//@include lib_sol.common.FileUtils.js
//@include lib_sol.common.ExecUtils.js
//@include lib_sol.common.AsyncUtils.js
//@include lib_sol.common.SordTypeUtils.js
//@include lib_sol.common.ZipUtils.js

importPackage(java.io);

/**
 * Build packages
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 *
 * @requires sol.common.RepoUtils
 * @requires sol.common.SordUtils
 * @requires sol.common.WfUtils
 */
sol.define("sol.dev.BuildPackages", {

  /**
   * @cfg {Array} objIds
   * Object IDs of the package folders
   */

  /**
   * @cfg {String} exportDirPath
   * Export directory path
   */

   /**
    * @cfg {String} eloInstPath
    * Destination path of the eloInst file
    */

  /**
   * @cfg {Boolean} debug
   * Debug package
   */

  packageMask: "ELO Business Solution",


  initialize: function (config) {
    var me = this;
    me.$super("sol.Base", "initialize", [config]);

    me.logger = sol.create("sol.Logger", { scope: "sol.dev.BuildPackages" });
  },

  execute: function () {
    var me = this,
        objId, i, packageBuilder;

    if (!me.objIds || (me.objIds.length == 0)) {
      me.logger.info("Object IDs are empty");
      return;
    }

    me.params = me.params || {};

    me.exportDirPath = sol.create("sol.common.Template", { source: me.exportDirPath }).apply();

    sol.common.FileUtils.makeDirectories(new java.io.File(me.exportDirPath));
    if (me.cleanExportDir) {
      sol.common.FileUtils.deleteFiles({ dirPath: me.exportDirPath, suffix: ".eloinst" });
    }

    for (i = 0; i < me.objIds.length; i++) {
      objId = me.objIds[i];
      packageBuilder = sol.create("sol.dev.BuildPackage", {
        objId: objId,
        transport: me.transport,
        exportDirPath: me.exportDirPath,
        eloInstPath: me.eloInstPath
      });
      packageBuilder.execute();
    }
  }
});

/**
 * Build package
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 *
 * @requires  sol.sol.common.Json
 * @requires  sol.common.RepoUtils
 * @requires  sol.common.ZipUtils
 */
sol.define("sol.dev.BuildPackage", {

  /**
   * @cfg {String} objId
   * Object ID of the package folders
   */

  /**
   * @cfg {String} exportDirPath
   * Export directory
   */

  /**
   * @cfg {Boolean} debug
   * Debug package
   */

   /**
    * @cfg {String} eloInstPath
    * Destination path of the eloInst file
    */

  /**
   * @cfg {Boolean} transport
   * Transport package
   */

  versionNoFieldName: "BS_VERSION_NO",
  buildNoFieldName: "BS_BUILD_NO",
  setupNameSuffixFieldName: "BS_SETUP_NAME_SUFFIX",

  repoDataFileName: "RepoData",

  pilcrow: "\u00b6",

  execute: function () {
    var me = this,
        debugDstFileNamePart = "",
        transportFileNamePart = "",
        sordZ, buildNo, setupNameSuffix, dstFile, debugOnFile, datePos, installConfigFilePath, installConfig,
        workflowTemplateNames, workflowTemplateName, workflowJson, i,
        workflowTemplateNamesWithinJson, j, workflowTemplateNameWithinJson, redundantWorkflowTemplates, redundantWorkflowTemplate, workflowNameIndex,
        deleteObjId;

    if (!me.objId) {
      throw "Object ID of the package folder is empty";
    }

    if (!me.exportDirPath) {
      throw "Export directory path is empty";
    }

    me.imexExport = sol.common.RepoUtils.isImexExportFormat();

    sordZ = new SordZ(SordC.mbAll);
    sordZ.add(SordC.mbRefPaths);
    me.packageSord = ixConnect.ix().checkoutSord(me.objId + "", sordZ, LockC.NO);

    me.buildConfig = me.getBuildConfig();

    me.setupFileRepoPaths = [
      "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/common/All",
      "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/common/All Rhino",
      "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/development/All Rhino",
      "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/development/Package Installer"
    ];

    if (me.buildConfig.exportRepoPath) {
      me.exportRepoPath = me.buildConfig.exportRepoPath;
    } else {
      me.exportRepoPath = sol.common.RepoUtils.getPath(me.packageSord, true);
    }

    if (!me.eloInstRepoPath) {
      me.eloInstRepoPath = sol.common.RepoUtils.getPath(me.packageSord, true) + "/.eloinst";
    }

    if (!me.buildConfig.packageName) {
      me.buildConfig.packageName = String(me.packageSord.name);
    }

    if (!me.installConfigRepoPath) {
      me.installConfigRepoPath = sol.common.RepoUtils.getPath(me.packageSord, true) + "/.eloinst/install";
    }

    if (!me.buildConfigRepoPath) {
      me.buildConfigRepoPath = sol.common.RepoUtils.getPath(me.packageSord, true) + "/.eloinst/build";
    }

    me.outputDirPath = sol.common.FileUtils.createTempDir({ prefix: "Setup_Package" });
    me.outputDir = new java.io.File(me.outputDirPath + "");
    me.outputDir.mkdirs();

    me.zipDirPath = me.outputDirPath + java.io.File.separator + me.buildConfig.setupName;
    me.zipDir = new java.io.File(me.zipDirPath + "");
    me.zipDir.mkdirs();

    me.manifestFilePath = me.zipDirPath + java.io.File.separator + "MANIFEST.MF";
    me.transportConfigFilePath = me.zipDirPath + java.io.File.separator + "transport.json";

    me.payloadDirPath = me.zipDirPath + java.io.File.separator + "install.data";
    me.payloadDir = new java.io.File(me.payloadDirPath + "");
    me.payloadDir.mkdirs();

    me.versionNoStr = (sol.common.SordUtils.getObjKeyValue(me.packageSord, me.versionNoFieldName) + "") || "1";
    if (me.buildConfig.appendTimeStamp) {
      datePos = me.versionNoStr.indexOf("_");
      if (datePos > -1) {
        me.versionNoStr = me.versionNoStr.substring(0, datePos) + "_" + Packages.org.apache.commons.lang.time.DateFormatUtils.format(new java.util.Date(), "yyyyMMddHHmmss");
        sol.common.SordUtils.setObjKeyValue(me.packageSord, me.versionNoFieldName, me.versionNoStr, { silent: true });
      }
    }

    me.versionNoStr = sol.create("sol.common.Template", { source: me.versionNoStr }).apply();

    me.buildNoStr = sol.common.SordUtils.getObjKeyValue(me.packageSord, me.buildNoFieldName);

    me.buildNoStrPaddedLeft = sol.common.StringUtils.padLeft(me.buildNoStr, 3, "0");

    buildNo = me.buildNoStr ? parseInt(me.buildNoStr, 10) + 1 : 1;
    me.buildNoStr = String(buildNo);
    sol.common.SordUtils.setObjKeyValue(me.packageSord, me.buildNoFieldName, me.buildNoStr, { silent: true });
    ixConnect.ix().checkinSord(me.packageSord, sordZ, LockC.NO);

    try {
      setupNameSuffix = sol.common.SordUtils.getObjKeyValue(me.packageSord, me.setupNameSuffixFieldName);
      if (setupNameSuffix) {
        me.buildConfig.setupName = me.buildConfig.setupName + "_" + setupNameSuffix;
      }
    } catch (e) { /* ignore, old mask definition */ }

    me.deleteLogFileSords();

    if (me.buildConfig.deleteSords) {
      for (i = 0; i < me.buildConfig.deleteSords.length; i++) {
        deleteObjId = me.buildConfig.deleteSords[i];
        try {
          sol.common.RepoUtils.deleteSord(deleteObjId, { deleteFinally: true });
        } catch (ex) {
          // ignore
        }
      }
    }

    if (me.buildConfig.createManifestFile) {
      me.createManifestFile();
    }

    me.setupFileRepoPaths.push(me.installConfigRepoPath);
    me.setupFileRepoPaths.push(me.buildConfigRepoPath);

    me.setupFileRepoPaths.forEach(function (setupFileRepoPath) {
      sol.common.FileUtils.downloadDocuments(setupFileRepoPath, me.zipDirPath, { makeDirectories: true });
    });

    if (me.buildConfig.forceMasks) {

      me.buildConfig.forceMasks.forEach(function (forceMaskConfig) {
        me.forceMask(forceMaskConfig);
      });
    }

    me.prepareBranchForInstallExport(me.exportRepoPath);

    me.repoDataFilePath = me.payloadDirPath + java.io.File.separator + me.repoDataFileName + ".zip";
    me.repoDataFile = new java.io.File(me.repoDataFilePath);

    me.exportObjId = sol.common.RepoUtils.getObjId(me.exportRepoPath);

    sol.common.RepoUtils.exportRepoData(me.repoDataFile, { srcList: [me.exportObjId], exportDocs: true, exportKeywords: true, replaceRefWithOriginal: false });

    me.deleteBuzzwordFiles();

    me.buildConfig.workflowTemplatesDirPath = me.payloadDirPath + java.io.File.separator + "workflowTemplates";
    me.buildConfig.workflowTemplatesDir = new java.io.File(me.buildConfig.workflowTemplatesDirPath + "");

    me.buildConfig.ixPluginsDirPath = me.payloadDirPath + java.io.File.separator + "IX Plug-ins";
    me.buildConfig.ixPluginsDir = new java.io.File(me.buildConfig.ixPluginsDirPath + "");

    me.buildConfig.sordTypesDirPath = me.payloadDirPath + java.io.File.separator + "Sord types";

    me.buildConfig.masksDirPath = me.payloadDirPath + java.io.File.separator + "Masks";
    me.buildConfig.masksDir = new java.io.File(me.buildConfig.masksDirPath + "");

    if (me.debug) {
      debugOnFile = new java.io.File(me.zipDirPath + java.io.File.separator + "debug.on");
      Packages.org.apache.commons.io.FileUtils.writeStringToFile(debugOnFile, "debug.on", "UTF-8");
      debugDstFileNamePart = "_debug";
    }

    if (me.buildConfig.workflowTemplates) {
      me.buildConfig.workflowTemplatesDir.mkdirs();

      workflowTemplateNames = me.buildConfig.workflowTemplates;

      redundantWorkflowTemplates = [];

      for (i = 0; i < workflowTemplateNames.length; i++) {
        workflowTemplateName = workflowTemplateNames[i];
        workflowJson = sol.common.WfUtils.getWorkflowAsJson(workflowTemplateName);
        workflowTemplateNamesWithinJson = sol.common.WfUtils.getAllWorkflowNamesFromJson(workflowJson);
        for (j = 0; j < workflowTemplateNamesWithinJson.length; j++) {
          workflowTemplateNameWithinJson = workflowTemplateNamesWithinJson[j];
          if (workflowTemplateNameWithinJson != workflowTemplateName) {
            redundantWorkflowTemplates.push(workflowTemplateNameWithinJson);
          }
        }
      }

      for (i = 0; i < redundantWorkflowTemplates.length; i++) {
        redundantWorkflowTemplate = redundantWorkflowTemplates[i];

        workflowNameIndex = workflowTemplateNames.indexOf(redundantWorkflowTemplate);
        if (workflowNameIndex > -1) {
          workflowTemplateNames.splice(workflowNameIndex, 1);
        }
      }

      for (i = 0; i < workflowTemplateNames.length; i++) {
        workflowTemplateName = workflowTemplateNames[i];
        me.processWorkflowTemplateExport(workflowTemplateName);
      }
    }

    if (me.buildConfig.sordTypes) {
      sol.common.SordTypeUtils.exportSordTypes(me.buildConfig.sordTypes, me.buildConfig.sordTypesDirPath);
    }

    if (me.transport) {
      installConfigFilePath = me.zipDirPath + java.io.File.separator + "install.json";
      installConfig = sol.common.FileUtils.readFileToObject(installConfigFilePath);
      installConfig.transport = true;
      sol.common.FileUtils.writeObjectToFile(installConfig, installConfigFilePath);

      transportFileNamePart = "_transport";
    }

    me.exportMasks();

    me.downloadIxPlugins();
    me.copyIxPlugins();

    me.zipFile = new java.io.File(me.zipDirPath + ".eloinst");
    sol.common.ZipUtils.zipFolder(me.zipDir, me.zipFile);

     if (me.eloInstPath) {
       dstFile = new File(me.eloInstPath)
     } else {
       dstFile = new File(me.exportDirPath + File.separator + (me.buildConfig.fileNamePrefix ? (me.buildConfig.fileNamePrefix + "_") : "") + me.buildConfig.setupName + "_" + me.versionNoStr + (me.buildConfig.fileNameWithBuildNo ? ("_" + me.buildNoStrPaddedLeft) : "") + transportFileNamePart + debugDstFileNamePart + ".eloinst");
     }


    if (dstFile.exists()) {
      Packages.org.apache.commons.io.FileUtils.deleteQuietly(dstFile);
    }
    Packages.org.apache.commons.io.FileUtils.copyFile(me.zipFile, dstFile);

    sol.common.FileUtils.delete(me.outputDirPath, { quietly: true });

    me.logger.info("Package created: " + dstFile.canonicalPath);
  },

  /**
   * @private
   */
  deleteBuzzwordFiles: function () {
    var me = this,
        javaMainVersion;

    if (!me.buildConfig.deleteBuzzwordFiles) {
      return;
    }

    javaMainVersion = sol.common.ExecUtils.getJavaMainVersionNumber();


    if (javaMainVersion <= 8) {
      me.logger.info(["Building the package runs on Java version <= 8, so deleting the keyword lists is skipped. javaMainVersion={0}", javaMainVersion]);
      return;
    }

    if (me.imexExport) {
      me.logger.info(["IX uses Imex export format. Deleting the keyword lists is skipped."]);
      return;
    }

    me.buildConfig.keepBuzzwordLists = me.buildConfig.keepBuzzwordLists || [];

    me.buildConfig.keepBuzzwordLists = me.buildConfig.keepBuzzwordLists.map(function (buzzwordList) {
      return sol.common.StringUtils.endsWith(buzzwordList, ".xml") ? buzzwordList : buzzwordList + ".xml";
    });
    sol.common.ZipUtils.deleteFilesInZipFileFolder(me.repoDataFilePath, { startFolderPathInZipFile: "/buzzwds", fileNamePattern: "*.xml", keepFileNames: me.buildConfig.keepBuzzwordLists });
  },

  /**
   * @private
   */

  /**
   * @private
   * Loads the build config
   * @param {de.elo.ix.client.Sord} packageSord Package sord
   * @return {Object}
   */
  getBuildConfig: function () {
    var me = this,
        buildConfigRepoPath, buildConfigObjId, configLoader;

    buildConfigRepoPath = sol.common.RepoUtils.getPath(me.packageSord) + "/.eloinst/build";
    buildConfigObjId = sol.common.RepoUtils.getObjId(buildConfigRepoPath);
    if (!buildConfigObjId) {
      throw "Build configuration not found: packageName=" + me.packageSord.name + ", configRepoPath=" + buildConfigRepoPath;
    }
    configLoader = sol.create("sol.common.Config", { load: "ARCPATH:" + buildConfigRepoPath });
    return configLoader.config;
  },

  /**
   * @private
   * Delete log fils
   */
  deleteLogFileSords: function () {
    var me = this,
        logFileNamePart, logFileSords;

    logFileNamePart = "log_install_" + me.buildConfig.packageName + "_";

    logFileSords = sol.common.RepoUtils.findChildren(me.eloInstRepoPath, { name: logFileNamePart, sordZ: SordC.mbMin });
    logFileSords.forEach(function (logFileSord) {
      me.logger.debug("Delete log file Sord: sord.id=" + logFileSord.id + ", sord.name=" + logFileSord.name);
      sol.common.RepoUtils.deleteSord(logFileSord.id);
    });
  },

  /**
   * Create manifest file
   */
  createManifestFile: function () {
    var me = this,
        content = [],
        createdDateString = "",
        createdDate;

    content.push("Setup-Name: " + me.buildConfig.setupName);
    content.push("Setup-Version: " + me.versionNoStr + " build " + me.buildNoStr);

    if (me.buildConfig.buildDateIso) {
      createdDate = Packages.org.apache.commons.lang.time.DateUtils.parseDate(me.buildConfig.buildDateIso, ["yyyyMMdd"]);
      createdDateString = String(Packages.org.apache.commons.lang3.time.DateFormatUtils.format(createdDate, "yyyy-MM-dd'T'HH:mm:ssZZ"));
    } else {
      createdDateString = sol.common.FileUtils.getTimeStampString("yyyy-MM-dd'T'HH:mm:ssZZ");
    }

    content.push("Created-At: " + createdDateString);
    content.push("Built-By: " + ixConnect.loginResult.user.name);
    sol.common.FileUtils.writeStringArrayToFile(me.manifestFilePath, content);
  },

  /**
   * @private
   * Force a specific Mask
   * @param {Object} forceMaskConfig Change mask find definition
   */
  forceMask: function (forceMaskConfig) {
    var me = this,
        sords, i, sord, logRepoPath;

    if (!forceMaskConfig) {
      throw "Force mask configution is empty";
    }

    if (!forceMaskConfig.findChildren) {
      throw "Find children configuation is empty";
    }

    if (!forceMaskConfig.findChildren.objId) {
      throw "Object ID is empty";
    }

    if (!forceMaskConfig.mask) {
      throw "Mask is empty";
    }

    forceMaskConfig.findChildren.sordZ = SordC.mbAll;

    sords = sol.common.RepoUtils.findChildren(forceMaskConfig.findChildren.objId, forceMaskConfig.findChildren.params);

    for (i = 0; i < sords.length; i++) {
      sord = sords[i];
      if (sord.maskName != forceMaskConfig.mask) {
        sord = ixConnect.ix().changeSordMask(sord, forceMaskConfig.mask, EditInfoC.mbSord).sord;
        logRepoPath = sol.common.StringUtils.replaceAll(sord.refPaths[0].pathAsString + "", me.pilcrow, "/") + "/" + sord.name;

        me.logger.debug("Change sord mask: " + logRepoPath + " -> mask=" + sord.maskName);
        ixConnect.ix().checkinSord(sord, SordC.mbAll, LockC.NO);
      }
    }
  },

  /**
   * @private
   * Prepares a branch for installation export
   * @param {String} startId
   */
  prepareBranchForInstallExport: function (startId) {
    var me = this,
        sordZ, sords, startSord;
    me.logger.enter("prepareBranchForInstallExport", startId);

    if (!startId) {
      throw "Start ID is empty";
    }

    sordZ = new SordZ(ObjDataC.mbOwnerId);
    sordZ.add(ObjDataC.mbName);
    sordZ.add(SordC.mbAclItems);
    sordZ.add(ObjDataC.mbLockId);

    startSord = sol.common.RepoUtils.getSord(startId, { sordZ: sordZ });
    me.prepareSordForInstallExport(startSord);

    sords = sol.common.RepoUtils.findChildren(startId, { sordZ: sordZ, recursive: true, level: 32 });
    sords.forEach(function (sord) {
      me.prepareSordForInstallExport(sord);
    });
    me.logger.exit("prepareBranchForInstallExport");
  },

  /**
   * @private
   * Prepares a sord for installation export
   * @param {de.elo.ix.client.Sord} sord Sord
   * @param {Object} config Configuration
   */
  prepareSordForInstallExport: function (sord, config) {
    var me = this,
        newAclItems = [],
        aclChanged = false,
        writeSord = false,
        i, aclItem, sordZ, aclItemId, aclItemName, sordOwnerId, sordOwnerName;

    if (!sord) {
      throw "Sord is empty";
    }

    me.ownerId = me.ownerId || 0;
    me.buildConfig.preserveAclUserIds = me.buildConfig.preserveAclUserIds || ["0", "1", "9999"];
    me.buildConfig.preserveAclUserNames = me.buildConfig.preserveAclUserNames || [];

    if ((sord.lockId > -1) && (me.buildConfig.checkLocks) && !me.debug) {
      throw "Sord is locked: sord.id=" + sord.id + ", sord.name=" + sord.name + ", sord.lockName=" + sord.lockName;
    }

    if (sol.common.SordUtils.isFolder(sord) && (sord.mask == 0)) {
      sord = sol.common.SordUtils.changeMask(sord, "1");
    }

    sordOwnerId = sord.ownerId + "";
    sordOwnerName = sord.ownerName + "";

    if (sordOwnerId != me.ownerId) {
      if ((me.buildConfig.preserveAclUserIds.indexOf(sordOwnerId) < 0) && (me.buildConfig.preserveAclUserNames.indexOf(sordOwnerName) < 0)) {
        sord.ownerId = me.ownerId;
        writeSord = true;
      }
    }

    for (i = 0; i < sord.aclItems.length; i++) {
      aclItem = sord.aclItems[i];
      aclItemId = aclItem.id + "";
      aclItemName = aclItem.name + "";
      if ((me.buildConfig.preserveAclUserIds.indexOf(aclItemId) > -1) || (me.buildConfig.preserveAclUserNames.indexOf(aclItemName) > -1)) {
        newAclItems.push(aclItem);
      } else {
        aclChanged = true;
      }
    }

    if (aclChanged) {
      sord.aclItems = newAclItems;
      writeSord = true;
    }

    if (writeSord) {
      try {
        sordZ = new SordZ(ObjDataC.mbOwnerId);
        sordZ.add(SordC.mbAclItems);

        ixConnect.ix().checkinSord(sord, sordZ, LockC.NO);
      } catch (ex) {
        throw "Can't prepare sord for installation export: sord.id=" + sord.id + ", sord.name=" + sord.name + ", exception=" + ex;
      }
    }
  },

  /**
   * @private
   * Processes the export of a workflow template
   * @param {String} workflowTemplateName Name of the worklflow name
   */
  processWorkflowTemplateExport: function (workflowTemplateName) {
    var me = this,
        workflowTemplateFile, workflowTemplateFileName;

    workflowTemplateFileName = sol.common.FileUtils.sanitizeFilename(workflowTemplateName);

    workflowTemplateFile = new java.io.File(me.buildConfig.workflowTemplatesDirPath + java.io.File.separator + workflowTemplateFileName + ".json");

    sol.common.WfUtils.exportWorkflowTemplate(workflowTemplateName, workflowTemplateFile, { clearUsers: true, addSubTemplateInfo: true });
  },

  /**
   * @private
   * @returns
   */
  exportMasks: function () {
    var me = this,
        systemMasks, expInfoContent, expInfoIni, maskName, i;

    systemMasks = [
      "ELOScripts",
      "Basic Entry",
      "Folder"
    ];

    if (me.imexExport) {
      me.logger.info(["IX uses Imex export format. Exporting masks is skipped."]);
      return;
    }

    me.buildConfig.masks = me.buildConfig.masks || [];

    expInfoContent = sol.common.ZipUtils.readFileInZipToString(me.repoDataFilePath, "ExpInfo.ini", { encoding: "UTF-16LE" });

    expInfoIni = sol.create("sol.common.IniFile", {});
    expInfoIni.parse(expInfoContent);

    for (i = 0; i < 100; i++) {
      maskName = expInfoIni.getValue("MASKS", i);
      if (maskName) {
        me.buildConfig.masks.push(maskName);
      } else {
        break;
      }
    }

    systemMasks.forEach(function (mask) {
      var index;
      index = me.buildConfig.masks.indexOf(mask);
      if (index > -1) {
        me.buildConfig.masks.splice(index, 1);
      }
    });

    if (me.buildConfig.masks && (me.buildConfig.masks.length > 0)) {

      sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, false);

      me.buildConfig.masksDir.mkdirs();
      me.buildConfig.masks.forEach(function (mask) {
        me.processMaskExport(mask);
      });

      sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, true);
    }
  },

  defaultMaskGuids: [
    "(E10E1000-E100-E100-E100-E10E10E10E30)",
    "(E10E1000-E100-E100-E100-E10E10E10E31)"
  ],

  /**
   * @private
   * Processes the export of a mask
   * @param {String} maskName Name of the worklflow name
   */
  processMaskExport: function (maskName) {
    var me = this,
        mask, maskGuid, json, fileName, maskFilePath, line, i, maskObj;

    maskName += "";

    mask = ixConnect.ix().checkoutDocMask(maskName, DocMaskC.mbAll, LockC.NO);

    if (!mask) {
      throw "Mask '" + maskName + "' not found";
    }

    maskGuid = mask.guid + "";
    if (me.defaultMaskGuids.indexOf(maskGuid) > -1) {
      return;
    }

    fileName = sol.common.FileUtils.sanitizeFilename(maskName + "");

    maskFilePath = new java.io.File(me.buildConfig.masksDirPath + java.io.File.separator + fileName + ".json");

    mask.acl = "";
    mask.DAcl = "";
    me.clearIds(mask.aclItems);
    me.clearIds(mask.docAclItems);
    for (i = 0; i < mask.lines.length; i++) {
      line = mask.lines[i];
      line.acl = "";
      me.clearIds(line.aclItems);
    }

    json = sol.common.JsonUtils.serialize(mask);

    maskObj = JSON.parse(json);

    me.adjustMask(maskObj);

    json = JSON.stringify(maskObj, null, 2);

    sol.common.FileUtils.writeStringToFile(maskFilePath, json);
  },

  adjustMask: function (maskObj) {
    var me = this,
        childMaskNames = [],
        i, line, mask, maskId;

    maskObj.id = -1;
    maskObj.TStamp = "2018.01.01.00.00.00";

    me.adjustAcl(maskObj.aclItems);

    for (i = 0; i < maskObj.lines.length; i++) {
      line = maskObj.lines[i];
      line.maskId = -1;
      me.adjustAcl(line.aclItems);
    }

    if (maskObj.maskIdsForChildEntries) {

      for (i = 0; i < maskObj.maskIdsForChildEntries.length; i++) {
        maskId = maskObj.maskIdsForChildEntries[i] + "";
        try {
          mask = ixConnect.ix().checkoutDocMask(maskId, DocMaskC.mbAll, LockC.NO);
          childMaskNames.push(mask.name + "");
        } catch (ex) {
          log.warn("Cannot find child entry mask: maskId=" + maskId);
        }
      }

      maskObj.maskIdsForChildEntries = childMaskNames;
    }

    if (maskObj.flowId && (maskObj.flowId > 0)) {
      try {
        maskObj.flowId = sol.common.WfUtils.getWorkflowTemplateName(maskObj.flowId);
      } catch (ex) {
        maskObj.flowId = -1;
      }
    }
  },

  adjustAcl: function (aclItems) {
    var me = this,
        i, aclItem, aclName;

    me.adminName = me.adminName || (me.getUserName(UserInfoC.ID_ADMINISTRATOR) + "");
    me.everyoneName = me.everyoneName || (me.getUserName(UserInfoC.ID_EVERYONE_GROUP) + "");

    for (i = 0; i < aclItems.length; i++) {
      aclItem = aclItems[i];
      aclName = aclItem.name;

      switch (aclName) {
        case (me.adminName):
          aclItem.id = 0;
          aclItem.name = "";
          break;

        case (me.everyoneName):
          aclItem.id = 9999;
          aclItem.name = "";
          break;

        default:
          break;
      }
    }
  },

  getUserName: function (id) {
    var userNames, name;

    userNames = ixConnect.ix().getUserNames([id + ""], CheckoutUsersC.BY_IDS_RAW);
    name = userNames[0].name;

    return name;
  },

  /**
   * @private
   * Copy IX plug-ins
   */
  copyIxPlugins: function () {
    var me = this,
        i, ixPluginDirPath, ixPluginDir, jarCollection, jarIterator, jarFile, subDirName, gitIxPluginDir;

    if (me.buildConfig.ixPluginDirs) {
      for (i = 0; i < me.buildConfig.ixPluginDirs.length; i++) {
        ixPluginDirPath = me.buildConfig.ixPluginDirs[i];
        ixPluginDir = new java.io.File(ixPluginDirPath);

        if (!ixPluginDir.exists()) {
          continue;
        }

        jarCollection = Packages.org.apache.commons.io.FileUtils.listFiles(ixPluginDir,
          new Packages.org.apache.commons.io.filefilter.SuffixFileFilter(["jar"], Packages.org.apache.commons.io.IOCase.INSENSITIVE),
          Packages.org.apache.commons.io.filefilter.FalseFileFilter.INSTANCE);

        jarIterator = jarCollection.iterator();
        while (jarIterator.hasNext()) {
          jarFile = jarIterator.next();
          subDirName = jarFile.parentFile.name;
          ixPluginDir = new java.io.File(me.payloadDirPath, subDirName);
          Packages.org.apache.commons.io.FileUtils.copyFileToDirectory(jarFile, ixPluginDir);
          if (me.buildConfig.gitPackagePath) {
            gitIxPluginDir = new java.io.File(me.buildConfig.gitPackagePath + java.io.File.separator + "install.data" + java.io.File.separator + subDirName);
            gitIxPluginDir.mkdirs();
            log.info("Copy IX plugin to Git directory: file=" + jarFile.absolutePath + ", gitIxPluginDir=" + gitIxPluginDir.absolutePath);
            Packages.org.apache.commons.io.FileUtils.copyFileToDirectory(jarFile, gitIxPluginDir);
          }
        }
      }
    }
  },

  /**
   * @private
   * Downloads IX plug-ins
   */
  downloadIxPlugins: function () {
    var me = this,
        pluginName, i;

    if (me.buildConfig.ixPlugins) {
      for (i = 0; i < me.buildConfig.ixPlugins.length; i++) {
        pluginName = me.buildConfig.ixPlugins[i];
        me.downloadIxPlugin(pluginName);
      }
    }
  },

  /**
   * @private
   * Download an IX plug-in
   * @param {String} pluginName
   */
  downloadIxPlugin: function (pluginName) {
    var me = this,
        jsonArgs, args, anyResult, fileData, targetFilePath;

    if (!pluginName) {
      throw "Plug-in name is empty";
    }

    jsonArgs = { name: pluginName };

    args = new Any;
    args.type = AnyC.TYPE_STRING;
    args.stringValue = JSON.stringify(jsonArgs);

    anyResult = ixConnect.ix().executeRegisteredFunction("RF_sol_dev_service_DownloadIxPlugin", args);

    fileData = AnyToObject.toObject(anyResult);

    me.buildConfig.ixPluginsDir.mkdirs();
    targetFilePath = me.buildConfig.ixPluginsDirPath + java.io.File.separator + pluginName;

    sol.common.FileUtils.saveFileData(fileData, targetFilePath);
  },

  /**
   * @private
   * Clears the `id` property of an array
   * @param {Array} arr Array
   */
  clearIds: function (arr) {
    var i, element;

    for (i = 0; i < arr.length; i++) {
      element = arr[i];
      element.id = -1;
    }
  }
});

